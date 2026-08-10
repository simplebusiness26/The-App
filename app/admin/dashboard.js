import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {INK} from "../../utils/tokens";

// Admin Dashboard Stage 2: one trustworthy overview, with each editing job
// kept on the screen that owns it. The dashboard asks PostgREST only for exact
// row counts. In particular, it never tries to infer a claims.user_id ->
// profiles relationship: claims.user_id points to auth.users, not profiles.
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
      <View style={styles.fullState}>
        <ActivityIndicator size="large" color={INK.ink}/>
        <Text style={styles.stateText}>Checking admin access…</Text>
      </View>
    );
  }

  if(!allowed){
    return(
      <View style={styles.fullState}>
        <Text style={styles.deniedTitle}>Admin access required</Text>
        <Text style={styles.stateText}>
          {gateError || "An admin account is required to open this screen."}
        </Text>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content,{paddingBottom:Math.max(insets.bottom,24)+32}]}
    >
      <Text style={styles.eyebrow}>ADMIN OVERVIEW</Text>
      <Text style={styles.title}>What needs attention</Text>
      <Text style={styles.intro}>
        Live totals from the database, followed by the admin tools that are ready to use.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading the latest totals…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Overview could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading the admin overview again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.metricGrid}>
            {OVERVIEW.map((item)=>(
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}: ${counts[item.key]}`}
                onPress={()=>router.push(item.route)}
                style={({pressed})=>[
                  styles.metricCard,
                  ["claims","capabilityRequests","socialReports","safetyReports"].includes(item.key) && styles.claimMetric,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.metricNumber}>{counts[item.key]}</Text>
                <Text style={styles.metricLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Admin tools</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse all listings"
            onPress={()=>router.push("/admin/listings")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Browse all listings</Text>
              <Text style={styles.toolDetail}>Search businesses, properties, public places, clubs and events.</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review claims and Manager access"
            onPress={()=>router.push("/admin/claims")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Review claims & Manager access</Text>
              <Text style={styles.toolDetail}>
                {`${counts.claims} ${counts.claims===1 ? "claim" : "claims"} and ${counts.capabilityRequests} ${counts.capabilityRequests===1 ? "access request" : "access requests"} are waiting.`}
              </Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage clubs and events"
            onPress={()=>router.push("/admin/activities")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Manage clubs & events</Text>
              <Text style={styles.toolDetail}>Publish, hide, close or cancel activity with an audit reason.</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review moderation reports"
            onPress={()=>router.push("/admin/moderation")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Review moderation reports</Text>
              <Text style={styles.toolDetail}>
                {`${counts.socialReports+counts.safetyReports} open ${counts.socialReports+counts.safetyReports===1 ? "report" : "reports"} need review.`}
              </Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse Explorer directory"
            onPress={()=>router.push("/admin/explorers")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Browse Explorer directory</Text>
              <Text style={styles.toolDetail}>Inspect account roles and active Manager capabilities without private contact fields.</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Inspect areas and data quality"
            onPress={()=>router.push("/admin/areas")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Inspect areas & data quality</Text>
              <Text style={styles.toolDetail}>Find unmatched area and Place values or inconsistent listing ownership without automatic repairs.</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View admin audit history"
            onPress={()=>router.push("/admin/audit")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>View audit history</Text>
              <Text style={styles.toolDetail}>{`${counts.auditEntries} recorded admin ${counts.auditEntries===1 ? "decision" : "decisions"}.`}</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage public places"
            onPress={()=>router.push("/admin/public-places")}
            style={({pressed})=>[styles.toolCard,pressed && styles.pressed]}
          >
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>Manage public places</Text>
              <Text style={styles.toolDetail}>Add, edit or hide parks, beaches and other public places.</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh admin overview"
            onPress={load}
            style={({pressed})=>[styles.refreshButton,pressed && styles.pressed]}
          >
            <Text style={styles.refreshText}>Refresh overview</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{
    flex:1,
    backgroundColor:INK.paper
  },
  content:{
    paddingHorizontal:20,
    paddingTop:28
  },
  fullState:{
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    gap:12,
    padding:32,
    backgroundColor:INK.paper
  },
  stateText:{
    maxWidth:320,
    color:INK.inkSoft,
    fontSize:16,
    lineHeight:23,
    textAlign:"center"
  },
  deniedTitle:{
    color:INK.ink,
    fontSize:24,
    fontWeight:"800"
  },
  eyebrow:{
    color:INK.inkSoft,
    fontSize:12,
    fontWeight:"800",
    letterSpacing:1.4,
    marginBottom:9
  },
  title:{
    color:INK.ink,
    fontSize:34,
    fontWeight:"900",
    letterSpacing:-1.2,
    lineHeight:38
  },
  intro:{
    color:INK.inkSoft,
    fontSize:16,
    lineHeight:23,
    marginTop:10,
    marginBottom:24
  },
  panel:{
    minHeight:150,
    alignItems:"center",
    justifyContent:"center",
    gap:12,
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:24
  },
  panelText:{
    color:INK.inkSoft,
    fontSize:15
  },
  errorPanel:{
    borderColor:INK.ink,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:22
  },
  errorTitle:{
    color:INK.ink,
    fontSize:21,
    fontWeight:"800"
  },
  errorText:{
    color:INK.inkSoft,
    fontSize:15,
    lineHeight:22,
    marginTop:8
  },
  primaryButton:{
    alignItems:"center",
    borderRadius:14,
    backgroundColor:INK.ink,
    marginTop:18,
    paddingHorizontal:18,
    paddingVertical:14
  },
  primaryButtonText:{
    color:INK.paper,
    fontSize:16,
    fontWeight:"800"
  },
  metricGrid:{
    flexDirection:"row",
    flexWrap:"wrap",
    gap:10
  },
  metricCard:{
    width:"48%",
    minHeight:116,
    justifyContent:"space-between",
    borderColor:INK.hair,
    borderRadius:18,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:17
  },
  claimMetric:{
    backgroundColor:INK.water
  },
  metricNumber:{
    color:INK.ink,
    fontSize:34,
    fontWeight:"900",
    letterSpacing:-1
  },
  metricLabel:{
    color:INK.inkSoft,
    fontSize:14,
    fontWeight:"700",
    lineHeight:18
  },
  sectionTitle:{
    color:INK.ink,
    fontSize:22,
    fontWeight:"900",
    marginBottom:12,
    marginTop:32
  },
  toolCard:{
    minHeight:96,
    flexDirection:"row",
    alignItems:"center",
    borderColor:INK.hair,
    borderRadius:18,
    borderWidth:1,
    backgroundColor:INK.card,
    marginBottom:10,
    paddingHorizontal:18,
    paddingVertical:16
  },
  toolCopy:{
    flex:1,
    paddingRight:12
  },
  toolTitle:{
    color:INK.ink,
    fontSize:17,
    fontWeight:"800"
  },
  toolDetail:{
    color:INK.inkSoft,
    fontSize:14,
    lineHeight:19,
    marginTop:5
  },
  arrow:{
    color:INK.ink,
    fontSize:34,
    fontWeight:"300"
  },
  refreshButton:{
    alignItems:"center",
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    marginTop:10,
    paddingHorizontal:18,
    paddingVertical:14
  },
  refreshText:{
    color:INK.ink,
    fontSize:15,
    fontWeight:"800"
  },
  pressed:{
    opacity:0.68
  }
});
