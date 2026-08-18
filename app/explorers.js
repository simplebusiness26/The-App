import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FollowButton from "../components/FollowButton";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Empty,Field,fieldInputStyle,Frame,Glyph,MONO,Notice,Panel,Screen,ScreenTitle,SectionRule} from "../components/instrument";

// Finding people to follow.
//
// Every face on this screen sits in a Frame -- the viewfinder's bracketed well
// -- rather than in a soft circle on a coloured disc, which is what ties a
// directory of Explorers back to the camera the app is built around. The area
// is a reading the app holds about somebody, so it is mono with a pin glyph;
// the bio is a sentence they wrote, so it stays in the body face. That split is
// the whole difference between this screen and a contacts list.

function Avatar({profile}){
  return(
    <Frame size={46} round style={styles.avatarFrame}>
      {profile.profile_photo
        ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
        : <Text style={styles.avatarLetter}>{profile.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          eyebrow="EXPLORER COMMUNITY"
          title="Find Explorers"
          meta="Follow people whose reviews and Moments you want to see in your feed."
        />

        <View style={styles.body}>
        <Field label="Search" style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or area"
            placeholderTextColor={INK.readoutFaint}
            style={fieldInputStyle}
            maxLength={80}
            autoCapitalize="none"
          />
        </Field>

        {loading && <ActivityIndicator size="large" color={INK.readoutSoft} style={styles.loader}/>}

        {!loading && !!error && <Notice tone="dispute" label="Not loaded">{error}</Notice>}

        {!loading && !error && filtered.length===0 && (
          <Empty
            glyph="search"
            title="No Explorers found"
            instruction="Try a different name or area."
          />
        )}

        {!loading && !error && filtered.length>0 && (
          <SectionRule label="Explorers" meta={String(filtered.length)}/>
        )}

        {!loading && !error && filtered.map(profile=>(
          <Panel key={profile.id} style={styles.card}>
            <Pressable
              style={styles.profileLink}
              accessibilityRole="button"
              accessibilityLabel={`Open ${profile.full_name || "Explorer"}`}
              onPress={()=>router.push(`/profile/${profile.id}`)}
            >
              <Avatar profile={profile}/>
              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>{profile.full_name || "Explorer"}</Text>
                {!!profile.show_area && !!profile.area?.trim() && (
                  <View style={styles.areaRow}>
                    <Glyph name="pin" size={11} colour={INK.readoutFaint}/>
                    <Text style={styles.area} numberOfLines={1}>{profile.area.trim()}</Text>
                  </View>
                )}
                {!!profile.bio && <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>}
              </View>
            </Pressable>
            <FollowButton profileId={profile.id} compact/>
          </Panel>
        ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  // ScreenTitle carries its own horizontal gutter, so the scroll container does
  // not -- everything under it gets the gutter from `body` instead.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  search:{marginTop:16},
  loader:{marginTop:45},
  card:{padding:12,marginBottom:9,flexDirection:"row",alignItems:"center",gap:10},
  profileLink:{flex:1,flexDirection:"row",alignItems:"center",minWidth:0},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:46,height:46,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontSize:18,fontWeight:"700"},
  profileText:{flex:1,marginLeft:11,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  areaRow:{flexDirection:"row",alignItems:"center",gap:5,marginTop:4},
  area:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase",flexShrink:1
  },
  bio:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,marginTop:5}
});
