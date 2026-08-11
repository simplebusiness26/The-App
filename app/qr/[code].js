import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";

const CONFIG={
  business:{table:"businesses",select:"id,name,image,photos",label:"Business",route:"business/review",image:(row)=>row?.image || row?.photos?.[0]},
  property:{table:"properties",select:"id,name,photos",label:"Property",route:"property/review",image:(row)=>row?.photos?.[0]},
  activity_club:{table:"activity_clubs",select:"id,name,image_url",label:"Activity Club",route:"activity-clubs/review",image:(row)=>row?.image_url},
  event:{table:"events",select:"id,name,image_url,starts_at,status",label:"Event",route:"events/review",image:(row)=>row?.image_url}
};

export default function VerifiedReviewQR(){
  const params=useLocalSearchParams();
  const code=Array.isArray(params.code) ? params.code[0] : params.code;
  const [listing,setListing]=useState(null);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(code) loadCode();
  },[code]));

  async function loadCode(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    let profileRow=null;
    if(currentUser){
      const {data}=await supabase.from("profiles").select("id").eq("id",currentUser.id).single();
      profileRow=data || null;
    }
    setProfile(profileRow);

    const {data:resolved,error:resolveError}=await supabase.rpc("resolve_listing_qr_code",{p_code:code});
    const qrTarget=resolved?.[0];

    if(resolveError || !qrTarget){
      setError("This Xplorer QR code is invalid or has been disabled.");
      setLoading(false);
      return;
    }

    const config=CONFIG[qrTarget.target_type];
    if(!config){
      setError("This QR code points to an unsupported listing.");
      setLoading(false);
      return;
    }

    const {data:listingRow,error:listingError}=await supabase
      .from(config.table)
      .select(config.select)
      .eq("id",qrTarget.target_id)
      .single();

    if(listingError || !listingRow){
      setError("The listing connected to this QR code could not be loaded.");
      setLoading(false);
      return;
    }

    setListing({...listingRow,_config:config,_image:config.image(listingRow)});
    setLoading(false);
  }

  function continueToReview(){
    const next=`/qr/${encodeURIComponent(code)}`;
    if(!user){
      router.push({pathname:"/auth/login",params:{next}});
      return;
    }

    router.replace({pathname:`/${listing._config.route}/${listing.id}`,params:{qr:code}});
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  if(error && !listing){
    return <View style={styles.center}><Text style={styles.errorTitle}>QR code unavailable</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.secondaryButton} onPress={()=>router.replace("/")}><Text style={styles.secondaryText}>Return home</Text></Pressable></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.verifiedIcon}><Text style={styles.check}>✓</Text></View>
      <Text style={styles.eyebrow}>ON-SITE GUESTBOOK SCAN</Text>
      <Text style={styles.title}>Verified visit ready</Text>
      <Text style={styles.subtitle}>Continue to leave a review for this {listing._config.label.toLowerCase()} and add the verified-visit bonus.</Text>

      <View style={styles.listingCard}>
        {listing._image ? <Image source={{uri:listing._image}} style={styles.image}/> : <View style={styles.imageFallback}><Text style={styles.pin}>📍</Text></View>}
        <Text style={styles.type}>{listing._config.label.toUpperCase()}</Text>
        <Text style={styles.name}>{listing.name}</Text>
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsTitle}>+3 VERIFIED-VISIT POINTS</Text>
        <Text style={styles.pointsText}>This bonus is added once the review publishes and the code matches this listing.</Text>
      </View>

      {!!error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}

      <Pressable style={styles.primaryButton} onPress={continueToReview}>
        <Text style={styles.primaryText}>{user ? "Continue to verified review" : "Log in to continue"}</Text>
      </Pressable>

      <Text style={styles.ruleText}>The QR bonus can only be used once per review. The review must satisfy Xplorer’s normal eligibility rules.</Text>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:22,paddingBottom:60,alignItems:"center"},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},
  verifiedIcon:{width:78,height:78,borderRadius:39,backgroundColor:"#0c5a24",alignItems:"center",justifyContent:"center",marginTop:18},
  check:{color:"white",fontSize:43,fontWeight:"900"},
  eyebrow:{color:"#80d99d",fontWeight:"900",fontSize:11,letterSpacing:0.8,marginTop:18},
  title:{color:"white",fontSize:30,fontWeight:"900",textAlign:"center",marginTop:7},
  subtitle:{color:"#b7b7bf",fontSize:15,lineHeight:22,textAlign:"center",marginTop:8,maxWidth:520},
  listingCard:{width:"100%",maxWidth:520,backgroundColor:"#222226",borderColor:"#45454c",borderWidth:1,borderRadius:17,padding:14,marginTop:22},
  image:{width:"100%",height:180,borderRadius:12,backgroundColor:"#303036"},
  imageFallback:{width:"100%",height:150,borderRadius:12,backgroundColor:"#2b2935",alignItems:"center",justifyContent:"center"},
  pin:{fontSize:40},
  type:{color:"#a995e6",fontSize:10,fontWeight:"900",letterSpacing:0.7,marginTop:13},
  name:{color:"white",fontSize:22,fontWeight:"900",marginTop:4},
  pointsCard:{width:"100%",maxWidth:520,backgroundColor:"#173923",borderColor:"#2d7046",borderWidth:1,borderRadius:14,padding:15,marginTop:13},
  pointsTitle:{color:"#8fe1aa",fontWeight:"900",textAlign:"center"},
  pointsText:{color:"#b9d8c3",fontSize:12,lineHeight:18,textAlign:"center",marginTop:5},
  errorBox:{width:"100%",maxWidth:520,backgroundColor:"#3b171b",borderColor:"#80353d",borderWidth:1,borderRadius:12,padding:13,marginTop:13},
  errorBoxText:{color:"#ffb3bb",fontWeight:"700",textAlign:"center"},
  primaryButton:{width:"100%",maxWidth:520,backgroundColor:"#3212b6",padding:17,borderRadius:13,marginTop:18},
  primaryText:{color:"white",fontWeight:"900",textAlign:"center",fontSize:16},
  ruleText:{color:"#888891",fontSize:11,lineHeight:17,textAlign:"center",maxWidth:500,marginTop:13},
  errorTitle:{color:"white",fontSize:24,fontWeight:"900"},
  errorText:{color:"#bbb",textAlign:"center",lineHeight:22,marginTop:8},
  secondaryButton:{borderColor:"#66666e",borderWidth:1,borderRadius:11,paddingHorizontal:20,paddingVertical:12,marginTop:17},
  secondaryText:{color:"white",fontWeight:"800"}
});
