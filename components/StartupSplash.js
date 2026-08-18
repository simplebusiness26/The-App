import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet} from "react-native";
import {ATTRIBUTION_SHORT} from "../utils/mapProvider";
import {INK,TYPE} from "../utils/tokens";
import {MONO,TickScale} from "./instrument";

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
//
// WHAT IT LOOKS LIKE, AND WHY THAT IS ALL
//
// The instrument powering up: the wordmark, an etched rule with real ticks
// under it, and the credit. The tagline that used to sit under the wordmark was
// a mood, and docs/design-system.md bans those; this screen has exactly one job
// that is not decoration, so nothing else is on it. The rule is TickScale from
// the kit -- the same ruler under every ScreenTitle -- so the first thing
// anybody sees is already the app's own language rather than a title card.

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
        <View style={styles.rule}>
          <TickScale width={126} height={12} count={13} majorEvery={4} colour={INK.hairlineStrong}/>
          <View style={styles.ruleLine}/>
        </View>
      </View>

      {/*
        The credit, and it is not fine print. The readout colour, at a size
        somebody reads without trying -- because this is the app's attribution
        now, and hiding it at 9px in grey would make the whole arrangement
        dishonest. Mono, because it is a stated fact about where the data came
        from rather than a sentence somebody wrote.
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
    backgroundColor:INK.ground,
    alignItems:"center",
    justifyContent:"space-between",
    paddingVertical:80,
    paddingHorizontal:28,
    // Above everything, including the tab bar and the header.
    zIndex:1000,
    elevation:1000
  },
  middle:{flex:1,alignItems:"center",justifyContent:"center"},
  wordmark:{color:INK.readout,fontSize:52,fontWeight:"700",letterSpacing:-1},
  rule:{flexDirection:"row",alignItems:"flex-end",width:206,marginTop:14},
  ruleLine:{flex:1,height:1,backgroundColor:INK.hairline},
  credit:{alignItems:"center",gap:9},
  creditText:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    textTransform:"uppercase",
    letterSpacing:1,
    textAlign:"center"
  },
  creditSmall:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    textAlign:"center"
  }
});
