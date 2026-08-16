import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {formatDateTime,liveItemIcon} from "../utils/linkups";
import AlexJourneyHeader from "../components/AlexJourneyHeader";
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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.brandDeep}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} keyboardShouldPersistTaps="handled">
      <AlexJourneyHeader
        phase="NOW"
        title="What can you step into?"
        description="Live context puts time, distance and participation ahead of browsing. Choose something happening, then let Map and Inbox carry the plan."
        meta={areaFilter || "Nearby"}
      >
        <Pressable style={styles.primaryButton} onPress={()=>router.push("/linkups/create")}><Text style={styles.primaryText}>Create Link-up</Text></Pressable>
        <Pressable style={styles.checkinButton} onPress={()=>router.push("/checkins/create")}><Text style={styles.checkinText}>Check in</Text></Pressable>
      </AlexJourneyHeader>

      {!!error&&<View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      {currentCheckin&&<View style={styles.currentCard}><View style={styles.currentPulse}/><View style={styles.currentText}><Text style={styles.currentLabel}>YOU ARE HERE NOW</Text><Text style={styles.currentTitle}>{currentCheckin.place_name}</Text><Text style={styles.currentMeta}>{currentCheckin.activity} · expires {formatDateTime(currentCheckin.expires_at)}</Text></View><Pressable disabled={working} style={styles.endButton} onPress={endCheckin}><Text style={styles.endText}>End</Text></Pressable></View>}

      <View style={styles.scopeCard}>
        <View style={styles.scopeHead}><View><Text style={styles.scopeKicker}>LIVE SCOPE</Text><Text style={styles.scopeTitle}>Where and how soon?</Text></View><Text style={styles.scopeSummary}>{radius} km · {windowHours<24?`${windowHours}h`:windowHours===24?"today":windowHours===72?"3 days":"7 days"}</Text></View>

        <View style={styles.areaRow}><TextInput value={areaDraft} onChangeText={setAreaDraft} onSubmitEditing={applyArea} placeholder="Town or area" placeholderTextColor={INK.inkSoft} style={styles.areaInput}/><Pressable style={styles.applyButton} onPress={applyArea}><Text style={styles.applyText}>Apply</Text></Pressable></View>
        <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>{locating?<ActivityIndicator color={INK.onNavy}/>:<Text style={styles.locationText}>{latitude!=null?"✓ Approximate location in use":"Use approximate location"}</Text>}</Pressable>

        <Text style={styles.filterLabel}>Distance</Text><View style={styles.chips}>{[5,15,25,50].map(value=><Pressable key={value} style={[styles.chip,radius===value&&styles.chipActive]} onPress={()=>setRadius(value)}><Text style={[styles.chipText,radius===value&&styles.chipTextActive]}>{value} km</Text></Pressable>)}</View>
        <Text style={styles.filterLabel}>Time</Text><View style={styles.chips}>{[6,24,72,168].map(value=><Pressable key={value} style={[styles.chip,windowHours===value&&styles.chipActive]} onPress={()=>setWindowHours(value)}><Text style={[styles.chipText,windowHours===value&&styles.chipTextActive]}>{value<24?`${value}h`:value===24?"Today":value===72?"3 days":"7 days"}</Text></Pressable>)}</View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabs}>{TYPES.map(item=><Pressable key={item.key} style={[styles.typeTab,type===item.key&&styles.typeTabActive]} onPress={()=>setType(item.key)}><Text style={[styles.typeText,type===item.key&&styles.typeTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>

      {filtered.length===0&&<View style={styles.emptyCard}><Text style={styles.emptyIcon}>📡</Text><Text style={styles.emptyTitle}>Nothing live in this scope</Text><Text style={styles.emptyText}>Widen the area or time filters, or create the first Link-up.</Text></View>}

      <View style={styles.liveList}>
        {filtered.map(item=><View key={`${item.item_type}-${item.item_id}`} style={styles.card}>
          <View style={styles.cardTop}><View style={styles.iconWrap}><Text style={styles.icon}>{liveItemIcon(item.item_type)}</Text></View><View style={styles.cardHead}><Text style={styles.itemType}>{item.item_type.replace("_"," ")}</Text><Text style={styles.cardTitle}>{item.title}</Text></View>{item.distance_km!=null&&<View style={styles.distancePill}><Text style={styles.distance}>{item.distance_km} km</Text></View>}</View>
          <View style={styles.decisionFacts}>{!!item.area&&<Text style={styles.areaText}>📍 {item.area}</Text>}{!!item.starts_at&&<Text style={styles.timeText}>{formatDateTime(item.starts_at)}</Text>}</View>
          <Text style={styles.subtitleText}>{item.subtitle}</Text>
          <View style={styles.cardActions}><Pressable style={styles.openButton} onPress={()=>router.push(item.deep_link)}><Text style={styles.openText}>{item.action_label}</Text></Pressable>{item.item_type==="checkin"&&<Pressable onPress={()=>reportCheckin(item)}><Text style={styles.reportText}>Report</Text></Pressable>}</View>
        </View>)}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:16,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  primaryButton:{backgroundColor:INK.brand,borderRadius:14,paddingHorizontal:15,paddingVertical:12},primaryText:{color:INK.navy,fontWeight:"900"},checkinButton:{backgroundColor:INK.navySoft,borderRadius:14,paddingHorizontal:15,paddingVertical:12},checkinText:{color:INK.onNavy,fontWeight:"900"},
  errorCard:{backgroundColor:INK.card,borderColor:INK.red,borderWidth:1,borderRadius:16,padding:12,marginBottom:13},errorText:{color:INK.red},
  currentCard:{flexDirection:"row",alignItems:"center",backgroundColor:INK.card,borderColor:INK.brand,borderWidth:1,borderRadius:18,padding:13,marginBottom:13,gap:10},currentPulse:{width:10,height:10,borderRadius:5,backgroundColor:INK.brand},currentText:{flex:1},currentLabel:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:.8},currentTitle:{color:INK.ink,fontSize:17,fontWeight:"900",marginTop:3},currentMeta:{color:INK.inkSoft,fontSize:11,marginTop:3},endButton:{backgroundColor:INK.paper,borderRadius:12,paddingHorizontal:12,paddingVertical:10},endText:{color:INK.ink,fontWeight:"900"},
  scopeCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:20,padding:13,marginBottom:10},scopeHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:10},scopeKicker:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1},scopeTitle:{color:INK.ink,fontSize:18,fontWeight:"900",marginTop:2},scopeSummary:{color:INK.lavender,fontWeight:"900",fontSize:11},
  areaRow:{flexDirection:"row",gap:7,marginTop:12},areaInput:{flex:1,backgroundColor:INK.paper,borderRadius:13,color:INK.ink,paddingHorizontal:12,paddingVertical:11},applyButton:{backgroundColor:INK.navy,borderRadius:13,paddingHorizontal:14,justifyContent:"center"},applyText:{color:INK.onNavy,fontWeight:"900"},locationButton:{backgroundColor:INK.navySoft,borderRadius:13,padding:11,alignItems:"center",marginTop:8},locationText:{color:INK.onNavy,fontWeight:"900",fontSize:11},
  filterLabel:{color:INK.inkSoft,fontWeight:"900",fontSize:10,marginTop:12,marginBottom:7,textTransform:"uppercase",letterSpacing:.7},chips:{flexDirection:"row",gap:6},chip:{flex:1,backgroundColor:INK.paper,borderRadius:12,paddingVertical:9,alignItems:"center"},chipActive:{backgroundColor:INK.navy},chipText:{color:INK.inkSoft,fontWeight:"900",fontSize:10},chipTextActive:{color:INK.onNavy},
  typeTabs:{gap:7,paddingVertical:11},typeTab:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:14,paddingHorizontal:13,paddingVertical:9},typeTabActive:{backgroundColor:INK.brand,borderColor:INK.brand},typeText:{color:INK.inkSoft,fontWeight:"900",fontSize:11},typeTextActive:{color:INK.navy},
  liveList:{gap:10},card:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:20,padding:14},cardTop:{flexDirection:"row",alignItems:"center"},iconWrap:{width:44,height:44,borderRadius:15,backgroundColor:INK.navy,alignItems:"center",justifyContent:"center"},icon:{fontSize:20},cardHead:{flex:1,marginLeft:10},itemType:{color:INK.lavender,fontSize:8,fontWeight:"900",textTransform:"uppercase",letterSpacing:.7},cardTitle:{color:INK.ink,fontSize:17,fontWeight:"900",marginTop:2},distancePill:{backgroundColor:INK.sky,borderRadius:99,paddingHorizontal:9,paddingVertical:6},distance:{color:INK.navy,fontWeight:"900",fontSize:10},decisionFacts:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:10},areaText:{color:INK.inkSoft,fontSize:11},timeText:{color:INK.ink,fontSize:11,fontWeight:"800"},subtitleText:{color:INK.inkSoft,lineHeight:19,marginTop:8},cardActions:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},openButton:{backgroundColor:INK.brand,borderRadius:13,paddingHorizontal:13,paddingVertical:10},openText:{color:INK.navy,fontWeight:"900",fontSize:11},reportText:{color:INK.inkSoft,fontWeight:"900",fontSize:10,padding:8},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:20,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:INK.ink,fontSize:18,fontWeight:"900",marginTop:8},emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:19,marginTop:5}
});
