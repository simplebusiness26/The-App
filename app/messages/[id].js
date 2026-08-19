import React,{useCallback,useEffect,useRef,useState} from "react";
import {
  View,Text,TextInput,Pressable,ScrollView,ActivityIndicator,
  StyleSheet
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {entityRoute,entityTypeLabel} from "../../utils/places";
import useKeyboardInset from "../../hooks/useKeyboardInset";
import {INK} from "../../utils/tokens";

// DesignLab production direction: Living Inbox + Warm Flow, with the useful
// Loren rule preserved: moving around a conversation must never steal the
// reader's place.
//
// Sending still goes through send_message, which re-checks permission on EVERY
// message. Ending a friendship or listing relationship may close future sends;
// it never erases the conversation that already happened.

export default function Conversation(){
  const params=useLocalSearchParams();
  const conversationId=Array.isArray(params.id) ? params.id[0] : params.id;
  const {showFeedback}=useFeedback();

  const [messages,setMessages]=useState([]);
  const [conversation,setConversation]=useState(null);
  const [other,setOther]=useState(null);
  const [viewerId,setViewerId]=useState(null);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const [showLatest,setShowLatest]=useState(false);
  const scroller=useRef(null);
  // Whether the thread has been scrolled to the bottom once for this
  // conversation. Everything after that is the reader's business.
  const settled=useRef(false);
  // Set while the reader has deliberately scrolled up. Nothing may yank them
  // back down while this is true.
  const readingHistory=useRef(false);

  const keyboard=useKeyboardInset();

  const load=useCallback(async()=>{
    if(!conversationId) return;

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}
    setViewerId(user.id);

    const [conversationResult,memberResult,messageResult]=await Promise.all([
      supabase.from("conversations").select("id,kind,target_type,target_id").eq("id",conversationId).maybeSingle(),
      supabase.from("conversation_members").select("user_id").eq("conversation_id",conversationId),
      supabase.from("direct_messages").select("id,sender_id,body,created_at")
        .eq("conversation_id",conversationId).order("created_at",{ascending:true})
    ]);

    if(!conversationResult.data){
      setError("This conversation is unavailable.");
      setLoading(false);
      return;
    }

    setConversation(conversationResult.data);
    setMessages(messageResult.data || []);

    const otherId=(memberResult.data || []).map((row)=>row.user_id).find((id)=>id!==user.id);
    if(otherId){
      const {data:profile}=await supabase.from("profiles").select("id,full_name").eq("id",otherId).maybeSingle();
      setOther(profile || {id:otherId,full_name:"Explorer"});
    }

    await supabase.rpc("mark_conversation_read",{p_conversation:conversationId});
    setLoading(false);
  },[conversationId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function send(){
    const body=draft.trim();
    if(sending || !body) return;

    setSending(true);
    const {error:sendError}=await supabase.rpc("send_message",{
      p_conversation:conversationId,
      p_body:body
    });
    setSending(false);

    if(sendError){
      showFeedback(sendError.message,"error","Not sent");
      return;
    }

    // Keep the draft if the database refuses the send; clear it only after the
    // message is accepted.
    setDraft("");
    await load();
    readingHistory.current=false;
    setShowLatest(false);
    scroller.current?.scrollToEnd?.({animated:true});
  }

  function goLatest(){
    readingHistory.current=false;
    setShowLatest(false);
    scroller.current?.scrollToEnd?.({animated:true});
  }

  // Opening the keyboard shortens the thread. If the reader was at the bottom,
  // keep them there. If they deliberately scrolled up, leave them alone.
  useEffect(()=>{
    if(keyboard<=0 || readingHistory.current) return;
    const timer=setTimeout(()=>scroller.current?.scrollToEnd?.({animated:false}),50);
    return()=>clearTimeout(timer);
  },[keyboard]);

  if(loading){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.ink}/></View>;
  }

  if(error){
    return <View style={styles.centre}><Text style={styles.muted}>{error}</Text></View>;
  }

  const place=conversation?.kind==="listing" && conversation?.target_type
    ? entityRoute(conversation.target_type,conversation.target_id)
    : null;

  return(
    <View style={[styles.screen,{paddingBottom:keyboard}]}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          onPress={()=>router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerMain}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${other?.full_name || "this Explorer"}'s profile`}
            onPress={()=>other?.id && router.push(`/profile/${other.id}`)}
          >
            <Text style={styles.name} numberOfLines={1}>{other?.full_name || "Explorer"}</Text>
          </Pressable>

          {conversation?.kind==="listing" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the listing this conversation is about"
              disabled={!place}
              onPress={()=>place && router.push(place)}
            >
              <Text style={styles.about} numberOfLines={1}>
                About a {entityTypeLabel(conversation.target_type).toLowerCase()} →
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.about}>Friend conversation</Text>
          )}
        </View>

        <View style={styles.headerBalance}/>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={()=>{
          if(settled.current || readingHistory.current) return;
          settled.current=true;
          setShowLatest(false);
          scroller.current?.scrollToEnd?.({animated:false});
        }}
        onScroll={(event)=>{
          const {layoutMeasurement,contentOffset,contentSize}=event.nativeEvent;
          const fromBottom=contentSize.height-(contentOffset.y+layoutMeasurement.height);
          const reading=fromBottom>80;
          readingHistory.current=reading;
          setShowLatest((current)=>current===reading ? current : reading);
        }}
        scrollEventThrottle={64}
      >
        {!messages.length && (
          <View style={styles.emptyThread}>
            <Text style={styles.emptyTitle}>
              {conversation?.kind==="listing" ? "Start with the place" : "Start the conversation"}
            </Text>
            <Text style={styles.muted}>
              {conversation?.kind==="listing"
                ? "Ask whatever you need to know about this place."
                : "Say something."}
            </Text>
          </View>
        )}

        {messages.map((message)=>{
          const mine=message.sender_id===viewerId;
          return(
            <View
              key={message.id}
              style={[styles.bubble,mine ? styles.mine : styles.theirs]}
              accessibilityLabel={`${mine ? "You" : other?.full_name || "They"} said: ${message.body}`}
            >
              <Text style={[styles.body,mine && styles.mineBody]}>{message.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      {showLatest && (
        <View style={styles.latestRow} pointerEvents="box-none">
          <Pressable
            style={styles.latest}
            accessibilityRole="button"
            accessibilityLabel="Jump to latest message"
            onPress={goLatest}
          >
            <Text style={styles.latestText}>Latest ↓</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message"
          placeholderTextColor={INK.inkSoft}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
          accessibilityLabel="Your message"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send,(!draft.trim() || sending) && styles.sendOff]}
          disabled={!draft.trim() || sending}
          onPress={send}
        >
          <Text style={styles.sendText}>{sending ? "…" : "↑"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  header:{paddingHorizontal:12,paddingTop:10,paddingBottom:10,borderBottomWidth:1,borderBottomColor:INK.hair,backgroundColor:INK.card,flexDirection:"row",alignItems:"center",gap:8},
  back:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:INK.hair,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  backText:{color:INK.ink,fontSize:31,lineHeight:31,fontWeight:"500",marginTop:-2},
  headerMain:{flex:1,minWidth:0,alignItems:"center"},
  headerBalance:{width:44,height:44},
  name:{color:INK.ink,fontSize:17,fontWeight:"900",maxWidth:240},
  about:{color:INK.inkSoft,fontSize:11,fontWeight:"800",marginTop:2,maxWidth:250},
  thread:{flex:1},
  threadContent:{padding:16,gap:8,paddingBottom:20},
  emptyThread:{alignSelf:"stretch",backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:16,marginTop:4},
  emptyTitle:{color:INK.ink,fontSize:15,fontWeight:"900",marginBottom:4},
  muted:{color:INK.inkSoft,fontSize:14,lineHeight:20},
  bubble:{maxWidth:"82%",borderWidth:1,borderColor:INK.hair,borderRadius:18,paddingHorizontal:13,paddingVertical:10},
  mine:{alignSelf:"flex-end",backgroundColor:INK.ink,borderBottomRightRadius:7,borderColor:INK.ink},
  theirs:{alignSelf:"flex-start",backgroundColor:INK.card,borderBottomLeftRadius:7},
  body:{color:INK.ink,fontSize:14,lineHeight:20},
  mineBody:{color:INK.card},
  latestRow:{alignItems:"flex-end",paddingHorizontal:12,paddingBottom:6,backgroundColor:INK.paper},
  latest:{minHeight:40,borderRadius:99,borderWidth:1,borderColor:INK.hair,backgroundColor:INK.card,paddingHorizontal:14,alignItems:"center",justifyContent:"center"},
  latestText:{color:INK.ink,fontSize:11,fontWeight:"900"},
  // This remains a normal in-flow composer. The measured keyboard height is
  // applied to the screen above, so Android cannot cover it and no device offset
  // is guessed here.
  composer:{flexDirection:"row",alignItems:"flex-end",gap:8,padding:10,paddingBottom:24,borderTopWidth:2,borderTopColor:INK.hair,backgroundColor:INK.card},
  input:{flex:1,minHeight:44,maxHeight:120,borderWidth:1,borderColor:INK.hair,borderRadius:18,paddingHorizontal:13,paddingVertical:10,color:INK.ink,backgroundColor:INK.paper,textAlignVertical:"top"},
  send:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:INK.ink},
  sendOff:{opacity:0.35},
  sendText:{color:INK.card,fontSize:20,fontWeight:"900",lineHeight:22}
});
