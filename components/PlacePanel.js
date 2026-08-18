import React,{useEffect,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import Directions from "./Directions";
import {heroImageFor,summaryFor,reviewTargetType} from "../utils/placeCards";
import {loadPlaceRating} from "../utils/reviews";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Action,Frame,Glyph,Meter,MONO,SectionRule} from "./instrument";

// One panel for the place somebody tapped.
//
// WHAT THIS REPLACES, AND WHY
//
// components/PlaceCards.js: a swipeable sheet that opened on the tapped place
// and then let you swipe sideways through the eight nearest, captioned "1 of 8
// nearby". It sat at bottom:12, and so did Directions -- the same corner, so
// asking for a route put a card over the answer.
//
// The owner: "I don't want that place card to come up... it gets in the way of
// the directions", and the directions panel should carry "the hero image, the
// review score and a brief summary of the business, all in one thing".
//
// So this is one thing. The place you tapped, a picture of it, what it is, what
// people scored it, a sentence about it, and the route -- in that order, in one
// panel, with nothing on top of anything else. There is no swipe: swiping to a
// place you did not tap was answering a question nobody asked, and Discover is
// where browsing belongs.
//
// THE SCORE IS FETCHED HERE, NOT ON THE MAP
//
// hooks/useLivingMap.js already reads every business, property and club with no
// limit. Adding a review count to that would mean counting reviews for every
// listing in the county to show one number for one of them. Two numbers, on
// tap, for the place in front of somebody. See loadPlaceRating in
// utils/reviews.js.
//
// WHAT THIS PASS CHANGED
//
// The shape, not the content. This was a 2px-bordered card whose picture had a
// 2px border of its own, whose score was a text star and a middle dot, whose
// address opened with a pin emoji, and whose two buttons were 99px stadium
// pills filled with what is now the near-white readout colour. It is the map's
// main readout, so it opens the way every readout in this app opens: a mono
// head strip saying what kind of thing this is, the name in display type, then
// the MEASUREMENTS -- score, review count -- and only then the sentences
// somebody wrote.

export default function PlacePanel({place,onClose,onRoute,embedded=false}){
  const [rating,setRating]=useState(null);

  useEffect(()=>{
    let alive=true;
    const targetType=reviewTargetType(place?.kind);

    setRating(null);
    if(!targetType || !place?.id) return undefined;

    loadPlaceRating(targetType,place.id).then((answer)=>{
      if(alive) setRating(answer);
    });

    return()=>{alive=false;};
  },[place?.kind,place?.id]);

  if(!place) return null;

  const card=place.card || {};
  const hero=heroImageFor(place);
  const summary=summaryFor(place);
  const where=card.detail || place.address || place.location || "";
  const name=place.name || card.name || "This place";
  // What the pin under this panel IS: `exists`, `scheduled` or `offer`. It
  // lights one dot on the head strip and nothing else -- the state inks belong
  // to the map, and a panel that tinted itself in one would be competing with
  // the pins it is describing.
  const tone=card.marker?.state || place.state || "exists";
  // The review route is one segment inserted into the same route the "Open
  // profile" button already uses -- /business/b1 -> /business/review/b1 --
  // so this needs no second lookup table for what a kind is called.
  const reviewRoute=card.route ? card.route.replace(/\/([^/]+)$/,"/review/$1") : null;

  return(
    // `embedded`: components/PinSheet.js's Half/Full content area already
    // supplies the border, the elevation and the position -- a caller that
    // draws its own fixed panel on top of that would be two frames around
    // one card. components/PlacesList.js still renders this as the fixed
    // corner panel it has always been, for its own screen with no sheet
    // underneath.
    <View style={embedded ? styles.embedded : styles.panel}>
      <ScrollView
        style={embedded ? styles.embeddedScroll : styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* THE HEAD STRIP. What kind of place, then the etched rule, then the
            close control. A person reads this before the name, which is why it
            sits above it -- the same head components/PinSheet.js and
            components/FeedCard.js open with. */}
        <View style={styles.headRow}>
          <View style={[styles.headDot,{backgroundColor:INK[tone] || INK.exists}]}/>
          <Text style={styles.headKind} numberOfLines={1}>
            {String(card.typeLabel || place.kind || "PLACE").toUpperCase()}
          </Text>
          <View style={styles.headLine}/>
          <Pressable
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={`Close ${place.name || "this place"}`}
            hitSlop={12}
            onPress={onClose}
          >
            <Glyph name="close" size={14} colour={INK.readoutSoft}/>
          </Pressable>
        </View>

        <View style={styles.head}>
          {/* Every picture in this app sits in a bracketed Frame -- the same
              well the viewfinder uses -- rather than a rounded rectangle with
              a print border round it. */}
          <Frame size={84} style={styles.hero}>
            {hero
              ? <Image source={{uri:hero}} style={styles.heroImage} accessibilityIgnoresInvertColors/>
              : (
                // No invented picture. An empty well says "no photo yet", which
                // is true; a stock image of somewhere else would not be.
                <Text style={styles.heroEmptyText}>NO PHOTO YET</Text>
              )}
          </Frame>

          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={2}>{name}</Text>

            {/*
              THE SCORE IS A MEASUREMENT, SO IT IS READ OFF A SCALE.
              It used to be a star character, the average, a middle dot and a
              word -- a sentence pretending to be a number, drawn in a glyph
              belonging to the system font.

              Three states, and they are different things. A score, "no reviews
              yet", and "still loading" must not look the same -- a blank where
              a number goes reads as a place nobody rated.
            */}
            {rating===null && <Text style={styles.scoreWaiting}>READING REVIEWS…</Text>}
            {rating!==null && rating.count>0 && (
              <View
                style={styles.scoreRow}
                accessibilityLabel={`Rated ${rating.average} out of 5 from ${rating.count} reviews`}
              >
                <Meter value={Number(rating.average) || 0} max={5} width={72} tone="exists" label="RATED"/>
                <Text style={styles.scoreValue}>{rating.average}/5</Text>
                <Text style={styles.scoreCount}>{rating.count} {rating.count===1 ? "REVIEW" : "REVIEWS"}</Text>
              </View>
            )}
            {rating!==null && rating.count===0 && (
              <Text style={styles.scoreEmpty}>NOT RATED YET</Text>
            )}
          </View>
        </View>

        {/* Where it is, in the body face with a drawn pin -- it is an address
            somebody wrote, not a number the app measured, and the emoji that
            used to sit here carried its own colour onto the housing. */}
        {!!where && (
          <View style={styles.whereRow}>
            <Glyph name="pin" size={13} colour={INK.readoutFaint}/>
            <Text style={styles.where} numberOfLines={2}>{where}</Text>
          </View>
        )}

        {!!summary && <Text style={styles.summary}>{summary}</Text>}

        <View style={styles.actions}>
          <Action
            kind="primary"
            label="Open profile"
            glyph="forward"
            accessibilityLabel={`Open ${place.name || "this place"}`}
            onPress={()=>card.route && router.push(card.route)}
          />

          {/* One tap from the map to the review form -- the map's own quick-
              action, not only the one on the full listing page. */}
          {!!reviewRoute && (
            <Action
              kind="secondary"
              label="Leave a review"
              glyph="star"
              accessibilityLabel={`Leave a review for ${place.name || "this place"}`}
              onPress={()=>router.push(reviewRoute)}
            />
          )}
        </View>

        {/*
          DIRECTIONS, INSIDE THE SAME PANEL.
          It used to be a separate card at the same bottom corner as the swipe
          sheet, which is how a place card came to cover the route. One panel
          cannot cover itself.
        */}
        <SectionRule label="Route"/>
        <Directions
          destination={{latitude:place.latitude,longitude:place.longitude}}
          destinationName={place.name || card.name || "this place"}
          onRoute={onRoute}
        />
      </ScrollView>
    </View>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // Capped, so it never becomes the whole screen: the map is the point and this
  // is a look at one thing on it. A panel genuinely floating over the map is
  // one of the two things design-system.md still allows a soft ambient shadow
  // for -- the other is the Create action.
  panel:{
    position:"absolute",left:12,right:12,bottom:12,zIndex:20,maxHeight:"62%",
    backgroundColor:INK.panel,borderColor:INK.hairline,borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,overflow:"hidden",
    ...SHAPE.shadow.floating
  },
  // No position, no border, no cap -- components/PinSheet.js's own sheet
  // already draws all three, and its content area already scrolls.
  embedded:{flex:1},
  scroll:{flexGrow:0},
  // A bounded ScrollView, unlike the standalone panel's shrink-to-fit one --
  // components/PinSheet.js gives this a fixed height per snap level, and
  // content taller than Peek or Half must scroll inside it, not spill past
  // the sheet's own overflow:hidden edge.
  embeddedScroll:{flex:1},
  content:{padding:14},

  headRow:{flexDirection:"row",alignItems:"center",gap:8,marginBottom:12},
  headDot:{width:7,height:7,borderRadius:SHAPE.radius.pill},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md,flexShrink:1},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  close:{
    width:30,height:30,alignItems:"center",justifyContent:"center",
    borderRadius:SHAPE.radius.control,backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,borderColor:INK.hairline
  },

  head:{flexDirection:"row",alignItems:"flex-start",gap:12},
  hero:{backgroundColor:INK.inset},
  heroImage:{width:"100%",height:"100%"},
  heroEmptyText:{
    ...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,
    textAlign:"center",paddingHorizontal:6
  },
  headText:{flex:1,minWidth:0},
  // Display type, tight. A place name is the largest thing on this panel.
  name:{color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",letterSpacing:-0.5},

  scoreWaiting:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:9},
  scoreRow:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8,marginTop:9},
  scoreValue:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.lg},
  scoreCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},
  scoreEmpty:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:9},

  whereRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:12},
  where:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,flexShrink:1},
  // A summary is a sentence somebody wrote, so it stays in the body face.
  summary:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginTop:9},

  actions:{gap:9,marginTop:14}
});
