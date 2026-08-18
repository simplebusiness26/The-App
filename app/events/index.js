import React,{useCallback,useState} from "react";
import {View,Text,TextInput,StyleSheet,ScrollView,ActivityIndicator} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {formatEventDate,formatEventPrice} from "../../utils/events";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Field,
  Glyph,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  fieldInputStyle
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// Events: the dated things. RULES.md is exact about the word -- a club has
// sessions, an event has a start time, and they are never the same noun.
//
// WHAT CHANGED
//
// Every event was a 2px-bordered box with a hard offset shadow, a pill for the
// category, and a calendar emoji in front of the date with a map pin in front
// of the place. The date -- the single most important thing about a dated thing
// -- was a bold body line halfway down the box, indistinguishable from the
// description.
//
// Now each event is a Row carrying `scheduled`: the amber state edge that means
// "something is happening here" everywhere else in this app and on the map, and
// the countdown sits in the mono meta column where the eye goes first. The list
// is one measured column instead of a stack of cards, so ten events fit where
// three did.

// What the app measured about WHEN, short enough for the meta column.
// "IN 40M" / "TONIGHT 19:30" / "SAT 12 SEP 19:30".
export function eventClock(value,now=Date.now()){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";

  const ms=date.getTime()-now;
  const time=date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});

  if(ms<=0) return "NOW";
  if(ms<60*60*1000) return `IN ${Math.max(1,Math.round(ms/60000))}M`;
  if(ms<6*60*60*1000) return `IN ${Math.round(ms/3600000)}H`;

  const today=new Date(now);
  if(date.toDateString()===today.toDateString()){
    return `${date.getHours()>=17?"TONIGHT":"TODAY"} ${time}`;
  }

  const day=date.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  return `${day.toUpperCase()} ${time}`;
}

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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          eyebrow="WHAT'S ON"
          title="Upcoming Events"
          meta="Find community days, family activities and local experiences."
        />

        <View style={styles.body}>
          <Field label="Search">
            <TextInput
              style={fieldInputStyle}
              placeholder="Search events or locations"
              placeholderTextColor={INK.readoutFaint}
              accessibilityLabel="Search events or locations"
              value={query}
              onChangeText={setQuery}
            />
          </Field>

          {loading && <ActivityIndicator size="large" color={INK.readout} style={styles.loader}/>}

          {!!error && (
            <Notice
              tone="dispute"
              label="EVENTS UNAVAILABLE"
              action={<Action kind="secondary" label="Try again" glyph="refresh" onPress={loadEvents}/>}
            >
              {error}
            </Notice>
          )}

          {!loading && !error && (
            <SectionRule label="Events" meta={String(filtered.length)}/>
          )}

          {!loading && !error && filtered.length===0 && (
            <Empty
              title="No upcoming events found"
              instruction="Try another search, or check back when new events are published."
              glyph="calendar"
            />
          )}

          {filtered.map(event=>(
            <Row
              key={event.id}
              tone="scheduled"
              glyph="ticket"
              title={event.name}
              sub={event.description}
              meta={eventClock(event.starts_at)}
              metaSub={formatEventPrice(event.price).toUpperCase()}
              onPress={()=>router.push(`/events/${event.id}`)}
            >
              <View style={styles.foot}>
                {!!event.category && <Chip label={event.category} style={styles.chip}/>}
                <View style={styles.footCell}>
                  <Glyph name="pin" size={11} colour={INK.readoutFaint}/>
                  <Text style={styles.footText} numberOfLines={1}>{event.location || event.address}</Text>
                </View>
                <View style={styles.footCell}>
                  <Glyph name="people" size={11} colour={INK.readoutFaint}/>
                  <Text style={styles.footText} numberOfLines={1}>
                    {event.capacity ? `${event.capacity} PLACES` : "OPEN CAPACITY"}
                  </Text>
                </View>
              </View>

              {/* The full date, under the countdown that told you whether to
                  care. Both are measurements, so both are mono. */}
              <Text style={styles.when} numberOfLines={1}>{formatEventDate(event.starts_at)}</Text>
            </Row>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  loader:{marginTop:40},

  foot:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8,marginTop:8},
  footCell:{flexDirection:"row",alignItems:"center",gap:4,flexShrink:1},
  footText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6,flexShrink:1
  },
  chip:{minHeight:24,paddingVertical:3},
  when:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8,marginTop:7
  }
});
