import React from "react";
import {Image,Linking,Pressable,StyleSheet,Text,View} from "react-native";
import SocialImage from "./SocialImage";
import {router} from "expo-router";
import LikeButton from "./LikeButton";
import EndorseButton from "./EndorseButton";
import {reasonsFor} from "../utils/trending";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Chip,Frame,Glyph,Meter,MONO,Panel} from "./instrument";

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

// The poster's face, in a machined frame rather than a soft circle. Every
// picture in this app sits in a Frame -- the same bracketed well the
// viewfinder uses -- which is what ties a feed of photographs back to the
// camera that took them.
function Avatar({item}){
  return(
    <Frame size={40} round style={styles.avatarFrame}>
      {item.actor_photo
        ? <Image source={{uri:item.actor_photo}} style={styles.avatar}/>
        : <Text style={styles.avatarLetter}>{item.actor_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
  );
}

// What the app knows about this row, set in the data face because the app
// worked it out: what kind of post it is, and how long ago.
function kindLabel(item){
  if(item.item_type==="moment") return "MOMENT";
  if(item.item_type==="memory") return "MEMORY";
  if(item.item_type==="review") return "REVIEW";
  return "FAVOURITE";
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
    <Panel style={styles.card}>
      {/* THE HEAD READOUT. A mono strip across the top saying what this is and
          when -- the same head every panel in the instrument carries, so a
          feed row, a map sheet and a place page all open the same way. */}
      <View style={styles.headRow}>
        <Text style={styles.headKind}>{kindLabel(item)}</Text>
        <View style={styles.headLine}/>
        <Text style={styles.headTime}>{timeLabel(item.created_at).toUpperCase()}</Text>
      </View>

      <Pressable style={styles.actorRow} onPress={()=>router.push(`/profile/${item.actor_id}`)}>
        <Avatar item={item}/>
        <View style={styles.actorText}>
          <Text style={styles.actorName} numberOfLines={1}>{item.actor_name || "Explorer"}</Text>
          {/*
            Four kinds now. "kept a Memory" rather than "shared" -- a
            Memory is something somebody keeps, and the word is what
            separates it from a Moment on a feed where both are a photo
            and a sentence. This half is a sentence about a person, so it
            stays in the body face while the head strip above stays mono.
          */}
          <Text style={styles.meta} numberOfLines={1}>{isMoment ? "shared a Moment" : isMemory ? "kept a Memory" : isReview ? "posted a review" : "saved a favourite"}</Text>
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

        They were filled blue pills. A reason is not a state a place is in,
        so it gets no state ink at all now -- it is a quiet mono chip, which
        is also what stopped the top of every card being the brightest thing
        on the screen.
      */}
      {reasons.length > 0 && (
        <View style={styles.reasonRow}>
          {reasons.map(reason=>(
            <Chip key={reason} label={reason} style={styles.reasonChip}/>
          ))}
        </View>
      )}

      <Pressable onPress={()=>onOpen(item)}>
        {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

        {/* A REVIEW SCORE IS A MEASUREMENT, SO IT IS READ OFF A SCALE.
            Five repeated ★ glyphs were a count you have to do yourself, in a
            character whose shape belongs to the system font. A ticked meter
            with the number beside it is the instrument's answer, and it is
            legible at a glance at any rating. */}
        {!!item.rating && (
          <View style={styles.ratingRow} accessibilityLabel={`Rated ${item.rating} out of 5`}>
            <Meter value={item.rating} max={5} width={92} tone="exists" label="RATED"/>
            <Text style={styles.ratingValue}>{item.rating}/5</Text>
          </View>
        )}

        {!!item.target_name && (
          <View style={styles.targetRow}>
            <Glyph name="pin" size={13} colour={INK.readoutFaint}/>
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
        {!!item.media_url && item.media_type==="image" && <SocialImage uri={item.media_url} style={styles.media} resizeMode="cover"/>}

        {!!item.media_url && item.media_type==="video" && (
          <Pressable style={styles.videoWrap} onPress={()=>Linking.openURL(item.media_url)}>
            {item.thumbnail_url || item.target_image_url
              ? <SocialImage uri={item.thumbnail_url || item.target_image_url} style={styles.videoPoster} resizeMode="cover"/>
              : <View style={styles.videoFallback}/>
            }
            <View style={styles.playCircle}><Glyph name="play" size={20} colour={INK.readout} weight={1.4}/></View>
            <Text style={styles.duration}>{Math.ceil(Number(item.duration_seconds || 0)) || "≤30"}S</Text>
          </Pressable>
        )}

        {!item.media_url && !!item.target_image_url && <SocialImage uri={item.target_image_url} style={styles.media} resizeMode="cover"/>}
      </Pressable>

      {/* Verified on-site is a fact the app checked, so it reads as a checked
          box on the housing rather than a green sticker. `agree` is a
          manager's colour and never appeared correctly here. */}
      {!!item.verified_qr && (
        <View style={styles.verifiedRow}>
          <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/>
          <Text style={styles.verifiedText}>VERIFIED ON-SITE</Text>
        </View>
      )}

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
            <Pressable style={styles.commentButton} onPress={()=>onComments(item)} accessibilityRole="button" accessibilityLabel="Comments">
              <Glyph name="comment" size={14} colour={INK.readoutSoft}/>
              <Text style={styles.commentText}>{Number(item.comment_count || 0)}</Text>
            </Pressable>
          )}
          {!!route && (
            <Pressable style={styles.placeButton} onPress={()=>router.push(route)} accessibilityRole="button" accessibilityLabel="Open place">
              <Text style={styles.placeText}>OPEN PLACE</Text>
              <Glyph name="forward" size={12} colour={INK.readout}/>
            </Pressable>
          )}
        </View>
      )}
    </Panel>
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

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // A panel, on the housing. The old card carried borderColor:INK.ink -- which
  // after the palette moved is the near-white READOUT colour, so every feed row
  // was outlined in white. That is what "recolouring the old design" looks like
  // when it goes wrong, and it is why this file was rebuilt rather than retinted.
  card:{padding:14,marginBottom:12},

  headRow:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:12},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headTime:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  actorRow:{flexDirection:"row",alignItems:"center"},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:40,height:40,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:16},
  actorText:{flex:1,marginLeft:11,minWidth:0},
  actorName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  meta:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:2},

  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:11},
  reasonChip:{minHeight:26,paddingVertical:4},

  caption:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*1.5,marginTop:12},

  ratingRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:12},
  ratingValue:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.lg},

  targetRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:11},
  targetText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,flexShrink:1},

  media:{width:"100%",height:250,borderRadius:SHAPE.radius.control,backgroundColor:INK.inset,marginTop:12,borderWidth:SHAPE.border,borderColor:INK.hairline},
  videoWrap:{height:250,borderRadius:SHAPE.radius.control,overflow:"hidden",backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,marginTop:12,alignItems:"center",justifyContent:"center"},
  videoPoster:{width:"100%",height:"100%"},
  videoFallback:{position:"absolute",inset:0,backgroundColor:INK.inset},
  // A ringed dial over the frame, not a black blob: the play control is the
  // same shape language as the shutter it was filmed with.
  playCircle:{
    position:"absolute",width:54,height:54,borderRadius:27,
    backgroundColor:"rgba(11,14,18,0.78)",borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    alignItems:"center",justifyContent:"center",paddingLeft:3
  },
  duration:{
    position:"absolute",right:8,bottom:8,...MONO_META,color:INK.readout,
    backgroundColor:"rgba(11,14,18,0.82)",borderWidth:SHAPE.border,borderColor:INK.hairline,
    paddingHorizontal:6,paddingVertical:3,borderRadius:4,fontSize:TYPE.data.sizes.sm,overflow:"hidden"
  },

  verifiedRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:12},
  verifiedText:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm},

  actionRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:14,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  commentButton:{
    flexDirection:"row",alignItems:"center",gap:6,minHeight:36,paddingHorizontal:11,paddingVertical:7,
    borderRadius:SHAPE.radius.control,backgroundColor:INK.panelRaised,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  commentText:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},
  placeButton:{marginLeft:"auto",flexDirection:"row",alignItems:"center",gap:6,minHeight:36,paddingHorizontal:10,paddingVertical:8},
  placeText:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md,fontWeight:"600"}
});
