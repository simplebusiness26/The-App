import React from "react";
import {View,Text,StyleSheet} from "react-native";
import {INK} from "../utils/tokens";

/**
 * Alex challenger context header.
 *
 * This is intentionally not a renamed frozen-Xplorer page title. It tells the
 * user which phase of the real-world journey they are in and what the surface
 * is for, then gets out of the way. Children are existing actions only.
 */
export default function AlexJourneyHeader({phase,title,description,meta,children,compact=false}){
  return(
    <View style={[styles.wrap,compact && styles.compact]}>
      <View style={styles.phaseRow}>
        <View style={styles.phasePill}>
          <Text style={styles.phase}>{phase}</Text>
        </View>
        {!!meta && <Text style={styles.meta}>{meta}</Text>}
      </View>
      <Text style={[styles.title,compact && styles.compactTitle]}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{
    backgroundColor:INK.navy,
    borderRadius:28,
    paddingHorizontal:20,
    paddingVertical:20,
    marginBottom:18,
    overflow:"hidden"
  },
  compact:{paddingVertical:16,borderRadius:22},
  phaseRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12},
  phasePill:{
    alignSelf:"flex-start",
    backgroundColor:INK.brand,
    borderRadius:99,
    paddingHorizontal:10,
    paddingVertical:6
  },
  phase:{color:INK.navy,fontSize:11,fontWeight:"900",letterSpacing:0.8,textTransform:"uppercase"},
  meta:{color:INK.onNavySoft,fontSize:12,fontWeight:"700",textAlign:"right",flexShrink:1},
  title:{color:INK.onNavy,fontSize:34,lineHeight:38,fontWeight:"900",letterSpacing:-1.1,maxWidth:520},
  compactTitle:{fontSize:28,lineHeight:32},
  description:{color:INK.onNavySoft,fontSize:15,lineHeight:22,marginTop:9,maxWidth:560},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:9,marginTop:17}
});
