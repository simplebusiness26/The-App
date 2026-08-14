import React,{useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import PlacePanel from "./PlacePanel";
import {CARD_KINDS,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";
import {markerForActivity} from "../utils/markers";
import {ACTIVITY_STATE_SENTENCE,TIME_WINDOWS} from "../utils/liveActivity";
import {useLivingMap} from "../hooks/useLivingMap";
import {INK} from "../utils/tokens";

// The list view of the Living Map.
//
// It used to be the ONLY view: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY was never set,
// so app/map.js fell through to this and the app had no map at all. Packet 21
// gave it one, and this stopped being the map.
//
// It is kept, and reachable, because it earns its place: it works when the map
// will not load, it is the better surface for a screen reader, and browsing
// what is near you without a map is a real way to use this app. What it is no
// longer is a substitute for being unable to draw one.

// Each window gets its own sentence. "Nothing here yet" is banned, and a single
// generic line would be the same mood in three costumes.
function emptyActivityInstruction(timeWindow){
  if(timeWindow==="tonight") return "Nothing is on tonight yet. Start a Link-up and it will show here.";
  if(timeWindow==="weekend") return "The weekend is open. Create an Event or a Link-up to put something on it.";
  return "Nothing is happening this minute. Check in somewhere or start a Link-up to change that.";
}

export default function PlacesList({header}){
  // ONE BRAIN, TWO VIEWS.
  //
  // This file used to carry its own copy of everything: the three reads, the
  // signed-out guard, the error isolation, the search matcher, the type filter
  // and the time window -- all of it duplicated almost line for line in
  // app/map.js. Two copies of a rule is two chances for the list and the map to
  // disagree about what is in front of somebody.
  //
  // It is the same hook the map uses now. The list is a VIEW of the Living Map,
  // not a second implementation of it, which is why a Map/List switch can put
  // them side by side without either lying.
  const map=useLivingMap();

  const {search,setSearch,typeFilter,setTypeFilter,timeWindow,setTimeWindow}=map;
  const [openKey,setOpenKey]=useState(null);

  // The hook returns one filtered list with a `kind` on each row. The sections
  // below want them split, and splitting a list is not a second read model.
  const filteredBusinesses=map.places.filter((row)=>row.kind===CARD_KINDS.BUSINESS);
  const filteredProperties=map.places.filter((row)=>row.kind===CARD_KINDS.PROPERTY);
  const filteredClubs=map.places.filter((row)=>row.kind===CARD_KINDS.CLUB);

  const visibleActivity=map.activity;

  // The whole row, not just its card: components/PlacePanel.js shows the
  // picture and the description, and both live on the row.
  const tapped=map.places.find((row)=>row.card?.key===openKey) || null;

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

      {/* The same panel the map opens, so the two surfaces cannot grow two
          different ideas of what a place looks like. */}
      {!!tapped && <PlacePanel place={tapped} onClose={()=>setOpenKey(null)}/>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},content:{padding:20,paddingBottom:50},search:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:10,padding:15,marginTop:20},categories:{marginTop:15,maxHeight:48},category:{borderWidth:1,borderColor:INK.hair,borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginRight:8,backgroundColor:INK.card},selectedCategory:{backgroundColor:INK.ink,borderColor:INK.ink},categoryText:{color:INK.ink,fontWeight:"600"},selectedCategoryText:{color:INK.card,fontWeight:"bold"},section:{fontSize:22,fontWeight:"bold",marginTop:25},card:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:10,padding:15,marginTop:10},cardRow:{flexDirection:"row",alignItems:"center",gap:12},cardText:{flex:1},name:{fontSize:18,fontWeight:"bold"},address:{color:INK.inkSoft,marginTop:5}
});
