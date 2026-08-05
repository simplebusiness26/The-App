import React,{useEffect,useState} from "react";
import {StyleSheet,View,TextInput,Pressable,Text,ScrollView} from "react-native";
import MapView,{Marker} from "react-native-maps";
import {supabase} from "../services/supabase";
import PlacesList from "../components/PlacesList";
import PlaceMarker from "../components/PlaceMarker";
import PlaceCards from "../components/PlaceCards";
import {CARD_KINDS,cardsAround,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";

export default function MapScreen(){
  // Read inside the component rather than at module scope, so a test can
  // exercise both the map and the list fallback. PROJECT-LOG.md records that no
  // key is set, which makes the fallback the shipping path -- the brief is
  // explicit: "do not assume a map".
  const apiKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if(!apiKey){
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
  const [openKey,setOpenKey]=useState(null);

  useEffect(()=>{loadPlaces();},[]);

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

  function hasCoordinates(item){
    return Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
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
