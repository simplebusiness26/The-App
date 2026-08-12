import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import GateNotice from "../../components/GateNotice";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK} from "../../utils/tokens";

function firstParam(value){
  return Array.isArray(value) ? value[0] : value || null;
}

function formatAppliedAt(value){
  if(!value) return "";

  return new Date(value).toLocaleString([],{
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function MemberIdentity({membership,profiles}){
  const profile=profiles[membership.user_id];
  const name=profile?.full_name || membership.applicant_name || "Explorer";

  return(
    <View style={styles.memberIdentity}>
      {profile?.profile_photo ? (
        <Image source={{uri:profile.profile_photo}} style={styles.memberAvatar}/>
      ) : (
        <View style={styles.memberAvatarFallback}>
          <Text style={styles.memberInitial}>{name.slice(0,1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.memberNameWrap}>
        <Text style={styles.applicantName}>{name}</Text>
        <Text style={styles.memberMeta}>
          Applied {formatAppliedAt(membership.applied_at)}
        </Text>
      </View>
    </View>
  );
}

function NextStep({icon,text,tone="success"}){
  return(
    <View style={styles.nextStepRow}>
      <View style={[
        styles.nextStepIcon,
        tone==="info" ? styles.infoIcon : styles.successIcon
      ]}>
        <Text style={styles.nextStepIconText}>{icon}</Text>
      </View>
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

export default function ManagerRequests(){
  // Packet 4: entitlement is decided by public.manages_any_listing() in the
  // database, not by the drawer having hidden the row that leads here.
  const managerGate=useManagerGate();

  const params=useLocalSearchParams();
  const targetClubId=firstParam(params.club);
  const targetMembershipId=firstParam(params.membership);

  const {showFeedback}=useFeedback();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [clubs,setClubs]=useState([]);
  const [memberships,setMemberships]=useState([]);
  const [memberProfiles,setMemberProfiles]=useState({});
  const [workingId,setWorkingId]=useState(null);
  const [completedAction,setCompletedAction]=useState(null);

  useFocusEffect(useCallback(()=>{
    loadActions();
  },[targetClubId,targetMembershipId]));

  async function loadActions(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data:clubRows,error:clubError}=await supabase
      .from("activity_clubs")
      .select("id,name,category,location,member_limit,status")
      .eq("manager_id",user.id)
      .order("name",{ascending:true});

    if(clubError){
      setError("Your Activity Clubs could not be loaded.");
      setLoading(false);
      return;
    }

    const ownedClubs=clubRows || [];
    setClubs(ownedClubs);

    const clubIds=ownedClubs.map(club=>club.id);

    if(!clubIds.length){
      setMemberships([]);
      setMemberProfiles({});
      setLoading(false);
      return;
    }

    const {data:membershipRows,error:membershipError}=await supabase
      .from("activity_memberships")
      .select("*")
      .in("club_id",clubIds)
      .order("applied_at",{ascending:true});

    if(membershipError){
      setError("Membership requests could not be loaded.");
      setLoading(false);
      return;
    }

    const rows=membershipRows || [];
    setMemberships(rows);

    const userIds=[...new Set(rows.map(item=>item.user_id))];

    if(userIds.length){
      const {data:profileRows}=await supabase
        .from("profiles")
        .select("id,full_name,profile_photo")
        .in("id",userIds);

      const profileMap={};
      (profileRows || []).forEach(item=>{
        profileMap[item.id]=item;
      });
      setMemberProfiles(profileMap);
    }else{
      setMemberProfiles({});
    }

    setLoading(false);
  }

  const pendingMemberships=useMemo(
    ()=>memberships.filter(item=>item.status==="pending"),
    [memberships]
  );

  const approvedByClub=useMemo(()=>{
    const grouped={};

    memberships
      .filter(item=>item.status==="approved")
      .forEach(item=>{
        if(!grouped[item.club_id]) grouped[item.club_id]=[];
        grouped[item.club_id].push(item);
      });

    return grouped;
  },[memberships]);

  const clubsWithRequests=useMemo(()=>{
    const visibleClubs=targetClubId
      ? clubs.filter(club=>club.id===targetClubId)
      : clubs;

    return visibleClubs
      .map(club=>({
        ...club,
        requests:pendingMemberships.filter(item=>item.club_id===club.id)
      }))
      .filter(club=>club.requests.length>0);
  },[clubs,pendingMemberships,targetClubId]);

  const focusedMembership=targetMembershipId
    ? memberships.find(item=>item.id===targetMembershipId)
    : null;

  const focusedRequest=focusedMembership?.status==="pending"
    ? focusedMembership
    : null;

  function membershipName(membership){
    const profile=memberProfiles[membership.user_id];
    return profile?.full_name || membership.applicant_name || "Explorer";
  }

  async function decideMembership(membership,status,club){
    const approvedCount=(approvedByClub[club.id] || []).length;
    const limit=club.member_limit || 20;

    if(status==="approved" && approvedCount>=limit){
      showFeedback(
        `${club.name} already has ${limit} approved members.`,
        "error",
        "Member limit reached"
      );
      return;
    }

    const name=membershipName(membership);
    setWorkingId(membership.id);

    const {data:updatedRows,error:updateError}=await supabase
      .from("activity_memberships")
      .update({
        status,
        decided_at:new Date().toISOString()
      })
      .eq("id",membership.id)
      .eq("status","pending")
      .select("id,user_id,status");

    setWorkingId(null);

    if(updateError){
      showFeedback(updateError.message,"error","Request not updated");
      return;
    }

    if(!updatedRows?.length){
      showFeedback(
        "This request was already updated. Refresh the Action Centre to see its current status.",
        "error",
        "Request already handled"
      );
      await loadActions();
      return;
    }

    setCompletedAction({
      membershipId:membership.id,
      userId:membership.user_id,
      name,
      clubName:club.name,
      clubId:club.id,
      memberLimit:limit,
      status
    });

    showFeedback(
      status==="approved"
        ? `${name} was approved and now has message-board access.`
        : `${name}'s membership request was rejected.`,
      "success",
      status==="approved" ? "Member approved" : "Request rejected"
    );

    await loadActions();
  }

  function renderRequest(membership,club,isFocused=false){
    const approvedCount=(approvedByClub[club.id] || []).length;
    const limit=club.member_limit || 20;
    const full=approvedCount>=limit;

    return(
      <View
        key={membership.id}
        style={[styles.requestCard,isFocused && styles.focusedRequestCard]}
      >
        {isFocused && (
          <Text style={styles.focusLabel}>OPENED FROM NOTIFICATION</Text>
        )}

        <MemberIdentity membership={membership} profiles={memberProfiles}/>

        {!!membership.application_note && (
          <View style={styles.noteCard}>
            <Text style={styles.noteLabel}>APPLICATION MESSAGE</Text>
            <Text style={styles.noteText}>{membership.application_note}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.approveButton,full && styles.disabledButton]}
            disabled={workingId===membership.id || full}
            onPress={()=>decideMembership(membership,"approved",club)}
          >
            <Text style={styles.buttonText}>
              {workingId===membership.id
                ? "Updating..."
                : full
                  ? "Club full"
                  : "Approve"
              }
            </Text>
          </Pressable>

          <Pressable
            style={styles.rejectButton}
            disabled={workingId===membership.id}
            onPress={()=>decideMembership(membership,"rejected",club)}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderCompletion(action){
    if(!action) return null;

    const approved=action.status==="approved";
    const currentApprovedCount=(approvedByClub[action.clubId] || []).length;
    const memberLabel=action.name || "Explorer";

    return(
      <>
        <View style={[
          styles.resultCard,
          approved ? styles.approvedResultCard : styles.rejectedResultCard
        ]}>
          <View style={[
            styles.resultIconCircle,
            approved ? styles.approvedIconCircle : styles.rejectedIconCircle
          ]}>
            <Text style={styles.resultIcon}>{approved ? "✓" : "×"}</Text>
          </View>

          <Text style={styles.resultTitle}>
            {approved ? "Membership approved" : "Application rejected"}
          </Text>

          <Text style={styles.resultText}>
            {approved
              ? `${memberLabel} is now a member of ${action.clubName} and has access to the private message board.`
              : `${memberLabel}'s membership request was not approved. They have been notified.`
            }
          </Text>

          <View style={[
            styles.resultCapacityCard,
            approved ? styles.approvedCapacityCard : styles.rejectedCapacityCard
          ]}>
            <Text style={styles.resultCapacityIcon}>👥</Text>
            <View style={styles.resultCapacityTextWrap}>
              <Text style={styles.resultCapacityLabel}>Club capacity</Text>
              <Text style={styles.resultCapacityValue}>
                {currentApprovedCount} of {action.memberLimit} members approved
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={()=>{
              if(approved){
                router.push(`/manager/dashboard?club=${action.clubId}&member=${action.userId}&view=members`);
              }else{
                router.replace(`/manager/requests?club=${action.clubId}&view=requests`);
              }
            }}
          >
            <Text style={styles.buttonText}>
              {approved ? "View approved member" : "Back to pending requests"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.inlineLinkButton}
            onPress={()=>{
              if(approved){
                router.push(`/manager/dashboard?club=${action.clubId}&view=members`);
              }else{
                router.replace(`/manager/requests?club=${action.clubId}&view=requests`);
              }
            }}
          >
            <Text style={styles.inlineLinkIcon}>▣</Text>
            <Text style={styles.inlineLinkText}>
              {approved ? "View all club members" : "View all requests for this club"}
            </Text>
            <Text style={styles.inlineLinkArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextCardTitle}>What happens next?</Text>

          <NextStep
            icon="✓"
            text={`${memberLabel} has been notified`}
          />

          <NextStep
            icon="✓"
            text={approved
              ? "They can now access the private message board"
              : "They can apply again at any time"
            }
          />

          <NextStep
            icon="i"
            tone="info"
            text={approved
              ? "You can remove members at any time from the Manager Dashboard"
              : "You can continue managing members from the Manager Dashboard"
            }
          />
        </View>
      </>
    );
  }

  if(!managerGate.allowed){
    return <GateNotice checking={managerGate.checking} message={managerGate.error}/>;
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
        <Text style={styles.loadingText}>Loading pending actions...</Text>
      </View>
    );
  }

  if(error){
    return(
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Action Centre unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const focusedClub=targetClubId
    ? clubs.find(club=>club.id===targetClubId)
    : focusedMembership
      ? clubs.find(club=>club.id===focusedMembership.club_id)
      : null;

  const persistedCompletion=(
    focusedMembership &&
    focusedClub &&
    ["approved","rejected"].includes(focusedMembership.status)
  ) ? {
    membershipId:focusedMembership.id,
    userId:focusedMembership.user_id,
    name:membershipName(focusedMembership),
    clubName:focusedClub.name,
    clubId:focusedClub.id,
    memberLimit:focusedClub.member_limit || 20,
    status:focusedMembership.status
  } : null;

  const completionToShow=completedAction || persistedCompletion;
  const focusedRequestMissing=!!targetMembershipId && !focusedRequest;

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.title}>Manager Action Centre</Text>
          <Text style={styles.subtitle}>
            Review approvals and decisions without searching through your listings.
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countNumber}>{pendingMemberships.length}</Text>
          <Text style={styles.countLabel}>pending</Text>
        </View>
      </View>

      <View style={styles.topButtons}>
        <Pressable style={styles.secondaryButton} onPress={()=>router.push("/notifications")}>
          <Text style={styles.secondaryButtonText}>Notifications</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={()=>router.push("/manager/dashboard")}>
          <Text style={styles.secondaryButtonText}>Manager Dashboard</Text>
        </Pressable>
      </View>

      {targetMembershipId && focusedRequest && focusedClub && (
        <View style={styles.focusSection}>
          <Text style={styles.sectionEyebrow}>MEMBERSHIP REQUEST</Text>
          <Text style={styles.sectionTitle}>{focusedClub.name}</Text>
          <Text style={styles.sectionSub}>
            Review this exact application. Approving immediately unlocks the private message board.
          </Text>

          <View style={styles.capacityCard}>
            <Text style={styles.capacityText}>
              {(approvedByClub[focusedClub.id] || []).length} of {focusedClub.member_limit || 20} members approved
            </Text>
          </View>

          {renderRequest(focusedRequest,focusedClub,true)}

          {pendingMemberships.filter(item=>item.club_id===focusedClub.id && item.id!==focusedRequest.id).length>0 && (
            <Pressable
              style={styles.viewGroupButton}
              onPress={()=>router.replace(`/manager/requests?club=${focusedClub.id}&view=requests`)}
            >
              <Text style={styles.viewGroupText}>
                View all requests for {focusedClub.name}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {focusedRequestMissing && completionToShow && renderCompletion(completionToShow)}

      {focusedRequestMissing && !completionToShow && (
        <View style={styles.completedCard}>
          <Text style={styles.completedIcon}>✓</Text>
          <Text style={styles.completedTitle}>This request is no longer pending</Text>
          <Text style={styles.completedText}>
            Its current status is no longer an approval decision.
          </Text>

          {focusedClub && (
            <Pressable
              style={styles.primaryButton}
              onPress={()=>router.replace(`/manager/requests?club=${focusedClub.id}&view=requests`)}
            >
              <Text style={styles.buttonText}>View this club's pending requests</Text>
            </Pressable>
          )}
        </View>
      )}

      {!targetMembershipId && clubsWithRequests.map(club=>(
        <View key={club.id} style={styles.clubSection}>
          <View style={styles.clubHeader}>
            <View style={styles.clubHeaderText}>
              <Text style={styles.sectionTitle}>{club.name}</Text>
              <Text style={styles.sectionSub}>
                {club.requests.length} pending request{club.requests.length===1 ? "" : "s"}
              </Text>
            </View>

            <Text style={styles.clubCapacity}>
              {(approvedByClub[club.id] || []).length}/{club.member_limit || 20}
            </Text>
          </View>

          {club.requests.map(request=>renderRequest(request,club,false))}
        </View>
      ))}

      {!targetMembershipId && clubsWithRequests.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyText}>
            There are no Activity Club membership requests waiting for a decision.
          </Text>
          <Pressable style={styles.primaryButton} onPress={()=>router.push("/manager/dashboard")}>
            <Text style={styles.buttonText}>Return to Manager Dashboard</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:70},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:INK.card},
  loadingText:{marginTop:14,color:INK.inkSoft},
  errorTitle:{fontSize:22,fontWeight:"bold",textAlign:"center"},
  errorText:{color:INK.inkSoft,textAlign:"center",marginTop:10,lineHeight:21},
  headingRow:{flexDirection:"row",alignItems:"flex-start",gap:14},
  headingText:{flex:1},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{fontSize:15,color:INK.inkSoft,lineHeight:22,marginTop:6},
  countBadge:{minWidth:72,backgroundColor:INK.card,borderWidth:1,borderColor:INK.yellow,borderRadius:14,paddingVertical:10,paddingHorizontal:12,alignItems:"center"},
  countNumber:{fontSize:23,fontWeight:"bold",color:INK.red},
  countLabel:{fontSize:11,color:INK.red,fontWeight:"bold",textTransform:"uppercase"},
  topButtons:{flexDirection:"row",gap:10,marginTop:18,marginBottom:24},
  secondaryButton:{flex:1,borderWidth:1,borderColor:INK.ink,backgroundColor:INK.card,padding:12,borderRadius:10},
  secondaryButtonText:{textAlign:"center",fontWeight:"bold",color:INK.blue},
  focusSection:{backgroundColor:INK.card,borderRadius:16,padding:18,borderWidth:2,borderColor:INK.blue},
  clubSection:{backgroundColor:INK.card,borderRadius:16,padding:18,borderWidth:1,borderColor:INK.ink,marginBottom:18},
  sectionEyebrow:{fontSize:11,fontWeight:"bold",color:INK.blue,letterSpacing:0.6,marginBottom:6},
  sectionTitle:{fontSize:22,fontWeight:"bold"},
  sectionSub:{fontSize:14,color:INK.inkSoft,lineHeight:20,marginTop:4},
  clubHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14},
  clubHeaderText:{flex:1},
  clubCapacity:{backgroundColor:INK.card,color:INK.blue,fontWeight:"bold",paddingHorizontal:11,paddingVertical:7,borderRadius:18,overflow:"hidden"},
  capacityCard:{backgroundColor:INK.card,borderRadius:10,padding:12,marginTop:14},
  capacityText:{color:INK.blue,fontWeight:"bold"},
  requestCard:{backgroundColor:INK.card,borderRadius:13,padding:15,borderWidth:1,borderColor:INK.ink,marginTop:12},
  focusedRequestCard:{backgroundColor:INK.card,borderColor:INK.yellow,borderWidth:2},
  focusLabel:{fontSize:11,fontWeight:"bold",color:INK.red,marginBottom:11},
  memberIdentity:{flexDirection:"row",alignItems:"center"},
  memberAvatar:{width:50,height:50,borderRadius:25,backgroundColor:INK.hair},
  memberAvatarFallback:{width:50,height:50,borderRadius:25,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  memberInitial:{color:INK.card,fontWeight:"bold",fontSize:20},
  memberNameWrap:{marginLeft:12,flex:1},
  applicantName:{fontSize:18,fontWeight:"bold",color:INK.ink},
  memberMeta:{fontSize:12,color:INK.inkSoft,marginTop:4},
  noteCard:{backgroundColor:INK.card,borderRadius:10,padding:12,marginTop:13,borderWidth:1,borderColor:INK.ink},
  noteLabel:{fontSize:10,fontWeight:"bold",color:INK.inkSoft,letterSpacing:0.4},
  noteText:{fontSize:15,color:INK.ink,lineHeight:21,marginTop:6},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14},
  approveButton:{flex:1,backgroundColor:INK.green,padding:14,borderRadius:10},
  rejectButton:{flex:1,backgroundColor:INK.red,padding:14,borderRadius:10},
  disabledButton:{opacity:0.5},
  buttonText:{color:INK.card,fontWeight:"bold",textAlign:"center"},
  viewGroupButton:{borderWidth:1,borderColor:INK.blue,padding:13,borderRadius:10,marginTop:14},
  viewGroupText:{color:INK.blue,fontWeight:"bold",textAlign:"center"},
  completedCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:24,alignItems:"center"},
  completedIcon:{fontSize:36,color:INK.green,fontWeight:"bold"},
  completedTitle:{fontSize:21,fontWeight:"bold",marginTop:8},
  completedText:{color:INK.ink,textAlign:"center",lineHeight:20,marginTop:7},
  resultCard:{borderRadius:16,padding:22,alignItems:"center",borderWidth:1},
  approvedResultCard:{backgroundColor:INK.card,borderColor:INK.green},
  rejectedResultCard:{backgroundColor:INK.card,borderColor:INK.red},
  resultIconCircle:{width:70,height:70,borderRadius:35,alignItems:"center",justifyContent:"center"},
  approvedIconCircle:{backgroundColor:INK.green},
  rejectedIconCircle:{backgroundColor:INK.red},
  resultIcon:{color:INK.card,fontSize:40,fontWeight:"bold",lineHeight:44},
  resultTitle:{fontSize:24,fontWeight:"bold",marginTop:16,textAlign:"center"},
  resultText:{fontSize:16,color:INK.ink,lineHeight:23,textAlign:"center",marginTop:10},
  resultCapacityCard:{alignSelf:"stretch",borderRadius:12,padding:14,marginTop:18,flexDirection:"row",alignItems:"center"},
  approvedCapacityCard:{backgroundColor:INK.card},
  rejectedCapacityCard:{backgroundColor:INK.card},
  resultCapacityIcon:{fontSize:27,marginRight:12},
  resultCapacityTextWrap:{flex:1},
  resultCapacityLabel:{fontWeight:"bold",fontSize:15},
  resultCapacityValue:{fontSize:13,color:INK.ink,marginTop:3},
  inlineLinkButton:{alignSelf:"stretch",borderTopWidth:1,borderColor:"rgba(80,90,85,0.25)",marginTop:18,paddingTop:15,flexDirection:"row",alignItems:"center"},
  inlineLinkIcon:{fontSize:19,marginRight:9},
  inlineLinkText:{fontWeight:"600",flex:1},
  inlineLinkArrow:{fontSize:26,color:INK.ink},
  nextCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:20,marginTop:16},
  nextCardTitle:{fontSize:19,fontWeight:"bold",marginBottom:14},
  nextStepRow:{flexDirection:"row",alignItems:"flex-start",marginBottom:13},
  nextStepIcon:{width:25,height:25,borderRadius:13,alignItems:"center",justifyContent:"center",marginRight:11},
  successIcon:{backgroundColor:INK.green},
  infoIcon:{backgroundColor:INK.blue},
  nextStepIconText:{color:INK.card,fontWeight:"bold",fontSize:13},
  nextStepText:{flex:1,fontSize:15,lineHeight:21,color:INK.ink},
  emptyCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:28,alignItems:"center"},
  emptyIcon:{fontSize:38,color:INK.green,fontWeight:"bold"},
  emptyTitle:{fontSize:21,fontWeight:"bold",marginTop:8},
  emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:21,marginTop:7},
  primaryButton:{backgroundColor:INK.blue,paddingHorizontal:18,paddingVertical:14,borderRadius:10,marginTop:18,alignSelf:"stretch"}
});
