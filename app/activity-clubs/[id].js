import React,{useCallback,useState} from "react";
import {View,Text,TextInput,StyleSheet,Pressable,Alert} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {CLUB_TYPE_LABEL} from "../../utils/markers";
import {INK} from "../../utils/tokens";
import PlaceLayout from "../../components/PlaceLayout";
import FavouriteButton from "../../components/FavouriteButton";
import EntityFollowButton from "../../components/EntityFollowButton";

// Packet 5b, and the largest of the five conversions. A club is a place that
// recurs, so on top of the shared page it carries a membership state machine
// (none / pending / approved / rejected / removed / left), the sessions it runs
// and the announcements its manager posts.
//
// All of that goes into the layout's beforeReviews slot, in the order it was
// already in. The membership states are not collapsed into one status card:
// each says a different thing to a different person, and merging them would
// lose the difference between "waiting" and "not this time".

function formatDate(value){
  if(!value) return "Date to be confirmed";
  return new Date(value).toLocaleString([],{
    weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"
  });
}

function formatSubmittedDate(value){
  if(!value) return "";
  return new Date(value).toLocaleString([],{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}

export default function ActivityClubProfile(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id) ? params.id[0] : params.id;
  const {showFeedback}=useFeedback();

  const [club,setClub]=useState(null);
  const [stats,setStats]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [announcements,setAnnouncements]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [membership,setMembership]=useState(null);
  const [applicationNote,setApplicationNote]=useState("");
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{if(id) loadPage();},[id]));

  async function loadPage(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    let profileRow=null;
    if(currentUser){
      const {data}=await supabase.from("profiles").select("full_name,account_type").eq("id",currentUser.id).single();
      profileRow=data || null;
    }
    setProfile(profileRow);

    const {data:clubRow,error:clubError}=await supabase
      .from("activity_clubs").select("*").eq("id",id).single();

    if(clubError){
      setError("This activity club could not be loaded.");
      setLoading(false);
      return;
    }
    setClub(clubRow);

    const [sessionResult,announcementResult,reviewResult,statsResult]=await Promise.all([
      supabase.from("activity_sessions").select("*").eq("club_id",id).gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}),
      supabase.from("activity_announcements").select("*").eq("club_id",id).order("created_at",{ascending:false}),
      supabase.from("activity_club_reviews").select("*").eq("club_id",id).eq("moderation_status","published").order("created_at",{ascending:false}),
      supabase.from("activity_club_stats").select("*").eq("club_id",id).maybeSingle()
    ]);

    setSessions(sessionResult.data || []);
    setAnnouncements(announcementResult.data || []);
    // activity_club_reviews names its author column reviewer_name; PlaceReview
    // renders `name`. Normalised here so one review card serves every place
    // type instead of one card per table.
    setReviews((reviewResult.data || []).map((row)=>({...row,name:row.reviewer_name})));
    setStats(statsResult.data || null);

    if(currentUser){
      const {data:membershipRow}=await supabase
        .from("activity_memberships").select("*").eq("club_id",id).eq("user_id",currentUser.id).maybeSingle();
      setMembership(membershipRow || null);
      setApplicationNote(membershipRow?.status==="pending" ? (membershipRow.application_note || "") : "");
    }else{
      setMembership(null);
      setApplicationNote("");
    }

    setLoading(false);
  }

  async function applyToJoin(){
    if(!user){
      router.push("/auth/login");
      return;
    }
    if(profile?.account_type!=="explorer"){
      Alert.alert("Explorer account required","Only Explorer accounts can apply to join activity clubs.");
      return;
    }
    if((stats?.spaces_remaining ?? club?.member_limit ?? 0)<=0){
      Alert.alert("Club full","This Activity Club has reached its member limit.");
      return;
    }

    setSubmitting(true);
    const now=new Date().toISOString();
    let applyError=null;

    if(membership && ["rejected","left","removed"].includes(membership.status)){
      const result=await supabase.from("activity_memberships").update({
        status:"pending",
        applicant_name:profile?.full_name || "Explorer",
        application_note:applicationNote.trim(),
        applied_at:now,
        decided_at:null,
        manager_note:""
      }).eq("id",membership.id);
      applyError=result.error;
    }else{
      const result=await supabase.from("activity_memberships").insert({
        club_id:id,
        user_id:user.id,
        applicant_name:profile?.full_name || "Explorer",
        application_note:applicationNote.trim(),
        status:"pending"
      });
      applyError=result.error;
    }

    setSubmitting(false);
    if(applyError){
      showFeedback(applyError.message,"error","Application not sent");
      return;
    }

    showFeedback(`Your request to join ${club.name} was sent to the manager.`,"success","Join request sent");
    await loadPage();
  }

  function openReview(){
    if(!user){
      router.push("/auth/login");
      return;
    }
    if(profile?.account_type!=="explorer"){
      Alert.alert("Explorer account required","Only Explorer accounts can leave reviews and earn points.");
      return;
    }
    if(!membership || !["approved","left","removed"].includes(membership.status)){
      Alert.alert("Membership required","Only approved or former members can review this Activity Club.");
      return;
    }
    router.push(`/activity-clubs/review/${club.id}`);
  }

  const isManager=!!user && club?.manager_id===user.id;
  const isApproved=membership?.status==="approved";
  const canOpenBoard=isManager || isApproved;
  const canApply=!membership || ["rejected","left","removed"].includes(membership.status);
  const canReview=!isManager && !!membership && ["approved","left","removed"].includes(membership.status);
  const clubFull=(stats?.spaces_remaining ?? club?.member_limit ?? 0)<=0;
  const approvedMemberCount=stats?.member_count || 0;
  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading activity club..."
      error={error}
      name={club?.name}
      // The word the club's map pin uses. Its own category is a fact about it
      // and sits in the info rows, the way a business shows its classification.
      typeLabel={CLUB_TYPE_LABEL}
      description={club?.description}
      photos={club?.image_url ? [club.image_url] : []}
      photosEmptyLabel="No club photo yet"
      info={[
        {label:"WHAT",value:club?.category},
        {label:"WHERE",value:club ? `📍 ${club.location || "Location"}${club.address ? `\n${club.address}` : ""}` : ""},
        {label:"COST",value:club ? (Number(club.price)>0 ? `£${Number(club.price).toFixed(2)} per session` : "Free to attend") : ""}
      ]}
      stats={club ? [
        {value:approvedMemberCount,label:approvedMemberCount===1 ? "member" : "members"},
        {value:stats?.spaces_remaining ?? club.member_limit,label:"spaces left"},
        {value:average || "—",label:"review score"}
      ] : null}
      rating={club ? {
        average,
        count:reviews.length,
        favourite:(
          // Save is private and for you; Follow is how its updates reach your
          // feed. Two different promises, so two controls rather than one.
          <View style={styles.placeActions}>
            <FavouriteButton
              targetType="activity_club"
              targetId={club.id}
              targetName={club.name}
              targetImageUrl={club.image_url}
            />
            <EntityFollowButton
              targetType="activity_club"
              targetId={club.id}
              targetName={club.name}
              compact
            />
          </View>
        )
      } : null}
      beforeReviews={club ? (
        <View style={styles.stack}>
          {isManager && (
            <Pressable
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel="Open the manager dashboard"
              onPress={()=>router.push("/manager/dashboard")}
            >
              <Text style={styles.primaryText}>Open Manager Dashboard</Text>
            </Pressable>
          )}

          {!isManager && canApply && !clubFull && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>{membership ? "Apply again" : "Request to join"}</Text>
              <Text style={styles.boxText}>
                The manager must approve you before you can see or post on the private message board.
              </Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Optional message to the manager"
                placeholderTextColor={INK.inkSoft}
                value={applicationNote}
                onChangeText={setApplicationNote}
                multiline
                maxLength={300}
              />
              <Pressable
                style={styles.primary}
                accessibilityRole="button"
                accessibilityLabel="Send join request"
                onPress={applyToJoin}
                disabled={submitting}
              >
                <Text style={styles.primaryText}>{submitting ? "Sending application..." : "Send Join Request"}</Text>
              </Pressable>
            </View>
          )}

          {!isManager && canApply && clubFull && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Club currently full</Text>
              <Text style={styles.boxText}>The manager has reached the approved member limit.</Text>
            </View>
          )}

          {!isManager && membership?.status==="pending" && (
            <View style={styles.box}>
              <Text style={styles.badge}>PENDING APPROVAL</Text>
              <Text style={styles.boxTitle}>Application submitted</Text>
              <Text style={styles.boxText}>
                Waiting for the club manager to approve your request. You’ll get access to the
                private message board once approved.
              </Text>
              {!!membership.applied_at && (
                <Text style={styles.boxMeta}>Sent {formatSubmittedDate(membership.applied_at)}</Text>
              )}
              {!!membership.application_note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Your message</Text>
                  <Text style={styles.boxText}>{membership.application_note}</Text>
                </View>
              )}
            </View>
          )}

          {!isManager && membership?.status==="approved" && (
            <View style={styles.box}>
              <Text style={styles.badge}>MEMBERSHIP APPROVED</Text>
              <Text style={styles.boxTitle}>You’re a member</Text>
              <Text style={styles.boxText}>Your private message-board access is now active.</Text>
            </View>
          )}

          {!isManager && membership?.status==="rejected" && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Application not approved</Text>
              <Text style={styles.boxText}>
                You can still view the public club profile and submit another request later.
              </Text>
            </View>
          )}

          {!isManager && membership?.status==="removed" && (
            <View style={styles.box}>
              <Text style={styles.badge}>MEMBERSHIP ENDED</Text>
              <Text style={styles.boxTitle}>Membership ended</Text>
              <Text style={styles.boxText}>
                The club manager has ended your membership. You no longer have access to the
                private message board, but you can apply again.
              </Text>
            </View>
          )}

          {canOpenBoard && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Open the members message board"
              onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
            >
              <Text style={styles.secondaryText}>Open Members’ Message Board</Text>
            </Pressable>
          )}

          {canReview && (
            <Pressable
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel="Leave an activity club review"
              onPress={openReview}
            >
              <Text style={styles.primaryText}>⭐ Leave an Activity Club Review</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Upcoming sessions</Text>
          {sessions.length===0 && (
            <Text style={styles.empty}>No sessions are scheduled yet. The manager adds them from the dashboard.</Text>
          )}
          {sessions.map((session)=>(
            <View key={session.id} style={styles.box}>
              <Text style={styles.boxTitle}>{session.title}</Text>
              <Text style={styles.boxText}>{formatDate(session.starts_at)}</Text>
              <Text style={styles.boxMeta}>Session capacity: {session.capacity}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Club announcements</Text>
          {announcements.length===0 && (
            <Text style={styles.empty}>Nothing announced yet. Anything the manager posts publicly appears here.</Text>
          )}
          {announcements.map((item)=>(
            <View key={item.id} style={styles.box}>
              <Text style={styles.boxTitle}>{item.title}</Text>
              <Text style={styles.boxText}>{item.message}</Text>
            </View>
          ))}
        </View>
      ) : null}
      reviews={reviews}
      reviewsEmpty={{
        title:"No reviews yet",
        instruction:"Members and former members can review this club after a session."
      }}
    />
  );
}

const styles=StyleSheet.create({
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  stack:{marginTop:24,gap:11},
  sectionTitle:{color:INK.ink,fontSize:21,fontWeight:"800",marginTop:13,letterSpacing:-0.3},
  empty:{color:INK.inkSoft,lineHeight:20},
  box:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    backgroundColor:INK.card,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  badge:{
    alignSelf:"flex-start",
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    overflow:"hidden",
    paddingHorizontal:9,
    paddingVertical:3,
    fontSize:10,
    fontWeight:"800",
    color:INK.ink,
    marginBottom:9
  },
  boxTitle:{color:INK.ink,fontSize:17,fontWeight:"800"},
  boxText:{color:INK.ink,lineHeight:21,marginTop:5},
  boxMeta:{color:INK.inkSoft,fontSize:12,marginTop:7},
  noteBox:{borderTopWidth:1,borderTopColor:INK.hair,marginTop:11,paddingTop:9},
  noteLabel:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1},
  noteInput:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:10,
    padding:12,
    marginTop:12,
    minHeight:80,
    textAlignVertical:"top",
    color:INK.ink,
    backgroundColor:INK.paper
  },
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12,marginTop:12},
  primaryText:{color:INK.card,fontWeight:"800"},
  secondary:{minHeight:52,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:12,backgroundColor:INK.card},
  secondaryText:{color:INK.ink,fontWeight:"800"}
});
