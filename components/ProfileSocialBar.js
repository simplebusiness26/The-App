import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FollowButton from "./FollowButton";
import {INK,SHAPE} from "../utils/tokens";
import {Action,Panel,Readout} from "./instrument";

// Followers, following, Moments -- and the one control that changes any of them.
//
// All three are counts the app worked out, so all three are Readouts on one
// plate: mono label above, the figure below, hairline dividers between. That is
// the instrument's answer to a stat row, and it is the same plate ReadoutStrip
// builds; this draws its own only because two of the three cells have to be
// pressable and ReadoutStrip's cells are not.
export default function ProfileSocialBar({profileId,ownProfile=false}){
  const [resolvedId,setResolvedId]=useState(profileId || null);
  const [currentUser,setCurrentUser]=useState(null);
  const [counts,setCounts]=useState({follower_count:0,following_count:0,moment_count:0});
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    setCurrentUser(user || null);

    const id=profileId || (ownProfile ? user?.id : null);
    setResolvedId(id || null);

    if(!id){
      setLoading(false);
      return;
    }

    const {data,error}=await supabase.rpc("get_explorer_follow_counts",{p_user_id:id});
    if(error){
      console.log(error);
      setCounts({follower_count:0,following_count:0,moment_count:0});
    }else{
      const row=Array.isArray(data) ? data[0] : data;
      setCounts({
        follower_count:Number(row?.follower_count || 0),
        following_count:Number(row?.following_count || 0),
        moment_count:Number(row?.moment_count || 0)
      });
    }

    setLoading(false);
  },[profileId,ownProfile]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  if(!resolvedId && !loading) return null;

  const isOwner=!!currentUser && currentUser.id===resolvedId;

  return(
    <View style={styles.wrap}>
      <Panel style={styles.plate}>
        {loading ? (
          <ActivityIndicator color={INK.readoutSoft}/>
        ) : (
          <>
            <View style={styles.countRow}>
              <Pressable
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={`${counts.follower_count} followers`}
                onPress={()=>router.push({pathname:`/connections/${resolvedId}`,params:{tab:"followers"}})}
              >
                <Readout label="FOLLOWERS" value={String(counts.follower_count)} align="center" size="sm"/>
              </Pressable>

              <View style={styles.divider}/>

              <Pressable
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={`Following ${counts.following_count}`}
                onPress={()=>router.push({pathname:`/connections/${resolvedId}`,params:{tab:"following"}})}
              >
                <Readout label="FOLLOWING" value={String(counts.following_count)} align="center" size="sm"/>
              </Pressable>

              <View style={styles.divider}/>

              <View style={styles.cell}>
                <Readout label="MOMENTS" value={String(counts.moment_count)} align="center" size="sm"/>
              </View>
            </View>

            <View style={styles.actionRow}>
              {isOwner ? (
                <Action kind="secondary" glyph="search" label="Find Explorers" onPress={()=>router.push("/explorers")}/>
              ) : (
                <FollowButton profileId={resolvedId} onChanged={load}/>
              )}
            </View>
          </>
        )}
      </Panel>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{backgroundColor:INK.ground,paddingHorizontal:16,paddingTop:14},
  plate:{padding:14,minHeight:102,justifyContent:"center"},
  countRow:{flexDirection:"row",alignItems:"center"},
  cell:{flex:1,alignItems:"center",paddingVertical:4,minHeight:SHAPE.tapTarget,justifyContent:"center"},
  divider:{height:32,width:1,backgroundColor:INK.hairline},
  actionRow:{alignItems:"center",marginTop:13}
});
