import React from "react";
import {View,StyleSheet,Pressable} from "react-native";
import PlaceMarker from "./PlaceMarker";
import {markerForMemory} from "../utils/markers";
import {phaseLabel} from "../utils/memories";
import {Chip,Row} from "./instrument";

// One Memory as a row. Used by MemoryPins when the map cannot run, so the
// list and the native no-key fallback cannot drift into two different designs.
//
// It is the kit's Row now rather than a hand-drawn card. The pin sits in the
// measured column on the right, where everything the app worked out about a
// row lives, and the phase -- "Live until 4 Sep", "Archived" -- is a mono chip
// under the title, because colour is never the only carrier of meaning and a
// pin's ink alone cannot say which of the two a Memory is in.
//
// The Pressable is the outer wrapper rather than Row's own onPress because Row
// composes its spoken label from the title and the meta, and this row's label
// says what pressing it DOES. See the report note: Row has no accessibilityLabel
// override.
export default function MemoryRow({memory,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${memory.title || memory.target_name || "this Memory"}`}
      onPress={onPress}
    >
      <Row
        title={memory.title || memory.target_name || "A Memory"}
        right={<PlaceMarker marker={markerForMemory(memory)}/>}
      >
        <View style={styles.phase}>
          <Chip label={phaseLabel(memory)}/>
        </View>
      </Row>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  phase:{flexDirection:"row",marginTop:7}
});
