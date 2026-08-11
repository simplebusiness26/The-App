import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Linking,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import LikeButton from "../components/LikeButton";
import EndorseButton from "../components/EndorseButton";
import {reasonsFor} from "../utils/trending";

function timeLabel(value){
  if(!value) return "";
  const date=new Date(value);
  const seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000));
  if(seconds<60) return "Just now";
  const minutes=Math.floor(seconds/60);
  if(minutes<60) return `${minutes}m`;
  const hours=Math.floor(minutes/60);
  if(hours<24) return `${hours}h`;
  const days=Math.floor(hours/24);
  if(days<7) return `${days}d`;
  return date.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
}

function listingRoute(item){
  if(item.target_type==="business") return `/business/${item.target_id}`;
  if(item.target_type==="property") return `/property/${item.target_id}`;
  if(item.target_type==="activity_club") return `/activity-clubs/${item.target_id}`;
  if(item.target_type==="event") return `/events/${item.target_id}`;
  return null;
}

function Avatar({item}){
  if(item.actor_photo) return <Image source={{uri:item.actor_photo}} style={styles.avatar}/>;
  return <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{item.actor_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>;
}

export default function Feed(){
  const [items,setItems]=useState([]);
  const [viewerId,setViewerId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }
    setViewerId(user.id);

    const {data,error:feedError}=await supabase.rpc("get_explorer_social_feed",{
      p_limit:40,
      p_offset:0
    });

    if(feedError){
      console.log(feedError);
      setError("Your feed could not be loaded.");
      setItems([]);
    }else{
      setItems(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  function refresh(){
    setRefreshing(true);
    load(false);
  }

  function openItem(item){
    if(item.item_type==="moment"){
      router.push(`/moments/${item.item_id}`);
      return;
    }

    const route=listingRoute(item);
    if(route) router.push(route);
  }

  function openComments(item){
    if(item.item_type==="moment") router.push(`/moments/${item.item_id}`);
    else router.push({pathname:`/social-comments/${item.item_id}`,params:{type:"review"}});
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#bca8ff"/>}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>YOUR EXPLORER COMMUNITY</Text>
          <Text style={styles.title}>Feed</Text>
          <Text style={styles.subtitle}>Reviews, favourites and Moments from the Explorers you follow.</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.createButton} onPress={()=>router.push("/moments/create")}>
          <Text style={styles.createText}>＋ New Moment</Text>
        </Pressable>
        <Pressable style={styles.findButton} onPress={()=>router.push("/explorers")}>
          <Text style={styles.findText}>Find Explorers</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator size="large" color="#bca8ff" style={styles.loader}/>} 

      {!loading && !!error && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Feed unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      )}

      {!loading && !error && items.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧭</Text>
          <Text style={styles.emptyTitle}>Build your Explorer feed</Text>
          <Text style={styles.emptyText}>Follow Explorers to see their reviews, favourite places and Moments here.</Text>
          <Pressable style={styles.emptyButton} onPress={()=>router.push("/explorers")}><Text style={styles.emptyButtonText}>Find Explorers</Text></Pressable>
        </View>
      )}

      {!loading && !error && items.map(item=>{
        const isMoment=item.item_type==="moment";
        const isReview=item.item_type==="review";
        const hasVideo=isReview && item.media_type==="video";
        const canComment=isMoment || hasVideo;
        const route=listingRoute(item);

        return(
          <View key={`${item.item_type}-${item.item_id}`} style={styles.card}>
            <Pressable style={styles.actorRow} onPress={()=>router.push(`/profile/${item.actor_id}`)}>
              <Avatar item={item}/>
              <View style={styles.actorText}>
                <Text style={styles.actorName}>{item.actor_name || "Explorer"}</Text>
                <Text style={styles.meta}>{isMoment ? "shared a Moment" : isReview ? "posted a review" : "saved a favourite"} · {timeLabel(item.created_at)}</Text>
              </View>
            </Pressable>

            {/*
              Packet 8f2. "Why am I seeing this?" as a list rather than one
              lossy label -- an item can be here because you follow the poster
              AND because it is at a place you follow, and collapsing that to a
              single reason throws away the more interesting half.

              reasonsFor() returns [] when the row has no source_reasons, which
              is the case until the 8f2 migration is applied. The row simply
              shows nothing rather than breaking or inventing a reason.
            */}
            {reasonsFor(item).length>0 && (
              <View style={styles.reasonRow}>
                {reasonsFor(item).map(reason=>(
                  <Text key={reason} style={styles.reason}>{reason}</Text>
                ))}
              </View>
            )}

            <Pressable onPress={()=>openItem(item)}>
              {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

              {!!item.rating && (
                <Text style={styles.rating}>{"★".repeat(item.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-item.rating)}</Text></Text>
              )}

              {!!item.target_name && (
                <View style={styles.targetPill}>
                  <Text style={styles.targetIcon}>📍</Text>
                  <Text style={styles.targetText} numberOfLines={1}>{item.target_name}</Text>
                </View>
              )}

              {!!item.media_url && item.media_type==="image" && <Image source={{uri:item.media_url}} style={styles.media}/>} 

              {!!item.media_url && item.media_type==="video" && (
                <Pressable style={styles.videoWrap} onPress={()=>Linking.openURL(item.media_url)}>
                  {item.thumbnail_url || item.target_image_url
                    ? <Image source={{uri:item.thumbnail_url || item.target_image_url}} style={styles.videoPoster}/>
                    : <View style={styles.videoFallback}/>
                  }
                  <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
                  <Text style={styles.duration}>{Math.ceil(Number(item.duration_seconds || 0)) || "≤30"}s</Text>
                </Pressable>
              )}

              {!item.media_url && !!item.target_image_url && <Image source={{uri:item.target_image_url}} style={styles.media}/>} 
            </Pressable>

            {!!item.verified_qr && <Text style={styles.verified}>✓ Verified on-site review</Text>}

            {(isMoment || isReview) && (
              <View style={styles.actionRow}>
                {isMoment ? (
                  <LikeButton
                    targetType="moment"
                    targetId={item.item_id}
                    initialCount={item.like_count}
                    initialLiked={item.viewer_liked}
                  />
                ) : (
                  <EndorseButton
                    reviewId={item.item_id}
                    ownerId={item.actor_id}
                    viewerId={viewerId}
                    initialCount={item.like_count}
                    initialEndorsed={item.viewer_liked}
                  />
                )}
                {canComment && (
                  <Pressable style={styles.commentButton} onPress={()=>openComments(item)}>
                    <Text style={styles.commentIcon}>💬</Text>
                    <Text style={styles.commentText}>{Number(item.comment_count || 0)}</Text>
                  </Pressable>
                )}
                {!!route && <Pressable style={styles.placeButton} onPress={()=>router.push(route)}><Text style={styles.placeText}>Open place</Text></Pressable>}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8},
  reason:{color:"#bca8ff",backgroundColor:"#241d3a",borderRadius:20,paddingHorizontal:9,paddingVertical:4,fontSize:11,fontWeight:"800",overflow:"hidden"},
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  headingRow:{marginBottom:16},
  headingText:{flex:1},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:"white",fontSize:32,fontWeight:"900",marginTop:4},
  subtitle:{color:"#a9a9b2",fontSize:14,lineHeight:21,marginTop:6,maxWidth:540},
  quickActions:{flexDirection:"row",gap:10,marginBottom:17},
  createButton:{flex:1,backgroundColor:"#3212b6",borderRadius:13,paddingVertical:13,alignItems:"center"},
  createText:{color:"white",fontWeight:"900"},
  findButton:{flex:1,backgroundColor:"#29292e",borderColor:"#484850",borderWidth:1,borderRadius:13,paddingVertical:13,alignItems:"center"},
  findText:{color:"#dedee5",fontWeight:"900"},
  loader:{marginTop:45},
  card:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:17,padding:15,marginBottom:13},
  actorRow:{flexDirection:"row",alignItems:"center"},
  avatar:{width:45,height:45,borderRadius:23,backgroundColor:"#303036"},
  avatarFallback:{width:45,height:45,borderRadius:23,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontWeight:"900",fontSize:18},
  actorText:{flex:1,marginLeft:11},
  actorName:{color:"white",fontSize:15,fontWeight:"900"},
  meta:{color:"#8f8f99",fontSize:11,marginTop:3},
  caption:{color:"#ddddE5",fontSize:15,lineHeight:22,marginTop:14},
  rating:{color:"#f5c542",fontSize:17,letterSpacing:1,marginTop:12},
  emptyStars:{color:"#55555e"},
  targetPill:{alignSelf:"flex-start",maxWidth:"100%",flexDirection:"row",alignItems:"center",backgroundColor:"#29233b",borderColor:"#524674",borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:7,marginTop:12},
  targetIcon:{fontSize:12,marginRight:5},
  targetText:{color:"#cbbbf6",fontWeight:"800",fontSize:12,flexShrink:1},
  media:{width:"100%",height:280,borderRadius:13,backgroundColor:"#303036",marginTop:13},
  videoWrap:{height:280,borderRadius:13,overflow:"hidden",backgroundColor:"#0c0c0e",marginTop:13,alignItems:"center",justifyContent:"center"},
  videoPoster:{width:"100%",height:"100%"},
  videoFallback:{position:"absolute",inset:0,backgroundColor:"#111114"},
  playCircle:{position:"absolute",width:58,height:58,borderRadius:29,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  playIcon:{color:"white",fontSize:23,marginLeft:3},
  duration:{position:"absolute",right:9,bottom:9,color:"white",backgroundColor:"rgba(0,0,0,0.72)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:11,fontWeight:"900"},
  verified:{alignSelf:"flex-start",color:"#82dfa4",backgroundColor:"#123b25",borderColor:"#286640",borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:12,fontSize:10,fontWeight:"900"},
  actionRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:14},
  commentButton:{flexDirection:"row",alignItems:"center",gap:6,minHeight:38,paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:"#29292e",borderWidth:1,borderColor:"#45454c"},
  commentIcon:{fontSize:14},
  commentText:{color:"#d4d4dc",fontWeight:"900",fontSize:12},
  placeButton:{marginLeft:"auto",paddingHorizontal:10,paddingVertical:9},
  placeText:{color:"#bca8ff",fontSize:12,fontWeight:"900"},
  emptyCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:17,padding:27,alignItems:"center",marginTop:18},
  emptyIcon:{fontSize:36},
  emptyTitle:{color:"white",fontSize:20,fontWeight:"900",textAlign:"center",marginTop:9},
  emptyText:{color:"#9d9da6",lineHeight:21,textAlign:"center",marginTop:7},
  emptyButton:{backgroundColor:"#3212b6",borderRadius:11,paddingHorizontal:18,paddingVertical:11,marginTop:16},
  emptyButtonText:{color:"white",fontWeight:"900"}
});
