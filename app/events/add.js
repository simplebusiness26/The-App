import React,{useState} from "react";
import {
  StyleSheet,
  ScrollView,
  Alert
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import EventFormFields from "../../components/EventFormFields";
import {createDefaultEventForm,validateEventForm} from "../../utils/events";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {Action,Screen,ScreenTitle} from "../../components/instrument";

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
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="NEW EVENT"
          title="Add an event"
          meta="Create a public event listing with a location, schedule and optional booking link."
        />

        <EventFormFields
          form={form}
          setForm={setForm}
          statusOptions={["published","draft"]}
        />

        <Action
          kind="primary"
          glyph="calendar"
          label="Create this event"
          accessibilityLabel="Create this event"
          loading={loading}
          onPress={createEvent}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24}
});
