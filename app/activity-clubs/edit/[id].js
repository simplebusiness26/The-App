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
import {TYPE} from "../../../styles/typography";

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
  // The map switch. Off by default, and off means the club is still on the map
  // and still joinable -- it simply does not advertise.
  const [spacesAvailable,setSpacesAvailable]=useState(false);
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
    setSpacesAvailable(data.spaces_available===true);
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
        status,
        spaces_available:spacesAvailable
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
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Edit Activity Club</Text>
        <Text style={styles.subtitle}>Update the public listing, location and membership capacity.</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Club name</Text>
          <TextInput style={styles.input} placeholder="Club name" placeholderTextColor={INK.inkSoft} value={name} onChangeText={setName}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <TextInput style={styles.input} placeholder="Category" placeholderTextColor={INK.inkSoft} value={category} onChangeText={setCategory}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input,styles.multiline]} placeholder="Description" placeholderTextColor={INK.inkSoft} value={description} onChangeText={setDescription} multiline/>
        </View>

        <LocationPicker initialAddress={address} initialLocation={location} initialLatitude={latitude} initialLongitude={longitude} onChange={chooseLocation}/>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Price per session</Text>
          <TextInput style={styles.input} placeholder="Price per session" placeholderTextColor={INK.inkSoft} value={price} onChangeText={setPrice} keyboardType="decimal-pad"/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Maximum approved members</Text>
          <TextInput style={styles.input} placeholder="Maximum approved members" placeholderTextColor={INK.inkSoft} value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad"/>
        </View>

        {/*
          SPACES OPEN, ON THE MAP.
          A claim about a club only its Manager can know is true, so only its
          Manager can make it. Off is the default and off removes the BUBBLE, not
          the pin -- the club stays on the map, searchable and joinable, it just
          does not shout. See utils/liveBubbles.js.
        */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Show &quot;Spaces open&quot; on the map</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked:spacesAvailable}}
            accessibilityLabel="Show spaces open on the map"
            style={[styles.statusButton,spacesAvailable && styles.selectedStatus,{alignSelf:"flex-start"}]}
            onPress={()=>setSpacesAvailable((current)=>!current)}
          >
            <Text style={[styles.statusText,spacesAvailable && styles.selectedStatusText]}>
              {spacesAvailable ? "On — a small bubble can appear over this club" : "Off"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Listing status</Text>
          <View style={styles.statusRow}>
            {["open","full","closed","draft"].map(option=>(
              <Pressable key={option} style={[styles.statusButton,status===option && styles.selectedStatus]} onPress={()=>setStatus(option)}>
                <Text style={[styles.statusText,status===option && styles.selectedStatusText]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: design round r001-a, directive 12. */}
      <View style={styles.stickyBar}>
        <Pressable style={styles.button} onPress={saveClub} disabled={saving}>
          {saving ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Save Changes</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flex:1},
  content:{padding:20,paddingBottom:110},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:INK.paper},
  error:{fontSize:17,textAlign:"center",color:INK.ink},
  title:{...TYPE.display},
  subtitle:{color:INK.inkSoft,lineHeight:22,marginTop:7,marginBottom:20},
  field:{marginBottom:16},
  fieldLabel:{...TYPE.sectionLabel,marginBottom:7},
  input:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:6,padding:13,color:INK.ink,fontSize:14,minHeight:44},
  multiline:{minHeight:110,textAlignVertical:"top"},
  statusRow:{flexDirection:"row",flexWrap:"wrap",gap:8},
  statusButton:{paddingHorizontal:14,paddingVertical:10,borderRadius:20,borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card,minHeight:44,justifyContent:"center"},
  selectedStatus:{backgroundColor:INK.ink},
  statusText:{textTransform:"capitalize",fontWeight:"700",color:INK.ink},
  selectedStatusText:{color:INK.card},
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
