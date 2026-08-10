import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,Pressable,ActivityIndicator} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import MemoryPins from "./MemoryPins";
import {INK} from "../utils/tokens";
import {hasCoordinates} from "../utils/coordinates";

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
      <View style={styles.header}>
        <Text style={styles.title}>My Map</Text>
        <Text style={styles.count}>{plottable.length}</Text>
      </View>
      <Text style={styles.subtitle}>Only you can see this map.</Text>

      {loading && <ActivityIndicator color={INK.blue}/>}

      {!loading && !!error && <View style={styles.card}><Text style={styles.body}>{error}</Text></View>}

      {!loading && !error && !plottable.length && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Keep a Memory of a place you went and it will appear here on your own map.
          </Text>
          <Pressable
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Keep a Memory"
            onPress={()=>router.push("/memories/create")}
          >
            <Text style={styles.actionText}>Keep a Memory</Text>
          </Pressable>
        </View>
      )}

      {/*
        MemoryPins is platform-split. react-native-maps has no web build, so the
        import must not be reachable from a web route -- see MemoryPins.web.js.
        Importing MapView here is what took every profile on web to a blank
        screen after 8b.
      */}
      {!loading && !error && !!plottable.length && <MemoryPins memories={plottable}/>}

      {!loading && !error && !!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{marginTop:27},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:4},
  title:{color:INK.card,fontSize:23,fontWeight:"900"},
  count:{color:INK.blue,fontWeight:"900"},
  subtitle:{color:INK.inkSoft,fontSize:12,fontWeight:"700",marginBottom:11},
  card:{backgroundColor:INK.ink,borderColor:INK.inkSoft,borderWidth:1,borderRadius:14,padding:18},
  body:{color:INK.hair,lineHeight:20},
  action:{backgroundColor:INK.blue,borderRadius:11,paddingVertical:12,alignItems:"center",marginTop:13},
  actionText:{color:INK.card,fontWeight:"900"},
  note:{color:INK.inkSoft,fontSize:12,marginTop:9}
});
