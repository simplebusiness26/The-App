/* eslint-env jest */

// What makes an area hot.
//
// The owner, with a screenshot of Snapchat's map: "you see them hot-spots they
// are literally that hot spots thats what I want on my map if theres moments
// being posted it becomes a hot-spot same if a moment is getting alot of
// attention it gets hot".
//
// What was there before was a different kind of object: a grid of ~1km squares,
// each drawn as one flat yellow circle. No amount of tuning turns that into a
// heatmap -- a heatmap is a density field, where every post spreads a soft blob
// and the blobs add up.

const heat=require("../utils/heatmap");

// ---------------------------------------------------------------------------
// How much one Moment counts
// ---------------------------------------------------------------------------

test("posting a public Moment is enough to count for something",()=>{
  // "if people post a public moment it gets hot" is about POSTING. A Moment
  // nobody has looked at yet still puts warmth on the map.
  expect(heat.heatWeight({attention:0})).toBe(heat.BASE_WEIGHT);
  expect(heat.heatWeight({})).toBe(heat.BASE_WEIGHT);
  expect(heat.heatWeight(null)).toBe(heat.BASE_WEIGHT);
});

test("attention makes it hotter",()=>{
  const quiet=heat.heatWeight({attention:0});
  const some=heat.heatWeight({attention:10});
  const busy=heat.heatWeight({attention:100});

  expect(some).toBeGreaterThan(quiet);
  expect(busy).toBeGreaterThan(some);
});

// One viral post must not become the only thing on the map, or "where is
// everyone right now" stops being answered.
test("ten times the attention is not ten times the heat",()=>{
  const ten=heat.heatWeight({attention:10});
  const hundred=heat.heatWeight({attention:100});

  expect(hundred).toBeLessThan(ten*2);

  // Each order of magnitude adds about the same amount -- ABOUT, to one decimal
  // place. The curve is log10(1+attention) rather than log10(attention), so the
  // +1 shifts the early steps slightly and the gaps are close rather than
  // identical. Asserting them equal to five places was asserting a formula this
  // is not.
  const step=(a,b)=>heat.heatWeight({attention:b})-heat.heatWeight({attention:a});
  expect(step(100,1000)/step(10,100)).toBeGreaterThan(0.9);
  expect(step(100,1000)/step(10,100)).toBeLessThan(1.1);
});

test("there is a ceiling, because a curve alone is not a promise",()=>{
  expect(heat.heatWeight({attention:10_000_000})).toBe(heat.MAX_WEIGHT);
});

test("nonsense attention does not become a negative or a NaN",()=>{
  expect(heat.heatWeight({attention:-50})).toBe(heat.BASE_WEIGHT);
  expect(heat.heatWeight({attention:"lots"})).toBe(heat.BASE_WEIGHT);
  expect(Number.isFinite(heat.heatWeight({attention:null}))).toBe(true);
});

// ---------------------------------------------------------------------------
// The points
// ---------------------------------------------------------------------------

test("every Moment becomes one point, in GeoJSON order",()=>{
  const points=heat.heatPoints([{latitude:50.8225,longitude:-0.1372,attention:5}]);

  expect(points.type).toBe("FeatureCollection");
  expect(points.features).toHaveLength(1);
  // Longitude first. Getting this round the wrong way puts Brighton in Somalia.
  expect(points.features[0].geometry.coordinates).toEqual([-0.1372,50.8225]);
});

// THE PRIVACY ONE. get_moment_heat() returns a position and one blended number
// -- no id, no author, no view count -- and nothing here may add one back.
test("a point carries a weight and nothing else",()=>{
  const points=heat.heatPoints([
    {latitude:50.8225,longitude:-0.1372,attention:5,user_id:"someone",id:"m1"}
  ]);

  expect(Object.keys(points.features[0].properties)).toEqual(["weight"]);
  expect(JSON.stringify(points)).not.toContain("someone");
  expect(JSON.stringify(points)).not.toContain("m1");
});

test("a Moment with no location is dropped, not plotted at zero",()=>{
  const points=heat.heatPoints([
    {latitude:50.8225,longitude:-0.1372,attention:1},
    {latitude:null,longitude:null,attention:9},
    {attention:9},
    {latitude:"",longitude:"",attention:9}
  ]);

  expect(points.features).toHaveLength(1);
});

test("nothing at all is an empty layer, not a crash",()=>{
  expect(heat.heatPoints([]).features).toEqual([]);
  expect(heat.heatPoints(null).features).toEqual([]);
});

// ---------------------------------------------------------------------------
// Where it stops
// ---------------------------------------------------------------------------
//
// A density field zoomed to a street puts one hot spot over one building.
// Everything in the layer is public, so nothing secret is disclosed -- but a
// glowing house is the wrong picture and it is not what the layer is for.

test("full strength across a region, gone by street level",()=>{
  expect(heat.heatOpacityAt(9)).toBe(heat.MAX_HEAT_OPACITY);
  expect(heat.heatOpacityAt(heat.HEAT_FADE_START)).toBe(heat.MAX_HEAT_OPACITY);
  expect(heat.heatOpacityAt(heat.HEAT_FADE_END)).toBe(0);
  expect(heat.heatOpacityAt(18)).toBe(0);
});

test("it fades rather than switching off",()=>{
  const middle=(heat.HEAT_FADE_START+heat.HEAT_FADE_END)/2;
  const half=heat.heatOpacityAt(middle);

  expect(half).toBeGreaterThan(0);
  expect(half).toBeLessThan(heat.MAX_HEAT_OPACITY);
  expect(half).toBeCloseTo(heat.MAX_HEAT_OPACITY/2,5);
});

test("heat never covers the pins it is under",()=>{
  // design-system.md: heat is ground. Whatever the density, it is capped.
  for(const zoom of [1,5,9,12,13,14,15,20]){
    expect(heat.heatOpacityAt(zoom)).toBeLessThanOrEqual(heat.MAX_HEAT_OPACITY);
    expect(heat.heatOpacityAt(zoom)).toBeGreaterThanOrEqual(0);
  }
  expect(heat.MAX_HEAT_OPACITY).toBeLessThan(0.6);
});

test("an unknown zoom draws the heat rather than hiding it",()=>{
  // Before the map has reported anything, the safe default is the wide view --
  // which is the one that cannot point at a building.
  expect(heat.heatOpacityAt(undefined)).toBe(heat.MAX_HEAT_OPACITY);
  expect(heat.heatIsVisibleAt(null)).toBe(true);
  expect(heat.heatIsVisibleAt(18)).toBe(false);
});

// ---------------------------------------------------------------------------
// The paint
// ---------------------------------------------------------------------------

test("the ramp starts transparent, or the whole map is tinted",()=>{
  const {heatmapPaint}=require("../utils/markers");
  const colour=heatmapPaint()["heatmap-color"];

  expect(colour[0]).toBe("interpolate");
  expect(colour[2]).toEqual(["heatmap-density"]);
  // First stop: nothing happening here means nothing drawn here. Snapchat's is
  // a wash over the busy parts, not a filter over the world.
  expect(colour[3]).toBe(0);
  expect(colour[4]).toBe("rgba(0,0,0,0)");
});

test("the paint runs cool to hot and reads the weight off the point",()=>{
  const {heatmapPaint}=require("../utils/markers");
  const {HEAT_RAMP}=require("../utils/tokens");
  const paint=heatmapPaint();

  expect(paint["heatmap-weight"]).toEqual(["get","weight"]);

  const stops=paint["heatmap-color"].slice(5);
  for(let i=0;i<HEAT_RAMP.length;i+=1){
    expect(stops[i*2]).toBe(HEAT_RAMP[i].at);
    expect(stops[i*2+1]).toBe(HEAT_RAMP[i].colour);
  }
});

// The blob spreads in SCREEN pixels, which is what makes zooming out gather the
// map into hotspots instead of shrinking them into specks.
test("the blob is measured in pixels, not in metres",()=>{
  const {heatmapPaint}=require("../utils/markers");
  expect(heatmapPaint({radius:heat.HEAT_RADIUS_PX})["heatmap-radius"]).toBe(heat.HEAT_RADIUS_PX);
});

test("the ramp is never one of the three inks",()=>{
  // design-system.md: blue, pink and yellow say what state a PLACE is in. The
  // ramp says how many PEOPLE are posting. Sharing a colour would make the map
  // answer the wrong question.
  const {HEAT_RAMP,INK}=require("../utils/tokens");
  const inks=[INK.blue,INK.pink,INK.yellow,INK.green,INK.red].map((c)=>c.toUpperCase());

  for(const stop of HEAT_RAMP){
    expect(inks).not.toContain(stop.colour.toUpperCase());
  }
});
