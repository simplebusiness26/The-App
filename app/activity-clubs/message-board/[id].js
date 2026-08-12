import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import {useFeedback} from "../../../context/FeedbackContext";
import {INK} from "../../../utils/tokens";

// Seven pastels, one per poster, so a thread is readable at a glance. They
// were seven colours outside the token table -- a private palette that existed
// only here, which is exactly what "never introduce a colour outside this list"
// forbids. The same job is done by alternating the two surfaces the table
// already has, and who said what is carried by the name above each message
// rather than by a colour nobody has a key to.
const MESSAGE_COLOURS=[INK.card,INK.paper];

function colourForUser(userId){
  const value=String(userId || "member");
  let hash=0;
  for(let index=0;index<value.length;index+=1){
    hash=((hash<<5)-hash)+value.charCodeAt(index);
    hash|=0;
  }
  return MESSAGE_COLOURS[Math.abs(hash)%MESSAGE_COLOURS.length];
}

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
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
  }

  if(error || !allowed){
    return(
      <View style={styles.center}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.errorTitle}>Members only</Text>
        <Text style={styles.errorText}>{error}</Text>
        {!!club && <Pressable style={styles.backButton} onPress={()=>router.replace(`/activity-clubs/${club.id}`)}><Text style={styles.buttonText}>Return to Public Profile</Text></Pressable>}
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{club?.name}</Text>
        <Text style={styles.subtitle}>Private members’ message board</Text>
      </View>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {messages.length===0 && <View style={styles.emptyBox}><Text>No messages yet. Start the conversation.</Text></View>}

        {messages.map(item=>{
          const author=messageProfiles[item.user_id];
          const authorName=author?.full_name || item.author_name || "Member";
          const ownMessage=item.user_id===user?.id;

          return(
            <View key={item.id} style={[styles.messageCard,{backgroundColor:colourForUser(item.user_id)},ownMessage ? styles.ownMessage : styles.otherMessage]}>
              <View style={styles.authorRow}>
                {author?.profile_photo ? (
                  <Image source={{uri:author.profile_photo}} style={styles.avatar}/>
                ) : (
                  <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{authorName.slice(0,1).toUpperCase()}</Text></View>
                )}
                <View style={styles.authorTextWrap}>
                  <Text style={styles.author}>{authorName}</Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.message}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput style={styles.input} placeholder={`Write as ${profile?.full_name || "Member"}`} value={message} onChangeText={setMessage} multiline maxLength={1000}/>
        <Pressable style={styles.sendButton} onPress={postMessage} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? "Sending..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},header:{padding:20,backgroundColor:"white",borderBottomWidth:1,borderColor:"#ddd"},title:{fontSize:24,fontWeight:"bold"},subtitle:{color:"#666",marginTop:5},messageList:{flex:1},messageContent:{padding:16,paddingBottom:30},emptyBox:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#ddd"},messageCard:{padding:14,borderRadius:16,borderWidth:1,borderColor:"rgba(0,0,0,0.08)",marginBottom:12,maxWidth:"88%"},ownMessage:{alignSelf:"flex-end"},otherMessage:{alignSelf:"flex-start"},authorRow:{flexDirection:"row",alignItems:"center"},avatar:{width:36,height:36,borderRadius:18,backgroundColor:"#ddd"},avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},avatarInitial:{color:"white",fontWeight:"bold"},authorTextWrap:{marginLeft:9,flex:1},author:{fontWeight:"bold",fontSize:15},body:{fontSize:16,lineHeight:22,marginTop:10},time:{fontSize:10,color:"#666",marginTop:2},composer:{padding:12,backgroundColor:"white",borderTopWidth:1,borderColor:"#ddd"},input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:12,minHeight:54,maxHeight:120},sendButton:{backgroundColor:INK.blue,padding:14,borderRadius:10,marginTop:8},buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},lock:{fontSize:42},errorTitle:{fontSize:24,fontWeight:"bold",marginTop:12},errorText:{textAlign:"center",color:"#555",lineHeight:22,marginTop:8},backButton:{backgroundColor:"#222",padding:14,borderRadius:10,marginTop:18,width:"100%"}
});
