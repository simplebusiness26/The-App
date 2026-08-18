import React from "react";
import {View,Text,Image,Pressable,StyleSheet} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Frame,Glyph,MONO,Panel} from "./instrument";

// One card in a Discover carousel.
//
// WHAT THIS REPLACES
//
// A vertical stack of bordered text boxes, six per section, seven sections. The
// owner: the lists "are too long", and what they asked for instead is a picture
// with the words ON it --
//
//   "thumbnail/hero image, and a transparent overlay halfway across with the
//    title, the type of business, and why it's showing you -- 'You saved this',
//    'starts in 47 minutes', '50 m from you in Hastings' -- plus the review
//    score, plus a little map logo to see it on the map. Clicking the box opens
//    the business profile."
//
// So: image, half-height body, score, map button, and the whole box is the link
// to the place.
//
// WHY IT IS BUILT FROM THE KIT NOW
//
// It was a 2px-bordered box with a hard 3px offset shadow -- the print system's
// card, recoloured. A Panel is the instrument's answer: one surface step, a 1px
// etched hairline and a bevel highlight, no shadow. The picture sits in a
// Frame, the same bracketed viewfinder well every photograph in this app sits
// in, so a browse card reads as part of the same machine as the camera.
//
// THE REASON IS NOT OPTIONAL AND NEVER WAS
//
// utils/discover.js drops any item it cannot compute a reason for, and
// scripts/verify-discover.cjs fails the build if a recommendation renders
// without one. Putting it at the bottom of the card does not soften that -- a
// card with a blank line there is an item that should never have reached the
// screen. It is a computed sentence, so it is set in the data face.
//
// NO STOCK PHOTOGRAPH. A manager who has uploaded nothing gets a plain well
// carrying the same glyph its map pin uses. A generic image of somewhere else
// would be the app telling a small lie about a real place, every time.

export default function DiscoverCard({item,onSeeOnMap}){
  if(!item) return null;

  const score=item.rating;
  const hasPlace=Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));

  return(
    <Panel style={styles.card}>
      <Pressable
        style={styles.open}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.reason}.`}
        onPress={()=>item.route && router.push(item.route)}
      >
        <Frame style={styles.frame}>
          {item.image
            ? <Image source={{uri:item.image}} style={styles.image} accessibilityIgnoresInvertColors/>
            : (!!item.marker && <PlaceMarker marker={item.marker} size={44}/>)}
        </Frame>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {/* What kind of thing this is -- a classification the app holds, not
              a sentence anybody wrote, so it is mono. */}
          {!!item.subtitle && <Text style={styles.type} numberOfLines={1}>{item.subtitle}</Text>}
          <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
        </View>
      </Pressable>

      {/* The score, on the picture, where a score goes on every app that has
          one. Absent rather than zero when nobody has reviewed it. A stroked
          glyph off the 16x16 grid, never the star character -- that carried the
          system font's own weight and colour onto an instrument face. */}
      {!!score?.count && (
        <View style={styles.score} accessibilityLabel={`Rated ${score.average} out of 5 from ${score.count} reviews`}>
          <Glyph name="star" size={11} colour={INK.readout}/>
          <Text style={styles.scoreText}>{score.average}</Text>
        </View>
      )}

      {/* "A little map logo to see it on the map." Only when there is a place
          to see -- a Link-up with no coordinates has nothing to show. */}
      {hasPlace && (
        <Pressable
          style={styles.mapButton}
          accessibilityRole="button"
          accessibilityLabel={`See ${item.title} on the map`}
          hitSlop={8}
          onPress={()=>onSeeOnMap?.(item)}
        >
          <Glyph name="map" size={15} colour={INK.readout}/>
        </Pressable>
      )}
    </Panel>
  );
}

export const CARD_WIDTH=240;
const CARD_HEIGHT=196;
const IMAGE_HEIGHT=98;

const styles=StyleSheet.create({
  card:{width:CARD_WIDTH,height:CARD_HEIGHT},
  open:{flex:1},
  // The Frame's own border would double the Panel's edge here, so the well
  // borrows the card's outline and keeps only its viewfinder brackets.
  frame:{width:"100%",height:IMAGE_HEIGHT,borderWidth:0,borderRadius:0},
  image:{width:"100%",height:"100%"},
  body:{flex:1,paddingHorizontal:11,paddingTop:9,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  title:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"700",letterSpacing:-0.2},
  type:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8,marginTop:3
  },
  reason:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.7,lineHeight:TYPE.data.sizes.md*1.5,marginTop:7
  },
  // A readout plate over the picture: the deepest housing tone, so the number
  // stays legible whatever the photograph is doing underneath it.
  score:{
    position:"absolute",top:8,left:8,flexDirection:"row",alignItems:"center",gap:5,
    paddingHorizontal:7,paddingVertical:4,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    borderRadius:SHAPE.radius.control
  },
  scoreText:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  mapButton:{
    position:"absolute",top:8,right:8,width:32,height:32,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    borderRadius:SHAPE.radius.control
  }
});
