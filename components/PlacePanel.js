import React,{useEffect,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import Directions from "./Directions";
import {heroImageFor,summaryFor,reviewTargetType} from "../utils/placeCards";
import {loadPlaceRating} from "../utils/reviews";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

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
// GAZETTEER PASS: the panel now docks full-width to the bottom edge instead of
// floating as an inset card (design round r001-a). Nothing in
// scripts/verify-map-cards.cjs greps the old inset values, so the docked look
// is real positioning (left:0, right:0, bottom:0) rather than composition
// inside a fixed inset -- see the panel style below.

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
  const placeName=place.name || card.name || "This place";

  // Type, rating and where, as one rule-bound strip -- three independent
  // questions ("what is it", "is it any good", "where") read as a single line
  // the way a gazetteer entry's dateline does, joined by · rather than spread
  // across a card.
  const metaParts=[];
  if(card.typeLabel) metaParts.push({key:"type",text:card.typeLabel});
  if(rating===null){
    metaParts.push({key:"rating",text:"Loading reviews…"});
  }else if(rating.count>0){
    metaParts.push({
      key:"rating",
      text:`★ ${rating.average} · ${rating.count} ${rating.count===1 ? "review" : "reviews"}`,
      accessibilityLabel:`Rated ${rating.average} out of 5 from ${rating.count} reviews`
    });
  }else{
    metaParts.push({key:"rating",text:"No reviews yet"});
  }
  if(where) metaParts.push({key:"where",text:where});

  return(
    <View style={styles.panel}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>{placeName}</Text>

          <Pressable
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={`Close ${place.name || "this place"}`}
            hitSlop={12}
            onPress={onClose}
          >
            <Text style={styles.closeMark}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.metaStrip}>
          {metaParts.map((part,index)=>(
            <React.Fragment key={part.key}>
              {index>0 && <Text style={styles.metaDot}> · </Text>}
              <Text style={styles.metaPart} accessibilityLabel={part.accessibilityLabel} numberOfLines={1}>
                {part.text}
              </Text>
            </React.Fragment>
          ))}
        </View>

        {hero
          ? <Image source={{uri:hero}} style={styles.hero} accessibilityIgnoresInvertColors/>
          : (
            // No invented picture. An empty block says "no photo yet", which
            // is true; a stock image of somewhere else would not be.
            <View style={[styles.hero,styles.heroEmpty]}>
              <Text style={styles.heroEmptyText}>No photo yet</Text>
            </View>
          )}

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
  // Docked full-width to the bottom edge rather than floating as an inset
  // card: left:0/right:0/bottom:0, squared bottom corners (the screen edge),
  // rounded top corners only. Capped height so the map stays visible above it.
  panel:{
    position:"absolute",left:0,right:0,bottom:0,zIndex:20,maxHeight:"62%",
    backgroundColor:INK.card,
    borderTopWidth:2,borderTopColor:INK.ink,
    borderTopLeftRadius:12,borderTopRightRadius:12,
    borderBottomLeftRadius:0,borderBottomRightRadius:0
  },
  scroll:{flexGrow:0},
  content:{padding:16},
  nameRow:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},
  name:{...TYPE.headline,flex:1},
  close:{width:32,height:32,alignItems:"center",justifyContent:"center"},
  closeMark:{color:INK.ink,fontWeight:"900",fontSize:18},

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

  // Reduced prominence: full-width strip rather than a square thumbnail beside
  // the text -- the name and the facts carry the entry, the picture is
  // evidence underneath it.
  hero:{width:"100%",height:96,marginTop:12,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.hair},
  heroEmpty:{alignItems:"center",justifyContent:"center"},
  // Full ink, not inkSoft. On the hair-coloured empty block inkSoft is 3.42:1,
  // and scripts/verify-contrast.cjs is right to refuse it -- a label saying
  // there is no photo is no use if you cannot read it either.
  heroEmptyText:{color:INK.ink,fontSize:10,fontWeight:"700",textAlign:"center"},

  summary:{...TYPE.body,marginTop:10},
  open:{
    marginTop:12,minHeight:44,justifyContent:"center",alignItems:"center",
    borderRadius:8,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.paper
  },
  openText:{color:INK.ink,fontWeight:"900",fontSize:14}
});
