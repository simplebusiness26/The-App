import {buildRoute,decodePolyline,ROUTE_STATUS,emptyRoute} from "./model";

// The only file in this app that knows what Valhalla is.
//
// Everything Valhalla-shaped lives here: the URL, the request body, the costing
// names, the response fields, the polyline precision. utils/routing/index.js
// calls it through an interface, and nothing above that has any idea which
// engine answered. Replacing this file replaces the routing provider.
//
// CHECKED AGAINST THE CURRENT DOCUMENTATION, 13 August 2026
// (valhalla.github.io/valhalla/api/route/api-reference/)
//
//   endpoint   GET /route?json={...}
//   required   locations[] with lat/lon, and costing
//   costing    pedestrian | bicycle | auto  (also bus, truck, taxi, motorcycle,
//              motor_scooter, multimodal, bikeshare -- unused here)
//   response   trip.legs[].shape       encoded polyline, SIX decimal places
//              trip.summary.length     in the units asked for
//              trip.summary.time       seconds
//              trip.legs[].maneuvers[] instruction, type, street_names,
//                                      begin_shape_index, end_shape_index, time
//
// THE SIX IS THE TRAP. Google, OSRM and Mapbox all encode at five. Decoding a
// Valhalla shape at five puts the route ten times too far from where it belongs.
//
// WHOSE SERVER
// The default is the public demo run by FOSSGIS e.V. Their stated terms: the
// same fair-use policy as the OSRM and Nominatim demo servers, enforced with
// rate limits, and they ask that apps published to end users identify
// themselves with an X-Client-Id header and tell them via GitHub Discussions.
// The header is sent below. Before this app goes to real users at any scale,
// that conversation needs having, or the endpoint needs pointing at our own --
// which is one environment variable.

const DEFAULT_ENDPOINT="https://valhalla1.openstreetmap.de";

// Read as a literal process.env.NAME so Expo can replace it at build time.
const ENDPOINT=(process.env.EXPO_PUBLIC_ROUTING_URL || DEFAULT_ENDPOINT).replace(/\/+$/,"");

// What FOSSGIS asks published apps to send so they can see who is calling.
const CLIENT_ID="xplorer.app";

const COSTING={
  walking:"pedestrian",
  cycling:"bicycle",
  driving:"auto"
};

// Valhalla's own name for a mode, or null if this app does not offer it. Kept
// here rather than in the model so the model never learns a provider's words.
export function costingFor(mode){
  return COSTING[mode] || null;
}

export const name="valhalla";

export async function fetchRoute({origin,destination,mode,signal,fetchImpl}){
  const costing=costingFor(mode);
  if(!costing) return emptyRoute(ROUTE_STATUS.UNAVAILABLE,`unknown travel mode: ${mode}`);

  const request={
    locations:[
      {lat:Number(origin.latitude),lon:Number(origin.longitude)},
      {lat:Number(destination.latitude),lon:Number(destination.longitude)}
    ],
    costing,
    units:"kilometers",
    // Manoeuvre text, for the turn-by-turn this is not yet.
    directions_options:{units:"kilometers",language:"en-GB"}
  };

  const url=`${ENDPOINT}/route?json=${encodeURIComponent(JSON.stringify(request))}`;
  const doFetch=fetchImpl || (typeof fetch==="function" ? fetch : null);

  if(!doFetch) return emptyRoute(ROUTE_STATUS.UNAVAILABLE,"no fetch available");

  let response;
  try{
    response=await doFetch(url,{
      method:"GET",
      headers:{"X-Client-Id":CLIENT_ID},
      signal
    });
  }catch(networkError){
    // Every failure from here down is UNAVAILABLE, never a throw. A routing
    // provider falling over must not take the map with it.
    return emptyRoute(ROUTE_STATUS.UNAVAILABLE,String(networkError?.message || networkError));
  }

  if(!response?.ok){
    return emptyRoute(ROUTE_STATUS.UNAVAILABLE,`routing provider answered ${response?.status}`);
  }

  let payload;
  try{
    payload=await response.json();
  }catch(parseError){
    return emptyRoute(ROUTE_STATUS.UNAVAILABLE,"routing provider sent something unreadable");
  }

  const trip=payload?.trip;
  const legs=Array.isArray(trip?.legs) ? trip.legs : [];

  // Valhalla answers "no route" as a normal response with an error code rather
  // than an HTTP failure, so an empty trip is a real answer, not a fault.
  if(!legs.length) return emptyRoute(ROUTE_STATUS.NO_ROUTE,payload?.error || "");

  const geometry=[];
  const manoeuvres=[];

  for(const leg of legs){
    // SIX. See the note at the top.
    geometry.push(...decodePolyline(leg?.shape,6));

    for(const step of (leg?.maneuvers || [])){
      manoeuvres.push({
        instruction:step?.instruction || "",
        type:step?.type ?? null,
        streetNames:step?.street_names || [],
        distanceMetres:Number(step?.length || 0)*1000,
        durationSeconds:Number(step?.time || 0),
        beginShapeIndex:step?.begin_shape_index ?? null,
        endShapeIndex:step?.end_shape_index ?? null
      });
    }
  }

  if(!geometry.length) return emptyRoute(ROUTE_STATUS.NO_ROUTE,"");

  return buildRoute({
    origin,
    destination,
    mode,
    geometry,
    // `units:"kilometers"` above, so summary.length is in km.
    distanceMetres:Number(trip?.summary?.length || 0)*1000,
    durationSeconds:Number(trip?.summary?.time || 0),
    manoeuvres
  });
}
