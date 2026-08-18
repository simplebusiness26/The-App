import React,{useCallback,useEffect,useMemo,useState} from "react";
import {View,Text,Pressable,ScrollView,StyleSheet} from "react-native";
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
import PinSheet,{PIN_SHEET_LEVELS} from "./PinSheet";
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
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Action,Glyph,MONO,Notice} from "./instrument";

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
  // The pin sheet's own snap point -- Peek, Half or Full. Reset to Peek every
  // time a NEW pin is tapped, so the sheet does not reopen full-height on the
  // next place just because the last one was dragged there.
  const [sheetLevel,setSheetLevel]=useState(PIN_SHEET_LEVELS.PEEK);
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
  const handleSelectPlace=useCallback((place)=>{
    setOpenKey(place.card?.key || null);
    setSheetLevel(PIN_SHEET_LEVELS.PEEK);
  },[]);

  // Closing the sheet and clearing a route are the same act from three
  // different places (the sheet's own X, its backdrop tap, and its embedded
  // panel's own close) -- one function so all three agree.
  const handleClosePlace=useCallback(()=>{
    setOpenKey(null);
    setRoute(null);
  },[]);

  // Directions live inside the sheet's own content now, same as they lived
  // inside PlacePanel before it moved there -- this is the same handler that
  // used to sit inline in the JSX below.
  const handlePlaceRoute=useCallback((model)=>{
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
  },[]);
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
              // An edge and a mono eyebrow, not a bordered box of grey text.
              <Notice tone="scheduled" label="MAP DOWN">
                The map could not load. Everything below is the same places the map
                would show. It is usually a connection problem — try again in a moment.
              </Notice>
            )}
            <Action
              kind="secondary"
              label={mapFailed ? "Try the map again" : "Show the map"}
              glyph="map"
              accessibilityLabel="Show the map instead of the list"
              style={styles.switch}
              onPress={()=>{setMapFailed("");setAsList(false);}}
            />
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
          onOpenList={()=>router.push("/places")}
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
          {/* The head strip every panel over this map opens with: what the app
              is asking about, then the etched rule. */}
          <View style={styles.headRow}>
            <Text style={styles.headKind}>DROPPED PIN</Text>
            <View style={styles.headLine}/>
          </View>
          <Text style={styles.dropTitle}>Start a Link-up here?</Text>
          <Text style={styles.dropText}>
            The spot is rounded to about a street, not the exact point you held.
          </Text>
          <View style={styles.dropRow}>
            <Action
              kind="quiet"
              label="Not here"
              accessibilityLabel="Not here"
              style={styles.dropButton}
              onPress={()=>setDropped(null)}
            />
            <Action
              kind="primary"
              label="Start a Link-up"
              glyph="plus"
              accessibilityLabel="Start a Link-up here"
              style={styles.dropButton}
              onPress={()=>{
                const at=dropped;
                setDropped(null);
                router.push(`/linkups/create?lat=${at.latitude}&lng=${at.longitude}`);
              }}
            />
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
          {/* THE HEAD READOUT. What the app counted under the finger, in mono,
              with the count on the strip where every count in this app sits.
              It used to be a bold sentence and a text cross. */}
          <View style={styles.headRow}>
            <Text style={styles.headKind}>{revealed.widened ? "AROUND HERE" : "HERE"}</Text>
            <View style={styles.headLine}/>
            <Text style={styles.headCount}>{revealed.moments.length}</Text>
            <Pressable
              style={styles.revealClose}
              accessibilityRole="button"
              accessibilityLabel="Close what is happening here"
              hitSlop={10}
              onPress={()=>setRevealed(null)}
            >
              <Glyph name="close" size={14} colour={INK.readoutSoft}/>
            </Pressable>
          </View>

          <Text style={styles.revealTitle}>
            {revealed.moments.length
              ? `${revealed.moments.length} Moment${revealed.moments.length===1 ? "" : "s"} ${revealed.widened ? "around here" : "here"}`
              : "Nothing to open here"}
          </Text>

          {!revealed.moments.length && (
            <Text style={styles.revealEmpty}>
              This area is warm from posts you cannot open — a Memory, or a review.
              Moments expire, so a busy patch can outlast them.
            </Text>
          )}

          {/* flexGrow:0 / flexShrink:0 and a centred content container: a
              horizontal ScrollView in a flex column otherwise claims the
              leftover height and stretches every card to fill it. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.revealScroll}
            contentContainerStyle={styles.revealRow}
          >
            {revealed.moments.map((moment)=>(
              <Pressable
                key={moment.key || moment.id}
                style={styles.revealCard}
                accessibilityRole="button"
                accessibilityLabel={`Open ${moment.title || "this Moment"}`}
                onPress={()=>router.push(moment.route)}
              >
                <Glyph name="camera" size={14} colour={INK.readoutFaint}/>
                <Text style={styles.revealCardTitle} numberOfLines={2}>
                  {moment.title || "A Moment"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/*
        THE PLACE SOMEBODY TAPPED, IN A REAL DRAGGABLE SHEET.

        It used to be one fixed panel, always at its full height. The locked
        UX asks for three snap points instead -- Peek, Half, Full -- with the
        map always visible behind it, which is components/PinSheet.js.

        Peek shows a one-line preview; Half and Full hand off to
        components/PlacePanel.js in its `embedded` shape, so this screen still
        does not duplicate the hero image, the review score, the summary or
        Directions -- they live in exactly one place, same as before.

        No `onOpenFullPage` is supplied: the sheet's own "view full page" button snaps
        to Full instead of leaving the map, and Full is the SAME PlacePanel
        content, only with more of the sheet to show it in. "Open profile",
        inside that content, is what leaves the map for the place's own routed
        page -- the two buttons answer different questions.
      */}
      {!!tapped && (
        <PinSheet
          item={tapped}
          level={sheetLevel}
          onLevelChange={setSheetLevel}
          onClose={handleClosePlace}
          // The sheet lights its indicator lamp in the state of the pin that
          // opened it, so the map and the sheet agree at a glance about what
          // kind of thing this is.
          tone={tapped.card?.state || tapped.state || "exists"}
          readout={tapped.card?.typeLabel || "Place"}
          renderContent={(level)=>
            level===PIN_SHEET_LEVELS.PEEK
              ? <PinPeekPreview place={tapped}/>
              : <PlacePanel place={tapped} embedded onClose={handleClosePlace} onRoute={handlePlaceRoute}/>
          }
        />
      )}
    </View>
  );
}

// A ONE-LINE GLANCE, NOT THE WHOLE PANEL.
//
// Peek is 16% of the window -- room for a name and what it is, not a hero
// image and a route. Dragging up (or the sheet's own "view full page" control)
// is what reaches the same content components/PlacePanel.js has always shown.
function PinPeekPreview({place}){
  const card=place.card || {};
  const where=card.detail || place.address || place.location || "";

  return(
    <View style={styles.peek}>
      {/* The category has moved UP into the sheet's own head readout, so Peek
          is not saying the same word twice in two type faces. What is left is
          the two things a person actually needs at a glance: what it is
          called, and where it is. */}
      <Text style={styles.peekName} numberOfLines={1}>{place.name || card.name || "This place"}</Text>
      {!!where && (
        <View style={styles.peekWhereRow}>
          {/* A drawn pin rather than the emoji that used to sit here. An emoji
              carries somebody else's colour and weight, which on a dark
              instrument face reads as a sticker stuck to the housing. */}
          <Glyph name="pin" size={13} colour={INK.readoutFaint}/>
          <Text style={styles.peekWhere} numberOfLines={1}>{where}</Text>
        </View>
      )}
    </View>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // The housing. The map is the only lit thing on this screen, which is the
  // whole point of the Field Instrument system -- so every panel that floats
  // over it stays quiet and hairline-edged, and none of them borrows a state
  // ink. Those belong to the pins.
  container:{flex:1,backgroundColor:INK.ground},
  timeline:{position:"absolute",left:12,right:12,bottom:12,zIndex:14},

  // The head strip shared by the panels that float over the map, so a dropped
  // pin, a warm patch and the sheet all open the same way.
  headRow:{flexDirection:"row",alignItems:"center",gap:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headCount:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},

  // Panels that genuinely float over the map get the soft ambient shadow; the
  // hard 3px print offset is gone with the rest of the riso system.
  reveal:{
    position:"absolute",
    left:12,
    right:12,
    bottom:12,
    zIndex:16,
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,
    padding:12,
    ...SHAPE.shadow.floating
  },
  revealClose:{
    width:30,height:30,alignItems:"center",justifyContent:"center",
    borderRadius:SHAPE.radius.control,backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  revealTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3,marginTop:10},
  revealEmpty:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:7},
  revealScroll:{flexGrow:0,flexShrink:0},
  revealRow:{alignItems:"center",gap:8,paddingTop:11,paddingRight:4},
  revealCard:{
    width:150,
    minHeight:56,
    justifyContent:"center",
    gap:6,
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:10
  },
  revealCardTitle:{color:INK.readout,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,fontWeight:"600"},

  // The controls float over the map; components/MapControls.js draws them and
  // this only positions them clear of the header.
  top:{position:"absolute",width:"100%",zIndex:10,padding:10},

  dropCard:{
    position:"absolute",
    left:14,
    right:14,
    bottom:96,
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,
    padding:16,
    zIndex:30,
    ...SHAPE.shadow.floating
  },
  dropTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3,marginTop:11},
  dropText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:6},
  dropRow:{flexDirection:"row",gap:10,marginTop:14},
  dropButton:{flex:1},

  switch:{alignSelf:"flex-start",paddingHorizontal:16,marginBottom:10},

  peek:{paddingTop:2},
  peekName:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},
  peekWhereRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:7},
  peekWhere:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,flexShrink:1}
});
