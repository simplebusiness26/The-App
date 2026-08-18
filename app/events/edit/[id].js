import React,{useCallback,useState} from "react";
import {
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import EventFormFields from "../../../components/EventFormFields";
import {createDefaultEventForm,eventToForm,validateEventForm} from "../../../utils/events";
import {useFeedback} from "../../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK} from "../../../utils/tokens";
import {Action,Notice,Screen,ScreenTitle} from "../../../components/instrument";

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
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  if(error){
    return(
      <Screen>
        <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
          <ScreenTitle eyebrow="EDIT EVENT" title="Event unavailable"/>
          <Notice tone="dispute" label="Not loaded">{error}</Notice>
        </ScrollView>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="EDIT EVENT"
          title={form.name?.trim() || "Edit event"}
          meta="Update the public listing, schedule and event status."
        />

        <EventFormFields
          form={form}
          setForm={setForm}
          statusOptions={["published","draft","cancelled"]}
        />

        <Action
          kind="primary"
          glyph="check"
          label="Save this event"
          accessibilityLabel="Save this event"
          loading={saving}
          disabled={deleting}
          onPress={saveEvent}
        />

        {/*
          Delete is a destructive choice, not a manager dispute -- `dispute` is
          reserved for that one pair (docs/design-system.md), so it stays off the
          quietest control on the screen. The confirmation dialog is the guard.
        */}
        <Action
          kind="quiet"
          glyph="trash"
          label={deleting ? "Deleting…" : "Delete this event"}
          accessibilityLabel="Delete this event"
          style={styles.delete}
          disabled={saving || deleting}
          onPress={confirmDelete}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  delete:{marginTop:12}
});
