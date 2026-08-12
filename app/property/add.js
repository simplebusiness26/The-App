import React,{useState} from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from "react-native";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import LocationPicker from "../../components/LocationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Property</Text>
      <TextInput style={styles.input} placeholder="Property Name" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Host Name" value={host} onChangeText={setHost}/>
      <TextInput style={[styles.input,styles.multiline]} placeholder="Description" value={description} onChangeText={setDescription} multiline/>
      <TextInput style={styles.input} placeholder="Booking URL" value={bookingUrl} onChangeText={setBookingUrl}/>

      <LocationPicker onChange={setSelectedLocation}/>

      <Pressable style={styles.button} onPress={addProperty} disabled={loading}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Create Property Listing</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:30,fontWeight:"bold",marginBottom:20},
  input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",padding:15,borderRadius:10,marginBottom:15},
  multiline:{minHeight:100,textAlignVertical:"top"},
  button:{backgroundColor:"#222",padding:15,borderRadius:10},
  buttonText:{color:"white",textAlign:"center",fontWeight:"bold"}
});
