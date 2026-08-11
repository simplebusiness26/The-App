import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView
} from "react-native";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../../services/supabase";
import QRCodeGenerator from "../../../../components/QRCodeGenerator";

const LISTING_CONFIG={
  business:{table:"businesses",ownerColumn:"owner_id",nameColumn:"name",label:"Business",targetType:"business"},
  property:{table:"properties",ownerColumn:"owner_id",nameColumn:"name",label:"Property",targetType:"property"},
  activity:{table:"activity_clubs",ownerColumn:"manager_id",nameColumn:"name",label:"Activity Club",targetType:"activity_club"},
  event:{table:"events",ownerColumn:"manager_id",nameColumn:"name",label:"Event",targetType:"event"}
};

function publicAppBase(){
  const configured=(process.env.EXPO_PUBLIC_APP_URL || "").replace(/\/$/,"");
  if(configured) return configured;

  if(Platform.OS==="web" && typeof window!=="undefined"){
    return `${window.location.protocol}//${window.location.host}`.replace(/\/$/,"");
  }
  return "https://guestbook.app";
}

export default function PrintableListingQR(){
  const params=useLocalSearchParams();
  const type=Array.isArray(params.type) ? params.type[0] : params.type;
  const id=Array.isArray(params.id) ? params.id[0] : params.id;
  const [listing,setListing]=useState(null);
  const [reviewCode,setReviewCode]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(type && id) loadListing();
  },[type,id]));

  async function loadListing(){
    setLoading(true);
    setError("");

    const config=LISTING_CONFIG[type];
    if(!config){
      setError("Unsupported listing type.");
      setLoading(false);
      return;
    }

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setError("Please log in to print this QR code.");
      setLoading(false);
      return;
    }

    const [listingResult,codeResult]=await Promise.all([
      supabase.from(config.table).select("*").eq("id",id).eq(config.ownerColumn,user.id).single(),
      supabase.rpc("ensure_listing_qr_code",{p_target_type:config.targetType,p_target_id:id})
    ]);

    if(listingResult.error){
      console.log(listingResult.error);
      setError("This listing could not be loaded or is not owned by your account.");
      setLoading(false);
      return;
    }

    if(codeResult.error || !codeResult.data?.[0]?.code){
      console.log(codeResult.error);
      setError(codeResult.error?.message || "The verified-review QR code could not be created.");
      setLoading(false);
      return;
    }

    setListing({...listingResult.data,_label:config.label,_name:listingResult.data[config.nameColumn]});
    setReviewCode(codeResult.data[0].code);
    setLoading(false);
  }

  function printPage(){
    if(Platform.OS==="web" && typeof window!=="undefined") window.print();
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#8b6de0"/></View>;
  }

  if(error || !listing || !reviewCode){
    return <View style={styles.center}><Text style={styles.error}>{error || "Listing not found"}</Text></View>;
  }

  const qrUrl=`${publicAppBase()}/qr/${encodeURIComponent(reviewCode)}`;

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.printCard}>
        <Text style={styles.brand}>Xplorer</Text>
        <Text style={styles.title}>{listing._name}</Text>
        <Text style={styles.subtitle}>Scan while you’re here to leave a verified review.</Text>

        <View style={styles.qrWrap}>
          <QRCodeGenerator value={qrUrl} size={260}/>
        </View>

        <View style={styles.bonusBox}>
          <Text style={styles.bonusTitle}>✓ VERIFIED VISIT</Text>
          <Text style={styles.bonusText}>A valid on-site scan adds 3 points to an eligible Explorer review.</Text>
        </View>

        <Text style={styles.footer}>Text 1 point · Images 3 · Video 6 · Verified scan +3</Text>
      </View>

      {Platform.OS==="web" ? (
        <Pressable style={styles.printButton} onPress={printPage}>
          <Text style={styles.printButtonText}>Print Verified Review QR</Text>
        </Pressable>
      ) : (
        <View style={styles.notice}><Text>Open this page in the web preview to use your browser’s print option.</Text></View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#eef1f6"},
  content:{padding:20,paddingBottom:50,alignItems:"center"},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#eef1f6"},
  error:{fontSize:17,textAlign:"center"},
  printCard:{width:"100%",maxWidth:520,backgroundColor:"white",padding:28,borderRadius:18,alignItems:"center",borderWidth:1,borderColor:"#ddd"},
  brand:{fontSize:22,fontWeight:"900",color:"#5633a8"},
  title:{fontSize:28,fontWeight:"900",textAlign:"center",marginTop:12},
  subtitle:{fontSize:16,color:"#555",textAlign:"center",lineHeight:22,marginTop:8},
  qrWrap:{padding:22,backgroundColor:"white",marginTop:20},
  bonusBox:{backgroundColor:"#e9f7ed",borderColor:"#91c9a1",borderWidth:1,borderRadius:12,padding:14,width:"100%",marginTop:8},
  bonusTitle:{color:"#1f7135",fontWeight:"900",textAlign:"center"},
  bonusText:{color:"#356244",textAlign:"center",lineHeight:20,marginTop:5},
  footer:{fontSize:13,color:"#666",textAlign:"center",marginTop:15},
  printButton:{width:"100%",maxWidth:520,backgroundColor:"#222",padding:16,borderRadius:12,marginTop:16},
  printButtonText:{color:"white",fontWeight:"900",textAlign:"center"},
  notice:{width:"100%",maxWidth:520,backgroundColor:"#fff4d6",padding:16,borderRadius:12,marginTop:16}
});
