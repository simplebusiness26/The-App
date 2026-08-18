import React,{useEffect,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,View} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import LinkupForm from "../../components/LinkupForm";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK} from "../../utils/tokens";
import {Chip,Notice,Screen,ScreenTitle} from "../../components/instrument";

export default function CreateLinkup(){
  const {showFeedback}=useFeedback();
  // A point pressed and held on the map. components/LivingMapScreen rounds it
  // through utils/mapLayers.linkupLocationFrom before it gets here -- a meeting
  // point is a corner of a park, not a doorstep -- so this only has to carry it
  // in, not decide anything about it.
  const params=useLocalSearchParams();
  const dropped=Number.isFinite(Number(params.lat)) && Number.isFinite(Number(params.lng))
    ? {latitude:Number(params.lat),longitude:Number(params.lng)}
    : null;
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{checkAccess();},[]);

  async function checkAccess(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}
    setAllowed(true);
    setLoading(false);
  }

  async function create(values){
    setWorking(true);
    const {data,error:createError}=await supabase.rpc("create_linkup",values);
    if(createError){setWorking(false);throw new Error(createError.message);}
    showFeedback("Your Link-up is live. Any blank details were safely marked as to be confirmed.","success","Link-up created");
    router.replace(`/linkups/${data}`);
  }

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow="MAKE A PLAN"
          title="Create a Link-up"
          meta="Invite local Explorers to something simple, public and easy to join."
        />
        {/* The map's long-press already rounds the spot before it gets here --
            see components/LivingMapScreen.js's own drop card. This says so in
            words, so the drop is visible rather than something LinkupForm's own
            "Approximate location added" line has to be found to notice.

            It used to be a filled blue pill with a map-pin emoji on it. A dropped point is
            not a state a place is in, so it carries no state ink now: it is a
            quiet mono chip with the kit's own pin glyph, on the same 16x16 grid
            as every marker on the map it came from. */}
        {!!dropped && (
          <View style={styles.pinnedRow}>
            <Chip glyph="pin" label="Pinned from the map"/>
          </View>
        )}
        {!!error && <Notice tone="dispute" label="Not posted">{error}</Notice>}
        {allowed && <LinkupForm onSubmit={create} working={working} titleOnly initial={dropped}/>}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  pinnedRow:{flexDirection:"row",marginTop:12,marginBottom:4}
});
