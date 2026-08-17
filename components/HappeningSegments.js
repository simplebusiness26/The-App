import React from "react";
import {View,Text,Pressable,ScrollView,StyleSheet} from "react-native";
import {INK} from "../utils/tokens";

// The Happening tab's segmented control.
//
// FINAL_PRODUCT_CONTRACT.md: "Happening: For You (Discover) · Live Now ·
// Events · Clubs · Link-ups — segmented within one destination." Five real
// screens' worth of Supabase logic live behind these five pills; this file
// only draws the row and reports which one is pressed. app/discover.js owns
// the switch.
//
// Styled off the same chip language every other filter row in this app
// already uses (see app/checkins/create.js's TYPES row) rather than a new
// pattern: card surface, 2px ink border, ink fill + card text when selected.
// No ink-blue/pink/yellow here -- those are state colours (design-system.md),
// and which sub-screen you are looking at is not a state a place is in.

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
  row:{backgroundColor:INK.paper,borderBottomWidth:2,borderBottomColor:INK.ink},
  rowContent:{flexDirection:"row",gap:8,paddingHorizontal:16,paddingTop:14,paddingBottom:14},
  pill:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:9,
    backgroundColor:INK.card
  },
  pillActive:{backgroundColor:INK.ink},
  pillText:{color:INK.ink,fontWeight:"800",fontSize:12,letterSpacing:0.1},
  pillTextActive:{color:INK.card}
});
