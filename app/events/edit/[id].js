import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import EventFormFields from "../../../components/EventFormFields";
import {createDefaultEventForm,eventToForm,validateEventForm} from "../../../utils/events";
import {useFeedback} from "../../../context/FeedbackContext";
import {INK} from "../../../utils/tokens";

export default function EditEvent(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [form,setForm]=useState(()=>createDefaultEventForm());
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(id) loadEvent();
  },[id]));

  async function loadEvent(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      showFeedback("Please log in before editing an event.","error","Login required");
      router.replace("/auth/login");
      return;
    }

    const {data,error:eventError}=await supabase
      .from("events")
      .select("*")
      .eq("id",id)
      .eq("manager_id",user.id)
      .single();

    if(eventError){
      console.log(eventError);
      setError("This event could not be loaded or is not owned by your account.");
      setLoading(false);
      return;
    }

    setForm(eventToForm(data));
    setLoading(false);
  }

  async function saveEvent(){
    if(saving || deleting) return;

    const validation=validateEventForm(form);
    if(validation.error){
      Alert.alert("Check event details",validation.error);
      return;
    }

    setSaving(true);
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setSaving(false);
      showFeedback("Please log in before saving this event.","error","Event not updated");
      router.replace("/auth/login");
      return;
    }

    const {data:updatedEvent,error:updateError}=await supabase
      .from("events")
      .update(validation.payload)
      .eq("id",id)
      .eq("manager_id",user.id)
      .select("id")
      .maybeSingle();

    setSaving(false);

    if(updateError || !updatedEvent){
      showFeedback(
        updateError?.message || "The event was not updated. Check your Events access and try again.",
        "error",
        "Event not updated"
      );
      return;
    }

    showFeedback(`${validation.payload.name} was updated successfully.`,"success","Event updated");
    router.replace("/manager/dashboard");
  }

  async function deleteEvent(){
    if(saving || deleting) return;

    setDeleting(true);
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setDeleting(false);
      showFeedback("Please log in before deleting this event.","error","Event not deleted");
      router.replace("/auth/login");
      return;
    }

    const {data:deletedEvent,error:deleteError}=await supabase
      .from("events")
      .delete()
      .eq("id",id)
      .eq("manager_id",user.id)
      .select("id")
      .maybeSingle();

    setDeleting(false);

    if(deleteError || !deletedEvent){
      showFeedback(
        deleteError?.message || "The event was not deleted. Reload it and try again.",
        "error",
        "Event not deleted"
      );
      return;
    }

    showFeedback(`${form.name.trim() || "The event"} was deleted.`,"success","Event deleted");
    router.replace("/manager/dashboard");
  }

  function confirmDelete(){
    Alert.alert(
      "Delete event?",
      `${form.name.trim() || "This event"} will be removed permanently from Xplorer.`,
      [
        {text:"Cancel",style:"cancel"},
        {text:"Delete",style:"destructive",onPress:deleteEvent}
      ]
    );
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
  }

  if(error){
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Event</Text>
      <Text style={styles.subtitle}>Update the public listing, schedule and event status.</Text>

      <EventFormFields
        form={form}
        setForm={setForm}
        statusOptions={["published","draft","cancelled"]}
      />

      <Pressable style={[styles.saveButton,(saving || deleting) && styles.disabled]} onPress={saveEvent} disabled={saving || deleting}>
        {saving ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Save Changes</Text>}
      </Pressable>

      <Pressable style={[styles.deleteButton,(saving || deleting) && styles.disabled]} onPress={confirmDelete} disabled={saving || deleting}>
        <Text style={styles.deleteText}>{deleting ? "Deleting..." : "Delete Event"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  error:{fontSize:17,textAlign:"center",lineHeight:24},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{color:"#666",lineHeight:22,marginTop:7,marginBottom:20},
  saveButton:{backgroundColor:INK.blue,padding:16,borderRadius:12,alignItems:"center"},
  deleteButton:{backgroundColor:"white",borderWidth:1,borderColor:INK.red,padding:15,borderRadius:12,alignItems:"center",marginTop:12},
  disabled:{opacity:0.55},
  buttonText:{color:"white",fontWeight:"bold"},
  deleteText:{color:INK.red,fontWeight:"bold"}
});
