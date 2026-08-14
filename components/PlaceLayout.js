import React,{useState} from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking
} from "react-native";
import {router} from "expo-router";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";
import ReviewActions from "./ReviewActions";

// Packet 5a: the shared place page.
//
// Sections, in the order the brief lists them: hero, title and verification,
// listing type, rating, primary action, essential info, photos, reviews,
// similar nearby.
//
// Deliberately NOT here: Directions, Book a table, Get tickets. The brief draws
// all three on this page and all three are Stage Four or Stage Five. CLAUDE.md
// cuts them explicitly and RULES.md bans placeholder UI for later stages, so
// the page ends without them rather than showing something dead.
//
// The type-specific parts arrive as slots rather than flags. A `kind` prop with
// branches inside would make this file grow a limb per page type, which is the
// duplication it was written to remove wearing a different coat.

export default function PlaceLayout({
  loading,
  loadingLabel="Loading...",
  error,
  name,
  typeLabel,
  verifiedLabel,
  description,
  photos=[],
  photosEmptyLabel="No photos uploaded yet",
  // A link-up has no photos and no reviews -- there is no linkup_reviews table
  // anywhere. Rendering "No reviews yet" on a page where reviewing is not a
  // thing would invite something the app cannot record, so the sections are
  // omitted rather than emptied. Capability flags, not page-type branches.
  showPhotos=true,
  showReviews=true,
  info=[],
  rating,
  // Clubs show members / spaces / score where a business shows average and
  // count. Supplying stats replaces the default pair rather than the layout
  // growing a branch per page type.
  stats,
  ownerAction,
  beforeActions,
  actions,
  // Everything a page type needs that the shared sections do not describe: an
  // event's manager box, a club's membership state, its sessions and its
  // announcements. Slots rather than flags, for the same reason as `actions`.
  beforeReviews,
  afterReviews,
  reviews=[],
  viewerId,
  viewerManagesThis=false,
  reviewsEmpty,
  similar=[],
  similarLabel="Similar nearby",
  footnote
}){
  const [selectedPhoto,setSelectedPhoto]=useState(null);

  if(loading){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
        <Text style={styles.centreText}>{loadingLabel}</Text>
      </View>
    );
  }

  if(error){
    return(
      <View style={styles.centre}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // The meta strip: type and a short rating summary, side by side on one
  // ruled line. `stats` (a club's members/spaces/score) replaces the simple
  // average -- those get their own oversized numerals below rather than a
  // string that would not fit here.
  const metaParts=[];
  if(typeLabel) metaParts.push({key:"type",text:typeLabel});
  if(!stats && rating){
    metaParts.push({
      key:"rating",
      text:rating.count>0
        ? `★ ${rating.average} · ${rating.count} ${rating.count===1 ? "review" : "reviews"}`
        : "No reviews yet"
    });
  }

  const infoItems=info.filter((item)=>item && item.value);
  const statList=stats || (rating ? [
    {value:rating.average || "—",label:"Average rating"},
    {value:rating.count,label:rating.count===1 ? "Review" : "Reviews"}
  ] : null);

  return(
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* THE MASTHEAD. Name leads, oversized, the way a gazetteer entry
            opens with the headword rather than a picture. */}
        <View style={styles.nameRow}>
          <Text style={TYPE.display} numberOfLines={3}>{name}</Text>
          {ownerAction}
        </View>

        {(!!metaParts.length || !!verifiedLabel) && (
          <View style={styles.metaStrip}>
            {metaParts.map((part,index)=>(
              <React.Fragment key={part.key}>
                {index>0 && <Text style={styles.metaDot}> · </Text>}
                <Text style={styles.metaPart} numberOfLines={1}>{part.text}</Text>
              </React.Fragment>
            ))}
            {!!verifiedLabel && <Text style={styles.verified}>{verifiedLabel}</Text>}
          </View>
        )}

        {showPhotos && (photos.length ? (
          <>
            <Pressable onPress={()=>setSelectedPhoto(photos[0])}>
              <Image source={{uri:photos[0]}} style={styles.heroPhoto}/>
            </Pressable>
            {/* The rest of the photos, if there are any -- a wrapped grid
                rather than a sideways scroll. Every photo stays reachable,
                nothing about them scrolls off to the side. */}
            {photos.length>1 && (
              <View style={styles.photoGrid}>
                {photos.slice(1).map((photo,index)=>(
                  <Pressable key={`${photo}-${index}`} onPress={()=>setSelectedPhoto(photo)}>
                    <Image source={{uri:photo}} style={styles.photoThumb}/>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.muted}>{photosEmptyLabel}</Text>
          </View>
        ))}

        {!!statList && (
          <View style={styles.statsRow}>
            {statList.map((stat)=>(
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {rating?.favourite}

        {!!description && (
          <View style={styles.section}>
            <View style={styles.sectionHead}><Text style={styles.sectionTitle}>About</Text></View>
            <Text style={styles.description}>{description}</Text>
          </View>
        )}

        {!!infoItems.length && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Text style={styles.reviewCount}>{infoItems.length}</Text>
            </View>
            {infoItems.map((item)=>(
              <View key={item.label} style={styles.infoCard}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoText}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {beforeActions}

        {!!actions && (
          <View style={styles.section}>
            <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Actions</Text></View>
            {actions}
          </View>
        )}

        {beforeReviews}

        {showReviews && (
          <View style={styles.section}>
            <View style={styles.reviewHeading}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <Text style={styles.reviewCount}>{reviews.length}</Text>
            </View>

            {!reviews.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{reviewsEmpty?.title || "No reviews yet"}</Text>
                {/* Empty states are instructions, not moods. */}
                <Text style={styles.muted}>{reviewsEmpty?.instruction}</Text>
              </View>
            ) : reviews.map((review)=>(
              <PlaceReview
                key={review.id}
                review={review}
                onPhoto={setSelectedPhoto}
                viewerId={viewerId}
                canReply={viewerManagesThis}
              />
            ))}
          </View>
        )}

        {afterReviews}

        {!!similar.length && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{similarLabel}</Text>
              <Text style={styles.reviewCount}>{similar.length}</Text>
            </View>
            {similar.map((item)=>(
              <Pressable
                key={item.id}
                style={styles.similarCard}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={()=>router.push(item.route)}
              >
                <Text style={styles.similarName}>{item.name}</Text>
                {!!item.detail && <Text style={styles.similarDetail}>{item.detail}</Text>}
              </Pressable>
            ))}
          </View>
        )}

        {!!footnote && (
          <View style={styles.footnote}>
            <Text style={styles.footnoteTitle}>{footnote.title}</Text>
            <Text style={styles.footnoteText}>{footnote.body}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={()=>setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalClose}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={()=>setSelectedPhoto(null)}
          >
            <Text style={styles.modalCloseText}>×</Text>
          </Pressable>
          <Pressable style={styles.modalArea} onPress={()=>setSelectedPhoto(null)}>
            {selectedPhoto && <Image source={{uri:selectedPhoto}} style={styles.modalImage} resizeMode="contain"/>}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

// One review card, shared by every place type. Business and property reviews
// come from the same `reviews` table; 5b will have to normalise event_reviews
// and activity_club_reviews into this shape rather than widen it.
function PlaceReview({review,onPhoto,viewerId,canReply}){
  const photos=Array.isArray(review.photos)
    ? review.photos.filter((photo)=>typeof photo==="string" && photo.trim()).slice(0,3)
    : [];

  const stars=Number(review.rating || 0);

  return(
    // The card is a plain View, and only the part above the actions opens the
    // Explorer's profile. It used to be one big Pressable wrapping everything,
    // which was fine while the actions were three buttons -- it is not fine now
    // that a comment box lives down there, because every tap in the text field
    // would navigate away mid-sentence.
    <View style={styles.reviewCard}>
    <Pressable
      onPress={()=>review.user_id && router.push(`/profile/${review.user_id}`)}
      disabled={!review.user_id}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{review.name?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
          </View>
          <View style={styles.titleText}>
            <Text style={styles.reviewerName}>{review.name || "Explorer"}</Text>
            <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
          </View>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+{review.points_awarded || 0}</Text>
        </View>
      </View>

      <Text style={styles.stars}>
        {"★".repeat(stars)}
        <Text style={styles.emptyStars}>{"★".repeat(Math.max(0,5-stars))}</Text>
      </Text>

      {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}
      <Text style={styles.reviewComment}>{review.comment}</Text>
      {!!review.verified_qr && <Text style={styles.verified}>✓ VERIFIED ON-SITE REVIEW</Text>}

      {!!photos.length && (
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotoRow}>
          {photos.map((photo,index)=>(
            <Pressable
              key={`${review.id}-${index}`}
              onPress={(event)=>{event?.stopPropagation?.();onPhoto(photo);}}
            >
              <Image source={{uri:photo}} style={styles.reviewPhoto}/>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!!review.video_url && (
        <Pressable
          style={styles.videoButton}
          accessibilityRole="button"
          accessibilityLabel="Play video review"
          onPress={(event)=>{event?.stopPropagation?.();Linking.openURL(review.video_url);}}
        >
          <Text style={styles.videoTitle}>▶ Play video review</Text>
          <Text style={styles.videoMeta}>30 seconds or less</Text>
        </Pressable>
      )}

      {/*
        Comment, on the page the review is actually on. Until now the only way
        to reach it was to find the review in the news feed and tap it there,
        which meant the reviews on a place page -- the ones people actually
        read -- could not be commented on at all.

        "Comment", not "Reply". A comment is what anybody leaves on a review. A
        reply is the manager of the reviewed place answering it, which is a
        different thing said by a different person, and it renders above as its
        own block rather than as another comment.
      */}
      {!!review.user_id && <Text style={styles.profileHint}>Tap to view the Explorer →</Text>}
    </Pressable>

    {/*
      The manager's reply and challenge are drawn by ReviewActions now, not
      here. They used to be rendered above -- but only the reply, and only on
      this one layout, so a challenge was invisible everywhere and a reply was
      invisible anywhere a review appeared outside a place page.
    */}
    <ReviewActions
      review={review}
      viewerId={viewerId}
      canReply={canReply}
    />
    </View>
  );
}

function formatReviewDate(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

const card={
  backgroundColor:INK.card,
  borderWidth:2,
  borderColor:INK.ink,
  borderRadius:12,
  shadowColor:INK.ink,
  shadowOffset:{width:3,height:3},
  shadowOpacity:1,
  shadowRadius:0,
  elevation:0
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:50},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  centreText:{color:INK.inkSoft,marginTop:10},
  errorText:{color:INK.ink,fontSize:17,textAlign:"center",lineHeight:24},

  // Full-width, not a card in a sideways strip -- the masthead's hero, with a
  // wrapped grid underneath it for anything beyond the first photo rather
  // than a horizontal scroll (design round r001-a bans reintroducing one).
  heroPhoto:{width:"100%",height:220,borderRadius:0,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card,marginTop:14},
  photoGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:8},
  photoThumb:{width:72,height:72,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card},
  photoFallback:{...card,height:130,alignItems:"center",justifyContent:"center",marginTop:14},

  nameRow:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},
  titleText:{flex:1},
  metaStrip:{
    flexDirection:"row",
    flexWrap:"wrap",
    alignItems:"center",
    marginTop:8,
    paddingVertical:8,
    borderTopWidth:1,borderTopColor:INK.hair,
    borderBottomWidth:1,borderBottomColor:INK.hair
  },
  metaPart:{...TYPE.meta},
  metaDot:{...TYPE.meta},
  verified:{alignSelf:"flex-start",color:INK.ink,borderWidth:2,borderColor:INK.ink,paddingHorizontal:8,paddingVertical:3,borderRadius:4,overflow:"hidden",fontSize:10,fontWeight:"800",marginLeft:8},
  description:{...TYPE.body,marginTop:8},

  infoCard:{borderTopWidth:1,borderTopColor:INK.hair,paddingTop:11,marginTop:12},
  infoLabel:{...TYPE.sectionLabel},
  infoText:{color:INK.ink,fontSize:14,lineHeight:20,marginTop:5},

  statsRow:{flexDirection:"row",gap:9,marginTop:14},
  statCard:{flex:1,borderWidth:2,borderColor:INK.ink,borderRadius:4,padding:13,alignItems:"center"},
  statValue:{...TYPE.numeral},
  statLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"700",marginTop:3},

  section:{marginTop:24},
  // The rule a section opens on -- a full-width row so it spans the heading
  // and, where there is one, the count beside it.
  sectionHead:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"flex-end",
    paddingBottom:6,
    marginBottom:11,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  sectionTitle:{...TYPE.sectionLabel},

  reviewHeading:{
    flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end",
    paddingBottom:6,marginBottom:11,borderBottomWidth:2,borderBottomColor:INK.ink
  },
  reviewCount:{...TYPE.numeral,fontSize:16},
  emptyCard:{...card,padding:18,alignItems:"center"},
  emptyTitle:{color:INK.ink,fontWeight:"800",fontSize:17,marginBottom:5},
  muted:{color:INK.inkSoft,textAlign:"center",lineHeight:20},

  reviewCard:{...card,padding:15,marginBottom:11},
  reviewHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewerRow:{flexDirection:"row",alignItems:"center",flex:1,paddingRight:10},
  avatar:{width:42,height:42,borderRadius:21,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center",marginRight:10},
  avatarText:{color:INK.ink,fontWeight:"800"},
  reviewerName:{color:INK.ink,fontWeight:"800",fontSize:16},
  reviewDate:{color:INK.inkSoft,fontSize:11,marginTop:2},
  pointsBadge:{borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:10,paddingVertical:4},
  pointsText:{color:INK.ink,fontWeight:"800",fontSize:12},
  stars:{color:INK.ink,fontSize:17,marginTop:11},
  emptyStars:{color:INK.hair},
  reviewTitle:{color:INK.ink,fontSize:17,fontWeight:"800",marginTop:9},
  reviewComment:{color:INK.ink,fontSize:15,lineHeight:22,marginTop:6},
  reviewActions:{flexDirection:"row",alignItems:"center",gap:10,marginTop:12},
  reviewAction:{borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:14,paddingVertical:6,backgroundColor:INK.card},
  reviewActionText:{color:INK.ink,fontWeight:"800",fontSize:12},
  reviewPhotoRow:{paddingTop:12},
  reviewPhoto:{width:120,height:120,borderRadius:10,borderWidth:2,borderColor:INK.ink,marginRight:8},
  videoButton:{borderWidth:2,borderColor:INK.ink,borderRadius:10,padding:12,marginTop:12},
  videoTitle:{color:INK.ink,fontWeight:"800"},
  videoMeta:{color:INK.inkSoft,fontSize:11,marginTop:2},
  profileHint:{color:INK.inkSoft,fontWeight:"700",fontSize:11,marginTop:11},

  similarCard:{...card,padding:14,marginBottom:10},
  similarName:{color:INK.ink,fontSize:16,fontWeight:"800"},
  similarDetail:{color:INK.inkSoft,fontSize:13,marginTop:3},

  footnote:{borderTopWidth:2,borderTopColor:INK.hair,paddingTop:14,marginTop:24},
  footnoteTitle:{color:INK.ink,fontWeight:"800",fontSize:15},
  footnoteText:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:5},

  modalBackdrop:{flex:1,backgroundColor:"rgba(22,24,28,0.94)"},
  modalArea:{flex:1,alignItems:"center",justifyContent:"center",padding:15},
  modalImage:{width:"100%",height:"100%"},
  modalClose:{position:"absolute",top:45,right:20,zIndex:2,width:44,height:44,borderRadius:22,borderWidth:2,borderColor:INK.card,alignItems:"center",justifyContent:"center"},
  modalCloseText:{color:INK.card,fontSize:32,lineHeight:34}
});
