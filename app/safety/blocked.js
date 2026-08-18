import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Frame,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// Who you have blocked, and the way back.
//
// Rebuilt from the kit rather than retinted: each line is a Panel, the face in
// it sits in the same bracketed Frame every picture in this app uses, and the
// shield emoji that used to head the empty state is a Glyph on Empty's dial
// plate. Every Supabase call, permission check and piece of copy is the one
// that was already here.

function Face({profile}){
  return(
    <Frame size={42} round style={styles.face}>
      {profile?.profile_photo
        ? <Image source={{uri:profile.profile_photo}} style={styles.faceImage}/>
        : <Text style={styles.faceLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
  );
}

export default function BlockedExplorers(){
  const {showFeedback}=useFeedback();
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [workingId,setWorkingId]=useState(null);

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}
    const {data:blocks,error}=await supabase.from("user_blocks").select("blocked_id,created_at").eq("blocker_id",user.id).order("created_at",{ascending:false});
    if(error){showFeedback(error.message,"error","Blocked list not loaded");setItems([]);}else{
      const ids=(blocks || []).map(item=>item.blocked_id);
      let profiles={};
      if(ids.length){
        const {data}=await supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").in("id",ids);
        profiles=Object.fromEntries((data || []).map(item=>[item.id,item]));
      }
      setItems((blocks || []).map(item=>({...item,profile:profiles[item.blocked_id] || null})));
    }
    setLoading(false);setRefreshing(false);
  },[showFeedback]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function unblock(item){
    setWorkingId(item.blocked_id);
    const {error}=await supabase.rpc("unblock_explorer",{p_user_id:item.blocked_id});
    setWorkingId(null);
    if(error){showFeedback(error.message,"error","Explorer not unblocked");return;}
    showFeedback("You may now see each other's public activity again.","success","Explorer unblocked");
    await load(false);
  }

  function refresh(){setRefreshing(true);load(false);}

  if(loading){
    return(
      <Screen>
        <View style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.readoutSoft}/>}
      >
        <ScreenTitle eyebrow="SAFETY CONTROLS" title="Blocked Explorers"/>
        <Text style={styles.lead}>
          Blocked people cannot follow you or see each other&apos;s Link-ups and live check-ins.
        </Text>

        <SectionRule label="Blocked" meta={String(items.length)}/>

        {items.length===0 && (
          <Empty
            glyph="shield"
            title="Nobody blocked"
            instruction="You can block an organiser from a Link-up or a nearby Explorer from their profile."
          />
        )}

        {items.map(item=>(
          <Panel key={item.blocked_id} style={styles.line}>
            <Pressable
              style={styles.lineProfile}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.profile?.full_name || "this Explorer"}'s profile`}
              onPress={()=>router.push(`/profile/${item.blocked_id}`)}
            >
              <Face profile={item.profile}/>
              <View style={styles.lineText}>
                <Text style={styles.name} numberOfLines={1}>{item.profile?.full_name || "Explorer"}</Text>
                {!!item.profile?.show_area && !!item.profile?.area && (
                  <Text style={styles.area} numberOfLines={1}>{item.profile.area}</Text>
                )}
              </View>
            </Pressable>

            <Action
              kind="secondary"
              glyph="check"
              label="Unblock"
              accessibilityLabel={`Unblock ${item.profile?.full_name || "this Explorer"}`}
              loading={workingId===item.blocked_id}
              onPress={()=>unblock(item)}
              style={styles.unblock}
            />
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  // ScreenTitle's meta line is clamped to one line -- right for a place's
  // "2.4 KM · OPEN NOW", wrong for a sentence, which it silently truncates with
  // an ellipsis. Anything longer than a readout goes here instead.
  lead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:-2,
    marginBottom:14
  },
  center:{flex:1,alignItems:"center",justifyContent:"center"},

  // The name and the unblock control are siblings inside one Panel, not nested
  // pressables: a button inside a pressable row is two overlapping targets and
  // which one a finger gets is a coin toss.
  line:{flexDirection:"row",alignItems:"center",gap:11,padding:11,marginBottom:8},
  lineProfile:{flex:1,flexDirection:"row",alignItems:"center",gap:11,minWidth:0},
  lineText:{flex:1,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  area:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    marginTop:2
  },
  face:{backgroundColor:INK.inset},
  faceImage:{width:42,height:42,borderRadius:SHAPE.radius.pill},
  faceLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:17},
  unblock:{minWidth:118}
});
