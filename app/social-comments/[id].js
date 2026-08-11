import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Linking,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import EndorseButton from "../../components/EndorseButton";
import CommentThread from "../../components/CommentThread";

function dateLabel(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
}

function listingRoute(review){
  if(review.target_type==="business") return `/business/${review.target_id}`;
  if(review.target_type==="property") return `/property/${review.target_id}`;
  if(review.target_type==="activity_club") return `/activity-clubs/${review.target_id}`;
  if(review.target_type==="event") return `/events/${review.target_id}`;
  if(review.target_type==="public_place") return `/places/${review.target_id}`;
  return null;
}

export default function VideoReviewComments(){
  const params=useLocalSearchParams();
  const reviewId=Array.isArray(params.id) ? params.id[0] : params.id;
  const [review,setReview]=useState(null);
  const [video,setVideo]=useState(null);
  const [profile,setProfile]=useState(null);
  const [likeCount,setLikeCount]=useState(0);
  const [viewerLiked,setViewerLiked]=useState(false);
  const [viewerId,setViewerId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    setViewerId(user?.id || null);
    const {data:reviewRow,error:reviewError}=await supabase
      .from("explorer_reviews")
      .select("*")
      .eq("id",reviewId)
      .eq("status","published")
      .maybeSingle();

    if(reviewError || !reviewRow){
      setError("This video review is unavailable.");
      setLoading(false);
      return;
    }

    const [mediaResult,profileResult,countResult]=await Promise.all([
      supabase.from("review_media").select("*").eq("review_id",reviewId).eq("media_type","video").eq("moderation_status","published").maybeSingle(),
      supabase.from("profiles").select("id,full_name,profile_photo").eq("id",reviewRow.user_id).maybeSingle(),
      supabase.from("social_likes").select("id",{count:"exact",head:true}).eq("target_type","review").eq("target_id",reviewId)
    ]);

    // A video is no longer required. Packet 11 opened comments to every
    // published review -- the old rule meant the reviews most people write,
    // text and photos, could be endorsed but never answered.
    let liked=false;
    if(user){
      const {data}=await supabase
        .from("social_likes")
        .select("id")
        .eq("user_id",user.id)
        .eq("target_type","review")
        .eq("target_id",reviewId)
        .maybeSingle();
      liked=!!data;
    }

    setReview(reviewRow);
    setVideo(mediaResult.data || null);
    setProfile(profileResult.data || null);
    setLikeCount(Number(countResult.count || 0));
    setViewerLiked(liked);
    setLoading(false);
  },[reviewId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;
  if(error || !review) return <View style={styles.center}><Text style={styles.errorTitle}>Review unavailable</Text><Text style={styles.errorText}>{error}</Text></View>;

  const route=listingRoute(review);

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.profileRow} onPress={()=>router.push(`/profile/${review.user_id}`)}>
        {profile?.profile_photo
          ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
          : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>
        }
        <View style={styles.profileText}>
          <Text style={styles.name}>{profile?.full_name || "Explorer"}</Text>
          <Text style={styles.date}>Review · {dateLabel(review.created_at)}</Text>
        </View>
      </Pressable>

      <View style={styles.card}>
        {!!video && <Pressable style={styles.videoWrap} onPress={()=>Linking.openURL(video.media_url)}>
          {video.thumbnail_url || review.target_image_url
            ? <Image source={{uri:video.thumbnail_url || review.target_image_url}} style={styles.poster}/>
            : <View style={styles.videoFallback}/>
          }
          <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
          <Text style={styles.duration}>{Math.ceil(Number(video.duration_seconds || 0)) || "≤30"}s</Text>
        </Pressable>}

        <Text style={styles.rating}>{"★".repeat(review.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-review.rating)}</Text></Text>
        {!!review.title && <Text style={styles.title}>{review.title}</Text>}
        <Text style={styles.comment}>{review.comment}</Text>

        {!!review.verified_qr && <Text style={styles.verified}>✓ Verified on-site review</Text>}

        {!!route && (
          <Pressable style={styles.placeCard} onPress={()=>router.push(route)}>
            {review.target_image_url ? <Image source={{uri:review.target_image_url}} style={styles.placeImage}/> : <View style={styles.placeFallback}><Text>📍</Text></View>}
            <View style={styles.placeText}>
              <Text style={styles.placeEyebrow}>REVIEWED PLACE</Text>
              <Text style={styles.placeName}>{review.target_name}</Text>
            </View>
            <Text style={styles.placeArrow}>›</Text>
          </Pressable>
        )}

        <View style={styles.actionRow}>
          <EndorseButton reviewId={review.id} ownerId={review.user_id} viewerId={viewerId} initialCount={likeCount} initialEndorsed={viewerLiked}/>
        </View>
      </View>

      <CommentThread targetType="review" targetId={review.id} ownerId={review.user_id}/>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},
  errorTitle:{color:"white",fontSize:22,fontWeight:"900"},
  errorText:{color:"#aaaab3",textAlign:"center",marginTop:7},
  profileRow:{flexDirection:"row",alignItems:"center",marginBottom:13},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#303036"},
  avatarFallback:{width:48,height:48,borderRadius:24,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontWeight:"900",fontSize:19},
  profileText:{marginLeft:11},
  name:{color:"white",fontSize:16,fontWeight:"900"},
  date:{color:"#878790",fontSize:11,marginTop:3},
  card:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:17,padding:12},
  videoWrap:{height:370,borderRadius:13,overflow:"hidden",backgroundColor:"#0c0c0e",alignItems:"center",justifyContent:"center"},
  poster:{width:"100%",height:"100%"},
  videoFallback:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"#111114"},
  playCircle:{position:"absolute",width:62,height:62,borderRadius:31,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  playIcon:{color:"white",fontSize:25,marginLeft:4},
  duration:{position:"absolute",right:9,bottom:9,color:"white",backgroundColor:"rgba(0,0,0,0.72)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:11,fontWeight:"900"},
  rating:{color:"#f5c542",fontSize:18,letterSpacing:1,marginTop:14},
  emptyStars:{color:"#55555e"},
  title:{color:"white",fontSize:20,fontWeight:"900",marginTop:9},
  comment:{color:"#d1d1d9",fontSize:15,lineHeight:22,marginTop:7},
  verified:{alignSelf:"flex-start",color:"#82dfa4",backgroundColor:"#123b25",borderColor:"#286640",borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:12,fontSize:10,fontWeight:"900"},
  placeCard:{flexDirection:"row",alignItems:"center",backgroundColor:"#29233b",borderColor:"#514474",borderWidth:1,borderRadius:13,padding:10,marginTop:14},
  placeImage:{width:50,height:50,borderRadius:10,backgroundColor:"#303036"},
  placeFallback:{width:50,height:50,borderRadius:10,backgroundColor:"#303036",alignItems:"center",justifyContent:"center"},
  placeText:{flex:1,marginLeft:10},
  placeEyebrow:{color:"#9f8fce",fontSize:9,fontWeight:"900",letterSpacing:0.7},
  placeName:{color:"white",fontWeight:"900",marginTop:3},
  placeArrow:{color:"#bca8ff",fontSize:27},
  actionRow:{flexDirection:"row",marginTop:14}
});
