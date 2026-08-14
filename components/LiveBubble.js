import React,{useEffect,useRef} from "react";
import {View,Text,Image,Pressable,Animated,Easing,StyleSheet,AccessibilityInfo} from "react-native";


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
          {backgroundColor:chrome.card,borderColor:chrome.ink,shadowColor:chrome.ink}
        ]}
      >
        {isImage
          ? <Image source={{uri:bubble.imageUrl}} style={[styles.image,{backgroundColor:chrome.blank}]} resizeMode="cover"/>
          : <Text style={[styles.text,{color:chrome.ink}]} numberOfLines={1}>{bubble.text}</Text>}
      </Pressable>

      {/* The tail. What makes it point at its pin rather than float near it. */}
      <View style={[styles.tail,{backgroundColor:chrome.card,borderColor:chrome.ink}]} pointerEvents="none"/>
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
    borderWidth:2,
    borderRadius:14,
    paddingHorizontal:11,
    paddingVertical:8,
    maxWidth:190,
    // Hard offset shadow, never a blur -- the same rule the raised tab button
    // and the place markers follow.
    shadowOffset:{width:2,height:2},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  imageBubble:{padding:3,borderRadius:16},
  // 64, not 92. The picture bubbles were 92 across against a text bubble
  // that is a small pill, and there are more reviews with photos than of
  // anything else -- so the map read as a slideshow. The owner: they are
  // "too prominent". Still a photograph, no longer the whole map.
  image:{width:64,height:64,borderRadius:11},
  text:{fontWeight:"900",fontSize:12},
  tail:{
    alignSelf:"center",
    width:10,
    height:10,
    marginTop:-6,
    borderRightWidth:2,
    borderBottomWidth:2,
    transform:[{rotate:"45deg"}]
  },
  confettiLayer:{position:"absolute",left:0,right:0,top:0,bottom:0,alignItems:"center",justifyContent:"center"},
  confetti:{position:"absolute",width:6,height:9,borderRadius:1}
});
