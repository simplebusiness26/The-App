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
import {INK} from "../utils/tokens";

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

export default function Directions({destination,destinationName,onRoute}){
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

  const clear=useCallback(()=>{
    abort.current?.abort?.();
    publish(null);
  },[publish]);

  const hasRoute=route?.status===ROUTE_STATUS.OK;
  const problem=route && route.status!==ROUTE_STATUS.OK ? routeMessage(route.status) : "";

  return(
    <View style={styles.card}>
      <Text style={styles.title}>Directions</Text>
      <Text style={styles.subtitle}>
        {destinationName ? `From where you are now to ${destinationName}.` : "From where you are now."}
      </Text>

      <View style={styles.modes}>
        {TRAVEL_MODES.map((entry)=>{
          const active=entry.key===mode;
          return(
            <Pressable
              key={entry.key}
              style={[styles.mode,active && styles.modeActive]}
              accessibilityRole="button"
              accessibilityState={{selected:active}}
              accessibilityLabel={`Directions by ${entry.label.toLowerCase()}`}
              disabled={working}
              onPress={()=>go(entry.key)}
            >
              <Text style={[styles.modeText,active && styles.modeTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {working && <ActivityIndicator color={INK.blue} style={styles.spinner}/>}

      {!working && hasRoute && (
        <View style={styles.result}>
          <Text style={styles.resultLine}>
            {distanceLabel(route.distanceMetres)} · about {durationLabel(route.durationSeconds)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear the route"
            style={styles.clear}
            onPress={clear}
          >
            <Text style={styles.clearText}>Clear route</Text>
          </Pressable>
        </View>
      )}

      {!working && !!problem && (
        <Text style={styles.problem} accessibilityRole="alert">{problem}</Text>
      )}

      {!working && !route && (
        <Pressable
          style={styles.primary}
          accessibilityRole="button"
          accessibilityLabel="Get directions"
          onPress={()=>go(mode)}
        >
          <Text style={styles.primaryText}>Get directions</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  card:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:14,marginTop:12},
  title:{color:INK.ink,fontWeight:"900",fontSize:16},
  subtitle:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:4},
  modes:{flexDirection:"row",gap:8,marginTop:12},
  mode:{borderColor:INK.ink,borderWidth:2,borderRadius:99,paddingHorizontal:14,paddingVertical:9,minHeight:44,justifyContent:"center",backgroundColor:INK.paper},
  modeActive:{backgroundColor:INK.ink},
  modeText:{color:INK.ink,fontWeight:"800",fontSize:13},
  modeTextActive:{color:INK.card},
  spinner:{marginTop:14},
  result:{marginTop:14},
  resultLine:{color:INK.ink,fontWeight:"900",fontSize:15},
  clear:{marginTop:10,alignSelf:"flex-start",borderColor:INK.ink,borderWidth:2,borderRadius:99,paddingHorizontal:14,paddingVertical:8,minHeight:44,justifyContent:"center",backgroundColor:INK.paper},
  clearText:{color:INK.ink,fontWeight:"800",fontSize:12},
  problem:{color:INK.ink,fontSize:13,lineHeight:19,marginTop:12},
  primary:{marginTop:14,backgroundColor:INK.blue,borderColor:INK.ink,borderWidth:2,borderRadius:99,paddingVertical:12,alignItems:"center",minHeight:44,justifyContent:"center"},
  primaryText:{color:INK.card,fontWeight:"900",fontSize:14}
});
