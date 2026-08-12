import React,{useState} from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from "react-native";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import LocationPicker from "../../components/LocationPicker";
import ClassificationPicker from "../../components/ClassificationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {UNCLASSIFIED} from "../../utils/taxonomy";
import {INK} from "../../utils/tokens";

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Business</Text>

      <TextInput style={styles.input} placeholder="Business Name *" value={name} onChangeText={setName}/>
      <ClassificationPicker
        category={category}
        businessType={businessType}
        disabled={loading}
        onChange={({category:nextCategory,businessType:nextType})=>{
          setCategory(nextCategory);
          setBusinessType(nextType);
        }}
      />
      <TextInput style={[styles.input,styles.multiline]} placeholder="Description" value={description} onChangeText={setDescription} multiline/>

      <LocationPicker onChange={setSelectedLocation}/>

      <TextInput style={styles.input} placeholder="Website" value={website} onChangeText={setWebsite}/>
      <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone}/>
      <TextInput style={styles.input} placeholder="Opening Hours" value={openingHours} onChangeText={setOpeningHours}/>

      <Pressable style={[styles.button,loading && styles.disabled]} disabled={loading} onPress={addBusiness}>
        {loading ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Create Business Listing</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:30,fontWeight:"bold",marginBottom:20},
  input:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,padding:15,borderRadius:10,marginBottom:15},
  multiline:{minHeight:100,textAlignVertical:"top"},
  button:{backgroundColor:INK.ink,padding:16,borderRadius:10,alignItems:"center"},
  disabled:{opacity:0.6},
  buttonText:{color:INK.card,fontWeight:"bold"}
});
