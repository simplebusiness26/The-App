import React,{useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
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
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  return(
    // A plain View clipped everything past the fold: the manual code entry and
    // its help text sat below the viewfinder with no way to reach them, and the
    // tab bar takes 82px off the bottom on top of that.
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>VERIFIED VISIT</Text>
      <Text style={styles.title}>Scan Xplorer QR</Text>
      <Text style={styles.subtitle}>Scan the code displayed at a business, property, Activity Club or event before leaving your review.</Text>

      {!permission.granted ? (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access is needed</Text>
          <Text style={styles.permissionText}>Xplorer only uses the camera here to recognise QR codes.</Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryText}>Allow camera access</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraCard}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{barcodeTypes:["qr"]}}
            onBarcodeScanned={scanned ? undefined : ({data})=>openScan(data)}
          />
          <View pointerEvents="none" style={styles.target}><View style={styles.targetInner}/></View>
        </View>
      )}

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {scanned && (
        <Pressable style={styles.secondaryButton} onPress={()=>{setScanned(false);setError("");}}>
          <Text style={styles.secondaryText}>Scan another code</Text>
        </Pressable>
      )}

      <View style={styles.manualCard}>
        <Text style={styles.manualTitle}>Testing on one phone?</Text>
        <Text style={styles.manualText}>Enter the code printed below the QR or paste its Xplorer link.</Text>
        <TextInput
          style={styles.input}
          placeholder="QR code or Xplorer QR link"
          placeholderTextColor="#878790"
          autoCapitalize="none"
          autoCorrect={false}
          value={manualCode}
          onChangeText={setManualCode}
        />
        <Pressable style={styles.manualButton} onPress={()=>openScan(manualCode)}>
          <Text style={styles.primaryText}>Open verified review</Text>
        </Pressable>
      </View>

      {Platform.OS==="web" && <Text style={styles.webNote}>Browser camera access depends on the browser and its site permissions.</Text>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  container:{flexGrow:1,paddingBottom:110,backgroundColor:"#18181b",padding:20},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  eyebrow:{color:"#8fe1aa",fontSize:11,fontWeight:"900",letterSpacing:0.8,marginTop:8},
  title:{color:"white",fontSize:29,fontWeight:"900",marginTop:5},
  subtitle:{color:"#aaaab2",fontSize:14,lineHeight:21,marginTop:7,marginBottom:16},
  cameraCard:{height:320,borderRadius:18,overflow:"hidden",backgroundColor:"#050505",position:"relative"},
  camera:{flex:1},
  target:{position:"absolute",left:"18%",right:"18%",top:"18%",bottom:"18%",borderWidth:3,borderColor:"white",borderRadius:18,padding:8},
  targetInner:{flex:1,borderWidth:1,borderColor:"rgba(255,255,255,0.45)",borderRadius:12},
  permissionCard:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:16,padding:20},
  permissionTitle:{color:"white",fontSize:19,fontWeight:"900"},
  permissionText:{color:"#aaaab2",lineHeight:20,marginTop:7},
  primaryButton:{backgroundColor:"#3212b6",padding:15,borderRadius:12,marginTop:16},
  primaryText:{color:"white",fontWeight:"900",textAlign:"center"},
  errorBox:{backgroundColor:"#3b171b",borderColor:"#80353d",borderWidth:1,borderRadius:12,padding:13,marginTop:12},
  errorText:{color:"#ffb4bc",fontWeight:"700",textAlign:"center"},
  secondaryButton:{borderColor:"#65656e",borderWidth:1,borderRadius:11,padding:13,marginTop:12},
  secondaryText:{color:"white",fontWeight:"800",textAlign:"center"},
  manualCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:15,marginTop:17},
  manualTitle:{color:"white",fontSize:17,fontWeight:"900"},
  manualText:{color:"#9999a2",fontSize:12,lineHeight:18,marginTop:5},
  input:{backgroundColor:"#29292e",borderColor:"#505057",borderWidth:1,borderRadius:10,padding:12,color:"white",marginTop:12},
  manualButton:{backgroundColor:"#5633a8",padding:13,borderRadius:10,marginTop:10},
  webNote:{color:"#777780",fontSize:10,textAlign:"center",marginTop:12}
});
