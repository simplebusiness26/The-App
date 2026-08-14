import React,{useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";
import {TYPE} from "../../styles/typography";

// Public places only. A check-in used to accept businesses, clubs and events
// as well, which is a different act wearing the same word: it broadcasts your
// position at a private address, and the business has no say in whether it
// happens. Both public types stay, because public_places holds eight kinds --
// beaches, viewpoints, greens -- and allowing a park but not a beach would be
// an arbitrary line through one table.
const TYPES=[
  {key:"park",label:"Park"},
  {key:"public_place",label:"Other public place"}
];
const ACTIVITIES=["Walking","Running","Coffee","Eating","Sport","Relaxing","Exploring","Other"];

// What the check-in screen tells you about who will see it. Read from your one
// visibility setting rather than chosen here -- there is a single audience
// control, on Settings, and it covers the whole app.
const AUDIENCE_SENTENCE={
  nobody:"Your visibility is set to nobody, so this check-in will be visible only to you. Change it in Settings if you want other people to see it.",
  close_friends:"Only the people on your close friends list will see this.",
  friends:"People you and they both follow will see this.",
  everyone:"Any Explorer nearby will see this."
};

export default function CreateCheckin(){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [placeType,setPlaceType]=useState("park");
  const [targetId,setTargetId]=useState(null);
  const [publicPlaceId,setPublicPlaceId]=useState(null);
  const [placeName,setPlaceName]=useState("");
  const [area,setArea]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [activity,setActivity]=useState("Walking");
  const [customActivity,setCustomActivity]=useState("");
  const [message,setMessage]=useState("");
  const [visibility,setVisibility]=useState("nobody");
  const [minutes,setMinutes]=useState(120);
  const [places,setPlaces]=useState([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [locating,setLocating]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{loadUser();},[]);
  useEffect(()=>{loadPlaces(placeType);},[placeType]);

  async function loadUser(){
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    const {data:profile}=await supabase.from("profiles").select("area,visibility").eq("id",currentUser.id).maybeSingle();
    setUser(currentUser);
    setArea(profile?.area || "");
    setVisibility(
      Object.keys(AUDIENCE_SENTENCE).includes(profile?.visibility)
        ? profile.visibility
        : "nobody"
    );
    setLoading(false);
  }

  // Packet 8e: a park is a row now, not a spelling. Choosing one from this list
  // attaches the canonical id, so twelve check-ins at one park stop arriving as
  // twelve different places. Typing a name still works exactly as before -- the
  // free-text fields are untouched and the reference stays null.
  async function loadPlaces(type){
    setTargetId(null);setPublicPlaceId(null);setQuery("");setPlaces([]);
    setLoadingPlaces(true);
    let request;
    if(type==="park"||type==="public_place") request=supabase.from("public_places").select("id,name,place_type,location_description,latitude,longitude,status").eq("status","published").order("name").limit(80);
    if(type==="business") request=supabase.from("businesses").select("id,name,address,latitude,longitude").order("name").limit(80);
    if(type==="activity_club") request=supabase.from("activity_clubs").select("id,name,location,latitude,longitude,status").in("status",["open","full"]).order("name").limit(80);
    if(type==="event") request=supabase.from("events").select("id,name,location,latitude,longitude,status").eq("status","published").order("starts_at").limit(80);
    const {data,error:placesError}=await request;
    if(placesError){setError("Places could not be loaded.");setPlaces([]);} else setPlaces(data || []);
    setLoadingPlaces(false);
  }

  const isPublicPlace=["park","public_place"].includes(placeType);

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    if(!term) return places;
    return places.filter(item=>`${item.name} ${item.address||item.location||item.location_description||""}`.toLowerCase().includes(term));
  },[places,query]);

  function selectPlace(place){
    // A canonical public place carries public_place_id; a listing carries
    // target_id. The RPC refuses the wrong one for the place type.
    if(isPublicPlace){
      setPublicPlaceId(place.id);
      setTargetId(null);
    }else{
      setTargetId(place.id);
      setPublicPlaceId(null);
    }
    setPlaceName(place.name);
    if(place.latitude!=null&&place.longitude!=null){
      setLatitude(Number(Number(place.latitude).toFixed(2)));
      setLongitude(Number(Number(place.longitude).toFixed(2)));
    }
  }

  async function useLocation(){
    setLocating(true);setError("");
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setLatitude(Number(position.coords.latitude.toFixed(2)));setLongitude(Number(position.coords.longitude.toFixed(2)));
    }catch(locationError){setError(locationError.message || "Location could not be added.");}
    setLocating(false);
  }

  async function publish(){
    if(working||!user) return;
    setError("");
    const selectedActivity=activity==="Other"?customActivity.trim():activity.trim();
    if(!publicPlaceId) return setError("Choose the public place you are at from the list.");
    if(area.trim().length<2) return setError("Add the broad area, such as a town or neighbourhood.");
    if(selectedActivity.length<2) return setError("Choose what you are doing or enter a custom activity.");
    setWorking(true);
    const {error:checkinError}=await supabase.rpc("start_live_checkin",{
      p_place_type:placeType,p_target_id:targetId,p_place_name:placeName.trim(),p_area:area.trim(),
      p_latitude:latitude,p_longitude:longitude,p_activity:selectedActivity,p_message:message.trim(),
      p_visibility:"friends",p_minutes:minutes,p_public_place_id:publicPlaceId
    });
    setWorking(false);
    if(checkinError){setError(checkinError.message);return;}
    showFeedback("Your check-in will expire automatically.","success","You are checked in");
    router.replace("/live");
  }

  const audienceSentence=AUDIENCE_SENTENCE[visibility] || AUDIENCE_SENTENCE.nobody;

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.ink}/></View>;

  return(
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>OPTIONAL LIVE STATUS</Text><Text style={styles.title}>Check in</Text>
        <Text style={styles.subtitle}>Show that you are at a public place for a limited time. Your coordinates are rounded before storage.</Text>
        {!!error&&<View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Place type</Text>
          <View style={styles.wrap}>{TYPES.map(type=><Pressable key={type.key} style={[styles.chip,placeType===type.key&&styles.chipActive]} onPress={()=>setPlaceType(type.key)}><Text style={[styles.chipText,placeType===type.key&&styles.chipTextActive]}>{type.label}</Text></Pressable>)}</View>
        </View>

        <View style={styles.placePicker}><TextInput value={query} onChangeText={setQuery} placeholder={isPublicPlace?"Search parks and public places":"Search public places"} placeholderTextColor={INK.inkSoft} style={styles.searchInput}/>{loadingPlaces&&<ActivityIndicator color={INK.ink} style={{margin:18}}/>}{!loadingPlaces&&filtered.slice(0,25).map(place=>{const selected=isPublicPlace?publicPlaceId===place.id:targetId===place.id;return <Pressable key={place.id} style={[styles.placeRow,selected&&styles.placeRowActive]} onPress={()=>selectPlace(place)}><View style={styles.placeText}><Text style={styles.placeName}>{place.name}</Text><Text style={styles.placeAddress}>{place.address||place.location||place.location_description||"Public location"}</Text></View><Text style={styles.check}>{selected?"✓":""}</Text></Pressable>;})}{!loadingPlaces&&isPublicPlace&&!filtered.length&&<Text style={styles.placeAddress}>No matching place yet. Type the name below and check in anyway.</Text>}</View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Public place name</Text>
          <TextInput value={placeName} onChangeText={value=>{setPlaceName(value);setTargetId(null);setPublicPlaceId(null);}} maxLength={120} placeholder="Alexandra Park" placeholderTextColor={INK.inkSoft} style={styles.input}/>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Broad area</Text>
          <TextInput value={area} onChangeText={setArea} maxLength={80} placeholder="Hastings or Central Hastings" placeholderTextColor={INK.inkSoft} style={styles.input}/>
          <Text style={styles.areaHelp}>Use a town or neighbourhood, not a street or private address.</Text>
        </View>
        <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>{locating?<ActivityIndicator color={INK.card}/>:<Text style={styles.locationText}>{latitude!=null?"✓ Approximate location added":"Add approximate location"}</Text>}</Pressable>
        {latitude!=null&&<Pressable onPress={()=>{setLatitude(null);setLongitude(null);}}><Text style={styles.removeLocation}>Remove location</Text></Pressable>}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>What are you doing?</Text>
          <View style={styles.wrap}>{ACTIVITIES.map(item=><Pressable key={item} style={[styles.chip,activity===item&&styles.chipActive]} onPress={()=>setActivity(item)}><Text style={[styles.chipText,activity===item&&styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
          {activity==="Other"&&<TextInput value={customActivity} onChangeText={setCustomActivity} maxLength={80} placeholder="Your activity" placeholderTextColor={INK.inkSoft} style={[styles.input,{marginTop:9}]}/>}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Short message <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput value={message} onChangeText={setMessage} maxLength={240} multiline textAlignVertical="top" placeholder="What should nearby Explorers know?" placeholderTextColor={INK.inkSoft} style={[styles.input,styles.textarea]}/>
          <Text style={styles.counter}>{message.length}/240</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Visible for</Text>
          <View style={styles.durationRow}>{[30,60,120,240].map(value=><Pressable key={value} style={[styles.duration,minutes===value&&styles.durationActive]} onPress={()=>setMinutes(value)}><Text style={[styles.durationText,minutes===value&&styles.durationTextActive]}>{value<60?`${value}m`:`${value/60}h`}</Text></Pressable>)}</View>
        </View>
        {/*
          No Public option, and no visibility choice here at all. Who can see a
          check-in is one setting on your profile -- Settings, "Who can see where
          you are" -- and it is a ceiling: a check-in can never reach further than
          it. With no setting value above Friends, a Public button here would be a
          control that changes nothing, which is worse than no button.
        */}
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Who will see this</Text>
          <Text style={styles.safetyText}>{audienceSentence}</Text>
          <Pressable onPress={()=>router.push("/settings")}><Text style={styles.changeAudience}>Change your visibility</Text></Pressable>
        </View>

        <View style={styles.safetyCard}><Text style={styles.safetyTitle}>Location safety</Text><Text style={styles.safetyText}>Only use public places. Xplorer rounds coordinates to roughly neighbourhood-level accuracy and removes this status automatically.</Text></View>
      </ScrollView>

      {/* Sticky bottom action bar: design round r001-a, directive 12. */}
      <View style={styles.stickyBar}>
        <Pressable style={[styles.submit,working&&styles.disabled]} disabled={working} onPress={publish}>{working?<ActivityIndicator color={INK.card}/>:<Text style={styles.submitText}>Start check-in</Text>}</Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flex:1},
  content:{padding:18,paddingBottom:110},
  center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  eyebrow:{...TYPE.sectionLabel},
  title:{color:INK.ink,fontSize:32,fontWeight:"900",marginTop:4},
  subtitle:{color:INK.inkSoft,lineHeight:21,marginTop:7},
  errorCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:6,padding:12,marginTop:14},
  errorText:{color:INK.ink,fontWeight:"700"},
  field:{marginTop:18},
  fieldLabel:{...TYPE.sectionLabel,marginBottom:8},
  optional:{color:INK.inkSoft,textTransform:"none",letterSpacing:0},
  input:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:6,color:INK.ink,paddingHorizontal:13,paddingVertical:12,minHeight:44},
  searchInput:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:6,color:INK.ink,paddingHorizontal:13,paddingVertical:12,minHeight:44},
  textarea:{minHeight:90},
  counter:{color:INK.inkSoft,fontSize:10,textAlign:"right",marginTop:4},
  areaHelp:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:6},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:7},
  chip:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:18,paddingHorizontal:11,paddingVertical:8,minHeight:36,justifyContent:"center"},
  chipActive:{backgroundColor:INK.ink},
  chipText:{color:INK.ink,fontWeight:"800",fontSize:11},
  chipTextActive:{color:INK.card},
  placePicker:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:8,padding:10,marginTop:18},
  placeRow:{flexDirection:"row",alignItems:"center",padding:9,borderRadius:6,marginTop:4},
  placeRowActive:{borderColor:INK.ink,borderWidth:2},
  placeText:{flex:1},
  placeName:{color:INK.ink,fontWeight:"900"},
  placeAddress:{color:INK.inkSoft,fontSize:10,marginTop:3},
  check:{color:INK.ink,fontWeight:"900",fontSize:18},
  locationButton:{backgroundColor:INK.ink,borderColor:INK.ink,borderWidth:2,borderRadius:6,padding:13,alignItems:"center",marginTop:12,minHeight:44,justifyContent:"center"},
  locationText:{color:INK.card,fontWeight:"900"},
  removeLocation:{color:INK.inkSoft,fontWeight:"800",textAlign:"center",paddingVertical:9},
  durationRow:{flexDirection:"row",gap:7},
  duration:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:6,padding:11,alignItems:"center",minHeight:44,justifyContent:"center"},
  durationActive:{backgroundColor:INK.ink},
  durationText:{color:INK.ink,fontWeight:"900"},
  durationTextActive:{color:INK.card},
  changeAudience:{color:INK.ink,fontWeight:"900",marginTop:9,textDecorationLine:"underline"},
  // Deliberately no fill colour: this is the card that has to be read, not the
  // card that has to be noticed. Green/red are reserved for the manager's
  // review-response pair alone (components/ReviewActions.js).
  safetyCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:8,padding:13,marginTop:20},
  safetyTitle:{color:INK.ink,fontWeight:"900"},
  safetyText:{color:INK.ink,fontSize:12,lineHeight:18,marginTop:5},
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
  submit:{backgroundColor:INK.ink,borderWidth:2,borderColor:INK.ink,borderRadius:6,padding:16,alignItems:"center",minHeight:48,justifyContent:"center"},
  submitText:{color:INK.card,fontWeight:"900",fontSize:15},
  disabled:{opacity:.6}
});
