import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import FollowButton from "../../components/FollowButton";
import {INK} from "../../utils/tokens";

function Avatar({profile}){
  if(profile?.profile_photo){
    return <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>;
  }

  return(
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
    </View>
  );
}

export default function Connections(){
  const params=useLocalSearchParams();
  const profileId=Array.isArray(params.id) ? params.id[0] : params.id;
  const requestedTab=Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [activeTab,setActiveTab]=useState(requestedTab==="following" ? "following" : "followers");
  const [owner,setOwner]=useState(null);
  const [people,setPeople]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    setActiveTab(requestedTab==="following" ? "following" : "followers");
  },[requestedTab]);

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    if(!profileId){
      setError("Profile not found.");
      setLoading(false);
      return;
    }

    const ownerResult=await supabase
      .from("profiles")
      .select("id,full_name,profile_photo")
      .eq("id",profileId)
      .maybeSingle();

    if(ownerResult.error || !ownerResult.data){
      setError("Explorer profile not found.");
      setLoading(false);
      return;
    }

    setOwner(ownerResult.data);

    const relationResult=activeTab==="followers"
      ? await supabase.from("explorer_follows").select("follower_id,created_at").eq("following_id",profileId).order("created_at",{ascending:false})
      : await supabase.from("explorer_follows").select("following_id,created_at").eq("follower_id",profileId).order("created_at",{ascending:false});

    if(relationResult.error){
      console.log(relationResult.error);
      setError("Connections could not be loaded.");
      setPeople([]);
      setLoading(false);
      return;
    }

    const rows=relationResult.data || [];
    const ids=rows.map(row=>activeTab==="followers" ? row.follower_id : row.following_id);

    if(!ids.length){
      setPeople([]);
      setLoading(false);
      return;
    }

    const {data:profiles,error:profilesError}=await supabase
      .from("profiles")
      .select("id,full_name,profile_photo,bio,area,show_area")
      .in("id",ids);

    if(profilesError){
      console.log(profilesError);
      setError("Explorer profiles could not be loaded.");
      setPeople([]);
    }else{
      const profileMap=new Map((profiles || []).map(item=>[item.id,item]));
      setPeople(ids.map(id=>profileMap.get(id)).filter(Boolean));
    }

    setLoading(false);
  },[profileId,activeTab]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>EXPLORER CONNECTIONS</Text>
        <Text style={styles.title}>{owner?.full_name || "Explorer"}</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab,activeTab==="followers" && styles.activeTab]} onPress={()=>setActiveTab("followers")}>
          <Text style={[styles.tabText,activeTab==="followers" && styles.activeTabText]}>Followers</Text>
        </Pressable>
        <Pressable style={[styles.tab,activeTab==="following" && styles.activeTab]} onPress={()=>setActiveTab("following")}>
          <Text style={[styles.tabText,activeTab==="following" && styles.activeTabText]}>Following</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator size="large" color={INK.blue} style={styles.loader}/>} 

      {!loading && !!error && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Connections unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      )}

      {!loading && !error && people.length===0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{activeTab==="followers" ? "No followers yet" : "Not following anyone yet"}</Text>
          <Text style={styles.emptyText}>{activeTab==="followers" ? "Followers will appear here." : "Use Find Explorers to build a personal feed."}</Text>
          {activeTab==="following" && <Pressable style={styles.findButton} onPress={()=>router.push("/explorers")}><Text style={styles.findText}>Find Explorers</Text></Pressable>}
        </View>
      )}

      {!loading && !error && people.map(profile=>(
        <View key={profile.id} style={styles.card}>
          <Pressable style={styles.profileLink} onPress={()=>router.push(`/profile/${profile.id}`)}>
            <Avatar profile={profile}/>
            <View style={styles.profileText}>
              <Text style={styles.name}>{profile.full_name || "Explorer"}</Text>
              {!!profile.show_area && !!profile.area?.trim() && <Text style={styles.area}>📍 {profile.area.trim()}</Text>}
              {!!profile.bio && <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>}
            </View>
          </Pressable>
          <FollowButton profileId={profile.id} compact onChanged={load}/>
        </View>
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:18,paddingBottom:60},
  heading:{marginBottom:15},
  eyebrow:{color:INK.blue,fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:"white",fontSize:28,fontWeight:"900",marginTop:5},
  tabs:{flexDirection:"row",backgroundColor:INK.card,borderRadius:13,padding:4,marginBottom:16},
  tab:{flex:1,paddingVertical:11,borderRadius:10,alignItems:"center"},
  activeTab:{backgroundColor:INK.blue},
  tabText:{color:INK.inkSoft,fontWeight:"900"},
  activeTabText:{color:"white"},
  loader:{marginTop:45},
  card:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:13,marginBottom:11,flexDirection:"row",alignItems:"center",gap:12},
  profileLink:{flex:1,flexDirection:"row",alignItems:"center"},
  avatar:{width:54,height:54,borderRadius:27,backgroundColor:INK.card},
  avatarFallback:{width:54,height:54,borderRadius:27,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontSize:21,fontWeight:"900"},
  profileText:{flex:1,marginLeft:12,paddingRight:8},
  name:{color:"white",fontSize:17,fontWeight:"900"},
  area:{color:INK.inkSoft,fontSize:12,marginTop:3},
  bio:{color:INK.inkSoft,fontSize:12,lineHeight:17,marginTop:4},
  empty:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:25,alignItems:"center",marginTop:10},
  emptyTitle:{color:"white",fontSize:18,fontWeight:"900",textAlign:"center"},
  emptyText:{color:INK.inkSoft,textAlign:"center",marginTop:7,lineHeight:20},
  findButton:{backgroundColor:INK.blue,borderRadius:11,paddingHorizontal:18,paddingVertical:11,marginTop:15},
  findText:{color:"white",fontWeight:"900"}
});
