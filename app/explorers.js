import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FollowButton from "../components/FollowButton";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

// GAZETTEER PASS (design round r001-a, directive 10): the Explorer directory,
// re-set as an index -- a section header carrying the count over a 2px rule,
// then one-line ledger rows with a hairline between them, in place of padded
// bordered cards. Same query, same search, same route -- only how it is
// drawn changed.

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
      <Text style={TYPE.sectionLabel}>Explorer Community</Text>
      <Text style={TYPE.display}>Find Explorers</Text>
      <Text style={styles.lead}>Follow people whose reviews and Moments you want to see in your feed.</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or area"
        placeholderTextColor={INK.inkSoft}
        style={styles.search}
        maxLength={80}
        autoCapitalize="none"
        accessibilityLabel="Search Explorers by name or area"
      />

      {loading && <ActivityIndicator size="large" color={INK.ink} style={styles.loader}/>}

      {!loading && !!error && <Text style={styles.emptyText}>{error}</Text>}

      {!loading && !error && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={TYPE.sectionLabel}>Explorers</Text>
            <Text style={styles.count}>{filtered.length}</Text>
          </View>

          {filtered.length===0 ? (
            <Text style={styles.emptyText}>No Explorers found. Try a different name or area.</Text>
          ) : filtered.map(profile=>(
            <View key={profile.id} style={styles.row}>
              <Pressable style={styles.profileLink} onPress={()=>router.push(`/profile/${profile.id}`)}>
                <Avatar profile={profile}/>
                <View style={styles.textCol}>
                  <Text style={TYPE.rowTitle} numberOfLines={1}>{profile.full_name || "Explorer"}</Text>
                  <Text style={TYPE.meta} numberOfLines={1}>
                    {profile.show_area && profile.area?.trim() ? profile.area.trim() : ""}
                  </Text>
                  {!!profile.bio && <Text style={styles.bio} numberOfLines={1}>{profile.bio}</Text>}
                </View>
              </Pressable>
              <FollowButton profileId={profile.id} compact/>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:60},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6,maxWidth:520},
  search:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    paddingHorizontal:14,
    paddingVertical:13,
    marginTop:16,
    color:INK.ink,
    fontSize:15
  },
  loader:{marginTop:45},
  section:{marginTop:20},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12},
  row:{
    flexDirection:"row",
    alignItems:"center",
    minHeight:56,
    paddingVertical:9,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  profileLink:{flex:1,flexDirection:"row",alignItems:"center",gap:10},
  avatar:{width:40,height:40,borderRadius:4,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink},
  avatarFallback:{width:40,height:40,borderRadius:4,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.ink,fontSize:15,fontWeight:"900"},
  textCol:{flex:1},
  bio:{...TYPE.meta,color:INK.inkSoft,marginTop:1}
});
