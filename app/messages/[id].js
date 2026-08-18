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
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {Action,Empty,Glyph,MONO,Screen} from "../../components/instrument";

// One conversation.
//
// Sending goes through send_message, which re-checks the relationship on EVERY
// message rather than only when the thread was opened: somebody who unfollows,
// or is blocked, or stops managing the listing the thread is about, stops being
// able to write to it. That refusal arrives here as an ordinary error and is
// shown as the sentence the database wrote, because those sentences say what
// happened and what to do.
//
// What was already said stays. Ending a friendship closes the thread; it does
// not delete a conversation two people had.

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

    // Row level security decides all three of these. A conversation somebody is
    // not in returns nothing rather than an error, which is why the screen
    // checks for absence rather than for a refusal.
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
      // The database's own sentence. It says what happened and what to do --
      // "you are not friends any more, so this conversation is closed" is more
      // use than "could not send".
      showFeedback(sendError.message,"error","Not sent");
      return;
    }

    // The draft is cleared only after the database accepted it. A send that
    // fails above returns with the text still in the box -- losing what
    // somebody typed because the network blinked is not an acceptable way to
    // report a network problem.
    setDraft("");
    await load();
    // Sending is the one action that always returns you to the bottom: you
    // wrote it, you should see it land.
    readingHistory.current=false;
    scroller.current?.scrollToEnd?.({animated:true});
  }

  // Opening the keyboard shortens the thread. If the reader was at the bottom,
  // keep them there -- otherwise the last message slides up behind the composer
  // at exactly the moment they are about to reply to it.
  useEffect(()=>{
    if(keyboard<=0 || readingHistory.current) return;
    const timer=setTimeout(()=>scroller.current?.scrollToEnd?.({animated:false}),50);
    return()=>clearTimeout(timer);
  },[keyboard]);

  if(loading){
    return(
      <Screen>
        <View style={styles.centre}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  if(error){
    return(
      <Screen>
        <View style={styles.centre}>
          <Empty glyph="warn" title="Conversation unavailable" instruction={error}/>
        </View>
      </Screen>
    );
  }

  const place=conversation?.kind==="listing" && conversation?.target_type
    ? entityRoute(conversation.target_type,conversation.target_id)
    : null;

  return(
    // The keyboard's height, applied as padding on the screen itself. See
    // hooks/useKeyboardInset.js for why this is not a KeyboardAvoidingView:
    // the old one had no behaviour on Android at all, and Expo's edge-to-edge
    // default means the window no longer resizes underneath it, so the keyboard
    // simply covered the composer.
    <Screen style={{paddingBottom:keyboard}}>
      {/*
        The head plate. A mono eyebrow saying what kind of thread this is, the
        other person's name in display type, and an etched rule under it -- the
        same opening every panel in the instrument carries.
      */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{conversation?.kind==="listing" ? "ABOUT A PLACE" : "DIRECT MESSAGE"}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${other?.full_name || "this Explorer"}'s profile`}
          onPress={()=>other?.id && router.push(`/profile/${other.id}`)}
        >
          <Text style={styles.name}>{other?.full_name || "Explorer"}</Text>
        </Pressable>

        {conversation?.kind==="listing" && (
          <Pressable
            style={styles.aboutRow}
            accessibilityRole="button"
            accessibilityLabel="Open the listing this conversation is about"
            disabled={!place}
            onPress={()=>place && router.push(place)}
          >
            <Text style={styles.about}>
              About a {entityTypeLabel(conversation.target_type).toLowerCase()}
            </Text>
            <Glyph name="forward" size={12} colour={INK.readoutFaint}/>
          </Pressable>
        )}

        <View style={styles.headerRule}/>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        // Was: scrollToEnd on EVERY content size change. That fires whenever
        // anything reflows -- an image settling, the keyboard opening, a
        // re-render -- so scrolling up to read older messages yanked the view
        // back to the bottom. The thread now settles at the bottom once, and
        // after that only a message being sent moves it.
        onContentSizeChange={()=>{
          if(settled.current || readingHistory.current) return;
          settled.current=true;
          scroller.current?.scrollToEnd?.({animated:false});
        }}
        onScroll={(event)=>{
          const {layoutMeasurement,contentOffset,contentSize}=event.nativeEvent;
          const fromBottom=contentSize.height-(contentOffset.y+layoutMeasurement.height);
          // A small margin, because "at the bottom" is never exactly zero.
          readingHistory.current=fromBottom>80;
        }}
        scrollEventThrottle={64}
      >
        {!messages.length && (
          <Empty
            glyph="comment"
            title="Nothing said yet"
            instruction={conversation?.kind==="listing"
              ? "Ask whatever you need to know about this place."
              : "Say something."}
          />
        )}

        {messages.map((message)=>{
          const mine=message.sender_id===viewerId;
          return(
            <View
              key={message.id}
              style={[styles.bubble,mine ? styles.mine : styles.theirs]}
              accessibilityLabel={`${mine ? "You" : other?.full_name || "They"} said: ${message.body}`}
            >
              <Text style={styles.body}>{message.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        {/*
          The well is cut into the housing rather than stuck on it -- the same
          inset surface every input in the app sits in. It is not wrapped in a
          Field because a composer has no label above it: the placeholder and the
          Send control beside it are the whole instruction.
        */}
        <View style={styles.inputWell}>
          <TextInput
            style={styles.input}
            placeholder="Write a message"
            placeholderTextColor={INK.readoutFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            accessibilityLabel="Your message"
          />
        </View>

        <Action
          kind="primary"
          glyph="send"
          label="Send"
          accessibilityLabel="Send"
          disabled={!draft.trim()}
          loading={sending}
          onPress={send}
          style={styles.send}
        />
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  centre:{flex:1,alignItems:"center",justifyContent:"center",padding:16},

  header:{paddingHorizontal:16,paddingTop:12,paddingBottom:0,backgroundColor:INK.ground},
  eyebrow:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,marginBottom:5
  },
  name:{color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",letterSpacing:-0.5},
  aboutRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:4,minHeight:32},
  about:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.8
  },
  headerRule:{height:1,backgroundColor:INK.hairline,marginTop:12},

  thread:{flex:1},
  threadContent:{padding:16,gap:8,paddingBottom:20},

  // A message is something a person wrote, so it stays in the body face on a
  // panel. Whose it is reads as a step up the surface stack and a stronger
  // edge -- not a fill, which is what made the old dark bubble need a second
  // text colour and a second contrast argument.
  bubble:{
    maxWidth:"82%",
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    paddingHorizontal:13,
    paddingVertical:10
  },
  mine:{alignSelf:"flex-end",backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  theirs:{alignSelf:"flex-start",backgroundColor:INK.panel,borderColor:INK.hairline},
  body:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight
  },

  // paddingBottom was 96, a hand-tuned clearance for the tab bar. It double
  // counted: components/TabBar.js renders as a SIBLING of the Stack in
  // app/_layout.js, so this screen's box already stops above it. The only thing
  // actually overlapping is the 20px strip the raised centre button rises into,
  // so 28 clears it with room to spare -- and gives 68px of screen back.
  composer:{
    flexDirection:"row",
    alignItems:"flex-end",
    gap:9,
    padding:12,
    paddingBottom:28,
    borderTopWidth:SHAPE.border,
    borderTopColor:INK.hairline,
    backgroundColor:INK.panel
  },
  inputWell:{
    flex:1,
    backgroundColor:INK.inset,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,
    overflow:"hidden"
  },
  input:{
    minHeight:SHAPE.tapTarget,
    maxHeight:120,
    paddingHorizontal:12,
    paddingVertical:11,
    color:INK.readout,
    fontSize:TYPE.body.sizes.lg,
    textAlignVertical:"top"
  },
  send:{minWidth:104}
});
