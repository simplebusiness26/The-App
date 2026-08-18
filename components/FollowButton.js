import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO} from "./instrument";

// Following one Explorer.
//
// A follow is one-way and needs nobody's permission. When both people have done
// it, that is a FRIENDSHIP -- and friendship is what the rest of this app
// actually runs on: a friends-only check-in, a friends-only Moment and the close
// friends list all mean two people who follow each other
// (guestbook_private.are_friends). The button never said so, so the word that
// decides who can see where you are appeared nowhere in the interface.
//
// Both directions are read here rather than asked for as one answer, because
// explorer_follows is readable by any signed-in Explorer
// (explorer_follows_read_authenticated, 20260802155202:370) and a second round
// trip to a function would tell us nothing the rows do not.
export default function FollowButton({profileId,onChanged,compact=false}){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [followId,setFollowId]=useState(null);
  // Do they follow back? This is the whole difference between Following and
  // Friends.
  const [followsBack,setFollowsBack]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);

  const load=useCallback(async()=>{
    if(!profileId){setLoading(false);return;}

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    if(!currentUser || currentUser.id===profileId){
      setFollowId(null);
      setFollowsBack(false);
      setLoading(false);
      return;
    }

    // One read, both directions. Which row is which is decided here rather than
    // by the filter, so there is no way for the two answers to come back out of
    // step with each other.
    const {data,error}=await supabase
      .from("explorer_follows")
      .select("id,follower_id,following_id")
      .or(
        `and(follower_id.eq.${currentUser.id},following_id.eq.${profileId}),`
        +`and(follower_id.eq.${profileId},following_id.eq.${currentUser.id})`
      );

    if(error) console.log(error);

    const rows=Array.isArray(data) ? data : [];
    const mine=rows.find((row)=>row.follower_id===currentUser.id && row.following_id===profileId);
    const theirs=rows.find((row)=>row.follower_id===profileId && row.following_id===currentUser.id);

    setFollowId(mine?.id || null);
    setFollowsBack(!!theirs);
    setLoading(false);
  },[profileId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function toggleFollow(){
    if(working || !profileId) return;

    if(!user){
      router.push("/auth/login");
      return;
    }

    if(user.id===profileId) return;

    setWorking(true);

    if(followId){
      const {error}=await supabase
        .from("explorer_follows")
        .delete()
        .eq("id",followId)
        .eq("follower_id",user.id);

      if(error){
        showFeedback(error.message,"error","Could not unfollow");
        setWorking(false);
        return;
      }

      setFollowId(null);
      showFeedback(
        followsBack
          // Worth saying out loud: unfollowing ends the friendship, and the
          // friendship is what was letting them see friends-only check-ins.
          ? "You are no longer following this Explorer, so you are not friends any more."
          : "You are no longer following this Explorer.",
        "success",
        "Unfollowed"
      );
    }else{
      const {data,error}=await supabase
        .from("explorer_follows")
        .insert({follower_id:user.id,following_id:profileId})
        .select("id")
        .single();

      if(error){
        const duplicate=String(error.code)==="23505";
        if(duplicate){
          await load();
        }else{
          showFeedback(error.message,"error","Could not follow");
          setWorking(false);
          return;
        }
      }else{
        setFollowId(data.id);
        showFeedback(
          followsBack
            ? "You both follow each other, so you are friends. Friends can see anything you share with friends."
            : "Their reviews and Moments will appear in your feed.",
          "success",
          followsBack ? "Friends" : "Following"
        );
      }
    }

    setWorking(false);
    if(onChanged) await onChanged();
  }

  if(user?.id===profileId) return null;

  // Friends is BOTH directions. Following without being followed back is still
  // just following, however long it has been.
  const friends=!!followId && followsBack;
  const busy=loading || working;

  // Three readings, one control. The blue filled pill this used to be said
  // "this place IS something" in the map's own vocabulary, which is not what
  // following somebody means -- and once you followed, the pill inverted to a
  // white box, so the two states were two different objects. Now it is the same
  // machined control as Like, Useful and Favourite: a stroked Glyph and a mono
  // label, stepping up to panelRaised + hairlineStrong once you have acted.
  const glyph=friends ? "people" : followId ? "check" : "person";
  const text=!user
    ? "Log in to follow"
    : friends ? "Friends" : followId ? "Following" : "Follow";

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        friends
          ? "You are friends. Unfollow this Explorer to end it."
          : followId ? "Unfollow Explorer" : "Follow Explorer"
      }
      accessibilityState={{selected:!!followId,disabled:busy}}
      disabled={busy}
      style={[
        styles.control,
        compact ? styles.compact : styles.full,
        !!followId && styles.controlOn,
        busy && styles.disabled
      ]}
      onPress={toggleFollow}
    >
      {busy
        ? <ActivityIndicator size="small" color={INK.readoutSoft}/>
        : <>
            <Glyph name={glyph} size={14} colour={followId?INK.readout:INK.readoutSoft} weight={followId?1.9:1.5}/>
            <Text style={[styles.label,!!followId && styles.labelOn]} numberOfLines={1}>{text}</Text>
          </>
      }
    </Pressable>
  );
}

const styles=StyleSheet.create({
  control:{
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  full:{minWidth:118,minHeight:SHAPE.tapTarget,paddingHorizontal:18,paddingVertical:11},
  compact:{minWidth:92,minHeight:38,paddingHorizontal:12,paddingVertical:8},
  controlOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  disabled:{opacity:0.55},
  label:{
    fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.9,
    textTransform:"uppercase",fontWeight:"600",color:INK.readoutSoft
  },
  labelOn:{color:INK.readout}
});
