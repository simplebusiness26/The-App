import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import PlaceMarker from "./PlaceMarker";
import PlaceCards from "./PlaceCards";
import {CARD_KINDS,cardsAround,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";
import {markerForActivity} from "../utils/markers";
import {
  ACTIVITY_STATE_SENTENCE,
  DEFAULT_TIME_WINDOW,
  TIME_WINDOWS,
  activitiesInWindow,
  toActivities
} from "../utils/liveActivity";

// Packet 8f1 lands here as well as on app/map.js, and this is the copy that
// matters today. EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set, so this list IS
// the map as far as anybody using the app is concerned. Putting the living
// layer only in the MapView branch would have closed the gap in a file nobody
// currently renders and left the shipping path exactly as it was.

// Each window gets its own sentence. "Nothing here yet" is banned, and a single
// generic line would be the same mood in three costumes.
function emptyActivityInstruction(timeWindow){
  if(timeWindow==="tonight") return "Nothing is on tonight yet. Start a Link-up and it will show here.";
  if(timeWindow==="weekend") return "The weekend is open. Create an Event or a Link-up to put something on it.";
  return "Nothing is happening this minute. Check in somewhere or start a Link-up to change that.";
}

export default function PlacesList({header}){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [activityClubs,setActivityClubs]=useState([]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  // Packet 6. The brief wants the bottom card to work "with the current list
  // fallback when no Maps API key is set", and per PROJECT-LOG.md that is the
  // shipping path -- so this is where the card actually gets used today. A row
  // opens the same card the map would, and the card opens the full page.
  const [openKey,setOpenKey]=useState(null);

  const [activities,setActivities]=useState([]);
  const [timeWindow,setTimeWindow]=useState(DEFAULT_TIME_WINDOW);

  useEffect(()=>{loadPlaces();loadActivity();},[]);

  async function loadPlaces(){
    const [businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("businesses").select("id,name,category,business_type,claimed,address,latitude,longitude"),
      supabase.from("properties").select("id,name,host,address,latitude,longitude"),
      supabase.from("activity_clubs").select("id,name,category,location,address,latitude,longitude,status").in("status",["open","full"])
    ]);

    setBusinesses(businessResult.data || []);
    setProperties(propertyResult.data || []);
    setActivityClubs(clubResult.data || []);
  }

  // get_live_discovery is SECURITY DEFINER and refuses a signed-out caller, so
  // it is not asked. A signed-out visitor keeps the static list they had
  // before -- the living layer is an addition, never a gate.
  async function loadActivity(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setActivities([]);
      return;
    }

    const {data,error}=await supabase.rpc("get_live_discovery",{
      p_area:null,
      p_latitude:null,
      p_longitude:null,
      p_radius_km:25,
      p_window_hours:168
    });

    // A failed live read must not empty the list. The places are a separate
    // query and stay exactly as they were.
    if(error){
      console.log(error);
      setActivities([]);
      return;
    }

    setActivities(toActivities(data));
  }

  // Packet 1 turned businesses.category into a key, so a search for the word a
  // person would type stopped matching a place whose category now reads
  // food_and_drink. The readable classification is passed in as extra text.
  function matches(item,extraText){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location,extraText]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  const filteredBusinesses=businesses.filter(place=>matches(place,classificationLabel(place)));
  const filteredProperties=properties.filter(matches);
  const filteredClubs=activityClubs.filter(matches);

  // Follows the same filters the rows do: swiping to a place the filter has
  // hidden would be a different list than the one on screen.
  const cards=[
    ...((typeFilter==="all" || typeFilter==="business") ? filteredBusinesses.map((row)=>toCard(CARD_KINDS.BUSINESS,row)) : []),
    ...((typeFilter==="all" || typeFilter==="property") ? filteredProperties.map((row)=>toCard(CARD_KINDS.PROPERTY,row)) : []),
    ...((typeFilter==="all" || typeFilter==="activity") ? filteredClubs.map((row)=>toCard(CARD_KINDS.CLUB,row)) : [])
  ].filter(Boolean);

  const tapped=cards.find((card)=>card.key===openKey) || null;

  // The time filter narrows what is happening, never what exists. "Tonight"
  // does not make a pub stop being a pub.
  const visibleActivity=activitiesInWindow(activities,timeWindow)
    .filter(item=>matches({name:item.title,category:item.subtitle,location:item.area}));

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

      {/*
        Packet 8f1. First, deliberately. CLAUDE.md's ordering asks "What is
        around me?" then "What is happening now?", and until this packet the
        second question had no answer anywhere on the map. A section below the
        business list would technically answer it and would never be seen.
      */}
      <Text style={styles.section}>Happening</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {TIME_WINDOWS.map(({key,label})=>(
          <Pressable
            key={key}
            style={[styles.category,timeWindow===key && styles.selectedCategory]}
            accessibilityRole="button"
            accessibilityLabel={`Show what is happening ${label.toLowerCase()}`}
            onPress={()=>setTimeWindow(key)}
          >
            <Text style={timeWindow===key ? styles.selectedCategoryText : styles.categoryText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {visibleActivity.length
        ? visibleActivity.map(item=>(
          <Pressable
            key={item.key}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${ACTIVITY_STATE_SENTENCE[item.state]}`}
            onPress={()=>item.deepLink && router.push(item.deepLink)}
          >
            <View style={styles.cardRow}>
              <PlaceMarker marker={markerForActivity(item)} size={30}/>
              <View style={styles.cardText}>
                <Text style={styles.name}>{item.title}</Text>
                <Text>{ACTIVITY_STATE_SENTENCE[item.state]}</Text>
                <Text style={styles.address}>{item.subtitle}</Text>
              </View>
            </View>
          </Pressable>
        ))
        : (
          // An empty state is an instruction, not a mood (design-system.md).
          <View style={styles.card}>
            <Text>{emptyActivityInstruction(timeWindow)}</Text>
          </View>
        )}

      {(typeFilter==="all" || typeFilter==="business") && <>
        <Text style={styles.section}>Businesses</Text>
        {filteredBusinesses.map(place=><Pressable key={place.id} style={styles.card} accessibilityRole="button" accessibilityLabel={place.name} onPress={()=>setOpenKey(`${CARD_KINDS.BUSINESS}-${place.id}`)}>
          <View style={styles.cardRow}>
            <PlaceMarker marker={toCard(CARD_KINDS.BUSINESS,place).marker} size={30}/>
            <View style={styles.cardText}>
              <Text style={styles.name}>{place.name}</Text>
              <Text>{classificationLabel(place)}</Text>
              <Text style={styles.address}>{place.address}</Text>
            </View>
          </View>
        </Pressable>)}
      </>}

      {(typeFilter==="all" || typeFilter==="property") && <>
        <Text style={styles.section}>Properties</Text>
        {filteredProperties.map(property=><Pressable key={property.id} style={styles.card} accessibilityRole="button" accessibilityLabel={property.name} onPress={()=>setOpenKey(`${CARD_KINDS.PROPERTY}-${property.id}`)}>
          <View style={styles.cardRow}>
            <PlaceMarker marker={toCard(CARD_KINDS.PROPERTY,property).marker} size={30}/>
            <View style={styles.cardText}>
              <Text style={styles.name}>{property.name}</Text>
              <Text>{property.host}</Text>
              <Text style={styles.address}>{property.address}</Text>
            </View>
          </View>
        </Pressable>)}
      </>}

      {(typeFilter==="all" || typeFilter==="activity") && <>
        <Text style={styles.section}>Activity Clubs</Text>
        {filteredClubs.map(club=><Pressable key={club.id} style={styles.card} accessibilityRole="button" accessibilityLabel={club.name} onPress={()=>setOpenKey(`${CARD_KINDS.CLUB}-${club.id}`)}>
          <View style={styles.cardRow}>
            <PlaceMarker marker={toCard(CARD_KINDS.CLUB,club).marker} size={30}/>
            <View style={styles.cardText}>
              <Text style={styles.name}>{club.name}</Text>
              <Text>{club.category} · {club.status}</Text>
              <Text style={styles.address}>{club.address || club.location}</Text>
            </View>
          </View>
        </Pressable>)}
      </>}

      {!!tapped && (
        <PlaceCards
          cards={cardsAround(tapped,cards)}
          startKey={tapped.key}
          onClose={()=>setOpenKey(null)}
        />
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:20,paddingBottom:50},search:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:10,padding:15,marginTop:20},categories:{marginTop:15,maxHeight:48},category:{borderWidth:1,borderColor:"#bbb",borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginRight:8,backgroundColor:"white"},selectedCategory:{backgroundColor:"#222",borderColor:"#222"},categoryText:{fontWeight:"600"},selectedCategoryText:{color:"white",fontWeight:"bold"},section:{fontSize:22,fontWeight:"bold",marginTop:25},card:{backgroundColor:"white",borderWidth:1,borderColor:"#ddd",borderRadius:10,padding:15,marginTop:10},cardRow:{flexDirection:"row",alignItems:"center",gap:12},cardText:{flex:1},name:{fontSize:18,fontWeight:"bold"},address:{color:"#666",marginTop:5}
});
