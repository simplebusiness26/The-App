import React,{useCallback,useRef,useState} from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform
} from "react-native";
import {CameraView,useCameraPermissions} from "expo-camera";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {extractQrCode} from "../utils/qr";
import {INK} from "../utils/tokens";

// The camera. One viewfinder, three outcomes.
//
// WHAT WAS THERE BEFORE
//
// The raised button in the middle of the map said Camera and opened
// /moments/create, which opens the PHOTO LIBRARY. There was no camera capture
// anywhere in this app -- launchCameraAsync appeared in no file -- so the one
// control named after a camera was the one control that could not take a
// picture. Scanning a QR code lived somewhere else again, on /scan, reachable
// only from the drawer.
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
// WHY THE PHOTO IS HANDED OVER RATHER THAN UPLOADED HERE
//
// A Moment and a Memory each have a screen that already knows how to upload,
// choose an audience, attach a place and say what the rules are. Re-implementing
// any of that here would give two answers to the same question. This screen
// takes the picture and hands the file to whichever of them you chose.

export default function Camera(){
  const params=useLocalSearchParams();
  const [permission,requestPermission]=useCameraPermissions();
  const cameraRef=useRef(null);

  const [facing,setFacing]=useState("back");
  const [photo,setPhoto]=useState(null);
  const [taking,setTaking]=useState(false);
  const [error,setError]=useState("");
  // Once a code has been read, stop reading. Without this the same code fires
  // the handler on every frame and pushes the same screen dozens of times.
  const [handledCode,setHandledCode]=useState(false);

  // Coming back to this screen -- from the code it just scanned, or from the
  // Moment it just started -- has to give a live camera again, not the frozen
  // frame from last time.
  useFocusEffect(useCallback(()=>{
    setHandledCode(false);
    setPhoto(null);
    setError("");
  },[]));

  function onBarcode({data}){
    if(handledCode || photo) return;

    const code=extractQrCode(data);
    if(!code) return;   // Not one of ours. Say nothing and keep looking.

    setHandledCode(true);
    router.push(`/qr/${encodeURIComponent(code)}`);
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

  // The two screens both read `photo` and start with it already chosen.
  //
  // Anything the camera was OPENED with travels through to them. A place page
  // says "post a Moment here" and now routes via the camera, so the place it
  // meant has to survive the round trip -- otherwise camera-only creation would
  // have quietly cost every Moment its place.
  function use(destination){
    if(!photo?.uri) return;

    const carried=["target_type","target_id"]
      .map((key)=>{
        const value=Array.isArray(params[key]) ? params[key][0] : params[key];
        return value ? `&${key}=${encodeURIComponent(value)}` : "";
      })
      .join("");

    router.push(`${destination}?photo=${encodeURIComponent(photo.uri)}${carried}`);
  }

  if(!permission){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.card}/></View>;
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
            onPress={()=>router.push("/scan")}
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
    return(
      <View style={styles.screen}>
        <Image source={{uri:photo.uri}} style={styles.preview} resizeMode="cover"/>

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
            accessibilityLabel="Take it again"
            onPress={()=>setPhoto(null)}
          >
            <Text style={styles.retakeText}>Take it again</Text>
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
        barcodeScannerSettings={{barcodeTypes:["qr"]}}
        onBarcodeScanned={handledCode ? undefined : onBarcode}
      />

      <View pointerEvents="none" style={styles.hintWrap}>
        <Text style={styles.hint}>Point at a Xplorer QR code to open it, or take a photo</Text>
      </View>

      {!!error && (
        <View pointerEvents="none" style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <Pressable
          style={styles.sideButton}
          accessibilityRole="button"
          accessibilityLabel="Type a QR code by hand"
          onPress={()=>router.push("/scan")}
        >
          <Text style={styles.sideText}>Type a code</Text>
        </Pressable>

        <Pressable
          style={[styles.shutter,taking && styles.shutterBusy]}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          disabled={taking}
          onPress={takePhoto}
        >
          <View style={styles.shutterInner}/>
        </Pressable>

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
  screen:{flex:1,backgroundColor:INK.ink},
  centre:{flex:1,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",padding:24},
  camera:{flex:1},
  preview:{flex:1},

  hintWrap:{position:"absolute",top:16,left:16,right:16,alignItems:"center"},
  hint:{
    color:INK.card,
    fontSize:12,
    fontWeight:"700",
    backgroundColor:"rgba(22,24,28,0.72)",
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:7,
    overflow:"hidden",
    textAlign:"center"
  },

  errorWrap:{position:"absolute",bottom:150,left:16,right:16,alignItems:"center"},
  errorText:{
    color:INK.card,
    fontWeight:"800",
    fontSize:13,
    backgroundColor:"rgba(194,50,31,0.92)",
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
  sideButton:{minWidth:88,minHeight:44,alignItems:"center",justifyContent:"center"},
  sideText:{color:INK.card,fontWeight:"800",fontSize:13},
  shutter:{
    width:74,
    height:74,
    borderRadius:37,
    borderWidth:4,
    borderColor:INK.card,
    alignItems:"center",
    justifyContent:"center"
  },
  shutterBusy:{opacity:0.5},
  shutterInner:{width:56,height:56,borderRadius:28,backgroundColor:INK.card},

  tray:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    backgroundColor:INK.card,
    borderTopWidth:2,
    borderTopColor:INK.ink,
    padding:18,
    paddingBottom:28
  },
  trayTitle:{color:INK.ink,fontSize:19,fontWeight:"800",marginBottom:11},
  choice:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    marginBottom:10,
    backgroundColor:INK.paper
  },
  choiceTitle:{color:INK.ink,fontWeight:"800",fontSize:16},
  choiceText:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:3},
  retake:{alignItems:"center",paddingVertical:11},
  retakeText:{color:INK.inkSoft,fontWeight:"800",fontSize:14},

  permissionCard:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:16,
    padding:20,
    width:"100%",
    maxWidth:420
  },
  permissionTitle:{color:INK.ink,fontSize:19,fontWeight:"800"},
  permissionText:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:8},
  primary:{backgroundColor:INK.ink,borderRadius:12,paddingVertical:14,alignItems:"center",marginTop:16},
  primaryText:{color:INK.card,fontWeight:"800",fontSize:15},
  secondary:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    paddingVertical:14,
    alignItems:"center",
    marginTop:10
  },
  secondaryText:{color:INK.ink,fontWeight:"800",fontSize:15},

  webNote:{
    position:"absolute",
    bottom:96,
    left:16,
    right:16,
    color:INK.card,
    fontSize:11,
    textAlign:"center"
  }
});
