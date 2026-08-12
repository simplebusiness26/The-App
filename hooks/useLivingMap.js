import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "../services/supabase";
import {classificationLabel} from "../utils/taxonomy";
import {hasCoordinates} from "../utils/coordinates";
import {markerForActivity} from "../utils/markers";
import {CARD_KINDS,toCard} from "../utils/placeCards";
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

export const TYPE_FILTERS=[
  {key:"all",label:"All"},
  {key:"business",label:"Businesses"},
  {key:"property",label:"Properties"},
  {key:"activity",label:"Activity Clubs"}
];

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

  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [showLive,setShowLive]=useState(true);
  const [timeWindow,setTimeWindow]=useState(DEFAULT_TIME_WINDOW);

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const loadPlaces=useCallback(async()=>{
    const [businessResult,propertyResult,clubResult]=await Promise.all([
      supabase.from("businesses").select("id,name,category,business_type,claimed,address,latitude,longitude"),
      supabase.from("properties").select("id,name,address,latitude,longitude"),
      supabase.from("activity_clubs").select("id,name,category,location,address,latitude,longitude,status").in("status",["open","full"])
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

  const reload=useCallback(async()=>{
    setLoading(true);
    await Promise.all([loadPlaces(),loadActivity()]);
    setLoading(false);
  },[loadPlaces,loadActivity]);

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
      .filter((item)=>matches(search,{name:item.title,category:item.subtitle,location:item.area}))
      .map((item)=>({...item,marker:markerForActivity(item)}));
  },[activities,showLive,timeWindow,search]);

  return{
    loading,
    error,

    search,setSearch,
    typeFilter,setTypeFilter,
    showLive,setShowLive,
    timeWindow,setTimeWindow,

    places,
    cards,
    activity:liveActivity,

    reload
  };
}
