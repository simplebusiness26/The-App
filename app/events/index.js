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
import {TYPE} from "../../styles/typography";

// GAZETTEER PASS (design round r001-a, directive 10): the events browse list,
// re-set as an index -- a section header carrying the count over a 2px rule,
// then one-line ledger rows with a hairline between them, the date and time
// right-aligned in tabular numerals. Same query, same filter, same route --
// only how it is drawn changed.

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
      <Text style={TYPE.sectionLabel}>What's On</Text>
      <Text style={TYPE.display}>Upcoming Events</Text>
      <Text style={styles.lead}>Find community days, family activities and local experiences.</Text>

      <TextInput
        style={styles.search}
        placeholder="Search events or locations"
        placeholderTextColor={INK.inkSoft}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search events or locations"
      />

      {loading && <ActivityIndicator size="large" color={INK.ink} style={styles.loader}/>}

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Events unavailable</Text>
          <Text style={styles.noticeText}>{error}</Text>
          <Pressable style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Try loading events again" onPress={loadEvents}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={TYPE.sectionLabel}>Events</Text>
            <Text style={styles.count}>{filtered.length}</Text>
          </View>

          {filtered.length===0 ? (
            // An empty state is an instruction, not a mood -- kept as a ledger
            // line rather than a boxed void.
            <Text style={styles.emptyText}>No upcoming events found. Try another search or check back when new events are published.</Text>
          ) : filtered.map(event=>(
            <Pressable
              key={event.id}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`${event.name}. ${formatEventDate(event.starts_at)}.`}
              onPress={()=>router.push(`/events/${event.id}`)}
            >
              <View style={styles.textCol}>
                <Text style={TYPE.rowTitle} numberOfLines={1}>{event.name}</Text>
                <Text style={TYPE.meta} numberOfLines={1}>
                  {event.category}{(event.location || event.address) ? ` · ${event.location || event.address}` : ""}
                </Text>
              </View>
              <View style={styles.endCol}>
                <Text style={styles.dateNum} numberOfLines={2}>{formatEventDate(event.starts_at)}</Text>
                <Text style={styles.endMeta} numberOfLines={1}>
                  {formatEventPrice(event.price)} · {event.capacity ? `${event.capacity} places` : "Open capacity"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6},
  search:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    paddingHorizontal:14,
    paddingVertical:13,
    marginTop:16,
    color:INK.ink,
    fontSize:15
  },
  loader:{marginTop:40},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:16,
    marginTop:18
  },
  noticeTitle:{...TYPE.rowTitle,marginBottom:6},
  noticeText:{...TYPE.body,color:INK.inkSoft},
  retryButton:{
    alignSelf:"flex-start",
    marginTop:14,
    minHeight:44,
    justifyContent:"center",
    paddingHorizontal:18,
    backgroundColor:INK.ink,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:6
  },
  retryText:{color:INK.card,fontWeight:"900",fontSize:13},
  section:{marginTop:20},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12},
  row:{
    flexDirection:"row",
    alignItems:"center",
    minHeight:52,
    paddingVertical:10,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  textCol:{flex:1},
  endCol:{alignItems:"flex-end",gap:3,maxWidth:150},
  dateNum:{...TYPE.numeral,fontSize:13,textAlign:"right"},
  endMeta:{...TYPE.meta,textAlign:"right"}
});
