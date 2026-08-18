import React,{useEffect,useState} from "react";
import {StyleSheet} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {SHAPE} from "../utils/tokens";
import {Counter} from "./instrument";

// Saving a place to your favourites.
//
// The fourth of the four repeated social controls, and it now wears the same
// machined shape as LikeButton, EndorseButton, FollowButton and
// EntityFollowButton: a stroked Glyph, a mono label, a 1px hairline, stepping
// up to panelRaised + hairlineStrong once you have saved. It used to be a
// filled/hollow heart character in a pill that filled with the map's `exists`
// cyan when active -- a state ink spent on "I pressed this", which is not a
// state a place is in, and a heart drawn by whichever font the phone picked.
export default function FavouriteButton({targetType,targetId,targetName,targetImageUrl,compact=false}){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [favourite,setFavourite]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{loadFavourite();},[targetType,targetId]);

  async function loadFavourite(){
    setLoading(true);
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    if(!currentUser){
      setFavourite(null);
      setLoading(false);
      return;
    }

    const {data:favouriteRow}=await supabase
      .from("explorer_favourites")
      .select("*")
      .eq("user_id",currentUser.id)
      .eq("target_type",targetType)
      .eq("target_id",targetId)
      .maybeSingle();

    setFavourite(favouriteRow || null);
    setLoading(false);
  }

  async function toggleFavourite(){
    if(saving) return;
    if(!user){
      router.push("/auth/login");
      return;
    }
    setSaving(true);
    if(favourite){
      const {error}=await supabase.from("explorer_favourites").delete().eq("id",favourite.id).eq("user_id",user.id);
      if(error){
        showFeedback(error.message,"error","Favourite not removed");
      }else{
        setFavourite(null);
        showFeedback(`${targetName || "This place"} was removed from your favourites.`,"success","Favourite removed");
      }
    }else{
      const {data,error}=await supabase
        .from("explorer_favourites")
        .insert({
          user_id:user.id,
          target_type:targetType,
          target_id:targetId,
          target_name:targetName || "Xplorer place",
          target_image_url:targetImageUrl || null,
          is_public:true
        })
        .select("*")
        .single();

      if(error){
        showFeedback(error.message,"error","Favourite not saved");
      }else{
        setFavourite(data);
        showFeedback(`${targetName || "This place"} now appears in your favourite places.`,"success","Favourite saved");
      }
    }
    setSaving(false);
  }

  // Still finding out whether this is already a favourite. The control holds
  // its place at full size so the row does not reflow when the answer lands;
  // compact renders nothing, because a compact one sits inline in a sentence
  // where a placeholder would read as a word.
  if(loading){
    return compact ? null : (
      <Counter busy glyph="bookmark" label="" style={styles.full} accessibilityLabel="Loading favourites"/>
    );
  }

  const saved=!!favourite;

  // The kit's Counter -- see components/LikeButton.js.
  return(
    <Counter
      glyph="bookmark"
      label={saved ? "Saved to favourites" : "Add to favourites"}
      acted={saved}
      busy={saving}
      compact={compact}
      style={compact?styles.compact:styles.full}
      accessibilityLabel={saved ? `Remove ${targetName || "listing"} from favourites` : `Add ${targetName || "listing"} to favourites`}
      onPress={toggleFavourite}
    />
  );
}

const styles=StyleSheet.create({
  // Width floors only; every other property is Counter's.
  full:{minWidth:160,minHeight:SHAPE.tapTarget,paddingHorizontal:16},
  compact:{minWidth:120,paddingHorizontal:11}
});
