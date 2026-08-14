import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Linking,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import SocialImage from "../../components/SocialImage";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import LikeButton from "../../components/LikeButton";
import CommentThread from "../../components/CommentThread";
import {INK} from "../../utils/tokens";

const REPORT_REASONS=[
  {key:"spam",label:"Spam"},
  {key:"harassment",label:"Harassment"},
  {key:"inappropriate",label:"Inappropriate"},
  {key:"false_information",label:"False information"},
  {key:"other",label:"Other"}
];

function listingRoute(moment){
  if(moment.target_type==="business") return `/business/${moment.target_id}`;
  if(moment.target_type==="property") return `/property/${moment.target_id}`;
  if(moment.target_type==="activity_club") return `/activity-clubs/${moment.target_id}`;
  if(moment.target_type==="event") return `/events/${moment.target_id}`;
  if(moment.target_type==="public_place") return `/places/${moment.target_id}`;
  return null;
}

function storagePath(url){
  const marker="/storage/v1/object/public/social-media/";
  const index=String(url || "").indexOf(marker);
  if(index<0) return null;
  return decodeURIComponent(String(url).slice(index+marker.length));
}

function dateLabel(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

export default function MomentDetail(){
  const params=useLocalSearchParams();
  const momentId=Array.isArray(params.id) ? params.id[0] : params.id;
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [moment,setMoment]=useState(null);
  const [profile,setProfile]=useState(null);
  const [likeCount,setLikeCount]=useState(0);
  const [viewerLiked,setViewerLiked]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reportReason,setReportReason]=useState("inappropriate");

  const load=useCallback(async()=>{
    if(!momentId){setError("Moment not found.");setLoading(false);return;}
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    const {data:momentRow,error:momentError}=await supabase
      .from("explorer_moments")
      .select("*")
      .eq("id",momentId)
      .maybeSingle();

    if(momentError || !momentRow || momentRow.status!=="published"){
      setError("This Moment is unavailable.");
      setMoment(null);
      setLoading(false);
      return;
    }

    const [profileResult,countResult]=await Promise.all([
      supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").eq("id",momentRow.user_id).maybeSingle(),
      supabase.from("social_likes").select("id",{count:"exact",head:true}).eq("target_type","moment").eq("target_id",momentId)
    ]);

    let liked=false;
    if(currentUser){
      const {data}=await supabase
        .from("social_likes")
        .select("id")
        .eq("user_id",currentUser.id)
        .eq("target_type","moment")
        .eq("target_id",momentId)
        .maybeSingle();
      liked=!!data;
    }

    setMoment(momentRow);
    setProfile(profileResult.data || null);
    setLikeCount(Number(countResult.count || 0));
    setViewerLiked(liked);
    setLoading(false);
  },[momentId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function deleteMoment(){
    if(working || !user || user.id!==moment?.user_id) return;
    setWorking(true);

    const {error:deleteError}=await supabase
      .from("explorer_moments")
      .delete()
      .eq("id",moment.id)
      .eq("user_id",user.id);

    if(deleteError){
      showFeedback(deleteError.message,"error","Moment not deleted");
      setWorking(false);
      return;
    }

    const path=storagePath(moment.media_url);
    if(path) await supabase.storage.from("social-media").remove([path]);

    showFeedback("The Moment and its interactions were removed.","success","Moment deleted");
    router.replace("/feed");
  }

  async function reportMoment(){
    if(working) return;
    if(!user){router.push("/auth/login");return;}
    if(user.id===moment?.user_id) return;

    setWorking(true);
    const {error:reportError}=await supabase
      .from("social_reports")
      .insert({
        reporter_id:user.id,
        target_type:"moment",
        target_id:moment.id,
        reason:reportReason,
        details:"",
        status:"open"
      });

    if(reportError){
      if(String(reportError.code)==="23505") showFeedback("You have already reported this Moment.","info","Already reported");
      else showFeedback(reportError.message,"error","Report not sent");
    }else{
      showFeedback("This Moment has been sent for review.","success","Report submitted");
    }

    setWorking(false);
    setShowReport(false);
  }

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.blue}/></View>;
  if(error || !moment) return <View style={styles.center}><Text style={styles.errorTitle}>Moment unavailable</Text><Text style={styles.errorText}>{error}</Text></View>;

  const isOwner=!!user && user.id===moment.user_id;
  const route=listingRoute(moment);

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.profileRow} onPress={()=>router.push(`/profile/${moment.user_id}`)}>
        {profile?.profile_photo
          ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
          : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>
        }
        <View style={styles.profileText}>
          {/* An official Moment says the listing's name first and the person
              who published it second. user_id is still the author -- the
              profile link below goes to them, not to the listing. */}
          <Text style={styles.name}>
            {moment.actor_type && moment.actor_type!=="explorer"
              ? moment.target_name || profile?.full_name || "Explorer"
              : profile?.full_name || "Explorer"}
          </Text>
          <Text style={styles.date}>
            {moment.actor_type && moment.actor_type!=="explorer"
              ? `Official update · ${dateLabel(moment.created_at)}`
              : dateLabel(moment.created_at)}
          </Text>
        </View>
        {moment.visibility==="friends" && (
          <Text style={styles.audienceBadge} accessibilityLabel="Visible to friends only">FRIENDS</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        {moment.media_type==="image" ? (
          <SocialImage uri={moment.media_url} style={styles.media}/>
        ) : (
          <Pressable style={styles.videoWrap} onPress={()=>Linking.openURL(moment.media_url)}>
            {moment.thumbnail_url || moment.target_image_url
              ? <SocialImage uri={moment.thumbnail_url || moment.target_image_url} style={styles.media}/>
              : <View style={styles.videoFallback}/>
            }
            <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
            <Text style={styles.duration}>{Math.ceil(Number(moment.duration_seconds || 0))}s</Text>
          </Pressable>
        )}

        {!!moment.caption && <Text style={styles.caption}>{moment.caption}</Text>}

        {!!moment.target_name && (
          <Pressable style={styles.placeCard} disabled={!route} onPress={()=>route && router.push(route)}>
            {moment.target_image_url ? <SocialImage uri={moment.target_image_url} style={styles.placeImage}/> : <View style={styles.placeFallback}><Text>📍</Text></View>}
            <View style={styles.placeText}>
              <Text style={styles.placeEyebrow}>ATTACHED PLACE</Text>
              <Text style={styles.placeName}>{moment.target_name}</Text>
            </View>
            <Text style={styles.placeArrow}>›</Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <LikeButton targetType="moment" targetId={moment.id} viewerId={user?.id || null} initialCount={likeCount} initialLiked={viewerLiked}/>
          {!isOwner && <Pressable style={styles.secondaryButton} onPress={()=>setShowReport(current=>!current)}><Text style={styles.secondaryText}>Report</Text></Pressable>}
          {isOwner && <Pressable style={styles.deleteButton} onPress={()=>setConfirmDelete(true)}><Text style={styles.deleteText}>Delete</Text></Pressable>}
        </View>

        {showReport && !isOwner && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Why are you reporting this Moment?</Text>
            <View style={styles.reasonRow}>
              {REPORT_REASONS.map(reason=>(
                <Pressable key={reason.key} style={[styles.reasonButton,reportReason===reason.key && styles.reasonActive]} onPress={()=>setReportReason(reason.key)}>
                  <Text style={[styles.reasonText,reportReason===reason.key && styles.reasonActiveText]}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.panelActions}>
              <Pressable style={styles.cancelButton} onPress={()=>setShowReport(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.reportButton} disabled={working} onPress={reportMoment}>{working?<ActivityIndicator color={INK.ink} size="small"/>:<Text style={styles.reportText}>Submit report</Text>}</Pressable>
            </View>
          </View>
        )}

        {confirmDelete && isOwner && (
          <View style={styles.deletePanel}>
            <Text style={styles.panelTitle}>Delete this Moment?</Text>
            <Text style={styles.panelBody}>Its likes and comments will also be removed. This cannot be undone.</Text>
            <View style={styles.panelActions}>
              <Pressable style={styles.cancelButton} onPress={()=>setConfirmDelete(false)}><Text style={styles.cancelText}>Keep Moment</Text></Pressable>
              <Pressable style={styles.confirmDeleteButton} disabled={working} onPress={deleteMoment}>{working?<ActivityIndicator color={INK.ink} size="small"/>:<Text style={styles.reportText}>Delete permanently</Text>}</Pressable>
            </View>
          </View>
        )}
      </View>

      <CommentThread targetType="moment" targetId={moment.id} ownerId={moment.user_id}/>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  errorTitle:{color:INK.ink,fontSize:22,fontWeight:"900"},
  errorText:{color:INK.inkSoft,textAlign:"center",marginTop:7},
  profileRow:{flexDirection:"row",alignItems:"center",marginBottom:13},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:INK.card},
  avatarFallback:{width:48,height:48,borderRadius:24,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.card,fontWeight:"900",fontSize:19},
  profileText:{marginLeft:11},
  name:{color:INK.ink,fontSize:16,fontWeight:"900"},
  date:{color:INK.inkSoft,fontSize:11,marginTop:3},
  audienceBadge:{color:INK.card,backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:99,overflow:"hidden",paddingHorizontal:9,paddingVertical:4,fontSize:9,fontWeight:"900",letterSpacing:1},
  card:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:17,padding:12},
  media:{width:"100%",height:420,borderRadius:13,backgroundColor:INK.card},
  videoWrap:{height:420,borderRadius:13,overflow:"hidden",backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  videoFallback:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:INK.paper},
  playCircle:{position:"absolute",width:62,height:62,borderRadius:31,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  playIcon:{color:INK.ink,fontSize:25,marginLeft:4},
  duration:{position:"absolute",right:9,bottom:9,color:INK.ink,backgroundColor:"rgba(0,0,0,0.72)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:11,fontWeight:"900"},
  caption:{color:INK.ink,fontSize:16,lineHeight:23,paddingHorizontal:4,marginTop:14},
  placeCard:{flexDirection:"row",alignItems:"center",backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:13,padding:10,marginTop:14},
  placeImage:{width:50,height:50,borderRadius:10,backgroundColor:INK.card},
  placeFallback:{width:50,height:50,borderRadius:10,backgroundColor:INK.card,alignItems:"center",justifyContent:"center"},
  placeText:{flex:1,marginLeft:10},
  placeEyebrow:{color:INK.card,fontSize:9,fontWeight:"900",letterSpacing:0.7},
  placeName:{color:INK.card,fontWeight:"900",marginTop:3},
  placeArrow:{color:INK.card,fontSize:27},
  actions:{flexDirection:"row",alignItems:"center",gap:9,marginTop:14},
  secondaryButton:{marginLeft:"auto",paddingHorizontal:12,paddingVertical:9},
  secondaryText:{color:INK.inkSoft,fontWeight:"900",fontSize:12},
  deleteButton:{marginLeft:"auto",paddingHorizontal:12,paddingVertical:9},
  deleteText:{color:INK.ink,fontWeight:"900",fontSize:12},
  panel:{backgroundColor:INK.card,borderRadius:13,padding:13,marginTop:13},
  deletePanel:{backgroundColor:INK.card,borderColor:INK.red,borderWidth:2,borderRadius:13,padding:13,marginTop:13},
  panelTitle:{color:INK.ink,fontSize:14,fontWeight:"900"},
  panelBody:{color:INK.ink,fontSize:12,lineHeight:18,marginTop:6},
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10},
  reasonButton:{borderColor:INK.ink,borderWidth:1,borderRadius:18,paddingHorizontal:10,paddingVertical:7},
  reasonActive:{backgroundColor:INK.blue,borderColor:INK.blue},
  reasonText:{color:INK.card,fontSize:10,fontWeight:"800"},
  reasonActiveText:{color:INK.card},
  panelActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:13},
  cancelButton:{paddingHorizontal:12,paddingVertical:10},
  cancelText:{color:INK.inkSoft,fontWeight:"900",fontSize:12},
  reportButton:{minWidth:120,backgroundColor:INK.red,borderRadius:10,paddingHorizontal:13,paddingVertical:10,alignItems:"center"},
  confirmDeleteButton:{minWidth:135,backgroundColor:INK.red,borderRadius:10,paddingHorizontal:13,paddingVertical:10,alignItems:"center"},
  reportText:{color:INK.card,fontWeight:"900",fontSize:12}
});
