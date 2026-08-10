import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView
} from "react-native";
import {useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../../services/supabase";
import LocationPicker from "../../../components/LocationPicker";
import ClassificationPicker from "../../../components/ClassificationPicker";
import {UNCLASSIFIED} from "../../../utils/taxonomy";
import {useFeedback} from "../../../context/FeedbackContext";
import {coordinate} from "../../../utils/coordinates";

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
    return <View style={styles.loading}><ActivityIndicator size="large"/></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Business</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Business name"/>
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
      <TextInput style={[styles.input,styles.multiline]} value={description} onChangeText={setDescription} placeholder="Description" multiline/>

      <LocationPicker initialAddress={address} initialLatitude={latitude} initialLongitude={longitude} onChange={chooseLocation}/>

      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone"/>
      <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="Website"/>
      <TextInput style={styles.input} value={image} onChangeText={setImage} placeholder="Main image URL"/>
      <TextInput style={styles.input} value={openingHours} onChangeText={setOpeningHours} placeholder="Opening hours"/>

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Save Changes</Text>}
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={deleteBusiness}>
        <Text style={styles.buttonText}>Delete Business</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:20,paddingBottom:50},loading:{flex:1,justifyContent:"center",alignItems:"center"},title:{fontSize:30,fontWeight:"bold",marginBottom:20},input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",padding:15,borderRadius:10,marginBottom:15},multiline:{minHeight:100,textAlignVertical:"top"},button:{backgroundColor:"#222",padding:15,borderRadius:10,marginTop:10},deleteButton:{backgroundColor:"#c62828",padding:15,borderRadius:10,marginTop:15},buttonText:{color:"white",textAlign:"center",fontWeight:"bold"}
});
