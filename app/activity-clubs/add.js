import React,{useState} from "react";
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
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import LocationPicker from "../../components/LocationPicker";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";
import {TYPE} from "../../styles/typography";

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
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Activity Club</Text>
        <Text style={styles.subtitle}>Create the public profile explorers will use to apply for membership.</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Club name</Text>
          <TextInput style={styles.input} placeholder="e.g. Hastings Sea Swimmers" placeholderTextColor={INK.inkSoft} value={name} onChangeText={setName}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <TextInput style={styles.input} placeholder="e.g. Swimming" placeholderTextColor={INK.inkSoft} value={category} onChangeText={setCategory}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input,styles.multiline]} placeholder="What should Explorers know?" placeholderTextColor={INK.inkSoft} value={description} onChangeText={setDescription} multiline/>
        </View>

        <LocationPicker onChange={setSelectedLocation}/>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Price per session</Text>
          <TextInput style={styles.input} placeholder="0" placeholderTextColor={INK.inkSoft} value={price} onChangeText={setPrice} keyboardType="decimal-pad"/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Maximum approved members</Text>
          <TextInput style={styles.input} placeholder="20" placeholderTextColor={INK.inkSoft} value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad"/>
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: design round r001-a, directive 12. */}
      <View style={styles.stickyBar}>
        <Pressable style={styles.button} onPress={createClub} disabled={loading}>
          {loading ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Create Activity Club</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flex:1},
  content:{padding:20,paddingBottom:110},
  title:{...TYPE.display},
  subtitle:{color:INK.inkSoft,lineHeight:22,marginTop:7,marginBottom:20},
  field:{marginBottom:14},
  fieldLabel:{...TYPE.sectionLabel,marginBottom:7},
  input:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:6,padding:13,color:INK.ink,fontSize:14,minHeight:44},
  multiline:{minHeight:110,textAlignVertical:"top"},
  stickyBar:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    backgroundColor:INK.card,
    borderTopWidth:2,
    borderTopColor:INK.ink,
    padding:16
  },
  button:{backgroundColor:INK.ink,borderWidth:2,borderColor:INK.ink,padding:14,borderRadius:6,alignItems:"center",minHeight:48,justifyContent:"center"},
  buttonText:{color:INK.card,fontWeight:"900",fontSize:15}
});
