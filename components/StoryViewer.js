import React,{useCallback,useEffect,useRef,useState} from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated
} from "react-native";
import {router} from "expo-router";
import SocialImage from "./SocialImage";
import {supabase} from "../services/supabase";
import {entityRoute} from "../utils/places";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Action,CornerFrame,Empty,Glyph,MONO,Notice} from "./instrument";

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
//
// WHAT IT LOOKS LIKE
//
// The viewer is the app's second viewfinder: a full `inset` well with the
// photograph in it and the same L brackets the camera draws, so watching
// somebody's Moment reads as looking down the same instrument that took it. The
// segment bar along the top is the ring from components/StoryRing.js unrolled
// flat -- one detent per Moment, lit up to where you are -- so the two surfaces
// count the same thing the same way.

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
          One detent per Moment, lit up to where you are. It is the only thing
          telling somebody how much is left, which matters when tapping past the
          end closes the viewer.
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
          {!!current && <Text style={styles.when} numberOfLines={1}>{ago(current.created_at).toUpperCase()}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={styles.close}
            onPress={onClose}
          >
            <Glyph name="close" size={16} colour={INK.readout}/>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centre}><ActivityIndicator size="large" color={INK.readoutSoft}/></View>
        ) : error ? (
          <View style={styles.centre}>
            <Notice tone="dispute" label="Not loaded">{error}</Notice>
          </View>
        ) : !current ? (
          <View style={styles.centre}>
            <Empty
              glyph="live"
              title="Nothing is live right now"
              instruction="A Moment lasts a day. When this Explorer posts one it appears here."
            />
          </View>
        ) : (
          <Animated.View style={[styles.stage,{opacity:fade}]}>
            {current.media_type==="image" || current.thumbnail_url ? (
              <>
                <SocialImage
                  uri={current.media_url || current.thumbnail_url}
                  style={styles.media}
                  resizeMode="contain"
                />
                {/* The viewfinder's own brackets. Every picture in this app sits
                    in a bracketed well; a full-bleed one gets the brackets
                    without the well. */}
                <CornerFrame inset={14} length={26} colour={INK.readoutSoft} opacity={0.4}/>
              </>
            ) : (
              <View style={[styles.media,styles.videoFallback]}>
                {/*
                  No video playback here yet, and it says so rather than showing
                  a black rectangle. expo-av is not installed and adding it is
                  not this job.
                */}
                <Empty
                  glyph="video"
                  title="This Moment is a video"
                  instruction="Open it on its own page to watch."
                  action={
                    <Action
                      kind="secondary"
                      glyph="play"
                      label="Open the Moment"
                      accessibilityLabel="Open this Moment"
                      onPress={()=>{onClose?.();router.push(`/moments/${current.id}`);}}
                    />
                  }
                />
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
                style={styles.placeRow}
                onPress={()=>{onClose?.();place && router.push(place);}}
              >
                <Glyph name="pin" size={13} colour={INK.readoutSoft}/>
                <Text style={styles.place} numberOfLines={1}>{current.target_name}</Text>
              </Pressable>
            )}

            {/* A Moment expires. Saying when is the difference between this and
                a photo gallery, so it is set as a reading rather than a caption. */}
            <View style={styles.expiryRow}>
              <Glyph name="clock" size={12} colour={INK.readoutFaint}/>
              <Text style={styles.expiry}>{leftToRun(current.expires_at)}</Text>
            </View>

            {isOwner && (
              <Action
                kind={kept.has(current.id) ? "quiet" : "secondary"}
                glyph={kept.has(current.id) ? "check" : "bookmark"}
                label={kept.has(current.id) ? "Kept as a Memory" : "Keep this as a Memory"}
                accessibilityLabel={
                  kept.has(current.id)
                    ? "Kept as a Memory"
                    : "Keep this Moment as a Memory"
                }
                disabled={keeping || kept.has(current.id)}
                style={styles.keep}
                onPress={keep}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  // The viewfinder ground, one step below the housing: a Moment is a picture
  // being looked THROUGH the instrument at, not a card sitting on it.
  screen:{flex:1,backgroundColor:INK.inset},

  segments:{flexDirection:"row",gap:4,paddingHorizontal:12,paddingTop:44},
  segment:{flex:1,height:2,backgroundColor:INK.hairline},
  segmentDone:{backgroundColor:INK.scheduled},

  header:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,paddingVertical:12},
  owner:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2,flexShrink:1},
  when:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase",flex:1
  },
  close:{
    width:34,height:34,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline
  },

  stage:{flex:1,position:"relative"},
  media:{flex:1,width:"100%"},
  videoFallback:{alignItems:"center",justifyContent:"center",padding:24},

  tapZone:{position:"absolute",top:0,bottom:0,width:"32%"},
  tapLeft:{left:0},
  tapRight:{right:0},

  centre:{flex:1,justifyContent:"center",paddingHorizontal:16},

  footer:{
    padding:16,paddingBottom:30,gap:8,
    borderTopWidth:SHAPE.border,borderTopColor:INK.hairline,backgroundColor:INK.ground
  },
  caption:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight},
  placeRow:{flexDirection:"row",alignItems:"center",gap:6},
  place:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,flexShrink:1},
  expiryRow:{flexDirection:"row",alignItems:"center",gap:6},
  expiry:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase"
  },
  keep:{alignSelf:"flex-start",marginTop:4}
});
