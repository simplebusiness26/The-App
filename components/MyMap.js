import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ActivityIndicator} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import MemoryPins from "./MemoryPins";
import {INK,TYPE} from "../utils/tokens";
import {hasCoordinates} from "../utils/coordinates";
import {Action,Empty,Notice,SectionRule} from "./instrument";

// Packet 8b: My Map.
//
// THE PRIVACY REVIEW IS THE SPEC, so it is repeated here rather than left in the
// ledger where a later edit would never see it.
//
// The 2026-08-04 review asked what My Map exposes to other Explorers and found
// the honest answer is "nothing, provided it is never given a share control".
// Three rules follow, and all three are load-bearing:
//
//   1. It renders ONLY on your own profile. Absent for other viewers, not
//      empty -- an empty section is a thing a later change can accidentally
//      populate, and a section that was never mounted is not.
//   2. It is sourced from Memories and NEVER from live_checkins. A check-in is
//      the one thing this app promises to forget; a map of every check-in you
//      ever made is a permanent movement history assembled out of things that
//      were each promised to be temporary. `explorer_memories` exists precisely
//      so this screen does not have to do that.
//   3. It gets no `is_public` flag, no share control and no sort order.
//      `explorer_favourites` has is_public and Collections uses it; the
//      equivalent here would be a published movement history.
//
// The guard below is deliberately a SECOND lock. ExplorerProfileScreen already
// only mounts this for the owner; this component refuses anyway, the same way
// 5c's meeting point is enforced by RLS and again on the client. Either lock
// alone is enough, which is the point -- and scripts/verify-my-map.cjs fails if
// either disappears.
//
// The database is a third lock and the only one that matters to a determined
// caller: get_explorer_memories is SECURITY INVOKER, so row level security
// decides what comes back regardless of what this file asks for.

// A private Memory may legitimately have no coordinates at all, so some of what
// a person kept cannot be drawn. Saying so is better than silently showing a
// smaller map than their archive.
function unplottableNote(count){
  if(!count) return "";
  return count===1
    ? "1 Memory has no location, so it is not on the map."
    : `${count} Memories have no location, so they are not on the map.`;
}

export default function MyMap({ownerId,viewerId}){
  const [memories,setMemories]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const isOwner=!!viewerId && !!ownerId && viewerId===ownerId;

  useFocusEffect(useCallback(()=>{
    if(isOwner) load();
  },[ownerId,viewerId,isOwner]));

  async function load(){
    setLoading(true);
    setError("");

    // 'all', not 'profile'. show_on_profile decides what your profile shelf
    // shows other people; your own map is your whole archive. Row level
    // security still decides what comes back -- this only shapes the list.
    const {data,error:loadError}=await supabase.rpc("get_explorer_memories",{
      p_user_id:ownerId,
      p_scope:"all"
    });

    if(loadError){
      setError("Your map could not be loaded.");
      setMemories([]);
    }else{
      setMemories(data || []);
    }

    setLoading(false);
  }

  if(!isOwner) return null;

  const plottable=memories.filter(hasCoordinates);
  const note=unplottableNote(memories.length-plottable.length);

  return(
    <View style={styles.wrap}>
      {/* An etched rule with the reading on it, not a 23px bold heading with a
          number floating beside it. The count is what the app measured, so it
          sits on the rule in mono where every other count in this app sits. */}
      <SectionRule label="My Map" meta={String(plottable.length)}/>

      {/* A privacy control reads as a sentence about people (design-system.md,
          Copy), so this one stays in the body face rather than becoming a mono
          status line. */}
      <Text style={styles.subtitle}>Only you can see this map.</Text>

      {loading && <ActivityIndicator color={INK.readoutSoft} style={styles.waiting}/>}

      {/* An edge and a mono eyebrow, never a coloured box with the message
          fighting it. `agree` and `dispute` are a manager's two answers to a
          review and are explicitly not generic error colours. */}
      {!loading && !!error && <Notice tone="scheduled" label="NO READING">{error}</Notice>}

      {!loading && !error && !plottable.length && (
        <Empty
          glyph="camera"
          title="No Memories on your map yet"
          instruction="Take a photo of a place you went, keep it as a Memory, and it will appear here on your own map."
          action={(
            /*
              Opens the camera, not an uploader. This button used to go straight
              to /memories/create -- a second way to make a Memory that never
              went near the camera. A display surface may offer a SHORTCUT to
              the camera; it may not become a creation surface of its own.
            */
            <Action
              kind="primary"
              label="Open the camera"
              glyph="camera"
              accessibilityLabel="Open the camera"
              onPress={()=>router.push("/camera")}
            />
          )}
        />
      )}

      {/*
        One file now, no platform twin. MemoryPins draws with the app's own map
        (components/LivingMap), which is where the web/native split lives -- so
        there is no native-only import reachable from a web route, which is what
        took every profile on web to a blank screen after 8b.
      */}
      {!loading && !error && !!plottable.length && <MemoryPins memories={plottable}/>}

      {!loading && !error && !!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{marginTop:27},
  subtitle:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginBottom:12
  },
  waiting:{marginVertical:18},
  note:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:10
  }
});
