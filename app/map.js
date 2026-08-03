import React,{useEffect,useMemo,useState} from "react";
import {StyleSheet,View,TextInput,Pressable,Text,ScrollView} from "react-native";
import MapView,{Marker} from "react-native-maps";
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
      supabase.from("properties").select("id,name,address,latitude,longitude"),
      supabase.from("activity_clubs").select("id,name,category,location,address,latitude,longitude,status").in("status",["open","full"])
    ]);

    if(businessResult.error) console.log(businessResult.error);
    if(propertyResult.error) console.log(propertyResult.error);
    if(clubResult.error) console.log(clubResult.error);

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

  function matchesSearch(item){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location,item.title,item.subtitle,item.area]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  function hasCoordinates(item){
    return Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
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

  const filteredBusinesses=businesses.filter(item=>matchesSearch(item) && hasCoordinates(item));
  const filteredProperties=properties.filter(item=>matchesSearch(item) && hasCoordinates(item));
  const filteredClubs=activityClubs.filter(item=>matchesSearch(item) && hasCoordinates(item));

  const linkupItems=useMemo(()=>liveItems.filter(item=>item.item_type==="linkup" && hasCoordinates(item) && matchesSearch(item)),[liveItems,search]);
  const checkinItems=useMemo(()=>liveItems.filter(item=>item.item_type==="checkin" && hasCoordinates(item) && matchesSearch(item)),[liveItems,search]);
  const eventItems=useMemo(()=>liveItems.filter(item=>item.item_type==="event" && hasCoordinates(item) && matchesSearch(item)),[liveItems,search]);

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
    <View style={styles.container}>
      <View style={styles.top}>
        <TextInput style={styles.search} placeholder="Search businesses, stays or clubs..." value={search} onChangeText={setSearch}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {[
            ["all","All"],
            ["business","Businesses"],
            ["property","Properties"],
            ["activity","Activity Clubs"]
          ].map(([value,label])=><Pressable key={value} style={[styles.filterButton,typeFilter===value && styles.selectedFilter]} onPress={()=>setTypeFilter(value)}>
            <Text style={typeFilter===value ? styles.selectedFilterText : styles.filterText}>{label}</Text>
          </Pressable>)}
          <Pressable style={[styles.filterButton,styles.liveFilterButton,showLive && styles.selectedLiveFilter]} onPress={()=>setShowLive(current=>!current)}>
            <Text style={showLive ? styles.selectedFilterText : styles.filterText}>🔴 Live</Text>
          </Pressable>
        </ScrollView>
        {showLive && !liveAvailable && <Text style={styles.liveHint}>Log in as an Explorer to see what's happening now.</Text>}
      </View>

      <MapView style={styles.map} initialRegion={{latitude:50.8225,longitude:-0.1372,latitudeDelta:0.12,longitudeDelta:0.12}}>
        {(typeFilter==="all" || typeFilter==="business") && filteredBusinesses.map(place=><Marker
          key={`business-${place.id}`}
          coordinate={{latitude:Number(place.latitude),longitude:Number(place.longitude)}}
          title={place.name}
          description={place.category || "Business"}
          pinColor="#d63b3b"
          onPress={()=>router.push(`/business/${place.id}`)}
        />)}

        {(typeFilter==="all" || typeFilter==="property") && filteredProperties.map(place=><Marker
          key={`property-${place.id}`}
          coordinate={{latitude:Number(place.latitude),longitude:Number(place.longitude)}}
          title={place.name}
          description="Property"
          pinColor="#275bd6"
          onPress={()=>router.push(`/property/${place.id}`)}
        />)}

        {(typeFilter==="all" || typeFilter==="activity") && filteredClubs.map(club=>{
          const liveSession=showLive ? activitySessionByClub[String(club.id)] : null;
          return <Marker
            key={`activity-${club.id}`}
            coordinate={{latitude:Number(club.latitude),longitude:Number(club.longitude)}}
            title={liveSession ? `🏃 ${club.name} · session ${liveStateLabel(liveSession).toLowerCase()}` : club.name}
            description={liveSession ? `${club.category} · ${club.status} · ${liveSession.subtitle}` : `${club.category} · ${club.status}`}
            pinColor={liveSession ? "#e6a817" : "#5633a8"}
            onPress={()=>router.push(`/activity-clubs/${club.id}`)}
          />;
        })}

        {showLive && linkupItems.map(item=><Marker
          key={`linkup-${item.item_id}`}
          coordinate={{latitude:Number(item.latitude),longitude:Number(item.longitude)}}
          title={`${liveItemIcon("linkup")} ${item.title}`}
          description={`${liveStateLabel(item)} · ${item.subtitle}`}
          pinColor="#8e44ec"
          onPress={()=>router.push(item.deep_link)}
        />)}

        {showLive && checkinItems.map(item=><Marker
          key={`checkin-${item.item_id}`}
          coordinate={{latitude:Number(item.latitude),longitude:Number(item.longitude)}}
          title={`${liveItemIcon("checkin")} ${item.title}`}
          description={item.subtitle}
          pinColor="#12b76a"
          onPress={()=>router.push(item.deep_link)}
        />)}

        {showLive && eventItems.map(item=><Marker
          key={`event-${item.item_id}`}
          coordinate={{latitude:Number(item.latitude),longitude:Number(item.longitude)}}
          title={`${liveItemIcon("event")} ${item.title}`}
          description={`${liveStateLabel(item)} · ${item.subtitle}${item.starts_at ? " · "+formatDateTime(item.starts_at) : ""}`}
          pinColor="#e6a817"
          onPress={()=>router.push(item.deep_link)}
        />)}
      </MapView>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1},map:{flex:1},top:{position:"absolute",top:18,width:"100%",zIndex:10,padding:10},search:{backgroundColor:"white",padding:15,borderRadius:10,borderWidth:1,borderColor:"#ddd"},filters:{marginTop:9,maxHeight:44},filterButton:{backgroundColor:"white",paddingHorizontal:13,paddingVertical:10,marginRight:7,borderRadius:20,borderWidth:1,borderColor:"#ddd"},selectedFilter:{backgroundColor:"#222",borderColor:"#222"},liveFilterButton:{borderColor:"#e6a817"},selectedLiveFilter:{backgroundColor:"#c1360b",borderColor:"#c1360b"},filterText:{fontWeight:"600"},selectedFilterText:{color:"white",fontWeight:"bold"},liveHint:{backgroundColor:"white",color:"#555",fontSize:11,marginTop:7,padding:8,borderRadius:8,alignSelf:"flex-start"}
});
