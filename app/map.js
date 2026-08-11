import React,{useEffect,useState} from "react";
import {StyleSheet,View,TextInput,Pressable,Text,ScrollView} from "react-native";
import MapView,{Marker} from "react-native-maps";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import PlacesList from "../components/PlacesList";
import PlaceMarker from "../components/PlaceMarker";
import PlaceCards from "../components/PlaceCards";
import {CARD_KINDS,cardsAround,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";
// Number(null) is 0 and Number.isFinite(0) is true, so the version this replaced
// plotted any listing with no location at 0,0. See utils/coordinates.js.
import {hasCoordinates} from "../utils/coordinates";
import {markerForActivity} from "../utils/markers";
import {
  ACTIVITY_STATE_SENTENCE,
  DEFAULT_TIME_WINDOW,
  TIME_WINDOWS,
  activitiesInWindow,
  toActivities
} from "../utils/liveActivity";

export default function MapScreen(){
  // Read inside the component rather than at module scope, so a test can
  // exercise both the map and the list fallback. PROJECT-LOG.md records that no
  // key is set, which makes the fallback the shipping path -- the brief is
  // explicit: "do not assume a map".
  const apiKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if(!apiKey){
    return <PlacesList header={<Text style={styles.fallbackTitle}>🗺️ Xplorer Map</Text>}/>;
  }
  return <NativeMap/>;
}

function NativeMap(){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [activityClubs,setActivityClubs]=useState([]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [openKey,setOpenKey]=useState(null);

  // Packet 8f1. The living map: what is happening, not only what is there.
  const [activities,setActivities]=useState([]);
  const [timeWindow,setTimeWindow]=useState(DEFAULT_TIME_WINDOW);
  const [showLive,setShowLive]=useState(true);

  useEffect(()=>{loadPlaces();loadActivity();},[]);

  async function loadPlaces(){
    const [businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("businesses").select("id,name,category,business_type,claimed,address,latitude,longitude"),
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

  // The live layer, from the read model that already existed. This is the whole
  // of 8f1's data path: get_live_discovery has returned Link-ups, check-ins,
  // events and club sessions in one shape since 20260802211700, and until now
  // only /live called it.
  //
  // It is SECURITY DEFINER and raises 'Explorer account required.' when
  // auth.uid() is null, so a signed-out visitor is not asked. They still get the
  // static map, which is what they got before this packet -- the living layer is
  // an addition, not a gate on the map.
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

    // A failed live read must not empty the map. The static pins are a separate
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
  function matchesSearch(item,extraText){
    const clean=search.trim().toLowerCase();
    if(!clean) return true;
    return [item.name,item.category,item.address,item.location,extraText]
      .filter(Boolean)
      .some(value=>String(value).toLowerCase().includes(clean));
  }

  const filteredBusinesses=businesses.filter(item=>matchesSearch(item,classificationLabel(item)) && hasCoordinates(item));
  const filteredProperties=properties.filter(item=>matchesSearch(item) && hasCoordinates(item));
  const filteredClubs=activityClubs.filter(item=>matchesSearch(item) && hasCoordinates(item));

  const showBusinesses=typeFilter==="all" || typeFilter==="business";
  const showProperties=typeFilter==="all" || typeFilter==="property";
  const showClubs=typeFilter==="all" || typeFilter==="activity";

  // Every pin currently on the map, as cards. This is what a person can swipe
  // through, so it follows the same filters the pins do -- swiping to a place
  // the filter has hidden would be a different map than the one on screen.
  const cards=[
    ...(showBusinesses ? filteredBusinesses.map((row)=>toCard(CARD_KINDS.BUSINESS,row)) : []),
    ...(showProperties ? filteredProperties.map((row)=>toCard(CARD_KINDS.PROPERTY,row)) : []),
    ...(showClubs ? filteredClubs.map((row)=>toCard(CARD_KINDS.CLUB,row)) : [])
  ].filter(Boolean);

  const tapped=cards.find((card)=>card.key===openKey) || null;

  // The time filter applies to the living layer only. Narrowing "Tonight"
  // would not make a pub stop existing, so the static pins ignore it -- the
  // question the filter answers is "what is happening", not "what is there".
  const visibleActivity=showLive
    ? activitiesInWindow(activities,timeWindow).filter(item=>matchesSearch({name:item.title,category:item.subtitle,location:item.area}))
    : [];

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

        {/*
          Packet 8f1: Now / Tonight / Weekend. A separate row from the type
          filters on purpose -- one asks what kind of place, the other asks
          when, and collapsing them into one strip would make "Tonight" look
          like a kind of listing.
        */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <Pressable
            style={[styles.filterButton,showLive && styles.selectedFilter]}
            accessibilityRole="button"
            accessibilityLabel={showLive ? "Hide what is happening" : "Show what is happening"}
            onPress={()=>setShowLive(!showLive)}
          >
            <Text style={showLive ? styles.selectedFilterText : styles.filterText}>Happening</Text>
          </Pressable>

          {TIME_WINDOWS.map(({key,label})=>(
            <Pressable
              key={key}
              style={[styles.filterButton,showLive && timeWindow===key && styles.selectedFilter]}
              accessibilityRole="button"
              accessibilityLabel={`Show what is happening ${label.toLowerCase()}`}
              disabled={!showLive}
              onPress={()=>setTimeWindow(key)}
            >
              <Text style={showLive && timeWindow===key ? styles.selectedFilterText : styles.filterText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/*
        Packet 6. initialRegion and never `region`: an uncontrolled MapView keeps
        whatever position the person left it at. Passing `region` would drag the
        map back to a fixed point on every re-render, which is exactly the
        criterion this packet has to meet -- "map position unchanged after
        opening, swiping and dismissing".

        The card is a Modal rendered outside this element, so it cannot
        re-render or remount the map either.

        Packet 2. The pins were pinColor="#d63b3b" / "#275bd6" / "#5633a8" --
        three colours outside the token table, each chosen by what kind of
        listing it was. That is type controlling colour, which breaks the
        three-ink rule. Now the ink says whether something is scheduled there
        and the icon says what the place is.
      */}
      <MapView style={styles.map} initialRegion={{latitude:50.8225,longitude:-0.1372,latitudeDelta:0.12,longitudeDelta:0.12}}>
        {showBusinesses && filteredBusinesses.map(place=><Marker
          key={`business-${place.id}`}
          coordinate={{latitude:Number(place.latitude),longitude:Number(place.longitude)}}
          title={place.name}
          description={classificationLabel(place)}
          onPress={()=>setOpenKey(`${CARD_KINDS.BUSINESS}-${place.id}`)}
        >
          <PlaceMarker marker={toCard(CARD_KINDS.BUSINESS,place).marker}/>
        </Marker>)}

        {showProperties && filteredProperties.map(place=><Marker
          key={`property-${place.id}`}
          coordinate={{latitude:Number(place.latitude),longitude:Number(place.longitude)}}
          title={place.name}
          description="Property"
          onPress={()=>setOpenKey(`${CARD_KINDS.PROPERTY}-${place.id}`)}
        >
          <PlaceMarker marker={toCard(CARD_KINDS.PROPERTY,place).marker}/>
        </Marker>)}

        {showClubs && filteredClubs.map(club=><Marker
          key={`activity-${club.id}`}
          coordinate={{latitude:Number(club.latitude),longitude:Number(club.longitude)}}
          title={club.name}
          description={`${club.category} · ${club.status}`}
          onPress={()=>setOpenKey(`${CARD_KINDS.CLUB}-${club.id}`)}
        >
          <PlaceMarker marker={toCard(CARD_KINDS.CLUB,club).marker}/>
        </Marker>)}

        {/*
          Packet 8f1. The pins this map existed without: a Link-up, a check-in,
          an event and a club session are now on the same map as the places they
          happen at, which is what "open the map and see your local world come
          alive" asks for.

          Rendered after the static pins so a live thing draws on top of the
          place it is happening at, rather than under it.
        */}
        {visibleActivity.map(item=><Marker
          key={item.key}
          coordinate={{latitude:item.latitude,longitude:item.longitude}}
          title={item.title}
          description={`${ACTIVITY_STATE_SENTENCE[item.state]} ${item.subtitle}`.trim()}
          onPress={()=>item.deepLink && router.push(item.deepLink)}
        >
          <PlaceMarker marker={markerForActivity(item)}/>
        </Marker>)}
      </MapView>

      {!!tapped && (
        <PlaceCards
          cards={cardsAround(tapped,cards)}
          startKey={tapped.key}
          onClose={()=>setOpenKey(null)}
        />
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1},map:{flex:1},top:{position:"absolute",top:18,width:"100%",zIndex:10,padding:10},search:{backgroundColor:"white",padding:15,borderRadius:10,borderWidth:1,borderColor:"#ddd"},filters:{marginTop:9,maxHeight:44},filterButton:{backgroundColor:"white",paddingHorizontal:13,paddingVertical:10,marginRight:7,borderRadius:20,borderWidth:1,borderColor:"#ddd"},selectedFilter:{backgroundColor:"#222",borderColor:"#222"},filterText:{fontWeight:"600"},selectedFilterText:{color:"white",fontWeight:"bold"},fallbackTitle:{fontSize:30,fontWeight:"bold"}
});
