import React,{useCallback,useEffect,useRef,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,ScrollView,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {SECTIONS,recommend} from "../utils/discover";
import DiscoverCarousel from "../components/DiscoverCarousel";
import DiscoverCard from "../components/DiscoverCard";
import AlexJourneyHeader from "../components/AlexJourneyHeader";
import {loadPlaceRatings} from "../utils/reviews";
import {reviewTargetType,CARD_KINDS} from "../utils/placeCards";
import {markerForBusiness,markerForProperty,markerForClub,typeLabelForBusiness} from "../utils/markers";
import {INK} from "../utils/tokens";

export default function Discover(){
  const [area,setArea]=useState("");
  const [items,setItems]=useState({});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [notice,setNotice]=useState("");
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [searching,setSearching]=useState(false);

  const load=useCallback(async()=>{
    setNotice("");
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setItems({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const {data:profile}=await supabase.from("profiles").select("area").eq("id",user.id).maybeSingle();
    const viewerArea=profile?.area || "";
    setArea(viewerArea);

    const now=new Date();
    const soon=new Date(now.getTime()+14*24*60*60*1000).toISOString();

    const [liveResult,eventResult,clubResult,linkupResult,savedResult]=await Promise.all([
      supabase.rpc("get_live_discovery",{p_area:viewerArea || null,p_window_hours:24}),
      supabase.from("events").select("id,name,category,area,location,starts_at,ends_at,status,image_url,latitude,longitude").eq("status","published").gte("ends_at",now.toISOString()).lte("starts_at",soon).order("starts_at",{ascending:true}),
      supabase.from("activity_clubs").select("id,name,category,location,address,status,image_url,latitude,longitude").in("status",["open","full"]).limit(20),
      supabase.from("linkups").select("id,title,category,area,starts_at,ends_at,status,latitude,longitude").gte("ends_at",now.toISOString()).order("starts_at",{ascending:true}).limit(20),
      supabase.from("explorer_favourites").select("*").eq("user_id",user.id).order("sort_order",{ascending:true}).order("created_at",{ascending:false})
    ]);

    if(liveResult.error) setNotice("Live activity could not be loaded, so Happening now may be incomplete.");

    const context={now:now.getTime(),area:viewerArea};

    const live=(liveResult.data || []).map((row)=>({
      id:`${row.item_type}-${row.item_id}`,title:row.title,subtitle:row.subtitle,area:row.area,
      starts_at:row.starts_at,ends_at:row.ends_at,distance_km:row.distance_km,
      latitude:row.latitude,longitude:row.longitude,image:row.image_url || null,route:row.deep_link
    }));

    const events=(eventResult.data || []).map((row)=>({
      id:`event-${row.id}`,title:row.name,subtitle:row.category,area:row.area || row.location,
      starts_at:row.starts_at,ends_at:row.ends_at,latitude:row.latitude,longitude:row.longitude,
      image:row.image_url || null,target:{type:"event",id:row.id},route:`/events/${row.id}`
    }));

    const clubs=(clubResult.data || []).map((row)=>({
      id:`club-${row.id}`,title:row.name,subtitle:row.category,area:row.location || row.address,
      latitude:row.latitude,longitude:row.longitude,image:row.image_url || null,marker:markerForClub(),
      target:{type:"activity_club",id:row.id},route:`/activity-clubs/${row.id}`
    }));

    const linkups=(linkupResult.data || []).map((row)=>({
      id:`linkup-${row.id}`,title:row.title,subtitle:row.category,area:row.area,
      starts_at:row.starts_at,ends_at:row.ends_at,latitude:row.latitude,longitude:row.longitude,
      route:`/linkups/${row.id}`
    }));

    const saved=(savedResult.data || []).map((row)=>({
      id:`saved-${row.id}`,title:row.target_name,subtitle:String(row.target_type || "").replace("_"," "),
      saved:true,image:row.target_image_url || null,target:{type:row.target_type,id:row.target_id},route:savedRoute(row)
    }));

    const sections={
      "for-you":recommend([...saved.slice(0,4),...live.slice(0,4)],context),
      "happening-now":recommend(live,context),
      events:recommend(events,context),
      clubs:recommend(clubs,context),
      linkups:recommend(linkups,context),
      saved:recommend(saved,context)
    };

    const scores=await loadPlaceRatings(Object.values(sections).flat().map((item)=>item.target).filter(Boolean));
    for(const rows of Object.values(sections)){
      for(const item of rows){
        if(!item.target) continue;
        item.rating=scores.get(`${item.target.type}:${item.target.id}`) || null;
      }
    }

    setItems(sections);
    setLoading(false);
    setRefreshing(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const searchToken=useRef(0);

  useEffect(()=>{
    const term=query.trim();
    if(term.length<2){
      setResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const mine=++searchToken.current;
    const like=`%${term}%`;

    const timer=setTimeout(async()=>{
      const [businessResult,propertyResult,clubResult]=await Promise.all([
        supabase.from("businesses").select("id,name,category,business_type,claimed,address,image,photos,latitude,longitude").or(`name.ilike.${like},address.ilike.${like},category.ilike.${like}`).limit(12),
        supabase.from("properties").select("id,name,address,photos,latitude,longitude").or(`name.ilike.${like},address.ilike.${like}`).limit(12),
        supabase.from("activity_clubs").select("id,name,category,location,address,image_url,latitude,longitude").in("status",["open","full"]).or(`name.ilike.${like},category.ilike.${like},location.ilike.${like}`).limit(12)
      ]);

      if(mine!==searchToken.current) return;

      const found=[
        ...(businessResult.data || []).map((row)=>({
          id:`business-${row.id}`,title:row.name,subtitle:typeLabelForBusiness(row),reason:`Matches "${term}"`,
          image:row.image || (Array.isArray(row.photos) ? row.photos[0] : null) || null,
          marker:markerForBusiness(row),latitude:row.latitude,longitude:row.longitude,
          target:{type:reviewTargetType(CARD_KINDS.BUSINESS),id:row.id},route:`/business/${row.id}`
        })),
        ...(propertyResult.data || []).map((row)=>({
          id:`property-${row.id}`,title:row.name,subtitle:"Stay",reason:`Matches "${term}"`,
          image:(Array.isArray(row.photos) ? row.photos[0] : null) || null,marker:markerForProperty(),
          latitude:row.latitude,longitude:row.longitude,target:{type:reviewTargetType(CARD_KINDS.PROPERTY),id:row.id},route:`/property/${row.id}`
        })),
        ...(clubResult.data || []).map((row)=>({
          id:`club-${row.id}`,title:row.name,subtitle:row.category || "Activity Club",reason:`Matches "${term}"`,
          image:row.image_url || null,marker:markerForClub(),latitude:row.latitude,longitude:row.longitude,
          target:{type:reviewTargetType(CARD_KINDS.CLUB),id:row.id},route:`/activity-clubs/${row.id}`
        }))
      ];

      const scores=await loadPlaceRatings(found.map((item)=>item.target));
      if(mine!==searchToken.current) return;
      for(const item of found) item.rating=scores.get(`${item.target.type}:${item.target.id}`) || null;
      setResults(found);
      setSearching(false);
    },250);

    return()=>clearTimeout(timer);
  },[query]);

  const seeOnMap=useCallback((item)=>{
    const latitude=Number(item?.latitude);
    const longitude=Number(item?.longitude);
    if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
      router.push("/map");
      return;
    }
    router.push(`/map?lat=${latitude}&lng=${longitude}`);
  },[]);

  if(loading){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.brandDeep}/></View>;
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={INK.brandDeep}/>
    >
      <AlexJourneyHeader
        phase="ORIENT"
        title="Choose your next move"
        description="Start with intent, then evaluate the real facts Xplorer already knows. Explore is the front door; Map becomes the handoff once you have a direction."
        meta={area || "Your area"}
      />

      <View style={styles.intentGrid}>
        <Pressable style={[styles.intent,styles.intentDark]} onPress={()=>router.push("/events")}>
          <Text style={styles.intentKickerDark}>DATED</Text><Text style={styles.intentTitleDark}>Events</Text><Text style={styles.intentCopyDark}>Put something on the calendar.</Text>
        </Pressable>
        <Pressable style={styles.intent} onPress={()=>router.push("/activity-clubs")}>
          <Text style={styles.intentKicker}>RECURRING</Text><Text style={styles.intentTitle}>Clubs</Text><Text style={styles.intentCopy}>Find something worth returning to.</Text>
        </Pressable>
        <Pressable style={[styles.intent,styles.intentSignal]} onPress={()=>router.push("/linkups")}>
          <Text style={styles.intentKickerSignal}>SOCIAL</Text><Text style={styles.intentTitleSignal}>Link-ups</Text><Text style={styles.intentCopySignal}>Turn possibility into a plan.</Text>
        </Pressable>
      </View>

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.searchShell}>
        <View style={styles.searchCopy}><Text style={styles.searchKicker}>SEARCH</Text><Text style={styles.searchTitle}>Know what you want?</Text></View>
        <TextInput
          style={styles.search}
          placeholder="Business, stay or club"
          placeholderTextColor={INK.inkSoft}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search businesses, stays or clubs"
          returnKeyType="search"
        />
        <Pressable style={styles.toMap} accessibilityRole="button" accessibilityLabel="See all of this on the map" onPress={()=>router.push("/map")}>
          <Text style={styles.toMapText}>Open Map →</Text>
        </Pressable>
      </View>

      {query.trim().length>=2 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Results</Text>{!searching && <Text style={styles.count}>{results.length}</Text>}</View>
          {searching && <ActivityIndicator color={INK.brandDeep} style={styles.searchSpinner}/>} 
          {!searching && results.length===0 && <View style={styles.empty}><Text style={styles.emptyText}>Nothing matches that yet. Try part of a name, or the town it is in.</Text></View>}
          <View style={styles.results}>{results.map((item)=><DiscoverCard key={item.id} item={item} onSeeOnMap={seeOnMap}/>)}</View>
        </View>
      ) : SECTIONS.map((section)=>(
        <DiscoverCarousel key={section.key} title={section.title} items={(items[section.key] || []).slice(0,10)} empty={section.empty} onSeeOnMap={seeOnMap}/>
      ))}

      <Pressable style={styles.reflectionCard} accessibilityRole="button" accessibilityLabel="Open the Explorer feed" onPress={()=>router.push("/feed")}>
        <View><Text style={styles.reflectionKicker}>REFLECT</Text><Text style={styles.reflectionTitle}>Explorer feed</Text><Text style={styles.reflectionCopy}>What the people you follow discovered and kept.</Text></View><Text style={styles.reflectionArrow}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

function savedRoute(row){
  if(row.target_type==="business") return `/business/${row.target_id}`;
  if(row.target_type==="property") return `/property/${row.target_id}`;
  if(row.target_type==="activity_club") return `/activity-clubs/${row.target_id}`;
  if(row.target_type==="event") return `/events/${row.target_id}`;
  return null;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},centre:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:INK.paper},content:{padding:16,paddingBottom:50},
  intentGrid:{flexDirection:"row",gap:8,marginBottom:14},intent:{flex:1,minHeight:122,borderRadius:19,padding:12,justifyContent:"flex-end",backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair},intentDark:{backgroundColor:INK.navy,borderColor:INK.navy},intentSignal:{backgroundColor:INK.brand,borderColor:INK.brand},intentKicker:{color:INK.lavender,fontSize:8,fontWeight:"900",letterSpacing:.8},intentKickerDark:{color:INK.brand,fontSize:8,fontWeight:"900",letterSpacing:.8},intentKickerSignal:{color:INK.navy,fontSize:8,fontWeight:"900",letterSpacing:.8},intentTitle:{color:INK.ink,fontSize:16,fontWeight:"900",marginTop:3},intentTitleDark:{color:INK.onNavy,fontSize:16,fontWeight:"900",marginTop:3},intentTitleSignal:{color:INK.navy,fontSize:16,fontWeight:"900",marginTop:3},intentCopy:{color:INK.inkSoft,fontSize:10,lineHeight:14,marginTop:4},intentCopyDark:{color:INK.onNavySoft,fontSize:10,lineHeight:14,marginTop:4},intentCopySignal:{color:INK.navy,fontSize:10,lineHeight:14,marginTop:4},
  notice:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.coral,borderRadius:15,padding:12,marginBottom:12,fontSize:12,lineHeight:18,color:INK.ink},
  searchShell:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:20,padding:12,marginBottom:8},searchCopy:{marginBottom:8},searchKicker:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1},searchTitle:{color:INK.ink,fontSize:18,fontWeight:"900",marginTop:2},search:{backgroundColor:INK.paper,borderRadius:13,paddingHorizontal:14,paddingVertical:13,color:INK.ink,fontSize:15},toMap:{alignSelf:"flex-start",marginTop:8,minHeight:42,justifyContent:"center",borderRadius:13,paddingHorizontal:14,backgroundColor:INK.navy},toMapText:{color:INK.onNavy,fontWeight:"900",fontSize:12},
  searchSpinner:{marginTop:14},results:{gap:12,alignItems:"flex-start"},section:{marginTop:22},sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},sectionTitle:{fontSize:20,fontWeight:"900",color:INK.ink,letterSpacing:-.3},count:{fontSize:12,fontWeight:"900",color:INK.inkSoft},empty:{borderTopWidth:1,borderTopColor:INK.hair,paddingTop:12},emptyText:{fontSize:13,lineHeight:19,color:INK.inkSoft},
  reflectionCard:{marginTop:18,backgroundColor:INK.navy,borderRadius:20,padding:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},reflectionKicker:{color:INK.brand,fontSize:9,fontWeight:"900",letterSpacing:1},reflectionTitle:{color:INK.onNavy,fontSize:18,fontWeight:"900",marginTop:3},reflectionCopy:{color:INK.onNavySoft,fontSize:12,lineHeight:17,marginTop:4},reflectionArrow:{color:INK.brand,fontSize:27}
});
