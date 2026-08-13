import {
  clusteringOn,
  latitudeDegreesPerPixel,
  longitudeDegreesPerPixel
} from "./mapZoom";
import {hasCoordinates} from "./coordinates";

// Pins that are too close together become one pin with a number on it.
//
// THE PROBLEM THIS EXISTS TO FIX
//
// hooks/useLivingMap.js reads every business, every property and every club
// with no limit and no bounds. Zoomed out to a county that is all of them at
// once, drawn on top of each other -- the owner's "it's all clustered together"
// and the reason a bubble could appear to be pointing at nothing: the pin it
// belonged to was under nine others.
//
// WHY NOT MAPLIBRE'S OWN CLUSTERING
//
// Both platforms offer it on a GeoJSON source. Both do it by turning pins into
// style layers, which hands marker appearance to the map provider -- the one
// thing components/LivingMap.js:25-31 and the brief say not to do, and the
// reason a pin is the same shape and ink on web and native today. A grid over a
// few hundred rows is fast, and unlike a style layer it can be tested by
// calling it.
//
// It is the same idea as heatCells() in utils/mapLayers.js: put everything in a
// grid and see what lands together. The difference is the grid size, which
// there is a fixed geographic square and here follows the zoom -- a cluster is
// "these would overlap on screen", which is a screen question.

// How big a grid square is, in pixels of screen. A pin is 34px across, so 64
// means two pins in one square would have been touching.
export const CLUSTER_CELL_PX=64;

// Below this many members a "cluster" is just a pin, and drawing a badge saying
// 1 would be worse than drawing the place.
export const MIN_CLUSTER_MEMBERS=2;

// Grouping key. Floored rather than rounded so the squares tile the world
// without gaps or overlaps, and stringified with a separator that cannot appear
// in a number so "1,-2" and "1,-2" are the same square and "1,-20" is not.
function cellKey(item,cellLat,cellLng){
  const row=Math.floor(Number(item.latitude)/cellLat);
  const column=Math.floor(Number(item.longitude)/cellLng);
  return `${row}|${column}`;
}

// Returns {clusters, singles}.
//
// `singles` are the items to draw exactly as they are drawn today -- same
// marker, same tap, same everything. `clusters` are the squares that had two or
// more, positioned at the AVERAGE of their members rather than at the corner of
// the grid square, so the badge sits on the pins it stands for instead of
// beside them.
//
// Items with no usable coordinates are dropped, not clustered at 0,0. Same rule
// as hasCoordinates() in utils/coordinates.js and for the same reason:
// Number(null) is 0 and Number.isFinite(0) is true.
export function clusterPins(items,{zoom,cellPixels=CLUSTER_CELL_PX,minimum=MIN_CLUSTER_MEMBERS}={}){
  const usableItems=(items || []).filter(hasCoordinates);

  // Close in, everything is itself. This is what makes zooming in feel like the
  // clusters break apart, because that is exactly what happens.
  if(!clusteringOn(zoom)) return {clusters:[],singles:usableItems};

  const perLng=longitudeDegreesPerPixel(zoom);
  if(!perLng) return {clusters:[],singles:usableItems};

  // The latitude scale is taken once, from the middle of what is being drawn,
  // rather than per item -- a grid whose squares change size row by row is not
  // a grid.
  const midLatitude=usableItems.length
    ? usableItems.reduce((sum,item)=>sum+Number(item.latitude),0)/usableItems.length
    : 0;
  const perLat=latitudeDegreesPerPixel(zoom,midLatitude);
  if(!perLat) return {clusters:[],singles:usableItems};

  const cellLng=perLng*cellPixels;
  const cellLat=perLat*cellPixels;

  const squares=new Map();
  for(const item of usableItems){
    const key=cellKey(item,cellLat,cellLng);
    const square=squares.get(key) || [];
    square.push(item);
    squares.set(key,square);
  }

  const clusters=[];
  const singles=[];

  for(const [key,members] of squares){
    if(members.length<minimum){
      singles.push(...members);
      continue;
    }

    let latitude=0;
    let longitude=0;
    for(const member of members){
      latitude+=Number(member.latitude);
      longitude+=Number(member.longitude);
    }

    clusters.push({
      key:`cluster-${key}`,
      latitude:latitude/members.length,
      longitude:longitude/members.length,
      count:members.length,
      // Kept so a tap can say what is in here without a second lookup, and so a
      // test can assert nothing was lost.
      members
    });
  }

  return {clusters,singles};
}

// The keys of the pins that ended up drawn on their own.
//
// utils/liveBubbles.js needs this: a bubble may only point at a pin somebody can
// actually see, and a pin swallowed by a cluster is not one. That single rule is
// what fixes the owner's "pop ups that aren't even at the location" -- a bubble
// can no longer float over a heap of pins with its tail pointing at whichever
// one happens to be underneath.
//
// A place carries its key on its card (utils/placeCards.js); the live activity
// layer carries it directly. Both shapes are read, because the caller passes
// both.
export function visibleKeys(items){
  return new Set((items || []).map((item)=>item?.card?.key || item?.key).filter(Boolean));
}
