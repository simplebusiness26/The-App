/* eslint-env jest */

// Pins that would overlap become one pin with a number on it.
//
// The owner, looking at the Android build zoomed out: "it's all clustered
// together". hooks/useLivingMap.js reads every business, property and club with
// no limit and no bounds, and nothing collapsed them, so a county view drew all
// of them on top of each other.

const {clusterPins,visibleKeys,CLUSTER_CELL_PX}=require("../utils/mapClusters");

function pin(key,latitude,longitude){
  return {key,latitude,longitude};
}

// Brighton, where the map opens.
const CENTRE={latitude:50.8225,longitude:-0.1372};

function around(count,spacing){
  return Array.from({length:count},(_,i)=>
    pin(`p-${i}`,CENTRE.latitude+i*spacing,CENTRE.longitude+i*spacing));
}

test("close in, every pin is itself and nothing is clustered",()=>{
  const {clusters,singles}=clusterPins(around(20,0.0004),{zoom:16});

  expect(clusters).toEqual([]);
  expect(singles).toHaveLength(20);
});

test("far out, pins on top of each other become one counted cluster",()=>{
  const {clusters,singles}=clusterPins(around(20,0.0004),{zoom:9});

  expect(clusters.length).toBeGreaterThan(0);
  expect(singles.length).toBeLessThan(20);

  const clustered=clusters.reduce((sum,entry)=>sum+entry.count,0);
  // Nothing may be lost between the two piles.
  expect(clustered+singles.length).toBe(20);
});

test("zooming in breaks the clusters apart",()=>{
  const pins=around(20,0.0004);

  const far=clusterPins(pins,{zoom:9});
  const near=clusterPins(pins,{zoom:13});
  const close=clusterPins(pins,{zoom:16});

  expect(far.singles.length).toBeLessThanOrEqual(near.singles.length);
  expect(near.singles.length).toBeLessThanOrEqual(close.singles.length);
  expect(close.singles).toHaveLength(20);
});

test("places genuinely far apart are never merged, however far out you are",()=>{
  const {clusters,singles}=clusterPins([
    pin("brighton",50.8225,-0.1372),
    pin("hastings",50.8543,0.5729)
  ],{zoom:9});

  expect(clusters).toEqual([]);
  expect(singles).toHaveLength(2);
});

test("a lone pin is drawn as a pin, not as a cluster of one",()=>{
  const {clusters,singles}=clusterPins([pin("only",50.8225,-0.1372)],{zoom:9});

  expect(clusters).toEqual([]);
  expect(singles).toHaveLength(1);
});

// Same rule as hasCoordinates() in utils/coordinates.js, and for the same
// reason: Number(null) is 0 and Number.isFinite(0) is true, so the obvious
// check clusters every listing with no location in the Gulf of Guinea.
test("a pin with no coordinates is dropped, not plotted at zero",()=>{
  const {clusters,singles}=clusterPins([
    pin("real",50.8225,-0.1372),
    pin("nowhere",null,null),
    {key:"empty"}
  ],{zoom:9});

  expect(singles.map((entry)=>entry.key)).toEqual(["real"]);
  expect(clusters).toEqual([]);
});

test("a cluster sits on its members, not at the corner of a grid square",()=>{
  const pins=[
    pin("a",50.8220,-0.1380),
    pin("b",50.8222,-0.1378),
    pin("c",50.8224,-0.1376)
  ];
  const {clusters}=clusterPins(pins,{zoom:9});

  expect(clusters).toHaveLength(1);
  expect(clusters[0].latitude).toBeCloseTo(50.8222,4);
  expect(clusters[0].longitude).toBeCloseTo(-0.1378,4);
  expect(clusters[0].count).toBe(3);
  expect(clusters[0].members).toHaveLength(3);
});

test("the same input always produces the same clusters",()=>{
  const pins=around(20,0.0004);
  expect(clusterPins(pins,{zoom:11})).toEqual(clusterPins(pins,{zoom:11}));
});

test("a bigger grid square merges more",()=>{
  const pins=around(12,0.002);
  const tight=clusterPins(pins,{zoom:12,cellPixels:CLUSTER_CELL_PX});
  const loose=clusterPins(pins,{zoom:12,cellPixels:CLUSTER_CELL_PX*4});

  expect(loose.singles.length).toBeLessThanOrEqual(tight.singles.length);
});

// What utils/liveBubbles.js needs: a bubble may only point at a pin that is
// drawn on its own.
test("the visible set reads a place's key off its card and an activity's off itself",()=>{
  const keys=visibleKeys([
    {card:{key:"business-1"}},
    {key:"linkup-2"},
    {nothing:true}
  ]);

  expect(keys.has("business-1")).toBe(true);
  expect(keys.has("linkup-2")).toBe(true);
  expect(keys.size).toBe(2);
});
