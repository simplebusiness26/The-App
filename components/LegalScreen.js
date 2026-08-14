import React from "react";
import {View,Text,ScrollView,StyleSheet} from "react-native";
import {LEGAL_DRAFT_NOTICE,LEGAL_UPDATED} from "../utils/legal";
import {INK} from "../utils/tokens";

// The privacy policy and the terms share a shape, so they share a screen.
//
// THE DRAFT NOTICE IS NOT DECORATION. Neither document has been reviewed by a
// solicitor, and a policy that looks finished is worse than one that says it is
// not -- somebody could publish on the strength of it. It is at the top, in
// full, and it is not dismissible.

export default function LegalScreen({title,lead,sections}){
  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Last updated {LEGAL_UPDATED}</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Draft</Text>
        <Text style={styles.noticeText}>{LEGAL_DRAFT_NOTICE}</Text>
      </View>

      {!!lead && <Text style={styles.lead}>{lead}</Text>}

      {sections.map((section)=>(
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.body.map((paragraph,index)=>(
            <Text key={index} style={styles.body}>{paragraph}</Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:22,paddingBottom:60},
  title:{color:INK.ink,fontSize:31,fontWeight:"900"},
  updated:{color:INK.inkSoft,fontSize:12,fontWeight:"700",marginTop:6},
  notice:{
    backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,
    borderRadius:12,padding:14,marginTop:16
  },
  noticeTitle:{color:INK.ink,fontWeight:"900",fontSize:15},
  noticeText:{color:INK.ink,fontSize:13,lineHeight:19,marginTop:6},
  lead:{color:INK.ink,fontSize:15,lineHeight:22,marginTop:18},
  section:{marginTop:24},
  heading:{color:INK.ink,fontSize:19,fontWeight:"900",marginBottom:8},
  body:{color:INK.ink,fontSize:14,lineHeight:21,marginBottom:10}
});
