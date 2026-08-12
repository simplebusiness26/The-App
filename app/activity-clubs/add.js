import React,{useState} from "react";
import {
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import LocationPicker from "../../components/LocationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Activity Club</Text>
      <Text style={styles.subtitle}>Create the public profile explorers will use to apply for membership.</Text>

      <TextInput style={styles.input} placeholder="Club name *" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Category *" value={category} onChangeText={setCategory}/>
      <TextInput style={[styles.input,styles.multiline]} placeholder="Description" value={description} onChangeText={setDescription} multiline/>

      <LocationPicker onChange={setSelectedLocation}/>

      <TextInput style={styles.input} placeholder="Price per session" value={price} onChangeText={setPrice} keyboardType="decimal-pad"/>
      <TextInput style={styles.input} placeholder="Maximum approved members" value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad"/>

      <Pressable style={styles.button} onPress={createClub} disabled={loading}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Create Activity Club</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},content:{padding:20,paddingBottom:50},title:{fontSize:30,fontWeight:"bold"},subtitle:{color:"#666",lineHeight:22,marginTop:7,marginBottom:20},input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:11,padding:14,marginBottom:14},multiline:{minHeight:110,textAlignVertical:"top"},button:{backgroundColor:INK.blue,padding:16,borderRadius:12,alignItems:"center"},buttonText:{color:"white",fontWeight:"bold"}
});
