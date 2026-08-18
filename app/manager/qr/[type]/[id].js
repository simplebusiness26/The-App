import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView
} from "react-native";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../../services/supabase";
import QRCodeGenerator from "../../../../components/QRCodeGenerator";
import {CREATE_HUB_CLEARANCE} from "../../../../components/CreateHub";
import {INK,TYPE} from "../../../../utils/tokens";
import {
  Action,
  Glyph,
  KeyValue,
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../../../components/instrument";

// The code a manager prints and sticks on a wall.
//
// Everything on this page is housing except the code itself, which keeps its
// own white quiet zone because a scanner needs one -- see
// components/QRCodeGenerator.js. The scoring line underneath used to be one
// run-on sentence with middots in it; it is four measured facts, so it is four
// KeyValue lines.

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
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
      </Screen>
    );
  }

  if(error || !listing || !reviewCode){
    return(
      <Screen>
        <ScreenTitle eyebrow="Printable code" title="Code unavailable"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Not loaded">{error || "Listing not found"}</Notice>
        </View>
      </Screen>
    );
  }

  const qrUrl=`${publicAppBase()}/qr/${encodeURIComponent(reviewCode)}`;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow={`${listing._label} · printable code`}
          title={listing._name}
          meta="Scan while you’re here to leave a verified review."
        />

        <View style={styles.body}>
          <Panel style={styles.sheet}>
            <View style={styles.head}>
              <Text style={styles.brand}>Xplorer</Text>
              <View style={styles.headLine}/>
              <Text style={styles.headCode}>{reviewCode}</Text>
            </View>

            <View style={styles.qrWrap}>
              <QRCodeGenerator value={qrUrl} size={232}/>
            </View>

            <View style={styles.bonusRow}>
              <Glyph name="check" size={15} colour={INK.readoutSoft} weight={1.8}/>
              <Text style={styles.bonusLabel}>Verified visit</Text>
            </View>
            <Text style={styles.bonusText}>
              A valid on-site scan adds 3 points to an eligible Explorer review.
            </Text>
          </Panel>

          <SectionRule label="What a review scores"/>

          <Panel style={styles.scores}>
            <KeyValue label="Text" value="1"/>
            <KeyValue label="Images" value="3"/>
            <KeyValue label="Video" value="6"/>
            <KeyValue label="Verified scan" value="+3"/>
          </Panel>

          {Platform.OS==="web" ? (
            <Action
              kind="primary"
              glyph="download"
              label="Print verified review QR"
              accessibilityLabel="Print the verified review QR code"
              onPress={printPage}
              style={styles.print}
            />
          ) : (
            <Notice tone="exists" label="Printing">
              Open this page in the web preview to use your browser’s print option.
            </Notice>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center"},

  sheet:{padding:16,alignItems:"center",marginTop:4},
  head:{flexDirection:"row",alignItems:"center",gap:9,alignSelf:"stretch",marginBottom:14},
  brand:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.4},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headCode:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,flexShrink:1},

  qrWrap:{marginBottom:16},

  bonusRow:{flexDirection:"row",alignItems:"center",gap:7},
  bonusLabel:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},
  bonusText:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,textAlign:"center",marginTop:6
  },

  scores:{paddingHorizontal:13,paddingVertical:4},
  print:{marginTop:16}
});
