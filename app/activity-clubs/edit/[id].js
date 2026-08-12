import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import LocationPicker from "../../../components/LocationPicker";
import {useFeedback} from "../../../context/FeedbackContext";
import {coordinate} from "../../../utils/coordinates";
import {INK} from "../../../utils/tokens";

export default function EditActivityClub(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();
  const [name,setName]=useState("");
  const [category,setCategory]=useState("");
  const [description,setDescription]=useState("");
  const [location,setLocation]=useState("");
  const [address,setAddress]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [price,setPrice]=useState("0");
  const [memberLimit,setMemberLimit]=useState("20");
  const [status,setStatus]=useState("open");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{if(id) loadClub();},[id]));

  async function loadClub(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      showFeedback("Please log in before editing an Activity Club.","error","Login required");
      router.replace("/auth/login");
      return;
    }

    const {data,error:clubError}=await supabase
      .from("activity_clubs")
      .select("*")
      .eq("id",id)
      .eq("manager_id",user.id)
      .single();

    if(clubError){
      setError("This Activity Club could not be loaded or is not owned by your account.");
      setLoading(false);
      return;
    }

    setName(data.name || "");
    setCategory(data.category || "");
    setDescription(data.description || "");
    setLocation(data.location || "");
    setAddress(data.address || "");
    setLatitude(data.latitude ?? null);
    setLongitude(data.longitude ?? null);
    setPrice(String(data.price ?? 0));
    setMemberLimit(String(data.member_limit ?? 20));
    setStatus(data.status || "open");
    setLoading(false);
  }

  function chooseLocation(value){
    setLocation(value.location || "");
    setAddress(value.address);
    setLatitude(value.latitude);
    setLongitude(value.longitude);
  }

  async function saveClub(){
    if(saving) return;

    if(!name.trim() || !category.trim()){
      Alert.alert("Missing information","Name and category are required.");
      return;
    }

    // See utils/coordinates.js: Number("")===0 is finite, so the old guard let
    // an empty coordinate through and saved the Club at 0,0.
    if(!address || coordinate(latitude)===null || coordinate(longitude)===null){
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

    setSaving(true);

    const {data:{user}}=await supabase.auth.getUser();
    const {error:updateError}=await supabase
      .from("activity_clubs")
      .update({
        name:name.trim(),
        category:category.trim(),
        description:description.trim(),
        location,
        address,
        latitude:Number(latitude),
        longitude:Number(longitude),
        price:numericPrice,
        member_limit:numericLimit,
        status
      })
      .eq("id",id)
      .eq("manager_id",user.id);

    setSaving(false);

    if(updateError){
      showFeedback(updateError.message,"error","Club not updated");
      return;
    }

    showFeedback(`${name.trim()} was updated successfully.`,"success","Activity Club updated");
    router.replace("/manager/dashboard");
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large"/></View>;
  }

  if(error){
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Activity Club</Text>
      <Text style={styles.subtitle}>Update the public listing, location and membership capacity.</Text>

      <TextInput style={styles.input} placeholder="Club name *" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Category *" value={category} onChangeText={setCategory}/>
      <TextInput style={[styles.input,styles.multiline]} placeholder="Description" value={description} onChangeText={setDescription} multiline/>

      <LocationPicker initialAddress={address} initialLocation={location} initialLatitude={latitude} initialLongitude={longitude} onChange={chooseLocation}/>

      <TextInput style={styles.input} placeholder="Price per session" value={price} onChangeText={setPrice} keyboardType="decimal-pad"/>
      <TextInput style={styles.input} placeholder="Maximum approved members" value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad"/>

      <Text style={styles.label}>Listing status</Text>
      <View style={styles.statusRow}>
        {["open","full","closed","draft"].map(option=>(
          <Pressable key={option} style={[styles.statusButton,status===option && styles.selectedStatus]} onPress={()=>setStatus(option)}>
            <Text style={[styles.statusText,status===option && styles.selectedStatusText]}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={saveClub} disabled={saving}>
        {saving ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Save Changes</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},content:{padding:20,paddingBottom:50},center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},error:{fontSize:17,textAlign:"center"},title:{fontSize:30,fontWeight:"bold"},subtitle:{color:INK.inkSoft,lineHeight:22,marginTop:7,marginBottom:20},input:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:11,padding:14,marginBottom:14},multiline:{minHeight:110,textAlignVertical:"top"},label:{fontWeight:"bold",fontSize:16,marginBottom:10},statusRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:20},statusButton:{paddingHorizontal:14,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:INK.hair,backgroundColor:INK.card},selectedStatus:{borderColor:INK.blue,borderWidth:2},statusText:{textTransform:"capitalize",fontWeight:"600"},selectedStatusText:{color:INK.ink},button:{backgroundColor:INK.blue,padding:16,borderRadius:12,alignItems:"center"},buttonText:{color:INK.card,fontWeight:"bold"}
});
