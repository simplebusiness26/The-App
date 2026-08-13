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
  // The map switches. Both off by default; off removes the BUBBLE, never the
  // pin. rooms is deliberately free text and may stay empty -- there is no
  // inventory system behind this and the map says "Available" without a number
  // rather than inventing one. See utils/liveBubbles.js.
  const [showAvailability,setShowAvailability]=useState(false);
  const [roomsAvailable,setRoomsAvailable]=useState("");

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
    setShowAvailability(data.show_availability===true);
    setRoomsAvailable(data.rooms_available===null || data.rooms_available===undefined ? "" : String(data.rooms_available));
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
        longitude:Number(longitude),
        show_availability:showAvailability,
        // Empty means "not stated", which is not the same as zero.
        rooms_available:roomsAvailable.trim()==="" ? null : Number(roomsAvailable.trim())
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

      {/*
        AVAILABILITY, ON THE MAP.
        Only a Manager can know whether this is true, so only a Manager can say
        it. Off by default, and off removes the bubble rather than the pin.
      */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{checked:showAvailability}}
        accessibilityLabel="Show availability on the map"
        style={[styles.toggle,showAvailability && styles.toggleOn]}
        onPress={()=>setShowAvailability((current)=>!current)}
      >
        <Text style={styles.toggleText}>
          {showAvailability ? "On — availability can appear on the map" : "Show availability on the map"}
        </Text>
      </Pressable>

      {showAvailability && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Rooms available (optional)"
            keyboardType="number-pad"
            maxLength={2}
            value={roomsAvailable}
            onChangeText={setRoomsAvailable}
            accessibilityLabel="Rooms available, optional"
          />
          <Text style={styles.help}>
            Leave this empty and the map simply says &quot;Available&quot;. Xplorer does not
            track bookings, so it will never claim a number you have not given it.
          </Text>
        </>
      )}

      <LocationPicker initialAddress={address} initialLatitude={latitude} initialLongitude={longitude} onChange={chooseLocation}/>

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Save Changes</Text>}
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
  input:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,padding:15,borderRadius:10,marginBottom:15},
  multiline:{minHeight:100,textAlignVertical:"top"},
  toggle:{borderWidth:2,borderColor:INK.hair,borderRadius:11,padding:14,marginBottom:14,minHeight:44,justifyContent:"center"},
  toggleOn:{borderColor:INK.ink},
  toggleText:{color:INK.ink,fontWeight:"800"},
  help:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:-6,marginBottom:14},
  button:{backgroundColor:INK.ink,padding:15,borderRadius:10},
  deleteButton:{backgroundColor:INK.red,padding:15,borderRadius:10,marginTop:14},
  buttonText:{color:INK.card,textAlign:"center",fontWeight:"bold"}
});
