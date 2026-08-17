import React from "react";
import {Platform,Text,Pressable,ScrollView,StyleSheet} from "react-native";
import {INK,TYPE,SHAPE} from "../utils/tokens";

// The Happening tab's segmented control.
//
// FINAL_PRODUCT_CONTRACT.md: "Happening: For You (Discover) · Live Now ·
// Events · Clubs · Link-ups — segmented within one destination." Five real
// screens' worth of Supabase logic live behind these five pills; this file
// only draws the row and reports which one is pressed. app/discover.js owns
// the switch.
//
// FIELD INSTRUMENT, NOT RISO. The old riso treatment (card surface, 2px ink
// border, ink fill when selected) is gone with the rest of the print system:
// hairline edges at 1px on a panel surface, and a SELECTED pill steps up a
// surface tone (panel -> panelRaised) with a hairlineStrong edge rather than
// filling with colour. Which sub-screen you are looking at is not a state a
// place is in, so none of exists/scheduled/offer appears here -- that rule
// survived the redesign, only its inks changed.
//
// The labels are mono because they name system categories, not sentences
// somebody wrote.

// The mono face, resolved per platform. The stack in TYPE.data.family is a CSS
// font stack -- correct on web, meaningless to native, which matches a single
// family name only. So native gets a real mono it actually has (the same pair
// components/MarkerPreview.js already uses) and web gets the full stack.
// JetBrains Mono itself is not bundled yet; when it is, this is the one place
// that changes.
const MONO=Platform.select({ios:"Menlo",android:"monospace",default:TYPE.data.family});

export const HAPPENING_SEGMENTS=[
  {key:"for-you",label:"For You"},
  {key:"live",label:"Live"},
  {key:"events",label:"Events"},
  {key:"clubs",label:"Clubs"},
  {key:"linkups",label:"Link-ups"}
];

export default function HappeningSegments({active,onChange}){
  return(
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
      accessibilityRole="tablist"
    >
      {HAPPENING_SEGMENTS.map((segment)=>{
        const selected=segment.key===active;
        return(
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            accessibilityLabel={segment.label}
            style={[styles.pill,selected && styles.pillActive]}
            onPress={()=>onChange(segment.key)}
          >
            <Text style={[styles.pillText,selected && styles.pillTextActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  // DO NOT REMOVE flexGrow/flexShrink. This ScrollView is a flex CHILD of the
  // Happening screen's column (app/discover.js). A horizontal ScrollView has no
  // intrinsic height, so with the default flex rules it claims every pixel of
  // leftover vertical space in that column -- and because a flex container
  // stretches its children by default, each pill then filled the whole of it.
  // Measured: 402px tall pills. flexGrow:0/flexShrink:0 stops the row taking
  // more than its content, and alignItems:"center" on the content container
  // stops the pills stretching to whatever height the row does end up. Measured
  // after: 36px. It looks like tidy-uppable noise. It is the fix.
  row:{
    flexGrow:0,
    flexShrink:0,
    backgroundColor:INK.ground,
    borderBottomWidth:SHAPE.border,
    borderBottomColor:INK.hairline
  },
  rowContent:{
    flexDirection:"row",
    alignItems:"center",
    gap:8,
    paddingHorizontal:16,
    paddingTop:14,
    paddingBottom:14
  },
  pill:{
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:14,
    paddingVertical:9,
    backgroundColor:INK.panel
  },
  // Selection is a surface step and a stronger etched edge, never a state ink.
  pillActive:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  pillText:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  pillTextActive:{color:INK.readout}
});
