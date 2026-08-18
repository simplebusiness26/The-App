import React,{useCallback,useState} from "react";
import {View,Pressable,StyleSheet} from "react-native";
import Svg,{Circle} from "react-native-svg";
import {useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK,SHAPE} from "../utils/tokens";

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
//   lit ring       something live this viewer has not watched
//   faded ring     something live, all of it already watched
//
// The faded ring is what stops the ring being a nag. It says "still there,
// you have seen it" rather than pretending there is something new.
//
// WHY IT IS A DIAL AND NOT A COLOURED CIRCLE
//
// A story ring is genuinely a reading: it says how many Moments are live and
// how many of them are new. A single continuous stroke throws both numbers
// away. So the ring is drawn as DETENTS -- one arc per live Moment, on a dim
// track, with the unwatched ones lit. Counting the lit segments is reading the
// instrument, and the count matches the spoken label exactly.
//
// The lit segments carry `scheduled`, the system's warm "something is happening
// here right now" ink. That is the honest reading for a Moment: it is live and
// it expires. `exists` would say a Moment is a static fact, which is the one
// thing it is not.

// Beyond this the arcs are thinner than the gaps between them and stop reading
// as segments, so the ring caps and the spoken label carries the real number.
const MAX_SEGMENTS=12;
const RING_STROKE=3;
const GAP_DEGREES=7;

function Segments({size,live,unseen}){
  const count=Math.max(1,Math.min(MAX_SEGMENTS,live));
  const lit=Math.max(0,Math.min(count,unseen));
  const centre=size/2;
  const radius=(size-RING_STROKE)/2;
  const circumference=2*Math.PI*radius;
  const step=360/count;
  const gap=count===1 ? 0 : Math.min(GAP_DEGREES,step*0.35);

  const arcs=[];
  for(let i=0;i<count;i++){
    const sweep=step-gap;
    const length=circumference*(sweep/360);
    arcs.push(
      <Circle
        key={i}
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        stroke={i<lit ? INK.scheduled : INK.hairlineStrong}
        strokeWidth={RING_STROKE}
        strokeLinecap="butt"
        strokeDasharray={`${length} ${circumference-length}`}
        transform={`rotate(${-90+i*step} ${centre} ${centre})`}
      />
    );
  }

  return <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">{arcs}</Svg>;
}

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
  const outer=size+12;

  if(!hasStory){
    // No ring, and no button either. A control that opens nothing is worse
    // than no control.
    return <View style={[styles.wrap,{width:outer,height:outer}]}>{children}</View>;
  }

  // The dial's own housing: the unlit track the segments are cut out of. Its
  // border is the track, so a ring with every Moment watched still reads as a
  // ring rather than disappearing.
  // RING_STROKE is the dial's track weight, not a border: it is the same 3px
  // the lit arcs are stroked at, so the unlit track and the lit segments are
  // one continuous ring rather than a ring inside a ring. The system's 1px
  // hairline rule is about edges on panels, chips and rows, and this is neither.
  const track={
    width:outer,
    height:outer,
    borderRadius:SHAPE.radius.pill,
    borderWidth:RING_STROKE,
    borderColor:INK.hairline,
    opacity:unseen ? 1 : 0.75
  };

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unseen
          ? `Watch ${state.unseen} new Moment${state.unseen===1 ? "" : "s"}`
          : `Watch ${state.live} Moment${state.live===1 ? "" : "s"} again`
      }
      style={[styles.wrap,track]}
      onPress={()=>onOpen?.()}
    >
      <Segments size={outer} live={state.live} unseen={state.unseen}/>
      {children}
    </Pressable>
  );
}

const styles=StyleSheet.create({
  wrap:{alignItems:"center",justifyContent:"center",alignSelf:"center"}
});
