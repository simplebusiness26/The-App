import React,{useEffect,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,Text,View} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import LinkupForm from "../../components/LinkupForm";
import {useFeedback} from "../../context/FeedbackContext";

export default function CreateLinkup(){
  const {showFeedback}=useFeedback();
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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>MAKE A PLAN</Text>
      <Text style={styles.title}>Create Link-up</Text>
      <Text style={styles.subtitle}>Invite local Explorers to something simple, public and easy to join.</Text>
      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}
      {allowed && <LinkupForm onSubmit={create} working={working} titleOnly/>} 
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:"white",fontSize:32,fontWeight:"900",marginTop:4},subtitle:{color:"#a9a9b2",lineHeight:21,marginTop:7,marginBottom:4},errorCard:{backgroundColor:"#431f26",borderColor:"#7e3541",borderWidth:1,borderRadius:12,padding:12,marginTop:16},errorText:{color:"#ffc1c9"}
});
