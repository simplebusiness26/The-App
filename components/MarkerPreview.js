import React from "react";
import {View,Text,StyleSheet,Platform} from "react-native";
import PlaceMarker from "./PlaceMarker";
import {markerForBusiness,INK} from "../utils/markers";
import {classificationLabel} from "../utils/taxonomy";

// Packet 2: "Marker preview component for the manager form."
//
// It is a preview and not a picker, and that is the whole point. A manager sees
// the marker their classification produces; there is no control here because
// there is no code path that lets a marker be set by hand. If this component
// ever grows an onChange, the packet has been undone.

export default function MarkerPreview({category,businessType,claimed}){
  const business={category,business_type:businessType,claimed};
  const marker=markerForBusiness(business);

  return(
    <View style={styles.wrap}>
      <PlaceMarker marker={marker}/>

      <View style={styles.text}>
        <Text style={styles.classification}>{classificationLabel(business).toUpperCase()}</Text>
        <Text style={styles.explanation}>
          This is how the place appears on the map. The icon follows the type you pick,
          and the colour is set by what is happening there.
        </Text>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{
    flexDirection:"row",
    alignItems:"center",
    gap:12,
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:12,
    marginTop:12,
    // Hard offset shadow, never a blur -- a blurred shadow belongs to a
    // different product (design-system.md, Surfaces).
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  text:{flex:1},
  // Mono for what the app computed, sans for what a person wrote. The three
  // faces the design system names are not loaded in this app yet, so this is
  // the platform mono until Packet 11 adds them -- the split is preserved even
  // though the faces are not the specified ones.
  classification:{
    fontFamily:Platform.select({ios:"Menlo",android:"monospace",default:"monospace"}),
    fontSize:10,
    letterSpacing:1.2,
    color:INK.ink,
    marginBottom:4
  },
  explanation:{fontSize:13,lineHeight:19,color:INK.ink}
});
