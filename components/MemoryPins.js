import React from "react";
import {ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import MapView,{Marker} from "react-native-maps";
import PlaceMarker from "./PlaceMarker";
import MemoryRow from "./MemoryRow";
import {markerForMemory} from "../utils/markers";
import {phaseLabel} from "../utils/memories";

// Packet 8b, native build. `MemoryPins.web.js` is the web one and explains why
// the split exists: react-native-maps has no web build, so the import must not
// be reachable from a web route.
//
// Even here the map is conditional. app/map.js does the same thing, and the
// ledger records that no EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set, which makes the
// list the shipping path on native too. The brief is explicit: do not assume a
// map.

function region(memories){
  return{
    latitude:Number(memories[0].latitude),
    longitude:Number(memories[0].longitude),
    latitudeDelta:0.12,
    longitudeDelta:0.12
  };
}

export default function MemoryPins({memories}){
  const apiKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if(!apiKey){
    return(
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {memories.map(memory=>(
          <MemoryRow
            key={memory.id}
            memory={memory}
            onPress={()=>router.push(`/memories/${memory.id}`)}
          />
        ))}
      </ScrollView>
    );
  }

  // initialRegion and never `region`, per Packet 6: a controlled region drags
  // the map back to a fixed point on every re-render.
  return(
    <MapView style={styles.map} initialRegion={region(memories)}>
      {memories.map(memory=>(
        <Marker
          key={memory.id}
          coordinate={{latitude:Number(memory.latitude),longitude:Number(memory.longitude)}}
          title={memory.title || memory.target_name || "A Memory"}
          description={phaseLabel(memory)}
          onPress={()=>router.push(`/memories/${memory.id}`)}
        >
          <PlaceMarker marker={markerForMemory(memory)}/>
        </Marker>
      ))}
    </MapView>
  );
}

const styles=StyleSheet.create({
  map:{height:280,borderRadius:14,overflow:"hidden"},
  list:{maxHeight:320},
  content:{paddingBottom:4}
});
