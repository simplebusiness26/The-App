import React,{useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import {useFeedback} from "../../../context/FeedbackContext";
import {effectiveLinkupStatus,formatDateTime} from "../../../utils/linkups";
import {INK,TYPE,SHAPE} from "../../../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Frame,
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  fieldInputStyle
} from "../../../components/instrument";

// The Link-up's private attendee board.
//
// WHY THE BUBBLES CHANGED SHAPE
//
// Same reason as the club board: "what I wrote" was a solid block of ink, which
// under the instrument palette is the near-white readout colour, so your own
// half of the conversation was a column of white slabs with every label inside
// restyled to survive it. Now yours steps UP a surface (`panelRaised` behind a
// `hairlineStrong` edge) and everyone else's stays on `panel`. Nothing is
// filled, so nothing inside needs a second set of colours.
//
// AN ANNOUNCEMENT IS A STATE, AND NOW LOOKS LIKE ONE. It used to be a tiny
// uppercase word in the corner because the three state inks all mean things
// about a PLACE. But an organiser announcement on a board that only attendees
// can read is genuinely "the app is telling you something" -- which is what a
// Notice is for, and it borrows no map colour to say it.

const REPORT_REASONS=["spam","harassment","unsafe","inappropriate","other"];

export default function LinkupBoard(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id)?params.id[0]:params.id;
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [linkup,setLinkup]=useState(null);
  const [messages,setMessages]=useState([]);
  const [profiles,setProfiles]=useState({});
  const [body,setBody]=useState("");
  const [announcement,setAnnouncement]=useState(false);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [reportingId,setReportingId]=useState(null);
  const [reportReason,setReportReason]=useState("inappropriate");

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);
    const [{data:linkupRow,error:linkupError},{data:messageRows,error:messageError}]=await Promise.all([
      supabase.from("linkups").select("*").eq("id",id).maybeSingle(),
      supabase.from("linkup_messages").select("*").eq("linkup_id",id).order("created_at",{ascending:true}).limit(300)
    ]);
    if(linkupError || !linkupRow || messageError){
      setError("Join this Link-up to use its private board.");
      setLinkup(null);setMessages([]);setLoading(false);setRefreshing(false);return;
    }
    setLinkup(linkupRow);
    setMessages(messageRows || []);
    const ids=[...new Set((messageRows || []).map(item=>item.user_id).concat(linkupRow.creator_id))];
    if(ids.length){
      const {data}=await supabase.from("profiles").select("id,full_name,profile_photo").in("id",ids);
      setProfiles(Object.fromEntries((data || []).map(item=>[item.id,item])));
    }
    setLoading(false);setRefreshing(false);
  },[id]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  useEffect(()=>{
    if(!id || !user) return;
    const channel=supabase.channel(`linkup-board-${id}`).on("postgres_changes",{event:"*",schema:"public",table:"linkup_messages",filter:`linkup_id=eq.${id}`},()=>load(false)).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[id,user,load]);

  const status=useMemo(()=>effectiveLinkupStatus(linkup),[linkup]);
  const readOnly=["cancelled","completed"].includes(status);
  const isOwner=user?.id===linkup?.creator_id;

  async function post(){
    const clean=body.trim();
    if(!clean || working || readOnly) return;
    setWorking(true);
    const {error:postError}=await supabase.rpc("post_linkup_message",{p_linkup_id:id,p_body:clean,p_is_announcement:isOwner&&announcement});
    setWorking(false);
    if(postError){showFeedback(postError.message,"error","Message not sent");return;}
    setBody("");setAnnouncement(false);await load(false);
  }

  async function remove(message){
    if(working) return;
    setWorking(true);
    const {error:removeError}=await supabase.rpc("delete_linkup_message",{p_message_id:message.id});
    setWorking(false);
    if(removeError) showFeedback(removeError.message,"error","Message not removed");
    else{showFeedback("The message was removed from the board.","success","Message removed");await load(false);}
  }

  async function report(message){
    if(working) return;
    setWorking(true);
    const {error:reportError}=await supabase.rpc("report_live_safety",{p_target_type:"linkup_message",p_target_id:message.id,p_reason:reportReason,p_details:""});
    setWorking(false);setReportingId(null);
    if(reportError) showFeedback(reportError.message,"error","Report not sent");
    else showFeedback("The message has been sent for review.","success","Report submitted");
  }

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></Screen>;
  if(error || !linkup) return(
    <Screen style={styles.center}>
      <Text style={styles.errorTitle}>Board unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Action
        kind="secondary"
        label="Back to Link-up"
        glyph="back"
        style={styles.backButton}
        accessibilityLabel="Back to the Link-up"
        onPress={()=>router.replace(`/linkups/${id}`)}
      />
    </Screen>
  );

  return(
    <Screen>
      <ScrollView style={styles.messages} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${linkup.title}`}
          onPress={()=>router.push(`/linkups/${id}`)}
        >
          <ScreenTitle
            eyebrow="PRIVATE ATTENDEE BOARD"
            title={linkup.title}
            meta={`${formatDateTime(linkup.starts_at)} · ${linkup.location_name}`}
          />
        </Pressable>

        <View style={styles.body}>
          {readOnly&&<Notice tone="scheduled" label="READ ONLY">This board is now read-only.</Notice>}

          {messages.length===0&&(
            <Empty
              title="Start the conversation"
              instruction="Use the board to coordinate without sharing private contact details."
              glyph="comment"
            />
          )}

          {messages.map(message=>{
            const author=profiles[message.user_id];
            const mine=message.user_id===user?.id;
            const canRemove=mine||isOwner;
            const removed=message.status==="deleted";

            const inner=(
              <>
                <View style={styles.messageTop}>
                  <Frame size={34} round style={styles.avatarFrame}>
                    <Text style={styles.avatarText}>{author?.full_name?.charAt(0)?.toUpperCase()||"E"}</Text>
                  </Frame>
                  <View style={styles.authorText}>
                    <Text style={styles.author} numberOfLines={1}>{author?.full_name||"Explorer"}</Text>
                    <Text style={styles.time} numberOfLines={1}>{formatDateTime(message.created_at)}</Text>
                  </View>
                </View>

                <Text style={[styles.body_,removed&&styles.deletedBody]}>
                  {removed?"Message removed":message.body}
                </Text>

                {!removed&&(
                  <View style={styles.messageActions}>
                    {canRemove&&(
                      <Action
                        kind="quiet"
                        label="Remove"
                        glyph="trash"
                        accessibilityLabel="Remove this message"
                        onPress={()=>remove(message)}
                      />
                    )}
                    {!mine&&(
                      <Action
                        kind="quiet"
                        label="Report"
                        glyph="flag"
                        accessibilityLabel="Report this message"
                        onPress={()=>setReportingId(reportingId===message.id?null:message.id)}
                      />
                    )}
                  </View>
                )}

                {reportingId===message.id&&!mine&&(
                  <View style={styles.reportPanel}>
                    {/* Selection steps a surface and strengthens an edge; it
                        never fills with a state ink. */}
                    <View style={styles.reasonWrap}>
                      {REPORT_REASONS.map(reason=>(
                        <Chip
                          key={reason}
                          label={reason}
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
                      onPress={()=>report(message)}
                    />
                  </View>
                )}
              </>
            );

            // An organiser announcement is the app speaking to the whole board,
            // so it gets the edge and eyebrow every other announcement in this
            // app gets. Ordinary messages are panels.
            return message.is_announcement ? (
              <Notice key={message.id} tone="scheduled" label="ANNOUNCEMENT">
                {inner}
              </Notice>
            ) : (
              <Panel
                key={message.id}
                raised={mine}
                style={[styles.messageCard,mine?styles.myMessage:styles.theirMessage]}
              >
                {inner}
              </Panel>
            );
          })}
        </View>
      </ScrollView>

      {!readOnly&&(
        <View style={styles.composer}>
          {isOwner&&(
            <Chip
              label={announcement?"Organiser announcement":"Post as announcement"}
              glyph={announcement?"check":"bell"}
              selected={announcement}
              style={styles.announcementToggle}
              onPress={()=>setAnnouncement(current=>!current)}
            />
          )}
          <View style={styles.composerRow}>
            <View style={styles.composerWell}>
              <TextInput
                value={body}
                onChangeText={setBody}
                maxLength={1000}
                multiline
                placeholder="Message attendees"
                placeholderTextColor={INK.readoutFaint}
                accessibilityLabel="Message attendees"
                style={[fieldInputStyle,styles.input]}
              />
            </View>
            <Action
              kind="primary"
              label="Send"
              glyph="send"
              style={styles.sendButton}
              accessibilityLabel="Send this message"
              loading={working}
              disabled={!body.trim()||working}
              onPress={post}
            />
          </View>
          <Text style={styles.counter}>{body.length}/1000</Text>
        </View>
      )}
    </Screen>
  );
}

const styles=StyleSheet.create({
  center:{alignItems:"center",justifyContent:"center",padding:28},
  messages:{flex:1},
  content:{paddingBottom:24},
  body:{paddingHorizontal:16},

  errorTitle:{color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",letterSpacing:-0.3},
  errorText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,textAlign:"center",lineHeight:TYPE.body.sizes.md*1.5,marginTop:8},
  backButton:{marginTop:18,alignSelf:"stretch"},

  messageCard:{padding:13,marginBottom:10,maxWidth:"88%"},
  myMessage:{alignSelf:"flex-end",borderColor:INK.hairlineStrong},
  theirMessage:{alignSelf:"flex-start"},

  messageTop:{flexDirection:"row",alignItems:"center"},
  avatarFrame:{backgroundColor:INK.inset},
  avatarText:{color:INK.readoutSoft,fontWeight:"700",fontSize:15},
  authorText:{flex:1,marginLeft:10,minWidth:0},
  author:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  // A timestamp is recorded, never written, so it is the data face.
  time:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.7,marginTop:3
  },
  body_:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*1.5,marginTop:10},
  deletedBody:{color:INK.readoutFaint,fontStyle:"italic"},

  messageActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:10},
  reportPanel:{
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,padding:11,marginTop:11
  },
  reasonWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:11},

  composer:{
    paddingHorizontal:16,paddingTop:12,paddingBottom:18,
    borderTopWidth:SHAPE.border,borderTopColor:INK.hairline,backgroundColor:INK.panel
  },
  announcementToggle:{alignSelf:"flex-start",marginBottom:9},
  composerRow:{flexDirection:"row",alignItems:"flex-end",gap:8},
  // An input is a well, cut into the housing rather than stuck on it.
  composerWell:{
    flex:1,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,overflow:"hidden"
  },
  input:{maxHeight:110,minHeight:46,textAlignVertical:"top",paddingTop:11},
  sendButton:{minWidth:96},
  counter:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.6,textAlign:"right",marginTop:6
  }
});
