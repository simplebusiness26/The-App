import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {ceilingWarning} from "../utils/audience";
import {INK,TYPE} from "../utils/tokens";
import {Action,Notice} from "./instrument";

// "Nobody will see this" — said before somebody posts, not discovered after.
//
// THE PROBLEM THIS SOLVES, WITH A NUMBER
//
// profiles.visibility is a ceiling: a post can be narrower than it and never
// wider. It defaults to `nobody`, which is the correct default and is not up
// for debate. On 2026-08-12, all nineteen accounts in this database were still
// on it -- so every Moment, every Memory and every check-in in the app was
// visible to exactly nobody, and nothing anywhere said so.
//
// That is the shape of a bug report that is not a bug: "I posted it and my
// friend cannot see it". The setting was working perfectly and the app was
// silent about it.
//
// So this sits on the screens where somebody chooses an audience, compares
// what they picked against their own ceiling, and says what will actually
// happen. It never blocks posting -- a private post is a legitimate thing to
// make -- and it never changes the setting on somebody's behalf.
//
// It draws as a Notice: an edge in a state ink and a mono eyebrow, never a
// boxed-in warning card. `exists` rather than a warm ink, because a ceiling is
// a standing fact about an account, not something happening right now.

export default function AudienceCeiling({audience}){
  const [visibility,setVisibility]=useState(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setVisibility(null);return;}

    const {data}=await supabase
      .from("profiles")
      .select("visibility")
      .eq("id",user.id)
      .maybeSingle();

    setVisibility(data?.visibility || "nobody");
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  // Nothing known yet, or nothing to say. Silence is the common case and the
  // right one -- a notice that appears every time is a notice nobody reads.
  if(!visibility) return null;

  const warning=ceilingWarning(visibility,audience);
  if(!warning) return null;

  return(
    <View accessibilityRole="alert" style={styles.wrap}>
      <Notice
        tone="exists"
        label="AUDIENCE CEILING"
        action={
          <Action
            kind="secondary"
            glyph="settings"
            label="Change it in Settings"
            accessibilityLabel="Open Settings to change who can see what you share"
            onPress={()=>router.push("/settings")}
          />
        }
      >
        <View>
          <Text style={styles.title}>Who will actually see this</Text>
          <Text style={styles.body}>{warning}</Text>
        </View>
      </Notice>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{marginTop:12},
  title:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  body:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,
    marginTop:4
  }
});
