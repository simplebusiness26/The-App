import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {PUBLIC_PLACE_TYPES,publicPlaceTypeLabel} from "../../utils/places";
import {INK} from "../../utils/tokens";

// Packet 8e: the parks, beaches and viewpoints that had no identity until now.
//
// Before this, a park existed only as whatever a person typed into a check-in,
// so "Alexandra Park" and "alexandra park" were two places and neither could be
// opened, followed or attached to anything. These rows are canonical: one park,
// one id, one page.
//
// The list is deliberately plain. It is a way into a place page, not a
// discovery surface -- Discover already exists and owns that job.

export default function PublicPlaces(){
  const [places,setPlaces]=useState([]);
  const [areas,setAreas]=useState({});
  const [type,setType]=useState(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const [placeResult,areaResult]=await Promise.all([
      supabase
        .from("public_places")
        .select("id,name,place_type,area_id,location_description,image_url")
        .eq("status","published")
        .order("name",{ascending:true})
        .limit(200),
      supabase.from("geo_areas").select("id,name,area_type").eq("status","active")
    ]);

    if(placeResult.error){
      setError("Public places could not be loaded.");
      setPlaces([]);
    }else{
      setPlaces(placeResult.data || []);
    }

    const lookup={};
    for(const area of areaResult.data || []) lookup[area.id]=area.name;
    setAreas(lookup);

    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return places.filter((place)=>{
      if(type && place.place_type!==type) return false;
      if(!term) return true;
      return `${place.name} ${place.location_description || ""}`.toLowerCase().includes(term);
    });
  },[places,type,query]);

  if(loading){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
        <Text style={styles.centreText}>Loading public places...</Text>
      </View>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Public places</Text>
      <Text style={styles.subtitle}>Parks, beaches, viewpoints and the rest of the map that nobody owns.</Text>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search public places"
        placeholderTextColor={INK.inkSoft}
        style={styles.input}
        accessibilityLabel="Search public places"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable
          style={[styles.chip,!type && styles.chipActive]}
          accessibilityRole="button"
          accessibilityLabel="Show every type of public place"
          onPress={()=>setType(null)}
        >
          <Text style={styles.chipText}>All</Text>
        </Pressable>
        {PUBLIC_PLACE_TYPES.map((item)=>(
          <Pressable
            key={item.key}
            style={[styles.chip,type===item.key && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${item.label}`}
            onPress={()=>setType(type===item.key ? null : item.key)}
          >
            <Text style={styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!filtered.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No public places here yet</Text>
          {/* An empty state is an instruction, not a mood. */}
          <Text style={styles.muted}>
            Public places are added by the Guestbook team. Check in at one by name and it can be added
            as a place everybody shares.
          </Text>
        </View>
      ) : filtered.map((place)=>(
        <Pressable
          key={place.id}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={place.name}
          onPress={()=>router.push(`/places/${place.id}`)}
        >
          <Text style={styles.cardTitle}>{place.name}</Text>
          <Text style={styles.cardDetail}>
            {publicPlaceTypeLabel(place.place_type)}
            {place.area_id && areas[place.area_id] ? ` · ${areas[place.area_id]}` : ""}
          </Text>
          {!!place.location_description && <Text style={styles.cardDetail}>{place.location_description}</Text>}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const card={
  backgroundColor:INK.card,
  borderWidth:2,
  borderColor:INK.ink,
  borderRadius:12
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:50},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  centreText:{color:INK.inkSoft,marginTop:10},
  title:{color:INK.ink,fontSize:28,fontWeight:"800",letterSpacing:-0.6},
  subtitle:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:6},
  errorCard:{...card,padding:14,marginTop:14},
  errorText:{color:INK.ink,fontWeight:"700"},
  input:{...card,minHeight:48,paddingHorizontal:14,color:INK.ink,marginTop:16},
  chipRow:{gap:8,paddingVertical:14,paddingRight:4},
  chip:{borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:13,paddingVertical:8},
  chipActive:{backgroundColor:INK.hair},
  chipText:{color:INK.ink,fontWeight:"800",fontSize:12},
  emptyCard:{...card,padding:18,alignItems:"center",marginTop:6},
  emptyTitle:{color:INK.ink,fontWeight:"800",fontSize:17,marginBottom:5},
  muted:{color:INK.inkSoft,textAlign:"center",lineHeight:20},
  card:{...card,padding:15,marginBottom:11},
  cardTitle:{color:INK.ink,fontSize:17,fontWeight:"800"},
  cardDetail:{color:INK.inkSoft,fontSize:13,marginTop:3}
});
