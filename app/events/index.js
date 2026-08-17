import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {formatEventDate,formatEventPrice} from "../../utils/events";
import {INK} from "../../utils/tokens";

export default function Events(){
  const [events,setEvents]=useState([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadEvents();
  },[]));

  async function loadEvents(){
    setLoading(true);
    setError("");

    const {data,error:eventError}=await supabase
      .from("events")
      .select("id,name,category,description,location,address,starts_at,ends_at,price,capacity,status,image_url")
      .eq("status","published")
      .gte("starts_at",new Date().toISOString())
      .order("starts_at",{ascending:true});

    if(eventError){
      console.log(eventError);
      setError("Events could not be loaded right now.");
      setEvents([]);
      setLoading(false);
      return;
    }

    setEvents(data || []);
    setLoading(false);
  }

  const search=query.trim().toLowerCase();
  const filtered=events.filter(event=>{
    if(!search) return true;
    return[event.name,event.category,event.location,event.address,event.description]
      .filter(Boolean)
      .some(value=>value.toLowerCase().includes(search));
  });

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>WHAT'S ON</Text>
        <Text style={styles.title}>Upcoming Events</Text>
        <Text style={styles.subtitle}>Find community days, family activities and local experiences.</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search events or locations"
        value={query}
        onChangeText={setQuery}
      />

      {loading && <ActivityIndicator size="large" color={INK.ink} style={styles.loader}/>}

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Events unavailable</Text>
          <Text style={styles.noticeText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadEvents}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && filtered.length===0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>No upcoming events found</Text>
          <Text style={styles.noticeText}>Try another search or check back when new events are published.</Text>
        </View>
      )}

      {filtered.map(event=>(
        <Pressable
          key={event.id}
          style={styles.card}
          onPress={()=>router.push(`/events/${event.id}`)}
        >
          <View style={styles.badgeRow}>
            <Text style={styles.category}>{event.category}</Text>
            <Text style={styles.price}>{formatEventPrice(event.price)}</Text>
          </View>

          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.date}>📅 {formatEventDate(event.starts_at)}</Text>
          <Text style={styles.location}>📍 {event.location || event.address}</Text>
          {!!event.description && <Text style={styles.description} numberOfLines={3}>{event.description}</Text>}

          <View style={styles.cardFooter}>
            <Text style={styles.capacity}>{event.capacity ? `${event.capacity} places` : "Open capacity"}</Text>
            <Text style={styles.viewText}>View event →</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Riso tokens only. Blue is a state colour ("a place exists") -- it is not a
// brand accent, so a hero block, a price or a category pill do not get it.
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  hero:{padding:2,marginBottom:18},
  eyebrow:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1},
  title:{fontSize:32,fontWeight:"900",color:INK.ink,marginTop:7},
  subtitle:{fontSize:15,color:INK.inkSoft,lineHeight:22,marginTop:8},
  search:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12,padding:14,marginBottom:18,color:INK.ink},
  loader:{marginTop:40},
  notice:{backgroundColor:INK.card,padding:20,borderRadius:14,borderWidth:2,borderColor:INK.ink},
  noticeTitle:{fontSize:18,fontWeight:"800",marginBottom:7,color:INK.ink},
  noticeText:{color:INK.ink,lineHeight:21},
  retryButton:{backgroundColor:INK.ink,padding:12,borderRadius:10,marginTop:14,alignSelf:"flex-start"},
  retryText:{color:INK.card,fontWeight:"800"},
  card:{
    backgroundColor:INK.card,padding:18,borderRadius:16,borderWidth:2,borderColor:INK.ink,marginBottom:16,
    shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0
  },
  badgeRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},
  category:{borderWidth:2,borderColor:INK.ink,color:INK.ink,paddingHorizontal:10,paddingVertical:5,borderRadius:20,fontWeight:"800",fontSize:11,overflow:"hidden"},
  price:{fontWeight:"800",color:INK.ink},
  eventName:{fontSize:23,fontWeight:"800",marginTop:14,color:INK.ink},
  date:{fontWeight:"800",color:INK.ink,marginTop:8,lineHeight:20,fontSize:12},
  location:{color:INK.inkSoft,marginTop:6},
  description:{color:INK.ink,lineHeight:21,marginTop:12},
  cardFooter:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:16},
  capacity:{fontSize:13,color:INK.inkSoft,fontWeight:"600"},
  viewText:{fontWeight:"800",color:INK.ink}
});
