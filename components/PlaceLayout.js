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
import {INK,SHAPE,TYPE} from "../utils/tokens";
import ReviewActions from "./ReviewActions";
import {CREATE_HUB_CLEARANCE} from "./CreateHub";
import {
  Empty,
  Frame,
  Glyph,
  Meter,
  MONO,
  Notice,
  Panel,
  ReadoutStrip,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "./instrument";

// Packet 5a: the shared place page.
//
// Sections, in the order the brief lists them: hero, title and verification,
// listing type, rating, primary action, essential info, photos, reviews,
// similar nearby.
//
// Deliberately NOT here: routing, table booking and ticketing. The brief draws
// all three on this page and all three are Stage Four or Stage Five. CLAUDE.md
// cuts them explicitly and RULES.md bans placeholder UI for later stages, so
// the page ends without them rather than showing something dead.
//
// The type-specific parts arrive as slots rather than flags. A `kind` prop with
// branches inside would make this file grow a limb per page type, which is the
// duplication it was written to remove wearing a different coat.
//
// WHAT THIS PASS CHANGED, AND WHY IT IS NOT A RECOLOUR
//
// A place page is the instrument's main readout, and this one was shaped like a
// document: a 28px bold title with no eyebrow, 21px bare section headings, six
// hand-drawn card shapes each with a 2px border and a hard 3px offset shadow,
// a rating drawn as five repeated star characters, and a tick emoji in front of
// "VERIFIED ON-SITE REVIEW". None of that is a colour, so none of it would have
// changed by swapping the palette -- which is exactly the failure this rebuild
// exists to undo.
//
// It is assembled from components/instrument.js now: ScreenTitle for the head,
// SectionRule for every division, ReadoutStrip for the measurements, Panel for
// the things people wrote, Row for every list line, Empty for every list with
// nothing in it, and Meter for a score, because a score is read off a scale.

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
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readoutSoft}/>
        <Text style={styles.centreText}>{loadingLabel}</Text>
      </Screen>
    );
  }

  if(error){
    // An edge and a mono eyebrow, not a bare paragraph in the middle of an
    // empty screen. `agree`/`dispute` are a manager's two answers to a review
    // and are explicitly not generic error colours.
    return(
      <Screen style={styles.centre}>
        <View style={styles.errorWrap}>
          <Notice tone="scheduled" label="NOT LOADED">{error}</Notice>
        </View>
      </Screen>
    );
  }

  const measurements=stats || (rating ? [
    {label:rating.count===1 ? "Review" : "Reviews",value:String(rating.count ?? 0)},
    {label:"Average",value:String(rating.average || "—")}
  ] : null);

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* THE PICTURES, IN BRACKETED FRAMES.
            flexGrow:0 / flexShrink:0 and a centred content container, because a
            horizontal ScrollView in a flex column otherwise claims the leftover
            vertical space and stretches every photo to fill it. */}
        {showPhotos && (photos.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
            contentContainerStyle={styles.photoRow}
          >
            {photos.map((photo,index)=>(
              <Pressable
                key={`${photo}-${index}`}
                accessibilityRole="button"
                accessibilityLabel="Open this photo"
                onPress={()=>setSelectedPhoto(photo)}
              >
                <View style={styles.heroPhoto}>
                  <Image source={{uri:photo}} style={styles.heroPhotoImage}/>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.body}>
            <Frame ratio={2.4} style={styles.photoFallback}>
              <Text style={styles.mutedMono}>{photosEmptyLabel}</Text>
            </Frame>
          </View>
        ))}

        {/* The engraved plate: a mono eyebrow saying what KIND of thing this
            is, the name in display type, and a ticked rule under it. The type
            used to sit UNDER the name in small caps, which made the page open
            with an unqualified 28px word. */}
        <ScreenTitle eyebrow={typeLabel || undefined} title={name} right={ownerAction}/>

        <View style={styles.body}>
          {/* Verification is a fact the app checked, so it reads as a checked
              box on the housing rather than an outlined pill. */}
          {!!verifiedLabel && (
            <View style={styles.verified}>
              <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/>
              <Text style={styles.verifiedText}>{verifiedLabel}</Text>
            </View>
          )}

          {/* THE MEASUREMENTS, ON ONE PLATE. Two or three hand-drawn bordered
              boxes became one ReadoutStrip -- the same plate the rest of the
              app reads its numbers off. */}
          {!!measurements && <ReadoutStrip items={measurements} style={styles.statCard}/>}

          {/* A description is a sentence somebody wrote, so it stays in the
              body face, inside a Panel. */}
          {!!description && (
            <Panel style={styles.prose}>
              <Text style={styles.description}>{description}</Text>
            </Panel>
          )}

          {/* Essential info: a mono field name, an etched rule, the value. The
              value wraps, which is why this is not the kit's KeyValue -- an
              address and a pair of opening times are two lines often enough
              that truncating them to one would lose half the answer. */}
          {info.filter((item)=>item && item.value).length>0 && (
            <>
              <SectionRule label="Essentials"/>
              <Panel style={styles.infoPanel}>
                {info.filter((item)=>item && item.value).map((item,index)=>(
                  <View key={item.label} style={[styles.infoCard,index>0 && styles.infoCardNext]}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoText}>{item.value}</Text>
                  </View>
                ))}
              </Panel>
            </>
          )}

          {rating?.favourite}

          {beforeActions}

          {!!actions && (
            <View style={styles.section}>
              <SectionRule label="Actions"/>
              {actions}
            </View>
          )}

          {beforeReviews}

          {showReviews && (
            <View style={styles.section}>
              <SectionRule label="Reviews" meta={String(reviews.length)}/>

              {!reviews.length ? (
                <Empty
                  glyph="comment"
                  title={reviewsEmpty?.title || "No reviews yet"}
                  /* Empty states are instructions, not moods. */
                  instruction={reviewsEmpty?.instruction}
                />
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
              <SectionRule label={similarLabel} meta={String(similar.length)}/>
              {similar.map((item)=>(
                <Row
                  key={item.id}
                  glyph="pin"
                  title={item.name}
                  onPress={()=>router.push(item.route)}
                >
                  {!!item.detail && <Text style={styles.similarDetail}>{item.detail}</Text>}
                </Row>
              ))}
            </View>
          )}

          {!!footnote && (
            <Panel style={styles.footnote}>
              <Text style={styles.footnoteTitle}>{footnote.title}</Text>
              <Text style={styles.footnoteText}>{footnote.body}</Text>
            </Panel>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={()=>setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalClose}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={()=>setSelectedPhoto(null)}
          >
            <Glyph name="close" size={18} colour={INK.readout} weight={1.6}/>
          </Pressable>
          <Pressable style={styles.modalArea} onPress={()=>setSelectedPhoto(null)}>
            {selectedPhoto && <Image source={{uri:selectedPhoto}} style={styles.modalImage} resizeMode="contain"/>}
          </Pressable>
        </View>
      </Modal>
    </Screen>
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
    // The card is a Panel, and only the part above the actions opens the
    // Explorer's profile. It used to be one big Pressable wrapping everything,
    // which was fine while the actions were three buttons -- it is not fine now
    // that a comment box lives down there, because every tap in the text field
    // would navigate away mid-sentence.
    <Panel style={styles.reviewCard}>
    <Pressable
      onPress={()=>review.user_id && router.push(`/profile/${review.user_id}`)}
      disabled={!review.user_id}
    >
      {/* The head strip every panel in this app opens with: what this is, the
          etched rule, and when it was written. */}
      <View style={styles.reviewHead}>
        <Text style={styles.reviewKind}>REVIEW</Text>
        <View style={styles.reviewHeadLine}/>
        <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
      </View>

      <View style={styles.reviewHeader}>
        <View style={styles.reviewerRow}>
          <Frame size={40} round style={styles.avatar}>
            <Text style={styles.avatarText}>{review.name?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
          </Frame>
          <View style={styles.titleText}>
            <Text style={styles.reviewerName}>{review.name || "Explorer"}</Text>
          </View>
        </View>
        {/* Points are a count the app awarded, so mono, on a plate. */}
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+{review.points_awarded || 0}</Text>
        </View>
      </View>

      {/* A SCORE IS A MEASUREMENT, SO IT IS READ OFF A SCALE.
          Five repeated star characters were a count you had to do yourself, in
          a glyph belonging to the system font. */}
      <View style={styles.ratingRow} accessibilityLabel={`Rated ${stars} out of 5`}>
        <Meter value={stars} max={5} width={92} tone="exists" label="RATED"/>
        <Text style={styles.stars}>{stars}<Text style={styles.emptyStars}>/5</Text></Text>
      </View>

      {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}
      {/* What a person wrote, in the body face. */}
      <Text style={styles.reviewComment}>{review.comment}</Text>

      {!!review.verified_qr && (
        <View style={styles.verified}>
          <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/>
          <Text style={styles.verifiedText}>VERIFIED ON-SITE REVIEW</Text>
        </View>
      )}

      {!!photos.length && (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.reviewPhotoScroll}
          contentContainerStyle={styles.reviewPhotoRow}
        >
          {photos.map((photo,index)=>(
            <Pressable
              key={`${review.id}-${index}`}
              accessibilityRole="button"
              accessibilityLabel="Open this photo"
              onPress={(event)=>{event?.stopPropagation?.();onPhoto(photo);}}
            >
              <View style={styles.reviewPhoto}>
                <Image source={{uri:photo}} style={styles.reviewPhotoImage}/>
              </View>
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
          <View style={styles.videoDial}>
            <Glyph name="play" size={15} colour={INK.readout} weight={1.4}/>
          </View>
          <View style={styles.videoText}>
            <Text style={styles.videoTitle}>Play video review</Text>
            <Text style={styles.videoMeta}>30 SECONDS OR LESS</Text>
          </View>
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
      {!!review.user_id && (
        <View style={styles.profileHintRow}>
          <Text style={styles.profileHint}>Tap to view the Explorer</Text>
          <Glyph name="forward" size={12} colour={INK.readoutFaint}/>
        </View>
      )}
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
    </Panel>
  );
}

function formatReviewDate(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // No horizontal padding here: ScreenTitle carries its own, and the photo
  // strip runs to the edge. Everything else sits in `body`.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},

  centre:{alignItems:"center",justifyContent:"center",padding:28},
  centreText:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.md,marginTop:12},
  errorWrap:{alignSelf:"stretch"},

  photoScroll:{flexGrow:0,flexShrink:0,marginTop:14},
  photoRow:{alignItems:"center",gap:11,paddingHorizontal:16},
  heroPhoto:{
    width:285,height:195,borderRadius:SHAPE.radius.card,overflow:"hidden",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  heroPhotoImage:{width:"100%",height:"100%"},
  photoFallback:{marginTop:14},

  verified:{flexDirection:"row",alignItems:"center",gap:6,marginTop:12},
  verifiedText:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm},

  statCard:{marginTop:14},

  prose:{padding:14,marginTop:12},
  description:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*1.5},

  infoPanel:{paddingHorizontal:13,paddingVertical:4},
  infoCard:{paddingVertical:11},
  infoCardNext:{borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  infoLabel:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},
  infoText:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginTop:5},

  section:{marginTop:6},

  reviewCard:{padding:14,marginBottom:11},
  reviewHead:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:12},
  reviewKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  reviewHeadLine:{flex:1,height:1,backgroundColor:INK.hairline},
  reviewDate:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  reviewHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewerRow:{flexDirection:"row",alignItems:"center",gap:10,flex:1,paddingRight:10},
  titleText:{flex:1,minWidth:0},
  avatar:{backgroundColor:INK.inset},
  avatarText:{color:INK.readoutSoft,fontWeight:"700",fontSize:16},
  reviewerName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},

  pointsBadge:{
    paddingHorizontal:10,paddingVertical:5,borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panelRaised,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  pointsText:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},

  ratingRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:12},
  stars:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.lg},
  // The part of the five this score did not reach.
  emptyStars:{color:INK.readoutFaint},

  reviewTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",marginTop:11,letterSpacing:-0.3},
  reviewComment:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*1.5,marginTop:7},

  reviewPhotoScroll:{flexGrow:0,flexShrink:0,marginTop:12},
  reviewPhotoRow:{alignItems:"center",gap:8},
  reviewPhoto:{
    width:120,height:120,borderRadius:SHAPE.radius.control,overflow:"hidden",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  reviewPhotoImage:{width:"100%",height:"100%"},

  videoButton:{
    flexDirection:"row",alignItems:"center",gap:11,marginTop:12,padding:11,
    backgroundColor:INK.panelRaised,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,minHeight:SHAPE.tapTarget
  },
  // A ringed dial, the same shape language as the shutter it was filmed with.
  videoDial:{
    width:32,height:32,borderRadius:SHAPE.radius.pill,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    paddingLeft:2
  },
  videoText:{flex:1,minWidth:0},
  videoTitle:{color:INK.readout,fontSize:TYPE.body.sizes.md,fontWeight:"600"},
  videoMeta:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:3},

  profileHintRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:12},
  profileHint:{color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm},

  similarDetail:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,letterSpacing:0.8,marginTop:4},

  mutedMono:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.md,textAlign:"center",paddingHorizontal:20},

  footnote:{padding:14,marginTop:22},
  footnoteTitle:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  footnoteText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:7},

  // The photo viewer. The backdrop is the housing at nine tenths, so the
  // picture is the only lit thing on the screen while it is open.
  modalBackdrop:{flex:1,backgroundColor:"rgba(15,18,22,0.94)"},
  modalArea:{flex:1,alignItems:"center",justifyContent:"center",padding:15},
  modalImage:{width:"100%",height:"100%"},
  modalClose:{
    position:"absolute",top:45,right:20,zIndex:2,
    width:SHAPE.tapTarget,height:SHAPE.tapTarget,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong
  }
});
