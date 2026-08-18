import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Glyph,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Admin Dashboard Stage 2: one trustworthy overview, with each editing job
// kept on the screen that owns it. The dashboard asks PostgREST only for exact
// row counts. In particular, it never tries to infer a claims.user_id ->
// profiles relationship: claims.user_id points to auth.users, not profiles.
//
// AN ADMIN CONSOLE IS AN INSTRUMENT PANEL, and this is the panel: twelve
// gauges reading the database, then the tools that act on them. Nothing here is
// a place, so no state ink appears -- the four queues that need attention step
// up a surface and strengthen their edge instead of turning blue, which is what
// the old `claimMetric` did with INK.water, a MAP TERRAIN colour.

const OVERVIEW=[
  {key:"claims",table:"claims",label:"Pending claims",status:"pending",route:"/admin/claims"},
  {key:"capabilityRequests",table:"manager_capability_requests",label:"Access requests",status:"pending",route:"/admin/claims"},
  {key:"businesses",table:"businesses",label:"Businesses",route:"/admin/listings?type=businesses"},
  {key:"properties",table:"properties",label:"Properties",route:"/admin/listings?type=properties"},
  {key:"publicPlaces",table:"public_places",label:"Public places",route:"/admin/listings?type=public_places"},
  {key:"activityClubs",table:"activity_clubs",label:"Activity clubs",route:"/admin/listings?type=activity_clubs"},
  {key:"events",table:"events",label:"Events",route:"/admin/listings?type=events"},
  {key:"socialReports",table:"social_reports",label:"Open social reports",status:"open",route:"/admin/moderation"},
  {key:"safetyReports",table:"live_safety_reports",label:"Open safety reports",status:"open",route:"/admin/moderation"},
  {key:"explorers",table:"profiles",label:"Explorers",route:"/admin/explorers"},
  {key:"geoAreas",table:"geo_areas",label:"Canonical areas",route:"/admin/areas"},
  {key:"auditEntries",table:"admin_audit_log",label:"Audit records",route:"/admin/audit"}
];

const NEEDS_ATTENTION=["claims","capabilityRequests","socialReports","safetyReports"];

// One gauge on the panel: what the app measured, then what it measured.
//
// The kit's Readout sets the caption above the value, which is right for a
// strip of two or three. In a grid of twelve the eye scans the numbers first,
// so this puts the numeral on top -- see the note in the final report; a
// `Readout` with a settable order would let this go back to the kit.
function Gauge({value,label,attention,accessibilityLabel,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({pressed})=>[styles.gaugeWrap,pressed && styles.pressed]}
    >
      <Panel raised={attention} style={[styles.gauge,attention && styles.gaugeAttention]}>
        <Text style={styles.gaugeValue}>{value}</Text>
        <Text style={styles.gaugeLabel} numberOfLines={2}>{label}</Text>
      </Panel>
    </Pressable>
  );
}

// A tool, as one row of the panel. Row computes its own accessibility label
// from its text, and these have to keep the exact labels the console was built
// with, so the Pressable outside carries it.
function Tool({label,title,detail,glyph,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed})=>pressed ? styles.pressed : null}
    >
      <Row
        glyph={glyph}
        title={title}
        sub={detail}
        right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
      />
    </Pressable>
  );
}

export default function AdminDashboard(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const [counts,setCounts]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setCounts(null);

    try{
      const results=await Promise.all(OVERVIEW.map(async(item)=>{
        let query=supabase.from(item.table).select("id",{count:"exact",head:true});
        if(item.status) query=query.eq("status",item.status);

        const {count,error:countError}=await query;
        return{...item,count,error:countError};
      }));

      if(results.some((result)=>result.error || typeof result.count!=="number")){
        setError("One or more database checks failed, so no totals are shown.");
        return;
      }

      setCounts(Object.fromEntries(results.map((result)=>[result.key,result.count])));
    }catch{
      setError("One or more database checks failed, so no totals are shown.");
    }finally{
      setLoading(false);
    }
  },[allowed]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  if(checking){
    return(
      <Screen style={styles.fullState}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.stateText}>Checking admin access…</Text>
      </Screen>
    );
  }

  if(!allowed){
    return(
      <Screen>
        <ScreenTitle eyebrow="Admin" title="Admin access required"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Refused">
            {gateError || "An admin account is required to open this screen."}
          </Notice>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom:Math.max(insets.bottom,24)+CREATE_HUB_CLEARANCE}
        ]}
      >
        <ScreenTitle
          eyebrow="Admin overview"
          title="What needs attention"
          meta="Live totals from the database, followed by the admin tools that are ready to use."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading the latest totals…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Overview could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading the admin overview again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <SectionRule label="Readings" meta={String(OVERVIEW.length)}/>

              <View style={styles.gaugeGrid}>
                {OVERVIEW.map((item)=>(
                  <Gauge
                    key={item.key}
                    value={counts[item.key]}
                    label={item.label}
                    attention={NEEDS_ATTENTION.includes(item.key)}
                    accessibilityLabel={`Open ${item.label}: ${counts[item.key]}`}
                    onPress={()=>router.push(item.route)}
                  />
                ))}
              </View>

              <SectionRule label="Admin tools"/>

              <Tool
                glyph="list"
                label="Browse all listings"
                title="Browse all listings"
                detail="Search businesses, properties, public places, clubs and events."
                onPress={()=>router.push("/admin/listings")}
              />

              <Tool
                glyph="key"
                label="Review claims and Manager access"
                title="Review claims & Manager access"
                detail={`${counts.claims} ${counts.claims===1 ? "claim" : "claims"} and ${counts.capabilityRequests} ${counts.capabilityRequests===1 ? "access request" : "access requests"} are waiting.`}
                onPress={()=>router.push("/admin/claims")}
              />

              <Tool
                glyph="calendar"
                label="Manage clubs and events"
                title="Manage clubs & events"
                detail="Publish, hide, close or cancel activity with an audit reason."
                onPress={()=>router.push("/admin/activities")}
              />

              <Tool
                glyph="shield"
                label="Review moderation reports"
                title="Review moderation reports"
                detail={`${counts.socialReports+counts.safetyReports} open ${counts.socialReports+counts.safetyReports===1 ? "report" : "reports"} need review.`}
                onPress={()=>router.push("/admin/moderation")}
              />

              <Tool
                glyph="people"
                label="Browse Explorer directory"
                title="Browse Explorer directory"
                detail="Inspect account roles and active Manager capabilities without private contact fields."
                onPress={()=>router.push("/admin/explorers")}
              />

              <Tool
                glyph="map"
                label="Inspect areas and data quality"
                title="Inspect areas & data quality"
                detail="Find unmatched area and Place values or inconsistent listing ownership without automatic repairs."
                onPress={()=>router.push("/admin/areas")}
              />

              <Tool
                glyph="clipboard"
                label="View admin audit history"
                title="View audit history"
                detail={`${counts.auditEntries} recorded admin ${counts.auditEntries===1 ? "decision" : "decisions"}.`}
                onPress={()=>router.push("/admin/audit")}
              />

              <Tool
                glyph="pin"
                label="Manage public places"
                title="Manage public places"
                detail="Add, edit or hide parks, beaches and other public places."
                onPress={()=>router.push("/admin/public-places")}
              />

              <Action
                kind="secondary"
                glyph="refresh"
                label="Refresh overview"
                accessibilityLabel="Refresh admin overview"
                onPress={load}
                style={styles.refresh}
              />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{},
  body:{paddingHorizontal:16},
  fullState:{alignItems:"center",justifyContent:"center",gap:12,padding:32},
  stateText:{
    maxWidth:320,color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,textAlign:"center"
  },

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  gaugeGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},
  gaugeWrap:{width:"48%"},
  gauge:{minHeight:96,justifyContent:"space-between",padding:13},
  gaugeAttention:{borderColor:INK.hairlineStrong},
  gaugeValue:{color:INK.readout,fontSize:30,fontWeight:"700",letterSpacing:-1},
  gaugeLabel:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:6},

  refresh:{marginTop:12},
  pressed:{opacity:0.78}
});
