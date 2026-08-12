import React from "react";
import {View,Text,StyleSheet,Pressable} from "react-native";
import {router} from "expo-router";
import {INK} from "../utils/tokens";

// Direct messages are not built. This screen exists because the owner asked for
// the tab to be visible now so the footer can be judged with all five slots in
// place -- and a tab that leads nowhere at all is worse than one that says so.
//
// It is deliberately NOT a fake inbox. No empty conversation list, no greyed-out
// compose button, nothing that looks like a feature waiting for data. It states
// plainly that the thing does not exist yet and offers the way back. When
// messaging is built this file is replaced wholesale.
export default function Messages(){
  return(
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>NOT BUILT YET</Text>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.body}>
        Direct messages between friends are still to come. This tab is here so the rest of
        the app can be laid out around it — there is nothing behind it yet.
      </Text>
      <Pressable style={styles.button} onPress={()=>router.replace("/map")}>
        <Text style={styles.buttonText}>Back to the map</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  eyebrow:{color:INK.inkSoft,fontSize:10,fontWeight:"900",letterSpacing:1.2},
  title:{color:INK.ink,fontSize:30,fontWeight:"900",marginTop:6},
  body:{color:INK.inkSoft,fontSize:14,lineHeight:21,textAlign:"center",marginTop:12,maxWidth:340},
  button:{marginTop:22,borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:20,paddingVertical:10,backgroundColor:INK.card},
  buttonText:{color:INK.ink,fontWeight:"800"}
});
