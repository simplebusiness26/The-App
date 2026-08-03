import React,{useEffect,useState} from "react";
import {StyleSheet,View,TextInput,Pressable,Text,ScrollView} from "react-native";
import MapView,{Marker} from "react-native-maps";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import PlacesList from "../components/PlacesList";

const GOOGLE_MAPS_API_KEY=process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function MapScreen(){
  if(!GOOGLE_MAPS_API_KEY){
    return <PlacesList header={<Text style={styles.fallbackTitle}>🗺️ Guestbook Map</Text>}/>;
  }
  return <NativeMap/>;
}

function NativeMap(){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [activityClubs,setActivityClubs]=useState([]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");

  useEffect(()=>{loadPlaces();},[]);

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

  function matchesSearch(item){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  function hasCoordinates(item){
    return Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
  }

  const filteredBusinesses=businesses.filter(item=>matchesSearch(item) && hasCoordinates(item));
  const filteredProperties=properties.filter(item=>matchesSearch(item) && hasCoordinates(item));
  const filteredClubs=activityClubs.filter(item=>matchesSearch(item) && hasCoordinates(item));

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
        </ScrollView>
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

        {(typeFilter==="all" || typeFilter==="activity") && filteredClubs.map(club=><Marker
          key={`activity-${club.id}`}
          coordinate={{latitude:Number(club.latitude),longitude:Number(club.longitude)}}
          title={club.name}
          description={`${club.category} · ${club.status}`}
          pinColor="#5633a8"
          onPress={()=>router.push(`/activity-clubs/${club.id}`)}
        />)}
      </MapView>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1},map:{flex:1},top:{position:"absolute",top:18,width:"100%",zIndex:10,padding:10},search:{backgroundColor:"white",padding:15,borderRadius:10,borderWidth:1,borderColor:"#ddd"},filters:{marginTop:9,maxHeight:44},filterButton:{backgroundColor:"white",paddingHorizontal:13,paddingVertical:10,marginRight:7,borderRadius:20,borderWidth:1,borderColor:"#ddd"},selectedFilter:{backgroundColor:"#222",borderColor:"#222"},filterText:{fontWeight:"600"},selectedFilterText:{color:"white",fontWeight:"bold"},fallbackTitle:{fontSize:30,fontWeight:"bold"}
});
