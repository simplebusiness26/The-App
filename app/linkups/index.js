import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Link,router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {effectiveLinkupStatus,formatDateTime,statusLabel,timeUntil} from "../../utils/linkups";
import {INK,TYPE} from "../../utils/tokens";
import {audienceShortLabel} from "../../utils/audience";
import {
  Action,
  Chip,
  Empty,
  Glyph,
  Meter,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// Link-ups: somebody proposing a thing to do at a time, and the people who said
// yes. The most time-bound object in the app, so it is the clearest case for the
// amber `scheduled` edge -- what a Link-up IS, is a thing that is about to
// happen and then stops existing.
//
// WHAT CHANGED
//
// It was a stack of shadowed boxes, three filled-ink tab pills, a handshake
// emoji over the empty state, a map pin before the place and a satellite dish
// on the "Open Live Nearby" button. The capacity -- "3/8 joined", the number
// that decides whether it is worth tapping -- was a small bold body line in the
// bottom corner.
//
// Now: the kit's detented Segmented for the three lists, a Row per Link-up
// carrying the countdown in the mono meta column, and the spaces read off a
// METER. A meter is the right instrument for a capacity: you can see a Link-up
// is nearly full without doing the division, which is the whole difference
// between a reading and a pair of numbers.

const FILTERS=[
  {key:"discover",label:"Discover"},
  {key:"joined",label:"Joined"},
  {key:"mine",label:"Created"}
];

export default function LinkupsIndex(){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [items,setItems]=useState([]);
  const [joinedIds,setJoinedIds]=useState(new Set());
  const [creators,setCreators]=useState({});
  const [filter,setFilter]=useState("discover");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);

    await supabase.rpc("refresh_live_system");
    const [profileResult,linkupResult,attendeeResult]=await Promise.all([
      supabase.from("profiles").select("area").eq("id",currentUser.id).maybeSingle(),
      supabase.from("linkups").select("*").order("starts_at",{ascending:true}).limit(100),
      supabase.from("linkup_attendees").select("linkup_id,status").eq("user_id",currentUser.id).eq("status","joined")
    ]);

    setProfile(profileResult.data);
    if(linkupResult.error){setError(linkupResult.error.message);setItems([]);}
    else{
      const rows=linkupResult.data || [];
      setItems(rows);
      const ids=[...new Set(rows.map(item=>item.creator_id))];
      if(ids.length){
        const {data}=await supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").in("id",ids);
        setCreators(Object.fromEntries((data || []).map(item=>[item.id,item])));
      }else setCreators({});
    }
    setJoinedIds(new Set((attendeeResult.data || []).map(item=>item.linkup_id)));
    setLoading(false);
    setRefreshing(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>{
    const now=Date.now();
    return items.filter(item=>{
      if(filter==="mine") return item.creator_id===user?.id;
      if(filter==="joined") return joinedIds.has(item.id) && item.creator_id!==user?.id;
      return item.creator_id!==user?.id && !joinedIds.has(item.id) && new Date(item.ends_at).getTime()>now && !["cancelled","completed"].includes(item.status);
    });
  },[items,filter,user,joinedIds]);

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></Screen>;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
        <ScreenTitle
          eyebrow="MEET LOCALLY"
          title="Link-ups"
          meta="Create something to do, join local Explorers and keep the plan together in a private board."
        />

        <View style={styles.body}>
          {/* A real Link, not a press handler -- scripts/verify-linkup-create
              -navigation.cjs pins that, because press-only navigation is what
              broke this control once already. The Action inside supplies the
              geometry and is held out of the touch path, so the tap belongs to
              the Link that owns the route. */}
          <Link href="/linkups/create" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Create Link-up" testID="create-linkup-button">
              <View pointerEvents="none">
                <Action kind="primary" label="Create Link-up" glyph="plus"/>
              </View>
            </Pressable>
          </Link>

          {!!error && <Notice tone="dispute" label="NOT LOADED">{error}</Notice>}

          <View style={styles.selector}>
            <Segmented items={FILTERS} active={filter} onChange={setFilter}/>
          </View>

          <SectionRule label={FILTERS.find(item=>item.key===filter)?.label || "Link-ups"} meta={String(filtered.length)}/>

          {filtered.length===0 && (
            <Empty
              title="No Link-ups here yet"
              instruction={filter==="discover"
                ? "Create the first one, or check Live Nearby for things happening today."
                : "Your Link-ups will appear here."}
              glyph="people"
            />
          )}

          {filtered.map(item=>{
            const status=effectiveLinkupStatus(item);
            const creator=creators[item.creator_id];
            const joined=Number(item.attendee_count || 0);
            const capacity=Number(item.max_attendees || 0);

            return(
              <Row
                key={item.id}
                tone="scheduled"
                glyph="people"
                title={item.title}
                sub={item.description}
                meta={String(timeUntil(item.starts_at) || "").toUpperCase()}
                metaSub={statusLabel(status).toUpperCase()}
                onPress={()=>router.push(`/linkups/${item.id}`)}
              >
                <View style={styles.foot}>
                  {!!item.category && <Chip label={item.category} style={styles.chip}/>}
                  <View style={styles.footCell}>
                    <Glyph name="pin" size={11} colour={INK.readoutFaint}/>
                    <Text style={styles.footText} numberOfLines={1}>{item.location_name}, {item.area}</Text>
                  </View>
                </View>

                <Text style={styles.when} numberOfLines={1}>{formatDateTime(item.starts_at)}</Text>

                {/* Spaces left, read off a track. "3/8 joined" makes you do the
                    division; a meter shows you a nearly-full Link-up at a
                    glance, which is the difference between a reading and a
                    pair of numbers. */}
                {capacity>0 && (
                  <View style={styles.capacity} accessibilityLabel={`${joined} of ${capacity} places taken`}>
                    <Meter value={joined} max={capacity} width={96} tone="scheduled" label="JOINED"/>
                    <Text style={styles.capacityValue}>{joined}/{capacity}</Text>
                  </View>
                )}

                <View style={styles.byline}>
                  <Text style={styles.creator} numberOfLines={1}>By {creator?.full_name || "Explorer"}</Text>
                  {/* Anything narrower than everyone gets said out loud. The
                      test was against "followers", a word Link-ups no longer
                      hold, so this had silently stopped appearing at all. */}
                  {item.visibility!=="everyone" && (
                    <View style={styles.audience}>
                      <Glyph name="lock" size={11} colour={INK.readoutFaint}/>
                      <Text style={styles.audienceText}>{audienceShortLabel(item.visibility)} only</Text>
                    </View>
                  )}
                </View>
              </Row>
            );
          })}

          <SectionRule label="Also"/>
          <Action
            kind="secondary"
            label="Open Live Nearby"
            glyph="live"
            accessibilityLabel="Open Live Nearby"
            onPress={()=>router.push("/live")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// The only saturated colour on this screen is the state edge each Row carries.
// Upcoming / full / cancelled / completed are not states the token table names,
// so they stay on the readout greys and are told apart by the word -- which is
// what the mono meta column is for.
const styles=StyleSheet.create({
  center:{alignItems:"center",justifyContent:"center"},
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},

  selector:{marginTop:16,marginHorizontal:-12},

  foot:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8,marginTop:8},
  footCell:{flexDirection:"row",alignItems:"center",gap:4,flexShrink:1},
  footText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6,flexShrink:1
  },
  chip:{minHeight:24,paddingVertical:3},
  when:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8,marginTop:7
  },

  capacity:{flexDirection:"row",alignItems:"center",gap:8,marginTop:9},
  capacityValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},

  byline:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:9},
  creator:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,flexShrink:1},
  audience:{flexDirection:"row",alignItems:"center",gap:4},
  audienceText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8
  }
});
