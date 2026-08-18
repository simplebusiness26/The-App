import React,{useEffect,useState} from "react";
import {
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView
} from "react-native";
import {useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../../services/supabase";
import ListingLocationPicker from "../../../components/ListingLocationPicker";
import ClassificationPicker from "../../../components/ClassificationPicker";
import {UNCLASSIFIED} from "../../../utils/taxonomy";
import {useFeedback} from "../../../context/FeedbackContext";
import {coordinate} from "../../../utils/coordinates";
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK} from "../../../utils/tokens";
import {Action,Field,fieldInputStyle,Screen,ScreenTitle,SectionRule} from "../../../components/instrument";

export default function EditBusiness(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [business,setBusiness]=useState(null);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [phone,setPhone]=useState("");
  const [website,setWebsite]=useState("");
  const [address,setAddress]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [category,setCategory]=useState(UNCLASSIFIED);
  const [businessType,setBusinessType]=useState(UNCLASSIFIED);
  const [image,setImage]=useState("");
  const [openingHours,setOpeningHours]=useState("");

  useEffect(()=>{loadBusiness();},[id]);

  async function loadBusiness(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      showFeedback("Please log in before editing a business.","error","Login required");
      router.back();
      return;
    }

    const {data,error}=await supabase
      .from("businesses")
      .select("*")
      .eq("id",id)
      .eq("owner_id",user.id)
      .single();

    if(error || !data){
      showFeedback("You do not own this business listing.","error","Access denied");
      router.back();
      return;
    }

    setBusiness(data);
    setName(data.name || "");
    setDescription(data.description || "");
    setPhone(data.phone || "");
    setWebsite(data.website || "");
    setAddress(data.address || "");
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setCategory(data.category || UNCLASSIFIED);
    setBusinessType(data.business_type || UNCLASSIFIED);
    setImage(data.image || "");
    setOpeningHours(data.opening_hours || "");
    setLoading(false);
  }

  function chooseLocation(value){
    setAddress(value.address);
    setLatitude(value.latitude);
    setLongitude(value.longitude);
  }

  async function save(){
    if(!business || saving) return;

    // coordinate() rather than Number.isFinite(Number(x)): an empty field is
    // Number("")===0, which is finite, so the old guard passed validation and
    // saved the listing at 0,0 in the Gulf of Guinea.
    if(!address || coordinate(latitude)===null || coordinate(longitude)===null){
      Alert.alert("Choose a location","Search for the business address and select the correct result.");
      return;
    }

    setSaving(true);

    const {error}=await supabase
      .from("businesses")
      .update({
        name:name.trim(),
        description:description.trim(),
        phone:phone.trim(),
        website:website.trim(),
        address,
        latitude:Number(latitude),
        longitude:Number(longitude),
        category,
        business_type:businessType,
        image:image.trim(),
        opening_hours:openingHours.trim()
      })
      .eq("id",business.id);

    setSaving(false);

    if(error){
      showFeedback(error.message,"error","Business not updated");
      return;
    }

    showFeedback(`${name.trim()} was updated successfully.`,"success","Business updated");
    router.replace("/manager/dashboard");
  }

  function deleteBusiness(){
    Alert.alert("Delete Business","Are you sure you want to delete this listing?",[
      {text:"Cancel",style:"cancel"},
      {
        text:"Delete",
        style:"destructive",
        onPress:async()=>{
          const {error}=await supabase.from("businesses").delete().eq("id",business.id);
          if(error){
            showFeedback(error.message,"error","Business not deleted");
            return;
          }
          showFeedback(`${business.name} was deleted.`,"success","Business deleted");
          router.replace("/manager/dashboard");
        }
      }
    ]);
  }

  if(loading){
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="EDIT BUSINESS"
          title={business?.name || "Edit business"}
          meta="Changes appear on the map and the listing page straight away."
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
          claimed={business?.claimed===true}
          disabled={saving}
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

        <ListingLocationPicker
          initialAddress={address}
          initialLatitude={latitude}
          initialLongitude={longitude}
          onChange={chooseLocation}
        />

        <SectionRule label="How to reach it"/>

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

        <Field label="Main image URL">
          <TextInput
            style={fieldInputStyle}
            placeholder="https://"
            placeholderTextColor={INK.readoutFaint}
            value={image}
            onChangeText={setImage}
            autoCapitalize="none"
            keyboardType="url"
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
          glyph="check"
          label="Save this business"
          accessibilityLabel="Save this business"
          loading={saving}
          onPress={save}
        />

        {/*
          Delete is a destructive choice, not a manager dispute -- `dispute` is
          reserved for that one pair (docs/design-system.md), so the quietest
          control on the screen carries it instead of the loudest colour. The
          confirmation dialog is what actually guards it.
        */}
        <Action
          kind="quiet"
          glyph="trash"
          label="Delete this business"
          accessibilityLabel="Delete this business"
          style={styles.delete}
          onPress={deleteBusiness}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  multiline:{minHeight:110},
  delete:{marginTop:12}
});
