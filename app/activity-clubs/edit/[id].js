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
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK,SHAPE,TYPE} from "../../../utils/tokens";
import {Action,Field,fieldInputStyle,Glyph,Notice,Panel,Screen,ScreenTitle,SectionRule,Segmented} from "../../../components/instrument";

// The same switch app/property/edit/[id].js builds, for the same reason: the kit
// has no "one claim, on or off, with the sentence that explains it". Panel steps
// to `panelRaised` when it is on and a bracketed tick box sits on the housing --
// no state ink, because being switched on is not a state a place is in.
function SwitchRow({label,hint,value,onPress,accessibilityLabel}){
  return(
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked:value}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <Panel raised={value} style={styles.switchRow}>
        <View style={[styles.switchBox,value&&styles.switchBoxOn]}>
          {value ? <Glyph name="check" size={13} colour={INK.readout} weight={1.9}/> : null}
        </View>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>{label}</Text>
          {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
        </View>
      </Panel>
    </Pressable>
  );
}

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
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  if(error){
    return(
      <Screen>
        <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
          <ScreenTitle eyebrow="EDIT CLUB" title="Club unavailable"/>
          <Notice tone="dispute" label="Not loaded">{error}</Notice>
        </ScrollView>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
        <ScreenTitle
          eyebrow="EDIT CLUB"
          title={name.trim() || "Edit activity club"}
          meta="Update the public listing, location and membership capacity."
        />

        <SectionRule label="The club"/>

        <Field label="Club name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Tuesday sea swimmers"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Category" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Swimming"
            placeholderTextColor={INK.readoutFaint}
            value={category}
            onChangeText={setCategory}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[fieldInputStyle,styles.multiline]}
            placeholder="What the sessions are like, and who they are for."
            placeholderTextColor={INK.readoutFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <SectionRule label="Where it meets"/>

        <LocationPicker
          initialAddress={address}
          initialLocation={location}
          initialLatitude={latitude}
          initialLongitude={longitude}
          onChange={chooseLocation}
        />

        <SectionRule label="Membership"/>

        <Field label="Price per session" hint="Enter 0 for a free club.">
          <TextInput
            style={fieldInputStyle}
            placeholder="0"
            placeholderTextColor={INK.readoutFaint}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Maximum approved members" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="20"
            placeholderTextColor={INK.readoutFaint}
            value={memberLimit}
            onChangeText={setMemberLimit}
            keyboardType="number-pad"
          />
        </Field>

        <SectionRule label="On the map"/>

        {/*
          SPACES OPEN, ON THE MAP.
          A claim about a club only its Manager can know is true, so only its
          Manager can make it. Off is the default and off removes the BUBBLE, not
          the pin -- the club stays on the map, searchable and joinable, it just
          does not shout. See utils/liveBubbles.js.
        */}
        <SwitchRow
          accessibilityLabel="Show spaces open on the map"
          label={spacesAvailable ? "On — a small bubble can appear over this club" : "Show “Spaces open” on the map"}
          hint="Off leaves the club on the map, searchable and joinable. It only removes the bubble."
          value={spacesAvailable}
          onPress={()=>setSpacesAvailable((current)=>!current)}
        />

        <Field label="Listing status" style={styles.spacedField}>
          <Segmented
            items={["open","full","closed","draft"]}
            active={status}
            onChange={setStatus}
          />
        </Field>

        <Action
          kind="primary"
          glyph="check"
          label="Save this club"
          accessibilityLabel="Save this club"
          loading={saving}
          onPress={saveClub}
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

  switchRow:{flexDirection:"row",alignItems:"center",gap:12,padding:13,minHeight:SHAPE.tapTarget},
  switchBox:{
    width:22,height:22,borderRadius:SHAPE.radius.control,
    borderWidth:SHAPE.border,borderColor:INK.hairline,backgroundColor:INK.inset,
    alignItems:"center",justifyContent:"center"
  },
  switchBoxOn:{borderColor:INK.hairlineStrong,backgroundColor:INK.panelRaised},
  switchText:{flex:1,minWidth:0},
  switchLabel:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.4},
  switchHint:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:4}
});
