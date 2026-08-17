import React,{useEffect,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import LinkupForm from "../../components/LinkupForm";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.blue}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>MAKE A PLAN</Text>
      <Text style={styles.title}>Create Link-up</Text>
      <Text style={styles.subtitle}>Invite local Explorers to something simple, public and easy to join.</Text>
      {/* The map's long-press already rounds the spot before it gets here --
          see components/LivingMapScreen.js's own drop card. This says so in
          words, so the drop is visible rather than something LinkupForm's own
          "Approximate location added" line has to be found to notice. */}
      {!!dropped && (
        <View style={styles.pinnedBadge}>
          <Text style={styles.pinnedBadgeText}>📍 Pinned from the map</Text>
        </View>
      )}
      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}
      {allowed && <LinkupForm onSubmit={create} working={working} titleOnly initial={dropped}/>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  eyebrow:{color:INK.blue,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:INK.ink,fontSize:32,fontWeight:"900",marginTop:4},subtitle:{color:INK.inkSoft,lineHeight:21,marginTop:7,marginBottom:4},errorCard:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1,borderRadius:12,padding:12,marginTop:16},errorText:{color:INK.card},
  pinnedBadge:{alignSelf:"flex-start",backgroundColor:INK.blue,borderRadius:99,paddingHorizontal:13,paddingVertical:8,marginTop:14},
  pinnedBadgeText:{color:INK.card,fontWeight:"800",fontSize:12}
});
