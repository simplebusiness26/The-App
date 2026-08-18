import React,{useCallback,useMemo,useState} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {publicPlaceTypeLabel} from "../../utils/places";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Field,
  fieldInputStyle,
  Glyph,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Admin Dashboard Stage 3: one read-only catalogue across every kind of
// listing. It selects only the fields this screen displays; manager/owner ids
// are deliberately absent. Editing and destructive actions stay on the screens
// that own their validation, permission checks and confirmation feedback.
//
// Every row here is a listing of some kind, but a row in an admin catalogue is
// not a pin on a map, so none of them carry a state ink. What kind of thing it
// is goes in the mono meta column, where the app's own readings go.

const LISTING_TYPES=[
  {
    key:"businesses",
    table:"businesses",
    label:"Businesses",
    singular:"Business",
    columns:"id,name,business_type,category,address",
    route:"/business",
    glyph:"building",
    detail:(row)=>joinDetail(pretty(row.business_type || row.category),row.address)
  },
  {
    key:"properties",
    table:"properties",
    label:"Properties",
    singular:"Property",
    columns:"id,name,address",
    route:"/property",
    glyph:"bed",
    detail:(row)=>row.address || "No address recorded"
  },
  {
    key:"public_places",
    table:"public_places",
    label:"Public places",
    singular:"Public place",
    columns:"id,name,place_type,location_description,status",
    route:"/places",
    glyph:"pin",
    detail:(row)=>joinDetail(publicPlaceTypeLabel(row.place_type),row.location_description),
    state:(row)=>row.status
  },
  {
    key:"activity_clubs",
    table:"activity_clubs",
    label:"Activity clubs",
    singular:"Activity club",
    columns:"id,name,category,location,status",
    route:"/activity-clubs",
    glyph:"people",
    detail:(row)=>joinDetail(row.category,row.location),
    state:(row)=>row.status
  },
  {
    key:"events",
    table:"events",
    label:"Events",
    singular:"Event",
    columns:"id,name,category,location,status",
    route:"/events",
    glyph:"calendar",
    detail:(row)=>joinDetail(row.category,row.location),
    state:(row)=>row.status
  }
];

function joinDetail(...parts){
  return parts.filter(Boolean).join(" · ") || "No details recorded";
}

function pretty(value){
  if(!value) return "Unclassified";
  return String(value)
    .replace(/_/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

function selectedFromParam(value){
  const candidate=Array.isArray(value) ? value[0] : value;
  return LISTING_TYPES.some((item)=>item.key===candidate) ? candidate : "all";
}

function catalogueRow(type,row){
  const detail=type.detail(row);
  const state=type.state ? type.state(row) : "";

  return{
    id:row.id,
    name:row.name,
    typeKey:type.key,
    typeLabel:type.singular,
    glyph:type.glyph,
    detail,
    state,
    route:`${type.route}/${row.id}`,
    search:[row.name,type.label,type.singular,detail,state].filter(Boolean).join(" ").toLowerCase()
  };
}

export default function AdminListings(){
  const insets=useSafeAreaInsets();
  const params=useLocalSearchParams();
  const {checking,allowed,error:gateError}=useAdminGate();
  const [listings,setListings]=useState([]);
  const [selectedType,setSelectedType]=useState(()=>selectedFromParam(params.type));
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setListings([]);

    try{
      const results=await Promise.all(LISTING_TYPES.map(async(type)=>{
        const {data,error:readError}=await supabase
          .from(type.table)
          .select(type.columns)
          .order("name",{ascending:true});

        return{type,data,error:readError};
      }));

      if(results.some((result)=>result.error || !Array.isArray(result.data))){
        setError("One or more listing reads failed, so no partial catalogue is shown.");
        return;
      }

      const next=results
        .flatMap(({type,data})=>data.map((row)=>catalogueRow(type,row)))
        .sort((left,right)=>left.name.localeCompare(right.name));
      setListings(next);
    }catch{
      setError("One or more listing reads failed, so no partial catalogue is shown.");
    }finally{
      setLoading(false);
    }
  },[allowed]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const totals=useMemo(()=>Object.fromEntries(
    LISTING_TYPES.map((type)=>[
      type.key,
      listings.filter((listing)=>listing.typeKey===type.key).length
    ])
  ),[listings]);

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return listings.filter((listing)=>{
      const typeMatches=selectedType==="all" || listing.typeKey===selectedType;
      const searchMatches=!term || listing.search.includes(term);
      return typeMatches && searchMatches;
    });
  },[listings,search,selectedType]);

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingBottom:Math.max(insets.bottom,24)+CREATE_HUB_CLEARANCE}}
      >
        <ScreenTitle
          eyebrow="Admin listings"
          title="Find every listing"
          meta="Search businesses, properties, public places, activity clubs and events in one view."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading the listing catalogue…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Listings could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading admin listings again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <Field label="Search by name, type or location">
                <TextInput
                  accessibilityLabel="Search admin listings"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  placeholder="Search by name, type or location"
                  placeholderTextColor={INK.readoutFaint}
                  returnKeyType="search"
                  style={fieldInputStyle}
                  value={search}
                />
              </Field>

              {/*
                A horizontal ScrollView inside a flex column claims all the
                leftover vertical space and stretches its children to fill it --
                measured in this repo at 402px-tall filter pills. flexGrow:0,
                flexShrink:0 and a centred content container are what stop it.
              */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContent}
              >
                <FilterChip
                  label="All"
                  count={listings.length}
                  accessibilityLabel="Show all listings"
                  selected={selectedType==="all"}
                  onPress={()=>setSelectedType("all")}
                />
                {LISTING_TYPES.map((type)=>(
                  <FilterChip
                    key={type.key}
                    label={type.label}
                    count={totals[type.key] || 0}
                    accessibilityLabel={`Show only ${type.label}`}
                    selected={selectedType===type.key}
                    onPress={()=>setSelectedType(type.key)}
                  />
                ))}
              </ScrollView>

              <SectionRule label="Catalogue" meta={String(visible.length)}/>

              <Text style={styles.resultCount}>
                {`${visible.length} ${visible.length===1 ? "listing" : "listings"}`}
              </Text>

              {visible.length===0 ? (
                <Empty
                  glyph="search"
                  title="No listings match"
                  instruction="Try a different search or listing type."
                />
              ) : visible.map((listing)=>(
                <Pressable
                  key={`${listing.typeKey}:${listing.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${listing.name}`}
                  onPress={()=>router.push(listing.route)}
                  style={({pressed})=>pressed ? styles.pressed : null}
                >
                  <Row
                    glyph={listing.glyph}
                    title={listing.name}
                    sub={listing.detail}
                    meta={listing.typeLabel}
                    metaSub={listing.state ? pretty(listing.state) : undefined}
                    right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
                  />
                </Pressable>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function FilterChip({label,count,accessibilityLabel,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected}}
      onPress={onPress}
    >
      <Chip label={`${label} ${count}`} selected={selected}/>
    </Pressable>
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

  filterScroll:{flexGrow:0,flexShrink:0},
  filterContent:{alignItems:"center",gap:7,paddingVertical:2},

  resultCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  pressed:{opacity:0.78}
});
