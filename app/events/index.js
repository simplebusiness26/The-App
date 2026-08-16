import React,{useCallback,useState} from "react";
import {View,Text,TextInput,StyleSheet,ScrollView,Pressable,ActivityIndicator} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {formatEventDate,formatEventPrice} from "../../utils/events";
import AlexJourneyHeader from "../../components/AlexJourneyHeader";
import {INK} from "../../utils/tokens";

export default function Events(){
  const [events,setEvents]=useState([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{loadEvents();},[]));

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
      <AlexJourneyHeader
        phase="COMMIT"
        title="Put something real on the calendar"
        description="Events are dated choices. Time, place, capacity and cost come before promotional copy so you can decide quickly."
        meta={`${events.length} upcoming`}
      />

      <View style={styles.searchShell}>
        <Text style={styles.searchLabel}>FIND A DATED EXPERIENCE</Text>
        <TextInput
          style={styles.search}
          placeholder="Event or location"
          placeholderTextColor={INK.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading && <ActivityIndicator size="large" color={INK.brandDeep} style={styles.loader}/>}

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Events unavailable</Text>
          <Text style={styles.noticeText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadEvents}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      )}

      {!loading && !error && filtered.length===0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>No upcoming events match</Text>
          <Text style={styles.noticeText}>Try another search or check back when new events are published.</Text>
        </View>
      )}

      <View style={styles.list}>
        {filtered.map(event=>(
          <Pressable key={event.id} style={({pressed})=>[styles.card,pressed && styles.cardPressed]} onPress={()=>router.push(`/events/${event.id}`)}>
            <View style={styles.timeBand}>
              <View style={styles.timeCopy}>
                <Text style={styles.timeKicker}>WHEN</Text>
                <Text style={styles.date}>{formatEventDate(event.starts_at)}</Text>
              </View>
              <View style={styles.pricePill}><Text style={styles.price}>{formatEventPrice(event.price)}</Text></View>
            </View>

            <View style={styles.categoryRow}>
              <Text style={styles.category}>{event.category}</Text>
              <Text style={styles.capacity}>{event.capacity ? `${event.capacity} places` : "Open capacity"}</Text>
            </View>

            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.location}>📍 {event.location || event.address}</Text>
            {!!event.description && <Text style={styles.description} numberOfLines={3}>{event.description}</Text>}

            <View style={styles.cardFooter}>
              <Text style={styles.decisionHint}>Open the event for the full commitment</Text>
              <Text style={styles.viewText}>View →</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:60},
  searchShell:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:12,marginBottom:16},
  searchLabel:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1,marginBottom:7},
  search:{backgroundColor:INK.paper,borderRadius:13,paddingHorizontal:14,paddingVertical:13,color:INK.ink,fontSize:15},
  loader:{marginTop:40},
  notice:{backgroundColor:INK.card,padding:20,borderRadius:18,borderWidth:1,borderColor:INK.hair},
  noticeTitle:{fontSize:18,fontWeight:"900",color:INK.ink,marginBottom:7},
  noticeText:{color:INK.inkSoft,lineHeight:21},
  retryButton:{backgroundColor:INK.navy,paddingHorizontal:15,paddingVertical:12,borderRadius:13,marginTop:14,alignSelf:"flex-start"},
  retryText:{color:INK.onNavy,fontWeight:"900"},
  list:{gap:12},
  card:{backgroundColor:INK.card,padding:17,borderRadius:22,borderWidth:1,borderColor:INK.hair},
  cardPressed:{backgroundColor:INK.sky},
  timeBand:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,backgroundColor:INK.navy,borderRadius:17,padding:12},
  timeCopy:{flex:1},
  timeKicker:{color:INK.brand,fontSize:8,fontWeight:"900",letterSpacing:1},
  date:{fontWeight:"900",color:INK.onNavy,marginTop:3,lineHeight:20},
  pricePill:{backgroundColor:INK.brand,borderRadius:99,paddingHorizontal:11,paddingVertical:7},
  price:{fontWeight:"900",color:INK.navy,fontSize:11},
  categoryRow:{flexDirection:"row",justifyContent:"space-between",gap:10,marginTop:13},
  category:{color:INK.lavender,fontWeight:"900",fontSize:11},
  capacity:{fontSize:11,color:INK.inkSoft,fontWeight:"700"},
  eventName:{fontSize:23,lineHeight:27,fontWeight:"900",color:INK.ink,marginTop:11},
  location:{color:INK.inkSoft,marginTop:7},
  description:{color:INK.inkSoft,lineHeight:20,marginTop:12},
  cardFooter:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:15},
  decisionHint:{fontSize:11,color:INK.inkSoft,flex:1},
  viewText:{fontWeight:"900",color:INK.brandDeep}
});
