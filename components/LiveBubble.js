import React,{useEffect,useRef} from "react";
import {View,Text,Image,Pressable,Animated,Easing,StyleSheet,AccessibilityInfo} from "react-native";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {MONO} from "./instrument";


// One bubble, on the native map.
//
// It does not decide whether it should exist -- utils/liveBubbles.js does that,
// for all of them at once, which is the only way "no more than three, rotating,
// never two on the same pin" can be true. This draws what it is given.
//
// WHAT IT MUST NOT DO
// Move or resize the map. It is drawn inside a Marker anchored to the pin, so
// it travels with the map rather than the map travelling to it. There is no
// camera call anywhere in this file and there must not be one.
//
// A REVIEW BUBBLE IS THE PHOTO
// Not the photo plus the review text plus the reviewer plus the stars. A
// compact rounded picture, and tapping it opens the review where all of that
// already lives. utils/liveBubbles.js refuses a review with no image.
//
// GEOMETRY FROM THE KIT, INK FROM utils/markers.js
// This file used to import no tokens at all, so it was drawing a 2px border and
// a hard 3px offset shadow -- the print system -- around whatever colours it was
// handed. Both of those are now the instrument's: a 1px hairline at a radius out
// of SHAPE.radius, no shadow, and the bubble's own label set in the data face,
// because "Spaces open" and "Happening now" are readings the app computed rather
// than sentences a person wrote.
//
// The division of labour is unchanged and deliberate: bubbleAppearance() in
// utils/markers.js still decides what colour a bubble's INK is (a renderer
// draws; it does not decide what a colour means). What moved here is the
// geometry, which was never that module's to own -- and the border in
// particular, which was being drawn in chrome.ink. Under the instrument palette
// that key is the near-white READOUT colour, so every bubble on the map was
// outlined in white. Same failure as the feed card outlined in INK.ink.
//
// THE CONFETTI STAYS EXACTLY AS IT IS. docs/design-system.md spends the three
// state inks only on what a place IS, and celebrationPieces() in
// utils/markers.js breaks that on purpose: the owner was told about the
// conflict and chose the burst. It is a recorded decision, fired once, only for
// an Event actually happening. Not drift, and not this packet's to overturn.

const FADE_MS=260;

// Half of the 34px pin in components/PlaceMarker.js.
const PIN_RADIUS=17;

export default function LiveBubble({bubble,onPress}){
  const fade=useRef(new Animated.Value(0)).current;
  const celebrate=useRef(new Animated.Value(0)).current;
  const reduceMotion=useRef(false);

  useEffect(()=>{
    let alive=true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled)=>{if(alive) reduceMotion.current=!!enabled;})
      .catch(()=>{})
      .finally(()=>{
        if(!alive) return;

        // Reduced motion still gets the bubble -- it is information, not
        // decoration. It simply arrives rather than fading in.
        if(reduceMotion.current){
          fade.setValue(1);
          celebrate.setValue(0);
          return;
        }

        Animated.timing(fade,{
          toValue:1,
          duration:FADE_MS,
          easing:Easing.out(Easing.quad),
          useNativeDriver:true
        }).start();

        if(bubble?.celebrate){
          // ONE burst. Not a loop, not a screen-wide effect, and nothing that
          // continues after it has finished. Deliberately started from zero
          // every time this bubble mounts, so it cannot repeat while it sits.
          celebrate.setValue(0);
          Animated.timing(celebrate,{
            toValue:1,
            duration:900,
            easing:Easing.out(Easing.quad),
            useNativeDriver:true
          }).start();
        }
      });

    return()=>{alive=false;};
  },[bubble?.key,bubble?.celebrate,fade,celebrate]);

  if(!bubble) return null;

  const isImage=!!bubble.imageUrl;
  // Painted from what the screen handed over. A renderer draws; utils/markers.js
  // decides what a colour means.
  const chrome=bubble.chrome || {};

  return(
    <Animated.View style={[styles.stack,{opacity:fade}]} pointerEvents="box-none">
      {bubble.celebrate && (
        <View style={styles.confettiLayer} pointerEvents="none">
          {(bubble.confetti || []).map((piece,index)=>(
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  backgroundColor:piece.colour,
                  opacity:celebrate.interpolate({inputRange:[0,0.7,1],outputRange:[1,1,0]}),
                  transform:[
                    {translateX:celebrate.interpolate({inputRange:[0,1],outputRange:[0,piece.x]})},
                    {translateY:celebrate.interpolate({inputRange:[0,1],outputRange:[0,piece.y]})},
                    {rotate:celebrate.interpolate({inputRange:[0,1],outputRange:["0deg",piece.spin]})}
                  ]
                }
              ]}
            />
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={bubble.label || bubble.text || "Open"}
        onPress={()=>onPress?.(bubble)}
        style={[
          styles.bubble,
          isImage && styles.imageBubble,
          {backgroundColor:chrome.card || INK.panel}
        ]}
      >
        {/* The bevel every panel in this app carries, so a bubble reads as a
            lit plate on the housing rather than a sticker on the map. */}
        <View style={styles.bubbleEdge} pointerEvents="none"/>
        {isImage
          ? <Image source={{uri:bubble.imageUrl}} style={[styles.image,{backgroundColor:chrome.blank || INK.inset}]} resizeMode="cover"/>
          : <Text style={[styles.text,{color:chrome.ink || INK.readout}]} numberOfLines={1}>{bubble.text}</Text>}
      </Pressable>

      {/* The tail. What makes it point at its pin rather than float near it. */}
      <View style={[styles.tail,{backgroundColor:chrome.card || INK.panel}]} pointerEvents="none"/>
    </Animated.View>
  );
}

const styles=StyleSheet.create({
  // Lifted by half a pin. The marker's anchor puts the BOTTOM of this view on
  // the coordinate, and a pin is 34px drawn centred on the same coordinate --
  // so without this the tail tip lands in the middle of the pin instead of on
  // top of it. See the anchor note in components/LivingMap.js.
  stack:{marginBottom:PIN_RADIUS},
  bubble:{
    // 1px, not 2px. Elevation is the surface step and the bevel below, never
    // the print system's hard offset.
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,
    paddingHorizontal:11,
    paddingVertical:8,
    maxWidth:190,
    overflow:"hidden"
  },
  bubbleEdge:{
    position:"absolute",top:0,left:0,right:0,height:1,
    backgroundColor:SHAPE.edgeHighlight
  },
  imageBubble:{padding:3},
  // 64, not 92. The picture bubbles were 92 across against a text bubble
  // that is a small pill, and there are more reviews with photos than of
  // anything else -- so the map read as a slideshow. The owner: they are
  // "too prominent". Still a photograph, no longer the whole map.
  image:{width:64,height:64,borderRadius:SHAPE.radius.control},
  // What the app worked out about this pin, so: the data face.
  text:{
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    textTransform:"uppercase",
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.lg
  },
  tail:{
    alignSelf:"center",
    width:10,
    height:10,
    marginTop:-6,
    borderRightWidth:SHAPE.border,
    borderBottomWidth:SHAPE.border,
    borderRightColor:INK.hairline,
    borderBottomColor:INK.hairline,
    transform:[{rotate:"45deg"}]
  },
  confettiLayer:{position:"absolute",left:0,right:0,top:0,bottom:0,alignItems:"center",justifyContent:"center"},
  confetti:{position:"absolute",width:6,height:9,borderRadius:1}
});
