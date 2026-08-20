import React,{useCallback,useEffect,useRef,useState} from "react";
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform
} from "react-native";
import {CameraView,useCameraPermissions,useMicrophonePermissions} from "expo-camera";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../services/supabase";
import {extractQrCode} from "../utils/qr";
import {mediaKindFromUri} from "../utils/socialMedia";
import {createShutter,MAX_RECORDING_SECONDS} from "../utils/shutter";
import {
  defaultCapturePreferences,
  keepACopy,
  loadCapturePreferences
} from "../utils/capturePreferences";
import {SafeAreaInsetsContext} from "react-native-safe-area-context";
import {useHeaderClearance} from "./Header";
import {TAB_BAR_HEIGHT} from "./TabBar";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {
  Aperture,
  Chip,
  CornerFrame,
  Dial,
  Glyph,
  MONO,
  MONO_MEDIUM,
  ProgressRing,
  Readout,
  Reticle,
  SectionRule,
  Toggle
} from "./instrument";

// The camera. One viewfinder, three outcomes.
//
// EXTRACTED from app/camera.js so the exact same viewfinder can be the Create
// hub's default surface (components/CreateHub.js) AND the standalone /camera
// route -- one implementation, so pressing the shutter cannot behave
// differently depending on which door you came in through.
//
// WHY QR SCANNING IS NOT A MODE
//
// It is always on. A QR code is unambiguous: nothing else looks like one, and
// nobody points a phone at a Xplorer code by accident. Making it a mode would
// mean guessing wrong half the time -- you would hold the camera up to a code
// and have to notice you were in the wrong mode first. So the viewfinder simply
// recognises a code if one is in front of it, and takes a photo if you press
// the button.
//
// PRESS FOR A PHOTO, HOLD TO RECORD
//
// One button, and exactly one of the two things happens per press -- a hold
// that also took a photo would leave a stray picture behind every recording.
// The timing rule is utils/shutter.js, where it can be tested without a
// viewfinder, a permission prompt or a device.
//
// WHY THE PHOTO IS HANDED OVER RATHER THAN UPLOADED HERE
//
// A Moment and a Memory each have a screen that already knows how to upload,
// choose an audience, attach a place and say what the rules are. Re-implementing
// any of that here would give two answers to the same question. This screen
// takes the picture and hands the file to whichever of them you chose.
//
// HOW NAVIGATION IS PLUGGED IN
//
// `onNavigate(url)`, when supplied, is called instead of `router.push(url)`.
// The /camera route leaves it undefined, so router.push runs exactly as
// before. The Create hub passes a function that closes its own overlay first
// -- otherwise the hub's chrome would sit on top of the screen this view is
// trying to hand off to.
//
// `onBranch(branch)`, when supplied, is offered every capture-hub branch tap
// first and may claim it by returning true. Only the Review branch is ever
// claimed: the hub draws the composer inside itself, and there is no generic
// /reviews route to send anybody to.
//
// `presetTargetType`/`presetTargetId`, when supplied, override the
// `target_type`/`target_id` URL params app/places/[id].js and similar pages
// already push onto /camera for a "post a Moment here" launch. The Create
// hub never supplies them -- it is reachable from any screen, not contingent
// on one, so it has no place to attach by construction.

// ---------------------------------------------------------------------------
// THE CAPTURE HUB'S FIVE BRANCHES
// ---------------------------------------------------------------------------
// The locked spec: "the 5 capture-hub branch chips below the viewfinder
// (Moment/Memory/Check-in/Scan/Review) - all one tap away, always visible".
//
// It was three chips, at the TOP of the screen, drawn by components/
// CreateHub.js -- so two of the five were unreachable in one tap and the row
// sat over the viewfinder rather than under it. One exported list now, read by
// this file and by the hub, because a second copy is how a branch starts
// existing on one surface and not the other.
//
// Moment and Memory route to the screens that make one. Those screens bounce
// back here when they are opened with nothing attached, which is the honest
// behaviour for "capture first, decide after" -- the chip is a way IN to the
// branch, not a claim that a Moment can exist without a picture.
// `glyph` and `primary` are the artifact's, not decoration: .branch-chip draws
// a 52px bordered disc with a mark in it and its label underneath, and
// .branch-chip.primary fills that disc with ink -- one branch is the obvious
// one and the other four are beside it.
export const CAPTURE_BRANCHES=[
  {key:"moment",label:"Moment",route:"/moments/create",spoken:"Post a Moment",glyph:"camera",primary:true},
  {key:"memory",label:"Memory",route:"/memories/create",spoken:"Keep a Memory",glyph:"bookmark"},
  {key:"checkin",label:"Check in",route:"/checkins/create",spoken:"Check in somewhere",glyph:"pin"},
  {key:"scan",label:"Scan",route:"/scan",spoken:"Scan or type a code",glyph:"scan"},
  {key:"review",label:"Review",view:"review",spoken:"Write a review",glyph:"star"}
];

// ---------------------------------------------------------------------------
// FLASH
// ---------------------------------------------------------------------------
// expo-camera's `flash` prop takes 'off' | 'auto' | 'on' (and 'screen', which
// is a front-camera-only trick and not a stop on this cycle). One chip cycles
// them in that order, which is the order every phone camera uses.
export const FLASH_CYCLE=["off","auto","on"];

// THE GLASS THE VIEWFINDER'S CHROME IS DRAWN ON.
//
// The artifact tints its viewfinder chrome with the PAPER colour at low alpha
// rather than with a dark -- rgba(231,232,225,.14) fills, rgba(231,232,225,.4)
// and .35 edges -- so a control over the picture reads as frosted paper laid on
// it, the same trick the pins use over the map. Named here because six styles
// below need the same two values and a fourth spelling of them is how they
// drift apart.
// @contrast-backdrop INK.ink
//   -- what these tints are drawn over. The artifact's .viewfinder is
//   background:var(--ink), and a live camera feed is darker still more often
//   than not, so ink is the honest and the conservative reading.
const VF_GLASS="rgba(231,232,225,0.14)";
const VF_GLASS_EDGE="rgba(231,232,225,0.4)";

const FLASH_LABEL={off:"FLASH OFF",auto:"FLASH AUTO",on:"FLASH ON"};
const FLASH_SPOKEN={off:"off",auto:"automatic",on:"on"};

function nextFlash(mode){
  return FLASH_CYCLE[(FLASH_CYCLE.indexOf(mode)+1)%FLASH_CYCLE.length];
}

// ---------------------------------------------------------------------------
// ZOOM
// ---------------------------------------------------------------------------
// The four presets the spec names, and the finer detents the tray's dial adds
// between them.
export const ZOOM_STOPS=[0.5,1,2,3];
export const ZOOM_DIAL_STOPS=[0.5,1,1.5,2,2.5,3];

// expo-camera's `zoom` is "a value between 0 and 1 being a percentage of the
// device's max zoom" -- NOT a magnification factor. So the face speaks in the
// stops a person recognises and this table is the only place that maps them.
//
// 0.5x AND 1x BOTH MAP TO 0, AND THAT IS THE HONEST ANSWER.
//
// zoom:0 is the widest field of view the current camera session can give. There
// is no way to ask expo-camera 57 for a wider one on Android -- it exposes no
// lens picker -- so on a phone whose session already runs on the ultra-wide,
// 0.5x is what zoom:0 looks like, and on a phone without one it is 1x and the
// two stops show the same picture. On iOS there IS a documented way to do
// better: `selectedLens`, fed by the lens names onAvailableLensesChanged
// reports, so 0.5x asks for the ultra-wide lens by name when the device has
// one. See lensFor() below.
//
// The 2x and 3x values are a calibration, not a measurement: "a percentage of
// max zoom" means the same fraction is a different factor on every phone.
const ZOOM_TO_PROP={0.5:0,1:0,2:0.25,3:0.45};

// Anything between two anchors is interpolated, so the tray's half stops move
// the camera rather than only the readout.
export function zoomPropFor(factor){
  const anchors=Object.keys(ZOOM_TO_PROP).map(Number).sort((a,b)=>a-b);
  if(factor<=anchors[0]) return ZOOM_TO_PROP[anchors[0]];
  if(factor>=anchors[anchors.length-1]) return ZOOM_TO_PROP[anchors[anchors.length-1]];

  for(let i=0;i<anchors.length-1;i++){
    const low=anchors[i];
    const high=anchors[i+1];
    if(factor>=low && factor<=high){
      const span=high-low;
      const along=span===0 ? 0 : (factor-low)/span;
      return ZOOM_TO_PROP[low]+(ZOOM_TO_PROP[high]-ZOOM_TO_PROP[low])*along;
    }
  }
  return 0;
}

// iOS reports its physical lenses through onAvailableLensesChanged; the
// ultra-wide is the only one worth asking for by name, and only for 0.5x.
// Android reports nothing here and gets undefined, which leaves expo-camera on
// the device's default lens.
export function lensFor(factor,lenses){
  if(factor>=1 || !Array.isArray(lenses)) return undefined;
  return lenses.find((lens)=>/ultrawide/i.test(String(lens)));
}

// ---------------------------------------------------------------------------
// THE QR FLAG
// ---------------------------------------------------------------------------
// Long enough to be seen and read, short enough that nobody waits for it. The
// screen used to navigate the instant a code resolved, so the only evidence the
// camera had seen anything was the page you suddenly found yourself on.
export const QR_FLAG_DWELL_MS=900;

// A first guess only. The tray measures its own contents on layout and animates
// to THAT -- a hard-coded height clipped the silent-record toggle clean off the
// bottom, which is exactly the class of bug a screenshot finds and a passing
// test does not.
const TRAY_HEIGHT_GUESS=300;

export default function CameraCapture({onNavigate,onBranch,overlay,presetTargetType,presetTargetId}){
  // The header floats over the viewfinder now rather than sitting above it, so
  // the hint clears the floating chips instead of starting at the top edge.
  const clearHeader=useHeaderClearance();
  // WHAT IS UNDERNEATH THE CONSOLE.
  //
  // components/TabBar.js floats over every route -- it is a later sibling of
  // the Stack in app/_layout.js, not a container around it -- so on the
  // standalone /camera route the bottom 62px plus the home indicator belong to
  // the tab bar, and a shutter drawn at the bottom edge is a shutter nobody can
  // press. In the Create hub there is no bar to clear: the hub is a full-screen
  // Modal drawn above it. Same context read Header.js uses, so this works with
  // or without a SafeAreaProvider above it.
  const insets=React.useContext(SafeAreaInsetsContext);
  const bottomClearance=(insets?.bottom || 0)+(overlay ? 0 : TAB_BAR_HEIGHT);
  const params=useLocalSearchParams();
  const [permission,requestPermission]=useCameraPermissions();
  // Sound, as agreed with the owner: a silent video of a gig or a busy pub
  // loses most of the point. It is asked for when somebody first holds the
  // button, not on arrival -- a microphone prompt for a screen you opened to
  // take a photograph is the kind of thing that gets an app deleted.
  const [microphone,requestMicrophone]=useMicrophonePermissions();
  const cameraRef=useRef(null);

  const [facing,setFacing]=useState("back");

  // ---------------------------------------------------------------------------
  // APERTURE CONSOLE STATE
  // ---------------------------------------------------------------------------
  // The design system's camera is an instrument face, so the controls it draws
  // have to be backed by real camera capability -- never painted on. Every one
  // of these maps onto a documented expo-camera prop: `flash`, `zoom`,
  // `autofocus`, `videoStabilizationMode`, `mute`, `videoQuality`, `mode`, and
  // the recording ceiling in utils/shutter.js.
  const [flash,setFlash]=useState("off");
  const [zoom,setZoom]=useState(1);
  const [lenses,setLenses]=useState(null);

  // THE PRECISION TRAY. Shut, it is one small chevron; open, it is the four
  // controls an expert reaches for and nobody else needs to see.
  const [trayOpen,setTrayOpen]=useState(false);
  const [focusLock,setFocusLock]=useState(false);
  // expo-camera's own default for videoStabilizationMode is 'auto', so this
  // starts on and turning it OFF is the change -- the toggle never claims to
  // have switched something on that was already running.
  const [stabilised,setStabilised]=useState(true);
  // Sound stays ON by default: that is the owner's decision, recorded above and
  // still the default. This is the override for the times a recording should be
  // silent, not a reversal of it.
  const [silent,setSilent]=useState(false);

  // Capture defaults, from Account & Safety. The viewfinder reads them; it does
  // not ask about them.
  const [preferences,setPreferences]=useState(defaultCapturePreferences);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const {data}=await supabase.auth.getUser();
        const loaded=await loadCapturePreferences(data?.user?.id);
        if(alive) setPreferences(loaded);
      }catch{
        // Defaults already stand. A camera must open whether or not a
        // preferences read succeeded.
      }
    })();
    return()=>{alive=false;};
  },[]);

  // The tray slides. AccessibilityInfo decides whether it slides or simply is:
  // the same rule the kit's Lamp follows, and the same reason -- motion is
  // information here, not decoration, so reduce-motion removes the travel
  // rather than the tray.
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on)=>{if(alive) setReducedMotion(!!on);})
      .catch(()=>{});
    return()=>{alive=false;};
  },[]);

  const trayLift=useRef(new Animated.Value(0)).current;
  const [trayHeight,setTrayHeight]=useState(TRAY_HEIGHT_GUESS);
  // Where the tray already is. Without this the effect runs an animation to 0
  // on mount -- a state update nothing asked for, on every screen that draws a
  // camera -- and re-runs it every time the reduce-motion answer arrives.
  const trayAt=useRef(0);
  useEffect(()=>{
    const target=trayOpen ? 1 : 0;
    if(trayAt.current===target) return;
    trayAt.current=target;

    Animated.timing(trayLift,{
      toValue:target,
      duration:reducedMotion ? 0 : 180,
      // Height and translate together: a tray that only faded would leave the
      // console jumping to its new height in one frame.
      useNativeDriver:false
    }).start();
  },[trayOpen,reducedMotion,trayLift]);

  // FOCUS RETICLE. Where the last tap landed, in screen coordinates, so the
  // brackets can be drawn there and faded out again.
  const [focusPoint,setFocusPoint]=useState(null);
  const focusTimer=useRef(null);
  const showFocus=useCallback((x,y)=>{
    setFocusPoint({x,y});
    clearTimeout(focusTimer.current);
    focusTimer.current=setTimeout(()=>setFocusPoint(null),1100);
  },[]);
  useEffect(()=>()=>clearTimeout(focusTimer.current),[]);

  // HOLD PROGRESS. The old shutter gave no answer to "how long have I got?".
  // This drives the ring around it, keyed to the real recording ceiling.
  const [holdProgress,setHoldProgress]=useState(0);
  const holdTimer=useRef(null);
  const startHoldClock=useCallback(()=>{
    const startedAt=Date.now();
    clearInterval(holdTimer.current);
    holdTimer.current=setInterval(()=>{
      const elapsed=(Date.now()-startedAt)/1000;
      setHoldProgress(Math.min(1,elapsed/MAX_RECORDING_SECONDS));
    },80);
  },[]);
  const stopHoldClock=useCallback(()=>{
    clearInterval(holdTimer.current);
    setHoldProgress(0);
  },[]);
  useEffect(()=>()=>clearInterval(holdTimer.current),[]);
  const [photo,setPhoto]=useState(null);
  const [taking,setTaking]=useState(false);
  const [error,setError]=useState("");
  // "picture" or "video". CameraView has to be reconfigured before it will
  // record, and that is a re-render -- so holding the button asks for video
  // mode and the effect below starts the recording once the mode has actually
  // taken. Calling recordAsync in the same tick as the mode change is how this
  // fails on a real Android device.
  const [mode,setMode]=useState("picture");
  const [wantsToRecord,setWantsToRecord]=useState(false);
  const [recording,setRecording]=useState(false);
  // Once a code has been read, stop reading. Without this the same code fires
  // the handler on every frame and pushes the same screen dozens of times.
  const [handledCode,setHandledCode]=useState(false);
  // What the camera saw, shown in the viewfinder before anything navigates.
  const [detectedCode,setDetectedCode]=useState("");
  const codeTimer=useRef(null);
  useEffect(()=>()=>clearTimeout(codeTimer.current),[]);

  // The Review branch has no route of its own. In the Create hub it is a view
  // the hub swaps in (so its own chrome stays right); on the standalone
  // /camera route nothing else can draw it, so this does.
  const [composer,setComposer]=useState(false);

  // Coming back to this screen -- from the code it just scanned, or from the
  // Moment it just started -- has to give a live camera again, not the frozen
  // frame from last time. Only relevant when this is mounted as the routed
  // screen; the Create hub unmounts it outright on close, which resets the
  // same state for free.
  useFocusEffect(useCallback(()=>{
    setHandledCode(false);
    setDetectedCode("");
    clearTimeout(codeTimer.current);
    setPhoto(null);
    setError("");
    setMode("picture");
    setWantsToRecord(false);
    setRecording(false);
  },[]));

  function navigate(url){
    if(onNavigate){onNavigate(url);return;}
    router.push(url);
  }

  function openBranch(branch){
    // The hub gets first refusal, because Review is drawn inside it.
    if(onBranch && onBranch(branch)) return;
    if(branch.route){navigate(branch.route);return;}
    setComposer(true);
  }

  function onBarcode({data}){
    if(handledCode || photo) return;

    const code=extractQrCode(data);
    if(!code) return;   // Not one of ours. Say nothing and keep looking.

    // The flag first, the navigation after. A screen that changes under you
    // with no explanation is the camera keeping to itself what it just read.
    setHandledCode(true);
    setDetectedCode(code);
    clearTimeout(codeTimer.current);
    codeTimer.current=setTimeout(()=>{
      navigate(`/qr/${encodeURIComponent(code)}`);
    },QR_FLAG_DWELL_MS);
  }

  // A capture lands in the cache directory, which the OS may sweep. Account &
  // Safety > Capture defaults decides whether a copy is kept somewhere it will
  // not be. A failed copy is reported and never loses the capture.
  async function keepIfAsked(uri){
    const {error:copyError}=await keepACopy(uri,preferences);
    if(copyError) setError(copyError);
  }

  async function takePhoto(){
    if(taking || !cameraRef.current) return;

    setTaking(true);
    setError("");

    try{
      const taken=await cameraRef.current.takePictureAsync({quality:0.8});
      if(!taken?.uri) throw new Error("The camera returned no picture.");
      setPhoto(taken);
      await keepIfAsked(taken.uri);
    }catch(cameraError){
      setError(cameraError.message || "The photo could not be taken.");
    }

    setTaking(false);
  }

  // Press for a photo, hold to record. utils/shutter.js owns the timing so it
  // can be tested; this only says what each outcome does. The handlers are
  // called through a ref rather than captured, so the recogniser is built once
  // and still calls the current version of each.
  const shutter=useRef(null);
  const actions=useRef({});
  actions.current={takePhoto,startRecording,stopRecording};

  if(!shutter.current){
    shutter.current=createShutter({
      onPhoto:()=>actions.current.takePhoto(),
      onRecord:()=>actions.current.startRecording(),
      onStop:()=>actions.current.stopRecording()
    });
  }

  // A timer that fires after this screen has gone starts a recording nothing
  // will ever stop.
  useEffect(()=>()=>{shutter.current?.cancel();},[]);

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  // The mode has to be applied to CameraView before recordAsync will work, and
  // applying it is a re-render. So holding the button sets the intention and
  // this starts the recording once the camera is actually in video mode.
  //
  // THE RE-ENTRY GUARD IS A REF, NOT THE `recording` STATE, AND THAT MATTERS.
  //
  // With `recording` in the dependency list, setRecording(true) re-ran this
  // effect, whose cleanup then cancelled the recording it had just started --
  // so the clip resolved into a callback that had already decided to ignore it
  // and nothing ever reached the tray. A ref changes without re-running
  // anything, which is exactly what a guard should do.
  const recordingRef=useRef(false);

  useEffect(()=>{
    if(!wantsToRecord || mode!=="video" || recordingRef.current || !cameraRef.current) return;

    let alive=true;
    recordingRef.current=true;
    setRecording(true);
    setError("");

    cameraRef.current
      .recordAsync({maxDuration:MAX_RECORDING_SECONDS})
      .then((taken)=>{
        // recordAsync resolves when stopRecording is called OR when maxDuration
        // is reached -- the same promise for both, which is why the button does
        // not decide what happens next.
        if(alive && taken?.uri){
          setPhoto(taken);
          keepIfAsked(taken.uri);
        }
      })
      .catch((recordError)=>{
        if(alive) setError(recordError?.message || "The video could not be recorded.");
      })
      .finally(()=>{
        recordingRef.current=false;
        if(!alive) return;
        setRecording(false);
        setWantsToRecord(false);
        setMode("picture");
        shutter.current.finished();
      });

    // Only on unmount. This effect's own state changes must not tear down a
    // recording that is still running.
    return()=>{alive=false;};
  },[wantsToRecord,mode]);

  async function startRecording(){
    if(taking || photo) return;

    // Asked here, not on arrival: a microphone prompt for a screen you opened
    // to take a photograph is the kind of thing that gets an app deleted. A
    // refusal is not fatal -- expo-camera records without sound, and saying so
    // beats a recording that silently has none.
    //
    // And not asked at all when the silent-record toggle is on: there is no
    // honest reason to ask for a microphone the recording will not use.
    if(!silent && microphone && !microphone.granted){
      const answer=await requestMicrophone();
      if(!answer?.granted) setError("Recording without sound — microphone access was not given.");
    }

    setWantsToRecord(true);
    setMode("video");
  }

  function stopRecording(){
    if(!recordingRef.current) return;
    cameraRef.current?.stopRecording?.();
  }

  // The two screens both read `photo` and start with it already chosen.
  //
  // Anything the camera was OPENED with travels through to them. A place page
  // says "post a Moment here" and routes via the camera, so the place it
  // meant has to survive the round trip -- otherwise camera-only creation would
  // have quietly cost every Moment its place.
  function use(destination){
    if(!photo?.uri) return;

    const targetType=presetTargetType!==undefined
      ? presetTargetType
      : (Array.isArray(params.target_type) ? params.target_type[0] : params.target_type);
    const targetId=presetTargetId!==undefined
      ? presetTargetId
      : (Array.isArray(params.target_id) ? params.target_id[0] : params.target_id);

    const carried=[["target_type",targetType],["target_id",targetId]]
      .map(([key,value])=>value ? `&${key}=${encodeURIComponent(value)}` : "")
      .join("");

    navigate(`${destination}?photo=${encodeURIComponent(photo.uri)}${carried}`);
  }

  if(composer){
    // Only reachable on the standalone /camera route: the Create hub claims the
    // Review branch itself through onBranch, because it has its own chrome to
    // put around the composer. Required here rather than at the top of the file
    // so the hub's own import stays the only one in the common path.
    // eslint-disable-next-line global-require
    const ReviewComposer=require("./ReviewComposer").default;
    return <ReviewComposer onNavigate={navigate} onClose={()=>setComposer(false)}/>;
  }

  if(!permission){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.readout}/></View>;
  }

  if(!permission.granted){
    return(
      <View style={styles.centre}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access is needed</Text>
          <Text style={styles.permissionText}>
            Xplorer uses the camera to take a Moment or a Memory, and to recognise
            a Xplorer QR code when one is in front of it. Nothing is recorded or
            sent anywhere until you choose to post it.
          </Text>
          <Pressable
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Allow camera access"
            onPress={requestPermission}
          >
            <Text style={styles.primaryText}>Allow camera access</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Enter a QR code by hand instead"
            onPress={()=>navigate("/scan")}
          >
            <Text style={styles.secondaryText}>Type a code instead</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // After the shutter: what is this picture for?
  // ---------------------------------------------------------------------------
  if(photo){
    // A recording has no still to show and this screen has no player: the two
    // creation screens do. Saying what is being carried beats an Image that
    // silently renders nothing, which is what a video URI in an <Image> does.
    const isVideo=mediaKindFromUri(photo.uri)==="video";

    return(
      <View style={styles.screen}>
        {isVideo
          ? (
            <View style={[styles.preview,styles.videoPreview]}>
              <Text style={styles.videoPreviewText}>Video recorded</Text>
            </View>
          )
          : <Image source={{uri:photo.uri}} style={styles.preview} resizeMode="cover"/>}

        <View style={styles.tray}>
          <Text style={styles.trayTitle}>What is this?</Text>

          <Pressable
            style={styles.choice}
            accessibilityRole="button"
            accessibilityLabel="Post this as a Moment"
            onPress={()=>use("/moments/create")}
          >
            <Text style={styles.choiceTitle}>A Moment</Text>
            <Text style={styles.choiceText}>Happening now. It is live for 24 hours, then it goes.</Text>
          </Pressable>

          <Pressable
            style={styles.choice}
            accessibilityRole="button"
            accessibilityLabel="Keep this as a Memory"
            onPress={()=>use("/memories/create")}
          >
            <Text style={styles.choiceTitle}>A Memory</Text>
            <Text style={styles.choiceText}>Somewhere you have been. It is kept.</Text>
          </Pressable>

          <Pressable
            style={styles.retake}
            accessibilityRole="button"
            accessibilityLabel={isVideo ? "Record it again" : "Take it again"}
            onPress={()=>setPhoto(null)}
          >
            <Text style={styles.retakeText}>{isVideo ? "Record it again" : "Take it again"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // The viewfinder
  // ---------------------------------------------------------------------------
  const trayOpening=trayLift.interpolate({inputRange:[0,1],outputRange:[0,trayHeight]});
  const trayShift=trayLift.interpolate({inputRange:[0,1],outputRange:[trayHeight/3,0]});
  // expo-camera's video-only controls are native capture settings. The web
  // implementation has no recorder at all, so they are disabled there and say
  // why rather than pretending to hold a setting nothing will read.
  const nativeOnly=Platform.OS==="ios" || Platform.OS==="android";

  return(
    <View style={styles.screen}>
      {/*
        THE VIEWFINDER, AND THEN THE CONSOLE UNDER IT.

        The feed used to be the whole screen with every control floating on top
        of it, which is how the capture-hub branches ended up drawn over the
        picture at the top of the screen. The spec puts them BELOW the
        viewfinder, so the viewfinder now ends where the console starts and the
        console is a real row in the column rather than an overlay.
      */}
      <View style={styles.viewfinder}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode={mode}
          // Every one of these is a documented expo-camera prop, set from a
          // control on this face or from Capture defaults. Nothing here is
          // decorative.
          flash={flash}
          zoom={zoomPropFor(zoom)}
          selectedLens={lensFor(zoom,lenses)}
          onAvailableLensesChanged={({lenses:available})=>setLenses(available)}
          // Focus-and-exposure lock. expo-camera's `autofocus` is documented as
          // "autofocus once and then lock the focus" for 'on'. Exposure is NOT
          // separately exposed by expo-camera 57 -- there is no AE-lock prop --
          // so this locks focus and the tray's label says exactly that instead
          // of claiming a lock the library cannot give.
          autofocus={focusLock ? "on" : "off"}
          videoStabilizationMode={stabilised ? "auto" : "off"}
          // Silent recording. In expo-camera 57 `mute` is a prop on CameraView
          // rather than an option to recordAsync -- the recorder reads it when
          // the recording starts.
          mute={silent}
          videoQuality={preferences.videoQuality}
          // ALWAYS ON, in both modes. A QR code is unambiguous and nobody points
          // a phone at one by accident, so making it a mode would mean guessing
          // wrong half the time. It is switched off only once a code has been
          // read, or the same code fires the handler on every frame.
          barcodeScannerSettings={{barcodeTypes:["qr"]}}
          onBarcodeScanned={handledCode || recording ? undefined : onBarcode}
        />

        {/*
          THE APERTURE CONSOLE.

          expo-camera ships zero capture chrome (confirmed in the Capability
          Research Pack), so every pixel above the feed is ours to author -- and
          the winning design asked for an instrument face rather than a bare
          button. What follows is that face: a viewfinder frame, mono readouts of
          what the camera is actually doing, a focus reticle where you tapped, a
          rule-of-thirds grid when the preference asks for one, and a flag that
          says the moment a code is recognised.
        */}

        {/* Tap anywhere on the feed to focus. Drawn where the finger landed. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Tap to focus"
          onPress={(event)=>{
            const {locationX,locationY}=event.nativeEvent;
            showFocus(locationX,locationY);
          }}
        />

        {/*
          THE GRID, drawn only when Capture defaults asks for it.

          Rule of thirds: two lines each way, hairline, at the same weight as
          every other etched line in the system. The kit has no grid part --
          composed here rather than added to components/instrument.js, which is
          not mine to edit.
        */}
        {preferences.grid ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.gridLine,styles.gridColumn,styles.gridOneThird]}/>
            <View style={[styles.gridLine,styles.gridColumn,styles.gridTwoThirds]}/>
            <View style={[styles.gridLine,styles.gridRow,styles.gridRowOneThird]}/>
            <View style={[styles.gridLine,styles.gridRow,styles.gridRowTwoThirds]}/>
          </View>
        ) : null}

        <CornerFrame inset={16} length={28} colour={INK.readoutSoft} opacity={0.45}/>

        {focusPoint ? (
          <View pointerEvents="none" style={{position:"absolute",left:focusPoint.x-36,top:focusPoint.y-36}}>
            <Reticle size={72} colour={INK.scheduled}/>
          </View>
        ) : null}

        {/* Readouts: what the instrument is set to, in the face's own language. */}
        <View pointerEvents="none" style={[styles.readoutRow,{top:clearHeader+8}]}>
          <Text style={styles.readoutChip}>{recording ? "REC" : "PHOTO"}</Text>
          <Text style={styles.readoutChip}>{`${zoom}×`}</Text>
          <Text style={styles.readoutChip}>{facing==="back" ? "REAR" : "FRONT"}</Text>
          {recording ? (
            <Text style={[styles.readoutChip,styles.readoutLive]}>
              {`${Math.ceil(MAX_RECORDING_SECONDS*(1-holdProgress))}S LEFT`}
            </Text>
          ) : null}
        </View>

        <View pointerEvents="none" style={[styles.hintWrap,{top:clearHeader+44}]}>
          <Text style={styles.hint}>
            {recording
              ? "Let go to stop."
              : "Press for a photo, hold to record. A Xplorer QR code opens itself."}
          </Text>
        </View>

        {/*
          THE CODE FLAG. Only ever on screen once onBarcodeScanned has resolved
          a Xplorer code -- the contextual rung of the ladder, drawn inside the
          viewfinder because that is where the thing it is reporting on is.
        */}
        {detectedCode ? (
          <View pointerEvents="none" style={styles.codeFlagWrap}>
            <View style={styles.codeFlag}>
              <Glyph name="qr" size={15} colour={INK.scheduled}/>
              <Text style={styles.codeFlagLabel}>CODE FOUND</Text>
              <Text style={styles.codeFlagValue} numberOfLines={1}>{detectedCode}</Text>
            </View>
          </View>
        ) : null}

        {!!error && (
          <View pointerEvents="none" style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/*
          THE IMMEDIATE RUNG: flash and the four zoom presets, on the face
          itself, over the bottom of the feed where a thumb already is.
        */}
        {/*
          Gone while the tray is open, rather than riding up on top of it: at
          412x915 the two rows together left a 120px viewfinder and drove the
          chips into the readouts. The tray carries the same zoom on its dial
          while it is open, so nothing is out of reach -- and this is a case
          where the honest fix was to draw less, not to squeeze more in.
        */}
        {!trayOpen ? (
        <View style={styles.faceRow}>
          <Chip
            label={FLASH_LABEL[flash]}
            selected={flash!=="off"}
            style={[styles.faceChip,flash!=="off" && styles.faceChipOn]}
            labelStyle={[styles.faceChipLabel,flash!=="off" && styles.faceChipOnLabel]}
            accessibilityLabel={`Flash is ${FLASH_SPOKEN[flash]}. Tap to set the flash to ${FLASH_SPOKEN[nextFlash(flash)]}.`}
            onPress={()=>setFlash(nextFlash(flash))}
          />
          {ZOOM_STOPS.map((stop)=>(
            <Chip
              key={String(stop)}
              label={`${stop}×`}
              selected={zoom===stop}
              style={[styles.faceChip,zoom===stop && styles.faceChipOn]}
              labelStyle={[styles.faceChipLabel,zoom===stop && styles.faceChipOnLabel]}
              accessibilityLabel={`Zoom to ${stop} times`}
              onPress={()=>setZoom(stop)}
            />
          ))}
        </View>
        ) : null}

        {/*
          THE PRECISION TRAY. At rest it is one small chevron and nothing else:
          the spec's own words are that it "doesn't compete for attention at
          rest". Open, it holds the four controls an expert reaches for.
        */}
        <Animated.View
          style={[styles.precisionTray,{height:trayOpening}]}
          pointerEvents={trayOpen ? "auto" : "none"}
          accessibilityElementsHidden={!trayOpen}
          importantForAccessibility={trayOpen ? "auto" : "no-hide-descendants"}
        >
          {/*
            Absolutely positioned against the clipper's BOTTOM edge, so it keeps
            its natural height while the container animates from zero -- a
            normal child would be squashed by the clipper it is sliding out of --
            and so it slides up from under the chevron rather than down from
            nowhere. onLayout reports that natural height back, which is what
            the container animates to.
          */}
          <Animated.View
            style={[styles.precisionTrayBody,{transform:[{translateY:trayShift}]}]}
            onLayout={(event)=>{
              const measured=Math.round(event.nativeEvent.layout.height);
              if(measured>0 && measured!==trayHeight) setTrayHeight(measured);
            }}
          >
            <SectionRule label="Precision"/>

            <View style={styles.dialRow}>
              <Readout label="ZOOM" value={`${zoom}×`} size="sm"/>
              <Dial
                values={ZOOM_DIAL_STOPS}
                active={zoom}
                onChange={setZoom}
                width={196}
                format={(v)=>`${v}×`}
              />
            </View>

            <Toggle
              label="Lock focus"
              sub={nativeOnly
                ? "Holds focus. expo-camera has no separate exposure lock."
                : "Only on a phone."}
              value={focusLock}
              disabled={!nativeOnly}
              onChange={setFocusLock}
              accessibilityLabel="Lock the focus"
            />

            <Toggle
              label="Stabilisation"
              sub={nativeOnly
                ? "Steadies a recording. On is expo-camera's own default."
                : "Only on a phone. A browser cannot record video."}
              value={stabilised}
              disabled={!nativeOnly}
              onChange={setStabilised}
              accessibilityLabel="Steady the recording"
            />

            <Toggle
              label="Record silently"
              sub={nativeOnly
                ? "Sound is on by default. This is the override."
                : "Only on a phone. A browser cannot record video."}
              value={silent}
              disabled={!nativeOnly}
              onChange={setSilent}
              accessibilityLabel="Record without sound"
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* ------------------------------------------------------------------
          THE CONSOLE, below the viewfinder.
          ------------------------------------------------------------------ */}
      <View style={[styles.console,{paddingBottom:bottomClearance}]}>
        <View style={styles.chevronRow}>
          <Pressable
            style={styles.chevron}
            accessibilityRole="button"
            accessibilityState={{expanded:trayOpen}}
            accessibilityLabel={trayOpen ? "Close the precision controls" : "Open the precision controls"}
            onPress={()=>setTrayOpen((open)=>!open)}
          >
            <Glyph name={trayOpen ? "down" : "up"} size={16} colour={INK.readoutSoft}/>
          </Pressable>
        </View>

        {/*
          THE FIVE BRANCHES, below the viewfinder and always visible. One tap
          each, from the list every surface shares.
        */}
        {/* .capture-branches / .branch-chip / .branch-ic / .branch-lb,
            transcribed. A 52px disc on card stock with a 2px ink edge and the
            hard offset shadow, its mark inside, its name in 8.5px mono below.
            The Moment branch is .primary -- an ink-filled disc with a paper
            mark. This was five outline text pills, which is the kit's default
            chip and not what the artifact draws here. */}
        <View style={styles.branchRow}>
          {CAPTURE_BRANCHES.map((branch)=>(
            <Pressable
              key={branch.key}
              style={styles.branchChip}
              accessibilityRole="button"
              accessibilityLabel={branch.spoken}
              onPress={()=>openBranch(branch)}
            >
              <View style={[styles.branchDisc,branch.primary && styles.branchDiscPrimary]}>
                <Glyph
                  name={branch.glyph}
                  size={20}
                  colour={branch.primary ? INK.paper : INK.ink}
                />
              </View>
              <Text style={styles.branchLabel} numberOfLines={1}>{branch.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controls}>
          <Pressable
            style={styles.sideButton}
            accessibilityRole="button"
            accessibilityLabel="Type a QR code by hand"
            onPress={()=>navigate("/scan")}
          >
            <Text style={styles.sideText}>Type a code</Text>
          </Pressable>

          {/*
            ONE BUTTON. onPressIn/onPressOut rather than onPress and onLongPress:
            React Native fires onPress on release AS WELL as onLongPress on some
            platforms, so a hold would leave a stray photograph behind every
            recording. utils/shutter.js decides which of the two happened.
          */}
          {/*
            The shutter, as an aperture. Rings close as a recording runs and the
            progress ring reports how much of the real 15s ceiling is spent -- the
            question the old bare circle never answered.
          */}
          <View style={styles.shutterWell}>
            <Aperture size={118} open={recording ? 1-holdProgress*0.55 : 1} colour={INK.hairlineStrong}/>
            <ProgressRing size={92} stroke={3} progress={recording ? holdProgress : 0} colour={INK.scheduled}/>
            <Pressable
              style={[styles.shutter,taking && styles.shutterBusy,recording && styles.shutterRecording]}
              accessibilityRole="button"
              accessibilityLabel="Press for a photo, hold to record a video"
              disabled={taking}
              onPressIn={()=>{shutter.current.pressIn();startHoldClock();}}
              onPressOut={()=>{shutter.current.pressOut();stopHoldClock();}}
            >
              <View style={[styles.shutterInner,recording && styles.shutterInnerRecording]}/>
            </Pressable>
          </View>

          <Pressable
            style={styles.sideButton}
            accessibilityRole="button"
            accessibilityLabel="Switch between the front and back camera"
            onPress={()=>setFacing((current)=>current==="back" ? "front" : "back")}
          >
            <Text style={styles.sideText}>Flip</Text>
          </Pressable>
        </View>

        {Platform.OS==="web" && (
          <Text style={styles.webNote}>Browser camera access depends on the browser and its site permissions.</Text>
        )}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  // The viewfinder ground is the deepest surface in the system -- the well.
  screen:{flex:1,backgroundColor:INK.inset},
  centre:{flex:1,backgroundColor:INK.inset,alignItems:"center",justifyContent:"center",padding:24},
  viewfinder:{flex:1,overflow:"hidden"},
  camera:{flex:1},
  preview:{flex:1},

  // The rule-of-thirds grid, at a third and two thirds each way.
  //
  // ONE PIXEL, AND PAPER-COLOURED -- not SHAPE.border and not an ink. This is
  // the one line in the app that is NOT a printed border: it lies over a live
  // photograph, where an ink rule would read as part of the picture. It is a
  // guide, so it is the thinnest visible line in the light the viewfinder is.
  gridLine:{position:"absolute",backgroundColor:INK.paper,opacity:0.3},
  gridColumn:{top:0,bottom:0,width:1},
  gridRow:{left:0,right:0,height:1},
  gridOneThird:{left:"33.33%"},
  gridTwoThirds:{left:"66.66%"},
  gridRowOneThird:{top:"33.33%"},
  gridRowTwoThirds:{top:"66.66%"},

  // Readouts sit along the top of the face. Mono, uppercase, wide-tracked --
  // the instrument's own language for "what am I set to".
  readoutRow:{
    position:"absolute",left:16,right:16,flexDirection:"row",gap:8,alignItems:"center"
  },
  // .vf-mode, transcribed:
  //
  //   font-family:mono; font-size:10px; letter-spacing:.12em; uppercase;
  //   color:var(--paper); background:rgba(231,232,225,.14);
  //   padding:5px 10px; border-radius:99px;
  //
  // PAPER-TINTED GLASS, not solid ink. This was solid for a while with a note
  // saying a rgba ground is invisible to the contrast gate -- which was true,
  // and the answer was to teach the gate the viewfinder's known backdrop
  // (VIEWFINDER_BACKDROP in scripts/verify-contrast.cjs), not to redraw the
  // design so the gate could read it.
  readoutChip:{
    color:INK.paper,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1.2,
    backgroundColor:VF_GLASS,
    borderWidth:1,borderColor:VF_GLASS_EDGE,borderRadius:SHAPE.radius.pill,
    paddingHorizontal:10,paddingVertical:5,overflow:"hidden"
  },
  // Recording. Pink is the ink for "this is live right now", and pink takes INK
  // type, not paper -- see the per-ink table in docs/design-system.md. That is
  // the artifact's own rule and the reason .pin-pink carries color:var(--ink).
  readoutLive:{color:INK.ink,backgroundColor:INK.pink,borderColor:INK.ink},

  // The code flag: centred in the frame, because the thing it reports on is in
  // the frame. Scheduled ink, which is the system's "this is live right now".
  codeFlagWrap:{position:"absolute",left:0,right:0,top:"42%",alignItems:"center"},
  codeFlag:{
    flexDirection:"row",alignItems:"center",gap:8,
    // OVER THE VIEWFINDER, THE INK AND THE PAPER SWAP.
    //
    // The viewfinder is the one dark surface in this design, because it is a
    // photograph. The artifact draws its chrome over that feed as SOLID INK
    // pills with paper-coloured mono inside -- "PHOTO · HOLD FOR VIDEO", the
    // zoom presets, the corner controls. So this flag is one of those, with the
    // yellow ink reserved for its border the way the artifact reserves it for
    // the focus reticle.
    //
    // Solid rather than translucent on purpose: a rgba() ground cannot be
    // resolved by scripts/verify-contrast.cjs, which then walks up to the
    // screen behind and compares the text against PAPER -- and pink on paper is
    // 2.77:1. An unreadable pair the gate cannot see is worse than one it can.
    backgroundColor:INK.ink,
    borderWidth:SHAPE.borderStrong,borderColor:INK.yellow,
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:12,paddingVertical:9,maxWidth:"86%"
  },
  codeFlagLabel:{
    color:INK.paper,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:1
  },
  codeFlagValue:{
    color:INK.hair,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,flexShrink:1
  },

  // The immediate rung, over the bottom of the feed: flash, then the four zoom
  // presets. Chips rather than a dial, because a preset is a tap and the dial
  // in the tray is the drag.
  faceRow:{
    position:"absolute",left:0,right:0,bottom:12,
    flexDirection:"row",justifyContent:"center",flexWrap:"wrap",gap:6,paddingHorizontal:12
  },
  // .vf-zoom button / .vf-zoom button.active, transcribed:
  //
  //   { color:var(--paper); background:rgba(231,232,225,.14);
  //     border:1px solid rgba(231,232,225,.35); border-radius:99px; }
  //   .active { background:var(--ink-yellow); color:var(--ink); font-weight:700 }
  //
  // These two lines used to read rgba(11,14,18,.68) and rgba(30,37,46,.86) --
  // the ground and raised surfaces of the near-black build this replaced,
  // surviving as literals in a file the palette gate skips because it is mostly
  // camera feed. They rendered as dark blobs over the picture.
  //
  // 44 tall, not the kit's 32: this is a one-handed control over a live image.
  faceChip:{minHeight:44,backgroundColor:VF_GLASS,borderWidth:1,borderColor:VF_GLASS_EDGE},
  faceChipLabel:{color:INK.paper},
  // The one place selection is a state ink rather than an ink fill: over a
  // photograph the kit's ink-on-paper inversion has no paper to invert to, so
  // the artifact reaches for yellow -- the ink nothing else on this face uses.
  faceChipOn:{backgroundColor:INK.yellow,borderColor:INK.yellow},
  faceChipOnLabel:{color:INK.ink,fontFamily:MONO_MEDIUM},

  // The well is what makes the shutter read as a lens rather than a button:
  // the aperture rings and progress ring are centred on the same point.
  shutterWell:{width:118,height:118,alignItems:"center",justifyContent:"center"},
  hintWrap:{position:"absolute",left:16,right:16,alignItems:"center"},
  // Quiet. The readouts above already say what the instrument is set to, so
  // this is a one-line instruction, not a banner competing with them.
  hint:{
    color:INK.readoutSoft,
    fontSize:11.5,
    fontWeight:"400",
    paddingHorizontal:12,
    paddingVertical:5,
    textAlign:"center"
  },

  errorWrap:{position:"absolute",bottom:76,left:16,right:16,alignItems:"center"},
  // Dark text on the dispute ink, per docs/design-system.md's contrast table --
  // the state inks are bright on this housing and take dark text, never light.
  errorText:{
    color:INK.ground,
    fontWeight:"700",
    fontSize:13,
    backgroundColor:INK.dispute,
    borderRadius:SHAPE.radius.card,
    paddingHorizontal:14,
    paddingVertical:9,
    overflow:"hidden",
    textAlign:"center"
  },

  // The console: everything below the viewfinder, in the housing's own surface
  // rather than floating over the picture.
  console:{backgroundColor:INK.panel,borderTopWidth:SHAPE.border,borderTopColor:SHAPE.edgeHighlight},

  // AN OVERLAY, NOT A ROW. As a row in the console it shrank the viewfinder to
  // a strip and drove the flash and zoom chips into the readouts at the top --
  // found by opening it in a browser at 412x915 and looking, not by a test. It
  // slides up over the bottom of the live image instead, the way the rest of
  // this face already works, and the chips ride up on top of it.
  precisionTray:{
    position:"absolute",left:0,right:0,bottom:0,
    overflow:"hidden",
    backgroundColor:INK.panel,
    borderTopWidth:SHAPE.border,borderTopColor:SHAPE.edgeHighlight
  },
  precisionTrayBody:{position:"absolute",left:0,right:0,bottom:0,paddingHorizontal:14,paddingBottom:8},
  dialRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,paddingVertical:6},

  chevronRow:{alignItems:"center"},
  // One small control at rest, and still a 44px target.
  chevron:{
    width:56,height:44,alignItems:"center",justifyContent:"center"
  },

  //   .capture-branches { display:flex; gap:8px; padding:14px 16px }
  //   .branch-chip { column, align centre, gap 6, width 76 }
  //   .branch-ic   { 52px disc, --card, 2px --ink, --shadow-hard-sm }
  //   .branch-chip.primary .branch-ic { background:--ink; color:--paper }
  //   .branch-lb   { mono 8.5px, .05em, uppercase, --ink }
  branchRow:{
    flexDirection:"row",justifyContent:"center",gap:8,paddingHorizontal:16,paddingVertical:14
  },
  branchChip:{width:64,alignItems:"center",gap:6},
  branchDisc:{
    width:52,height:52,borderRadius:26,
    backgroundColor:INK.card,
    borderWidth:SHAPE.borderStrong,borderColor:INK.ink,
    alignItems:"center",justifyContent:"center",
    ...SHAPE.shadow.hardSm
  },
  branchDiscPrimary:{backgroundColor:INK.ink},
  branchLabel:{
    fontFamily:MONO,fontSize:8.5,letterSpacing:0.43,
    textTransform:"uppercase",textAlign:"center",color:INK.ink
  },

  controls:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:24,
    paddingBottom:16
  },
  // Side controls are panel chips, not shouted labels -- the shutter is the one
  // thing on this face that should draw the eye.
  sideButton:{
    minWidth:88,minHeight:44,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,paddingHorizontal:10
  },
  sideText:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1
  },
  shutter:{
    width:74,
    height:74,
    borderRadius:37,
    // THE ONE THICK RING IN THE APP, AND IT IS NOT AN EDGE.
    // SHAPE.border is 1 because a border is a hairline etched into the housing.
    // This is not a border round a panel -- it is the shutter itself, the
    // drawn ring of a physical control, sitting inside the Aperture's blades
    // and under the ProgressRing that fills as a recording runs. A 1px shutter
    // would read as a circle somebody forgot to finish.
    borderWidth:4,
    borderColor:INK.readout,
    alignItems:"center",
    justifyContent:"center"
  },
  shutterBusy:{opacity:0.5},
  // Recording: the ring fills red and the inner circle becomes a square, which
  // is the stop shape everybody already reads without a legend. INK.dispute is
  // the manager's colour elsewhere and never appears on the map -- this is a
  // viewfinder, not the map, and "recording" is the one other place a red that
  // means "this is live and being kept" is worth more than consistency.
  shutterRecording:{borderColor:INK.dispute},
  shutterInner:{width:56,height:56,borderRadius:28,backgroundColor:INK.readout},
  shutterInnerRecording:{width:30,height:30,borderRadius:SHAPE.radius.control,backgroundColor:INK.dispute},
  videoPreview:{alignItems:"center",justifyContent:"center"},
  videoPreviewText:{color:INK.readout,fontWeight:"700",fontSize:16},

  tray:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    backgroundColor:INK.panel,
    borderTopWidth:SHAPE.border,
    borderTopColor:SHAPE.edgeHighlight,
    ...SHAPE.shadow.floating,
    padding:18,
    paddingBottom:28
  },
  trayTitle:{color:INK.readout,fontSize:19,fontWeight:"700",marginBottom:11},
  choice:{
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,
    padding:14,
    marginBottom:10,
    backgroundColor:INK.panelRaised
  },
  choiceTitle:{color:INK.readout,fontWeight:"700",fontSize:16},
  choiceText:{color:INK.readoutSoft,fontSize:13,lineHeight:19,marginTop:3},
  retake:{alignItems:"center",paddingVertical:11},
  retakeText:{color:INK.readoutSoft,fontWeight:"600",fontSize:14},

  permissionCard:{
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.sheet,
    padding:20,
    width:"100%",
    maxWidth:420
  },
  permissionTitle:{color:INK.readout,fontSize:19,fontWeight:"700"},
  permissionText:{color:INK.readoutSoft,fontSize:14,lineHeight:20,marginTop:8},
  // The one lit control on the card. The readout, not a state ink -- asking for
  // the camera is not a state a place is in.
  primary:{backgroundColor:INK.readout,borderRadius:SHAPE.radius.card,paddingVertical:14,alignItems:"center",marginTop:16},
  primaryText:{color:INK.ground,fontWeight:"700",fontSize:15},
  secondary:{
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    borderRadius:SHAPE.radius.card,
    paddingVertical:14,
    alignItems:"center",
    marginTop:10
  },
  secondaryText:{color:INK.readout,fontWeight:"600",fontSize:15},

  webNote:{
    color:INK.readoutSoft,
    fontSize:11,
    textAlign:"center",
    paddingHorizontal:16,
    paddingBottom:10
  }
});
