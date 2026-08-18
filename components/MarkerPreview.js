import React from "react";
import {View,Text,StyleSheet} from "react-native";
import PlaceMarker from "./PlaceMarker";
import {markerForBusiness} from "../utils/markers";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {classificationLabel} from "../utils/taxonomy";
import {MONO,Panel} from "./instrument";

// Packet 2: "Marker preview component for the manager form."
//
// It is a preview and not a picker, and that is the whole point. A manager sees
// the marker their classification produces; there is no control here because
// there is no code path that lets a marker be set by hand. If this component
// ever grows a handler, the packet has been undone.
//
// REBUILT ON THE KIT. It used to be a 2px-bordered card with a hard 3px offset
// shadow -- the print system's card, still standing after the housing went
// dark, and outlined in what is now the near-white readout colour. It is a
// Panel now: one surface step, a 1px hairline, and the bevel highlight Panel
// draws for itself.

export default function MarkerPreview({category,businessType,claimed}){
  const business={category,business_type:businessType,claimed};
  const marker=markerForBusiness(business);

  return(
    <Panel style={styles.wrap}>
      {/* The pin sits in its own well, the way every drawn thing in this app
          sits in a frame -- so the preview reads as a specimen under glass
          rather than an icon floating beside a paragraph. The well is at the
          44px tap floor, which is also the pin's own footprint on the map. */}
      <View style={styles.well}>
        <PlaceMarker marker={marker}/>
      </View>

      <View style={styles.text}>
        {/* Mono for what the app worked out. The classification is derived
            from the type a manager picked; it is not a sentence they wrote. */}
        <Text style={styles.classification}>{classificationLabel(business).toUpperCase()}</Text>
        <Text style={styles.explanation}>
          This is how the place appears on the map. The icon follows the type you pick,
          and the colour is set by what is happening there.
        </Text>
      </View>
    </Panel>
  );
}

const styles=StyleSheet.create({
  wrap:{
    flexDirection:"row",
    alignItems:"center",
    gap:12,
    padding:12,
    marginTop:12
  },
  well:{
    width:SHAPE.tapTarget,
    height:SHAPE.tapTarget,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.inset,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control
  },
  text:{flex:1,minWidth:0},
  classification:{
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:1.1,
    textTransform:"uppercase",
    color:INK.readoutSoft,
    marginBottom:5
  },
  // What a person reads, so the body face.
  explanation:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5
  }
});
