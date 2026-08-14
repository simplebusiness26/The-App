import React,{useState} from "react";
import {View,Text,StyleSheet,Pressable,TextInput,ScrollView} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import PlacePanel from "./PlacePanel";
import {CARD_KINDS,toCard} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";
import {markerForActivity} from "../utils/markers";
import {ACTIVITY_STATE_SENTENCE,TIME_WINDOWS} from "../utils/liveActivity";
import {useLivingMap,DEFAULT_CENTRE} from "../hooks/useLivingMap";
import {nearestFirst} from "../utils/geo";
import {calculateDistance} from "../utils/location";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

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
//
// GAZETTEER PASS (design round r001-a, directive 6): one-line ledger rows
// instead of padded cards, ordered nearest-first via utils/geo.js's
// distanceRank, with the real figure alongside it from utils/location.js's
// haversine -- the pure "X km away" arithmetic that already existed here with
// nothing presenting it. DEFAULT_CENTRE is the same fixed reference point the
// map itself opens on, so this asks for no location permission and reads no
// device position; a row with no coordinates still sorts last and shows a
// dash rather than a distance nobody has.

function distanceLabel(row){
  const lat=Number(row?.latitude);
  const lng=Number(row?.longitude);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return "—";
  const km=calculateDistance(DEFAULT_CENTRE.latitude,DEFAULT_CENTRE.longitude,lat,lng);
  return `${km.toFixed(1)} km`;
}

// Each window gets its own sentence. "Nothing here yet" is banned, and a single
// generic line would be the same mood in three costumes.
function emptyActivityInstruction(timeWindow){
  if(timeWindow==="tonight") return "Nothing is on tonight yet. Start a Link-up and it will show here.";
  if(timeWindow==="weekend") return "The weekend is open. Create an Event or a Link-up to put something on it.";
  return "Nothing is happening this minute. Check in somewhere or start a Link-up to change that.";
}

function Row({marker,name,meta,distance,accessibilityLabel,onPress}){
  return(
    <Pressable style={styles.row} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      <PlaceMarker marker={marker} size={26}/>
      <View style={styles.rowText}>
        <Text style={TYPE.rowTitle} numberOfLines={1}>{name}</Text>
        {!!meta && <Text style={TYPE.meta} numberOfLines={1}>{meta}</Text>}
      </View>
      <Text style={styles.distance} numberOfLines={1}>{distance}</Text>
    </Pressable>
  );
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
  // Nearest first, from the same fixed reference the map opens on -- a row
  // with no coordinates sorts last rather than vanishing.
  const filteredBusinesses=nearestFirst(DEFAULT_CENTRE,map.places.filter((row)=>row.kind===CARD_KINDS.BUSINESS));
  const filteredProperties=nearestFirst(DEFAULT_CENTRE,map.places.filter((row)=>row.kind===CARD_KINDS.PROPERTY));
  const filteredClubs=nearestFirst(DEFAULT_CENTRE,map.places.filter((row)=>row.kind===CARD_KINDS.CLUB));

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
      <View style={styles.sectionHead}>
        <Text style={TYPE.sectionLabel}>Happening</Text>
        <Text style={styles.count}>{visibleActivity.length}</Text>
      </View>

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
          <Row
            key={item.key}
            marker={markerForActivity(item)}
            name={item.title}
            meta={`${ACTIVITY_STATE_SENTENCE[item.state]} ${item.subtitle || ""}`.trim()}
            distance={distanceLabel(item)}
            accessibilityLabel={`${item.title}. ${ACTIVITY_STATE_SENTENCE[item.state]}`}
            onPress={()=>item.deepLink && router.push(item.deepLink)}
          />
        ))
        : (
          // An empty state is an instruction, not a mood (design-system.md).
          <Text style={styles.emptyText}>{emptyActivityInstruction(timeWindow)}</Text>
        )}

      {(typeFilter==="all" || typeFilter==="business") && <>
        <View style={styles.sectionHead}>
          <Text style={TYPE.sectionLabel}>Businesses</Text>
          <Text style={styles.count}>{filteredBusinesses.length}</Text>
        </View>
        {filteredBusinesses.map(place=>(
          <Row
            key={place.id}
            marker={toCard(CARD_KINDS.BUSINESS,place).marker}
            name={place.name}
            meta={`${classificationLabel(place)}${place.address ? ` · ${place.address}` : ""}`}
            distance={distanceLabel(place)}
            accessibilityLabel={place.name}
            onPress={()=>setOpenKey(`${CARD_KINDS.BUSINESS}-${place.id}`)}
          />
        ))}
      </>}

      {(typeFilter==="all" || typeFilter==="property") && <>
        <View style={styles.sectionHead}>
          <Text style={TYPE.sectionLabel}>Properties</Text>
          <Text style={styles.count}>{filteredProperties.length}</Text>
        </View>
        {filteredProperties.map(property=>(
          <Row
            key={property.id}
            marker={toCard(CARD_KINDS.PROPERTY,property).marker}
            name={property.name}
            meta={`${property.host || ""}${property.address ? ` · ${property.address}` : ""}`}
            distance={distanceLabel(property)}
            accessibilityLabel={property.name}
            onPress={()=>setOpenKey(`${CARD_KINDS.PROPERTY}-${property.id}`)}
          />
        ))}
      </>}

      {(typeFilter==="all" || typeFilter==="activity") && <>
        <View style={styles.sectionHead}>
          <Text style={TYPE.sectionLabel}>Activity Clubs</Text>
          <Text style={styles.count}>{filteredClubs.length}</Text>
        </View>
        {filteredClubs.map(club=>(
          <Row
            key={club.id}
            marker={toCard(CARD_KINDS.CLUB,club).marker}
            name={club.name}
            meta={`${club.category} · ${club.status}`}
            distance={distanceLabel(club)}
            accessibilityLabel={club.name}
            onPress={()=>setOpenKey(`${CARD_KINDS.CLUB}-${club.id}`)}
          />
        ))}
      </>}

      {/* The same panel the map opens, so the two surfaces cannot grow two
          different ideas of what a place looks like. */}
      {!!tapped && <PlacePanel place={tapped} onClose={()=>setOpenKey(null)}/>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  search:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:13,
    marginTop:20,
    color:INK.ink
  },
  categories:{marginTop:12,maxHeight:44},
  category:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    paddingHorizontal:12,
    paddingVertical:9,
    marginRight:8,
    backgroundColor:INK.card
  },
  selectedCategory:{backgroundColor:INK.ink,borderColor:INK.ink},
  categoryText:{color:INK.ink,fontWeight:"700",fontSize:12},
  selectedCategoryText:{color:INK.card,fontWeight:"800",fontSize:12},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    marginTop:22,
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
    paddingVertical:8,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  rowText:{flex:1},
  distance:{...TYPE.numeral,fontSize:13}
});
