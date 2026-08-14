import React from "react";
import {View,Text,Image,Pressable,StyleSheet} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import {INK} from "../utils/tokens";

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
// So: image, half-height overlay, score, map button, and the whole box is the
// link to the place.
//
// THE REASON IS NOT OPTIONAL AND NEVER WAS
//
// utils/discover.js drops any item it cannot compute a reason for, and
// scripts/verify-discover.cjs fails the build if a recommendation renders
// without one. Putting it inside the overlay does not soften that -- a card
// with a blank line there is an item that should never have reached the screen.
//
// NO STOCK PHOTOGRAPH. A manager who has uploaded nothing gets a plain block
// carrying the same glyph its map pin uses. A generic image of somewhere else
// would be the app telling a small lie about a real place, every time.

export default function DiscoverCard({item,onSeeOnMap}){
  if(!item) return null;

  const score=item.rating;
  const hasPlace=Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));

  return(
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.reason}.`}
      onPress={()=>item.route && router.push(item.route)}
    >
      {item.image
        ? <Image source={{uri:item.image}} style={styles.image} accessibilityIgnoresInvertColors/>
        : (
          <View style={[styles.image,styles.imageEmpty]}>
            {!!item.marker && <PlaceMarker marker={item.marker} size={44}/>}
          </View>
        )}

      {/*
        HALFWAY ACROSS, as asked. It is a solid card panel rather than a real
        transparency: text over a photograph is unreadable at some point on
        every photograph, and scripts/verify-contrast.cjs is right to refuse a
        pair it cannot measure. The picture keeps the top half to itself.
      */}
      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.type} numberOfLines={1}>{item.subtitle}</Text>}
        <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
      </View>

      {/* The score, over the picture, where a score goes on every app that has
          one. Absent rather than zero when nobody has reviewed it. */}
      {!!score?.count && (
        <View style={styles.score} accessibilityLabel={`Rated ${score.average} out of 5 from ${score.count} reviews`}>
          <Text style={styles.scoreText}>★ {score.average}</Text>
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
          <Text style={styles.mapIcon}>◎</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export const CARD_WIDTH=240;
const CARD_HEIGHT=190;

const styles=StyleSheet.create({
  card:{
    width:CARD_WIDTH,
    height:CARD_HEIGHT,
    borderRadius:14,
    borderWidth:2,
    borderColor:INK.ink,
    backgroundColor:INK.card,
    overflow:"hidden",
    // Hard offset shadow, never a blur -- the same rule the pins and the raised
    // tab button follow.
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  image:{width:"100%",height:CARD_HEIGHT/2,backgroundColor:INK.hair},
  imageEmpty:{alignItems:"center",justifyContent:"center"},
  overlay:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    height:CARD_HEIGHT/2,
    padding:10,
    justifyContent:"flex-start",
    backgroundColor:INK.card,
    borderTopWidth:2,
    borderTopColor:INK.ink
  },
  title:{color:INK.ink,fontWeight:"900",fontSize:15},
  type:{color:INK.inkSoft,fontWeight:"700",fontSize:11,marginTop:2},
  // The reason. Never optional -- see the note above.
  reason:{color:INK.ink,fontWeight:"800",fontSize:11,lineHeight:15,marginTop:6},
  score:{
    position:"absolute",
    top:8,
    left:8,
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:8,
    paddingVertical:3
  },
  scoreText:{color:INK.ink,fontWeight:"900",fontSize:11},
  mapButton:{
    position:"absolute",
    top:8,
    right:8,
    width:32,
    height:32,
    borderRadius:16,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink
  },
  mapIcon:{color:INK.ink,fontSize:16,fontWeight:"900",lineHeight:19}
});
