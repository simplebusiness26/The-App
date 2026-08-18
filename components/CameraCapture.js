import React,{useCallback,useEffect,useRef,useState} from "react";
import {
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
import {extractQrCode} from "../utils/qr";
import {mediaKindFromUri} from "../utils/socialMedia";
import {createShutter,MAX_RECORDING_SECONDS} from "../utils/shutter";
import {useHeaderClearance} from "./Header";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Aperture,ProgressRing,CornerFrame,Reticle,Dial,MONO} from "./instrument";

// The camera. One viewfinder, three outcomes.
//
// EXTRACTED from app/camera.js so the exact same viewfinder can be the Create
// hub's default surface (components/CreateHub.js) AND the standalone /camera
// route -- one implementation, so pressing the shutter cannot behave
// differently depending on which door you came in through.
//
// app/camera.js is now a three-line wrapper that renders this with no props,
// which is exactly what it did before this file existed -- nothing about the
// /camera route's behaviour changes.
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
// `presetTargetType`/`presetTargetId`, when supplied, override the
// `target_type`/`target_id` URL params app/places/[id].js and similar pages
// already push onto /camera for a "post a Moment here" launch. The Create
// hub never supplies them -- it is reachable from any screen, not contingent
// on one, so it has no place to attach by construction.
export default function CameraCapture({onNavigate,presetTargetType,presetTargetId}){
  // The header floats over the viewfinder now rather than sitting above it, so
  // the hint clears the floating chips instead of starting at the top edge.
  const clearHeader=useHeaderClearance();
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
  // have to be backed by real camera capability -- never painted on. All three
  // of these map onto documented expo-camera props (`zoom` 0-1, `mode`, and the
  // recording ceiling in utils/shutter.js).
  //
  // ZOOM. expo-camera takes 0-1, not a magnification factor, so the dial shows
  // the presets a person understands and this maps them.
  const ZOOM_STOPS=[1,2,3,5];
  const ZOOM_TO_PROP={1:0,2:0.25,3:0.45,5:0.7};
  const [zoom,setZoom]=useState(1);

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

  // Coming back to this screen -- from the code it just scanned, or from the
  // Moment it just started -- has to give a live camera again, not the frozen
  // frame from last time. Only relevant when this is mounted as the routed
  // screen; the Create hub unmounts it outright on close, which resets the
  // same state for free.
  useFocusEffect(useCallback(()=>{
    setHandledCode(false);
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

  function onBarcode({data}){
    if(handledCode || photo) return;

    const code=extractQrCode(data);
    if(!code) return;   // Not one of ours. Say nothing and keep looking.

    setHandledCode(true);
    navigate(`/qr/${encodeURIComponent(code)}`);
  }

  async function takePhoto(){
    if(taking || !cameraRef.current) return;

    setTaking(true);
    setError("");

    try{
      const taken=await cameraRef.current.takePictureAsync({quality:0.8});
      if(!taken?.uri) throw new Error("The camera returned no picture.");
      setPhoto(taken);
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
        if(alive && taken?.uri) setPhoto(taken);
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
    if(microphone && !microphone.granted){
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
  return(
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode={mode}
        // expo-camera's zoom is 0-1, not a magnification factor. The dial speaks
        // in the stops a person recognises; this is the only place that maps.
        zoom={ZOOM_TO_PROP[zoom] ?? 0}
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
        zoom dial with real detents, and a shutter that shows how much of the
        recording ceiling you have used.

        Every control here is backed by a documented expo-camera capability.
        Nothing is decorative.
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

      {!!error && (
        <View pointerEvents="none" style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Zoom, as a dial with detents rather than four separate buttons. */}
      <View style={styles.dialRow}>
        <Dial
          values={ZOOM_STOPS}
          active={zoom}
          onChange={setZoom}
          width={224}
          format={(v)=>`${v}×`}
        />
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
  );
}

const styles=StyleSheet.create({
  // The viewfinder ground is the deepest surface in the system -- the well.
  screen:{flex:1,backgroundColor:INK.inset},
  centre:{flex:1,backgroundColor:INK.inset,alignItems:"center",justifyContent:"center",padding:24},
  camera:{flex:1},
  preview:{flex:1},

  // Readouts sit along the top of the face. Mono, uppercase, wide-tracked --
  // the instrument's own language for "what am I set to".
  readoutRow:{
    position:"absolute",left:16,right:16,flexDirection:"row",gap:8,alignItems:"center"
  },
  readoutChip:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,
    backgroundColor:"rgba(11,14,18,0.62)",
    borderWidth:SHAPE.border,borderColor:INK.hairline,borderRadius:SHAPE.radius.control,
    paddingHorizontal:8,paddingVertical:4,overflow:"hidden"
  },
  readoutLive:{color:INK.ground,backgroundColor:INK.scheduled,borderColor:INK.scheduled},
  // The dial sits above the shutter row, clear of the thumb's path to it.
  dialRow:{position:"absolute",left:0,right:0,bottom:150,alignItems:"center"},
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

  errorWrap:{position:"absolute",bottom:150,left:16,right:16,alignItems:"center"},
  // Dark text on the dispute ink, per docs/design-system.md's contrast table --
  // the state inks are bright on this housing and take dark text, never light.
  errorText:{
    color:INK.ground,
    fontWeight:"700",
    fontSize:13,
    backgroundColor:INK.dispute,
    borderRadius:12,
    paddingHorizontal:14,
    paddingVertical:9,
    overflow:"hidden",
    textAlign:"center"
  },

  controls:{
    position:"absolute",
    bottom:0,
    left:0,
    right:0,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:24,
    paddingVertical:20
  },
  // Side controls are panel chips, not shouted labels -- the shutter is the one
  // thing on this face that should draw the eye.
  sideButton:{
    minWidth:88,minHeight:44,alignItems:"center",justifyContent:"center",
    backgroundColor:"rgba(11,14,18,0.62)",
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
  shutterInnerRecording:{width:30,height:30,borderRadius:6,backgroundColor:INK.dispute},
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
    position:"absolute",
    bottom:96,
    left:16,
    right:16,
    color:INK.readoutSoft,
    fontSize:11,
    textAlign:"center"
  }
});
