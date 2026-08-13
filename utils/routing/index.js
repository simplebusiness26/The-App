import * as valhalla from "./valhalla";
import {
  ROUTE_STATUS,
  emptyRoute,
  isUsablePoint,
  isTravelMode,
  DEFAULT_TRAVEL_MODE
} from "./model";

// The one way to ask for a route.
//
// A provider is any object with { name, fetchRoute({origin,destination,mode,
// signal}) } returning a route model. Valhalla is the one that ships; swapping
// it, or pointing at a self-hosted instance, changes nothing above this file.
//
// WHY THE CHECKS ARE HERE AND NOT IN THE PROVIDER
// Refusing a route with no origin, no destination or an unknown mode is the
// app's rule, not Valhalla's, and every future provider would otherwise have to
// reimplement it -- differently. The provider is only asked once the question
// is known to be answerable, which also means a missing GPS fix never becomes a
// network request.
//
// NOTHING HERE THROWS. A screen asking for directions gets a route model back
// whatever happened, with a status saying which. The map must survive its
// routing provider being down; that is only true if failure is a value.

let provider=valhalla;

// For tests, and for the day there is a second provider.
export function setRouteProvider(next){
  provider=next || valhalla;
}

export function routeProviderName(){
  return provider?.name || "none";
}

export async function requestRoute({origin,destination,mode=DEFAULT_TRAVEL_MODE,signal,fetchImpl}={}){
  if(!isUsablePoint(origin)) return emptyRoute(ROUTE_STATUS.NO_LOCATION);
  if(!isUsablePoint(destination)) return emptyRoute(ROUTE_STATUS.NO_DESTINATION);
  if(!isTravelMode(mode)) return emptyRoute(ROUTE_STATUS.UNAVAILABLE,`unknown travel mode: ${mode}`);

  if(typeof provider?.fetchRoute!=="function"){
    return emptyRoute(ROUTE_STATUS.UNAVAILABLE,"no routing provider configured");
  }

  try{
    const route=await provider.fetchRoute({origin,destination,mode,signal,fetchImpl});
    // A provider that returns nothing, or something that is not a route, is a
    // provider failure -- not a crash in whatever asked.
    if(!route || typeof route.status!=="string"){
      return emptyRoute(ROUTE_STATUS.UNAVAILABLE,"routing provider returned nothing usable");
    }
    return route;
  }catch(providerError){
    return emptyRoute(ROUTE_STATUS.UNAVAILABLE,String(providerError?.message || providerError));
  }
}

export * from "./model";
