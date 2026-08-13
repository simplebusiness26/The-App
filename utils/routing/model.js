// The shape of a route, independent of who worked it out.
//
// Everything in the app that draws or describes a route reads this and only
// this. No screen, and neither map renderer, ever sees a provider's own JSON --
// that is the whole point of the folder. Swapping Valhalla for something else,
// or moving from the public server to a self-hosted one, must not reach any
// file outside utils/routing/.
//
// PRIVACY
// `origin` is the Explorer's real position, at neighbourhood-or-better
// accuracy. It exists in memory for as long as a route is on screen and is
// never written anywhere: not to a table, not to storage, not to a log. Nothing
// in this module persists, and nothing may be added here that does. RULES.md --
// anything that reveals position must have an expiry, and the shortest possible
// expiry is "until you close it".

export const TRAVEL_MODES=[
  {key:"walking",label:"Walking"},
  {key:"cycling",label:"Cycling"},
  {key:"driving",label:"Driving"}
];

export const DEFAULT_TRAVEL_MODE="walking";

export function isTravelMode(mode){
  return TRAVEL_MODES.some((entry)=>entry.key===mode);
}

// The statuses a route can be in. A screen branches on these rather than on
// whether some field happens to be null.
export const ROUTE_STATUS={
  OK:"ok",
  NO_LOCATION:"no_location",       // permission refused, or the fix never came
  NO_DESTINATION:"no_destination", // the thing has no coordinates
  UNAVAILABLE:"unavailable",       // the provider failed, or is not configured
  NO_ROUTE:"no_route"              // it answered, and there is no way to walk it
};

// The messages a person reads. Each says what happened and what they can do --
// "Directions unavailable" on its own tells somebody nothing.
export const ROUTE_MESSAGE={
  [ROUTE_STATUS.NO_LOCATION]:"Xplorer needs your location to give directions. You can turn it on in your device settings, or open the place and find it on the map.",
  [ROUTE_STATUS.NO_DESTINATION]:"This place has no position on the map yet, so directions cannot be worked out.",
  [ROUTE_STATUS.UNAVAILABLE]:"Directions could not be worked out just now. The map still works — try again in a moment.",
  [ROUTE_STATUS.NO_ROUTE]:"No route could be found for that way of travelling. Try another."
};

export function routeMessage(status){
  return ROUTE_MESSAGE[status] || "";
}

function isFinitePair(point){
  if(!point) return false;

  // null and "" both become 0 through Number(), and Number.isFinite(0) is true
  // -- so a row with no coordinates would have passed as the point at 0,0 in
  // the Gulf of Guinea, which is where every broken map sends you. Rejected
  // explicitly before the conversion, not after it.
  for(const value of [point.latitude,point.longitude]){
    if(value===null || value===undefined || value==="") return false;
    if(!Number.isFinite(Number(value))) return false;
  }

  return true;
}

// A coordinate that is on Earth. Valhalla will happily accept 200 degrees of
// longitude and return something surprising, and a destination read from a row
// that was never filled in arrives here as nulls.
export function isUsablePoint(point){
  if(!isFinitePair(point)) return false;
  const latitude=Number(point.latitude);
  const longitude=Number(point.longitude);
  return latitude>=-90 && latitude<=90 && longitude>=-180 && longitude<=180;
}

export function emptyRoute(status,reason=""){
  return {
    status,
    reason,
    origin:null,
    destination:null,
    mode:null,
    geometry:[],
    distanceMetres:0,
    durationSeconds:0,
    manoeuvres:[]
  };
}

export function buildRoute({origin,destination,mode,geometry,distanceMetres,durationSeconds,manoeuvres}){
  return {
    status:ROUTE_STATUS.OK,
    reason:"",
    origin,
    destination,
    mode,
    // [{latitude,longitude}], in the app's own order. Neither map renderer
    // should have to know that one provider says [lon,lat] and another [lat,lon].
    geometry:geometry || [],
    distanceMetres:Number(distanceMetres || 0),
    durationSeconds:Number(durationSeconds || 0),
    // Kept even though nothing reads them yet. Turn-by-turn and rerouting both
    // need them, and throwing them away here would mean a provider change later
    // to get them back.
    manoeuvres:manoeuvres || []
  };
}

// ---------------------------------------------------------------------------
// Encoded polyline
// ---------------------------------------------------------------------------
// Google's algorithm, which Valhalla and most others use. PRECISION IS THE
// TRAP: Google, OSRM and Mapbox use 5 decimal places; Valhalla uses SIX. Decode
// a Valhalla shape at precision 5 and every route is drawn ten times too far
// from where it belongs, usually in the sea. So the precision is a parameter
// and the caller states it.
//
// Written out rather than taking a dependency: it is twenty lines, and CLAUDE.md
// says to ask before adding one.
export function decodePolyline(encoded,precision=6){
  if(typeof encoded!=="string" || !encoded.length) return [];

  const factor=Math.pow(10,precision);
  const points=[];

  let index=0;
  let latitude=0;
  let longitude=0;

  while(index<encoded.length){
    let result=1;
    let shift=0;
    let byte;

    do{
      byte=encoded.charCodeAt(index++)-63-1;
      result+=byte<<shift;
      shift+=5;
    }while(byte>=0x1f && index<encoded.length);

    latitude+=(result & 1) ? ~(result>>1) : (result>>1);

    result=1;
    shift=0;

    do{
      byte=encoded.charCodeAt(index++)-63-1;
      result+=byte<<shift;
      shift+=5;
    }while(byte>=0x1f && index<encoded.length);

    longitude+=(result & 1) ? ~(result>>1) : (result>>1);

    points.push({latitude:latitude/factor,longitude:longitude/factor});
  }

  return points;
}

// ---------------------------------------------------------------------------
// What a person reads
// ---------------------------------------------------------------------------

export function distanceLabel(metres){
  const value=Number(metres || 0);
  if(value<1000) return `${Math.round(value/10)*10} m`;
  return `${(value/1000).toFixed(value<10000 ? 1 : 0)} km`;
}

export function durationLabel(seconds){
  const value=Math.max(0,Math.round(Number(seconds || 0)));
  if(value<60) return "under a minute";
  const minutes=Math.round(value/60);
  if(minutes<60) return `${minutes} min`;
  const hours=Math.floor(minutes/60);
  const rest=minutes%60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
