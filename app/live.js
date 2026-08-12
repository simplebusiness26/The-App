import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {formatDateTime,liveItemIcon} from "../utils/linkups";
import {INK} from "../utils/tokens";

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
    const {data:profile}=await supabase.from("profiles").select("area").eq("id",currentUser.id).maybeSingle();
    const profileArea=profile?.area || "";
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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.blue}/></View>;

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
        <Text style={styles.filterLabel}>Area</Text><View style={styles.areaRow}><TextInput value={areaDraft} onChangeText={setAreaDraft} onSubmitEditing={applyArea} placeholder="Town or area" placeholderTextColor={INK.inkSoft} style={styles.areaInput}/><Pressable style={styles.applyButton} onPress={applyArea}><Text style={styles.applyText}>Apply</Text></Pressable></View>
        <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>{locating?<ActivityIndicator color={INK.ink}/>:<Text style={styles.locationText}>{latitude!=null?"✓ Using approximate location":"Use approximate location"}</Text>}</Pressable>
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
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},hero:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:18,padding:17},eyebrow:{color:INK.card,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:INK.card,fontSize:34,fontWeight:"900",marginTop:4},subtitle:{color:INK.card,lineHeight:21,marginTop:7},heroActions:{flexDirection:"row",gap:9,marginTop:15},primaryButton:{flex:1,backgroundColor:INK.blue,borderRadius:12,padding:13,alignItems:"center"},primaryText:{color:INK.card,fontWeight:"900"},checkinButton:{flex:1,backgroundColor:INK.green,borderRadius:12,padding:13,alignItems:"center"},checkinText:{color:INK.card,fontWeight:"900"},errorCard:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1,borderRadius:12,padding:12,marginTop:13},errorText:{color:INK.card},currentCard:{flexDirection:"row",alignItems:"center",backgroundColor:INK.green,borderColor:INK.green,borderWidth:1,borderRadius:14,padding:13,marginTop:13},currentText:{flex:1},currentLabel:{color:INK.card,fontSize:9,fontWeight:"900"},currentTitle:{color:INK.ink,fontSize:17,fontWeight:"900",marginTop:3},currentMeta:{color:INK.card,fontSize:11,marginTop:3},endText:{color:INK.card,fontWeight:"900",padding:8},filtersCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:13,marginTop:13},filterLabel:{color:INK.ink,fontWeight:"900",fontSize:12,marginTop:9,marginBottom:7},areaRow:{flexDirection:"row",gap:7},areaInput:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:10,color:INK.ink,paddingHorizontal:11,paddingVertical:10},applyButton:{backgroundColor:INK.blue,borderRadius:10,paddingHorizontal:14,justifyContent:"center"},applyText:{color:INK.card,fontWeight:"900"},locationButton:{borderColor:INK.blue,borderWidth:1,backgroundColor:INK.blue,borderRadius:10,padding:11,alignItems:"center",marginTop:9},locationText:{color:INK.card,fontWeight:"900",fontSize:11},chips:{flexDirection:"row",gap:6},chip:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:9,paddingVertical:9,alignItems:"center"},chipActive:{backgroundColor:INK.blue,borderColor:INK.blue},chipText:{color:INK.inkSoft,fontWeight:"900",fontSize:10},chipTextActive:{color:INK.card},typeTabs:{gap:7,paddingVertical:14},typeTab:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:18,paddingHorizontal:12,paddingVertical:8},typeTabActive:{backgroundColor:INK.blue,borderColor:INK.blue},typeText:{color:INK.inkSoft,fontWeight:"900",fontSize:11},typeTextActive:{color:INK.card},card:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:14,marginBottom:11},cardTop:{flexDirection:"row",alignItems:"center"},iconWrap:{width:43,height:43,borderRadius:22,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},icon:{fontSize:20},cardHead:{flex:1,marginLeft:10},itemType:{color:INK.blue,fontSize:8,fontWeight:"900",textTransform:"uppercase",letterSpacing:.7},cardTitle:{color:INK.ink,fontSize:17,fontWeight:"900",marginTop:2},distance:{color:INK.blue,fontWeight:"900",fontSize:11},subtitleText:{color:INK.inkSoft,lineHeight:19,marginTop:9},areaText:{color:INK.inkSoft,fontSize:12,marginTop:7},timeText:{color:INK.ink,fontSize:11,fontWeight:"800",marginTop:6},cardActions:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},openButton:{backgroundColor:INK.blue,borderRadius:10,paddingHorizontal:13,paddingVertical:10},openText:{color:INK.card,fontWeight:"900",fontSize:11},reportText:{color:INK.ink,fontWeight:"900",fontSize:10,padding:8},emptyCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:INK.ink,fontSize:18,fontWeight:"900",marginTop:8},emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:19,marginTop:5}
});
