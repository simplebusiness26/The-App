import React,{useCallback,useEffect,useRef,useState} from "react";
import {View,Text,TextInput,StyleSheet,ScrollView,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {SECTIONS,recommend} from "../utils/discover";
import DiscoverCarousel from "../components/DiscoverCarousel";
import DiscoverCard from "../components/DiscoverCard";
import HappeningSegments from "../components/HappeningSegments";
import {loadPlaceRatings} from "../utils/reviews";
import {reviewTargetType,CARD_KINDS} from "../utils/placeCards";
import {
  markerForBusiness,
  markerForProperty,
  markerForClub,
  typeLabelForBusiness
} from "../utils/markers";
import {INK,TYPE} from "../utils/tokens";
import {
  Action,
  Empty,
  Field,
  Notice,
  Screen,
  ScreenTitle,
  SectionRule,
  fieldInputStyle
} from "../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import LiveNow from "./live";
import EventsSegment from "./events/index";
import ClubsSegment from "./activity-clubs/index";
import LinkupsSegment from "./linkups/index";

// Happening tab container. FINAL_PRODUCT_CONTRACT.md: "For You (Discover) ·
// Live Now · Events · Clubs · Link-ups — segmented within one destination,"
// not five screens reached five different ways. app/live.js,
// app/events/index.js, app/activity-clubs/index.js and app/linkups/index.js
// stay real, independently-routable screens (deep links, e.g. from
// notifications, still open them directly) -- this file imports each one's
// own default-exported component and renders it inline for its segment
// rather than owning a second copy of any of their Supabase queries. Only
// "For You" lives here, because it always has: this is app/discover.js.
//
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
//   CAROUSELS instead of stacked boxes. Seven sections of six boxes is
//   forty-two boxes; the owner's word was "too long", and nobody ever reached
//   the bottom section.
//
// WHY IT WAS REBUILT RATHER THAN RETINTED
//
// Rendered, this screen was a DOCUMENT: a display heading per section with a
// hairline under it, a bare sentence where the content should be, a rounded
// pill saying "See on the map", and nothing on the page measured. Every one of
// those is now a machined part -- SectionRule with the real count hung off it,
// Empty carrying the instruction, Action for the button, Field for the search
// well. Nothing here draws its own card any more, which is why this file's
// StyleSheet is a fraction of what it was.

export default function Discover(){
  // Which of the five Happening segments is showing. "For You" first and by
  // default -- it is what this route has always opened to, and every existing
  // link and test that opens /discover expects to land here, not on a picker.
  const [segment,setSegment]=useState("for-you");
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

  // "For You" is the one segment that has always lived in this file -- see
  // scripts/verify-discover.cjs, which reads app/discover.js's own source for
  // the setItems() -> recommend() chain and the explorer_favourites read.
  // Kept exactly where it was; only wrapped, so that check still finds it.
  const forYouContent=loading ? (
    <View style={styles.centre}>
      <ActivityIndicator size="large" color={INK.readout}/>
    </View>
  ) : (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>}
    >
      <ScreenTitle
        eyebrow="HAPPENING"
        title="Discover"
        meta={area ? `What is on around ${area}.` : undefined}
      />

      <View style={styles.body}>
      {/* Not a tinted box with a sentence in it: an edge in the state ink and a
          mono eyebrow, so a partial reading announces itself the way every
          other warning in this app does. */}
      {!!notice && <Notice tone="scheduled" label="PARTIAL READING">{notice}</Notice>}

      <Field label="Search" hint="Businesses, stays and clubs — the same three the map draws.">
        <TextInput
          style={fieldInputStyle}
          placeholder="Search businesses, stays or clubs..."
          placeholderTextColor={INK.readoutFaint}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search businesses, stays or clubs"
          returnKeyType="search"
        />
      </Field>

      <Action
        kind="secondary"
        label="See on the map"
        glyph="map"
        accessibilityLabel="See all of this on the map"
        onPress={()=>router.push("/map")}
      />

      {/*
        SEARCHING REPLACES THE SECTIONS RATHER THAN SITTING ABOVE THEM.
        Somebody who has typed a name is asking one question, and leaving seven
        carousels of recommendations under the answer is the screen talking over
        them.
      */}
      {query.trim().length>=2 ? (
        <View style={styles.section}>
          <SectionRule label="Results" meta={searching ? "…" : String(results.length)}/>

          {searching && <ActivityIndicator color={INK.readoutSoft} style={styles.searchSpinner}/>}

          {!searching && results.length===0 && (
            <Empty
              title="No matches"
              instruction="Nothing matches that yet. Try part of a name, or the town it is in."
              glyph="search"
            />
          )}

          {/* Down the page, not sideways. A carousel is for browsing past things
              you did not ask for; these are all answers to the same question. */}
          <View style={styles.results}>
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

      {/* Not a section of its own -- app/feed.js already is that screen, and a
          strip of the same rows here would be a second place to maintain the
          same thing. A rule and one control, pointing at it. */}
      <SectionRule label="Feed"/>
      <Text style={styles.feedLead}>What the Explorers you follow have been doing.</Text>
      <Action
        kind="secondary"
        label="Explorer feed"
        glyph="people"
        accessibilityLabel="Open the Explorer feed"
        onPress={()=>router.push("/feed")}
      />
      </View>
    </ScrollView>
  );

  // The other four segments are real, independently-routable screens
  // (app/live.js, app/events/index.js, app/activity-clubs/index.js,
  // app/linkups/index.js) rendered inline -- one component, one set of
  // Supabase queries, reachable both from here and by a direct deep link.
  return(
    <Screen>
      <HappeningSegments active={segment} onChange={setSegment}/>
      <View style={styles.segmentRule}/>
      {segment==="for-you" && forYouContent}
      {segment==="live" && <LiveNow/>}
      {segment==="events" && <EventsSegment/>}
      {segment==="clubs" && <ClubsSegment/>}
      {segment==="linkups" && <LinkupsSegment/>}
    </Screen>
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
  screen:{flex:1},
  centre:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:INK.ground},
  // The etched line under the selector, so the segments read as a control on a
  // housing rather than as tabs floating over the page.
  segmentRule:{height:1,backgroundColor:INK.hairline},
  // The Create action floats bottom-right over every screen. Reserving its
  // footprint here is what lets the last card be scrolled clear of it instead
  // of sitting underneath it -- see CREATE_HUB_CLEARANCE in
  // components/CreateHub.js.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  // ScreenTitle carries its own gutter, so the gutter for everything under it
  // lives here rather than on the scroll container.
  body:{paddingHorizontal:16},
  searchSpinner:{marginTop:14},
  section:{marginBottom:4},
  results:{gap:12,alignItems:"flex-start"},
  feedLead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginBottom:12
  }
});
