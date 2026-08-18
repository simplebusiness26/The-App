import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {entityTypeLabel} from "../utils/places";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO} from "./instrument";

// Packet 8e. components/FollowButton.js follows a person; this follows a place,
// a club, an event, a public place or a town.
//
// Two tables, one control. An entity follow carries a type discriminator and
// lands in explorer_entity_follows; an area follow has a real foreign key to
// geo_areas and lands in explorer_location_follows. That is one branch rather
// than two components, because everything either side of the write -- the
// count, the states, the feedback, the signed-out path -- is identical.
//
// The count comes from an RPC rather than a select. A follow row is readable
// only by the Explorer who made it, so "12 Explorers follow this" is answerable
// while "which twelve" is not.

const AREA_TYPE="geo_area";

// `noun` is what the button calls the thing it follows -- "Follow the park",
// "Follow Old Town". It matters wherever two of these appear together: a public
// place page carries one for the park and one for the town it is in, and both
// used to read plain "Follow", which is the "two follow buttons" the owner
// reported. Left off, the button is just "Follow", which is right on a page
// with only one of them.
export default function EntityFollowButton({targetType,targetId,targetName,noun,onChanged,compact=false}){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [following,setFollowing]=useState(false);
  const [count,setCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);

  const isArea=targetType===AREA_TYPE;
  const label=isArea ? "area" : entityTypeLabel(targetType).toLowerCase();

  const load=useCallback(async()=>{
    if(!targetType || !targetId){
      setLoading(false);
      return;
    }

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    const {data,error}=isArea
      ? await supabase.rpc("get_location_follow_stats",{p_area_id:targetId})
      : await supabase.rpc("get_entity_follow_stats",{p_target_type:targetType,p_target_id:targetId});

    if(error) console.log(error);

    const stats=Array.isArray(data) ? data[0] : data;
    setCount(Number(stats?.follower_count || 0));
    setFollowing(!!stats?.viewer_following);
    setLoading(false);
  },[targetType,targetId,isArea]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function toggleFollow(){
    if(working || !targetId) return;

    if(!user){
      router.push("/auth/login");
      return;
    }

    setWorking(true);

    const table=isArea ? "explorer_location_follows" : "explorer_entity_follows";
    const match=isArea
      ? {follower_id:user.id,area_id:targetId}
      : {follower_id:user.id,target_type:targetType,target_id:targetId};

    if(following){
      let request=supabase.from(table).delete().eq("follower_id",user.id);
      request=isArea
        ? request.eq("area_id",targetId)
        : request.eq("target_type",targetType).eq("target_id",targetId);

      const {error}=await request;

      if(error){
        showFeedback(error.message,"error","Could not unfollow");
        setWorking(false);
        return;
      }

      setFollowing(false);
      setCount((current)=>Math.max(0,current-1));
      showFeedback(`${targetName || "This place"} will no longer appear in your feed.`,"success","Unfollowed");
    }else{
      const {error}=await supabase.from(table).insert(match);

      if(error){
        // A duplicate means somebody double-tapped, or another device already
        // followed. That is the state they asked for, not a failure.
        if(String(error.code)==="23505"){
          await load();
        }else{
          showFeedback(error.message,"error","Could not follow");
          setWorking(false);
          return;
        }
      }else{
        setFollowing(true);
        setCount((current)=>current+1);
        showFeedback(
          isArea
            ? "What happens here will appear in your feed."
            : "Its updates will appear in your feed.",
          "success",
          "Following"
        );
      }
    }

    setWorking(false);
    if(onChanged) await onChanged();
  }

  const busy=loading || working;
  const text=!user
    ? "Log in to follow"
    : following
      ? (noun ? `Following ${noun}` : "Following")
      : (noun ? `Follow ${noun}` : "Follow");

  // Same machined control as FollowButton, LikeButton, EndorseButton and
  // FavouriteButton. The follower count is a measurement, so it is set in mono
  // beside the label rather than glued into it with a middle dot -- the old
  // "Follow the park · 12" ran one sentence and one number together in the same
  // face, and a reader could not tell which half the app had counted.
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${noun || `this ${label}`}` : `Follow ${noun || `this ${label}`}`}
      accessibilityState={{selected:following,disabled:busy}}
      disabled={busy}
      style={[
        styles.control,
        compact ? styles.compact : styles.full,
        following && styles.controlOn,
        busy && styles.disabled
      ]}
      onPress={toggleFollow}
    >
      {busy
        ? <ActivityIndicator size="small" color={INK.readoutSoft}/>
        : (
          <>
            <Glyph name={following?"check":"plus"} size={14} colour={following?INK.readout:INK.readoutSoft} weight={following?1.9:1.5}/>
            <Text style={[styles.label,following && styles.labelOn]} numberOfLines={1}>{text}</Text>
            {count>0 ? <Text style={styles.count}>{count}</Text> : null}
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
  full:{minWidth:118,maxWidth:230,minHeight:SHAPE.tapTarget,paddingHorizontal:16,paddingVertical:11},
  compact:{minWidth:96,minHeight:38,paddingHorizontal:12,paddingVertical:8},
  controlOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  disabled:{opacity:0.55},
  label:{
    fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.9,
    textTransform:"uppercase",fontWeight:"600",color:INK.readoutSoft,flexShrink:1
  },
  labelOn:{color:INK.readout},
  count:{
    fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.9,
    color:INK.readoutFaint,paddingLeft:2
  }
});
