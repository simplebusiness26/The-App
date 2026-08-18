import React from "react";
import {View,Text,ScrollView,StyleSheet} from "react-native";
import {LEGAL_DRAFT_NOTICE,LEGAL_UPDATED} from "../utils/legal";
import {INK,TYPE} from "../utils/tokens";
import {Screen,ScreenTitle,SectionRule,Notice,Panel,KeyValue} from "./instrument";
import {CREATE_HUB_CLEARANCE} from "./CreateHub";

// The privacy policy and the terms share a shape, so they share a screen.
//
// THE DRAFT NOTICE IS NOT DECORATION. Neither document has been reviewed by a
// solicitor, and a policy that looks finished is worse than one that says it is
// not -- somebody could publish on the strength of it. It is at the top, in
// full, and it is not dismissible.
//
// It is a Notice now rather than a bordered box. A warning in this design is an
// edge in a state ink with a mono eyebrow, never a filled panel with text
// fighting the fill. `dispute` would be the wrong ink -- that is a manager's
// answer to a review and nothing else -- so it carries `scheduled`, the
// system's "something is going on here you need to know about".
//
// A legal document is the one screen in this app that genuinely IS a document,
// so its paragraphs stay in the body face at a reading measure. The only mono on
// it is the section rules and the date plate, because those are facts the app
// holds rather than sentences somebody wrote.

export default function LegalScreen({title,lead,sections}){
  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle eyebrow="LEGAL" title={title}/>
        {!!lead && <Text style={styles.lead}>{lead}</Text>}

        <Notice tone="scheduled" label="DRAFT">{LEGAL_DRAFT_NOTICE}</Notice>

        <Panel style={styles.datePlate}>
          <KeyValue label="Last updated" value={String(LEGAL_UPDATED)}/>
        </Panel>

        {sections.map((section)=>(
          <View key={section.heading}>
            <SectionRule label={section.heading}/>
            {section.body.map((paragraph,index)=>(
              <Text key={index} style={styles.body}>{paragraph}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  // ScreenTitle's meta line is clamped to one line -- right for a place's
  // "2.4 KM · OPEN NOW", wrong for a sentence, which it silently truncates with
  // an ellipsis. Anything longer than a readout goes here instead.
  lead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:-2,
    marginBottom:14
  },
  datePlate:{paddingHorizontal:13,paddingVertical:2},
  body:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginBottom:10
  }
});
