import React from "react";
import {View,Text,StyleSheet,Pressable} from "react-native";
import PlaceMarker from "./PlaceMarker";
import {markerForMemory} from "../utils/markers";
import {phaseLabel} from "../utils/memories";
import {INK} from "../utils/tokens";

// One Memory as a row. Shared by both platform builds of MemoryPins so the web
// list and the native no-key fallback cannot drift into two different designs.

export default function MemoryRow({memory,onPress}){
  return(
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`Open ${memory.title || memory.target_name || "this Memory"}`}
      onPress={onPress}
    >
      <PlaceMarker marker={markerForMemory(memory)}/>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{memory.title || memory.target_name || "A Memory"}</Text>
        <Text style={styles.meta} numberOfLines={1}>{phaseLabel(memory)}</Text>
      </View>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  row:{flexDirection:"row",alignItems:"center",gap:11,backgroundColor:INK.ink,borderColor:INK.inkSoft,borderWidth:1,borderRadius:14,padding:12,marginBottom:9},
  body:{flex:1},
  title:{color:INK.card,fontWeight:"900",fontSize:15},
  meta:{color:INK.card,fontSize:12,marginTop:3}
});
