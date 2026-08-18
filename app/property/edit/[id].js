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
import ListingLocationPicker from "../../../components/ListingLocationPicker";
import {useFeedback} from "../../../context/FeedbackContext";
import {coordinate} from "../../../utils/coordinates";
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK,SHAPE,TYPE} from "../../../utils/tokens";
import {Action,Field,fieldInputStyle,Glyph,Panel,Screen,ScreenTitle,SectionRule,Toggle} from "../../../components/instrument";
// The switch rows are the kit's Toggle now -- "one claim, on or off, with the
// sentence that explains it". This file, three other form screens and one
// detail screen had each grown their own copy of it.

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
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="EDIT STAY"
          title={property?.name || "Edit property"}
          meta="Changes appear on the map and the listing page straight away."
        />

        <SectionRule label="The listing"/>

        <Field label="Property name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Cliff Top Cottage"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Host name">
          <TextInput
            style={fieldInputStyle}
            placeholder="Who guests will be met by"
            placeholderTextColor={INK.readoutFaint}
            value={host}
            onChangeText={setHost}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[fieldInputStyle,styles.multiline]}
            placeholder="What the stay is like, and what is nearby."
            placeholderTextColor={INK.readoutFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <Field label="Booking URL">
          <TextInput
            style={fieldInputStyle}
            placeholder="https://"
            placeholderTextColor={INK.readoutFaint}
            value={bookingUrl}
            onChangeText={setBookingUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <SectionRule label="On the map"/>

        {/*
          AVAILABILITY, ON THE MAP.
          Only a Manager can know whether this is true, so only a Manager can say
          it. Off by default, and off removes the bubble rather than the pin.
        */}
        <Toggle
          accessibilityLabel="Show availability on the map"
          label={showAvailability ? "On — availability can appear on the map" : "Show availability on the map"}
          hint="Off leaves the pin exactly where it is. It only removes the bubble."
          value={showAvailability}
          onPress={()=>setShowAvailability((current)=>!current)}
        />

        {showAvailability && (
          <Field
            label="Rooms available"
            hint={"Optional. Leave this empty and the map simply says “Available”. Xplorer does not track bookings, so it will never claim a number you have not given it."}
            style={styles.spacedField}
          >
            <TextInput
              style={fieldInputStyle}
              placeholder="2"
              placeholderTextColor={INK.readoutFaint}
              keyboardType="number-pad"
              maxLength={2}
              value={roomsAvailable}
              onChangeText={setRoomsAvailable}
              accessibilityLabel="Rooms available, optional"
            />
          </Field>
        )}

        <SectionRule label="Where it is"/>

        <ListingLocationPicker
          initialAddress={address}
          initialLatitude={latitude}
          initialLongitude={longitude}
          onChange={chooseLocation}
        />

        <Action
          kind="primary"
          glyph="check"
          label="Save this property"
          accessibilityLabel="Save this property"
          loading={saving}
          onPress={save}
        />

        {/* See the note on the same control in app/business/edit/[id].js:
            `dispute` is the manager's colour, not a generic destructive one. */}
        <Action
          kind="quiet"
          glyph="trash"
          label="Delete this property"
          accessibilityLabel="Delete this property"
          style={styles.delete}
          onPress={deleteProperty}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  multiline:{minHeight:110},
  spacedField:{marginTop:12},


  delete:{marginTop:12}
});
