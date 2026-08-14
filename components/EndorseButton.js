import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

// Packet 8c: review reputation.
//
// This is not LikeButton with a different label. Moments stay "Like" --
// LikeButton is untouched and still owns that word. A review's endorsement
// is a different claim ("people found this useful"), it can never target the
// reviewer's own review, and the database enforces that (validate_social_target
// in 20260805090000_review_endorsement_reputation.sql) -- so this component
// hides the action entirely for the owner rather than rendering a control that
// exists only to fail.
//
// Still writes straight to social_likes with target_type="review", same table
// LikeButton uses for moments. One table, two words for two different claims.

export default function EndorseButton({reviewId,ownerId,viewerId,initialCount=0,initialEndorsed=false,onChanged}){
  const {showFeedback}=useFeedback();
  const [endorsed,setEndorsed]=useState(!!initialEndorsed);
  const [count,setCount]=useState(Number(initialCount || 0));
  const [working,setWorking]=useState(false);

  useEffect(()=>{
    setEndorsed(!!initialEndorsed);
    setCount(Number(initialCount || 0));
  },[initialEndorsed,initialCount,reviewId]);

  const toggle=useCallback(async()=>{
    if(working || !reviewId) return;

    if(!viewerId){
      router.push("/auth/login");
      return;
    }

    setWorking(true);

    if(endorsed){
      const {error}=await supabase
        .from("social_likes")
        .delete()
        .eq("user_id",viewerId)
        .eq("target_type","review")
        .eq("target_id",reviewId);

      if(error){
        showFeedback(error.message,"error","Endorsement not removed");
        setWorking(false);
        return;
      }

      setEndorsed(false);
      setCount(current=>Math.max(0,current-1));
      if(onChanged) onChanged({endorsed:false,count:Math.max(0,count-1)});
    }else{
      const {error}=await supabase
        .from("social_likes")
        .insert({user_id:viewerId,target_type:"review",target_id:reviewId});

      if(error){
        if(String(error.code)==="23505"){
          setEndorsed(true);
        }else{
          showFeedback(error.message,"error","Could not mark this review as useful");
          setWorking(false);
          return;
        }
      }else{
        setEndorsed(true);
        setCount(current=>current+1);
      }
      if(onChanged) onChanged({endorsed:true,count:count+1});
    }

    setWorking(false);
  },[working,reviewId,viewerId,endorsed,count,onChanged,showFeedback]);

  const label=count===1 ? "1 person found this review useful" : `${count} people found this review useful`;

  // The review's own author: no control that the database would only reject.
  // The count still shows, because the figure belongs to every reader, not
  // just the ones allowed to change it.
  if(viewerId && ownerId && viewerId===ownerId){
    return(
      <Pressable disabled accessibilityRole="text" accessibilityLabel={label} style={styles.button}>
        <Text style={styles.icon}>👍</Text>
        <Text style={styles.text}>{count} Useful</Text>
      </Pressable>
    );
  }

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={endorsed ? `Remove useful mark. ${label}.` : `Mark as useful. ${label}.`}
      style={[styles.button,endorsed && styles.endorsedButton]}
      disabled={working}
      onPress={toggle}
    >
      {working
        ? <ActivityIndicator size="small" color={endorsed ? INK.ink : INK.inkSoft}/>
        : <Text style={[styles.icon,endorsed && styles.endorsedIcon]}>👍</Text>
      }
      <Text style={[styles.text,endorsed && styles.endorsedText]}>{count} Useful</Text>
    </Pressable>
  );
}

// Squared, 2px-bordered, gazetteer round (r001-a): the toggled state is ink
// fill with card text -- the same white-on-ink pairing every other raised
// control in this design uses -- rather than green, which is reserved for the
// manager's review-response pair and appears nowhere else.
const styles=StyleSheet.create({
  button:{flexDirection:"row",alignItems:"center",gap:6,minHeight:38,paddingHorizontal:11,paddingVertical:8,borderRadius:6,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink},
  endorsedButton:{backgroundColor:INK.ink,borderColor:INK.ink},
  icon:{fontSize:15,lineHeight:18},
  endorsedIcon:{},
  text:{color:INK.ink,fontSize:12,fontWeight:"900"},
  endorsedText:{color:INK.card}
});
