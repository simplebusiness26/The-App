import React,{useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";

const TYPES=[
  {key:"park",label:"Park"},
  {key:"public_place",label:"Public place"},
  {key:"business",label:"Business"},
  {key:"activity_club",label:"Activity club"},
  {key:"event",label:"Event"}
];
const ACTIVITIES=["Walking","Running","Coffee","Eating","Sport","Relaxing","Exploring","Other"];

export default function CreateCheckin(){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [placeType,setPlaceType]=useState("park");
  const [targetId,setTargetId]=useState(null);
  const [placeName,setPlaceName]=useState("");
  const [area,setArea]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [activity,setActivity]=useState("Walking");
  const [customActivity,setCustomActivity]=useState("");
  const [message,setMessage]=useState("");
  const [visibility,setVisibility]=useState("followers");
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
    const {data:profile}=await supabase.from("profiles").select("account_type,area").eq("id",currentUser.id).maybeSingle();
    if(profile?.account_type!=="explorer"){setError("Only Explorer accounts can check in.");setLoading(false);return;}
    setUser(currentUser);setArea(profile.area || "");setLoading(false);
  }

  async function loadPlaces(type){
    setTargetId(null);setQuery("");setPlaces([]);
    if(type==="park"||type==="public_place") return;
    setLoadingPlaces(true);
    let request;
    if(type==="business") request=supabase.from("businesses").select("id,name,address,latitude,longitude").order("name").limit(80);
    if(type==="activity_club") request=supabase.from("activity_clubs").select("id,name,location,latitude,longitude,status").in("status",["open","full"]).order("name").limit(80);
    if(type==="event") request=supabase.from("events").select("id,name,location,latitude,longitude,status").eq("status","published").order("starts_at").limit(80);
    const {data,error:placesError}=await request;
    if(placesError){setError("Places could not be loaded.");setPlaces([]);} else setPlaces(data || []);
    setLoadingPlaces(false);
  }

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    if(!term) return places;
    return places.filter(item=>`${item.name} ${item.address||item.location||""}`.toLowerCase().includes(term));
  },[places,query]);

  function selectPlace(place){
    setTargetId(place.id);
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
    if(placeName.trim().length<2||area.trim().length<2) return setError("Add the public place and broad area, such as a town or neighbourhood.");
    if(selectedActivity.length<2) return setError("Choose what you are doing or enter a custom activity.");
    setWorking(true);
    const {error:checkinError}=await supabase.rpc("start_live_checkin",{
      p_place_type:placeType,p_target_id:targetId,p_place_name:placeName.trim(),p_area:area.trim(),
      p_latitude:latitude,p_longitude:longitude,p_activity:selectedActivity,p_message:message.trim(),
      p_visibility:visibility,p_minutes:minutes
    });
    setWorking(false);
    if(checkinError){setError(checkinError.message);return;}
    showFeedback("Your check-in will expire automatically.","success","You are checked in");
    router.replace("/live");
  }

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>OPTIONAL LIVE STATUS</Text><Text style={styles.title}>Check in</Text>
      <Text style={styles.subtitle}>Show that you are at a public place for a limited time. Your coordinates are rounded before storage.</Text>
      {!!error&&<View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <Text style={styles.label}>Place type</Text><View style={styles.wrap}>{TYPES.map(type=><Pressable key={type.key} style={[styles.chip,placeType===type.key&&styles.chipActive]} onPress={()=>setPlaceType(type.key)}><Text style={[styles.chipText,placeType===type.key&&styles.chipTextActive]}>{type.label}</Text></Pressable>)}</View>

      {!["park","public_place"].includes(placeType)&&<View style={styles.placePicker}><TextInput value={query} onChangeText={setQuery} placeholder="Search public places" placeholderTextColor="#74747d" style={styles.input}/>{loadingPlaces&&<ActivityIndicator color="#bca8ff" style={{margin:18}}/>}{!loadingPlaces&&filtered.slice(0,25).map(place=><Pressable key={place.id} style={[styles.placeRow,targetId===place.id&&styles.placeRowActive]} onPress={()=>selectPlace(place)}><View style={styles.placeText}><Text style={styles.placeName}>{place.name}</Text><Text style={styles.placeAddress}>{place.address||place.location||"Public location"}</Text></View><Text style={styles.check}>{targetId===place.id?"✓":""}</Text></Pressable>)}</View>}

      <Text style={styles.label}>Public place name</Text><TextInput value={placeName} onChangeText={value=>{setPlaceName(value);setTargetId(null);}} maxLength={120} placeholder="Alexandra Park" placeholderTextColor="#74747d" style={styles.input}/>
      <Text style={styles.label}>Broad area</Text><TextInput value={area} onChangeText={setArea} maxLength={80} placeholder="Hastings or Central Hastings" placeholderTextColor="#74747d" style={styles.input}/>
      <Text style={styles.areaHelp}>Use a town or neighbourhood, not a street or private address.</Text>
      <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>{locating?<ActivityIndicator color="#d9ceff"/>:<Text style={styles.locationText}>{latitude!=null?"✓ Approximate location added":"Add approximate location"}</Text>}</Pressable>
      {latitude!=null&&<Pressable onPress={()=>{setLatitude(null);setLongitude(null);}}><Text style={styles.removeLocation}>Remove location</Text></Pressable>}

      <Text style={styles.label}>What are you doing?</Text><View style={styles.wrap}>{ACTIVITIES.map(item=><Pressable key={item} style={[styles.chip,activity===item&&styles.chipActive]} onPress={()=>setActivity(item)}><Text style={[styles.chipText,activity===item&&styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
      {activity==="Other"&&<TextInput value={customActivity} onChangeText={setCustomActivity} maxLength={80} placeholder="Your activity" placeholderTextColor="#74747d" style={[styles.input,{marginTop:9}]}/>} 

      <Text style={styles.label}>Short message <Text style={styles.optional}>(optional)</Text></Text><TextInput value={message} onChangeText={setMessage} maxLength={240} multiline textAlignVertical="top" placeholder="What should nearby Explorers know?" placeholderTextColor="#74747d" style={[styles.input,styles.textarea]}/><Text style={styles.counter}>{message.length}/240</Text>

      <Text style={styles.label}>Visible for</Text><View style={styles.durationRow}>{[30,60,120,240].map(value=><Pressable key={value} style={[styles.duration,minutes===value&&styles.durationActive]} onPress={()=>setMinutes(value)}><Text style={[styles.durationText,minutes===value&&styles.durationTextActive]}>{value<60?`${value}m`:`${value/60}h`}</Text></Pressable>)}</View>
      <Text style={styles.label}>Visibility</Text><View style={styles.visibilityRow}><Pressable style={[styles.visibility,visibility==="followers"&&styles.visibilityActive]} onPress={()=>setVisibility("followers")}><Text style={styles.visibilityTitle}>Followers</Text><Text style={styles.visibilityHint}>Only followers (recommended)</Text></Pressable><Pressable style={[styles.visibility,visibility==="public"&&styles.visibilityActive]} onPress={()=>setVisibility("public")}><Text style={styles.visibilityTitle}>Public</Text><Text style={styles.visibilityHint}>All Explorers</Text></Pressable></View>

      <View style={styles.safetyCard}><Text style={styles.safetyTitle}>Location safety</Text><Text style={styles.safetyText}>Only use public places. Guestbook rounds coordinates to roughly neighbourhood-level accuracy and removes this status automatically.</Text></View>
      <Pressable style={[styles.submit,working&&styles.disabled]} disabled={working} onPress={publish}>{working?<ActivityIndicator color="white"/>:<Text style={styles.submitText}>Start check-in</Text>}</Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:"white",fontSize:32,fontWeight:"900",marginTop:4},subtitle:{color:"#aaaab3",lineHeight:21,marginTop:7},errorCard:{backgroundColor:"#431f26",borderColor:"#7e3541",borderWidth:1,borderRadius:12,padding:12,marginTop:14},errorText:{color:"#ffc1c9"},label:{color:"white",fontWeight:"900",marginTop:18,marginBottom:8},optional:{color:"#85858e"},input:{backgroundColor:"#242429",borderColor:"#44444c",borderWidth:1,borderRadius:12,color:"white",paddingHorizontal:13,paddingVertical:12},textarea:{minHeight:90},counter:{color:"#777780",fontSize:10,textAlign:"right",marginTop:4},areaHelp:{color:"#85858e",fontSize:11,lineHeight:16,marginTop:6},wrap:{flexDirection:"row",flexWrap:"wrap",gap:7},chip:{backgroundColor:"#25252a",borderColor:"#44444c",borderWidth:1,borderRadius:18,paddingHorizontal:11,paddingVertical:8},chipActive:{backgroundColor:"#3212b6",borderColor:"#654ce2"},chipText:{color:"#aaaab3",fontWeight:"800",fontSize:11},chipTextActive:{color:"white"},placePicker:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:10,marginTop:11},placeRow:{flexDirection:"row",alignItems:"center",padding:9,borderRadius:10,marginTop:4},placeRowActive:{backgroundColor:"#302655"},placeText:{flex:1},placeName:{color:"white",fontWeight:"900"},placeAddress:{color:"#85858e",fontSize:10,marginTop:3},check:{color:"#cdbfff",fontWeight:"900",fontSize:18},locationButton:{backgroundColor:"#29233d",borderColor:"#554777",borderWidth:1,borderRadius:12,padding:13,alignItems:"center",marginTop:10},locationText:{color:"#d9ceff",fontWeight:"900"},removeLocation:{color:"#a899d1",fontWeight:"800",textAlign:"center",paddingVertical:9},durationRow:{flexDirection:"row",gap:7},duration:{flex:1,backgroundColor:"#25252a",borderColor:"#44444c",borderWidth:1,borderRadius:10,padding:11,alignItems:"center"},durationActive:{backgroundColor:"#164c3a",borderColor:"#2f8063"},durationText:{color:"#aaaab3",fontWeight:"900"},durationTextActive:{color:"#c5f5df"},visibilityRow:{flexDirection:"row",gap:9},visibility:{flex:1,backgroundColor:"#25252a",borderColor:"#44444c",borderWidth:1,borderRadius:12,padding:13},visibilityActive:{backgroundColor:"#2d2152",borderColor:"#644be0"},visibilityTitle:{color:"white",fontWeight:"900"},visibilityHint:{color:"#85858e",fontSize:10,marginTop:3},safetyCard:{backgroundColor:"#1f332b",borderColor:"#315e4c",borderWidth:1,borderRadius:13,padding:13,marginTop:20},safetyTitle:{color:"#b9f5d6",fontWeight:"900"},safetyText:{color:"#a7d2ba",fontSize:12,lineHeight:18,marginTop:5},submit:{backgroundColor:"#3212b6",borderRadius:14,padding:16,alignItems:"center",marginTop:20},submitText:{color:"white",fontWeight:"900",fontSize:15},disabled:{opacity:.6}
});
