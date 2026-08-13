// How far out is the map, and what does that change.
//
// THE PROBLEM THIS EXISTS TO FIX
//
// The map had no idea. utils/liveBubbles.js has had an inViewport() since it was
// written and nothing ever passed it a viewport, so its own comment -- "a
// missing one means no filtering rather than no bubbles" -- meant that in
// practice there was never any filtering at all. Three bubbles rotated at
// county zoom exactly as they did at street zoom, over a pile of pins that had
// all loaded at once because nothing clusters either.
//
// The owner's words: "they're also popping up when you're so far out the map",
// and, on wanting some anyway, "I don't want it to be this frequent".
//
// So this is one file that answers "how far out are we" and everything that
// follows from it. Pure functions of a number: no React, no map, no state,
// which is what makes "one bubble at county zoom, three in a street" a thing a
// test can assert without a map on screen.

// Web Mercator zoom levels, which is what both MapLibre GL JS and MapLibre
// Native report. Roughly: 10 is a county, 12 a town, 14 a few streets, 16 one
// street. The two thresholds are where the map stops being a place you are and
// starts being a region you are looking at.

import {numberOrNull} from "./coordinates";

export const ZOOM_NEAR=12;
export const ZOOM_CLOSE=14.5;

export const ZOOM_BANDS={FAR:"far",NEAR:"near",CLOSE:"close"};

// numberOrNull, not Number.isFinite(Number(x)). Number(null) is 0 and
// Number.isFinite(0) is true, so the obvious version reads "the map has not
// told us its zoom yet" as "the map is at zoom 0" -- the whole world -- and
// every distance below comes out roughly a thousand times too small. See the
// note in utils/coordinates.js; this file hit it three times in one sitting.
export function zoomBand(zoom){
  const level=numberOrNull(zoom);
  if(level===null) return ZOOM_BANDS.FAR;
  if(level>=ZOOM_CLOSE) return ZOOM_BANDS.CLOSE;
  if(level>=ZOOM_NEAR) return ZOOM_BANDS.NEAR;
  return ZOOM_BANDS.FAR;
}

// How many bubbles may be on screen at once. Three was the brief's ceiling and
// it stays the ceiling -- it is now the ceiling for a street rather than for
// everywhere.
export const BUBBLES_BY_BAND={
  [ZOOM_BANDS.FAR]:1,
  [ZOOM_BANDS.NEAR]:2,
  [ZOOM_BANDS.CLOSE]:3
};

export function bubbleLimitFor(zoom){
  return BUBBLES_BY_BAND[zoomBand(zoom)];
}

// How often the rotation moves on. Frequency is a separate complaint from
// count: one bubble changing every four seconds is still a flicker. Far out it
// changes slowly, which is what "the occasional bubble" means.
export const BUBBLE_INTERVAL_BY_BAND={
  [ZOOM_BANDS.FAR]:9000,
  [ZOOM_BANDS.NEAR]:6000,
  [ZOOM_BANDS.CLOSE]:4200
};

export function bubbleIntervalFor(zoom){
  return BUBBLE_INTERVAL_BY_BAND[zoomBand(zoom)];
}

// Pins collapse into counted clusters unless you are close enough for them to
// be individually meaningful.
export function clusteringOn(zoom){
  return zoomBand(zoom)!==ZOOM_BANDS.CLOSE;
}

// ---------------------------------------------------------------------------
// Degrees and pixels
// ---------------------------------------------------------------------------

// WHY THIS IS HERE AT ALL
//
// utils/liveBubbles.js measured "too close together to both be readable" in
// DEGREES: a fixed 0.003, described in its own comment as "roughly 300m at
// these latitudes". Which it is -- and at zoom 10, 300m is about two pixels. So
// the rule that was meant to stop bubbles overlapping did nothing at exactly
// the zoom the owner was complaining about, and bubbles piled on top of each
// other and on top of pins they had nothing to do with.
//
// Overlap is a screen problem, so it has to be measured on the screen. Web
// Mercator: the whole world is 256 pixels wide at zoom 0 and doubles every
// level. A degree of LONGITUDE is therefore the same number of pixels
// everywhere; a degree of LATITUDE gets smaller as you go north, by the cosine
// of the latitude. Those two facts are the whole conversion, and getting them
// the wrong way round is easy -- so they are two named functions rather than
// one with an argument.
export const WORLD_TILE_PIXELS=256;

export function longitudeDegreesPerPixel(zoom){
  const level=numberOrNull(zoom);
  if(level===null) return 0;
  return 360/(WORLD_TILE_PIXELS*Math.pow(2,level));
}

export function latitudeDegreesPerPixel(zoom,latitude=0){
  const perPixel=longitudeDegreesPerPixel(zoom);
  if(!perPixel) return 0;

  const lat=numberOrNull(latitude);
  if(lat===null) return perPixel;

  // Clamped at 85 degrees, which is where Web Mercator stops anyway. Nothing in
  // this app goes near it, but a zero here would divide into infinity later and
  // a NaN on the map is worse than being slightly wrong at the pole.
  return perPixel*Math.max(0.01,Math.cos((Math.min(85,Math.abs(lat))*Math.PI)/180));
}

// How far apart two points are ON SCREEN, in pixels, at this zoom. This is the
// number every "would these two cover each other" question actually wants.
export function pixelDistance(a,b,zoom){
  const perLng=longitudeDegreesPerPixel(zoom);
  if(!perLng) return Infinity;

  const aLat=numberOrNull(a?.latitude);
  const aLng=numberOrNull(a?.longitude);
  const bLat=numberOrNull(b?.latitude);
  const bLng=numberOrNull(b?.longitude);
  if([aLat,aLng,bLat,bLng].some((value)=>value===null)) return Infinity;

  const perLat=latitudeDegreesPerPixel(zoom,(aLat+bLat)/2);
  if(!perLat) return Infinity;

  const dx=(aLng-bLng)/perLng;
  const dy=(aLat-bLat)/perLat;
  return Math.sqrt(dx*dx+dy*dy);
}

// Two bubbles closer than this on screen would cover each other. Generous on
// purpose, the same reasoning the old degree constant carried: one fewer bubble
// is better than a bubble nobody can read.
export const MIN_BUBBLE_SEPARATION_PX=120;
