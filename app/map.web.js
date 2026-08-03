import React,{useEffect,useMemo,useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {formatDateTime,liveItemIcon,timeUntil} from "../utils/linkups";

export default function MapScreen(){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [activityClubs,setActivityClubs]=useState([]);
  const [liveItems,setLiveItems]=useState([]);
  const [liveAvailable,setLiveAvailable]=useState(false);
  const [showLive,setShowLive]=useState(true);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");

  useEffect(()=>{loadPlaces();loadLiveLayer();},[]);

  async function loadPlaces(){
    const [businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("businesses").select("id,name,category,address,latitude,longitude"),
      supabase.from("properties").select("id,name,host,address,latitude,longitude"),
      supabase.from("activity_clubs").select("id,name,category,location,address,latitude,longitude,status").in("status",["open","full"])
    ]);

    setBusinesses(businessResult.data || []);
    setProperties(propertyResult.data || []);
    setActivityClubs(clubResult.data || []);
  }

  async function loadLiveLayer(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setLiveAvailable(false);setLiveItems([]);return;}
    const {data:profile}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
    if(profile?.account_type!=="explorer"){setLiveAvailable(false);setLiveItems([]);return;}

    setLiveAvailable(true);
    await supabase.rpc("refresh_live_system");
    const {data,error}=await supabase.rpc("get_live_discovery",{
      p_area:null,p_latitude:null,p_longitude:null,p_radius_km:100,p_window_hours:24
    });
    if(error){console.log(error);setLiveItems([]);return;}
    setLiveItems(data || []);
  }

  function matches(item){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location,item.title,item.subtitle,item.area]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  function liveStateLabel(item){
    if(item.item_type==="checkin") return "Here now";
    if(!item.starts_at) return "";
    const startMs=new Date(item.starts_at).getTime();
    const endMs=item.ends_at ? new Date(item.ends_at).getTime() : null;
    const now=Date.now();
    if(startMs<=now && (endMs===null || now<endMs)) return "Live now";
    const until=timeUntil(item.starts_at);
    return until==="Now" ? "Starting now" : `Starting ${until.toLowerCase()}`;
  }

  const filteredBusinesses=businesses.filter(matches);
  const filteredProperties=properties.filter(matches);
  const filteredClubs=activityClubs.filter(matches);

  const happeningNow=useMemo(()=>liveItems.filter(item=>["linkup","checkin","event"].includes(item.item_type) && matches(item)),[liveItems,search]);

  const activitySessionByClub=useMemo(()=>{
    const byClub={};
    liveItems.filter(item=>item.item_type==="activity").forEach(item=>{
      const match=item.deep_link && item.deep_link.match(/\/activity-clubs\/([^/]+)/);
      const clubId=match ? match[1] : null;
      if(clubId) byClub[clubId]=item;
    });
    return byClub;
  },[liveItems]);

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🗺️ Guestbook Map</Text>
      <TextInput style={styles.search} placeholder="Search businesses, stays or clubs..." value={search} onChangeText={setSearch}/>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {[
          ["all","All"],
          ["business","Businesses"],
          ["property","Properties"],
          ["activity","Activity Clubs"]
        ].map(([value,label])=><Pressable key={value} style={[styles.category,typeFilter===value && styles.selectedCategory]} onPress={()=>setTypeFilter(value)}>
          <Text style={typeFilter===value ? styles.selectedCategoryText : styles.categoryText}>{label}</Text>
        </Pressable>)}
        <Pressable style={[styles.category,styles.liveCategory,showLive && styles.selectedLiveCategory]} onPress={()=>setShowLive(current=>!current)}>
          <Text style={showLive ? styles.selectedCategoryText : styles.categoryText}>🔴 Live</Text>
        </Pressable>
      </ScrollView>

      {showLive && !liveAvailable && <Text style={styles.liveHint}>Log in as an Explorer to see what's happening now.</Text>}

      {showLive && happeningNow.length>0 && <>
        <Text style={styles.section}>Happening now</Text>
        {happeningNow.map(item=><Pressable key={`${item.item_type}-${item.item_id}`} style={[styles.card,styles.liveCard]} onPress={()=>router.push(item.deep_link)}>
          <Text style={styles.name}>{liveItemIcon(item.item_type)} {item.title}</Text>
          <Text style={styles.liveState}>{liveStateLabel(item)}</Text>
          <Text>{item.subtitle}</Text>
          {!!item.area && <Text style={styles.address}>📍 {item.area}</Text>}
          {!!item.starts_at && <Text style={styles.address}>{formatDateTime(item.starts_at)}</Text>}
        </Pressable>)}
      </>}

      {(typeFilter==="all" || typeFilter==="business") && <>
        <Text style={styles.section}>Businesses</Text>
        {filteredBusinesses.map(place=><Pressable key={place.id} style={styles.card} onPress={()=>router.push(`/business/${place.id}`)}>
          <Text style={styles.name}>📍 {place.name}</Text>
          <Text>{place.category}</Text>
          <Text style={styles.address}>{place.address}</Text>
        </Pressable>)}
      </>}

      {(typeFilter==="all" || typeFilter==="property") && <>
        <Text style={styles.section}>Properties</Text>
        {filteredProperties.map(property=><Pressable key={property.id} style={styles.card} onPress={()=>router.push(`/property/${property.id}`)}>
          <Text style={styles.name}>🏠 {property.name}</Text>
          <Text>{property.host}</Text>
          <Text style={styles.address}>{property.address}</Text>
        </Pressable>)}
      </>}

      {(typeFilter==="all" || typeFilter==="activity") && <>
        <Text style={styles.section}>Activity Clubs</Text>
        {filteredClubs.map(club=>{
          const liveSession=showLive ? activitySessionByClub[String(club.id)] : null;
          return <Pressable key={club.id} style={[styles.card,styles.activityCard,liveSession && styles.activityCardLive]} onPress={()=>router.push(`/activity-clubs/${club.id}`)}>
            <Text style={styles.name}>🏃 {club.name}</Text>
            <Text>{club.category} · {club.status}</Text>
            <Text style={styles.address}>{club.address || club.location}</Text>
            {liveSession && <Text style={styles.liveState}>{liveStateLabel(liveSession)} · {liveSession.subtitle}</Text>}
          </Pressable>;
        })}
      </>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:20,paddingBottom:50},title:{fontSize:30,fontWeight:"bold"},search:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:10,padding:15,marginTop:20},categories:{marginTop:15,maxHeight:48},category:{borderWidth:1,borderColor:"#bbb",borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginRight:8,backgroundColor:"white"},selectedCategory:{backgroundColor:"#222",borderColor:"#222"},liveCategory:{borderColor:"#e6a817"},selectedLiveCategory:{backgroundColor:"#c1360b",borderColor:"#c1360b"},categoryText:{fontWeight:"600"},selectedCategoryText:{color:"white",fontWeight:"bold"},liveHint:{color:"#666",fontSize:12,marginTop:10},section:{fontSize:22,fontWeight:"bold",marginTop:25},card:{backgroundColor:"white",borderWidth:1,borderColor:"#ddd",borderRadius:10,padding:15,marginTop:10},liveCard:{borderColor:"#e6a817"},liveState:{color:"#b3690c",fontWeight:"700",marginTop:4},activityCard:{borderColor:"#b7a5e7"},activityCardLive:{borderColor:"#e6a817"},name:{fontSize:18,fontWeight:"bold"},address:{color:"#666",marginTop:5}
});
