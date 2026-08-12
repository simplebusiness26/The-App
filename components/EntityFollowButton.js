import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {entityTypeLabel} from "../utils/places";
import {INK} from "../utils/tokens";

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

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${noun || `this ${label}`}` : `Follow ${noun || `this ${label}`}`}
      disabled={loading || working}
      style={[
        styles.button,
        compact && styles.compact,
        following && styles.following,
        (loading || working) && styles.disabled
      ]}
      onPress={toggleFollow}
    >
      {(loading || working)
        ? <ActivityIndicator size="small" color={INK.ink}/>
        : (
          <Text style={styles.text} numberOfLines={1}>
            {!user
              ? "Log in to follow"
              : following
                ? (noun ? `Following ${noun}` : "Following")
                : (noun ? `Follow ${noun}` : "Follow")}
            {count>0 ? ` · ${count}` : ""}
          </Text>
        )}
    </Pressable>
  );
}

const styles=StyleSheet.create({
  button:{
    minWidth:118,
    maxWidth:230,
    minHeight:44,
    paddingHorizontal:18,
    paddingVertical:11,
    borderRadius:12,
    borderWidth:2,
    borderColor:INK.ink,
    backgroundColor:INK.card,
    alignItems:"center",
    justifyContent:"center"
  },
  compact:{minWidth:96,minHeight:38,paddingHorizontal:13,paddingVertical:8,borderRadius:10},
  following:{backgroundColor:INK.hair},
  disabled:{opacity:0.65},
  text:{color:INK.ink,fontWeight:"800",fontSize:14}
});
