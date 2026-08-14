import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "../services/supabase";
import {classificationLabel} from "../utils/taxonomy";
import {hasCoordinates} from "../utils/coordinates";
import {markerForActivity,markerForMemory,markerForMoment} from "../utils/markers";
import {CARD_KINDS,toCard} from "../utils/placeCards";
import {isOnMapAt,memoryPinOpacity} from "../utils/mapLayers";
import {heatPoints} from "../utils/heatmap";
import {
  DEFAULT_TIME_WINDOW,
  activitiesInWindow,
  toActivities
} from "../utils/liveActivity";

// ONE LIVING MAP BRAIN.
//
// WHAT THIS REPLACES
//
// app/map.js:47-104 and components/PlacesList.js:33-91 were the same code
// written twice: the same three reads, the same signed-out guard, the same
// error isolation, the same search matcher, the same type filter, the same
// time window. Two copies of a rule is two chances for a screen to disagree
// with another screen about what is in front of somebody.
//
// It matters more now than it did. Packet 21 puts a real map on web, Android
// and iOS, and those renderers CANNOT share a component -- a browser canvas and
// a native view are not the same thing and pretending otherwise makes a bad
// abstraction. What they can share is everything that is not drawing, which is
// almost all of it.
//
// WHAT IS HERE, AND WHAT IS DELIBERATELY NOT
//
// Here: loading, the signed-out branch, error isolation, coordinate validation,
// search, the type filter, the time window, and turning rows into map-ready
// models with their markers and cards already worked out.
//
// Not here: anything that draws. No MapView, no canvas, no style URL, no
// provider. A renderer asks this what to put on the map and decides how.
//
// Not here either: who may see what. That is the database's, through row level
// security and get_live_discovery. This hook cannot widen anything, and a bug
// in it cannot leak.

// EVENTS ARE A TYPE NOW, alongside the other three.
//
// The owner: "put events in with businesses properties and activities."
//
// They were the odd one out because they do not live in `places` -- an event
// has a start and an end, so it comes through get_live_discovery with its live
// state rather than sitting on the map for ever like a pub does. That is right
// and it stays. What changes is that the type filter reaches BOTH layers, so
// "show me events" is a question the map can answer whichever half the answer
// is in.
export const TYPE_FILTERS=[
  {key:"all",label:"All"},
  {key:"business",label:"Businesses"},
  {key:"property",label:"Properties"},
  {key:"activity",label:"Activity Clubs"},
  {key:"event",label:"Events"}
];

// Which live things belong to which type. A Link-up, a check-in and a club
// session are not events and must not vanish when somebody asks for events --
// they show under All, and a club session shows under Activity Clubs, because
// that is the thing it is happening at.
const LIVE_KIND_TYPE={
  event:"event",
  club_session:"activity",
  linkup:null,
  checkin:null
};

export function liveMatchesType(kind,typeFilter){
  if(typeFilter==="all") return true;
  return LIVE_KIND_TYPE[kind]===typeFilter;
}

// Brighton. Where the map opens before it knows anything about you.
export const DEFAULT_CENTRE={latitude:50.8225,longitude:-0.1372};
export const DEFAULT_SPAN=0.12;

function matches(term,item,extra){
  const clean=(term || "").trim().toLowerCase();
  if(!clean) return true;
  return [item.name,item.category,item.address,item.location,extra]
    .filter(Boolean)
    .some((value)=>String(value).toLowerCase().includes(clean));
}

export function useLivingMap(){
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [clubs,setClubs]=useState([]);
  const [activities,setActivities]=useState([]);
  const [moments,setMoments]=useState([]);
  const [memories,setMemories]=useState([]);
  const [reviewShots,setReviewShots]=useState([]);
  const [heatRows,setHeatRows]=useState([]);

  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [showLive,setShowLive]=useState(true);
  const [showPosts,setShowPosts]=useState(true);
  // Off by default. Heat is an overview and the map's first job is "what is
  // around me"; somebody asks for the busy view, they do not arrive wanting it.
  const [showHeat,setShowHeat]=useState(false);
  const [timeWindow,setTimeWindow]=useState(DEFAULT_TIME_WINDOW);

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const loadPlaces=useCallback(async()=>{
    const [businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("businesses").select("id,name,category,business_type,claimed,address,latitude,longitude"),
      // show_availability / rooms_available / spaces_available are the Manager
      // switches behind the live bubbles (20260813050000). Both default false,
      // so asking for them changes nothing until a Manager turns one on.
      supabase.from("properties").select("id,name,address,latitude,longitude,show_availability,rooms_available"),
      supabase.from("activity_clubs").select("id,name,category,location,address,latitude,longitude,status,spaces_available").in("status",["open","full"])
    ]);

    // One failed read must not empty the others. Three separate queries, three
    // separate answers.
    if(businessResult.error) console.log(businessResult.error);
    if(propertyResult.error) console.log(propertyResult.error);
    if(clubResult.error) console.log(clubResult.error);

    setBusinesses(businessResult.data || []);
    setProperties(propertyResult.data || []);
    setClubs(clubResult.data || []);

    if(businessResult.error && propertyResult.error && clubResult.error){
      setError("The map could not be loaded.");
    }else{
      setError("");
    }
  },[]);

  // The live layer, from the read model that already existed.
  // get_live_discovery has returned Link-ups, check-ins, events and club
  // sessions in one shape since 20260802211700. There is deliberately no second
  // read model: querying those four tables directly would be a second answer to
  // "what is happening", free to disagree with the first.
  const loadActivity=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();

    // It is SECURITY DEFINER and raises for a signed-out caller, so it is not
    // asked. A signed-out visitor still gets the static map -- the living layer
    // is an addition, never a gate.
    if(!user){
      setActivities([]);
      return;
    }

    const {data,error:liveError}=await supabase.rpc("get_live_discovery",{
      p_area:null,
      p_latitude:null,
      p_longitude:null,
      p_radius_km:25,
      p_window_hours:168
    });

    // A failed live read must not empty the map. The static pins are a separate
    // query and stay exactly as they were.
    if(liveError){
      console.log(liveError);
      setActivities([]);
      return;
    }

    setActivities(toActivities(data));
  },[]);

  // What people have posted, where they posted it.
  //
  // WHO SEES WHAT IS NOT DECIDED HERE, AND CANNOT BE.
  //
  // These are plain selects. Row level security answers them, and it applies
  // both halves of the rule: the audience on the post itself, and the ceiling
  // on the author's profile -- a Moment marked 'everyone' by somebody whose
  // profile says 'friends' is a friends Moment. That is
  // guestbook_private.can_see_content(), it lives in the database, and a bug in
  // this file cannot widen it by one row.
  //
  // Signed out, nothing is asked for at all. A visitor gets the places on the
  // map and no people, which is the same line the living layer draws.
  const loadPosts=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setMoments([]);
      setMemories([]);
      return;
    }

    const [momentResult,memoryResult]=await Promise.all([
      supabase.from("explorer_moments")
        .select("id,user_id,media_url,target_name,latitude,longitude,created_at,expires_at,status")
        .eq("status","published"),
      supabase.from("explorer_memories")
        .select("id,user_id,title,media_url,target_name,latitude,longitude,created_at,map_until,status")
        .eq("status","published")
    ]);

    if(momentResult.error) console.log(momentResult.error);
    if(memoryResult.error) console.log(memoryResult.error);

    setMoments(momentResult.data || []);
    setMemories(memoryResult.data || []);
  },[]);

  // Reviews that have a PHOTO, for the live bubbles.
  //
  // Only ever the photo and which listing it belongs to -- no comment, no
  // rating, no reviewer. A review bubble is the picture; everything else lives
  // on the review, which is where tapping it goes. Asking for less here is not
  // an optimisation, it is the bubble's rule enforced at the query.
  //
  // Bounded, unlike the rest of this hook. Sixty is more than can ever be on
  // screen at once given the collision rule, and it is the newest sixty.
  const loadReviewShots=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setReviewShots([]);return;}

    const {data,error:shotError}=await supabase
      .from("review_media")
      .select("id,review_id,media_url,media_type,moderation_status,created_at,explorer_reviews!inner(id,target_type,target_id,status)")
      .eq("media_type","image")
      .eq("moderation_status","published")
      .order("created_at",{ascending:false})
      .limit(60);

    if(shotError){console.log(shotError);setReviewShots([]);return;}
    setReviewShots(data || []);
  },[]);

  // WHERE PUBLIC MOMENTS ARE BEING POSTED.
  //
  // One RPC, and it is the only source. The heat used to be computed in this
  // file from whatever the viewer could already see -- Moments, Memories and
  // reviews, friends-only ones included -- which meant everybody's heatmap was
  // a different map, and a patch that was warm for you alone was a statement
  // about one of your friends.
  //
  // get_moment_heat() (20260814000000) returns public Moments only: the post's
  // audience AND the author's profile ceiling both 'everyone'. Same heatmap for
  // everybody, and every point in it is already on the map as a pin anybody can
  // open. It returns a position and one number -- no id, no author, no view
  // count -- so a bug in this file cannot widen anything.
  const loadHeat=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setHeatRows([]);return;}

    const {data,error:heatError}=await supabase.rpc("get_moment_heat");

    // A failed heat read must not empty the map. It is a layer, not a gate.
    if(heatError){console.log(heatError);setHeatRows([]);return;}
    setHeatRows(data || []);
  },[]);

  const reload=useCallback(async()=>{
    setLoading(true);
    await Promise.all([loadPlaces(),loadActivity(),loadPosts(),loadReviewShots(),loadHeat()]);
    setLoading(false);
  },[loadPlaces,loadActivity,loadPosts,loadReviewShots,loadHeat]);

  useEffect(()=>{reload();},[reload]);

  // ---------------------------------------------------------------------------
  // What ends up on the map
  // ---------------------------------------------------------------------------
  // hasCoordinates rather than Number.isFinite: Number(null) is 0 and
  // Number.isFinite(0) is true, so the obvious check plots every listing with
  // no location in the Gulf of Guinea.

  const places=useMemo(()=>{
    const showType=(kind)=>typeFilter==="all" || typeFilter===kind;

    const rows=[];

    if(showType("business")){
      for(const row of businesses){
        if(!hasCoordinates(row)) continue;
        if(!matches(search,row,classificationLabel(row))) continue;
        rows.push({...row,kind:CARD_KINDS.BUSINESS,card:toCard(CARD_KINDS.BUSINESS,row)});
      }
    }

    if(showType("property")){
      for(const row of properties){
        if(!hasCoordinates(row)) continue;
        if(!matches(search,row)) continue;
        rows.push({...row,kind:CARD_KINDS.PROPERTY,card:toCard(CARD_KINDS.PROPERTY,row)});
      }
    }

    if(showType("activity")){
      for(const row of clubs){
        if(!hasCoordinates(row)) continue;
        if(!matches(search,row)) continue;
        rows.push({...row,kind:CARD_KINDS.CLUB,card:toCard(CARD_KINDS.CLUB,row)});
      }
    }

    return rows;
  },[businesses,properties,clubs,search,typeFilter]);

  // The cards a person can swipe through. Exactly what is on the map, in the
  // same order -- swiping to a place the filter has hidden would be a different
  // map from the one on screen.
  const cards=useMemo(()=>places.map((row)=>row.card).filter(Boolean),[places]);

  // The time filter applies to the living layer only. Narrowing to "Tonight"
  // would not make a pub stop existing, so the static pins ignore it: the
  // question the filter answers is "what is happening", not "what is there".
  const liveActivity=useMemo(()=>{
    if(!showLive) return [];
    return activitiesInWindow(activities,timeWindow)
      // The type filter reaches the live layer too, now that Events are one of
      // the types. Without this, choosing Events would hide every static pin
      // and leave the events themselves showing alongside Link-ups and
      // check-ins -- the filter doing half its job.
      .filter((item)=>liveMatchesType(item.kind,typeFilter))
      .filter((item)=>matches(search,{name:item.title,category:item.subtitle,location:item.area}))
      .map((item)=>({...item,marker:markerForActivity(item)}));
  },[activities,showLive,timeWindow,typeFilter,search]);

  // ---------------------------------------------------------------------------
  // Moments and Memories on the map
  // ---------------------------------------------------------------------------
  // A Moment is on the map until it expires; a Memory until its map window
  // passes, fading through the last quarter of it. Both rules are
  // utils/mapLayers.js -- written and tested three packets before there was a
  // map to draw them on, which is why they are the same rule for every kind of
  // thing rather than four rules that would disagree the first time one changed.
  //
  // A Memory leaving the map is NOT a Memory being deleted. It stays in the
  // scrapbook; it stops being drawn here.
  const posts=useMemo(()=>{
    if(!showPosts) return [];
    const now=Date.now();

    const drawn=[];

    for(const moment of moments){
      if(!hasCoordinates(moment)) continue;
      if(!isOnMapAt(moment,now)) continue;
      drawn.push({
        key:`moment-${moment.id}`,
        kind:"moment",
        id:moment.id,
        user_id:moment.user_id,
        latitude:Number(moment.latitude),
        longitude:Number(moment.longitude),
        marker:markerForMoment(),
        opacity:1,
        route:`/moments/${moment.id}`
      });
    }

    for(const memory of memories){
      if(!hasCoordinates(memory)) continue;
      if(!isOnMapAt(memory,now)) continue;
      drawn.push({
        key:`memory-${memory.id}`,
        kind:"memory",
        id:memory.id,
        user_id:memory.user_id,
        latitude:Number(memory.latitude),
        longitude:Number(memory.longitude),
        marker:markerForMemory(memory),
        opacity:memoryPinOpacity(memory,now),
        route:`/memories/${memory.id}`
      });
    }

    return drawn;
  },[moments,memories,showPosts]);

  // The heat layer's points, ready for whichever renderer is in front of
  // somebody. utils/heatmap.js turns attention into a weight; neither this file
  // nor a renderer decides what a colour means.
  const heat=useMemo(
    ()=>(showHeat ? heatPoints(heatRows) : heatPoints([])),
    [heatRows,showHeat]
  );

  return{
    loading,
    error,

    search,setSearch,
    typeFilter,setTypeFilter,
    showLive,setShowLive,
    showPosts,setShowPosts,
    showHeat,setShowHeat,
    timeWindow,setTimeWindow,

    places,
    cards,
    activity:liveActivity,
    posts,
    heat,
    reviewShots,
    // The raw rows, for the Memories-only historical map. That mode uses
    // utils/memoryTimeline.js rather than the live-map rule -- "what happened
    // here" and "what is on the map now" are different questions, and isOnMapAt
    // would hide every Memory whose map window has passed, which is all the old
    // ones and therefore the entire point of a history.
    memoryRows:memories,

    reload
  };
}
