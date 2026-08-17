import React,{useCallback,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import LinkupForm from "../../../components/LinkupForm";
import {useFeedback} from "../../../context/FeedbackContext";
import {INK} from "../../../utils/tokens";

export default function EditLinkup(){
  const params=useLocalSearchParams();
  const id=Array.isArray(params.id)?params.id[0]:params.id;
  const {showFeedback}=useFeedback();
  const [initial,setInitial]=useState(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!id){setError("Link-up not found.");setLoading(false);return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}
    const [{data:linkup,error:linkupError},{data:privateRow}]=await Promise.all([
      supabase.from("linkups").select("*").eq("id",id).maybeSingle(),
      supabase.from("linkup_private_details").select("meeting_point_details").eq("linkup_id",id).maybeSingle()
    ]);
    if(linkupError || !linkup || linkup.creator_id!==user.id){setError("Only the organiser can edit this Link-up.");setLoading(false);return;}
    setInitial({...linkup,meeting_point_details:privateRow?.meeting_point_details || ""});
    setLoading(false);
  },[id]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function update(values){
    setWorking(true);
    const {error:updateError}=await supabase.rpc("update_linkup",{p_linkup_id:id,...values});
    if(updateError){setWorking(false);throw new Error(updateError.message);}
    showFeedback("Joined Explorers were notified if the time or location changed.","success","Link-up updated");
    router.replace(`/linkups/${id}`);
  }

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.ink}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>ORGANISER CONTROLS</Text>
      <Text style={styles.title}>Edit Link-up</Text>
      <Text style={styles.subtitle}>Important time or location changes notify everyone who has joined.</Text>
      {!!error&&<View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}
      {initial&&<LinkupForm initial={initial} onSubmit={update} working={working} submitLabel="Save changes"/>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:INK.paper},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},eyebrow:{color:INK.inkSoft,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:INK.ink,fontSize:32,fontWeight:"900",marginTop:4},subtitle:{color:INK.inkSoft,lineHeight:21,marginTop:7,marginBottom:4},errorCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:12,padding:12,marginTop:16},errorText:{color:INK.ink}});
