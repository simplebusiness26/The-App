import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import FollowButton from "../../components/FollowButton";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Frame,
  Glyph,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// Followers and Following.
//
// The two tabs were a pair of pills that filled with a state ink when chosen.
// exists/scheduled/offer say what a PLACE is -- being the tab you are looking at
// is not one of those -- so they are a Segmented selector now: a detented switch
// with a bright tick under the active label and no fill anywhere.

function Avatar({profile}){
  return(
    <Frame size={48} round style={styles.avatar}>
      {profile?.profile_photo
        ? <Image source={{uri:profile.profile_photo}} style={styles.avatarImage}/>
        : <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle eyebrow="EXPLORER CONNECTIONS" title={owner?.full_name || "Explorer"}/>

        <Segmented
          items={[{key:"followers",label:"Followers"},{key:"following",label:"Following"}]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {loading && <ActivityIndicator size="large" color={INK.readout} style={styles.loader}/>}

        {!loading && !!error && (
          <Empty glyph="warn" title="Connections unavailable" instruction={error}/>
        )}

        {!loading && !error && people.length===0 && (
          <Empty
            glyph="people"
            title={activeTab==="followers" ? "No followers yet" : "Not following anyone yet"}
            instruction={activeTab==="followers" ? "Followers will appear here." : "Use Find Explorers to build a personal feed."}
            action={activeTab==="following"
              ? <Action kind="primary" glyph="search" label="Find Explorers" onPress={()=>router.push("/explorers")}/>
              : null}
          />
        )}

        {!loading && !error && people.length>0 && (
          <SectionRule
            label={activeTab==="followers" ? "Followers" : "Following"}
            meta={String(people.length)}
          />
        )}

        {!loading && !error && people.map(profile=>(
          <Panel key={profile.id} style={styles.line}>
            <Pressable
              style={styles.lineProfile}
              accessibilityRole="button"
              accessibilityLabel={`Open ${profile.full_name || "this Explorer"}'s profile`}
              onPress={()=>router.push(`/profile/${profile.id}`)}
            >
              <Avatar profile={profile}/>
              <View style={styles.lineText}>
                <Text style={styles.name} numberOfLines={1}>{profile.full_name || "Explorer"}</Text>
                {!!profile.show_area && !!profile.area?.trim() && (
                  <View style={styles.areaRow}>
                    <Glyph name="pin" size={12} colour={INK.readoutFaint}/>
                    <Text style={styles.area} numberOfLines={1}>{profile.area.trim()}</Text>
                  </View>
                )}
                {!!profile.bio && <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>}
              </View>
            </Pressable>
            <FollowButton profileId={profile.id} compact onChanged={load}/>
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  loader:{marginTop:45},

  line:{flexDirection:"row",alignItems:"center",gap:11,padding:12,marginBottom:9},
  lineProfile:{flex:1,flexDirection:"row",alignItems:"center",gap:11,minWidth:0},
  lineText:{flex:1,minWidth:0},
  avatar:{backgroundColor:INK.inset},
  avatarImage:{width:48,height:48,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontSize:19,fontWeight:"700"},

  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  // The pin was an emoji. It is the same 16x16 stroked marker the map uses now.
  areaRow:{flexDirection:"row",alignItems:"center",gap:5,marginTop:3},
  area:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,flexShrink:1},
  bio:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    marginTop:4
  }
});
