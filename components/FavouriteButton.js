import React,{useEffect,useState} from "react";
import {Pressable,Text,StyleSheet,ActivityIndicator} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

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
      setIsExplorer(false);
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
    return compact ? null : <Pressable style={[styles.button,styles.disabled]} disabled><ActivityIndicator color={INK.ink}/></Pressable>;
  }

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favourite ? `Remove ${targetName || "listing"} from favourites` : `Add ${targetName || "listing"} to favourites`}
      style={[styles.button,compact && styles.compact,favourite && styles.active,saving && styles.disabled]}
      onPress={toggleFavourite}
      disabled={saving}
    >
      {saving ? <ActivityIndicator color={INK.ink}/> : <Text style={[styles.text,favourite && styles.activeText]}>{favourite ? "♥ Saved to favourites" : "♡ Add to favourites"}</Text>}
    </Pressable>
  );
}

const styles=StyleSheet.create({
  button:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:12,padding:14,alignItems:"center",justifyContent:"center",marginTop:12},
  compact:{marginTop:0,paddingHorizontal:12,paddingVertical:9},
  active:{backgroundColor:INK.blue,borderColor:INK.blue},
  text:{color:INK.ink,fontWeight:"900",textAlign:"center"},
  activeText:{color:INK.card},
  disabled:{opacity:0.55}
});
