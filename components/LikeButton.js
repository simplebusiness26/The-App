import React,{useCallback,useEffect,useState} from "react";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {Counter} from "./instrument";

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
//
// WHAT IT LOOKS LIKE, AND WHY IT MATCHES THREE OTHER FILES
//
// Like, endorse, follow and favourite are the four most-repeated controls in
// the app, and they used to be four different print pills -- one filled red
// with a heart character in it, one filled green with a thumbs-up emoji, one
// filled blue, one outlined.
// An emoji carries its own colour and weight, so on a dark instrument face it
// reads as a sticker; and a fill in a state ink says "this place IS something",
// which is not what having pressed a button means.
//
// So all four are now ONE machined control: a stroked Glyph, a mono count, a
// 1px hairline. Acting on it steps the surface up (panel -> panelRaised) and
// strengthens the edge, exactly the way a selected chip does. It is the same
// shape as the comment button in components/FeedCard.js, which is what makes a
// feed row's action strip read as one instrument rather than four badges.
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

  // The kit's Counter. This file used to carry its own twelve-line copy of the
  // same shape, and so did the four other controls in this row -- which is how
  // the buttons under a post drift apart, one tweak at a time.
  return(
    <Counter
      glyph="heart"
      count={count}
      acted={liked}
      busy={working}
      accessibilityLabel={liked ? "Remove like" : "Like"}
      onPress={toggle}
    />
  );
}

// The shared shape. Four files carry it because the kit has no "counter"
// primitive to hold it -- see the note at the top.
