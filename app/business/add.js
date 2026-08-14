import React,{useState} from "react";
import {
  View,
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
import {TYPE} from "../../styles/typography";

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
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Business</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business name</Text>
          <TextInput style={styles.input} placeholder="e.g. The Anchor Inn" placeholderTextColor={INK.inkSoft} value={name} onChangeText={setName}/>
        </View>

        <ClassificationPicker
          category={category}
          businessType={businessType}
          disabled={loading}
          onChange={({category:nextCategory,businessType:nextType})=>{
            setCategory(nextCategory);
            setBusinessType(nextType);
          }}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input,styles.multiline]} placeholder="What should Explorers know?" placeholderTextColor={INK.inkSoft} value={description} onChangeText={setDescription} multiline/>
        </View>

        <LocationPicker onChange={setSelectedLocation}/>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Website</Text>
          <TextInput style={styles.input} placeholder="https://" placeholderTextColor={INK.inkSoft} value={website} onChangeText={setWebsite}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput style={styles.input} placeholder="01234 567890" placeholderTextColor={INK.inkSoft} value={phone} onChangeText={setPhone}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Opening hours</Text>
          <TextInput style={styles.input} placeholder="Mon-Fri 9am-5pm" placeholderTextColor={INK.inkSoft} value={openingHours} onChangeText={setOpeningHours}/>
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: the primary submit stays reachable above the
          tab bar while the form above it scrolls. Design round r001-a,
          directive 12. */}
      <View style={styles.stickyBar}>
        <Pressable style={[styles.button,loading && styles.disabled]} disabled={loading} onPress={addBusiness}>
          {loading ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Create Business Listing</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flex:1},
  content:{padding:20,paddingBottom:110},
  title:{...TYPE.display,marginBottom:20},
  field:{marginBottom:16},
  fieldLabel:{...TYPE.sectionLabel,marginBottom:7},
  input:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,padding:13,borderRadius:6,color:INK.ink,fontSize:14,minHeight:44},
  multiline:{minHeight:100,textAlignVertical:"top"},
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
  disabled:{opacity:0.6},
  buttonText:{color:INK.card,fontWeight:"900",fontSize:15}
});
