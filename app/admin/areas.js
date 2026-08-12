import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {INK} from "../../utils/tokens";

const AREA_COLUMNS="id,name,area_type,parent_area_id,slug,status";

const SOURCE_LABELS={
  profiles:"Explorers",
  businesses:"Businesses",
  properties:"Properties",
  public_places:"Public places",
  activity_clubs:"Activity clubs",
  events:"Events",
  linkups:"Link-ups",
  live_checkins:"Check-ins"
};

function pretty(value){
  return String(value || "unknown")
    .replace(/_/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

function sourceLabel(value){
  return SOURCE_LABELS[value] || pretty(value);
}

function listingRoute(issue){
  if(issue.listing_type==="business") return `/business/${issue.listing_id}`;
  if(issue.listing_type==="property") return `/property/${issue.listing_id}`;
  return null;
}

export default function AdminAreas(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const [areas,setAreas]=useState([]);
  const [unmatchedAreas,setUnmatchedAreas]=useState([]);
  const [unmatchedPlaces,setUnmatchedPlaces]=useState([]);
  const [ownershipIssues,setOwnershipIssues]=useState([]);
  const [missingAreaCounts,setMissingAreaCounts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setAreas([]);
    setUnmatchedAreas([]);
    setUnmatchedPlaces([]);
    setOwnershipIssues([]);
    setMissingAreaCounts([]);

    try{
      const [areaResult,unmatchedAreaResult,unmatchedPlaceResult,qualityResult]=await Promise.all([
        supabase
          .from("geo_areas")
          .select(AREA_COLUMNS)
          .order("area_type",{ascending:true})
          .order("name",{ascending:true}),
        supabase.rpc("get_unmatched_area_report"),
        supabase.rpc("get_unmatched_public_place_report"),
        supabase.rpc("admin_get_data_quality_report")
      ]);

      const firstError=[
        areaResult.error,
        unmatchedAreaResult.error,
        unmatchedPlaceResult.error,
        qualityResult.error
      ].find(Boolean);
      const quality=qualityResult.data;

      if(
        firstError
        || !Array.isArray(areaResult.data)
        || !Array.isArray(unmatchedAreaResult.data)
        || !Array.isArray(unmatchedPlaceResult.data)
        || !quality
        || !Array.isArray(quality.ownership_issues)
        || !Array.isArray(quality.missing_area_counts)
      ){
        throw new Error(firstError?.message || "The complete data-quality report was not returned.");
      }

      setAreas(areaResult.data);
      setUnmatchedAreas(unmatchedAreaResult.data);
      setUnmatchedPlaces(unmatchedPlaceResult.data);
      setOwnershipIssues(quality.ownership_issues);
      setMissingAreaCounts(quality.missing_area_counts);
    }catch(loadError){
      setError(loadError?.message || "Area and data-quality reports could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const areaNames=useMemo(()=>new Map(areas.map((area)=>[area.id,area.name])),[areas]);
  const missingAreaRows=missingAreaCounts.reduce(
    (sum,item)=>sum+(Number(item.row_count) || 0),
    0
  );

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
      contentContainerStyle={[styles.content,{paddingBottom:Math.max(insets.bottom,24)+40}]}
    >
      <Text style={styles.eyebrow}>ADMIN DATA QUALITY</Text>
      <Text style={styles.title}>Areas & data quality</Text>
      <Text style={styles.intro}>
        Read-only reports show what needs a human decision. They never guess an area or repair ownership automatically.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Checking canonical data…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Data-quality reports could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading area and data-quality reports again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{areas.length}</Text>
              <Text style={styles.metricLabel}>Canonical areas</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{missingAreaRows}</Text>
              <Text style={styles.metricLabel}>Rows without a canonical area</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricNumber}>{unmatchedPlaces.length}</Text>
              <Text style={styles.metricLabel}>Unmatched Place values</Text>
            </View>
            <View style={[styles.metricCard,ownershipIssues.length>0 && styles.attentionCard]}>
              <Text style={styles.metricNumber}>{ownershipIssues.length}</Text>
              <Text style={styles.metricLabel}>Ownership issues</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Canonical areas</Text>
          {areas.length===0 ? (
            <Text style={styles.emptyText}>No canonical areas exist yet.</Text>
          ) : areas.map((area)=>(
            <View key={area.id} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{area.name}</Text>
              <Text style={styles.rowMeta}>
                {`${pretty(area.area_type)} · State: ${pretty(area.status)}`}
              </Text>
              {!!area.parent_area_id && (
                <Text style={styles.rowMeta}>{`Inside ${areaNames.get(area.parent_area_id) || "unknown parent"}`}</Text>
              )}
            </View>
          ))}

          <Text style={styles.sectionTitle}>Canonical-area coverage</Text>
          {missingAreaCounts.length===0 ? (
            <Text style={styles.emptyText}>Every supported row has a canonical area.</Text>
          ) : missingAreaCounts.map((item)=>(
            <View key={item.source_table} style={styles.compactRow}>
              <Text style={styles.compactLabel}>{sourceLabel(item.source_table)}</Text>
              <Text style={styles.compactCount}>{item.row_count}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Unmatched area values</Text>
          {unmatchedAreas.length===0 ? (
            <Text style={styles.emptyText}>No unmatched area text remains.</Text>
          ) : unmatchedAreas.map((item,index)=>(
            <View key={`${item.source_table}-${item.raw_value}-${index}`} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{item.raw_value}</Text>
              <Text style={styles.rowMeta}>
                {`${sourceLabel(item.source_table)} · ${pretty(item.source_column)} · ${item.row_count} ${Number(item.row_count)===1 ? "row" : "rows"}`}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Unmatched Place values</Text>
          {unmatchedPlaces.length===0 ? (
            <Text style={styles.emptyText}>No unmatched park or public-Place text remains.</Text>
          ) : unmatchedPlaces.map((item,index)=>(
            <View key={`${item.place_type}-${item.raw_value}-${index}`} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{item.raw_value}</Text>
              <Text style={styles.rowMeta}>
                {`${pretty(item.place_type)} · ${item.row_count} ${Number(item.row_count)===1 ? "check-in" : "check-ins"}`}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Ownership integrity</Text>
          {ownershipIssues.length===0 ? (
            <Text style={styles.emptyText}>No listing ownership inconsistencies were found.</Text>
          ) : ownershipIssues.map((issue)=>{
            const route=listingRoute(issue);
            const Card=route ? Pressable : View;
            return(
              <Card
                key={issue.issue_id}
                accessibilityRole={route ? "button" : undefined}
                accessibilityLabel={route ? `Open data-quality issue for ${issue.listing_name}` : undefined}
                onPress={route ? ()=>router.push(route) : undefined}
                style={route
                  ? ({pressed})=>[styles.issueCard,pressed && styles.pressed]
                  : styles.issueCard
                }
              >
                <View style={styles.issueCopy}>
                  <Text style={styles.issueType}>{pretty(issue.issue_type).toUpperCase()}</Text>
                  <Text style={styles.rowTitle}>{issue.listing_name}</Text>
                  <Text style={styles.issueSummary}>{issue.summary}</Text>
                </View>
                {route && <Text style={styles.arrow} accessibilityElementsHidden>›</Text>}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{paddingHorizontal:20,paddingTop:28},
  fullState:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:32,backgroundColor:INK.paper},
  stateText:{maxWidth:320,color:INK.inkSoft,fontSize:16,lineHeight:23,textAlign:"center"},
  deniedTitle:{color:INK.ink,fontSize:24,fontWeight:"800"},
  eyebrow:{color:INK.inkSoft,fontSize:12,fontWeight:"800",letterSpacing:1.4,marginBottom:9},
  title:{color:INK.ink,fontSize:34,fontWeight:"900",letterSpacing:-1.2,lineHeight:38},
  intro:{color:INK.inkSoft,fontSize:16,lineHeight:23,marginBottom:22,marginTop:10},
  panel:{minHeight:150,alignItems:"center",justifyContent:"center",gap:12,borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:24},
  panelText:{color:INK.inkSoft,fontSize:15},
  errorPanel:{borderColor:INK.ink,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:22},
  errorTitle:{color:INK.ink,fontSize:21,fontWeight:"800"},
  errorText:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:8},
  primaryButton:{minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:INK.ink,marginTop:18,paddingHorizontal:18,paddingVertical:12},
  primaryButtonText:{color:INK.ink,fontSize:16,fontWeight:"800"},
  metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},
  metricCard:{width:"48%",minHeight:112,justifyContent:"space-between",borderColor:INK.hair,borderRadius:18,borderWidth:1,backgroundColor:INK.card,padding:17},
  attentionCard:{backgroundColor:INK.water},
  metricNumber:{color:INK.ink,fontSize:32,fontWeight:"900",letterSpacing:-1},
  metricLabel:{color:INK.inkSoft,fontSize:13,fontWeight:"700",lineHeight:18},
  sectionTitle:{color:INK.ink,fontSize:21,fontWeight:"900",marginBottom:10,marginTop:28},
  rowCard:{borderColor:INK.hair,borderRadius:16,borderWidth:1,backgroundColor:INK.card,marginBottom:8,padding:15},
  rowTitle:{color:INK.ink,fontSize:16,fontWeight:"800"},
  rowMeta:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:4},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:21,borderColor:INK.hair,borderRadius:16,borderWidth:1,backgroundColor:INK.card,padding:18},
  compactRow:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomColor:INK.hair,borderBottomWidth:1,paddingHorizontal:4},
  compactLabel:{color:INK.ink,fontSize:15,fontWeight:"700"},
  compactCount:{color:INK.ink,fontSize:18,fontWeight:"900"},
  issueCard:{minHeight:104,flexDirection:"row",alignItems:"center",borderColor:INK.ink,borderRadius:18,borderWidth:1,backgroundColor:INK.card,marginBottom:9,padding:16},
  issueCopy:{flex:1,paddingRight:10},
  issueType:{color:INK.inkSoft,fontSize:10,fontWeight:"900",letterSpacing:1,marginBottom:5},
  issueSummary:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:5},
  arrow:{color:INK.ink,fontSize:32,fontWeight:"300"},
  pressed:{opacity:0.72}
});
