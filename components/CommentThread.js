import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Action,Chip,Empty,Field,fieldInputStyle,Frame,Glyph,MONO,Notice,Panel,SectionRule} from "./instrument";

const REPORT_REASONS=[
  {key:"spam",label:"Spam"},
  {key:"harassment",label:"Harassment"},
  {key:"inappropriate",label:"Inappropriate"},
  {key:"false_information",label:"False information"},
  {key:"other",label:"Other"}
];

// What people said back, under the thing they said it about.
//
// A comment is the one place in this app where the body face does all the work:
// somebody wrote it. Everything AROUND it is measured -- how many there are,
// how long ago, how many characters are left -- and all of that is mono, which
// is what stops a thread reading as a document.
//
// The composer is a Field: an `inset` well cut into the panel, because the
// thing you type into should look cut into the housing rather than stuck on it.

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
  return(
    <Frame size={34} round style={styles.avatarFrame}>
      {profile?.profile_photo
        ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
        : <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
  );
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
      <SectionRule label="Comments" meta={String(comments.length)}/>

      <Panel style={styles.composer}>
        <Field label="Add a comment" hint={`${body.length}/500`} style={styles.composerField}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={user ? "Add a comment" : "Log in to comment"}
            placeholderTextColor={INK.readoutFaint}
            style={[fieldInputStyle,styles.input]}
            multiline
            maxLength={500}
            editable={!!user && !working}
            textAlignVertical="top"
          />
        </Field>
        <Action
          kind="primary"
          glyph="send"
          label="Post"
          loading={working}
          disabled={working}
          style={styles.post}
          onPress={addComment}
        />
      </Panel>

      {!!error && <Notice tone="dispute" label="Not posted">{error}</Notice>}
      {loading && <ActivityIndicator color={INK.readoutSoft} style={styles.loader}/>}
      {!loading && comments.length===0 && (
        <Empty
          glyph="comment"
          title="No comments yet"
          instruction="Start the conversation. Say what you thought of it."
        />
      )}

      {!loading && comments.map(comment=>{
        const canDelete=!!user && (user.id===comment.user_id || user.id===ownerId);
        const canReport=!!user && user.id!==comment.user_id;
        return(
          <Panel key={comment.id} style={styles.commentCard}>
            <Pressable
              style={styles.commentProfile}
              accessibilityRole="button"
              accessibilityLabel={`Open ${comment.profile?.full_name || "Explorer"}`}
              onPress={()=>router.push(`/profile/${comment.user_id}`)}
            >
              <Avatar profile={comment.profile}/>
              <View style={styles.commentTextWrap}>
                <Text style={styles.name} numberOfLines={1}>{comment.profile?.full_name || "Explorer"}</Text>
                <Text style={styles.time}>{timeLabel(comment.created_at).toUpperCase()}</Text>
              </View>
            </Pressable>

            <Text style={styles.body}>{comment.body}</Text>

            <View style={styles.commentActions}>
              {canReport && (
                <Pressable
                  style={styles.link}
                  accessibilityRole="button"
                  accessibilityLabel="Report this comment"
                  onPress={()=>setReportTarget(reportTarget?.id===comment.id ? null : comment)}
                >
                  <Glyph name="flag" size={12} colour={INK.readoutFaint}/>
                  <Text style={styles.linkText}>Report</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable
                  style={styles.link}
                  disabled={working}
                  accessibilityRole="button"
                  accessibilityLabel="Delete this comment"
                  onPress={()=>deleteComment(comment)}
                >
                  <Glyph name="trash" size={12} colour={INK.readoutSoft}/>
                  <Text style={[styles.linkText,styles.deleteText]}>Delete</Text>
                </Pressable>
              )}
            </View>

            {reportTarget?.id===comment.id && (
              <View style={styles.reportPanel}>
                <Text style={styles.reportTitle}>Why are you reporting this comment?</Text>
                <View style={styles.reasonRow}>
                  {REPORT_REASONS.map(reason=>(
                    <Chip
                      key={reason.key}
                      label={reason.label}
                      selected={reportReason===reason.key}
                      onPress={()=>setReportReason(reason.key)}
                    />
                  ))}
                </View>
                <View style={styles.reportActions}>
                  <Action kind="quiet" label="Cancel" style={styles.reportAction} onPress={()=>setReportTarget(null)}/>
                  <Action kind="danger" glyph="flag" label="Submit report" style={styles.reportAction} disabled={working} onPress={submitReport}/>
                </View>
              </View>
            )}
          </Panel>
        );
      })}
    </View>
  );
}

const styles=StyleSheet.create({
  section:{marginTop:4},

  composer:{padding:13},
  composerField:{marginBottom:10},
  input:{minHeight:78,lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight},
  post:{alignSelf:"flex-end",minWidth:118},

  loader:{marginVertical:20},

  commentCard:{padding:13,marginTop:9},
  commentProfile:{flexDirection:"row",alignItems:"center"},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:34,height:34,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:14},
  commentTextWrap:{marginLeft:10,flex:1,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  time:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase",marginTop:3
  },
  body:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,marginTop:10},

  commentActions:{flexDirection:"row",gap:16,marginTop:11},
  link:{flexDirection:"row",alignItems:"center",gap:5,minHeight:32},
  linkText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase"
  },
  deleteText:{color:INK.readoutSoft},

  reportPanel:{marginTop:12,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  reportTitle:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight},
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10},
  reportActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:13},
  reportAction:{minWidth:110}
});
