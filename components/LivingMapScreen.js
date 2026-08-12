import React,{useState} from "react";
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import LivingMap from "./LivingMap";
import PlacesList from "./PlacesList";
import PlaceCards from "./PlaceCards";
import {cardsAround} from "../utils/placeCards";
import {useLivingMap,TYPE_FILTERS} from "../hooks/useLivingMap";
import {TIME_WINDOWS} from "../utils/liveActivity";
import {INK} from "../utils/tokens";

// The map screen, once and for both platforms.
//
// Everything here is Xplorer: the search box, the filters, the cards, where a
// tap goes. The only platform-specific thing in the whole screen is <LivingMap>,
// which Metro resolves to LivingMap.web.js in a browser and LivingMap.js on a
// phone -- and neither of those files reads the database or decides what a pin
// means.
//
// PLACE CARDS, NOT PROVIDER POPUPS
//
// Tapping a marker opens Xplorer's own card. MapLibre and react-native-maps
// both offer a popup of their own and neither is used: the mapping system
// renders geography, Xplorer renders the Xplorer experience.

export default function LivingMapScreen(){
  const map=useLivingMap();
  const [openKey,setOpenKey]=useState(null);
  const [asList,setAsList]=useState(false);

  const tapped=map.cards.find((card)=>card.key===openKey) || null;

  // The list is a VIEW of the same Living Map, not a fallback for not having
  // one. It is kept because it works when the map will not load, because it is
  // the better surface for a screen reader, and because browsing what is near
  // you without a map is a real way to use this app.
  if(asList){
    return(
      <View style={styles.container}>
        <PlacesList
          header={
            <Pressable
              style={styles.switch}
              accessibilityRole="button"
              accessibilityLabel="Show the map instead of the list"
              onPress={()=>setAsList(false)}
            >
              <Text style={styles.switchText}>Show the map</Text>
            </Pressable>
          }
        />
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <View style={styles.top}>
        <TextInput
          style={styles.search}
          placeholder="Search businesses, stays or clubs..."
          placeholderTextColor={INK.inkSoft}
          value={map.search}
          onChangeText={map.setSearch}
          accessibilityLabel="Search the map"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {TYPE_FILTERS.map(({key,label})=>(
            <Pressable
              key={key}
              style={[styles.filterButton,map.typeFilter===key && styles.selectedFilter]}
              accessibilityRole="button"
              accessibilityLabel={`Show ${label}`}
              onPress={()=>map.setTypeFilter(key)}
            >
              <Text style={map.typeFilter===key ? styles.selectedFilterText : styles.filterText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* A separate row on purpose: one asks what kind of place, the other
            asks when, and collapsing them would make "Tonight" look like a kind
            of listing. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <Pressable
            style={[styles.filterButton,map.showLive && styles.selectedFilter]}
            accessibilityRole="button"
            accessibilityLabel={map.showLive ? "Hide what is happening" : "Show what is happening"}
            onPress={()=>map.setShowLive(!map.showLive)}
          >
            <Text style={map.showLive ? styles.selectedFilterText : styles.filterText}>Happening</Text>
          </Pressable>

          <Pressable
            style={styles.filterButton}
            accessibilityRole="button"
            accessibilityLabel="Show a list instead of the map"
            onPress={()=>setAsList(true)}
          >
            <Text style={styles.filterText}>List</Text>
          </Pressable>

          {TIME_WINDOWS.map(({key,label})=>(
            <Pressable
              key={key}
              style={[styles.filterButton,map.showLive && map.timeWindow===key && styles.selectedFilter]}
              accessibilityRole="button"
              accessibilityLabel={`Show what is happening ${label.toLowerCase()}`}
              disabled={!map.showLive}
              onPress={()=>map.setTimeWindow(key)}
            >
              <Text style={map.showLive && map.timeWindow===key ? styles.selectedFilterText : styles.filterText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <LivingMap
        places={map.places}
        activity={map.activity}
        onSelectPlace={(place)=>setOpenKey(place.card?.key || null)}
        onSelectActivity={(item)=>item.deepLink && router.push(item.deepLink)}
      />

      {!!tapped && (
        <PlaceCards
          cards={cardsAround(tapped,map.cards)}
          startKey={tapped.key}
          onClose={()=>setOpenKey(null)}
        />
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  top:{position:"absolute",top:18,width:"100%",zIndex:10,padding:10},
  search:{
    backgroundColor:INK.card,padding:15,borderRadius:10,
    borderWidth:2,borderColor:INK.ink,color:INK.ink
  },
  filters:{marginTop:9,maxHeight:44},
  filterButton:{
    backgroundColor:INK.card,paddingHorizontal:13,paddingVertical:10,marginRight:7,
    borderRadius:20,borderWidth:2,borderColor:INK.ink
  },
  selectedFilter:{backgroundColor:INK.ink,borderColor:INK.ink},
  filterText:{fontWeight:"600",color:INK.ink},
  selectedFilterText:{color:INK.card,fontWeight:"bold"},
  switch:{
    alignSelf:"flex-start",borderWidth:2,borderColor:INK.ink,borderRadius:99,
    paddingHorizontal:16,paddingVertical:8,backgroundColor:INK.card,marginBottom:10
  },
  switchText:{color:INK.ink,fontWeight:"800"}
});
