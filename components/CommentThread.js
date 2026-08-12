import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

const REPORT_REASONS=[
  {key:"spam",label:"Spam"},
  {key:"harassment",label:"Harassment"},
  {key:"inappropriate",label:"Inappropriate"},
  {key:"false_information",label:"False information"},
  {key:"other",label:"Other"}
];

function timeLabel(value){
  if(!value) return "";
  const date=new Date(value);
  const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1) return "Just now";
  if(minutes<60) return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24) return `${hours}h ago`;
  return date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

function Avatar({profile}){
  if(profile?.profile_photo) return <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>;
  return <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>;
}

export default function CommentThread({targetType,targetId,ownerId,onCountChanged}){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [comments,setComments]=useState([]);
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [reportTarget,setReportTarget]=useState(null);
  const [reportReason,setReportReason]=useState("inappropriate");
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!targetId){setLoading(false);return;}
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    const {data,error:commentsError}=await supabase
      .from("social_comments")
      .select("id,user_id,body,created_at,status")
      .eq("target_type",targetType)
      .eq("target_id",targetId)
      .eq("status","published")
      .order("created_at",{ascending:true});

    if(commentsError){
      console.log(commentsError);
      setError("Comments could not be loaded.");
      setComments([]);
      setLoading(false);
      return;
    }

    const rows=data || [];
    const ids=[...new Set(rows.map(item=>item.user_id))];
    let profileMap=new Map();

    if(ids.length){
      const {data:profiles}=await supabase
        .from("profiles")
        .select("id,full_name,profile_photo")
        .in("id",ids);
      profileMap=new Map((profiles || []).map(item=>[item.id,item]));
    }

    const merged=rows.map(item=>({...item,profile:profileMap.get(item.user_id) || null}));
    setComments(merged);
    setLoading(false);
    if(onCountChanged) onCountChanged(merged.length);
  },[targetType,targetId,onCountChanged]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function addComment(){
    if(working) return;
    if(!user){router.push("/auth/login");return;}

    const clean=body.trim();
    if(!clean){setError("Write a comment first.");return;}
    if(clean.length>500){setError("Comments can contain up to 500 characters.");return;}

    setWorking(true);
    setError("");
    const {error:insertError}=await supabase
      .from("social_comments")
      .insert({user_id:user.id,target_type:targetType,target_id:targetId,body:clean,status:"published"});

    if(insertError){
      setError(insertError.message);
      setWorking(false);
      return;
    }

    setBody("");
    setWorking(false);
    await load();
  }

  async function deleteComment(comment){
    if(working || !user) return;
    setWorking(true);
    const {error:deleteError}=await supabase
      .from("social_comments")
      .delete()
      .eq("id",comment.id);

    if(deleteError) showFeedback(deleteError.message,"error","Comment not deleted");
    else showFeedback("The comment was removed.","success","Comment deleted");

    setWorking(false);
    await load();
  }

  async function submitReport(){
    if(working || !user || !reportTarget) return;
    setWorking(true);

    const {error:reportError}=await supabase
      .from("social_reports")
      .insert({
        reporter_id:user.id,
        target_type:"comment",
        target_id:reportTarget.id,
        reason:reportReason,
        details:"",
        status:"open"
      });

    if(reportError){
      if(String(reportError.code)==="23505") showFeedback("You have already reported this comment.","info","Already reported");
      else showFeedback(reportError.message,"error","Report not sent");
    }else{
      showFeedback("The comment has been sent for review.","success","Report submitted");
    }

    setReportTarget(null);
    setReportReason("inappropriate");
    setWorking(false);
  }

  return(
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>Comments</Text>
        <Text style={styles.count}>{comments.length}</Text>
      </View>

      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={user ? "Add a comment" : "Log in to comment"}
          placeholderTextColor={INK.inkSoft}
          style={styles.input}
          multiline
          maxLength={500}
          editable={!!user && !working}
          textAlignVertical="top"
        />
        <View style={styles.composerBottom}>
          <Text style={styles.counter}>{body.length}/500</Text>
          <Pressable style={[styles.postButton,working && styles.disabled]} disabled={working} onPress={addComment}>
            {working ? <ActivityIndicator color={INK.ink} size="small"/> : <Text style={styles.postText}>Post</Text>}
          </Pressable>
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator color={INK.blue} style={{marginVertical:20}}/>}
      {!loading && comments.length===0 && <Text style={styles.empty}>No comments yet. Start the conversation.</Text>}

      {!loading && comments.map(comment=>{
        const canDelete=!!user && (user.id===comment.user_id || user.id===ownerId);
        const canReport=!!user && user.id!==comment.user_id;
        return(
          <View key={comment.id} style={styles.commentCard}>
            <Pressable style={styles.commentProfile} onPress={()=>router.push(`/profile/${comment.user_id}`)}>
              <Avatar profile={comment.profile}/>
              <View style={styles.commentTextWrap}>
                <Text style={styles.name}>{comment.profile?.full_name || "Explorer"}</Text>
                <Text style={styles.time}>{timeLabel(comment.created_at)}</Text>
              </View>
            </Pressable>
            <Text style={styles.body}>{comment.body}</Text>
            <View style={styles.commentActions}>
              {canReport && <Pressable onPress={()=>setReportTarget(reportTarget?.id===comment.id ? null : comment)}><Text style={styles.reportLink}>Report</Text></Pressable>}
              {canDelete && <Pressable disabled={working} onPress={()=>deleteComment(comment)}><Text style={styles.deleteLink}>Delete</Text></Pressable>}
            </View>

            {reportTarget?.id===comment.id && (
              <View style={styles.reportPanel}>
                <Text style={styles.reportTitle}>Why are you reporting this comment?</Text>
                <View style={styles.reasonRow}>
                  {REPORT_REASONS.map(reason=>(
                    <Pressable key={reason.key} style={[styles.reasonButton,reportReason===reason.key && styles.reasonActive]} onPress={()=>setReportReason(reason.key)}>
                      <Text style={[styles.reasonText,reportReason===reason.key && styles.reasonActiveText]}>{reason.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.reportActions}>
                  <Pressable style={styles.cancelButton} onPress={()=>setReportTarget(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                  <Pressable style={styles.submitReportButton} disabled={working} onPress={submitReport}><Text style={styles.submitReportText}>Submit report</Text></Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles=StyleSheet.create({
  section:{marginTop:24},
  headingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:11},
  title:{color:INK.ink,fontSize:23,fontWeight:"900"},
  count:{color:INK.blue,fontWeight:"900"},
  composer:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:11},
  input:{minHeight:75,color:INK.ink,fontSize:14,lineHeight:20,padding:3},
  composerBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:7},
  counter:{color:INK.inkSoft,fontSize:10},
  postButton:{minWidth:78,backgroundColor:INK.blue,borderRadius:10,paddingHorizontal:15,paddingVertical:10,alignItems:"center"},
  postText:{color:INK.card,fontWeight:"900"},
  disabled:{opacity:0.65},
  error:{color:INK.card,backgroundColor:INK.red,borderRadius:10,padding:10,marginTop:9},
  empty:{color:INK.inkSoft,textAlign:"center",backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:14,padding:18,marginTop:10},
  commentCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:14,padding:13,marginTop:10},
  commentProfile:{flexDirection:"row",alignItems:"center"},
  avatar:{width:36,height:36,borderRadius:18,backgroundColor:INK.card},
  avatarFallback:{width:36,height:36,borderRadius:18,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.card,fontWeight:"900",fontSize:14},
  commentTextWrap:{marginLeft:9},
  name:{color:INK.ink,fontWeight:"900",fontSize:13},
  time:{color:INK.inkSoft,fontSize:10,marginTop:2},
  body:{color:INK.ink,fontSize:14,lineHeight:20,marginTop:10},
  commentActions:{flexDirection:"row",gap:15,marginTop:10},
  reportLink:{color:INK.inkSoft,fontSize:11,fontWeight:"800"},
  deleteLink:{color:INK.ink,fontSize:11,fontWeight:"800"},
  reportPanel:{backgroundColor:INK.card,borderRadius:12,padding:12,marginTop:11},
  reportTitle:{color:INK.ink,fontSize:13,fontWeight:"900"},
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:9},
  reasonButton:{borderColor:INK.ink,borderWidth:1,borderRadius:18,paddingHorizontal:10,paddingVertical:7},
  reasonActive:{backgroundColor:INK.blue,borderColor:INK.blue},
  reasonText:{color:INK.card,fontSize:10,fontWeight:"800"},
  reasonActiveText:{color:INK.card},
  reportActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:12},
  cancelButton:{paddingHorizontal:12,paddingVertical:9},
  cancelText:{color:INK.inkSoft,fontWeight:"800"},
  submitReportButton:{backgroundColor:INK.red,borderRadius:9,paddingHorizontal:13,paddingVertical:9},
  submitReportText:{color:INK.card,fontWeight:"900",fontSize:12}
});
