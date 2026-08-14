import React,{useEffect,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import Directions from "./Directions";
import {heroImageFor,summaryFor,reviewTargetType} from "../utils/placeCards";
import {loadPlaceRating} from "../utils/reviews";
import {INK} from "../utils/tokens";

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

export default function PlacePanel({place,onClose,onRoute}){
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

  return(
    <View style={styles.panel}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          {hero
            ? <Image source={{uri:hero}} style={styles.hero} accessibilityIgnoresInvertColors/>
            : (
              // No invented picture. An empty block says "no photo yet", which
              // is true; a stock image of somewhere else would not be.
              <View style={[styles.hero,styles.heroEmpty]}>
                <Text style={styles.heroEmptyText}>No photo yet</Text>
              </View>
            )}

          <View style={styles.headText}>
            <Text style={styles.name} numberOfLines={2}>{place.name || card.name || "This place"}</Text>
            {!!card.typeLabel && <Text style={styles.type}>{card.typeLabel}</Text>}

            {/*
              Three states, and they are different things. A score, "no reviews
              yet", and "still loading" must not look the same -- a blank where
              a number goes reads as a place nobody rated.
            */}
            {rating===null && <Text style={styles.score}>Loading reviews…</Text>}
            {rating!==null && rating.count>0 && (
              <Text style={styles.score} accessibilityLabel={`Rated ${rating.average} out of 5 from ${rating.count} reviews`}>
                ★ {rating.average} · {rating.count} {rating.count===1 ? "review" : "reviews"}
              </Text>
            )}
            {rating!==null && rating.count===0 && (
              <Text style={styles.scoreEmpty}>No reviews yet</Text>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${place.name || "this place"}`}
            hitSlop={12}
            onPress={onClose}
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {!!where && <Text style={styles.where} numberOfLines={2}>📍 {where}</Text>}
        {!!summary && <Text style={styles.summary}>{summary}</Text>}

        <Pressable
          style={styles.open}
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.name || "this place"}`}
          onPress={()=>card.route && router.push(card.route)}
        >
          <Text style={styles.openText}>Open profile</Text>
        </Pressable>

        {/*
          DIRECTIONS, INSIDE THE SAME PANEL.
          It used to be a separate card at the same bottom corner as the swipe
          sheet, which is how a place card came to cover the route. One panel
          cannot cover itself.
        */}
        <Directions
          destination={{latitude:place.latitude,longitude:place.longitude}}
          destinationName={place.name || card.name || "this place"}
          onRoute={onRoute}
        />
      </ScrollView>
    </View>
  );
}

const styles=StyleSheet.create({
  // Capped, so it never becomes the whole screen: the map is the point and this
  // is a look at one thing on it.
  panel:{
    position:"absolute",left:12,right:12,bottom:12,zIndex:20,maxHeight:"62%",
    backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:16
  },
  scroll:{flexGrow:0},
  content:{padding:14},
  head:{flexDirection:"row",alignItems:"flex-start",gap:12},
  hero:{width:84,height:84,borderRadius:12,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.hair},
  heroEmpty:{alignItems:"center",justifyContent:"center",padding:6},
  // Full ink, not inkSoft. On the hair-coloured empty block inkSoft is 3.42:1,
  // and scripts/verify-contrast.cjs is right to refuse it -- a label saying
  // there is no photo is no use if you cannot read it either.
  heroEmptyText:{color:INK.ink,fontSize:10,fontWeight:"700",textAlign:"center"},
  headText:{flex:1},
  name:{color:INK.ink,fontWeight:"900",fontSize:17,lineHeight:22},
  type:{color:INK.inkSoft,fontWeight:"700",fontSize:12,marginTop:3},
  score:{color:INK.ink,fontWeight:"800",fontSize:13,marginTop:6},
  scoreEmpty:{color:INK.inkSoft,fontWeight:"700",fontSize:12,marginTop:6},
  close:{color:INK.ink,fontWeight:"900",fontSize:18},
  where:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:10},
  summary:{color:INK.ink,fontSize:13,lineHeight:19,marginTop:8},
  open:{
    marginTop:12,minHeight:44,justifyContent:"center",alignItems:"center",
    borderRadius:99,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.paper
  },
  openText:{color:INK.ink,fontWeight:"900",fontSize:14}
});
