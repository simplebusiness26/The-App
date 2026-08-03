import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";

export default function PlacesList({header}){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [activityClubs,setActivityClubs]=useState([]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");

  useEffect(()=>{loadPlaces();},[]);

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

  function matches(item){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  const filteredBusinesses=businesses.filter(matches);
  const filteredProperties=properties.filter(matches);
  const filteredClubs=activityClubs.filter(matches);

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
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
      </ScrollView>

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
        {filteredClubs.map(club=><Pressable key={club.id} style={[styles.card,styles.activityCard]} onPress={()=>router.push(`/activity-clubs/${club.id}`)}>
          <Text style={styles.name}>🏃 {club.name}</Text>
          <Text>{club.category} · {club.status}</Text>
          <Text style={styles.address}>{club.address || club.location}</Text>
        </Pressable>)}
      </>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:20,paddingBottom:50},search:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:10,padding:15,marginTop:20},categories:{marginTop:15,maxHeight:48},category:{borderWidth:1,borderColor:"#bbb",borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginRight:8,backgroundColor:"white"},selectedCategory:{backgroundColor:"#222",borderColor:"#222"},categoryText:{fontWeight:"600"},selectedCategoryText:{color:"white",fontWeight:"bold"},section:{fontSize:22,fontWeight:"bold",marginTop:25},card:{backgroundColor:"white",borderWidth:1,borderColor:"#ddd",borderRadius:10,padding:15,marginTop:10},activityCard:{borderColor:"#b7a5e7"},name:{fontSize:18,fontWeight:"bold"},address:{color:"#666",marginTop:5}
});
