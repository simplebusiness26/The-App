import React,{useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView
} from "react-native";
import {CameraView,useCameraPermissions} from "expo-camera";
import {router} from "expo-router";
// Shared with app/camera.js. Two copies of "is this one of ours" is how a code
// starts working on one screen and not the other.
import {extractQrCode} from "../utils/qr";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {
  Action,
  CornerFrame,
  Field,
  fieldInputStyle,
  MONO,
  Notice,
  Reticle,
  Screen,
  ScreenTitle,
  SectionRule
} from "../components/instrument";

// The standalone scanner.
//
// It is a VIEWFINDER, so it speaks the viewfinder's language rather than
// inventing a second one: components/CameraCapture.js is the built worked
// example and this borrows its parts wholesale -- CornerFrame brackets round
// the live feed, a Reticle on the aim point, and mono readout chips saying what
// the instrument is set to. The old version drew a 3px white box with a
// translucent inner box inside it, which is a cropping guide from a photo app.
//
// A plain View clipped everything past the fold: the manual code entry and its
// help text sat below the viewfinder with no way to reach them, and the Create
// action takes another CREATE_HUB_CLEARANCE off the bottom on top of that.
export default function Scan(){
  const [permission,requestPermission]=useCameraPermissions();
  const [scanned,setScanned]=useState(false);
  const [manualCode,setManualCode]=useState("");
  const [error,setError]=useState("");

  function openScan(data){
    if(scanned) return;
    const code=extractQrCode(data);
    if(!code){
      setError("This is not a Xplorer verified-review QR code.");
      setScanned(true);
      return;
    }

    setScanned(true);
    setError("");
    router.replace(`/qr/${encodeURIComponent(code)}`);
  }

  if(!permission){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
      </Screen>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle
        eyebrow="Verified visit"
        title="Scan Xplorer QR"
        meta="Scan the code displayed at a business, property, Activity Club or event before leaving your review."
      />

      <View style={styles.body}>
        {!permission.granted ? (
          <Notice
            tone="exists"
            label="Camera access is needed"
            action={
              <Action
                kind="primary"
                glyph="camera"
                label="Allow camera access"
                accessibilityLabel="Allow camera access"
                onPress={requestPermission}
              />
            }
          >
            Xplorer only uses the camera here to recognise QR codes.
          </Notice>
        ) : (
          <View style={styles.viewfinder}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{barcodeTypes:["qr"]}}
              onBarcodeScanned={scanned ? undefined : ({data})=>openScan(data)}
            />

            {/* The same brackets the camera screen frames its feed with. */}
            <CornerFrame inset={14} length={26} colour={INK.readoutSoft} opacity={0.5}/>

            <View style={styles.reticleWrap} pointerEvents="none">
              <Reticle size={132}/>
            </View>

            {/* What the instrument is set to, in its own language. */}
            <View style={styles.readoutRow} pointerEvents="none">
              <Text style={styles.readoutChip}>QR</Text>
              <Text style={styles.readoutChip}>Rear</Text>
              <Text style={styles.readoutChip}>{scanned ? "Held" : "Live"}</Text>
            </View>
          </View>
        )}

        {!!error && <Notice tone="exists" label="Not a Xplorer code">{error}</Notice>}

        {scanned && (
          <Action
            kind="secondary"
            glyph="refresh"
            label="Scan another code"
            accessibilityLabel="Scan another code"
            onPress={()=>{setScanned(false);setError("");}}
            style={styles.again}
          />
        )}

        <SectionRule label="Testing on one phone?"/>

        <Field
          label="QR code or link"
          hint="Enter the code printed below the QR or paste its Xplorer link."
        >
          <TextInput
            style={fieldInputStyle}
            placeholder="QR code or Xplorer QR link"
            placeholderTextColor={INK.readoutFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={manualCode}
            onChangeText={setManualCode}
            accessibilityLabel="QR code or Xplorer QR link"
          />
        </Field>

        <Action
          kind="primary"
          glyph="forward"
          label="Open verified review"
          accessibilityLabel="Open verified review"
          onPress={()=>openScan(manualCode)}
        />

        {Platform.OS==="web" && (
          <Text style={styles.webNote}>
            Browser camera access depends on the browser and its site permissions.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:1};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.ground},
  content:{flexGrow:1,paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center"},

  // The viewfinder ground is the deepest surface in the system -- the well.
  viewfinder:{
    height:320,
    borderRadius:SHAPE.radius.card,
    overflow:"hidden",
    backgroundColor:INK.inset,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    alignItems:"center",
    justifyContent:"center",
    marginBottom:12
  },
  camera:{...StyleSheet.absoluteFillObject},
  reticleWrap:{alignItems:"center",justifyContent:"center"},

  readoutRow:{position:"absolute",top:10,left:10,flexDirection:"row",gap:7},
  readoutChip:{
    ...MONO_META,
    color:INK.readoutSoft,
    fontSize:TYPE.data.sizes.sm,
    backgroundColor:"rgba(11,14,18,0.62)",
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:8,
    paddingVertical:4,
    overflow:"hidden"
  },

  again:{marginBottom:4},
  webNote:{
    color:INK.readoutFaint,
    fontSize:TYPE.body.sizes.sm,
    textAlign:"center",
    marginTop:14
  }
});
