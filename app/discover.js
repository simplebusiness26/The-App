import React from "react";
import {View,Text,Pressable,StyleSheet,ScrollView} from "react-native";
import {router} from "expo-router";
import {INK} from "../utils/tokens";

// Packet 3 gives Discover a tab; Packet 7 gives it a screen. Until then this is
// the placeholder the brief asks for, and the brief is specific about what a
// placeholder may be: "a real empty state -- 'Nothing here yet' is banned,
// write an instruction".
//
// So this names the discovery surfaces that already work and sends a person to
// them. Every row below goes somewhere real. Nothing here is disabled, and
// nothing here is a preview of a screen that does not exist -- when Packet 7
// lands, this file is replaced rather than unlocked.

const ROUTES=[
  {
    route:"/live",
    title:"Live Nearby",
    detail:"Who is out, what is on, and link-ups forming around you right now."
  },
  {
    route:"/events",
    title:"Events",
    detail:"Dated things, one-off or part of a series."
  },
  {
    route:"/activity-clubs",
    title:"Activity clubs",
    detail:"Groups that meet again and again. Join one and its sessions come to you."
  },
  {
    route:"/linkups",
    title:"Link-ups",
    detail:"Open invitations from other Explorers. Say you are coming and the board opens."
  },
  {
    route:"/feed",
    title:"Explorer feed",
    detail:"What the Explorers you follow have been doing locally."
  }
];

export default function Discover(){
  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.lead}>
        One screen that reads the whole local picture is being built. Until it lands,
        these are the ways to find what is happening.
      </Text>

      {ROUTES.map((item)=>(
        <Pressable
          key={item.route}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={()=>router.push(item.route)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDetail}>{item.detail}</Text>
        </Pressable>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Every recommendation on the finished screen will say why it is being shown.
          If a reason cannot be worked out, the item will not appear at all.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:40},
  title:{fontSize:30,fontWeight:"800",letterSpacing:-0.5,color:INK.ink},
  lead:{fontSize:14,lineHeight:21,color:INK.ink,marginTop:8,marginBottom:20},
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    marginBottom:12,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  cardTitle:{fontSize:17,fontWeight:"800",color:INK.ink},
  cardDetail:{fontSize:13,lineHeight:19,color:INK.ink,marginTop:4},
  note:{borderTopWidth:2,borderTopColor:INK.hair,paddingTop:14,marginTop:8},
  noteText:{fontSize:13,lineHeight:19,color:INK.inkSoft}
});
