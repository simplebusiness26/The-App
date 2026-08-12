import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import LocationPicker from "../../../components/LocationPicker";
import {useFeedback} from "../../../context/FeedbackContext";
import {coordinate} from "../../../utils/coordinates";
import {INK} from "../../../utils/tokens";

export default function EditProperty(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [property,setProperty]=useState(null);
  const [name,setName]=useState("");
  const [host,setHost]=useState("");
  const [description,setDescription]=useState("");
  const [bookingUrl,setBookingUrl]=useState("");
  const [address,setAddress]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);

  useFocusEffect(
    useCallback(()=>{
      if(id) loadProperty();
    },[id])
  );

  async function loadProperty(){
    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      showFeedback("Please log in before editing a property.","error","Login required");
      router.replace("/auth/login");
      return;
    }

    const {data,error}=await supabase
      .from("properties")
      .select("*")
      .eq("id",id)
      .eq("owner_id",user.id)
      .single();

    if(error || !data){
      showFeedback("You do not own this property listing.","error","Access denied");
      router.replace("/manager/dashboard");
      return;
    }

    setProperty(data);
    setName(data.name || "");
    setHost(data.host || "");
    setDescription(data.description || "");
    setBookingUrl(data.booking_url || "");
    setAddress(data.address || "");
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setLoading(false);
  }

  function chooseLocation(value){
    setAddress(value.address);
    setLatitude(value.latitude);
    setLongitude(value.longitude);
  }

  async function save(){
    if(!property || saving) return;

    // See utils/coordinates.js: Number("")===0 is finite, so the old guard let
    // an empty coordinate through and saved the listing at 0,0.
    if(!address || coordinate(latitude)===null || coordinate(longitude)===null){
      Alert.alert("Choose a location","Search for the property address and select the correct result.");
      return;
    }

    setSaving(true);

    const {error}=await supabase
      .from("properties")
      .update({
        name:name.trim(),
        host:host.trim(),
        description:description.trim(),
        booking_url:bookingUrl.trim(),
        address,
        latitude:Number(latitude),
        longitude:Number(longitude)
      })
      .eq("id",property.id);

    setSaving(false);

    if(error){
      showFeedback(error.message,"error","Property not updated");
      return;
    }

    showFeedback(`${name.trim()} was updated successfully.`,"success","Property updated");
    router.replace("/manager/dashboard");
  }

  function deleteProperty(){
    Alert.alert("Delete Property","Are you sure you want to delete this listing?",[
      {text:"Cancel",style:"cancel"},
      {
        text:"Delete",
        style:"destructive",
        onPress:async()=>{
          const {error}=await supabase.from("properties").delete().eq("id",property.id);
          if(error){
            showFeedback(error.message,"error","Property not deleted");
            return;
          }
          showFeedback(`${property.name} was deleted.`,"success","Property deleted");
          router.replace("/manager/dashboard");
        }
      }
    ]);
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Property</Text>
      <TextInput style={styles.input} placeholder="Property name" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Host name" value={host} onChangeText={setHost}/>
      <TextInput style={[styles.input,styles.multiline]} placeholder="Description" value={description} onChangeText={setDescription} multiline/>
      <TextInput style={styles.input} placeholder="Booking URL" value={bookingUrl} onChangeText={setBookingUrl}/>

      <LocationPicker initialAddress={address} initialLatitude={latitude} initialLongitude={longitude} onChange={chooseLocation}/>

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Save Changes</Text>}
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={deleteProperty}>
        <Text style={styles.buttonText}>Delete Property</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:"center",justifyContent:"center"},
  title:{fontSize:30,fontWeight:"bold",marginBottom:20},
  input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",padding:15,borderRadius:10,marginBottom:15},
  multiline:{minHeight:100,textAlignVertical:"top"},
  button:{backgroundColor:"#222",padding:15,borderRadius:10},
  deleteButton:{backgroundColor:INK.red,padding:15,borderRadius:10,marginTop:14},
  buttonText:{color:"white",textAlign:"center",fontWeight:"bold"}
});
