import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Glyph,
  KeyValue,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Read-only reports on what the data says versus what it should say.
//
// Four gauges at the top, then one etched rule per report with its count on the
// end. Nothing here is a place either, so the "needs attention" gauge steps up
// a surface rather than filling with INK.water -- which was a MAP TERRAIN
// colour standing in for a highlight.

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

// Value first, then what it is. See the note in app/admin/dashboard.js.
function Gauge({value,label,attention}){
  return(
    <Panel raised={attention} style={[styles.gauge,attention && styles.gaugeAttention]}>
      <Text style={styles.gaugeValue}>{value}</Text>
      <Text style={styles.gaugeLabel} numberOfLines={2}>{label}</Text>
    </Panel>
  );
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
        contentContainerStyle={{paddingBottom:Math.max(insets.bottom,24)+CREATE_HUB_CLEARANCE}}
      >
        <ScreenTitle
          eyebrow="Admin data quality"
          title="Areas & data quality"
          meta="Read-only reports show what needs a human decision. They never guess an area or repair ownership automatically."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Checking canonical data…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Data-quality reports could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading area and data-quality reports again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <View style={styles.gaugeGrid}>
                <Gauge value={areas.length} label="Canonical areas"/>
                <Gauge value={missingAreaRows} label="Rows without a canonical area"/>
                <Gauge value={unmatchedPlaces.length} label="Unmatched Place values"/>
                <Gauge
                  value={ownershipIssues.length}
                  label="Ownership issues"
                  attention={ownershipIssues.length>0}
                />
              </View>

              <SectionRule label="Canonical areas" meta={String(areas.length)}/>
              {areas.length===0 ? (
                <Empty
                  glyph="map"
                  title="No canonical areas yet"
                  instruction="No canonical areas exist yet."
                />
              ) : areas.map((area)=>(
                <Row
                  key={area.id}
                  glyph="map"
                  title={area.name}
                  sub={`${pretty(area.area_type)} · State: ${pretty(area.status)}`}
                >
                  {!!area.parent_area_id && (
                    <Text style={styles.rowExtra}>
                      {`Inside ${areaNames.get(area.parent_area_id) || "unknown parent"}`}
                    </Text>
                  )}
                </Row>
              ))}

              <SectionRule label="Canonical-area coverage" meta={String(missingAreaCounts.length)}/>
              {missingAreaCounts.length===0 ? (
                <Empty
                  glyph="check"
                  title="Every row has an area"
                  instruction="Every supported row has a canonical area."
                />
              ) : (
                <Panel style={styles.coverage}>
                  {missingAreaCounts.map((item)=>(
                    <KeyValue
                      key={item.source_table}
                      label={sourceLabel(item.source_table)}
                      value={String(item.row_count)}
                    />
                  ))}
                </Panel>
              )}

              <SectionRule label="Unmatched area values" meta={String(unmatchedAreas.length)}/>
              {unmatchedAreas.length===0 ? (
                <Empty
                  glyph="check"
                  title="Nothing unmatched"
                  instruction="No unmatched area text remains."
                />
              ) : unmatchedAreas.map((item,index)=>(
                <Row
                  key={`${item.source_table}-${item.raw_value}-${index}`}
                  glyph="search"
                  title={item.raw_value}
                  sub={`${sourceLabel(item.source_table)} · ${pretty(item.source_column)}`}
                  meta={String(item.row_count)}
                  metaSub={Number(item.row_count)===1 ? "row" : "rows"}
                />
              ))}

              <SectionRule label="Unmatched Place values" meta={String(unmatchedPlaces.length)}/>
              {unmatchedPlaces.length===0 ? (
                <Empty
                  glyph="check"
                  title="Nothing unmatched"
                  instruction="No unmatched park or public-Place text remains."
                />
              ) : unmatchedPlaces.map((item,index)=>(
                <Row
                  key={`${item.place_type}-${item.raw_value}-${index}`}
                  glyph="pin"
                  title={item.raw_value}
                  sub={pretty(item.place_type)}
                  meta={String(item.row_count)}
                  metaSub={Number(item.row_count)===1 ? "check-in" : "check-ins"}
                />
              ))}

              <SectionRule label="Ownership integrity" meta={String(ownershipIssues.length)}/>
              {ownershipIssues.length===0 ? (
                <Empty
                  glyph="check"
                  title="Ownership is consistent"
                  instruction="No listing ownership inconsistencies were found."
                />
              ) : ownershipIssues.map((issue)=>{
                const route=listingRoute(issue);
                const row=(
                  <Row
                    glyph="warn"
                    title={issue.listing_name}
                    sub={issue.summary}
                    meta={pretty(issue.issue_type)}
                    right={route ? <Glyph name="forward" size={13} colour={INK.readoutFaint}/> : null}
                  />
                );

                if(!route) return <View key={issue.issue_id}>{row}</View>;

                return(
                  <Pressable
                    key={issue.issue_id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open data-quality issue for ${issue.listing_name}`}
                    onPress={()=>router.push(route)}
                    style={({pressed})=>pressed ? styles.pressed : null}
                  >
                    {row}
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  body:{paddingHorizontal:16},
  fullState:{alignItems:"center",justifyContent:"center",gap:12,padding:32},
  stateText:{
    maxWidth:320,color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,textAlign:"center"
  },

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  gaugeGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},
  gauge:{width:"48%",minHeight:92,justifyContent:"space-between",padding:13},
  gaugeAttention:{borderColor:INK.hairlineStrong},
  gaugeValue:{color:INK.readout,fontSize:28,fontWeight:"700",letterSpacing:-1},
  gaugeLabel:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:6},

  coverage:{paddingHorizontal:13,paddingVertical:4},
  rowExtra:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:3
  },
  pressed:{opacity:0.78}
});
