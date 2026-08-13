import React,{useEffect,useMemo,useState} from "react";
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import LivingMap from "./LivingMap";
import PlacesList from "./PlacesList";
import PlaceCards from "./PlaceCards";
import FloatingLogin from "./FloatingLogin";
import Directions from "./Directions";
import {cardsAround} from "../utils/placeCards";
import {linkupLocationFrom} from "../utils/mapLayers";
import {routeAppearance,bubbleAppearance,celebrationPieces} from "../utils/markers";
import {useLivingMap,TYPE_FILTERS} from "../hooks/useLivingMap";
import {candidatesFrom} from "../utils/bubbleCandidates";
import {bubblesAt,BUBBLE_MS} from "../utils/liveBubbles";
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
  // Set when the map itself cannot run -- no WebGL, a dead tile host, a style
  // that will not load. The list is what somebody gets then, and it says why
  // rather than leaving a blank rectangle.
  const [mapFailed,setMapFailed]=useState("");
  // A point somebody pressed and held, waiting for them to confirm.
  const [dropped,setDropped]=useState(null);
  // The route currently drawn, or null. The model comes from utils/routing and
  // is turned into the drawing instruction here -- neither map renderer knows
  // what a routing provider is, and neither knows what a colour means.
  const [route,setRoute]=useState(null);

  // THE BUBBLE ROTATION.
  //
  // One counter, one interval, for the whole map. Every bubble on screen is
  // chosen from it by utils/liveBubbles.js -- no marker starts a timer of its
  // own, which is the difference between three bubbles taking turns and twenty
  // popups competing.
  const [tick,setTick]=useState(0);
  // A bubble somebody tapped. It is not part of the rotation and does not use
  // up one of the three: it stays until they close it.
  const [openBubble,setOpenBubble]=useState(null);

  useEffect(()=>{
    const timer=setInterval(()=>setTick((current)=>current+1),BUBBLE_MS);
    return()=>clearInterval(timer);
  },[]);

  const tapped=map.cards.find((card)=>card.key===openKey) || null;

  const candidates=useMemo(()=>candidatesFrom({
    places:map.places,
    activity:map.activity,
    reviewShots:map.reviewShots,
    appearance:bubbleAppearance(),
    confetti:celebrationPieces()
  }),[map.places,map.activity,map.reviewShots]);

  const bubbles=useMemo(()=>{
    const automatic=bubblesAt(candidates,{tick,selectedKey:openBubble?.key || null});
    // The tapped one is drawn as well as the three, never instead of one.
    return openBubble ? [...automatic,openBubble] : automatic;
  },[candidates,tick,openBubble]);

  // The list is a VIEW of the same Living Map, not a fallback for not having
  // one. It is kept because it works when the map will not load, because it is
  // the better surface for a screen reader, and because browsing what is near
  // you without a map is a real way to use this app.
  if(asList || mapFailed){
    return(
      <View style={styles.container}>
        <PlacesList
          header={
            <>
            {!!mapFailed && (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>The map could not load</Text>
                <Text style={styles.noticeText}>
                  Everything below is the same places the map would show. It is
                  usually a connection problem — try again in a moment.
                </Text>
              </View>
            )}
            <Pressable
              style={styles.switch}
              accessibilityRole="button"
              accessibilityLabel="Show the map instead of the list"
              onPress={()=>{setMapFailed("");setAsList(false);}}
            >
              <Text style={styles.switchText}>{mapFailed ? "Try the map again" : "Show the map"}</Text>
            </Pressable>
            </>
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
            style={[styles.filterButton,map.showPosts && styles.selectedFilter]}
            accessibilityRole="button"
            accessibilityLabel={map.showPosts ? "Hide Moments and Memories" : "Show Moments and Memories"}
            onPress={()=>map.setShowPosts(!map.showPosts)}
          >
            <Text style={map.showPosts ? styles.selectedFilterText : styles.filterText}>Posts</Text>
          </Pressable>

          <Pressable
            style={[styles.filterButton,map.showHeat && styles.selectedFilter]}
            accessibilityRole="button"
            accessibilityLabel={map.showHeat ? "Hide busy areas" : "Show busy areas"}
            onPress={()=>map.setShowHeat(!map.showHeat)}
          >
            <Text style={map.showHeat ? styles.selectedFilterText : styles.filterText}>Busy</Text>
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
        pins={map.posts.map((post)=>({...post,onPress:()=>router.push(post.route)}))}
        heat={map.heat}
        route={route}
        bubbles={bubbles}
        onSelectBubble={(bubble)=>{
          // Tapping a bubble opens the exact thing it is about. A review bubble
          // opens that review, not the place it is of.
          if(bubble?.route){router.push(bubble.route);return;}
          setOpenBubble(bubble || null);
        }}
        onSelectPlace={(place)=>setOpenKey(place.card?.key || null)}
        onSelectActivity={(item)=>item.deepLink && router.push(item.deepLink)}
        onDropPin={(at)=>setDropped(linkupLocationFrom(at))}
        onUnavailable={(why)=>setMapFailed(why || "unavailable")}
      />

      {/*
        PRESS AND HOLD THE MAP TO START A LINK-UP THERE.
        It asks first. A long press is easy to do by accident while panning,
        and sending somebody to a form they did not ask for is worse than one
        extra tap. The point is ROUNDED before it is offered -- a meeting point
        is a corner of a park, not a doorstep -- and the sheet says so in words
        rather than leaving somebody to assume.
      */}
      {!!dropped && (
        <View style={styles.dropCard}>
          <Text style={styles.dropTitle}>Start a Link-up here?</Text>
          <Text style={styles.dropText}>
            The spot is rounded to about a street, not the exact point you held.
          </Text>
          <View style={styles.dropRow}>
            <Pressable
              style={styles.dropCancel}
              accessibilityRole="button"
              accessibilityLabel="Not here"
              onPress={()=>setDropped(null)}
            >
              <Text style={styles.dropCancelText}>Not here</Text>
            </Pressable>
            <Pressable
              style={styles.dropGo}
              accessibilityRole="button"
              accessibilityLabel="Start a Link-up here"
              onPress={()=>{
                const at=dropped;
                setDropped(null);
                router.push(`/linkups/create?lat=${at.latitude}&lng=${at.longitude}`);
              }}
            >
              <Text style={styles.dropGoText}>Start a Link-up</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Only draws itself for somebody who is signed out, and never over an
          open card. The app opens on this screen now, so this is the way in. */}
      {!tapped && <FloatingLogin/>}

      {/*
        DIRECTIONS, ON THE MAP THAT WILL DRAW THEM.
        The destination is whatever pin is open. Putting this here rather than
        on each entity page means one component, one location permission and one
        route on screen at a time -- and the route appears on the map somebody
        is already looking at rather than on a page with no map.

        The Explorer's position never leaves this device except as the routing
        request itself. See the note in components/Directions.js.
      */}
      {!!tapped && Number.isFinite(Number(tapped.latitude)) && Number.isFinite(Number(tapped.longitude)) && (
        <View style={styles.directions} pointerEvents="box-none">
          <Directions
            destination={{latitude:tapped.latitude,longitude:tapped.longitude}}
            destinationName={tapped.title || tapped.name || "this place"}
            onRoute={(model)=>{
              if(!model){setRoute(null);return;}
              const look=routeAppearance();
              setRoute({
                // [lng,lat] for the map, converted once, here.
                line:model.geometry.map((point)=>[point.longitude,point.latitude]),
                colour:look.colour,
                width:look.width,
                casingColour:look.casingColour,
                casingWidth:look.casingWidth
              });
            }}
          />
        </View>
      )}

      {!!tapped && (
        <PlaceCards
          cards={cardsAround(tapped,map.cards)}
          startKey={tapped.key}
          onClose={()=>{setOpenKey(null);setRoute(null);}}
        />
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  // Above the card sheet, out of the way of the search box.
  directions:{position:"absolute",left:12,right:12,bottom:12,zIndex:15},
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
  dropCard:{position:"absolute",left:14,right:14,bottom:96,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:16,padding:16,zIndex:30},
  dropTitle:{color:INK.ink,fontSize:17,fontWeight:"900"},
  dropText:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:6},
  dropRow:{flexDirection:"row",gap:10,marginTop:14},
  dropCancel:{flex:1,minHeight:44,borderRadius:12,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center"},
  dropCancelText:{color:INK.ink,fontWeight:"900"},
  dropGo:{flex:1,minHeight:44,borderRadius:12,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  dropGoText:{color:INK.card,fontWeight:"900"},
  filterText:{fontWeight:"600",color:INK.ink},
  selectedFilterText:{color:INK.card,fontWeight:"bold"},
  switch:{
    alignSelf:"flex-start",borderWidth:2,borderColor:INK.ink,borderRadius:99,
    paddingHorizontal:16,paddingVertical:8,backgroundColor:INK.card,marginBottom:10
  },
  switchText:{color:INK.ink,fontWeight:"800"},
  notice:{
    backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12,
    padding:14,marginBottom:10
  },
  noticeTitle:{color:INK.ink,fontWeight:"800",fontSize:15},
  noticeText:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:4}
});
