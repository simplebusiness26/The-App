import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FollowButton from "../components/FollowButton";

function Avatar({profile}){
  if(profile.profile_photo){
    return <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>;
  }

  return(
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{profile.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
    </View>
  );
}

export default function Explorers(){
  const [userId,setUserId]=useState(null);
  const [profiles,setProfiles]=useState([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    setUserId(user.id);

    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("id,full_name,profile_photo,bio,area,show_area,is_admin")
      .or("is_admin.is.null,is_admin.eq.false")
      .order("full_name",{ascending:true})
      .limit(150);

    if(profileError){
      console.log(profileError);
      setError("Explorers could not be loaded.");
      setProfiles([]);
    }else{
      setProfiles((data || []).filter(item=>item.id!==user.id));
    }

    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    if(!term) return profiles;
    return profiles.filter(item=>
      item.full_name?.toLowerCase().includes(term) ||
      (item.show_area && item.area?.toLowerCase().includes(term))
    );
  },[profiles,query]);

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>EXPLORER COMMUNITY</Text>
        <Text style={styles.title}>Find Explorers</Text>
        <Text style={styles.subtitle}>Follow people whose reviews and Moments you want to see in your feed.</Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or area"
        placeholderTextColor="#777780"
        style={styles.search}
        maxLength={80}
        autoCapitalize="none"
      />

      {loading && <ActivityIndicator size="large" color="#bca8ff" style={styles.loader}/>} 
      {!loading && !!error && <View style={styles.empty}><Text style={styles.emptyTitle}>Could not load Explorers</Text><Text style={styles.emptyText}>{error}</Text></View>}
      {!loading && !error && filtered.length===0 && <View style={styles.empty}><Text style={styles.emptyTitle}>No Explorers found</Text><Text style={styles.emptyText}>Try a different name or area.</Text></View>}

      {!loading && !error && filtered.map(profile=>(
        <View key={profile.id} style={styles.card}>
          <Pressable style={styles.profileLink} onPress={()=>router.push(`/profile/${profile.id}`)}>
            <Avatar profile={profile}/>
            <View style={styles.profileText}>
              <Text style={styles.name}>{profile.full_name || "Explorer"}</Text>
              {!!profile.show_area && !!profile.area?.trim() && <Text style={styles.area}>📍 {profile.area.trim()}</Text>}
              {!!profile.bio && <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>}
            </View>
          </Pressable>
          <FollowButton profileId={profile.id} compact/>
        </View>
      ))}

      {!loading && !error && profiles.length>0 && (
        <Text style={styles.resultCount}>{filtered.length} Explorer{filtered.length===1 ? "" : "s"}</Text>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:60},
  heading:{marginBottom:18},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:"white",fontSize:31,fontWeight:"900",marginTop:5},
  subtitle:{color:"#a9a9b2",fontSize:14,lineHeight:21,marginTop:7,maxWidth:520},
  search:{backgroundColor:"#242428",borderWidth:1,borderColor:"#47474f",borderRadius:14,color:"white",fontSize:16,paddingHorizontal:15,paddingVertical:14,marginBottom:16},
  loader:{marginTop:45},
  card:{backgroundColor:"#222226",borderWidth:1,borderColor:"#414147",borderRadius:16,padding:13,marginBottom:11,flexDirection:"row",alignItems:"center",gap:12},
  profileLink:{flex:1,flexDirection:"row",alignItems:"center"},
  avatar:{width:54,height:54,borderRadius:27,backgroundColor:"#303036"},
  avatarFallback:{width:54,height:54,borderRadius:27,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontSize:21,fontWeight:"900"},
  profileText:{flex:1,marginLeft:12,paddingRight:8},
  name:{color:"white",fontSize:17,fontWeight:"900"},
  area:{color:"#c2b1f4",fontSize:12,marginTop:3},
  bio:{color:"#96969f",fontSize:12,lineHeight:17,marginTop:4},
  empty:{backgroundColor:"#222226",borderWidth:1,borderColor:"#414147",borderRadius:16,padding:24,alignItems:"center",marginTop:15},
  emptyTitle:{color:"white",fontSize:18,fontWeight:"900"},
  emptyText:{color:"#9c9ca5",textAlign:"center",marginTop:6},
  resultCount:{color:"#777780",textAlign:"center",fontSize:12,marginTop:12}
});
