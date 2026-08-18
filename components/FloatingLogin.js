import React,{useCallback,useState} from "react";
import {View,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {SHAPE} from "../utils/tokens";
import {Action} from "./instrument";

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
      {/* THE KIT'S BUTTON, NOT TWO HAND-ROLLED PILLS.
          These were a 24px-radius filled pill and a 2px-bordered white one --
          the print system's shape, which recolouring never touched. Action
          carries the instrument's control radius, its 1px edge, its mono
          uppercase label and the dark-text-on-filled-ink contrast rule. */}
      <Action kind="primary" label="Log in" glyph="person" style={styles.button}
        onPress={()=>router.push("/auth/login")}/>
      <Action kind="secondary" label="Create account" style={styles.secondary}
        onPress={()=>router.push("/auth/signup")}/>
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
  // Both float over a live map, so both take the ambient shadow the design
  // system reserves for genuinely floating things.
  button:{...SHAPE.shadow.floating},
  secondary:{...SHAPE.shadow.floating}
});
