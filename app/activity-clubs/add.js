import React,{useState} from "react";
import {
  TextInput,
  StyleSheet,
  ScrollView,
  Alert
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import LocationPicker from "../../components/LocationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK} from "../../utils/tokens";
import {Action,Field,fieldInputStyle,Screen,ScreenTitle,SectionRule} from "../../components/instrument";

export default function AddActivityClub(){
  const {showFeedback}=useFeedback();
  const [name,setName]=useState("");
  const [category,setCategory]=useState("");
  const [description,setDescription]=useState("");
  const [price,setPrice]=useState("0");
  const [memberLimit,setMemberLimit]=useState("20");
  const [selectedLocation,setSelectedLocation]=useState(null);
  const [loading,setLoading]=useState(false);

  async function createClub(){
    if(loading) return;

    if(!name.trim() || !category.trim()){
      Alert.alert("Missing information","Name and category are required.");
      return;
    }

    if(!selectedLocation){
      Alert.alert("Choose a location","Search for the club address and select the correct result.");
      return;
    }

    const numericPrice=Number(price || 0);
    const numericLimit=Number(memberLimit);

    if(Number.isNaN(numericPrice) || numericPrice<0){
      Alert.alert("Invalid price","Enter a valid price or 0 for a free club.");
      return;
    }

    if(!Number.isInteger(numericLimit) || numericLimit<1){
      Alert.alert("Invalid member limit","Enter the maximum number of approved members.");
      return;
    }

    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setLoading(false);
      showFeedback("You must be logged in to create an Activity Club.","error","Club not created");
      router.replace("/auth/login");
      return;
    }

    const {error}=await supabase
      .from("activity_clubs")
      .insert({
        manager_id:user.id,
        name:name.trim(),
        category:category.trim(),
        description:description.trim(),
        location:selectedLocation.location || "",
        address:selectedLocation.address,
        latitude:selectedLocation.latitude,
        longitude:selectedLocation.longitude,
        price:numericPrice,
        member_limit:numericLimit,
        status:"open"
      });

    setLoading(false);

    if(error){
      console.log(error);
      showFeedback(error.message,"error","Club not created");
      return;
    }

    showFeedback(`${name.trim()} was created and added to the map and dashboard.`,"success","Activity Club created");
    router.replace("/manager/dashboard");
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="NEW CLUB"
          title="Add an activity club"
          meta="Create the public profile Explorers will use to apply for membership."
        />

        <SectionRule label="The club"/>

        <Field label="Club name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Tuesday sea swimmers"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Category" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Swimming"
            placeholderTextColor={INK.readoutFaint}
            value={category}
            onChangeText={setCategory}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[fieldInputStyle,styles.multiline]}
            placeholder="What the sessions are like, and who they are for."
            placeholderTextColor={INK.readoutFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <SectionRule label="Where it meets"/>

        <LocationPicker onChange={setSelectedLocation}/>

        <SectionRule label="Membership"/>

        <Field label="Price per session" hint="Enter 0 for a free club.">
          <TextInput
            style={fieldInputStyle}
            placeholder="0"
            placeholderTextColor={INK.readoutFaint}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Maximum approved members" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="20"
            placeholderTextColor={INK.readoutFaint}
            value={memberLimit}
            onChangeText={setMemberLimit}
            keyboardType="number-pad"
          />
        </Field>

        <Action
          kind="primary"
          glyph="people"
          label="Create this club"
          accessibilityLabel="Create this club"
          loading={loading}
          onPress={createClub}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  multiline:{minHeight:110}
});
