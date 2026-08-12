import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet} from "react-native";
import {ATTRIBUTION_SHORT} from "../utils/mapProvider";
import {INK} from "../utils/tokens";

// The first five seconds of the app, and the reason the map has no credit on it.
//
// WHY THIS SCREEN EXISTS
//
// The map data is OpenStreetMap's. It is free to use on one condition -- that
// you say where it came from -- and that condition does not go away because the
// credit is inconvenient. What the licence cares about is that the credit is
// there and a person can find it, not that it sits in the corner of the map.
//
// So it moved. It appears here, full size and readable, every single time the
// app opens, and it appears permanently in Settings with the link to the
// licence itself. The map is then clean.
//
// FIVE SECONDS, AND NOT A FRAME LESS
//
// SPLASH_MS is the floor and there is no way to tap past it. A splash you can
// dismiss in half a second is not attribution, it is a formality, and the whole
// justification for taking the credit off the map is that this screen actually
// does the job instead.
//
// It shows once per launch. Navigating around the app afterwards does not bring
// it back -- app/_layout.js holds the flag, so it covers the app on start
// whichever route the app opened on.

export const SPLASH_MS=5000;

export default function StartupSplash({onDone,duration=SPLASH_MS}){
  const [done,setDone]=useState(false);

  useEffect(()=>{
    const timer=setTimeout(()=>{
      setDone(true);
      if(onDone) onDone();
    },duration);

    return()=>clearTimeout(timer);
  },[duration,onDone]);

  if(done) return null;

  return(
    <View style={styles.screen} accessibilityRole="none">
      <View style={styles.middle}>
        <Text style={styles.wordmark}>Xplorer</Text>
        <Text style={styles.tagline}>Discover local places, stays and experiences.</Text>
      </View>

      {/*
        The credit, and it is not fine print. Same ink as everything else, at a
        size somebody reads without trying -- because this is the app's
        attribution now, and hiding it at 9px in grey would make the whole
        arrangement dishonest.
      */}
      <View style={styles.credit}>
        <Text style={styles.creditText} accessibilityLabel={ATTRIBUTION_SHORT}>
          {ATTRIBUTION_SHORT}
        </Text>
        <Text style={styles.creditSmall}>
          Full licence details are in Settings, under About and licences.
        </Text>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor:INK.paper,
    alignItems:"center",
    justifyContent:"space-between",
    paddingVertical:80,
    paddingHorizontal:28,
    // Above everything, including the tab bar and the header.
    zIndex:1000,
    elevation:1000
  },
  middle:{flex:1,alignItems:"center",justifyContent:"center"},
  wordmark:{color:INK.ink,fontSize:52,fontWeight:"900",letterSpacing:-1},
  tagline:{color:INK.inkSoft,fontSize:16,lineHeight:23,textAlign:"center",marginTop:10},
  credit:{alignItems:"center"},
  creditText:{color:INK.ink,fontSize:16,fontWeight:"700",textAlign:"center"},
  creditSmall:{color:INK.inkSoft,fontSize:12,lineHeight:17,textAlign:"center",marginTop:7}
});
