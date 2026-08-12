import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FollowButton from "./FollowButton";
import {INK} from "../utils/tokens";

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
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={INK.blue}/>
        ) : (
          <>
            <View style={styles.countRow}>
              <Pressable
                style={styles.countButton}
                onPress={()=>router.push({pathname:`/connections/${resolvedId}`,params:{tab:"followers"}})}
              >
                <Text style={styles.countNumber}>{counts.follower_count}</Text>
                <Text style={styles.countLabel}>Followers</Text>
              </Pressable>

              <View style={styles.divider}/>

              <Pressable
                style={styles.countButton}
                onPress={()=>router.push({pathname:`/connections/${resolvedId}`,params:{tab:"following"}})}
              >
                <Text style={styles.countNumber}>{counts.following_count}</Text>
                <Text style={styles.countLabel}>Following</Text>
              </Pressable>

              <View style={styles.divider}/>

              <View style={styles.countButton}>
                <Text style={styles.countNumber}>{counts.moment_count}</Text>
                <Text style={styles.countLabel}>Moments</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {isOwner ? (
                <Pressable style={styles.discoverButton} onPress={()=>router.push("/explorers")}>
                  <Text style={styles.discoverText}>Find Explorers</Text>
                </Pressable>
              ) : (
                <FollowButton profileId={resolvedId} onChanged={load}/>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{backgroundColor:INK.paper,paddingHorizontal:18,paddingTop:14},
  card:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:17,padding:14,minHeight:102,justifyContent:"center"},
  countRow:{flexDirection:"row",alignItems:"center"},
  countButton:{flex:1,alignItems:"center",paddingVertical:4},
  countNumber:{color:INK.ink,fontSize:20,fontWeight:"900"},
  countLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"800",marginTop:3},
  divider:{height:32,width:1,backgroundColor:INK.card},
  actionRow:{alignItems:"center",marginTop:13},
  discoverButton:{minWidth:150,minHeight:42,paddingHorizontal:20,paddingVertical:11,borderRadius:12,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  discoverText:{color:INK.card,fontWeight:"900"}
});
