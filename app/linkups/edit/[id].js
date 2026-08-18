import React,{useCallback,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import LinkupForm from "../../../components/LinkupForm";
import {useFeedback} from "../../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK} from "../../../utils/tokens";
import {Notice,Screen,ScreenTitle} from "../../../components/instrument";

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

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow="ORGANISER CONTROLS"
          title="Edit Link-up"
          meta="Important time or location changes notify everyone who has joined."
        />
        {!!error && <Notice tone="dispute" label="Not editable">{error}</Notice>}
        {initial && <LinkupForm initial={initial} onSubmit={update} working={working} submitLabel="Save this Link-up"/>}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"}
});
