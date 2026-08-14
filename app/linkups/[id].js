import React,{useCallback,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {effectiveLinkupStatus,formatDateTime,statusLabel} from "../../utils/linkups";
import {LINKUP_TYPE_LABEL} from "../../utils/markers";
import {audienceShortLabel} from "../../utils/audience";
import {INK} from "../../utils/tokens";
import {TYPE} from "../../styles/typography";
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
        {label:"WHERE",value:linkup ? `📍 ${linkup.location_name}, ${linkup.area}` : ""}
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
          <Pressable
            style={styles.creatorCard}
            accessibilityRole="button"
            accessibilityLabel={`Organised by ${creator?.full_name || "an Explorer"}`}
            onPress={()=>router.push(`/profile/${linkup.creator_id}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{creator?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
            </View>
            <View style={styles.creatorText}>
              <Text style={styles.creatorLabel}>ORGANISED BY</Text>
              <Text style={styles.creatorName}>{creator?.full_name || "Explorer"}</Text>
              {creator?.show_area && creator?.area ? <Text style={styles.creatorArea}>{creator.area}</Text> : null}
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          {/*
            The second lock. RLS already returns no row to a non-member, so this
            is defence in depth rather than the boundary -- but a boundary with
            one lock is a boundary one mistake from being open.
          */}
          {joined && privateDetails!=="" && (
            <View style={styles.privateCard}>
              <Text style={styles.privateLabel}>ATTENDEE MEETING DETAILS</Text>
              <Text style={styles.privateText}>{privateDetails}</Text>
            </View>
          )}
        </View>
      ) : null}
      actions={linkup ? (
        <>
          {canJoin && (
            <Pressable
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel="Join this Link-up"
              disabled={working}
              onPress={()=>callRpc("join_linkup",{p_linkup_id:id},"You joined the Link-up.")}
            >
              <Text style={styles.primaryText}>Join Link-up</Text>
            </Pressable>
          )}

          {!isOwner && joined && status!=="completed" && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Leave this Link-up"
              disabled={working}
              onPress={()=>callRpc("leave_linkup",{p_linkup_id:id},"You left the Link-up.")}
            >
              <Text style={styles.secondaryText}>Leave Link-up</Text>
            </Pressable>
          )}

          {boardOpen && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Open the private board"
              onPress={()=>router.push(`/linkups/board/${id}`)}
            >
              <Text style={styles.secondaryText}>💬 Open private board</Text>
            </Pressable>
          )}

          {isOwner && !["cancelled","completed"].includes(status) && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Edit this Link-up"
              onPress={()=>router.push(`/linkups/edit/${id}`)}
            >
              <Text style={styles.secondaryText}>Edit Link-up</Text>
            </Pressable>
          )}

          {isOwner && !["cancelled","completed"].includes(status) && (
            <Pressable
              style={styles.quiet}
              accessibilityRole="button"
              accessibilityLabel="Cancel this Link-up"
              onPress={()=>setConfirmCancel(true)}
            >
              <Text style={styles.quietText}>Cancel Link-up</Text>
            </Pressable>
          )}

          {confirmCancel && isOwner && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Cancel this Link-up?</Text>
              <Text style={styles.boxText}>Everyone who joined will be notified. The board becomes read-only.</Text>
              <View style={styles.confirmRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Keep the Link-up" onPress={()=>setConfirmCancel(false)}>
                  <Text style={styles.secondaryText}>Keep it</Text>
                </Pressable>
                <Pressable
                  style={styles.primary}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm cancelling the Link-up"
                  disabled={working}
                  onPress={()=>{setConfirmCancel(false);callRpc("cancel_linkup",{p_linkup_id:id},"The Link-up was cancelled.");}}
                >
                  <Text style={styles.primaryText}>Cancel it</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      ) : null}
      beforeReviews={linkup ? (
        <View style={styles.stack}>
          <View style={styles.listHead}>
            <Text style={TYPE.sectionLabel}>Attendees</Text>
            <Text style={styles.listCount}>{attendees.length}</Text>
          </View>
          {attendees.map((item)=>(
            <View key={item.user_id} style={styles.attendeeRow}>
              <Pressable
                style={styles.attendeeProfile}
                accessibilityRole="button"
                accessibilityLabel={item.profile?.full_name || "Explorer"}
                onPress={()=>router.push(`/profile/${item.user_id}`)}
              >
                <View style={styles.smallAvatar}>
                  <Text style={styles.smallAvatarText}>{item.profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
                </View>
                <View style={styles.attendeeText}>
                  <Text style={styles.attendeeName}>{item.profile?.full_name || "Explorer"}</Text>
                  <Text style={styles.attendeeRole}>{item.role==="creator" ? "Organiser" : "Attendee"}</Text>
                </View>
              </Pressable>

              {isOwner && item.user_id!==user?.id && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.profile?.full_name || "this Explorer"}`}
                  disabled={working}
                  onPress={()=>callRpc("remove_linkup_attendee",{p_linkup_id:id,p_user_id:item.user_id},"Attendee removed.")}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report this Link-up"
                onPress={()=>setShowReport((current)=>!current)}
              >
                <Text style={styles.safetyLink}>Report Link-up</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Block the organiser" onPress={blockCreator}>
                <Text style={styles.safetyLink}>Block organiser</Text>
              </Pressable>
            </View>
          )}

          {showReport && !isOwner && (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Why are you reporting this?</Text>
              <View style={styles.reasonWrap}>
                {REPORTS.map((reason)=>(
                  <Pressable
                    key={reason}
                    style={[styles.reason,reportReason===reason && styles.reasonActive]}
                    accessibilityRole="button"
                    accessibilityState={{selected:reportReason===reason}}
                    accessibilityLabel={reason.replace("_"," ")}
                    onPress={()=>setReportReason(reason)}
                  >
                    <Text style={reportReason===reason ? styles.reasonTextActive : styles.reasonText}>
                      {reason.replace("_"," ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.primary}
                accessibilityRole="button"
                accessibilityLabel="Submit report"
                disabled={working}
                onPress={report}
              >
                <Text style={styles.primaryText}>Submit report</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    />
  );
}

const styles=StyleSheet.create({
  stack:{marginTop:16,gap:11},
  listHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  listCount:{...TYPE.numeral,fontSize:16},
  creatorCard:{
    flexDirection:"row",
    alignItems:"center",
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:8,
    padding:12,
    backgroundColor:INK.card
  },
  avatar:{width:48,height:48,borderRadius:24,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center"},
  avatarText:{color:INK.ink,fontSize:19,fontWeight:"800"},
  creatorText:{flex:1,marginLeft:11},
  creatorLabel:{...TYPE.sectionLabel},
  creatorName:{color:INK.ink,fontWeight:"800",marginTop:3},
  creatorArea:{color:INK.inkSoft,fontSize:11,marginTop:2},
  arrow:{color:INK.ink,fontSize:26},
  privateCard:{borderWidth:2,borderColor:INK.ink,borderRadius:8,padding:14,backgroundColor:INK.card},
  privateLabel:{...TYPE.sectionLabel},
  privateText:{color:INK.ink,lineHeight:20,marginTop:6},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:6,paddingHorizontal:16,marginBottom:10},
  primaryText:{color:INK.card,fontWeight:"800"},
  secondary:{minHeight:52,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:6,backgroundColor:INK.card,marginBottom:10},
  secondaryText:{color:INK.ink,fontWeight:"800"},
  quiet:{minHeight:48,justifyContent:"center",alignItems:"center",marginBottom:10},
  quietText:{color:INK.inkSoft,fontWeight:"800"},
  box:{borderWidth:2,borderColor:INK.ink,borderRadius:8,padding:14,backgroundColor:INK.card},
  boxTitle:{color:INK.ink,fontWeight:"800",fontSize:16},
  boxText:{color:INK.ink,lineHeight:20,marginTop:5},
  confirmRow:{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:16,marginTop:13},
  attendeeRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingVertical:9,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  attendeeProfile:{flexDirection:"row",alignItems:"center",flex:1},
  smallAvatar:{width:38,height:38,borderRadius:19,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center"},
  smallAvatarText:{color:INK.ink,fontWeight:"800"},
  attendeeText:{marginLeft:9},
  attendeeName:{color:INK.ink,fontWeight:"800"},
  attendeeRole:{...TYPE.meta,marginTop:2},
  removeText:{color:INK.ink,fontWeight:"800",fontSize:11,padding:8,textDecorationLine:"underline"},
  safetyRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:14},
  safetyLink:{color:INK.ink,fontWeight:"800",fontSize:13,textDecorationLine:"underline"},
  reasonWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10,marginBottom:12},
  // Squared, bordered chips like PlacesList's category filter -- not the
  // rounded pills this used to be, and not the card-on-card invisible text
  // those pills carried (both states used to read INK.card on an INK.card
  // box, which is unreadable; unselected now reads ink-on-card like every
  // other unselected chip in the app).
  reason:{borderWidth:2,borderColor:INK.ink,borderRadius:4,paddingHorizontal:10,paddingVertical:7,backgroundColor:INK.card},
  reasonActive:{backgroundColor:INK.ink},
  reasonText:{color:INK.ink,fontSize:10,fontWeight:"800",textTransform:"capitalize"},
  reasonTextActive:{color:INK.card,fontSize:10,fontWeight:"800",textTransform:"capitalize"}
});
