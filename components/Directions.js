import React,{useCallback,useEffect,useRef,useState} from "react";
import {View,Text,Pressable,ActivityIndicator,StyleSheet} from "react-native";
import * as Location from "expo-location";
import {
  requestRoute,
  TRAVEL_MODES,
  DEFAULT_TRAVEL_MODE,
  ROUTE_STATUS,
  routeMessage,
  distanceLabel,
  durationLabel
} from "../utils/routing";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Action,MONO,Notice,Panel,Readout} from "./instrument";

// Directions, once, for anything on the map with coordinates.
//
// An entity screen passes a destination and a name. It does not know what a
// routing provider is, it does not ask for a location permission, and it does
// not decode a polyline -- all of that is here and in utils/routing/, so adding
// Directions to a new kind of place is one component and no new logic.
//
// WHERE THE ORIGIN GOES
// Nowhere. It is read from the device when somebody asks for directions, held
// in state while the route is on screen, handed to the routing call, and
// dropped when this unmounts. It is not written to any table, any storage, or
// any log, and it is not sent anywhere except the routing request itself. The
// only thing that ever sees it is the routing provider, and only for as long as
// it takes to answer.
//
// WHAT HAPPENS WHEN IT DOES NOT WORK
// Nothing breaks. A refused permission, a missing fix, a destination with no
// coordinates and a dead provider are four different messages, each saying what
// happened and what can be done instead. None of them is an exception, and none
// of them stops the map or the screen underneath from working -- see the note
// in utils/routing/index.js about failure being a value.

// `startSignal` is a counter a CALLER increments to ask for the route without
// pressing this panel's own button -- the map sheet's quick-action row does it,
// so "Directions" one tap from a pin is the same request as "Get directions"
// further down the same panel rather than a second implementation of it. A
// number rather than a boolean, so asking twice in a row is two requests.
export default function Directions({destination,destinationName,onRoute,startSignal=0}){
  const [mode,setMode]=useState(DEFAULT_TRAVEL_MODE);
  const [route,setRoute]=useState(null);
  const [working,setWorking]=useState(false);

  const abort=useRef(null);
  const alive=useRef(true);

  useEffect(()=>()=>{
    alive.current=false;
    abort.current?.abort?.();
  },[]);

  const publish=useCallback((next)=>{
    setRoute(next);
    // The map draws it. Handing up the whole model rather than a line means the
    // caller can show the distance, the time and eventually the manoeuvres from
    // the same object.
    onRoute?.(next && next.status===ROUTE_STATUS.OK ? next : null);
  },[onRoute]);

  const go=useCallback(async(nextMode)=>{
    const chosen=nextMode || mode;
    setMode(chosen);
    setWorking(true);

    // A second press replaces the first rather than racing it.
    abort.current?.abort?.();
    const controller=typeof AbortController==="function" ? new AbortController() : null;
    abort.current=controller;

    let origin=null;

    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission?.status==="granted"){
        const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
        origin={latitude:position?.coords?.latitude,longitude:position?.coords?.longitude};
      }
    }catch{
      // Refused, unavailable, or the fix never arrived. requestRoute answers
      // NO_LOCATION for all three, which is the message somebody needs.
      origin=null;
    }

    const answer=await requestRoute({
      origin,
      destination,
      mode:chosen,
      signal:controller?.signal
    });

    if(!alive.current) return;

    setWorking(false);
    publish(answer);
  },[mode,destination,publish]);

  // Asked for from outside. Deliberately skips the first render: mounting a
  // place panel must not fire a location prompt nobody asked for.
  const asked=useRef(startSignal);

  useEffect(()=>{
    if(startSignal===asked.current) return;
    asked.current=startSignal;
    go(mode);
  },[startSignal,go,mode]);

  const clear=useCallback(()=>{
    abort.current?.abort?.();
    publish(null);
  },[publish]);

  const hasRoute=route?.status===ROUTE_STATUS.OK;
  const problem=route && route.status!==ROUTE_STATUS.OK ? routeMessage(route.status) : "";

  return(
    <Panel style={styles.card}>
      {/* THE HEAD READOUT. The same mono strip every panel in this app opens
          with: what this instrument is measuring, and which mode it is set to.
          The old version was a bold heading and a grey sentence -- a document's
          shape, on a control. */}
      <View style={styles.headRow}>
        <Text style={styles.headKind}>ROUTE</Text>
        <View style={styles.headLine}/>
        <Text style={styles.headMode}>{String(mode).toUpperCase()}</Text>
      </View>

      <Text style={styles.subtitle}>
        {destinationName ? `From where you are now to ${destinationName}.` : "From where you are now."}
      </Text>

      {/*
        THE MODE SELECTOR IS A DETENTED SWITCH, NOT THREE FILLED PILLS.
        Picking walking over driving is not a state a place is in, so it never
        fills with a state ink -- design-system.md is explicit about that, and
        the old active pill filled with the compatibility alias that is now the
        near-white readout colour, so the chosen mode was the brightest thing on
        the panel. Selection is a surface step, a stronger edge and a brighter
        label.

        Not <Segmented/>: each detent here also FIRES the request, and carries
        its own accessibilityLabel and disabled state while one is in flight,
        which the kit's own selector does not model.
      */}
      <View style={styles.modes}>
        {TRAVEL_MODES.map((entry)=>{
          const active=entry.key===mode;
          return(
            <Pressable
              key={entry.key}
              style={[styles.mode,active && styles.modeActive]}
              accessibilityRole="button"
              accessibilityState={{selected:active,disabled:!!working}}
              accessibilityLabel={`Directions by ${entry.label.toLowerCase()}`}
              disabled={working}
              onPress={()=>go(entry.key)}
            >
              <Text style={[styles.modeText,active && styles.modeTextActive]}>{entry.label}</Text>
              <View style={[styles.modeDetent,active && styles.modeDetentActive]}/>
            </Pressable>
          );
        })}
      </View>

      {working && <ActivityIndicator color={INK.readoutSoft} style={styles.spinner}/>}

      {/* THE ANSWER IS TWO MEASUREMENTS, SO IT IS TWO READOUTS.
          It used to be one bold sentence with a middle dot in it. A distance
          and a duration are different quantities and an instrument shows them
          on separate dials with their own labels. */}
      {!working && hasRoute && (
        <View style={styles.result}>
          <View style={styles.resultRow}>
            <Readout label="DISTANCE" value={distanceLabel(route.distanceMetres)} size="sm"/>
            <View style={styles.resultDivider}/>
            <Readout label="ABOUT" value={durationLabel(route.durationSeconds)} size="sm"/>
          </View>
          <Action
            kind="quiet"
            label="Clear route"
            glyph="close"
            accessibilityLabel="Clear the route"
            style={styles.clear}
            onPress={clear}
          />
        </View>
      )}

      {/* A refused permission, a missing fix or a dead provider is something
          the app needs to SAY, so it is an edge and a mono eyebrow rather than
          a grey paragraph indistinguishable from the help text above it. */}
      {!working && !!problem && (
        <View accessibilityRole="alert" style={styles.problem}>
          <Notice tone="scheduled" label="NO ROUTE">{problem}</Notice>
        </View>
      )}

      {!working && !route && (
        <Action
          kind="primary"
          label="Get directions"
          glyph="map"
          accessibilityLabel="Get directions"
          style={styles.primary}
          onPress={()=>go(mode)}
        />
      )}
    </Panel>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  card:{padding:14,marginTop:12},

  headRow:{flexDirection:"row",alignItems:"center",gap:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headMode:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  subtitle:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:9},

  modes:{flexDirection:"row",gap:8,marginTop:13},
  mode:{
    flex:1,minHeight:SHAPE.tapTarget,justifyContent:"center",alignItems:"center",gap:7,
    paddingHorizontal:10,paddingTop:8,paddingBottom:7,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control
  },
  modeActive:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  modeText:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  modeTextActive:{color:INK.readout},
  modeDetent:{height:2,alignSelf:"stretch",backgroundColor:INK.hairline},
  modeDetentActive:{backgroundColor:INK.hairlineStrong},

  spinner:{marginTop:14},

  result:{marginTop:14},
  resultRow:{
    flexDirection:"row",alignItems:"center",gap:14,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,paddingHorizontal:13,paddingVertical:11
  },
  resultDivider:{width:1,alignSelf:"stretch",backgroundColor:INK.hairline},
  clear:{marginTop:10,alignSelf:"flex-start",paddingHorizontal:14},

  problem:{marginTop:13},
  primary:{marginTop:14}
});
