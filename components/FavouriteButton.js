import React,{useEffect,useState} from "react";
import {Pressable,Text,StyleSheet,ActivityIndicator} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO} from "./instrument";

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

  if(loading){
    return compact ? null : (
      <Pressable style={[styles.control,styles.full,styles.disabled]} disabled>
        <ActivityIndicator size="small" color={INK.readoutSoft}/>
      </Pressable>
    );
  }

  const saved=!!favourite;

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${targetName || "listing"} from favourites` : `Add ${targetName || "listing"} to favourites`}
      accessibilityState={{selected:saved,disabled:saving}}
      style={[styles.control,compact ? styles.compact : styles.full,saved && styles.controlOn,saving && styles.disabled]}
      onPress={toggleFavourite}
      disabled={saving}
    >
      {saving
        ? <ActivityIndicator size="small" color={INK.readoutSoft}/>
        : (
          <>
            <Glyph name="bookmark" size={14} colour={saved?INK.readout:INK.readoutSoft} weight={saved?1.9:1.5}/>
            <Text style={[styles.label,saved && styles.labelOn]} numberOfLines={1}>
              {saved ? "Saved to favourites" : "Add to favourites"}
            </Text>
          </>
        )}
    </Pressable>
  );
}

const styles=StyleSheet.create({
  control:{
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  full:{minHeight:SHAPE.tapTarget,paddingHorizontal:16,paddingVertical:12,marginTop:12},
  compact:{minHeight:38,paddingHorizontal:12,paddingVertical:8},
  controlOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  disabled:{opacity:0.55},
  label:{
    fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.9,
    textTransform:"uppercase",fontWeight:"600",color:INK.readoutSoft,flexShrink:1
  },
  labelOn:{color:INK.readout}
});
