import React,{useCallback,useEffect,useRef,useState} from "react";
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {entityRoute} from "../utils/places";
import {INK} from "../utils/tokens";

// Watching somebody's live Moments.
//
// A Modal rather than a route, deliberately. Opening a screen would put a
// Moment in the back stack, so the system back gesture would walk you through
// somebody's last twelve hours one photo at a time, and a Moment would have a
// URL that outlives it. It is a thing you look at and dismiss.
//
// WHAT IT DOES NOT DO
//
// It does not decide who may watch. get_live_moments is security invoker and
// checks can_see_content on every row, so this component receives what the
// database already agreed to show and renders that. There is no filtering here
// to get wrong.
//
// It does not auto-advance on a timer. That is the usual behaviour and it is a
// deliberate omission for now: a timer that runs while a photo is still loading
// shows a blank frame and moves on, and getting that right needs the load state
// of each image. Tap advances, which always works. When it earns a timer it
// gets one.
//
// MARKING WATCHED
//
// mark_moment_viewed on arrival at each Moment, not on close. Somebody who
// watches three of five and closes has watched three, and the ring should say
// so.

const HOUR=1000*60*60;

function ago(value){
  const then=new Date(value).getTime();
  if(!Number.isFinite(then)) return "";
  const hours=Math.floor((Date.now()-then)/HOUR);
  if(hours<1) return "Just now";
  if(hours===1) return "1 hour ago";
  return `${hours} hours ago`;
}

function leftToRun(value){
  const until=new Date(value).getTime();
  if(!Number.isFinite(until)) return "";
  const hours=Math.round((until-Date.now())/HOUR);
  if(hours<=0) return "Gone in a moment";
  if(hours===1) return "Gone in an hour";
  if(hours<48) return `Gone in ${hours} hours`;
  return `Gone in ${Math.round(hours/24)} days`;
}

export default function StoryViewer({ownerId,ownerName,visible,onClose,isOwner=false}){
  const [moments,setMoments]=useState([]);
  const [index,setIndex]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const marked=useRef(new Set());
  const fade=useRef(new Animated.Value(0)).current;
  // Which Moments this session has kept, so the button can say so without
  // another read.
  const [kept,setKept]=useState(new Set());
  const [keeping,setKeeping]=useState(false);

  const load=useCallback(async()=>{
    if(!ownerId){setLoading(false);return;}

    setLoading(true);
    setError("");

    const {data,error:loadError}=await supabase.rpc("get_live_moments",{p_owner_id:ownerId});

    if(loadError){
      setError("These Moments could not be loaded.");
      setMoments([]);
      setLoading(false);
      return;
    }

    const rows=data || [];
    setMoments(rows);
    // Open on the first unwatched one. Somebody who has seen the first two of
    // five wants the third, not the first again.
    const firstUnseen=rows.findIndex((row)=>!row.viewed);
    setIndex(firstUnseen===-1 ? 0 : firstUnseen);
    setLoading(false);
  },[ownerId]);

  useEffect(()=>{
    if(!visible) return;
    marked.current=new Set();
    load();
  },[visible,load]);

  const current=moments[index] || null;

  // Mark on arrival, once per Moment per opening.
  useEffect(()=>{
    if(!visible || !current?.id) return;
    if(marked.current.has(current.id)) return;
    marked.current.add(current.id);
    supabase.rpc("mark_moment_viewed",{p_moment_id:current.id});
  },[visible,current?.id]);

  useEffect(()=>{
    fade.setValue(0);
    Animated.timing(fade,{toValue:1,duration:160,useNativeDriver:false}).start();
  },[index,fade]);

  function next(){
    if(index>=moments.length-1){onClose?.();return;}
    setIndex((current)=>current+1);
  }

  function previous(){
    setIndex((current)=>Math.max(0,current-1));
  }

  // Keeping it. Only the owner sees this, and the database refuses anybody
  // else -- save_moment_as_memory checks auth.uid() against the Moment.
  async function keep(){
    if(keeping || !current?.id) return;
    setKeeping(true);

    const {error:keepError}=await supabase.rpc("save_moment_as_memory",{p_moment_id:current.id});
    setKeeping(false);

    if(keepError){
      setError(keepError.message || "This Moment could not be kept.");
      return;
    }

    setKept((current_set)=>new Set(current_set).add(current.id));
  }

  const place=current?.target_type && current?.target_id
    ? entityRoute(current.target_type,current.target_id)
    : null;

  return(
    <Modal visible={!!visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.screen}>
        {/*
          One segment per Moment, filled up to where you are. It is the only
          thing telling somebody how much is left, which matters when tapping
          past the end closes the viewer.
        */}
        <View style={styles.segments}>
          {moments.map((moment,position)=>(
            <View
              key={moment.id}
              style={[styles.segment,position<=index && styles.segmentDone]}
            />
          ))}
        </View>

        <View style={styles.header}>
          <Text style={styles.owner} numberOfLines={1}>{ownerName || "Explorer"}</Text>
          {!!current && <Text style={styles.when}>{ago(current.created_at)}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={styles.close}
            onPress={onClose}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centre}><ActivityIndicator size="large" color={INK.card}/></View>
        ) : error ? (
          <View style={styles.centre}><Text style={styles.message}>{error}</Text></View>
        ) : !current ? (
          <View style={styles.centre}>
            <Text style={styles.message}>Nothing is live right now.</Text>
          </View>
        ) : (
          <Animated.View style={[styles.stage,{opacity:fade}]}>
            {current.media_type==="image" || current.thumbnail_url ? (
              <Image
                source={{uri:current.media_url || current.thumbnail_url}}
                style={styles.media}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.media,styles.videoFallback]}>
                {/*
                  No video playback here yet, and it says so rather than showing
                  a black rectangle. expo-av is not installed and adding it is
                  not this job.
                */}
                <Text style={styles.message}>This Moment is a video. Open it to watch.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open this Moment"
                  style={styles.openButton}
                  onPress={()=>{onClose?.();router.push(`/moments/${current.id}`);}}
                >
                  <Text style={styles.openButtonText}>Open the Moment</Text>
                </Pressable>
              </View>
            )}

            {/* The two tap halves sit over the photo: back on the left, on on
                the right. They are behind the caption so a link still wins. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous Moment"
              style={[styles.tapZone,styles.tapLeft]}
              onPress={previous}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next Moment"
              style={[styles.tapZone,styles.tapRight]}
              onPress={next}
            />
          </Animated.View>
        )}

        {!!current && (
          <View style={styles.footer}>
            {!!current.caption && <Text style={styles.caption}>{current.caption}</Text>}

            {!!current.target_name && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${current.target_name}`}
                disabled={!place}
                onPress={()=>{onClose?.();place && router.push(place);}}
              >
                <Text style={styles.place}>📍 {current.target_name}</Text>
              </Pressable>
            )}

            {/* A Moment expires. Saying when is the difference between this and
                a photo gallery. */}
            <Text style={styles.expiry}>{leftToRun(current.expires_at)}</Text>

            {isOwner && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  kept.has(current.id)
                    ? "Kept as a Memory"
                    : "Keep this Moment as a Memory"
                }
                disabled={keeping || kept.has(current.id)}
                style={[styles.keep,kept.has(current.id) && styles.keptOn]}
                onPress={keep}
              >
                <Text style={styles.keepText}>
                  {kept.has(current.id) ? "✓ Kept as a Memory" : "Keep this as a Memory"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.ink},
  segments:{flexDirection:"row",gap:4,paddingHorizontal:12,paddingTop:44},
  segment:{flex:1,height:3,borderRadius:2,backgroundColor:"rgba(243,243,237,0.3)"},
  segmentDone:{backgroundColor:INK.card},

  header:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,paddingVertical:12},
  owner:{color:INK.card,fontWeight:"800",fontSize:15,flexShrink:1},
  when:{color:"rgba(243,243,237,0.7)",fontSize:12,flex:1},
  close:{width:36,height:36,alignItems:"center",justifyContent:"center"},
  closeText:{color:INK.card,fontSize:18,fontWeight:"800"},

  stage:{flex:1,position:"relative"},
  media:{flex:1,width:"100%"},
  videoFallback:{alignItems:"center",justifyContent:"center",padding:24,gap:14},

  tapZone:{position:"absolute",top:0,bottom:0,width:"32%"},
  tapLeft:{left:0},
  tapRight:{right:0},

  centre:{flex:1,alignItems:"center",justifyContent:"center",padding:28},
  message:{color:INK.card,fontSize:15,textAlign:"center",lineHeight:22},

  openButton:{borderWidth:2,borderColor:INK.card,borderRadius:99,paddingHorizontal:18,paddingVertical:10},
  openButtonText:{color:INK.card,fontWeight:"800"},

  footer:{padding:16,paddingBottom:30,gap:6},
  caption:{color:INK.card,fontSize:15,lineHeight:21},
  place:{color:INK.card,fontSize:13,fontWeight:"800"},
  expiry:{color:"rgba(243,243,237,0.65)",fontSize:11,fontWeight:"700"},
  keep:{
    marginTop:8,
    alignSelf:"flex-start",
    borderWidth:2,
    borderColor:INK.card,
    borderRadius:99,
    paddingHorizontal:16,
    paddingVertical:8
  },
  keptOn:{opacity:0.6},
  keepText:{color:INK.card,fontWeight:"800",fontSize:12}
});
