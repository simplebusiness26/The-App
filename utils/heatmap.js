import {numberOrNull} from "./coordinates";
import {ZOOM_CLOSE,ZOOM_NEAR} from "./mapZoom";

// What makes an area hot.
//
// THE OWNER'S DEFINITION, IN THEIR WORDS
//
//   "if people post a public story... if a lot of people do it in that area then
//    that area becomes hot. That's exactly what I want: if people post a public
//    moment it gets hot" -- and "same if a moment is getting a lot of attention
//    it gets hot".
//
// WHAT THIS REPLACES
//
// utils/mapLayers.js' heatCells(): a grid of ~1km squares, each drawn as one
// flat yellow circle 44-96px across at 15-45% opacity. Discrete, hard-edged,
// one colour, and built from whatever the VIEWER could see -- Moments, Memories
// and reviews, friends-only ones included.
//
// It is not the same kind of object as a Snapchat heatmap and no amount of
// tuning would have made it one. That is a density field: every post spreads a
// soft blob, the blobs add up, and the total is coloured through a ramp. Both
// MapLibre GL JS and MapLibre Native have that as a layer type, so this file
// does not draw anything -- it turns rows into the points and the paint the
// layer wants, which is the part worth testing.
//
// WHERE THE ROWS COME FROM
//
// get_moment_heat() (20260814000000). Public Moments only: the post's audience
// AND the author's profile ceiling both 'everyone'. So every point here is
// already on the map as a Moment pin that every signed-in Explorer can open,
// the heatmap is identical for everybody, and it cannot carry anything a
// friends-only post said.
//
// That is also why there is no minimum-contributors floor any more. The old one
// -- three posts from two different Explorers -- existed because the heat was
// built from content only you could see, so a patch that was warm for you alone
// was a statement about one of your friends. Public-only removes the leak the
// floor was patching. What stops a single post glowing is the layer itself: one
// point at the bottom of the weight curve renders almost invisibly, and heat
// only becomes a colour where several overlap.

// ---------------------------------------------------------------------------
// How much one Moment counts
// ---------------------------------------------------------------------------

// Every public Moment counts for something just by existing -- "if people post
// a public moment it gets hot" is about posting, not about being popular.
export const BASE_WEIGHT=1;

// Attention on top, but on a curve. A Moment with a thousand views should be
// hotter than one with ten and NOT a hundred times hotter, or one viral post
// would be the only thing on the map and the "where is everyone" question would
// stop being answered. Logarithmic, so each order of magnitude adds the same.
export const ATTENTION_SCALE=1.6;

// And a ceiling, because a curve alone is not a promise.
export const MAX_WEIGHT=6;

export function heatWeight(row){
  const attention=Math.max(0,numberOrNull(row?.attention) ?? 0);
  return Math.min(MAX_WEIGHT,BASE_WEIGHT+ATTENTION_SCALE*Math.log10(1+attention));
}

// ---------------------------------------------------------------------------
// The points
// ---------------------------------------------------------------------------

// GeoJSON, because that is what a heatmap layer eats on both platforms. One
// feature per Moment, carrying its weight and nothing else -- no id, no author,
// nothing that could be read back out of the layer.
export function heatPoints(rows){
  return{
    type:"FeatureCollection",
    features:(rows || []).reduce((features,row)=>{
      const latitude=numberOrNull(row?.latitude);
      const longitude=numberOrNull(row?.longitude);
      if(latitude===null || longitude===null) return features;

      features.push({
        type:"Feature",
        properties:{weight:heatWeight(row)},
        geometry:{type:"Point",coordinates:[longitude,latitude]}
      });
      return features;
    },[])
  };
}

// ---------------------------------------------------------------------------
// Where it stops
// ---------------------------------------------------------------------------

// HEAT FADES OUT AS YOU ZOOM IN, and this is the safety rule as much as the
// design one.
//
// A smooth density field zoomed to a street puts one hot spot over one
// building. Everything in it is public, so nothing secret is disclosed -- but a
// glowing house is still the wrong picture, and it is not what the layer is
// for. Heat answers "where is it busy"; the Moment pins underneath answer "what
// is happening here". So the wash is gone by the time the pins are individually
// meaningful, which is the same threshold utils/mapZoom.js uses to stop
// clustering.
export const HEAT_FADE_START=ZOOM_NEAR;   // 12 -- full strength at and below
export const HEAT_FADE_END=ZOOM_CLOSE;    // 14.5 -- nothing at and above

// Never above this, whatever the density. Heat is ground: pins have to stay
// readable over it, and design-system.md says so.
export const MAX_HEAT_OPACITY=0.55;

// How far one Moment's blob spreads, in SCREEN pixels. Pixels rather than
// metres on purpose: it is what makes zooming out gather the map into hotspots
// instead of shrinking them into specks, which is the thing that makes a
// heatmap read as a heatmap.
//
// 34 is roughly a pin's width. Wide enough that two Moments in the same street
// merge into one patch rather than sitting as two dots, tight enough that two
// different towns never bleed into each other.
export const HEAT_RADIUS_PX=34;

export function heatOpacityAt(zoom){
  const level=numberOrNull(zoom);
  if(level===null) return MAX_HEAT_OPACITY;

  if(level<=HEAT_FADE_START) return MAX_HEAT_OPACITY;
  if(level>=HEAT_FADE_END) return 0;

  const through=(level-HEAT_FADE_START)/(HEAT_FADE_END-HEAT_FADE_START);
  return MAX_HEAT_OPACITY*(1-through);
}

export function heatIsVisibleAt(zoom){
  return heatOpacityAt(zoom)>0;
}
