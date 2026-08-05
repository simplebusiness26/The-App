import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {supabase} from "../services/supabase";
import PlaceMarker from "./PlaceMarker";
import PlaceCards from "./PlaceCards";
import {CARD_KINDS,cardsAround,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";

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

  useEffect(()=>{loadPlaces();},[]);

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
