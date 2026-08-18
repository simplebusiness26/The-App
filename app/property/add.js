import React,{useState} from "react";
import {
  TextInput,
  StyleSheet,
  ScrollView,
  Alert
} from "react-native";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import ListingLocationPicker from "../../components/ListingLocationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK} from "../../utils/tokens";
import {Action,Field,fieldInputStyle,Screen,ScreenTitle,SectionRule} from "../../components/instrument";

export default function AddProperty(){
  const {showFeedback}=useFeedback();
  const [name,setName]=useState("");
  const [host,setHost]=useState("");
  const [description,setDescription]=useState("");
  const [bookingUrl,setBookingUrl]=useState("");
  const [selectedLocation,setSelectedLocation]=useState(null);
  const [loading,setLoading]=useState(false);

  async function addProperty(){
    if(loading) return;

    if(!name.trim()){
      Alert.alert("Missing information","Property name is required.");
      return;
    }

    if(!selectedLocation){
      Alert.alert("Choose a location","Search for the property address and select the correct result.");
      return;
    }

    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setLoading(false);
      showFeedback("You must be logged in to create a property.","error","Property not created");
      router.replace("/auth/login");
      return;
    }

    const {error}=await supabase
      .from("properties")
      .insert({
        name:name.trim(),
        host:host.trim(),
        description:description.trim(),
        booking_url:bookingUrl.trim(),
        address:selectedLocation.address,
        latitude:selectedLocation.latitude,
        longitude:selectedLocation.longitude,
        owner_id:user.id
      });

    setLoading(false);

    if(error){
      console.log(error);
      showFeedback(error.message,"error","Property not created");
      return;
    }

    showFeedback(`${name.trim()} was created and added to your dashboard.`,"success","Property created");
    router.replace("/manager/dashboard");
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="NEW STAY"
          title="Add a property"
          meta="Somewhere people can book. It goes on the map and into your manager dashboard."
        />

        <SectionRule label="The listing"/>

        <Field label="Property name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Cliff Top Cottage"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Host name">
          <TextInput
            style={fieldInputStyle}
            placeholder="Who guests will be met by"
            placeholderTextColor={INK.readoutFaint}
            value={host}
            onChangeText={setHost}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[fieldInputStyle,styles.multiline]}
            placeholder="What the stay is like, and what is nearby."
            placeholderTextColor={INK.readoutFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <Field label="Booking URL">
          <TextInput
            style={fieldInputStyle}
            placeholder="https://"
            placeholderTextColor={INK.readoutFaint}
            value={bookingUrl}
            onChangeText={setBookingUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <SectionRule label="Where it is"/>

        <ListingLocationPicker onChange={setSelectedLocation}/>

        <Action
          kind="primary"
          glyph="plus"
          label="Create this property listing"
          accessibilityLabel="Create this property listing"
          loading={loading}
          onPress={addProperty}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  multiline:{minHeight:110}
});
