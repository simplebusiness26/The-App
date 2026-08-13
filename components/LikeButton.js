import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

// viewerId is a PROP, and that is the whole point of this signature.
//
// This component used to call supabase.auth.getUser() in its own effect. One
// button, one call -- fine on a place page. The feed renders one of these per
// card, so a screen of twenty Moments fired twenty auth calls on mount, plus
// the screen's own, for an answer every one of them was asking about the same
// person. It was measurably the largest thing the feed did on load.
//
// EndorseButton has always taken viewerId as a prop. This now matches it.
// Callers that genuinely have no viewer to hand can pass nothing: the button
// still renders and a press sends them to log in, which is what the effect
// produced anyway.
export default function LikeButton({targetType,targetId,viewerId=null,initialCount=0,initialLiked=false,onChanged}){
  const {showFeedback}=useFeedback();
  const [liked,setLiked]=useState(!!initialLiked);
  const [count,setCount]=useState(Number(initialCount || 0));
  const [working,setWorking]=useState(false);

  const user=viewerId ? {id:viewerId} : null;

  useEffect(()=>{
    setLiked(!!initialLiked);
    setCount(Number(initialCount || 0));
  },[initialLiked,initialCount,targetId]);

  const toggle=useCallback(async()=>{
    if(working || !targetId) return;

    if(!user){
      router.push("/auth/login");
      return;
    }

    setWorking(true);

    if(liked){
      const {error}=await supabase
        .from("social_likes")
        .delete()
        .eq("user_id",user.id)
        .eq("target_type",targetType)
        .eq("target_id",targetId);

      if(error){
        showFeedback(error.message,"error","Like not removed");
        setWorking(false);
        return;
      }

      setLiked(false);
      setCount(current=>Math.max(0,current-1));
    }else{
      const {error}=await supabase
        .from("social_likes")
        .insert({user_id:user.id,target_type:targetType,target_id:targetId});

      if(error){
        if(String(error.code)==="23505"){
          setLiked(true);
        }else{
          showFeedback(error.message,"error","Could not like this post");
          setWorking(false);
          return;
        }
      }else{
        setLiked(true);
        setCount(current=>current+1);
      }
    }

    setWorking(false);
    if(onChanged) onChanged({liked:!liked,count:liked?Math.max(0,count-1):count+1});
  },[working,targetId,user,liked,targetType,count,onChanged,showFeedback]);

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={liked ? "Remove like" : "Like"}
      style={[styles.button,liked && styles.likedButton]}
      disabled={working}
      onPress={toggle}
    >
      {working ? <ActivityIndicator size="small" color={liked?INK.pink:INK.inkSoft}/> : <Text style={[styles.icon,liked && styles.likedIcon]}>{liked ? "♥" : "♡"}</Text>}
      <Text style={[styles.text,liked && styles.likedText]}>{count}</Text>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  button:{flexDirection:"row",alignItems:"center",gap:6,minHeight:38,paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink},
  likedButton:{backgroundColor:INK.red,borderColor:INK.red},
  icon:{color:INK.ink,fontSize:20,lineHeight:20},
  likedIcon:{color:INK.card},
  text:{color:INK.ink,fontSize:12,fontWeight:"900"},
  likedText:{color:INK.card}
});
