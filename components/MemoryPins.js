import React,{useState} from "react";
import {ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import LivingMap from "./LivingMap";
import MemoryRow from "./MemoryRow";
import {markerForMemory} from "../utils/markers";
import {memoryPinOpacity} from "../utils/mapLayers";

// My Map's Memories, on the same map as everything else.
//
// WHAT THIS REPLACED, AND WHY THE PLATFORM SPLIT IS GONE
//
// This drew with react-native-maps, which meant three things: a Google logo in
// the corner that cannot be removed at any price, a map that only appeared if
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY was set (it never was, so this was a list
// pretending to be a map), and a `MemoryPins.web.js` twin -- because
// react-native-maps has no web build and importing it from a web route took
// every profile to a blank screen.
//
// All three go away by drawing with the map the rest of the app already uses.
// The platform split lives inside components/LivingMap, one level down, so
// there is nothing here that needs a web copy of itself.
//
// A MEMORY FADES BEFORE IT GOES
//
// utils/mapLayers.js decides the opacity from how far through its map window
// the Memory is -- full strength for the first three quarters, then fading,
// never below MIN_PIN_OPACITY because a pin at 4% is one nobody can tap. A
// Memory leaving the map is not a Memory being deleted; it stays in the
// scrapbook either way.

export default function MemoryPins({memories}){
  // The list is what somebody gets if the map cannot run -- no WebGL, a dead
  // tile host, a style that will not load. It is also the better surface for a
  // screen reader, which is why it was worth keeping when the map arrived.
  const [mapFailed,setMapFailed]=useState(false);

  if(mapFailed || !memories.length){
    return(
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {memories.map((memory)=>(
          <MemoryRow
            key={memory.id}
            memory={memory}
            onPress={()=>router.push(`/memories/${memory.id}`)}
          />
        ))}
      </ScrollView>
    );
  }

  const pins=memories.map((memory)=>({
    key:memory.id,
    latitude:Number(memory.latitude),
    longitude:Number(memory.longitude),
    marker:markerForMemory(memory),
    opacity:memoryPinOpacity(memory),
    onPress:()=>router.push(`/memories/${memory.id}`)
  }));

  return(
    <LivingMap
      pins={pins}
      // Opens on the first Memory rather than on Brighton: this is somebody's
      // own map, and the middle of it is wherever they have been.
      centre={{latitude:Number(memories[0].latitude),longitude:Number(memories[0].longitude)}}
      zoom={11}
      style={styles.map}
      onUnavailable={()=>setMapFailed(true)}
    />
  );
}

const styles=StyleSheet.create({
  map:{height:280,borderRadius:14,overflow:"hidden"},
  list:{maxHeight:320},
  content:{paddingBottom:4}
});
