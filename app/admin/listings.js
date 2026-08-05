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
import {INK} from "../../utils/tokens";

// Admin Dashboard Stage 3: one read-only catalogue across every kind of
// listing. It selects only the fields this screen displays; manager/owner ids
// are deliberately absent. Editing and destructive actions stay on the screens
// that own their validation, permission checks and confirmation feedback.
const LISTING_TYPES=[
  {
    key:"businesses",
    table:"businesses",
    label:"Businesses",
    singular:"Business",
    columns:"id,name,business_type,category,address",
    route:"/business",
    detail:(row)=>joinDetail(pretty(row.business_type || row.category),row.address)
  },
  {
    key:"properties",
    table:"properties",
    label:"Properties",
    singular:"Property",
    columns:"id,name,address",
    route:"/property",
    detail:(row)=>row.address || "No address recorded"
  },
  {
    key:"public_places",
    table:"public_places",
    label:"Public places",
    singular:"Public place",
    columns:"id,name,place_type,location_description,status",
    route:"/places",
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
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content,{paddingBottom:Math.max(insets.bottom,24)+40}]}
    >
      <Text style={styles.eyebrow}>ADMIN LISTINGS</Text>
      <Text style={styles.title}>Find every listing</Text>
      <Text style={styles.intro}>
        Search businesses, properties, public places, activity clubs and events in one view.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading the listing catalogue…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Listings could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading admin listings again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search admin listings"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search by name, type or location"
            placeholderTextColor={INK.inkSoft}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <FilterChip
              label="All"
              count={listings.length}
              selected={selectedType==="all"}
              onPress={()=>setSelectedType("all")}
            />
            {LISTING_TYPES.map((type)=>(
              <FilterChip
                key={type.key}
                label={type.label}
                count={totals[type.key] || 0}
                selected={selectedType===type.key}
                onPress={()=>setSelectedType(type.key)}
              />
            ))}
          </ScrollView>

          <Text style={styles.resultCount}>
            {`${visible.length} ${visible.length===1 ? "listing" : "listings"}`}
          </Text>

          {visible.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No listings match</Text>
              <Text style={styles.emptyText}>Try a different search or listing type.</Text>
            </View>
          ) : visible.map((listing)=>(
            <Pressable
              key={`${listing.typeKey}:${listing.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${listing.name}`}
              onPress={()=>router.push(listing.route)}
              style={({pressed})=>[styles.listingCard,pressed && styles.pressed]}
            >
              <View style={styles.listingCopy}>
                <Text style={styles.typeLabel}>{listing.typeLabel.toUpperCase()}</Text>
                <Text style={styles.listingName}>{listing.name}</Text>
                <Text style={styles.listingDetail}>{listing.detail}</Text>
                {!!listing.state && <Text style={styles.listingState}>State: {pretty(listing.state)}</Text>}
              </View>
              <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function FilterChip({label,count,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label==="All" ? "Show all listings" : `Show only ${label}`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed})=>[
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.filterText,selected && styles.filterTextSelected]}>{label} {count}</Text>
    </Pressable>
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
    minHeight:48,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:14,
    backgroundColor:INK.ink,
    marginTop:18,
    paddingHorizontal:18,
    paddingVertical:12
  },
  primaryButtonText:{
    color:INK.paper,
    fontSize:16,
    fontWeight:"800"
  },
  searchInput:{
    minHeight:52,
    borderColor:INK.ink,
    borderRadius:16,
    borderWidth:1,
    backgroundColor:INK.card,
    color:INK.ink,
    fontSize:16,
    paddingHorizontal:16,
    paddingVertical:12
  },
  filters:{
    gap:8,
    paddingBottom:4,
    paddingTop:14
  },
  filterChip:{
    minHeight:44,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.hair,
    borderRadius:22,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:15
  },
  filterChipSelected:{
    borderColor:INK.ink,
    backgroundColor:INK.ink
  },
  filterText:{
    color:INK.ink,
    fontSize:14,
    fontWeight:"800"
  },
  filterTextSelected:{
    color:INK.paper
  },
  resultCount:{
    color:INK.inkSoft,
    fontSize:14,
    fontWeight:"800",
    marginBottom:12,
    marginTop:18
  },
  listingCard:{
    minHeight:112,
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
  listingCopy:{
    flex:1,
    paddingRight:12
  },
  typeLabel:{
    color:INK.inkSoft,
    fontSize:10,
    fontWeight:"900",
    letterSpacing:1.1
  },
  listingName:{
    color:INK.ink,
    fontSize:19,
    fontWeight:"900",
    marginTop:5
  },
  listingDetail:{
    color:INK.inkSoft,
    fontSize:14,
    lineHeight:19,
    marginTop:5
  },
  listingState:{
    color:INK.ink,
    fontSize:12,
    fontWeight:"800",
    marginTop:7
  },
  arrow:{
    color:INK.ink,
    fontSize:34,
    fontWeight:"300"
  },
  emptyPanel:{
    alignItems:"center",
    borderColor:INK.hair,
    borderRadius:18,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:28
  },
  emptyTitle:{
    color:INK.ink,
    fontSize:19,
    fontWeight:"900"
  },
  emptyText:{
    color:INK.inkSoft,
    fontSize:14,
    lineHeight:20,
    marginTop:6,
    textAlign:"center"
  },
  pressed:{
    opacity:0.68
  }
});
