import React,{useState} from "react";
import {
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import EventFormFields from "../../components/EventFormFields";
import {createDefaultEventForm,validateEventForm} from "../../utils/events";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

export default function AddEvent(){
  const {showFeedback}=useFeedback();
  const [form,setForm]=useState(()=>createDefaultEventForm());
  const [loading,setLoading]=useState(false);

  async function createEvent(){
    if(loading) return;

    const validation=validateEventForm(form);
    if(validation.error){
      Alert.alert("Check event details",validation.error);
      return;
    }

    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setLoading(false);
      showFeedback("You must be logged in to create an event.","error","Event not created");
      router.replace("/auth/login");
      return;
    }

    const {data,error}=await supabase
      .from("events")
      .insert({...validation.payload,manager_id:user.id})
      .select("id")
      .single();

    setLoading(false);

    if(error){
      console.log(error);
      showFeedback(error.message,"error","Event not created");
      return;
    }

    showFeedback(`${validation.payload.name} was created successfully.`,"success","Event created");
    router.replace(`/events/${data.id}`);
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Event</Text>
      <Text style={styles.subtitle}>Create a public event listing with a location, schedule and optional booking link.</Text>

      <EventFormFields
        form={form}
        setForm={setForm}
        statusOptions={["published","draft"]}
      />

      <Pressable style={[styles.button,loading && styles.disabled]} onPress={createEvent} disabled={loading}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Create Event</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{color:"#666",lineHeight:22,marginTop:7,marginBottom:20},
  button:{backgroundColor:INK.blue,padding:16,borderRadius:12,alignItems:"center"},
  disabled:{opacity:0.55},
  buttonText:{color:"white",fontWeight:"bold"}
});
