import React,{useState} from "react";
import {
  View,
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
import {TYPE} from "../../styles/typography";

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
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Event</Text>
        <Text style={styles.subtitle}>Create a public event listing with a location, schedule and optional booking link.</Text>

        <EventFormFields
          form={form}
          setForm={setForm}
          statusOptions={["published","draft"]}
        />
      </ScrollView>

      {/* Sticky bottom action bar: design round r001-a, directive 12. */}
      <View style={styles.stickyBar}>
        <Pressable style={[styles.button,loading && styles.disabled]} onPress={createEvent} disabled={loading}>
          {loading ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Create Event</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flex:1},
  content:{padding:20,paddingBottom:110},
  title:{...TYPE.display},
  subtitle:{color:INK.inkSoft,lineHeight:22,marginTop:7,marginBottom:20},
  stickyBar:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    backgroundColor:INK.card,
    borderTopWidth:2,
    borderTopColor:INK.ink,
    padding:16
  },
  button:{backgroundColor:INK.ink,borderWidth:2,borderColor:INK.ink,padding:14,borderRadius:6,alignItems:"center",minHeight:48,justifyContent:"center"},
  disabled:{opacity:0.55},
  buttonText:{color:INK.card,fontWeight:"900",fontSize:15}
});
