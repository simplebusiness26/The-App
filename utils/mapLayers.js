// The Living Map's arithmetic, with no map in it.
//
// WHY THIS FILE EXISTS BEFORE THE MAP DOES
//
// Four of the remaining jobs are map jobs -- Memory pins that fade, the
// historical map, the time slider, the heat layer -- and there is no map to
// draw them on until Packet 21 puts MapLibre on web, Android and iOS. Building
// the renderer and the rules at the same time is how you end up with the rules
// living inside a renderer and having to be written twice, once per platform.
//
// So the rules are here, pure and tested, and Packet 21 draws them. Nothing in
// this file imports React, touches the database or knows what a marker looks
// like. Every function takes the clock as an argument, because a rule about
// time that reads the wall clock cannot be tested.
//
// NONE OF IT DECIDES WHO SEES ANYTHING. Visibility is the database's, through
// can_see_content. What is here is when something is on the map and how it
// looks while it is -- questions that are the same for every viewer who is
// allowed to see it at all.

import {coordinate} from "./coordinates";

// ---------------------------------------------------------------------------
// 1. A Memory pin fades before it goes
// ---------------------------------------------------------------------------
//
// A Memory has two independent clocks (RULES.md): `visibility` decides who may
// see it, for as long as the owner leaves it alone, and `map_until` decides how
// long it sits on TODAY'S map. When map_until passes the pin goes and NOTHING
// ELSE CHANGES -- it stays in the gallery, on My Map and in the historical map.
//
// A pin that is there at full strength and then simply is not there reads as a
// bug. So it fades across the last quarter of its own map window, whatever that
// window's length: a Memory kept on the map for a day fades over six hours, one
// kept for a month fades over a week. The proportion is what is consistent, not
// the duration.

export const FADE_FRACTION=0.25;
// Never fully transparent before it disappears. A pin at 4% opacity is a pin
// nobody can tap, which is worse than one that is gone.
export const MIN_PIN_OPACITY=0.35;

export function memoryPinOpacity(memory,now=Date.now()){
  const until=new Date(memory?.map_until).getTime();
  const from=new Date(memory?.created_at).getTime();

  // No map window means it is not on a fading schedule at all.
  if(!Number.isFinite(until)) return 1;
  if(now>=until) return 0;
  if(!Number.isFinite(from) || from>=until) return 1;

  const window=until-from;
  const fadeStartsAt=until-(window*FADE_FRACTION);
  if(now<=fadeStartsAt) return 1;

  const throughFade=(now-fadeStartsAt)/(window*FADE_FRACTION);
  const opacity=1-throughFade*(1-MIN_PIN_OPACITY);
  return Math.max(MIN_PIN_OPACITY,Math.min(1,opacity));
}

// Is this Memory on today's map at all?
export function isOnMap(memory,now=Date.now()){
  return memoryPinOpacity(memory,now)>0;
}

// ---------------------------------------------------------------------------
// 2. The time slider
// ---------------------------------------------------------------------------
//
// "What was here then." One rule for every kind of thing on the map, because
// four rules would disagree the first time somebody changed one.
//
// A thing is on the map at instant T if it existed by then and had not left by
// then. `from` is when it appeared; `until` is when it stopped being on the map
// -- map_until for a Memory, expires_at for a Moment, nothing at all for a
// review or a place, which never leave.

export function windowOf(item){
  const from=new Date(
    item?.created_at ?? item?.starts_at ?? null
  ).getTime();

  const rawUntil=item?.map_until ?? item?.expires_at ?? item?.ends_at ?? null;
  const until=rawUntil===null || rawUntil===undefined
    ? Infinity
    : new Date(rawUntil).getTime();

  return{
    from:Number.isFinite(from) ? from : -Infinity,
    until:Number.isFinite(until) ? until : Infinity
  };
}

export function isOnMapAt(item,at){
  const moment=at instanceof Date ? at.getTime() : Number(at);
  if(!Number.isFinite(moment)) return false;

  const {from,until}=windowOf(item);
  return moment>=from && moment<until;
}

export function itemsOnMapAt(items,at){
  return (items || []).filter((item)=>isOnMapAt(item,at));
}

// ---------------------------------------------------------------------------
// 3. Heat
// ---------------------------------------------------------------------------
//
// How busy somewhere is, from what people posted there. Grid the coordinates
// and count, rather than drawing one blob per item -- a heat layer is about a
// street being busy, not about which bench somebody sat on.
//
// THE PRECISION IS A PRIVACY DECISION, NOT A RENDERING ONE. Two decimal places
// is roughly a kilometre. Finer than that and a heat cell with one contribution
// in it becomes a pin saying where one person was, which is the thing the
// coordinate rounding in this app exists to prevent. A cell is only drawn once
// it has MIN_CONTRIBUTIONS behind it, for the same reason: a count is still a
// disclosure if it only moves when one person posts.

export const HEAT_PRECISION=2;
export const MIN_CONTRIBUTIONS=3;

export function heatKey(latitude,longitude,precision=HEAT_PRECISION){
  const lat=coordinate(latitude);
  const lon=coordinate(longitude);
  if(lat===null || lon===null) return null;
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
}

// What each kind of thing is worth. A review is the strongest signal because it
// is the most work and the hardest to fake; a Moment says somebody was there
// just now. These are the weights, not a ranking of what matters.
export const HEAT_WEIGHT={
  review:3,
  memory:2,
  moment:1
};

export function heatCells(items,{precision=HEAT_PRECISION,minimum=MIN_CONTRIBUTIONS}={}){
  const cells=new Map();

  for(const item of items || []){
    const key=heatKey(item?.latitude,item?.longitude,precision);
    if(!key) continue;

    const weight=HEAT_WEIGHT[item?.kind] ?? 1;
    const cell=cells.get(key) || {
      key,
      latitude:coordinate(item.latitude),
      longitude:coordinate(item.longitude),
      contributions:0,
      weight:0,
      // How many different Explorers. A cell built from one person posting
      // twenty times is one person, and must not look like a busy street.
      posters:new Set()
    };

    cell.contributions+=1;
    cell.weight+=weight;
    if(item?.user_id) cell.posters.add(item.user_id);
    cells.set(key,cell);
  }

  return [...cells.values()]
    .filter((cell)=>cell.contributions>=minimum && cell.posters.size>=2)
    .map(({posters,...cell})=>({...cell,posterCount:posters.size}))
    .sort((a,b)=>b.weight-a.weight);
}

// ---------------------------------------------------------------------------
// 4. Where a Link-up made from the map gets its location
// ---------------------------------------------------------------------------
//
// Packet 18. Two cases and they are not the same: dropping a Link-up on a
// PLACE means it is at that place and takes its name and exact position;
// dropping it on open map means it is at a rounded point and has no name.
//
// The rounding is utils/coordinates' business elsewhere; here it only has to
// not lie. A Link-up at "somewhere near here" must not carry a precise
// coordinate it did not earn.

export function linkupLocationFrom(target){
  if(target?.kind==="place" && target?.id){
    return{
      place_type:target.type || null,
      place_id:target.id,
      place_name:target.name || null,
      latitude:coordinate(target.latitude),
      longitude:coordinate(target.longitude),
      precise:true
    };
  }

  const lat=coordinate(target?.latitude);
  const lon=coordinate(target?.longitude);
  if(lat===null || lon===null) return null;

  return{
    place_type:null,
    place_id:null,
    place_name:null,
    // Two decimal places, the same grid the heat layer uses: a meeting point
    // is "this corner of town", not a doorstep.
    latitude:Number(lat.toFixed(HEAT_PRECISION)),
    longitude:Number(lon.toFixed(HEAT_PRECISION)),
    precise:false
  };
}
