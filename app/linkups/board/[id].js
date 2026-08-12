import React,{useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import {useFeedback} from "../../../context/FeedbackContext";
import {effectiveLinkupStatus,formatDateTime} from "../../../utils/linkups";
import {INK} from "../../../utils/tokens";

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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.blue}/></View>;
  if(error || !linkup) return <View style={styles.center}><Text style={styles.errorTitle}>Board unavailable</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.backButton} onPress={()=>router.replace(`/linkups/${id}`)}><Text style={styles.backText}>Back to Link-up</Text></Pressable></View>;

  return(
    <View style={styles.screen}>
      <ScrollView style={styles.messages} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
        <Pressable style={styles.headerCard} onPress={()=>router.push(`/linkups/${id}`)}>
          <Text style={styles.eyebrow}>PRIVATE ATTENDEE BOARD</Text>
          <Text style={styles.title}>{linkup.title}</Text>
          <Text style={styles.when}>{formatDateTime(linkup.starts_at)} · {linkup.location_name}</Text>
          {readOnly&&<Text style={styles.readOnlyBanner}>This board is now read-only.</Text>}
        </Pressable>

        {messages.length===0&&<View style={styles.emptyCard}><Text style={styles.emptyIcon}>💬</Text><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Use the board to coordinate without sharing private contact details.</Text></View>}

        {messages.map(message=>{
          const author=profiles[message.user_id];
          const mine=message.user_id===user?.id;
          const canRemove=mine||isOwner;
          return(
            <View key={message.id} style={[styles.messageCard,message.is_announcement&&styles.announcementCard,mine&&styles.myMessage]}>
              <View style={styles.messageTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{author?.full_name?.charAt(0)?.toUpperCase()||"E"}</Text></View>
                <View style={styles.authorText}><Text style={styles.author}>{author?.full_name||"Explorer"}</Text><Text style={styles.time}>{formatDateTime(message.created_at)}</Text></View>
                {message.is_announcement&&<Text style={styles.announcementBadge}>ANNOUNCEMENT</Text>}
              </View>
              <Text style={[styles.body,message.status==="deleted"&&styles.deletedBody]}>{message.status==="deleted"?"Message removed":message.body}</Text>
              {message.status!=="deleted"&&<View style={styles.messageActions}>{canRemove&&<Pressable onPress={()=>remove(message)}><Text style={styles.removeText}>Remove</Text></Pressable>}{!mine&&<Pressable onPress={()=>setReportingId(reportingId===message.id?null:message.id)}><Text style={styles.reportText}>Report</Text></Pressable>}</View>}
              {reportingId===message.id&&!mine&&<View style={styles.reportPanel}><View style={styles.reasonWrap}>{REPORT_REASONS.map(reason=><Pressable key={reason} style={[styles.reason,reportReason===reason&&styles.reasonActive]} onPress={()=>setReportReason(reason)}><Text style={[styles.reasonText,reportReason===reason&&styles.reasonTextActive]}>{reason}</Text></Pressable>)}</View><Pressable style={styles.submitReport} disabled={working} onPress={()=>report(message)}><Text style={styles.submitReportText}>Submit report</Text></Pressable></View>}
            </View>
          );
        })}
      </ScrollView>

      {!readOnly&&<View style={styles.composer}>
        {isOwner&&<Pressable style={[styles.announcementToggle,announcement&&styles.announcementToggleActive]} onPress={()=>setAnnouncement(current=>!current)}><Text style={[styles.announcementToggleText,announcement&&styles.announcementToggleTextActive]}>{announcement?"✓ Organiser announcement":"Post as announcement"}</Text></Pressable>}
        <View style={styles.composerRow}><TextInput value={body} onChangeText={setBody} maxLength={1000} multiline placeholder="Message attendees" placeholderTextColor={INK.inkSoft} style={styles.input}/><Pressable style={[styles.sendButton,(!body.trim()||working)&&styles.disabled]} disabled={!body.trim()||working} onPress={post}>{working?<ActivityIndicator color={INK.ink}/>:<Text style={styles.sendText}>Send</Text>}</Pressable></View>
        <Text style={styles.counter}>{body.length}/1000</Text>
      </View>}
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},messages:{flex:1},content:{padding:16,paddingBottom:24},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},errorTitle:{color:INK.ink,fontSize:22,fontWeight:"900"},errorText:{color:INK.inkSoft,textAlign:"center",marginTop:8},backButton:{backgroundColor:INK.blue,borderRadius:12,padding:13,marginTop:17},backText:{color:INK.card,fontWeight:"900"},
  headerCard:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:16,padding:15,marginBottom:14},eyebrow:{color:INK.card,fontSize:9,fontWeight:"900",letterSpacing:.8},title:{color:INK.card,fontSize:23,fontWeight:"900",marginTop:5},when:{color:INK.card,fontSize:12,marginTop:7},readOnlyBanner:{color:INK.card,backgroundColor:INK.red,borderRadius:9,padding:9,marginTop:10,fontWeight:"800",fontSize:11,overflow:"hidden"},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:28,alignItems:"center"},emptyIcon:{fontSize:36},emptyTitle:{color:INK.ink,fontSize:18,fontWeight:"900",marginTop:8},emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:19,marginTop:5},
  messageCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:15,padding:13,marginBottom:10},myMessage:{borderColor:INK.blue,borderWidth:2},announcementCard:{borderColor:INK.blue,borderWidth:2},messageTop:{flexDirection:"row",alignItems:"center"},avatar:{width:38,height:38,borderRadius:19,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},avatarText:{color:INK.card,fontWeight:"900"},authorText:{flex:1,marginLeft:9},author:{color:INK.ink,fontWeight:"900"},time:{color:INK.inkSoft,fontSize:10,marginTop:2},announcementBadge:{color:INK.ink,fontSize:8,fontWeight:"900"},body:{color:INK.ink,lineHeight:21,marginTop:11},deletedBody:{color:INK.ink,fontStyle:"italic"},messageActions:{flexDirection:"row",justifyContent:"flex-end",gap:16,marginTop:10},removeText:{color:INK.ink,fontWeight:"900",fontSize:11},reportText:{color:INK.ink,fontWeight:"900",fontSize:11},
  reportPanel:{backgroundColor:INK.card,borderRadius:11,padding:10,marginTop:10},reasonWrap:{flexDirection:"row",flexWrap:"wrap",gap:5},reason:{borderColor:INK.ink,borderWidth:1,borderRadius:16,paddingHorizontal:9,paddingVertical:6},reasonActive:{backgroundColor:INK.blue},reasonText:{color:INK.card,fontSize:9,fontWeight:"800"},reasonTextActive:{color:INK.card},submitReport:{backgroundColor:INK.red,borderRadius:9,padding:9,alignItems:"center",marginTop:9},submitReportText:{color:INK.card,fontWeight:"900",fontSize:11},
  composer:{backgroundColor:INK.card,borderTopColor:INK.hair,borderTopWidth:1,padding:12,paddingBottom:18},announcementToggle:{alignSelf:"flex-start",borderColor:INK.blue,borderWidth:1,borderRadius:16,paddingHorizontal:10,paddingVertical:6,marginBottom:8},announcementToggleActive:{backgroundColor:INK.blue,borderColor:INK.blue},announcementToggleText:{color:INK.card,fontSize:10,fontWeight:"900"},announcementToggleTextActive:{color:INK.card},composerRow:{flexDirection:"row",alignItems:"flex-end",gap:8},input:{flex:1,maxHeight:110,minHeight:46,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:12,color:INK.ink,paddingHorizontal:12,paddingVertical:11},sendButton:{backgroundColor:INK.blue,borderRadius:11,minWidth:72,height:46,alignItems:"center",justifyContent:"center"},sendText:{color:INK.card,fontWeight:"900"},counter:{color:INK.inkSoft,fontSize:9,textAlign:"right",marginTop:4},disabled:{opacity:.55}
});
