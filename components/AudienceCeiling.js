import React,{useCallback,useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {ceilingWarning} from "../utils/audience";
import {INK} from "../utils/tokens";

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
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.title}>Who will actually see this</Text>
      <Text style={styles.body}>{warning}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Settings to change who can see what you share"
        style={styles.button}
        onPress={()=>router.push("/settings")}
      >
        <Text style={styles.buttonText}>Change it in Settings</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    marginTop:12
  },
  title:{color:INK.ink,fontWeight:"800",fontSize:14},
  body:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:5},
  button:{
    marginTop:11,
    alignSelf:"flex-start",
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:7,
    backgroundColor:INK.paper
  },
  buttonText:{color:INK.ink,fontWeight:"800",fontSize:12}
});
