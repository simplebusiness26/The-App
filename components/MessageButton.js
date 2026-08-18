import React,{useCallback,useState} from "react";
import {StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {Action} from "./instrument";

// The way into a conversation, both kinds.
//
//   <MessageButton profileId={...}/>                  a friend
//   <MessageButton targetType="business" targetId/>   whoever manages a place
//
// WHY IT HIDES ITSELF RATHER THAN REFUSING
//
// You can only message an Explorer you are friends with. A button that appears
// for everybody and fails for most of them teaches people to distrust buttons,
// so on a profile this checks the friendship first and renders nothing when the
// answer is no. That check is a convenience, not the control: start_friend_
// conversation asks the database the same question and raises if it disagrees.
//
// On a place page it always renders when there is a manager, because anybody
// may ask a manager about their listing — that is the rule the owner chose.

export default function MessageButton({profileId,targetType,targetId,compact=false}){
  const {showFeedback}=useFeedback();
  const [allowed,setAllowed]=useState(!profileId);
  const [checked,setChecked]=useState(!profileId);
  const [working,setWorking]=useState(false);

  const check=useCallback(async()=>{
    if(!profileId) return;

    const {data:{user}}=await supabase.auth.getUser();
    if(!user || user.id===profileId){
      setAllowed(false);
      setChecked(true);
      return;
    }

    // Both directions. explorer_follows is readable by any signed-in Explorer,
    // so this needs no function of its own.
    const {data}=await supabase
      .from("explorer_follows")
      .select("follower_id,following_id")
      .or(
        `and(follower_id.eq.${user.id},following_id.eq.${profileId}),`
        +`and(follower_id.eq.${profileId},following_id.eq.${user.id})`
      );

    const rows=Array.isArray(data) ? data : [];
    setAllowed(
      rows.some((row)=>row.follower_id===user.id && row.following_id===profileId)
      && rows.some((row)=>row.follower_id===profileId && row.following_id===user.id)
    );
    setChecked(true);
  },[profileId]);

  useFocusEffect(useCallback(()=>{check();},[check]));

  async function open(){
    if(working) return;
    setWorking(true);

    const {data,error}=profileId
      ? await supabase.rpc("start_friend_conversation",{p_friend:profileId})
      : await supabase.rpc("start_listing_conversation",{
          p_target_type:targetType,
          p_target_id:targetId
        });

    setWorking(false);

    if(error){
      // The database's own sentence — it names the reason and the fix.
      showFeedback(error.message,"error","Could not open a conversation");
      return;
    }

    if(data) router.push(`/messages/${data}`);
  }

  if(!checked || !allowed) return null;

  return(
    <Action
      kind="secondary"
      glyph="comment"
      label={profileId ? "Message" : "Message the manager"}
      accessibilityLabel={profileId ? "Message this Explorer" : "Message whoever manages this place"}
      loading={working}
      onPress={open}
      style={[styles.button,compact && styles.compact]}
    />
  );
}

const styles=StyleSheet.create({
  // The kit's Action already carries the 44px floor, the hairline edge and the
  // mono label. All this adds is the width the two callers rely on: a full-width
  // button under a profile, and a narrower one beside a name in a list.
  button:{minWidth:132,alignSelf:"flex-start"},
  compact:{minWidth:104,paddingHorizontal:12}
});
