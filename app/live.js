import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {formatDateTime,liveItemIcon} from "../utils/linkups";

const TYPES=[
  {key:"all",label:"All"},{key:"linkup",label:"Link-ups"},{key:"checkin",label:"People"},{key:"event",label:"Events"},{key:"activity",label:"Activities"},{key:"place",label:"Places"}
];

export default function LiveDiscovery(){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [areaDraft,setAreaDraft]=useState("");
  const [areaFilter,setAreaFilter]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [radius,setRadius]=useState(25);
  const [windowHours,setWindowHours]=useState(24);
  const [type,setType]=useState("all");
  const [items,setItems]=useState([]);
  const [currentCheckin,setCurrentCheckin]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [locating,setLocating]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async(showLoader=true,options={})=>{
    if(showLoader) setLoading(true);
    setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);
    const {data:profile}=await supabase.from("profiles").select("account_type,area").eq("id",currentUser.id).maybeSingle();
    if(profile?.account_type!=="explorer"){setError("Only Explorer accounts can use Live Nearby.");setLoading(false);setRefreshing(false);return;}
    const profileArea=profile.area || "";
    const nextArea=options.area!==undefined?options.area:(areaFilter||profileArea);
    if(profileArea){
      setAreaDraft(current=>current||profileArea);
      setAreaFilter(current=>current||profileArea);
    }
    await supabase.rpc("refresh_live_system");
    const [{data:discovery,error:discoveryError},{data:checkin}]=await Promise.all([
      supabase.rpc("get_live_discovery",{
        p_area:nextArea.trim()||null,
        p_latitude:options.latitude!==undefined?options.latitude:latitude,
        p_longitude:options.longitude!==undefined?options.longitude:longitude,
        p_radius_km:radius,
        p_window_hours:windowHours
      }),
      supabase.from("live_checkins").select("*").eq("user_id",currentUser.id).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle()
    ]);
    if(discoveryError){setError(discoveryError.message);setItems([]);} else setItems(discovery || []);
    setCurrentCheckin(checkin || null);
    setLoading(false);setRefreshing(false);
  },[areaFilter,latitude,longitude,radius,windowHours]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>type==="all"?items:items.filter(item=>item.item_type===type),[items,type]);

  function applyArea(){
    const clean=areaDraft.trim();
    setAreaFilter(clean);
    load(false,{area:clean});
  }

  async function useLocation(){
    setLocating(true);setError("");
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const lat=Number(position.coords.latitude.toFixed(2));
      const lng=Number(position.coords.longitude.toFixed(2));
      setLatitude(lat);setLongitude(lng);
      await load(false,{latitude:lat,longitude:lng});
    }catch(locationError){setError(locationError.message || "Location could not be used.");}
    setLocating(false);
  }

  async function endCheckin(){
    if(!currentCheckin||working) return;
    setWorking(true);
    const {error:endError}=await supabase.rpc("end_live_checkin",{p_checkin_id:currentCheckin.id});
    setWorking(false);
    if(endError){showFeedback(endError.message,"error","Check-in not ended");return;}
    showFeedback("You are no longer shown as here now.","success","Checked out");
    await load(false);
  }

  async function reportCheckin(item){
    if(working) return;
    setWorking(true);
    const {error:reportError}=await supabase.rpc("report_live_safety",{p_target_type:"checkin",p_target_id:item.item_id,p_reason:"other",p_details:"Reported from Live Nearby"});
    setWorking(false);
    if(reportError) showFeedback(reportError.message,"error","Report not sent");
    else showFeedback("The live check-in was sent for review.","success","Report submitted");
  }

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>HAPPENING NEARBY</Text><Text style={styles.title}>Live Nearby</Text>
        <Text style={styles.subtitle}>Link-ups, public check-ins, events, active clubs and popular places in one view.</Text>
        <View style={styles.heroActions}><Pressable style={styles.primaryButton} onPress={()=>router.push("/linkups/create")}><Text style={styles.primaryText}>Create Link-up</Text></Pressable><Pressable style={styles.checkinButton} onPress={()=>router.push("/checkins/create")}><Text style={styles.checkinText}>Check in</Text></Pressable></View>
      </View>

      {!!error&&<View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      {currentCheckin&&<View style={styles.currentCard}><View style={styles.currentText}><Text style={styles.currentLabel}>YOU ARE CHECKED IN</Text><Text style={styles.currentTitle}>{currentCheckin.place_name}</Text><Text style={styles.currentMeta}>{currentCheckin.activity} · expires {formatDateTime(currentCheckin.expires_at)}</Text></View><Pressable disabled={working} onPress={endCheckin}><Text style={styles.endText}>End</Text></Pressable></View>}

      <View style={styles.filtersCard}>
        <Text style={styles.filterLabel}>Area</Text><View style={styles.areaRow}><TextInput value={areaDraft} onChangeText={setAreaDraft} onSubmitEditing={applyArea} placeholder="Town or area" placeholderTextColor="#74747d" style={styles.areaInput}/><Pressable style={styles.applyButton} onPress={applyArea}><Text style={styles.applyText}>Apply</Text></Pressable></View>
        <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>{locating?<ActivityIndicator color="#d9ceff"/>:<Text style={styles.locationText}>{latitude!=null?"✓ Using approximate location":"Use approximate location"}</Text>}</Pressable>
        <Text style={styles.filterLabel}>Distance</Text><View style={styles.chips}>{[5,15,25,50].map(value=><Pressable key={value} style={[styles.chip,radius===value&&styles.chipActive]} onPress={()=>setRadius(value)}><Text style={[styles.chipText,radius===value&&styles.chipTextActive]}>{value} km</Text></Pressable>)}</View>
        <Text style={styles.filterLabel}>Time window</Text><View style={styles.chips}>{[6,24,72,168].map(value=><Pressable key={value} style={[styles.chip,windowHours===value&&styles.chipActive]} onPress={()=>setWindowHours(value)}><Text style={[styles.chipText,windowHours===value&&styles.chipTextActive]}>{value<24?`${value}h`:value===24?"Today":value===72?"3 days":"7 days"}</Text></Pressable>)}</View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabs}>{TYPES.map(item=><Pressable key={item.key} style={[styles.typeTab,type===item.key&&styles.typeTabActive]} onPress={()=>setType(item.key)}><Text style={[styles.typeText,type===item.key&&styles.typeTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>

      {filtered.length===0&&<View style={styles.emptyCard}><Text style={styles.emptyIcon}>📡</Text><Text style={styles.emptyTitle}>Nothing live in this view</Text><Text style={styles.emptyText}>Widen the area or time filters, or create the first Link-up.</Text></View>}

      {filtered.map(item=><View key={`${item.item_type}-${item.item_id}`} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.iconWrap}><Text style={styles.icon}>{liveItemIcon(item.item_type)}</Text></View><View style={styles.cardHead}><Text style={styles.itemType}>{item.item_type.replace("_"," ")}</Text><Text style={styles.cardTitle}>{item.title}</Text></View>{item.distance_km!=null&&<Text style={styles.distance}>{item.distance_km} km</Text>}</View>
        <Text style={styles.subtitleText}>{item.subtitle}</Text>
        {!!item.area&&<Text style={styles.areaText}>📍 {item.area}</Text>}
        {!!item.starts_at&&<Text style={styles.timeText}>{formatDateTime(item.starts_at)}</Text>}
        <View style={styles.cardActions}><Pressable style={styles.openButton} onPress={()=>router.push(item.deep_link)}><Text style={styles.openText}>{item.action_label}</Text></Pressable>{item.item_type==="checkin"&&<Pressable onPress={()=>reportCheckin(item)}><Text style={styles.reportText}>Report</Text></Pressable>}</View>
      </View>)}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},hero:{backgroundColor:"#1b3044",borderColor:"#315a78",borderWidth:1,borderRadius:18,padding:17},eyebrow:{color:"#8fd7ff",fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:"white",fontSize:34,fontWeight:"900",marginTop:4},subtitle:{color:"#aec8d7",lineHeight:21,marginTop:7},heroActions:{flexDirection:"row",gap:9,marginTop:15},primaryButton:{flex:1,backgroundColor:"#3212b6",borderRadius:12,padding:13,alignItems:"center"},primaryText:{color:"white",fontWeight:"900"},checkinButton:{flex:1,backgroundColor:"#116246",borderRadius:12,padding:13,alignItems:"center"},checkinText:{color:"white",fontWeight:"900"},errorCard:{backgroundColor:"#431f26",borderColor:"#7e3541",borderWidth:1,borderRadius:12,padding:12,marginTop:13},errorText:{color:"#ffc1c9"},currentCard:{flexDirection:"row",alignItems:"center",backgroundColor:"#173d31",borderColor:"#2d7258",borderWidth:1,borderRadius:14,padding:13,marginTop:13},currentText:{flex:1},currentLabel:{color:"#88d4b4",fontSize:9,fontWeight:"900"},currentTitle:{color:"white",fontSize:17,fontWeight:"900",marginTop:3},currentMeta:{color:"#9fc9b7",fontSize:11,marginTop:3},endText:{color:"#ffbdc7",fontWeight:"900",padding:8},filtersCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:13,marginTop:13},filterLabel:{color:"white",fontWeight:"900",fontSize:12,marginTop:9,marginBottom:7},areaRow:{flexDirection:"row",gap:7},areaInput:{flex:1,backgroundColor:"#29292e",borderColor:"#484850",borderWidth:1,borderRadius:10,color:"white",paddingHorizontal:11,paddingVertical:10},applyButton:{backgroundColor:"#3212b6",borderRadius:10,paddingHorizontal:14,justifyContent:"center"},applyText:{color:"white",fontWeight:"900"},locationButton:{borderColor:"#554777",borderWidth:1,backgroundColor:"#29233d",borderRadius:10,padding:11,alignItems:"center",marginTop:9},locationText:{color:"#d9ceff",fontWeight:"900",fontSize:11},chips:{flexDirection:"row",gap:6},chip:{flex:1,backgroundColor:"#29292e",borderColor:"#47474f",borderWidth:1,borderRadius:9,paddingVertical:9,alignItems:"center"},chipActive:{backgroundColor:"#3212b6",borderColor:"#674ee0"},chipText:{color:"#9696a0",fontWeight:"900",fontSize:10},chipTextActive:{color:"white"},typeTabs:{gap:7,paddingVertical:14},typeTab:{backgroundColor:"#25252a",borderColor:"#414147",borderWidth:1,borderRadius:18,paddingHorizontal:12,paddingVertical:8},typeTabActive:{backgroundColor:"#164f6d",borderColor:"#2d789f"},typeText:{color:"#aaaab3",fontWeight:"900",fontSize:11},typeTextActive:{color:"white"},card:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:14,marginBottom:11},cardTop:{flexDirection:"row",alignItems:"center"},iconWrap:{width:43,height:43,borderRadius:22,backgroundColor:"#302655",alignItems:"center",justifyContent:"center"},icon:{fontSize:20},cardHead:{flex:1,marginLeft:10},itemType:{color:"#a991f0",fontSize:8,fontWeight:"900",textTransform:"uppercase",letterSpacing:.7},cardTitle:{color:"white",fontSize:17,fontWeight:"900",marginTop:2},distance:{color:"#8fd7ff",fontWeight:"900",fontSize:11},subtitleText:{color:"#aaaab3",lineHeight:19,marginTop:9},areaText:{color:"#bdbdc5",fontSize:12,marginTop:7},timeText:{color:"#c7b8f5",fontSize:11,fontWeight:"800",marginTop:6},cardActions:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},openButton:{backgroundColor:"#3212b6",borderRadius:10,paddingHorizontal:13,paddingVertical:10},openText:{color:"white",fontWeight:"900",fontSize:11},reportText:{color:"#c6a551",fontWeight:"900",fontSize:10,padding:8},emptyCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:"white",fontSize:18,fontWeight:"900",marginTop:8},emptyText:{color:"#9999a3",textAlign:"center",lineHeight:19,marginTop:5}
});
