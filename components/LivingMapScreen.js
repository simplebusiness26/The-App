import React,{useCallback,useEffect,useMemo,useState} from "react";
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import LivingMap from "./LivingMap";
import PlacesList from "./PlacesList";
import FloatingLogin from "./FloatingLogin";
import {linkupLocationFrom,itemsInCell,heatKey} from "../utils/mapLayers";
import {routeAppearance,bubbleAppearance,celebrationPieces,clusterAppearance} from "../utils/markers";
import {useLivingMap,TYPE_FILTERS} from "../hooks/useLivingMap";
import {candidatesFrom} from "../utils/bubbleCandidates";
import {clusterPins,visibleKeys} from "../utils/mapClusters";
import {bubbleIntervalFor} from "../utils/mapZoom";
import MapControls,{PANELS} from "./MapControls";
import PlacePanel from "./PlacePanel";
import TimeSlider from "./TimeSlider";
import {
  memoriesAt,
  timelineRange,
  positionOf,
  timeAtPosition,
  timelineLabel,
  WINDOW_DAYS,
  DAY_MS
} from "../utils/memoryTimeline";
import {markerForMemory} from "../utils/markers";
import {bubblesAt,BUBBLE_MS} from "../utils/liveBubbles";
import {TIME_WINDOWS} from "../utils/liveActivity";
import {useHeaderClearance} from "./Header";
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

// MEMORIES MODE: A MEMORIES MAP, WITH THE PLACES BEHIND IT.
//
// The owner asked for Memories only -- "I don't want you to see businesses,
// just the public memories, your friends' memories and your own memories, in
// the location they were captured" -- and then, offered the choice, asked for
// the places to stay drawn faintly for orientation. Both were said; this is the
// second one, and it is one constant away from being the first.
//
// Faint, and not tappable. A Memories map where tapping opens a pub is a map of
// pubs with Memories on it, which is the thing they were objecting to.
export const MEMORY_MODE_PLACE_OPACITY=0.25;

// No clusters and no bubbles over a history. A "Spaces open" bubble on a map of
// last April is the live map leaking into the one that replaced it.
const MEMORIES_MODE_MAP={clusters:[],bubbles:[]};

export default function LivingMapScreen(){
  const map=useLivingMap();
  // The header floats OVER the map now rather than sitting above it -- that bar
  // across the top was the owner's "it drops the whole page down", and on this
  // screen it meant the search box started below the map instead of on it. The
  // controls clear the floating chips instead of clearing a bar.
  const clearHeader=useHeaderClearance();

  // "See on the map", from a Discover card. Read once into state rather than
  // straight into a prop, so panning away from it does not snap back the next
  // time this screen re-renders -- which, with the bubble rotation, is every
  // few seconds.
  const params=useLocalSearchParams();
  const [focus]=useState(()=>{
    const latitude=Number(Array.isArray(params.lat) ? params.lat[0] : params.lat);
    const longitude=Number(Array.isArray(params.lng) ? params.lng[0] : params.lng);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? {latitude,longitude} : null;
  });
  const [openKey,setOpenKey]=useState(null);
  // Only ever set when the map itself cannot run. The List used to be a filter
  // button as well; browsing is Discover's job and the owner asked for it back
  // there, so this is now the failure branch and nothing else.
  const [asList,setAsList]=useState(false);
  // Where the map is looking: {north,south,east,west,zoom}, reported by
  // whichever renderer is in front of somebody. Null until it says.
  //
  // This is the thing the map never had. utils/liveBubbles.js has had an
  // inViewport() since it was written and nobody ever gave it a viewport, so
  // three bubbles rotated at county zoom for off-screen places.
  const [viewport,setViewport]=useState(null);
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
  // The Moments revealed by tapping a warm patch, or null.
  const [revealed,setRevealed]=useState(null);

  // MEMORIES ONLY: the map becomes a history.
  //
  // "What happened here?" is a different question from "what is happening
  // now?", so it gets a different map rather than a filter on this one. The
  // slider moves a ten-day window through time and what changes is which
  // Memories are PROMINENT -- nothing is hidden, expired or deleted by moving
  // it. See utils/memoryTimeline.js.
  const [historical,setHistorical]=useState(false);
  const [at,setAt]=useState(null);
  // Which of the two control panels is open, if either. Both closed to start
  // with: the map is the point and the controls are not.
  const [panel,setPanel]=useState(PANELS.NONE);

  const candidates=useMemo(()=>candidatesFrom({
    places:map.places,
    activity:map.activity,
    reviewShots:map.reviewShots,
    appearance:bubbleAppearance(),
    confetti:celebrationPieces()
  }),[map.places,map.activity,map.reviewShots]);
  const candidateCount=candidates.length;

  // PINS THAT WOULD OVERLAP BECOME ONE PIN WITH A NUMBER ON IT.
  //
  // hooks/useLivingMap.js reads every business, property and club with no limit
  // and no bounds, and until now every one of them was drawn whatever the zoom.
  // The owner, looking at the county view: "it's all clustered together".
  //
  // The live layer is deliberately NOT clustered. There is little of it, it is
  // the half worth looking at, and collapsing a Link-up into a count would hide
  // the thing the map exists to show.
  const clustered=useMemo(
    ()=>clusterPins(map.places,{zoom:viewport?.zoom}),
    [map.places,viewport?.zoom]
  );

  const clusters=useMemo(
    ()=>clustered.clusters.map((cluster)=>({...cluster,...clusterAppearance(cluster.count)})),
    [clustered.clusters]
  );

  // The pins drawn on their own. A bubble may only point at one of these --
  // see utils/liveBubbles.js. This is the fix for "pop ups that aren't even at
  // the location": a bubble can no longer hang over a heap of pins.
  const visibleAnchors=useMemo(
    ()=>visibleKeys([...clustered.singles,...map.activity]),
    [clustered.singles,map.activity]
  );

  const range=useMemo(()=>timelineRange(map.memoryRows),[map.memoryRows]);
  const when=at===null ? range.to : at;

  // Only while there is something to rotate. A map with no eligible bubbles --
  // which is most maps, most of the time, since both Manager switches default
  // to off -- has no reason to wake up every four seconds and re-render.
  //
  // It is also correctness, not just thrift: a timer that keeps firing on an
  // unmounted screen updates state after the screen is gone. In the test suite
  // that surfaces as "Cannot log after tests are done" and a run that exits 1
  // with every test passing, which is exactly the CI failure this project spent
  // a day on last week.
  //
  // The interval now follows the zoom. Count was only half the complaint --
  // "I don't want it to be this frequent" is a rate, and one bubble changing
  // every four seconds is still a flicker. See utils/mapZoom.js.
  const interval=bubbleIntervalFor(viewport?.zoom);

  useEffect(()=>{
    if(!candidateCount) return undefined;
    const timer=setInterval(()=>setTick((current)=>current+1),interval);
    return()=>clearInterval(timer);
  },[candidateCount,interval]);

  // The whole place row, not just its card: the panel wants the picture and the
  // description, which live on the row.
  const tapped=map.places.find((place)=>place.card?.key===openKey) || null;

  const bubbles=useMemo(()=>{
    const automatic=bubblesAt(candidates,{
      tick,
      viewport,
      zoom:viewport?.zoom ?? null,
      visibleAnchors,
      selectedKey:openBubble?.key || null
    });
    // The tapped one is drawn as well, never instead of one.
    return openBubble ? [...automatic,openBubble] : automatic;
  },[candidates,tick,viewport,visibleAnchors,openBubble]);

  // ---------------------------------------------------------------------------
  // Handlers, held steady on purpose
  // ---------------------------------------------------------------------------
  // These were inline arrows, so every one was a new function on every render.
  // components/LivingMap.web.js had them in its setup effect's dependency list
  // and that effect's cleanup calls map.remove() -- so the bubble rotation,
  // which re-renders this screen every few seconds, was destroying and
  // rebuilding the entire MapLibre instance on a timer, throwing away the
  // position and zoom somebody had just set.

  const handleViewportChange=useCallback((next)=>{
    setViewport((current)=>{
      // Same view, same object: a re-render of everything downstream for a
      // viewport that did not move is exactly the kind of churn this map has
      // too much of already.
      if(current
        && current.zoom===next.zoom
        && current.north===next.north
        && current.south===next.south
        && current.east===next.east
        && current.west===next.west) return current;
      return next;
    });
  },[]);

  const handleDropPin=useCallback((at)=>setDropped(linkupLocationFrom(at)),[]);
  const handleUnavailable=useCallback((why)=>setMapFailed(why || "unavailable"),[]);
  const handleSelectPlace=useCallback((place)=>setOpenKey(place.card?.key || null),[]);
  const handleSelectActivity=useCallback((item)=>{
    if(item.deepLink) router.push(item.deepLink);
  },[]);

  // A cluster tap moves the camera, which the renderer does for itself. All
  // this has to do is get the open panel out of the way of where you are going.
  const handleSelectCluster=useCallback(()=>{
    setOpenKey(null);
    setRoute(null);
  },[]);

  const handleSelectBubble=useCallback((bubble)=>{
    // Tapping a bubble opens the exact thing it is about. A review bubble opens
    // that review, not the place it is of.
    if(bubble?.route){router.push(bubble.route);return;}
    setOpenBubble(bubble || null);
  },[]);

  // ONE TAP ON A WARM PATCH, AND IT IS A TAP ON THE MAP.
  //
  // It used to be a double tap on a heat CIRCLE. Both halves of that are gone.
  // There are no circles -- heat is a density layer now and a layer has nothing
  // to tap -- and the double tap could never have won anyway: MapLibre's own
  // double-tap-to-zoom is on by default on both platforms, so the map's gesture
  // beat utils/doubleTap.js's 320ms counter every time and the owner only ever
  // zoomed in.
  //
  // A tap on open map is now "what is happening here". It still answers about a
  // PLACE rather than about the screen: the grid square under the finger first,
  // and the ring of eight around it if that one is empty, because the wash you
  // can see does not line up with a kilometre grid. The panel says which it got.
  const handleOpenHeat=useCallback((at)=>{
    if(!map.showHeat) return;

    const cell={key:heatKey(at?.latitude,at?.longitude)};
    if(!cell.key) return;

    const moments=map.posts.filter((post)=>post.kind==="moment");
    const here=itemsInCell(moments,cell);
    const nearby=here.length ? [] : itemsInCell(moments,cell,{neighbours:true});

    // Nothing warm under the finger and nothing near it: this was somebody
    // panning, not asking a question. Opening an empty panel over the map every
    // time they touch it would be worse than not answering.
    if(!here.length && !nearby.length) return;

    setRevealed({cell,moments:here.length ? here : nearby,widened:!here.length});
  },[map.posts,map.showHeat]);

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
      {/*
        THE MAP IS CLEAN UNTIL SOMEBODY ASKS.

        This used to be a search box and two rows of chips, drawn permanently
        across the top -- covering a third of the screen in the owner's
        screenshots, and one of them covering a photo bubble. Their words: "put
        the search behind an icon button and same for the filters, have them so
        they can be hidden after as well."

        components/MapControls.js is two chips that toggle. It decides nothing:
        every value and setter below comes from hooks/useLivingMap.js exactly as
        it did before.
      */}
      <View style={[styles.top,{top:clearHeader}]} pointerEvents="box-none">
        <MapControls
          open={panel}
          onOpen={setPanel}
          search={map.search}
          onSearch={map.setSearch}
          typeFilters={TYPE_FILTERS}
          typeFilter={map.typeFilter}
          onTypeFilter={map.setTypeFilter}
          timeWindows={TIME_WINDOWS}
          timeWindow={map.timeWindow}
          onTimeWindow={map.setTimeWindow}
          showLive={map.showLive}
          onShowLive={map.setShowLive}
          showPosts={map.showPosts}
          onShowPosts={map.setShowPosts}
          showHeat={map.showHeat}
          onShowHeat={map.setShowHeat}
          historical={historical}
          onHistorical={(next)=>{
            setHistorical(next);
            setAt(null);
            setRevealed(null);
            // The live layers are a different question and would only get in
            // the way of this one.
            if(next){map.setShowLive(false);map.setShowPosts(false);map.setShowHeat(false);}
            else{map.setShowPosts(true);}
          }}
        />
      </View>

      <LivingMap
        {...(historical ? MEMORIES_MODE_MAP : {clusters,bubbles})}
        places={clustered.singles}
        placeOpacity={historical ? MEMORY_MODE_PLACE_OPACITY : 1}
        focus={focus}
        activity={map.activity}
        pins={
          historical
            ? memoriesAt(map.memoryRows,when)
                .filter((entry)=>entry.memory.latitude!==null && entry.memory.longitude!==null)
                .map(({memory,prominence})=>({
                  key:`memory-${memory.id}`,
                  latitude:Number(memory.latitude),
                  longitude:Number(memory.longitude),
                  marker:markerForMemory(memory),
                  // Presentation only. A Memory at 0 is simply not in this
                  // ten-day window; it is untouched everywhere else in the app.
                  opacity:prominence,
                  onPress:()=>router.push(`/memories/${memory.id}`)
                }))
            : map.posts.map((post)=>({...post,onPress:()=>router.push(post.route)}))
        }
        heat={map.heat}
        route={route}
        onSelectBubble={handleSelectBubble}
        onOpenHeat={handleOpenHeat}
        onSelectCluster={handleSelectCluster}
        onViewportChange={handleViewportChange}
        onSelectPlace={historical ? undefined : handleSelectPlace}
        onSelectActivity={handleSelectActivity}
        onDropPin={handleDropPin}
        onUnavailable={handleUnavailable}
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

      {historical && (
        <View style={styles.timeline} pointerEvents="box-none">
          <TimeSlider
            position={positionOf(when,range)}
            label={range.empty ? "No Memories to look back through yet" : timelineLabel(when)}
            onChange={(next)=>setAt(timeAtPosition(next,range))}
            onStep={(direction)=>{
              const stepped=when+direction*WINDOW_DAYS*DAY_MS;
              setAt(Math.min(range.to,Math.max(range.from,stepped)));
            }}
          />
        </View>
      )}

      {/*
        WHAT IS HAPPENING HERE.
        Moments stay out of the bubble rotation -- there are more of them than
        everything else combined and they would drown it. The heatmap is their
        map presence, and this is how you open one.
      */}
      {!!revealed && (
        <View style={styles.reveal}>
          <View style={styles.revealHead}>
            <Text style={styles.revealTitle}>
              {revealed.moments.length
                ? `${revealed.moments.length} Moment${revealed.moments.length===1 ? "" : "s"} ${revealed.widened ? "around here" : "here"}`
                : "Nothing to open here"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close what is happening here"
              hitSlop={10}
              onPress={()=>setRevealed(null)}
            >
              <Text style={styles.revealClose}>✕</Text>
            </Pressable>
          </View>

          {!revealed.moments.length && (
            <Text style={styles.revealEmpty}>
              This area is warm from posts you cannot open — a Memory, or a review.
              Moments expire, so a busy patch can outlast them.
            </Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.revealRow}>
            {revealed.moments.map((moment)=>(
              <Pressable
                key={moment.key || moment.id}
                style={styles.revealCard}
                accessibilityRole="button"
                accessibilityLabel={`Open ${moment.title || "this Moment"}`}
                onPress={()=>router.push(moment.route)}
              >
                <Text style={styles.revealCardTitle} numberOfLines={2}>
                  {moment.title || "A Moment"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/*
        ONE PANEL FOR THE PLACE SOMEBODY TAPPED, DIRECTIONS INCLUDED.

        It used to be two things in the same corner: components/PlaceCards.js,
        a swipeable "1 of 8 nearby" sheet, and a separate Directions card, both
        pinned to bottom:12. So asking for a route put a card over the answer.

        The owner: "I don't want that place card to come up", and the directions
        should carry "the hero image, the review score and a brief summary of
        the business, all in one thing". One panel cannot cover itself.
      */}
      {!!tapped && (
        <PlacePanel
          place={tapped}
          onClose={()=>{setOpenKey(null);setRoute(null);}}
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
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  // Above the card sheet, out of the way of the search box.
  directions:{position:"absolute",left:12,right:12,bottom:12,zIndex:15},
  timeline:{position:"absolute",left:12,right:12,bottom:12,zIndex:14},
  reveal:{position:"absolute",left:12,right:12,bottom:12,zIndex:16,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:12},
  revealHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  revealTitle:{color:INK.ink,fontWeight:"900",fontSize:15},
  revealClose:{color:INK.ink,fontWeight:"900",fontSize:18},
  revealEmpty:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:8},
  revealRow:{gap:8,paddingTop:10,paddingRight:4},
  revealCard:{width:150,minHeight:56,justifyContent:"center",backgroundColor:INK.paper,borderColor:INK.ink,borderWidth:2,borderRadius:11,padding:10},
  revealCardTitle:{color:INK.ink,fontWeight:"800",fontSize:12,lineHeight:17},
  top:{position:"absolute",width:"100%",zIndex:10,padding:10},
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
