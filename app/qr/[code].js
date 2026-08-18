import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Frame,
  Glyph,
  KeyValue,
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Where a scanned code lands.
//
// It is the far end of the viewfinder, so it reads like one: the listing sits
// in a Frame with the same brackets the camera draws round its feed, and the
// reading the app took -- the code resolved, the listing it points at, the
// bonus it is worth -- is mono and measured.
//
// The old version opened with a 78px green disc holding a tick set at 43px. A
// tick in a coloured circle is a sticker; a checked reading on the housing is
// an instrument saying it got a clean scan.

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
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
      </Screen>
    );
  }

  if(error && !listing){
    return(
      <Screen>
        <ScreenTitle eyebrow="On-site scan" title="QR code unavailable"/>
        <View style={styles.body}>
          <Notice
            tone="exists"
            label="Code not read"
            action={
              <Action
                kind="secondary"
                glyph="home"
                label="Return home"
                accessibilityLabel="Return home"
                onPress={()=>router.replace("/")}
              />
            }
          >
            {error}
          </Notice>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="On-site Xplorer scan"
          title="Verified visit ready"
          meta={`Continue to leave a review for this ${listing._config.label.toLowerCase()} and add the verified-visit bonus.`}
        />

        <View style={styles.body}>
          {/* The clean reading, stated once, on the housing. */}
          <View style={styles.readingRow}>
            <View style={styles.readingGlyph}>
              <Glyph name="check" size={16} colour={INK.readoutSoft} weight={1.8}/>
            </View>
            <Text style={styles.readingLabel}>Code matched</Text>
            <View style={styles.readingLine}/>
            <Text style={styles.readingCode} numberOfLines={1}>{code}</Text>
          </View>

          <Panel style={styles.card}>
            <Frame ratio={16/9} style={styles.media}>
              {listing._image
                ? <Image source={{uri:listing._image}} style={styles.image}/>
                : <Glyph name="pin" size={30} colour={INK.readoutFaint}/>}
            </Frame>

            <Text style={styles.type}>{listing._config.label}</Text>
            <Text style={styles.name} numberOfLines={2}>{listing.name}</Text>
          </Panel>

          <SectionRule label="What this scan is worth"/>

          <Panel style={styles.scores}>
            <KeyValue label="Verified-visit bonus" value="+3"/>
            <KeyValue label="Applies once" value="Per review"/>
          </Panel>

          <Text style={styles.scoreNote}>
            This bonus is added once the review publishes and the code matches this listing.
          </Text>

          {!!error && <Notice tone="exists" label="Code not read">{error}</Notice>}

          <Action
            kind="primary"
            glyph={user ? "forward" : "key"}
            label={user ? "Continue to verified review" : "Log in to continue"}
            accessibilityLabel={user ? "Continue to verified review" : "Log in to continue"}
            onPress={continueToReview}
            style={styles.continue}
          />

          <Text style={styles.ruleText}>
            The QR bonus can only be used once per review. The review must satisfy Xplorer’s normal eligibility rules.
          </Text>
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

  readingRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:6,marginBottom:12},
  readingGlyph:{
    width:30,height:30,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  readingLabel:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},
  readingLine:{flex:1,height:1,backgroundColor:INK.hairline},
  readingCode:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,maxWidth:120},

  card:{padding:12},
  media:{alignSelf:"stretch"},
  image:{width:"100%",height:"100%"},
  type:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md,marginTop:12},
  name:{
    color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",
    letterSpacing:-0.5,marginTop:4
  },

  scores:{paddingHorizontal:13,paddingVertical:4},
  scoreNote:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:8,marginBottom:14
  },

  continue:{marginTop:4},
  ruleText:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,textAlign:"center",marginTop:14
  }
});
