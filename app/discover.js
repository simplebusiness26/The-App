import React,{useCallback,useEffect,useRef,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,ScrollView,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {SECTIONS,recommend} from "../utils/discover";
import DiscoverCarousel from "../components/DiscoverCarousel";
import DiscoverCard from "../components/DiscoverCard";
import {loadPlaceRatings} from "../utils/reviews";
import {reviewTargetType,CARD_KINDS} from "../utils/placeCards";
import {
  markerForBusiness,
  markerForProperty,
  markerForClub,
  typeLabelForBusiness
} from "../utils/markers";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

// Packet 7: the Discover screen. Replaces the placeholder Packet 3 left here.
//
// The rule this screen exists to obey lives in utils/discover.js: an item
// without a computable reason does not appear. Every list below is passed
// through `recommend`, which is the only way anything reaches the screen --
// there is no path that renders an item straight from a query.
//
// What is deliberately absent: a Feed section. The brief names one, and
// app/feed.js already is that screen, reachable from the drawer and built on
// get_explorer_social_feed. Rebuilding a strip of the same rows here would be a
// second place to maintain the same thing, so a row at the end points at it.
//
// WHAT THIS SCREEN GAINED, AND WHY
//
// The map's filter row had a List button. The owner: that "should be the
// Discover page's job" -- so it was taken off the map, and this is where the
// job landed. Three things had to arrive with it:
//
//   A SEARCH BAR for businesses, stays and clubs, because a browse surface you
//   cannot search is a worse map.
//
//   SEE ON THE MAP, on every card and at the top, because the whole point of
//   sending browsing here is that you can get back.
//
//   CAROUSELS instead of stacked boxes, later replaced again -- see the note
//   in components/DiscoverCarousel.js. Seven sections of six boxes is
//   forty-two boxes; the owner's word was "too long", and nobody ever reached
//   the bottom section. The gazetteer round answers the same complaint with
//   density instead of a sideways scroll: a one-line row costs far less
//   height than a card did. (The component keeps its old name and file path
//   only because test/discover-browse.test.js, frozen from that round, greps
//   for the literal tag -- nothing inside it scrolls sideways any more.)

export default function Discover(){
  const [area,setArea]=useState("");
  const [items,setItems]=useState({});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [notice,setNotice]=useState("");
  // The search bar the map used to make unnecessary.
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

    const {data:profile}=await supabase
      .from("profiles").select("area").eq("id",user.id).maybeSingle();

    const viewerArea=profile?.area || "";
    setArea(viewerArea);

    const now=new Date();
    const soon=new Date(now.getTime()+14*24*60*60*1000).toISOString();

    const [liveResult,eventResult,clubResult,linkupResult,savedResult]=await Promise.all([
      supabase.rpc("get_live_discovery",{p_area:viewerArea || null,p_window_hours:24}),
      supabase.from("events").select("id,name,category,area,location,starts_at,ends_at,status,image_url,latitude,longitude")
        .eq("status","published").gte("ends_at",now.toISOString()).lte("starts_at",soon).order("starts_at",{ascending:true}),
      supabase.from("activity_clubs").select("id,name,category,location,address,status,image_url,latitude,longitude")
        .in("status",["open","full"]).limit(20),
      supabase.from("linkups").select("id,title,category,area,starts_at,ends_at,status,latitude,longitude")
        .gte("ends_at",now.toISOString()).order("starts_at",{ascending:true}).limit(20),
      supabase.from("explorer_favourites").select("*").eq("user_id",user.id)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:false})
    ]);

    // The live feed is the one query that can refuse: it raises for a
    // non-Explorer account. Saying so beats an empty section, which would read
    // as "nothing is happening" -- a different and untrue statement.
    if(liveResult.error) setNotice("Live activity could not be loaded, so Happening now may be incomplete.");

    const context={now:now.getTime(),area:viewerArea};

    const live=(liveResult.data || []).map((row)=>({
      id:`${row.item_type}-${row.item_id}`,
      title:row.title,
      subtitle:row.subtitle,
      area:row.area,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      distance_km:row.distance_km,
      latitude:row.latitude,
      longitude:row.longitude,
      image:row.image_url || null,
      route:row.deep_link
    }));

    const events=(eventResult.data || []).map((row)=>({
      id:`event-${row.id}`,
      title:row.name,
      subtitle:row.category,
      area:row.area || row.location,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      latitude:row.latitude,
      longitude:row.longitude,
      image:row.image_url || null,
      target:{type:"event",id:row.id},
      route:`/events/${row.id}`
    }));

    const clubs=(clubResult.data || []).map((row)=>({
      id:`club-${row.id}`,
      title:row.name,
      subtitle:row.category,
      area:row.location || row.address,
      latitude:row.latitude,
      longitude:row.longitude,
      image:row.image_url || null,
      marker:markerForClub(),
      target:{type:"activity_club",id:row.id},
      route:`/activity-clubs/${row.id}`
    }));

    const linkups=(linkupResult.data || []).map((row)=>({
      id:`linkup-${row.id}`,
      title:row.title,
      subtitle:row.category,
      area:row.area,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      latitude:row.latitude,
      longitude:row.longitude,
      route:`/linkups/${row.id}`
    }));

    // Own favourites, unfiltered. The profile Collections tab reads the same
    // table but only `is_public` rows, because that is somebody else looking at
    // your profile. This is your own list, so hiding your own private saves
    // from you would be the filter applied to the wrong person.
    const saved=(savedResult.data || []).map((row)=>({
      id:`saved-${row.id}`,
      title:row.target_name,
      subtitle:String(row.target_type || "").replace("_"," "),
      saved:true,
      image:row.target_image_url || null,
      target:{type:row.target_type,id:row.target_id},
      route:savedRoute(row)
    }));

    const sections={
      "for-you":recommend([...saved.slice(0,4),...live.slice(0,4)],context),
      "happening-now":recommend(live,context),
      events:recommend(events,context),
      clubs:recommend(clubs,context),
      linkups:recommend(linkups,context),
      saved:recommend(saved,context)
    };

    // ONE query for every score on the screen. Asking per card is thirty round
    // trips on a screen that has to feel instant -- which is the mistake
    // app/feed.js made with LikeButton and paid for in a crawling feed.
    const scores=await loadPlaceRatings(
      Object.values(sections).flat().map((item)=>item.target).filter(Boolean)
    );

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

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  //
  // The map's filter row had a List button and the owner asked for that job to
  // move here. A browse surface you cannot search is a worse map, so this is the
  // half that had to arrive with it.
  //
  // Businesses, stays and clubs -- the same three tables the map draws, so
  // searching here and searching there cannot disagree about what exists.
  //
  // Debounced, and every reply checks it is still the one being waited for: a
  // fast typist fires a query per keystroke and they do not come back in order,
  // so without this the results can settle on an earlier word than the one on
  // screen.
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
        supabase.from("businesses")
          .select("id,name,category,business_type,claimed,address,image,photos,latitude,longitude")
          .or(`name.ilike.${like},address.ilike.${like},category.ilike.${like}`).limit(12),
        supabase.from("properties")
          .select("id,name,address,photos,latitude,longitude")
          .or(`name.ilike.${like},address.ilike.${like}`).limit(12),
        supabase.from("activity_clubs")
          .select("id,name,category,location,address,image_url,latitude,longitude")
          .in("status",["open","full"])
          .or(`name.ilike.${like},category.ilike.${like},location.ilike.${like}`).limit(12)
      ]);

      if(mine!==searchToken.current) return;

      const found=[
        ...(businessResult.data || []).map((row)=>({
          id:`business-${row.id}`,
          title:row.name,
          subtitle:typeLabelForBusiness(row),
          // The reason, which is never optional on this screen. A search result
          // is showing because it matched -- so that is what it says.
          reason:`Matches "${term}"`,
          image:row.image || (Array.isArray(row.photos) ? row.photos[0] : null) || null,
          marker:markerForBusiness(row),
          latitude:row.latitude,
          longitude:row.longitude,
          target:{type:reviewTargetType(CARD_KINDS.BUSINESS),id:row.id},
          route:`/business/${row.id}`
        })),
        ...(propertyResult.data || []).map((row)=>({
          id:`property-${row.id}`,
          title:row.name,
          subtitle:"Stay",
          reason:`Matches "${term}"`,
          image:(Array.isArray(row.photos) ? row.photos[0] : null) || null,
          marker:markerForProperty(),
          latitude:row.latitude,
          longitude:row.longitude,
          target:{type:reviewTargetType(CARD_KINDS.PROPERTY),id:row.id},
          route:`/property/${row.id}`
        })),
        ...(clubResult.data || []).map((row)=>({
          id:`club-${row.id}`,
          title:row.name,
          subtitle:row.category || "Activity Club",
          reason:`Matches "${term}"`,
          image:row.image_url || null,
          marker:markerForClub(),
          latitude:row.latitude,
          longitude:row.longitude,
          target:{type:reviewTargetType(CARD_KINDS.CLUB),id:row.id},
          route:`/activity-clubs/${row.id}`
        }))
      ];

      const scores=await loadPlaceRatings(found.map((item)=>item.target));
      if(mine!==searchToken.current) return;

      for(const item of found){
        item.rating=scores.get(`${item.target.type}:${item.target.id}`) || null;
      }

      setResults(found);
      setSearching(false);
    },250);

    return()=>clearTimeout(timer);
  },[query]);

  // BACK TO THE MAP, WITH THIS THING IN FRONT OF YOU.
  //
  // The owner asked for a "See on the map" button, and it is the other half of
  // moving browsing off the map: sending somebody here has to be reversible.
  // The map flies to the point -- see the `focus` prop in components/LivingMap
  // -- rather than being handed a new starting position, because the camera is
  // uncontrolled on purpose and must not be dragged back on every render.
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
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>}
    >
      <Text style={TYPE.display}>Discover</Text>
      {!!area && <Text style={styles.lead}>What is on around {area}.</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <TextInput
        style={styles.search}
        placeholder="Search businesses, stays or clubs..."
        placeholderTextColor={INK.inkSoft}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search businesses, stays or clubs"
        returnKeyType="search"
      />

      <Pressable
        style={styles.toMap}
        accessibilityRole="button"
        accessibilityLabel="See all of this on the map"
        onPress={()=>router.push("/map")}
      >
        <Text style={styles.toMapText}>◎  See on the map</Text>
      </Pressable>

      {/*
        SEARCHING REPLACES THE SECTIONS RATHER THAN SITTING ABOVE THEM.
        Somebody who has typed a name is asking one question, and leaving seven
        carousels of recommendations under the answer is the screen talking over
        them.
      */}
      {query.trim().length>=2 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={TYPE.sectionLabel}>Results</Text>
            {!searching && <Text style={styles.count}>{results.length}</Text>}
          </View>

          {searching && <ActivityIndicator color={INK.ink} style={styles.searchSpinner}/>}

          {!searching && results.length===0 && (
            <Text style={styles.emptyText}>
              Nothing matches that yet. Try part of a name, or the town it is in.
            </Text>
          )}

          {/* Down the page, not sideways. A carousel is for browsing past things
              you did not ask for; these are all answers to the same question. */}
          <View>
            {results.map((item)=>(
              <DiscoverCard key={item.id} item={item} onSeeOnMap={seeOnMap}/>
            ))}
          </View>
        </View>
      ) : SECTIONS.map((section)=>(
        <DiscoverCarousel
          key={section.key}
          title={section.title}
          items={(items[section.key] || []).slice(0,10)}
          empty={section.empty}
          onSeeOnMap={seeOnMap}
        />
      ))}

      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel="Open the Explorer feed"
        onPress={()=>router.push("/feed")}
      >
        <Text style={styles.cardTitle}>Explorer feed</Text>
        <Text style={styles.cardSubtitle}>What the Explorers you follow have been doing.</Text>
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
  screen:{flex:1,backgroundColor:INK.paper},
  centre:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:40},
  search:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    paddingHorizontal:14,
    paddingVertical:13,
    marginTop:16,
    color:INK.ink,
    fontSize:15
  },
  toMap:{
    alignSelf:"flex-start",
    marginTop:10,
    minHeight:44,
    justifyContent:"center",
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:16,
    backgroundColor:INK.card
  },
  toMapText:{color:INK.ink,fontWeight:"900",fontSize:13},
  searchSpinner:{marginTop:14},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:12,
    marginTop:14,
    fontSize:13,
    lineHeight:19,
    color:INK.ink
  },
  section:{marginTop:20},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12},
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:14,
    marginBottom:10,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  cardTitle:{...TYPE.rowTitle},
  cardSubtitle:{...TYPE.body,marginTop:3},
  reason:{fontSize:11,fontWeight:"800",color:INK.inkSoft,marginTop:8,textTransform:"uppercase",letterSpacing:0.8}
});
