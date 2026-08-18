import React,{useCallback,useState} from "react";
import {View,Text,TextInput,StyleSheet,Alert} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {shortClock,needsFullDate} from "../../utils/clock";
import {useFeedback} from "../../context/FeedbackContext";
import {CLUB_TYPE_LABEL} from "../../utils/markers";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Field,
  MONO,
  Notice,
  Panel,
  Row,
  SectionRule,
  fieldInputStyle
} from "../../components/instrument";
import PlaceLayout from "../../components/PlaceLayout";
import MessageButton from "../../components/MessageButton";
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
//
// WHAT CHANGED IN THE REBUILD
//
// Every one of those states was the same 2px-bordered box with a hard offset
// shadow and a pill-shaped badge on top, the join form was a bordered textarea
// with a filled-ink button under it, and the sessions -- the whole reason a club
// is in the Happening tab -- were boxes with the date printed as body text.
//
// A membership state is the app telling you where you stand, which is what
// Notice is: an edge in a state ink and a mono eyebrow, never a coloured box.
// A SESSION is a dated thing, so it is a Row carrying the amber `scheduled`
// edge with its time in the mono meta column, exactly like an event or a
// Link-up. That is the point of this tab having one row shape.

function formatDate(value){
  if(!value) return "Date to be confirmed";
  return new Date(value).toLocaleString([],{
    weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"
  });
}

// What the app measured about WHEN a session is, short enough for a Row's mono
// meta column: "IN 2H", "TONIGHT 19:30", "SAT 12 SEP 19:30". The long form
// stays under it -- the countdown tells you whether to care, the date tells you
// what to write down.
//
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
      const {data}=await supabase.from("profiles").select("full_name").eq("id",currentUser.id).single();
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
      loadPlaceReviews("activity_club",id),
      supabase.from("activity_club_stats").select("*").eq("club_id",id).maybeSingle()
    ]);

    setSessions(sessionResult.data || []);
    setAnnouncements(announcementResult.data || []);
    setReviews(reviewResult.reviews);
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
        // Nothing welded to the front of the value -- the label already says
        // which question the row answers.
        {label:"WHERE",value:club ? `${club.location || "Location"}${club.address ? `\n${club.address}` : ""}` : ""},
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
          {/*
            Anybody may ask whoever runs this club a question about it. It
            renders only when the club actually has a manager.
          */}
          <MessageButton targetType="activity_club" targetId={club.id}/>
          {isManager && (
            <Action
              kind="primary"
              label="Open Manager Dashboard"
              glyph="chart"
              accessibilityLabel="Open the manager dashboard"
              onPress={()=>router.push("/manager/dashboard")}
            />
          )}

          {!isManager && canApply && !clubFull && (
            <Panel style={styles.box}>
              <Text style={styles.boxTitle}>{membership ? "Apply again" : "Request to join"}</Text>
              <Text style={styles.boxText}>
                The manager must approve you before you can see or post on the private message board.
              </Text>
              <Field label="Message to the manager" hint="Optional. It is only read by whoever manages this club." style={styles.noteField}>
                <TextInput
                  style={[fieldInputStyle,styles.noteInput]}
                  placeholder="Optional message to the manager"
                  placeholderTextColor={INK.readoutFaint}
                  accessibilityLabel="Optional message to the manager"
                  value={applicationNote}
                  onChangeText={setApplicationNote}
                  multiline
                  maxLength={300}
                />
              </Field>
              <Action
                kind="primary"
                label={submitting ? "Sending application..." : "Send Join Request"}
                glyph="send"
                accessibilityLabel="Send join request"
                onPress={applyToJoin}
                disabled={submitting}
              />
            </Panel>
          )}

          {!isManager && canApply && clubFull && (
            <Notice tone="scheduled" label="CLUB CURRENTLY FULL">
              The manager has reached the approved member limit.
            </Notice>
          )}

          {/*
            Five membership states, five different things to say, and they stay
            five. Collapsing them into one status card would lose the difference
            between "waiting" and "not this time", which is the difference a
            person actually cares about. Each is a Notice: an edge in a state
            ink and a mono eyebrow, so the state is legible without a coloured
            box the labels then have to fight.
          */}
          {!isManager && membership?.status==="pending" && (
            <Notice tone="scheduled" label="PENDING APPROVAL">
              <Text style={styles.boxTitle}>Application submitted</Text>
              <Text style={styles.boxText}>
                Waiting for the club manager to approve your request. You’ll get access to the
                private message board once approved.
              </Text>
              {!!membership.applied_at && (
                <Text style={styles.boxMeta}>SENT {formatSubmittedDate(membership.applied_at).toUpperCase()}</Text>
              )}
              {!!membership.application_note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>YOUR MESSAGE</Text>
                  <Text style={styles.boxText}>{membership.application_note}</Text>
                </View>
              )}
            </Notice>
          )}

          {!isManager && membership?.status==="approved" && (
            <Notice tone="exists" label="MEMBERSHIP APPROVED">
              <Text style={styles.boxTitle}>You’re a member</Text>
              <Text style={styles.boxText}>Your private message-board access is now active.</Text>
            </Notice>
          )}

          {!isManager && membership?.status==="rejected" && (
            <Notice tone="dispute" label="APPLICATION NOT APPROVED">
              You can still view the public club profile and submit another request later.
            </Notice>
          )}

          {!isManager && membership?.status==="removed" && (
            <Notice tone="dispute" label="MEMBERSHIP ENDED">
              <Text style={styles.boxTitle}>Membership ended</Text>
              <Text style={styles.boxText}>
                The club manager has ended your membership. You no longer have access to the
                private message board, but you can apply again.
              </Text>
            </Notice>
          )}

          {canOpenBoard && (
            <Action
              kind="secondary"
              label="Open Members’ Message Board"
              glyph="comment"
              accessibilityLabel="Open the members message board"
              onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
            />
          )}

          {canReview && (
            <Action
              kind="primary"
              label="Leave an Activity Club Review"
              glyph="star"
              accessibilityLabel="Leave an activity club review"
              onPress={openReview}
            />
          )}

          {/*
            A session is a dated thing, so it is the same Row the events list
            and the Link-ups list use, carrying the same amber `scheduled` edge
            it carries on the map. This is what a club is FOR, and it used to be
            three lines of body text in a box.
          */}
          <SectionRule label="Upcoming sessions" meta={String(sessions.length)}/>
          {sessions.length===0 && (
            <Empty
              title="No sessions scheduled"
              instruction="No sessions are scheduled yet. The manager adds them from the dashboard."
              glyph="calendar"
            />
          )}
          {sessions.map((session)=>(
            <Row
              key={session.id}
              tone="scheduled"
              glyph="clock"
              title={session.title}
              meta={shortClock(session.starts_at)}
              metaSub={session.capacity ? `${session.capacity} PLACES` : null}
            >
              {needsFullDate(session.starts_at) && (
                <Text style={styles.rowWhen}>{formatDate(session.starts_at)}</Text>
              )}
            </Row>
          ))}

          <SectionRule label="Club announcements" meta={String(announcements.length)}/>
          {announcements.length===0 && (
            <Empty
              title="Nothing announced"
              instruction="Nothing announced yet. Anything the manager posts publicly appears here."
              glyph="bell"
            />
          )}
          {announcements.map((item)=>(
            <Row key={item.id} glyph="bell" title={item.title} sub={item.message}/>
          ))}
        </View>
      ) : null}
      reviews={reviews}
      viewerId={user?.id}
      reviewsEmpty={{
        title:"No reviews yet",
        instruction:"Members and former members can review this club after a session."
      }}
    />
  );
}

const styles=StyleSheet.create({
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  stack:{marginTop:16,gap:10},
  box:{padding:14},
  boxTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  boxText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginTop:6},
  // Sent-at is a timestamp the app holds, so it is mono like every other
  // measurement on this page.
  boxMeta:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,marginTop:8
  },
  noteField:{marginTop:12,marginBottom:12},
  noteInput:{minHeight:80,textAlignVertical:"top",paddingTop:11},
  noteBox:{borderTopWidth:1,borderTopColor:INK.hairline,marginTop:11,paddingTop:9},
  noteLabel:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:1
  },
  rowWhen:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8,marginTop:6
  }
});
