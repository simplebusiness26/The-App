import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ScrollView,TextInput,ActivityIndicator,Image} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import {useFeedback} from "../../../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../../../utils/tokens";
import {
  Action,
  Empty,
  Frame,
  Glyph,
  MONO,
  Panel,
  Screen,
  ScreenTitle,
  fieldInputStyle
} from "../../../components/instrument";

// The club's private members' board.
//
// WHY THE BUBBLES CHANGED SHAPE
//
// Your own messages used to be a solid block of ink with light text on it, and
// everyone else's a card bordered in the same ink at 2px -- the print system's
// answer to "which of these did I write". Under the instrument palette that
// solid block is the near-white READOUT colour, so a member's own board was a
// column of white slabs.
//
// The instrument says the same thing with a surface step: yours sits a step up
// on `panelRaised` behind a `hairlineStrong` edge, everyone else's stays on
// `panel` behind a hairline, and the alignment does the rest. No fill, so every
// label inside stays readable -- which is the whole reason the design system
// forbids marking things by filling them.
//
// The lock screen is a Notice, not a padlock emoji at 42px.

export default function ActivityClubMessageBoard(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [club,setClub]=useState(null);
  const [messages,setMessages]=useState([]);
  const [messageProfiles,setMessageProfiles]=useState({});
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [allowed,setAllowed]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{if(id) loadBoard();},[id]));

  async function loadBoard(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    setUser(currentUser);

    const [{data:profileRow},{data:clubRow,error:clubError}]=await Promise.all([
      supabase.from("profiles").select("id,full_name,profile_photo").eq("id",currentUser.id).single(),
      supabase.from("activity_clubs").select("id,name,manager_id").eq("id",id).single()
    ]);

    if(clubError || !clubRow){
      setError("This message board could not be loaded.");
      setLoading(false);
      return;
    }

    setProfile(profileRow || null);
    setClub(clubRow);

    let hasAccess=clubRow.manager_id===currentUser.id;

    if(!hasAccess){
      const {data:membership}=await supabase
        .from("activity_memberships")
        .select("status")
        .eq("club_id",id)
        .eq("user_id",currentUser.id)
        .maybeSingle();
      hasAccess=membership?.status==="approved";
    }

    setAllowed(hasAccess);

    if(!hasAccess){
      setError("This message board is private. The club manager must approve your membership first.");
      setLoading(false);
      return;
    }

    const {data:messageRows,error:messageError}=await supabase
      .from("activity_messages")
      .select("*")
      .eq("club_id",id)
      .order("created_at",{ascending:true});

    if(messageError){
      setError("Messages could not be loaded.");
      setLoading(false);
      return;
    }

    const rows=messageRows || [];
    setMessages(rows);

    const userIds=[...new Set(rows.map(item=>item.user_id).filter(Boolean))];
    if(userIds.length){
      const {data:profiles}=await supabase
        .from("profiles")
        .select("id,full_name,profile_photo")
        .in("id",userIds);

      const profileMap={};
      (profiles || []).forEach(item=>{profileMap[item.id]=item;});
      setMessageProfiles(profileMap);
    }else{
      setMessageProfiles({});
    }

    setLoading(false);
  }

  async function postMessage(){
    const clean=message.trim();
    if(!clean || !user || !allowed || sending) return;

    setSending(true);

    const {error:postError}=await supabase
      .from("activity_messages")
      .insert({
        club_id:id,
        user_id:user.id,
        author_name:profile?.full_name || "Member",
        message:clean
      });

    setSending(false);

    if(postError){
      showFeedback(postError.message,"error","Message not sent");
      return;
    }

    setMessage("");
    showFeedback("Your message was posted to the private board.","success","Message sent");
    await loadBoard();
  }

  if(loading){
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></Screen>;
  }

  if(error || !allowed){
    return(
      <Screen style={styles.center}>
        <View style={styles.lockDial}>
          <Glyph name="lock" size={22} colour={INK.readoutFaint}/>
        </View>
        <Text style={styles.errorTitle}>Members only</Text>
        <Text style={styles.errorText}>{error}</Text>
        {!!club && (
          <Action
            kind="secondary"
            label="Return to Public Profile"
            glyph="back"
            style={styles.backButton}
            accessibilityLabel="Return to the public club profile"
            onPress={()=>router.replace(`/activity-clubs/${club.id}`)}
          />
        )}
      </Screen>
    );
  }

  return(
    <Screen>
      <ScreenTitle eyebrow="PRIVATE MEMBERS' BOARD" title={club?.name} meta="Only approved members and the manager can read this."/>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {messages.length===0 && (
          <Empty
            title="No messages yet"
            instruction="Start the conversation. Everything posted here stays inside the club."
            glyph="comment"
          />
        )}

        {messages.map(item=>{
          const author=messageProfiles[item.user_id];
          const authorName=author?.full_name || item.author_name || "Member";
          const ownMessage=item.user_id===user?.id;

          return(
            <Panel
              key={item.id}
              raised={ownMessage}
              style={[styles.messageCard,ownMessage ? styles.ownMessage : styles.otherMessage]}
            >
              <View style={styles.authorRow}>
                <Frame size={34} round style={styles.avatarFrame}>
                  {author?.profile_photo
                    ? <Image source={{uri:author.profile_photo}} style={styles.avatar}/>
                    : <Text style={styles.avatarInitial}>{authorName.slice(0,1).toUpperCase()}</Text>}
                </Frame>
                <View style={styles.authorTextWrap}>
                  <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
                  {/* A timestamp is something the app recorded, never something
                      a person wrote, so it is the data face. */}
                  <Text style={styles.time} numberOfLines={1}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.message}</Text>
            </Panel>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.composerWell}>
          <TextInput
            style={[fieldInputStyle,styles.input]}
            placeholder={`Write as ${profile?.full_name || "Member"}`}
            placeholderTextColor={INK.readoutFaint}
            accessibilityLabel="Write a message to the board"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
        </View>
        <Action
          kind="primary"
          label={sending ? "Sending..." : "Send"}
          glyph="send"
          style={styles.sendButton}
          accessibilityLabel="Send this message to the board"
          disabled={sending}
          onPress={postMessage}
        />
      </View>
    </Screen>
  );
}

// Yours steps UP a surface; everybody else's stays on the panel. No fill, so
// nothing inside either has to be restyled to stay readable.
const styles=StyleSheet.create({
  center:{alignItems:"center",justifyContent:"center",padding:30},
  lockDial:{
    width:56,height:56,borderRadius:SHAPE.radius.pill,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  errorTitle:{
    color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",
    letterSpacing:-0.3,marginTop:14,textAlign:"center"
  },
  errorText:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,textAlign:"center",
    lineHeight:TYPE.body.sizes.md*1.5,marginTop:8
  },
  backButton:{marginTop:20,alignSelf:"stretch"},

  messageList:{flex:1},
  messageContent:{paddingHorizontal:16,paddingBottom:28},
  messageCard:{padding:13,marginBottom:10,maxWidth:"88%"},
  ownMessage:{alignSelf:"flex-end",borderColor:INK.hairlineStrong},
  otherMessage:{alignSelf:"flex-start"},

  authorRow:{flexDirection:"row",alignItems:"center"},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:34,height:34,borderRadius:SHAPE.radius.pill},
  avatarInitial:{color:INK.readoutSoft,fontWeight:"700",fontSize:15},
  authorTextWrap:{marginLeft:10,flex:1,minWidth:0},
  author:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  time:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.7,marginTop:3
  },
  body:{
    color:INK.readout,fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*1.5,marginTop:10
  },

  composer:{
    paddingHorizontal:16,paddingTop:12,paddingBottom:18,
    borderTopWidth:SHAPE.border,borderTopColor:INK.hairline,backgroundColor:INK.panel
  },
  // An input is a well, cut into the housing rather than stuck on it.
  composerWell:{
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,overflow:"hidden"
  },
  input:{minHeight:54,maxHeight:120,textAlignVertical:"top",paddingTop:11},
  sendButton:{marginTop:9}
});
