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

      {loading && <ActivityIndicator size="large" style={styles.loader}/>}

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

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  hero:{backgroundColor:INK.blue,padding:22,borderRadius:18,marginBottom:18},
  eyebrow:{color:INK.ink,fontSize:12,fontWeight:"bold",letterSpacing:1},
  title:{fontSize:32,fontWeight:"bold",color:"white",marginTop:7},
  subtitle:{fontSize:16,color:INK.ink,lineHeight:23,marginTop:8},
  search:{backgroundColor:"white",borderWidth:1,borderColor:"#ddd",borderRadius:12,padding:15,marginBottom:18},
  loader:{marginTop:40},
  notice:{backgroundColor:"white",padding:20,borderRadius:14,borderWidth:1,borderColor:"#ddd"},
  noticeTitle:{fontSize:18,fontWeight:"bold",marginBottom:7},
  noticeText:{color:"#555",lineHeight:21},
  retryButton:{backgroundColor:INK.blue,padding:12,borderRadius:10,marginTop:14,alignSelf:"flex-start"},
  retryText:{color:"white",fontWeight:"bold"},
  card:{backgroundColor:"white",padding:18,borderRadius:16,borderWidth:1,borderColor:INK.ink,marginBottom:16},
  badgeRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},
  category:{backgroundColor:INK.card,color:INK.blue,paddingHorizontal:10,paddingVertical:6,borderRadius:20,fontWeight:"bold",fontSize:12,overflow:"hidden"},
  price:{fontWeight:"bold",color:INK.green},
  eventName:{fontSize:23,fontWeight:"bold",marginTop:14},
  date:{fontWeight:"600",color:INK.blue,marginTop:8,lineHeight:20},
  location:{color:"#555",marginTop:6},
  description:{color:"#444",lineHeight:21,marginTop:12},
  cardFooter:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:16},
  capacity:{fontSize:13,color:"#666",fontWeight:"600"},
  viewText:{fontWeight:"bold",color:INK.blue}
});
