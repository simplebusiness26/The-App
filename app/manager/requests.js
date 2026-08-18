import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import GateNotice from "../../components/GateNotice";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Frame,
  Glyph,
  Meter,
  MONO,
  Notice,
  Panel,
  ReadoutStrip,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// The Action Centre: everything waiting on a manager's decision, and nothing
// else. Listing management lives on the dashboard.
//
// WHY APPROVE IS NOT GREEN AND REJECT IS NOT RED
//
// docs/design-system.md spends `agree` and `dispute` on exactly one thing: a
// manager answering a review, and a manager disputing one. Deciding a
// membership application is not that act -- it is an approval, the same kind of
// decision an administrator makes on a claim -- so it takes the same treatment:
// `exists` on the affirmative control, an outline on the other. A green button
// and a red button side by side is the shape of a warning, and a person
// applying to a running club is not a hazard.
//
// Capacity is the other thing this screen got wrong. "12 of 20 members
// approved" is a sentence about a number with a ceiling, which is exactly what
// a Meter draws, and the ceiling is the part that decides whether Approve is
// even pressable.

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
      <Frame size={44} round style={styles.avatarFrame}>
        {profile?.profile_photo
          ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
          : <Text style={styles.avatarLetter}>{name.slice(0,1).toUpperCase()}</Text>}
      </Frame>

      <View style={styles.memberNameWrap}>
        <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
        <Text style={styles.memberMeta}>Applied {formatAppliedAt(membership.applied_at)}</Text>
      </View>
    </View>
  );
}

// One line of "what happens next". A stroked glyph on the housing rather than a
// coloured disc: none of these are states a place is in.
function NextStep({glyph,text}){
  return(
    <View style={styles.nextStepRow}>
      <View style={styles.nextStepGlyph}>
        <Glyph name={glyph} size={13} colour={INK.readoutSoft}/>
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
      <Panel key={membership.id} raised={isFocused} style={styles.requestCard}>
        {isFocused && (
          <View style={styles.head}>
            <Text style={styles.headKind}>Opened from notification</Text>
            <View style={styles.headLine}/>
          </View>
        )}

        <MemberIdentity membership={membership} profiles={memberProfiles}/>

        {!!membership.application_note && (
          <View style={styles.note}>
            <Text style={styles.noteLabel}>Application message</Text>
            <Text style={styles.noteText}>{membership.application_note}</Text>
          </View>
        )}

        <View style={styles.buttons}>
          <Action
            kind="primary"
            glyph="check"
            label={workingId===membership.id ? "Updating…" : full ? "Club full" : "Approve"}
            accessibilityLabel={`Approve ${membershipName(membership)} for ${club.name}`}
            disabled={workingId===membership.id || full}
            onPress={()=>decideMembership(membership,"approved",club)}
            style={styles.button}
          />

          <Action
            kind="secondary"
            glyph="close"
            label="Reject"
            accessibilityLabel={`Reject ${membershipName(membership)} for ${club.name}`}
            disabled={workingId===membership.id}
            onPress={()=>decideMembership(membership,"rejected",club)}
            style={styles.button}
          />
        </View>
      </Panel>
    );
  }

  function renderCompletion(action){
    if(!action) return null;

    const approved=action.status==="approved";
    const currentApprovedCount=(approvedByClub[action.clubId] || []).length;
    const memberLabel=action.name || "Explorer";

    return(
      <>
        <Notice
          tone="exists"
          label={approved ? "Membership approved" : "Application rejected"}
        >
          <View>
            <Text style={styles.resultText}>
              {approved
                ? `${memberLabel} is now a member of ${action.clubName} and has access to the private message board.`
                : `${memberLabel}'s membership request was not approved. They have been notified.`
              }
            </Text>

            <View style={styles.meterRow}>
              <Meter
                value={currentApprovedCount}
                max={action.memberLimit}
                width={140}
                tone="exists"
                label="Capacity"
                valueLabel={`${currentApprovedCount}/${action.memberLimit}`}
              />
            </View>

            <Action
              kind="primary"
              glyph="forward"
              label={approved ? "View approved member" : "Back to pending requests"}
              accessibilityLabel={approved ? "View the approved member" : "Back to pending requests"}
              onPress={()=>{
                if(approved){
                  router.push(`/manager/dashboard?club=${action.clubId}&member=${action.userId}&view=members`);
                }else{
                  router.replace(`/manager/requests?club=${action.clubId}&view=requests`);
                }
              }}
              style={styles.wide}
            />

            <Action
              kind="quiet"
              glyph="list"
              label={approved ? "View all club members" : "View all requests for this club"}
              accessibilityLabel={approved ? "View all club members" : "View all requests for this club"}
              onPress={()=>{
                if(approved){
                  router.push(`/manager/dashboard?club=${action.clubId}&view=members`);
                }else{
                  router.replace(`/manager/requests?club=${action.clubId}&view=requests`);
                }
              }}
              style={styles.wide}
            />
          </View>
        </Notice>

        <SectionRule label="What happens next"/>

        <Panel style={styles.nextCard}>
          <NextStep glyph="check" text={`${memberLabel} has been notified`}/>
          <NextStep
            glyph="check"
            text={approved
              ? "They can now access the private message board"
              : "They can apply again at any time"
            }
          />
          <NextStep
            glyph="info"
            text={approved
              ? "You can remove members at any time from the Manager Dashboard"
              : "You can continue managing members from the Manager Dashboard"
            }
          />
        </Panel>
      </>
    );
  }

  if(!managerGate.allowed){
    return <GateNotice checking={managerGate.checking} message={managerGate.error}/>;
  }

  if(loading){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.centreText}>Loading pending actions…</Text>
      </Screen>
    );
  }

  if(error){
    return(
      <Screen>
        <ScreenTitle eyebrow="Manager" title="Action Centre"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Not loaded">{error}</Notice>
        </View>
      </Screen>
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
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="Manager"
          title="Action Centre"
          meta="Review approvals and decisions without searching through your listings."
        />

        <View style={styles.body}>
          <ReadoutStrip
            items={[
              {label:"Pending",value:String(pendingMemberships.length)},
              {label:"Clubs",value:String(clubs.length)}
            ]}
          />

          <View style={styles.navRow}>
            <Action
              kind="secondary" glyph="bell" label="Notifications"
              accessibilityLabel="Open notifications"
              onPress={()=>router.push("/notifications")}
              style={styles.button}
            />
            <Action
              kind="secondary" glyph="grid" label="Dashboard"
              accessibilityLabel="Open the Manager Dashboard"
              onPress={()=>router.push("/manager/dashboard")}
              style={styles.button}
            />
          </View>

          {targetMembershipId && focusedRequest && focusedClub && (
            <>
              <SectionRule label="Membership request" meta={focusedClub.name}/>

              <Text style={styles.sectionSub}>
                Review this exact application. Approving immediately unlocks the private message board.
              </Text>

              <View style={styles.meterRow}>
                <Meter
                  value={(approvedByClub[focusedClub.id] || []).length}
                  max={focusedClub.member_limit || 20}
                  width={140}
                  tone="exists"
                  label="Approved"
                  valueLabel={`${(approvedByClub[focusedClub.id] || []).length}/${focusedClub.member_limit || 20}`}
                />
              </View>

              {renderRequest(focusedRequest,focusedClub,true)}

              {pendingMemberships.filter(item=>item.club_id===focusedClub.id && item.id!==focusedRequest.id).length>0 && (
                <Action
                  kind="secondary"
                  glyph="list"
                  label={`View all requests for ${focusedClub.name}`}
                  accessibilityLabel={`View all requests for ${focusedClub.name}`}
                  onPress={()=>router.replace(`/manager/requests?club=${focusedClub.id}&view=requests`)}
                  style={styles.wide}
                />
              )}
            </>
          )}

          {focusedRequestMissing && completionToShow && renderCompletion(completionToShow)}

          {focusedRequestMissing && !completionToShow && (
            <Empty
              glyph="check"
              title="This request is no longer pending"
              instruction="Its current status is no longer an approval decision."
              action={focusedClub ? (
                <Action
                  kind="primary"
                  glyph="list"
                  label="View this club's pending requests"
                  accessibilityLabel="View this club's pending requests"
                  onPress={()=>router.replace(`/manager/requests?club=${focusedClub.id}&view=requests`)}
                />
              ) : null}
            />
          )}

          {!targetMembershipId && clubsWithRequests.map(club=>(
            <View key={club.id}>
              <SectionRule label={club.name} meta={String(club.requests.length)}/>

              <Row
                glyph="people"
                title={`${club.requests.length} pending request${club.requests.length===1 ? "" : "s"}`}
                sub={club.category ? `${club.category} · ${club.location || ""}`.trim() : club.location}
                meta={`${(approvedByClub[club.id] || []).length}/${club.member_limit || 20}`}
                metaSub="approved"
              />

              {club.requests.map(request=>renderRequest(request,club,false))}
            </View>
          ))}

          {!targetMembershipId && clubsWithRequests.length===0 && (
            <Empty
              glyph="check"
              title="All caught up"
              instruction="There are no Activity Club membership requests waiting for a decision."
              action={
                <Action
                  kind="secondary"
                  glyph="grid"
                  label="Return to Manager Dashboard"
                  accessibilityLabel="Return to the Manager Dashboard"
                  onPress={()=>router.push("/manager/dashboard")}
                />
              }
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center",gap:12,padding:28},
  centreText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,textAlign:"center"},

  navRow:{flexDirection:"row",gap:9,marginTop:12},
  button:{flex:1},
  wide:{marginTop:9,alignSelf:"stretch"},

  sectionSub:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,marginBottom:4
  },
  meterRow:{marginTop:10,marginBottom:10},

  requestCard:{padding:14,marginBottom:10},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:10},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},

  memberIdentity:{flexDirection:"row",alignItems:"center",gap:12},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:44,height:44,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:17},
  memberNameWrap:{flex:1,minWidth:0},
  memberName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  memberMeta:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3},

  note:{
    marginTop:12,padding:11,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control
  },
  noteLabel:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},
  noteText:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,marginTop:5
  },

  buttons:{flexDirection:"row",gap:9,marginTop:13},

  resultText:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },

  nextCard:{padding:13},
  nextStepRow:{flexDirection:"row",alignItems:"flex-start",gap:10,paddingVertical:7},
  nextStepGlyph:{
    width:26,height:26,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  nextStepText:{
    flex:1,color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  }
});
