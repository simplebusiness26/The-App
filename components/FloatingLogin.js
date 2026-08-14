import React,{useCallback,useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK} from "../utils/tokens";

// Log in, on the map, for somebody who is not logged in.
//
// WHY IT IS THE ONLY ONE
//
// components/Header.js used to carry a Log in button as well, so a signed-out
// visitor saw "Log in" twice at once -- the owner's "look at the logins and the
// buttons in the way".
//
// This pair is the one that stayed, for two reasons. It carries CREATE ACCOUNT
// as well, which a header has no room for and which is the one a first visitor
// actually needs; and it sits where a thumb reaches rather than in the far
// corner of a phone.
//
// It disappears the moment somebody is signed in, and it re-checks on every
// focus, so logging in and coming back does not leave a stale button sitting
// over the map.
//
// It sits at the BOTTOM, centred, above the tab bar -- not in the middle of the
// map. A button in the centre of a map covers the one thing the screen is for,
// and it would sit on top of whatever place somebody is trying to look at.

export default function FloatingLogin(){
  const [signedIn,setSignedIn]=useState(null);

  useFocusEffect(useCallback(()=>{
    let alive=true;

    supabase.auth.getUser().then(({data})=>{
      if(alive) setSignedIn(!!data?.user);
    });

    return()=>{alive=false;};
  },[]));

  // null while it does not know yet: showing a Log in button to somebody who is
  // logged in, even for a moment, reads as having been logged out.
  if(signedIn!==false) return null;

  return(
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Log in"
        onPress={()=>router.push("/auth/login")}
      >
        <Text style={styles.text}>Log in</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        accessibilityRole="button"
        accessibilityLabel="Create account"
        onPress={()=>router.push("/auth/signup")}
      >
        <Text style={styles.secondaryText}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{
    position:"absolute",
    left:0,
    right:0,
    bottom:22,
    alignItems:"center",
    flexDirection:"row",
    justifyContent:"center",
    gap:10,
    zIndex:20
  },
  button:{
    backgroundColor:INK.blue,
    borderColor:INK.ink,
    borderWidth:2,
    borderRadius:24,
    paddingHorizontal:26,
    paddingVertical:13,
    minHeight:44,
    justifyContent:"center"
  },
  text:{color:INK.card,fontWeight:"900",fontSize:15},
  secondary:{
    backgroundColor:INK.card,
    borderColor:INK.ink,
    borderWidth:2,
    borderRadius:24,
    paddingHorizontal:20,
    paddingVertical:13,
    minHeight:44,
    justifyContent:"center"
  },
  secondaryText:{color:INK.ink,fontWeight:"900",fontSize:15}
});
