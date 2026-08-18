import React,{useState} from "react";
import {
  TextInput,
  StyleSheet,
  Alert,
  ScrollView
} from "react-native";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import ListingLocationPicker from "../../components/ListingLocationPicker";
import ClassificationPicker from "../../components/ClassificationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {UNCLASSIFIED} from "../../utils/taxonomy";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK} from "../../utils/tokens";
import {Action,Field,fieldInputStyle,Screen,ScreenTitle,SectionRule} from "../../components/instrument";

export default function AddBusiness(){
  const {showFeedback}=useFeedback();
  const [name,setName]=useState("");
  const [category,setCategory]=useState(UNCLASSIFIED);
  const [businessType,setBusinessType]=useState(UNCLASSIFIED);
  const [description,setDescription]=useState("");
  const [website,setWebsite]=useState("");
  const [phone,setPhone]=useState("");
  const [openingHours,setOpeningHours]=useState("");
  const [selectedLocation,setSelectedLocation]=useState(null);
  const [loading,setLoading]=useState(false);

  async function addBusiness(){
    if(loading) return;

    if(!name.trim()){
      Alert.alert("Missing information","A business name is required.");
      return;
    }

    if(category===UNCLASSIFIED){
      Alert.alert("Choose a category","Pick the category this business belongs to.");
      return;
    }

    if(!selectedLocation){
      Alert.alert("Choose a location","Search for the business address and select the correct result.");
      return;
    }

    setLoading(true);

    const {data:{user},error:userError}=await supabase.auth.getUser();

    if(userError || !user){
      setLoading(false);
      showFeedback("You must be logged in to create a business.","error","Business not created");
      return;
    }

    const {error}=await supabase
      .from("businesses")
      .insert({
        owner_id:user.id,
        name:name.trim(),
        category,
        business_type:businessType,
        description:description.trim(),
        address:selectedLocation.address,
        website:website.trim(),
        phone:phone.trim(),
        opening_hours:openingHours.trim(),
        latitude:selectedLocation.latitude,
        longitude:selectedLocation.longitude,
        claimed:true
      });

    setLoading(false);

    if(error){
      console.log(error);
      showFeedback(error.message,"error","Business not created");
      return;
    }

    showFeedback(`${name.trim()} was created and added to your dashboard.`,"success","Business created");
    router.replace("/manager/dashboard");
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="NEW BUSINESS"
          title="Add a business"
          meta="It goes on the map as soon as it is created, and into your manager dashboard."
        />

        <SectionRule label="The listing"/>

        <Field label="Business name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="The Rock House"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <ClassificationPicker
          category={category}
          businessType={businessType}
          disabled={loading}
          onChange={({category:nextCategory,businessType:nextType})=>{
            setCategory(nextCategory);
            setBusinessType(nextType);
          }}
        />

        <Field label="Description">
          <TextInput
            style={[fieldInputStyle,styles.multiline]}
            placeholder="What it is, and what somebody should know before coming."
            placeholderTextColor={INK.readoutFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <SectionRule label="Where it is"/>

        <ListingLocationPicker onChange={setSelectedLocation}/>

        <SectionRule label="How to reach it"/>

        <Field label="Website">
          <TextInput
            style={fieldInputStyle}
            placeholder="https://"
            placeholderTextColor={INK.readoutFaint}
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="Phone">
          <TextInput
            style={fieldInputStyle}
            placeholder="01424 000000"
            placeholderTextColor={INK.readoutFaint}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Field>

        <Field label="Opening hours">
          <TextInput
            style={fieldInputStyle}
            placeholder="Mon–Sat 9–5"
            placeholderTextColor={INK.readoutFaint}
            value={openingHours}
            onChangeText={setOpeningHours}
          />
        </Field>

        <Action
          kind="primary"
          glyph="plus"
          label="Create this business listing"
          accessibilityLabel="Create this business listing"
          loading={loading}
          onPress={addBusiness}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  multiline:{minHeight:110}
});
