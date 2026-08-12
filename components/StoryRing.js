import React,{useCallback,useState} from "react";
import {View,Pressable,StyleSheet} from "react-native";
import {useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK} from "../utils/tokens";

// The ring round a profile picture, and the only way into somebody's live
// Moments.
//
// WHY A RING AND NOT A GALLERY
//
// A Moment is NOW. It expires. The profile used to carry a permanent grid of
// every Moment somebody had ever posted, which made a Moment a slightly worse
// Memory -- same photo, same permanence, two names. The Memory gallery is the
// permanent one; this is the live one, and when there is nothing live there is
// no ring rather than an empty section.
//
// WHAT IT ASKS THE DATABASE
//
// get_moment_story_state returns two integers and no content. That is on
// purpose (20260811230000): a profile listing must not be usable to enumerate
// what somebody has posted, so the Moments themselves are fetched only when
// somebody actually taps.
//
// THREE STATES, AND THE MIDDLE ONE IS THE POINT
//
//   no ring        nothing live, or nothing this viewer may see
//   solid ring     something live this viewer has not watched
//   faded ring     something live, all of it already watched
//
// The faded ring is what stops the ring being a nag. It says "still there,
// you have seen it" rather than pretending there is something new.

export default function StoryRing({ownerId,size=112,children,onOpen}){
  const [state,setState]=useState({live:0,unseen:0,known:false});

  const load=useCallback(async()=>{
    if(!ownerId){setState({live:0,unseen:0,known:true});return;}

    const {data,error}=await supabase.rpc("get_moment_story_state",{p_owner_id:ownerId});

    // A failed read draws no ring. Drawing one that opens an empty viewer is
    // worse than drawing none.
    if(error){
      setState({live:0,unseen:0,known:true});
      return;
    }

    const row=Array.isArray(data) ? data[0] : data;
    setState({
      live:Number(row?.live_count || 0),
      unseen:Number(row?.unseen_count || 0),
      known:true
    });
  },[ownerId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const hasStory=state.live>0;
  const unseen=state.unseen>0;

  const ring={
    width:size+12,
    height:size+12,
    borderRadius:(size+12)/2,
    borderWidth:hasStory ? 3 : 0,
    borderColor:unseen ? INK.blue : INK.hair,
    opacity:hasStory && !unseen ? 0.75 : 1
  };

  if(!hasStory){
    // No ring, and no button either. A control that opens nothing is worse
    // than no control.
    return <View style={[styles.wrap,{width:size+12,height:size+12}]}>{children}</View>;
  }

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unseen
          ? `Watch ${state.unseen} new Moment${state.unseen===1 ? "" : "s"}`
          : `Watch ${state.live} Moment${state.live===1 ? "" : "s"} again`
      }
      style={[styles.wrap,ring]}
      onPress={()=>onOpen?.()}
    >
      {children}
    </Pressable>
  );
}

const styles=StyleSheet.create({
  wrap:{alignItems:"center",justifyContent:"center",alignSelf:"center"}
});
