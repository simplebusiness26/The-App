import React from "react";
import {Image,Linking,Pressable,StyleSheet,Text,View} from "react-native";
import {router} from "expo-router";
import LikeButton from "./LikeButton";
import EndorseButton from "./EndorseButton";
import {reasonsFor} from "../utils/trending";
import {INK} from "../utils/tokens";

// One feed row, lifted out of app/feed.js so it can be memoised.
//
// WHY IT MOVED
// The feed renders a page of these and re-renders on every state change on the
// screen -- a page arriving, a refresh starting, an error clearing. Inline in
// the parent's .map() every row rebuilt every time, and each rebuild handed
// LikeButton and EndorseButton fresh props, which re-ran their resync effects
// across the whole list. React.memo on a module-level component is what stops
// that; a component defined inside the screen body could not be memoised at all
// because it would be a new type on every render.
//
// The comparison is deliberately narrow. A feed row is immutable apart from its
// own like state, which the buttons own, so only the identity, the counts, the
// viewer and the reasons can change what this draws.

export function timeLabel(value){
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

export function listingRoute(item){
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

function FeedCard({item,viewerId,onOpen,onComments}){
  const isMoment=item.item_type==="moment";
  const isMemory=item.item_type==="memory";
  const isReview=item.item_type==="review";
  const hasVideo=isReview && item.media_type==="video";
  const canComment=isMoment || isMemory || hasVideo;
  const route=listingRoute(item);
  // Computed once. In the old inline version this ran twice per card per
  // render, allocating a Set and running a sort each time.
  const reasons=reasonsFor(item);

  return(
    <View style={styles.card}>
      <Pressable style={styles.actorRow} onPress={()=>router.push(`/profile/${item.actor_id}`)}>
        <Avatar item={item}/>
        <View style={styles.actorText}>
          <Text style={styles.actorName}>{item.actor_name || "Explorer"}</Text>
          {/*
            Four kinds now. "kept a Memory" rather than "shared" -- a
            Memory is something somebody keeps, and the word is what
            separates it from a Moment on a feed where both are a photo
            and a sentence.
          */}
          <Text style={styles.meta}>{isMoment ? "shared a Moment" : isMemory ? "kept a Memory" : isReview ? "posted a review" : "saved a favourite"} · {timeLabel(item.created_at)}</Text>
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
      {reasonsFor(item).length > 0 && (
        <View style={styles.reasonRow}>
          {reasons.map(reason=>(
            <Text key={reason} style={styles.reason}>{reason}</Text>
          ))}
        </View>
      )}

      <Pressable onPress={()=>onOpen(item)}>
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

        {/*
          A fixed height and no resizeMode meant every photo was cropped into a
          280px box and the row's height was known before the image arrived.
          Keeping the fixed box is what stops the list jumping while you scroll,
          which matters more on a virtualised list than it did on a ScrollView:
          FlatList measures rows to decide what to keep mounted.
        */}
        {!!item.media_url && item.media_type==="image" && <Image source={{uri:item.media_url}} style={styles.media} resizeMode="cover"/>}

        {!!item.media_url && item.media_type==="video" && (
          <Pressable style={styles.videoWrap} onPress={()=>Linking.openURL(item.media_url)}>
            {item.thumbnail_url || item.target_image_url
              ? <Image source={{uri:item.thumbnail_url || item.target_image_url}} style={styles.videoPoster} resizeMode="cover"/>
              : <View style={styles.videoFallback}/>
            }
            <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
            <Text style={styles.duration}>{Math.ceil(Number(item.duration_seconds || 0)) || "≤30"}s</Text>
          </Pressable>
        )}

        {!item.media_url && !!item.target_image_url && <Image source={{uri:item.target_image_url}} style={styles.media} resizeMode="cover"/>}
      </Pressable>

      {!!item.verified_qr && <Text style={styles.verified}>✓ Verified on-site review</Text>}

      {(isMoment || isMemory || isReview) && (
        <View style={styles.actionRow}>
          {isMoment || isMemory ? (
            /* Like, not Useful. Useful endorses a review and pays its
               author a point; a Moment or a Memory just gets liked. */
            <LikeButton
              targetType={isMemory ? "memory" : "moment"}
              targetId={item.item_id}
              viewerId={viewerId}
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
            <Pressable style={styles.commentButton} onPress={()=>onComments(item)}>
              <Text style={styles.commentIcon}>💬</Text>
              <Text style={styles.commentText}>{Number(item.comment_count || 0)}</Text>
            </Pressable>
          )}
          {!!route && <Pressable style={styles.placeButton} onPress={()=>router.push(route)}><Text style={styles.placeText}>Open place</Text></Pressable>}
        </View>
      )}
    </View>
  );
}

export default React.memo(FeedCard,(before,after)=>(
  before.item.item_id===after.item.item_id &&
  before.item.item_type===after.item.item_type &&
  before.item.like_count===after.item.like_count &&
  before.item.comment_count===after.item.comment_count &&
  before.item.viewer_liked===after.item.viewer_liked &&
  before.viewerId===after.viewerId
));

const styles=StyleSheet.create({
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8},
  reason:{color:INK.card,backgroundColor:INK.blue,borderRadius:20,paddingHorizontal:9,paddingVertical:4,fontSize:11,fontWeight:"800",overflow:"hidden"},
  card:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:17,padding:15,marginBottom:13},
  actorRow:{flexDirection:"row",alignItems:"center"},
  avatar:{width:45,height:45,borderRadius:23,backgroundColor:INK.card},
  avatarFallback:{width:45,height:45,borderRadius:23,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.card,fontWeight:"900",fontSize:18},
  actorText:{flex:1,marginLeft:11},
  actorName:{color:INK.ink,fontSize:15,fontWeight:"900"},
  meta:{color:INK.inkSoft,fontSize:11,marginTop:3},
  caption:{color:INK.ink,fontSize:15,lineHeight:22,marginTop:14},
  rating:{color:INK.ink,fontSize:17,letterSpacing:1,marginTop:12},
  emptyStars:{color:INK.ink},
  targetPill:{alignSelf:"flex-start",maxWidth:"100%",flexDirection:"row",alignItems:"center",backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:7,marginTop:12},
  targetIcon:{fontSize:12,marginRight:5},
  targetText:{color:INK.card,fontWeight:"800",fontSize:12,flexShrink:1},
  media:{width:"100%",height:280,borderRadius:13,backgroundColor:INK.card,marginTop:13},
  videoWrap:{height:280,borderRadius:13,overflow:"hidden",backgroundColor:INK.paper,marginTop:13,alignItems:"center",justifyContent:"center"},
  videoPoster:{width:"100%",height:"100%"},
  videoFallback:{position:"absolute",inset:0,backgroundColor:INK.paper},
  playCircle:{position:"absolute",width:58,height:58,borderRadius:29,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  playIcon:{color:INK.ink,fontSize:23,marginLeft:3},
  duration:{position:"absolute",right:9,bottom:9,color:INK.ink,backgroundColor:"rgba(0,0,0,0.72)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:11,fontWeight:"900"},
  verified:{alignSelf:"flex-start",color:INK.card,backgroundColor:INK.green,borderColor:INK.green,borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:12,fontSize:10,fontWeight:"900"},
  actionRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:14},
  commentButton:{flexDirection:"row",alignItems:"center",gap:6,minHeight:38,paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink},
  commentIcon:{fontSize:14},
  commentText:{color:INK.ink,fontWeight:"900",fontSize:12},
  placeButton:{marginLeft:"auto",paddingHorizontal:10,paddingVertical:9},
  placeText:{color:INK.blue,fontSize:12,fontWeight:"900"}
});
