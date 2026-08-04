import React from "react";
import {View,Text,Pressable,StyleSheet,ActivityIndicator} from "react-native";
import {router} from "expo-router";
import {INK} from "../utils/tokens";

// What a screen shows instead of itself when the person opening it is not
// entitled to. Shared by the three listing management screens because the
// wording and the shape are the same on all of them, and three copies of a
// refusal is how three different refusals eventually appear.
//
// Never a dead end: a refusal that does not say what to do next is the "Nothing
// here" the design system bans, with extra steps.
export default function GateNotice({checking,message}){
  if(checking){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  return(
    <View style={styles.centre}>
      <Text style={styles.title}>Not your screen yet</Text>
      <Text style={styles.body}>{message}</Text>

      <Pressable
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel="Open the manager dashboard"
        onPress={()=>router.replace("/manager/dashboard")}
      >
        <Text style={styles.actionText}>Open the manager dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  centre:{flex:1,alignItems:"center",justifyContent:"center",padding:26,backgroundColor:INK.paper},
  title:{fontSize:22,fontWeight:"800",color:INK.ink,marginBottom:10,textAlign:"center"},
  body:{fontSize:14,lineHeight:21,color:INK.ink,textAlign:"center",marginBottom:20},
  action:{
    minHeight:48,
    justifyContent:"center",
    paddingHorizontal:18,
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  actionText:{fontSize:15,fontWeight:"700",color:INK.ink}
});
