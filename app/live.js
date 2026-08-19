import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {AccessibilityInfo,ActivityIndicator,Animated,Easing,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {mapPreferences} from "../utils/mapPreferences";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {formatDateTime,timeUntil} from "../utils/linkups";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {
  Action,
  Dial,
  Empty,
  Field,
  Glyph,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented,
  fieldInputStyle
} from "../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";

// Live Nearby: the one screen in this app that is entirely about NOW.
//
// WHAT IT WAS, AND WHY THAT WAS WRONG
//
// A stack of 2px-bordered cards with hard offset shadows, an emoji in a circle
// at the front of every row -- a handshake, a map pin, a party popper, a runner,
// a star -- a satellite dish over the empty state, filled-ink pills for the
// filters, and another map pin welded in front of every area name. Recoloured
// dark it was still all of that, which is the exact failure
// docs/instrument-kit.md opens by naming.
//
// WHAT IT IS NOW
//
// Every reading on this screen is amber. `scheduled` is the design system's
// warm ink and it means "something is happening here"; a screen that is nothing
// but things happening is where that ink earns its keep, and it arrives as a
// StateEdge down the left of each Row rather than as a fill, so every label
// inside stays on the readout greys.
//
// The two range filters are DIALS. Distance and time window are a handful of
// stops each, which is exactly what a detented dial is for -- one drag to
// compare 5km against 50km instead of four separate taps at four separate
// pills, and every stop still individually tappable so the gesture is never the
// only route.
//
// THE ONE MOVING THING IN THE APP LIVES HERE. docs/design-system.md: "no
// ambient animation... the one exception: a slow pulse on a genuinely live
// reading (an active check-in, a session happening now)." Your own live
// check-in is precisely that, so it gets the lamp. Nothing else on this screen
// moves, and reduce-motion turns it off.

const TYPES=[
  {key:"all",label:"All"},{key:"linkup",label:"Link-ups"},{key:"checkin",label:"People"},{key:"event",label:"Events"},{key:"activity",label:"Activities"},{key:"place",label:"Places"}
];

// What used to be an emoji in a circle at the front of every row, as glyphs off
// the same 16x16 grid the map pins and the tab bar are drawn on.
// utils/linkups.js used to export liveItemIcon(), returning an emoji per type.
// It is gone; the mapping lives here, in drawn glyphs.
const TYPE_GLYPH={linkup:"people",checkin:"pin",event:"ticket",activity:"live",place:"building"};

// What the app measured about WHEN, for the mono meta column. "IN 2H",
// "TONIGHT 19:30", "NOW" -- short enough to sit beside a title and precise
// enough to act on, which a full "Mon, 4 Aug 2026, 19:30" is not.
function clockLabel(value){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  return String(timeUntil(value) || "").toUpperCase();
}

// A slow pulse on a genuinely live reading. The design system's single
// exception to "an instrument responds; it does not perform", and it is spent
// on the one thing this app exists to say.
function LiveLamp({size=9,colour=INK.scheduled}){
  const pulse=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    let alive=true;
    let loop=null;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduced)=>{
        if(!alive || reduced) return;
        loop=Animated.loop(Animated.sequence([
          Animated.timing(pulse,{toValue:0.25,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
          Animated.timing(pulse,{toValue:1,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:true})
        ]));
        loop.start();
      })
      .catch(()=>{});

    return()=>{alive=false;loop?.stop();};
  },[pulse]);

  return(
    <Animated.View
      pointerEvents="none"
      style={{width:size,height:size,borderRadius:SHAPE.radius.pill,backgroundColor:colour,opacity:pulse}}
    />
  );
}

export default function LiveDiscovery(){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [areaDraft,setAreaDraft]=useState("");
  const [areaFilter,setAreaFilter]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  // The default a person set in Account & Safety > Map & location. Read once,
  // as the STARTING position of this screen's own dial -- widening it here is
  // still a per-visit decision and does not write back.
  const [radius,setRadius]=useState(()=>mapPreferences().radiusKm);
  const [windowHours,setWindowHours]=useState(24);
  const [type,setType]=useState("all");
  const [items,setItems]=useState([]);
  const [currentCheckin,setCurrentCheckin]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [locating,setLocating]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async(showLoader=true,options={})=>{
    if(showLoader) setLoading(true);
    setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);
    const {data:profile}=await supabase.from("profiles").select("area").eq("id",currentUser.id).maybeSingle();
    const profileArea=profile?.area || "";
    const nextArea=options.area!==undefined?options.area:(areaFilter||profileArea);
    if(profileArea){
      setAreaDraft(current=>current||profileArea);
      setAreaFilter(current=>current||profileArea);
    }
    await supabase.rpc("refresh_live_system");
    const [{data:discovery,error:discoveryError},{data:checkin}]=await Promise.all([
      supabase.rpc("get_live_discovery",{
        p_area:nextArea.trim()||null,
        p_latitude:options.latitude!==undefined?options.latitude:latitude,
        p_longitude:options.longitude!==undefined?options.longitude:longitude,
        p_radius_km:radius,
        p_window_hours:windowHours
      }),
      supabase.from("live_checkins").select("*").eq("user_id",currentUser.id).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle()
    ]);
    if(discoveryError){setError(discoveryError.message);setItems([]);} else setItems(discovery || []);
    setCurrentCheckin(checkin || null);
    setLoading(false);setRefreshing(false);
  },[areaFilter,latitude,longitude,radius,windowHours]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>type==="all"?items:items.filter(item=>item.item_type===type),[items,type]);

  function applyArea(){
    const clean=areaDraft.trim();
    setAreaFilter(clean);
    load(false,{area:clean});
  }

  async function useLocation(){
    setLocating(true);setError("");
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const lat=Number(position.coords.latitude.toFixed(2));
      const lng=Number(position.coords.longitude.toFixed(2));
      setLatitude(lat);setLongitude(lng);
      await load(false,{latitude:lat,longitude:lng});
    }catch(locationError){setError(locationError.message || "Location could not be used.");}
    setLocating(false);
  }

  async function endCheckin(){
    if(!currentCheckin||working) return;
    setWorking(true);
    const {error:endError}=await supabase.rpc("end_live_checkin",{p_checkin_id:currentCheckin.id});
    setWorking(false);
    if(endError){showFeedback(endError.message,"error","Check-in not ended");return;}
    showFeedback("You are no longer shown as here now.","success","Checked out");
    await load(false);
  }

  async function reportCheckin(item){
    if(working) return;
    setWorking(true);
    const {error:reportError}=await supabase.rpc("report_live_safety",{p_target_type:"checkin",p_target_id:item.item_id,p_reason:"other",p_details:"Reported from Live Nearby"});
    setWorking(false);
    if(reportError) showFeedback(reportError.message,"error","Report not sent");
    else showFeedback("The live check-in was sent for review.","success","Report submitted");
  }

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></Screen>;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          eyebrow="HAPPENING NEARBY"
          title="Live Nearby"
          meta="Link-ups, check-ins, events and clubs in one view."
        />

        <View style={styles.body}>
          <View style={styles.heroActions}>
            <Action kind="primary" label="Create Link-up" glyph="plus" style={styles.heroAction} onPress={()=>router.push("/linkups/create")}/>
            <Action kind="secondary" label="Check in" glyph="pin" style={styles.heroAction} onPress={()=>router.push("/checkins/create")}/>
          </View>

          {!!error&&<Notice tone="dispute" label="NOT LOADED">{error}</Notice>}

          {/* Your own check-in is the only genuinely live reading on this
              screen, so it is the only thing that moves. */}
          {currentCheckin&&(
            <Notice
              tone="scheduled"
              label="YOU ARE CHECKED IN"
              action={<Action kind="quiet" label="End check-in" glyph="close" disabled={working} onPress={endCheckin}/>}
            >
              <View style={styles.checkinRow}>
                <LiveLamp/>
                <View style={styles.checkinText}>
                  <Text style={styles.checkinTitle} numberOfLines={2}>{currentCheckin.place_name}</Text>
                  <Text style={styles.checkinMeta} numberOfLines={2}>
                    {currentCheckin.activity} · expires {formatDateTime(currentCheckin.expires_at)}
                  </Text>
                </View>
              </View>
            </Notice>
          )}

          <SectionRule label="Where to look"/>

          <Field label="Area" hint="A town or a district, never a street.">
            <View style={styles.areaRow}>
              <TextInput
                value={areaDraft}
                onChangeText={setAreaDraft}
                onSubmitEditing={applyArea}
                placeholder="Town or area"
                placeholderTextColor={INK.readoutFaint}
                accessibilityLabel="Area to look in"
                style={[fieldInputStyle,styles.areaInput]}
              />
              <Action kind="quiet" label="Apply" style={styles.applyButton} onPress={applyArea}/>
            </View>
          </Field>

          <Action
            kind="secondary"
            label={latitude!=null?"Using approximate location":"Use approximate location"}
            glyph={latitude!=null?"check":"target"}
            loading={locating}
            disabled={locating}
            onPress={useLocation}
          />

          {/* Two dials, not eight pills. A range with a handful of stops is what
              a detented control is for, and every stop is still its own button. */}
          <View style={styles.dialRow}>
            <Text style={styles.dialLabel}>DISTANCE</Text>
            <Dial values={[5,15,25,50]} active={radius} onChange={setRadius} width={224} format={(value)=>`${value}KM`}/>
          </View>

          <View style={styles.dialRow}>
            <Text style={styles.dialLabel}>TIME WINDOW</Text>
            <Dial values={[6,24,72,168]} active={windowHours} onChange={setWindowHours} width={224} format={windowLabel}/>
          </View>

          <SectionRule label="Live now" meta={String(filtered.length)}/>

          <Segmented items={TYPES} active={type} onChange={setType} scroll/>

          {filtered.length===0&&(
            <Empty
              title="Nothing live in this view"
              instruction="Widen the area or time filters, or create the first Link-up."
              glyph="live"
            />
          )}

          {filtered.map(item=>(
            <View key={`${item.item_type}-${item.item_id}`}>
              <Row
                tone="scheduled"
                glyph={TYPE_GLYPH[item.item_type]||"live"}
                title={item.title}
                sub={item.subtitle}
                meta={clockLabel(item.starts_at)||"LIVE"}
                metaSub={item.distance_km!=null?`${item.distance_km} KM`:null}
                onPress={()=>router.push(item.deep_link)}
              >
                <View style={styles.rowFoot}>
                  <Text style={styles.rowKind}>{String(item.item_type).replace("_"," ")}</Text>
                  {!!item.area&&(
                    <View style={styles.rowFootCell}>
                      <Glyph name="pin" size={11} colour={INK.readoutFaint}/>
                      <Text style={styles.rowFootText} numberOfLines={1}>{item.area}</Text>
                    </View>
                  )}
                  {!!item.starts_at&&(
                    <View style={styles.rowFootCell}>
                      <Glyph name="clock" size={11} colour={INK.readoutFaint}/>
                      <Text style={styles.rowFootText} numberOfLines={1}>{formatDateTime(item.starts_at)}</Text>
                    </View>
                  )}
                  {!!item.action_label&&<Text style={styles.rowAction} numberOfLines={1}>{item.action_label}</Text>}
                </View>
              </Row>

              {/* Reporting somebody's presence is a safety control, never behind
                  a menu -- and only check-ins have a person behind them. */}
              {item.item_type==="checkin"&&(
                <Action kind="quiet" label="Report" glyph="flag" style={styles.report} disabled={working} onPress={()=>reportCheckin(item)}/>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function windowLabel(value){
  if(value<24) return `${value}H`;
  if(value===24) return "TODAY";
  if(value===72) return "3 DAYS";
  return "7 DAYS";
}

// Everything measured is mono; everything a person wrote is the body face. The
// only saturated colour on this screen is the state edge each Row carries and
// the lamp on your own live check-in -- both of which mean the same thing the
// map means by amber: something is happening here.
const styles=StyleSheet.create({
  center:{alignItems:"center",justifyContent:"center"},
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},

  heroActions:{flexDirection:"row",gap:8,marginTop:6,marginBottom:4},
  heroAction:{flex:1},

  checkinRow:{flexDirection:"row",alignItems:"flex-start",gap:9},
  checkinText:{flex:1,minWidth:0},
  checkinTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  checkinMeta:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3,lineHeight:TYPE.body.sizes.sm*1.5},

  areaRow:{flexDirection:"row",alignItems:"stretch"},
  areaInput:{flex:1},
  applyButton:{borderWidth:0,borderLeftWidth:SHAPE.border,borderLeftColor:INK.hairline,borderRadius:0,paddingHorizontal:14},

  dialRow:{alignItems:"center",gap:8,marginBottom:18},
  dialLabel:{
    alignSelf:"flex-start",color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md
  },

  rowFoot:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10,marginTop:7},
  rowFootCell:{flexDirection:"row",alignItems:"center",gap:4,flexShrink:1},
  rowFootText:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.6,flexShrink:1},
  rowKind:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1
  },
  rowAction:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.9,marginLeft:"auto"
  },

  report:{alignSelf:"flex-end",marginTop:-2,marginBottom:10}
});
