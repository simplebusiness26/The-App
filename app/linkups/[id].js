import React,{useCallback,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {effectiveLinkupStatus,formatDateTime,statusLabel} from "../../utils/linkups";
import {LINKUP_TYPE_LABEL} from "../../utils/markers";
import {audienceShortLabel} from "../../utils/audience";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Chip,
  Frame,
  Glyph,
  Meter,
  MONO,
  Notice,
  Panel,
  Row,
  SectionRule
} from "../../components/instrument";
import PlaceLayout from "../../components/PlaceLayout";

// Packet 5c. The last of the five, and the only one that is a privacy gate.
//
// The full review is in docs/REDESIGN-STATE.md. Its conclusion, in one line:
// the meeting point is decided by the database, not by this file. The policy
// linkup_private_select_members restricts linkup_private_details to the
// creator and active members, and it was verified against the live project --
// a real non-member reads zero rows. The `joined` check below is therefore a
// second lock, not the only one.
//
// Which is why it stays. A refactor that dropped it would still be safe,
// because RLS would return nothing to render, but it would remove the layer
// that catches a future mistake in the first one.
//
// Two things this page deliberately does NOT get from the shared layout:
// photos and reviews. Link-ups have neither, and there is no linkup_reviews
// table anywhere in the migrations. "No reviews yet" here would invite
// something the app cannot record.
//
// WHAT CHANGED IN THE REBUILD
//
// The slots were hand-rolled: a bordered organiser card with a bare angle
// quotation mark for a chevron, a bordered box for the meeting point, four filled or
// bordered blocks for join / leave / board / edit, an attendee list of
// hairline-separated rows with circular initials, and pill-shaped report
// reasons that filled with ink when picked.
//
// All of it is kit now. The meeting point in particular is a Notice rather than
// a box: it is the app telling a member something only members may read, which
// is exactly what a state edge and a mono eyebrow are for. The gate itself is
// untouched -- `joined && privateDetails` is still the second lock, and RLS is
// still the first.

const REPORTS=["spam","harassment","unsafe","inappropriate","false_information","other"];

export default function LinkupDetail(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id)?params.id[0]:params.id;
  const {showFeedback}=useFeedback();

  const [user,setUser]=useState(null);
  const [linkup,setLinkup]=useState(null);
  const [creator,setCreator]=useState(null);
  const [attendees,setAttendees]=useState([]);
  const [privateDetails,setPrivateDetails]=useState("");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [showReport,setShowReport]=useState(false);
  const [reportReason,setReportReason]=useState("unsafe");
  const [confirmCancel,setConfirmCancel]=useState(false);

  const load=useCallback(async()=>{
    if(!id){setError("Link-up not found.");setLoading(false);return;}
    setLoading(true);setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);
    await supabase.rpc("refresh_live_system");

    const {data:row,error:linkupError}=await supabase.from("linkups").select("*").eq("id",id).maybeSingle();
    if(linkupError || !row){
      setError("This Link-up is unavailable or no longer visible to you.");
      setLinkup(null);
      setLoading(false);
      return;
    }
    setLinkup(row);

    const [{data:creatorRow},{data:attendeeRows},{data:privateRow}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").eq("id",row.creator_id).maybeSingle(),
      supabase.from("linkup_attendees").select("user_id,role,status,joined_at").eq("linkup_id",id).eq("status","joined").order("joined_at"),
      supabase.from("linkup_private_details").select("meeting_point_details").eq("linkup_id",id).maybeSingle()
    ]);

    setCreator(creatorRow || null);

    const attendeeIds=(attendeeRows || []).map(item=>item.user_id);
    let profiles={};
    if(attendeeIds.length){
      const {data}=await supabase.from("profiles").select("id,full_name,profile_photo").in("id",attendeeIds);
      profiles=Object.fromEntries((data || []).map(item=>[item.id,item]));
    }
    setAttendees((attendeeRows || []).map(item=>({...item,profile:profiles[item.user_id] || null})));
    setPrivateDetails(privateRow?.meeting_point_details || "");
    setLoading(false);
  },[id]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function callRpc(name,args,success){
    if(working) return;
    setWorking(true);
    const {error:rpcError}=await supabase.rpc(name,args);
    setWorking(false);
    if(rpcError){showFeedback(rpcError.message,"error","Action not completed");return;}
    if(success) showFeedback(success,"success","Link-up updated");
    await load();
  }

  async function report(){
    if(!linkup || working) return;
    setWorking(true);
    const {error:reportError}=await supabase.rpc("report_live_safety",{p_target_type:"linkup",p_target_id:linkup.id,p_reason:reportReason,p_details:""});
    setWorking(false);setShowReport(false);
    if(reportError) showFeedback(reportError.message,"error","Report not sent");
    else showFeedback("The Link-up has been sent for review.","success","Report submitted");
  }

  async function blockCreator(){
    if(!creator || working) return;
    setWorking(true);
    const {error:blockError}=await supabase.rpc("block_explorer",{p_user_id:creator.id});
    setWorking(false);
    if(blockError){showFeedback(blockError.message,"error","Explorer not blocked");return;}
    showFeedback("You will no longer see each other's social or live activity.","success","Explorer blocked");
    router.replace("/linkups");
  }

  const status=linkup ? effectiveLinkupStatus(linkup) : null;
  const isOwner=!!linkup && user?.id===linkup.creator_id;
  const joined=attendees.some(item=>item.user_id===user?.id);
  const canJoin=!!linkup && !isOwner && !joined && status==="upcoming";
  const boardOpen=joined;

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading Link-up..."
      error={error}
      showPhotos={false}
      showReviews={false}
      name={linkup?.title}
      typeLabel={LINKUP_TYPE_LABEL}
      verifiedLabel={status ? statusLabel(status) : ""}
      description={linkup?.description}
      info={[
        {label:"WHAT",value:linkup?.category},
        {label:"WHEN",value:linkup ? `${formatDateTime(linkup.starts_at)} – ${formatDateTime(linkup.ends_at)}` : ""},
        // Nothing welded to the front of the value -- the label already says
        // which question the row answers.
        {label:"WHERE",value:linkup ? `${linkup.location_name}, ${linkup.area}` : ""}
      ]}
      stats={linkup ? [
        {value:`${linkup.attendee_count}/${linkup.max_attendees}`,label:"joined"},
        // Read the value, do not guess it from one comparison. This line used
        // to say `visibility==="followers" ? "Friends" : "Public"`, and Link-ups
        // have stored `friends` or `everyone` since the audience rename -- so
        // every Friends-only Link-up fell through and announced itself as
        // Public to the people in it.
        {value:audienceShortLabel(linkup.visibility),label:"who can see it"}
      ] : null}
      beforeActions={linkup ? (
        <View style={styles.stack}>
          <Panel>
            <Row
              glyph="person"
              title={creator?.full_name || "Explorer"}
              sub={creator?.show_area && creator?.area ? creator.area : undefined}
              meta="ORGANISER"
              onPress={()=>router.push(`/profile/${linkup.creator_id}`)}
              style={styles.creatorRow}
            />
          </Panel>

          {/*
            The second lock. RLS already returns no row to a non-member, so this
            is defence in depth rather than the boundary -- but a boundary with
            one lock is a boundary one mistake from being open.

            It reads as a Notice because that is what it is: the app saying
            something to the people allowed to hear it. A padlock glyph and a
            mono eyebrow, not a coloured box.

            The edge is `scheduled`, not `offer`: the three state inks say what
            a thing IS, and violet means "a time-bound offer is running", which
            a meeting point is not. Amber is what this whole page is.
          */}
          {joined && privateDetails!=="" && (
            <Notice tone="scheduled" label="ATTENDEE MEETING DETAILS">
              <View style={styles.privateRow}>
                <Glyph name="lock" size={14} colour={INK.scheduled}/>
                <Text style={styles.privateText}>{privateDetails}</Text>
              </View>
            </Notice>
          )}
        </View>
      ) : null}
      actions={linkup ? (
        <>
          {canJoin && (
            <Action
              kind="primary"
              label="Join Link-up"
              glyph="plus"
              style={styles.action}
              accessibilityLabel="Join this Link-up"
              disabled={working}
              onPress={()=>callRpc("join_linkup",{p_linkup_id:id},"You joined the Link-up.")}
            />
          )}

          {!isOwner && joined && status!=="completed" && (
            <Action
              kind="secondary"
              label="Leave Link-up"
              glyph="close"
              style={styles.action}
              accessibilityLabel="Leave this Link-up"
              disabled={working}
              onPress={()=>callRpc("leave_linkup",{p_linkup_id:id},"You left the Link-up.")}
            />
          )}

          {boardOpen && (
            <Action
              kind="secondary"
              label="Open private board"
              glyph="comment"
              style={styles.action}
              accessibilityLabel="Open the private board"
              onPress={()=>router.push(`/linkups/board/${id}`)}
            />
          )}

          {isOwner && !["cancelled","completed"].includes(status) && (
            <Action
              kind="secondary"
              label="Edit Link-up"
              glyph="edit"
              style={styles.action}
              accessibilityLabel="Edit this Link-up"
              onPress={()=>router.push(`/linkups/edit/${id}`)}
            />
          )}

          {isOwner && !["cancelled","completed"].includes(status) && (
            <Action
              kind="quiet"
              label="Cancel Link-up"
              glyph="block"
              style={styles.action}
              accessibilityLabel="Cancel this Link-up"
              onPress={()=>setConfirmCancel(true)}
            />
          )}

          {confirmCancel && isOwner && (
            <Notice tone="dispute" label="CONFIRM">
              <Text style={styles.boxTitle}>Cancel this Link-up?</Text>
              <Text style={styles.boxText}>Everyone who joined will be notified. The board becomes read-only.</Text>
              <View style={styles.confirmRow}>
                <Action
                  kind="quiet"
                  label="Keep it"
                  style={styles.confirmCell}
                  accessibilityLabel="Keep the Link-up"
                  onPress={()=>setConfirmCancel(false)}
                />
                <Action
                  kind="danger"
                  label="Cancel it"
                  style={styles.confirmCell}
                  accessibilityLabel="Confirm cancelling the Link-up"
                  disabled={working}
                  onPress={()=>{setConfirmCancel(false);callRpc("cancel_linkup",{p_linkup_id:id},"The Link-up was cancelled.");}}
                />
              </View>
            </Notice>
          )}
        </>
      ) : null}
      beforeReviews={linkup ? (
        <View style={styles.stack}>
          {/* Who is coming, read off a track. A Link-up with one place left is
              a different proposition from one with six, and "2/8" makes you do
              the division yourself. */}
          <SectionRule label="Attendees" meta={`${linkup.attendee_count}/${linkup.max_attendees}`}/>
          <View style={styles.capacity} accessibilityLabel={`${linkup.attendee_count} of ${linkup.max_attendees} places taken`}>
            <Meter
              value={Number(linkup.attendee_count || 0)}
              max={Number(linkup.max_attendees || 0)}
              width={120}
              tone="scheduled"
              label="JOINED"
            />
            <Text style={styles.capacityValue}>{linkup.attendee_count}/{linkup.max_attendees}</Text>
          </View>

          {attendees.map((item)=>(
            <View key={item.user_id} style={styles.attendeeRow}>
              <Pressable
                style={styles.attendeeProfile}
                accessibilityRole="button"
                accessibilityLabel={item.profile?.full_name || "Explorer"}
                onPress={()=>router.push(`/profile/${item.user_id}`)}
              >
                <Frame size={36} round style={styles.smallAvatar}>
                  <Text style={styles.smallAvatarText}>{item.profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
                </Frame>
                <View style={styles.attendeeText}>
                  <Text style={styles.attendeeName} numberOfLines={1}>{item.profile?.full_name || "Explorer"}</Text>
                  <Text style={styles.attendeeRole}>{item.role==="creator" ? "ORGANISER" : "ATTENDEE"}</Text>
                </View>
              </Pressable>

              {isOwner && item.user_id!==user?.id && (
                <Action
                  kind="quiet"
                  label="Remove"
                  glyph="close"
                  accessibilityLabel={`Remove ${item.profile?.full_name || "this Explorer"}`}
                  disabled={working}
                  onPress={()=>callRpc("remove_linkup_attendee",{p_linkup_id:id,p_user_id:item.user_id},"Attendee removed.")}
                />
              )}
            </View>
          ))}

          {/*
            Report and block are what a person needs when a link-up turns out to
            be a bad idea. They sit at the end of the page and are never behind
            a menu, because somebody looking for them is not browsing.
          */}
          {!isOwner && (
            <View style={styles.safetyRow}>
              <Action
                kind="quiet"
                label="Report Link-up"
                glyph="flag"
                style={styles.safetyCell}
                accessibilityLabel="Report this Link-up"
                onPress={()=>setShowReport((current)=>!current)}
              />
              <Action
                kind="quiet"
                label="Block organiser"
                glyph="block"
                style={styles.safetyCell}
                accessibilityLabel="Block the organiser"
                onPress={blockCreator}
              />
            </View>
          )}

          {showReport && !isOwner && (
            <Panel style={styles.box}>
              <Text style={styles.boxTitle}>Why are you reporting this?</Text>
              {/* Selection steps a surface and strengthens an edge. It never
                  fills with a state ink -- a report reason is not a state a
                  place is in, and a fill would make every label inside it
                  unreadable. */}
              <View style={styles.reasonWrap}>
                {REPORTS.map((reason)=>(
                  <Chip
                    key={reason}
                    label={reason.replace("_"," ")}
                    selected={reportReason===reason}
                    onPress={()=>setReportReason(reason)}
                  />
                ))}
              </View>
              <Action
                kind="primary"
                label="Submit report"
                glyph="send"
                accessibilityLabel="Submit report"
                disabled={working}
                onPress={report}
              />
            </Panel>
          )}
        </View>
      ) : null}
    />
  );
}

const styles=StyleSheet.create({
  stack:{marginTop:16,gap:10},
  action:{marginBottom:10},

  // Row already draws a standalone card when it carries no tone; inside a Panel
  // it is one line of that panel, so its own card chrome comes off.
  creatorRow:{marginBottom:0,backgroundColor:"transparent",borderWidth:0},

  privateRow:{flexDirection:"row",alignItems:"flex-start",gap:8},
  privateText:{
    flex:1,color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },

  box:{padding:14},
  boxTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  boxText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginTop:6},
  confirmRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:13},
  confirmCell:{flex:1},

  capacity:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:6},
  capacityValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,letterSpacing:0.5},

  attendeeRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:10,
    paddingVertical:7,
    borderBottomWidth:SHAPE.border,
    borderBottomColor:INK.hairline
  },
  attendeeProfile:{flexDirection:"row",alignItems:"center",flex:1,minWidth:0},
  smallAvatar:{backgroundColor:INK.inset},
  smallAvatarText:{color:INK.readoutSoft,fontWeight:"700",fontSize:15},
  attendeeText:{marginLeft:10,flex:1,minWidth:0},
  attendeeName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  // A role is a fact the app holds about somebody, so it is mono.
  attendeeRole:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,marginTop:3
  },

  safetyRow:{flexDirection:"row",gap:10,paddingVertical:8},
  safetyCell:{flex:1},

  reasonWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:11,marginBottom:13}
});
