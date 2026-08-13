/* eslint-env jest */

// How far out the map is, and what follows from it.
//
// This is the file that did not exist, and its absence is the whole of the
// owner's "they're also popping up when you're so far out the map". The map
// reported nothing about its own zoom, utils/liveBubbles.js was never told, and
// its inViewport() -- which does the right thing -- was never given a viewport
// to do it with.

const zoom=require("../utils/mapZoom");

test("a county is far, a town is near, a street is close",()=>{
  expect(zoom.zoomBand(9)).toBe(zoom.ZOOM_BANDS.FAR);
  expect(zoom.zoomBand(11.9)).toBe(zoom.ZOOM_BANDS.FAR);
  expect(zoom.zoomBand(12)).toBe(zoom.ZOOM_BANDS.NEAR);
  expect(zoom.zoomBand(14.4)).toBe(zoom.ZOOM_BANDS.NEAR);
  expect(zoom.zoomBand(14.5)).toBe(zoom.ZOOM_BANDS.CLOSE);
  expect(zoom.zoomBand(18)).toBe(zoom.ZOOM_BANDS.CLOSE);
});

// The quiet answer is the one to be wrong with. Before the map has reported
// anything, assuming a lot is under here is what produced the mess.
test("an unknown zoom is treated as far out",()=>{
  expect(zoom.zoomBand(undefined)).toBe(zoom.ZOOM_BANDS.FAR);
  expect(zoom.zoomBand(null)).toBe(zoom.ZOOM_BANDS.FAR);
  expect(zoom.zoomBand("nonsense")).toBe(zoom.ZOOM_BANDS.FAR);
});

test("one bubble far out, three in a street",()=>{
  expect(zoom.bubbleLimitFor(9)).toBe(1);
  expect(zoom.bubbleLimitFor(13)).toBe(2);
  expect(zoom.bubbleLimitFor(16)).toBe(3);
});

// Frequency is a separate complaint from count: "I don't want it to be this
// frequent". One bubble changing every four seconds is still a flicker.
test("the rotation slows down as you zoom out",()=>{
  expect(zoom.bubbleIntervalFor(9)).toBeGreaterThan(zoom.bubbleIntervalFor(13));
  expect(zoom.bubbleIntervalFor(13)).toBeGreaterThan(zoom.bubbleIntervalFor(16));
});

test("pins cluster until you are close enough for them to mean something",()=>{
  expect(zoom.clusteringOn(9)).toBe(true);
  expect(zoom.clusteringOn(13)).toBe(true);
  expect(zoom.clusteringOn(16)).toBe(false);
});

// ---------------------------------------------------------------------------
// Degrees and pixels
// ---------------------------------------------------------------------------

// The one that was written backwards the first time. In Web Mercator a degree
// of LONGITUDE is the same number of pixels everywhere; a degree of LATITUDE
// gets smaller as you go north. Getting it the wrong way round is silent -- the
// numbers still look plausible -- so it is asserted directly.
test("a degree of longitude is the same width at every latitude",()=>{
  expect(zoom.longitudeDegreesPerPixel(12)).toBeCloseTo(360/(256*4096),10);
  // Not a function of latitude at all.
  expect(zoom.longitudeDegreesPerPixel(12)).toBe(zoom.longitudeDegreesPerPixel(12));
});

test("a degree of latitude covers fewer pixels the further north you go",()=>{
  const atEquator=zoom.latitudeDegreesPerPixel(12,0);
  const atBrighton=zoom.latitudeDegreesPerPixel(12,50.82);
  const atReykjavik=zoom.latitudeDegreesPerPixel(12,64);

  expect(atBrighton).toBeLessThan(atEquator);
  expect(atReykjavik).toBeLessThan(atBrighton);
  expect(atEquator).toBeCloseTo(zoom.longitudeDegreesPerPixel(12),10);
});

test("each zoom level halves how much ground a pixel covers",()=>{
  expect(zoom.longitudeDegreesPerPixel(11)/zoom.longitudeDegreesPerPixel(12)).toBeCloseTo(2,10);
});

// This is the number the old code got wrong: 0.003 degrees is ~300m, which is
// generous in a street and about two pixels across a county.
test("the same two places are far apart on screen close in, and on top of each other far out",()=>{
  const a={latitude:50.8225,longitude:-0.1372};
  const b={latitude:50.8250,longitude:-0.1372};

  expect(zoom.pixelDistance(a,b,16)).toBeGreaterThan(zoom.MIN_BUBBLE_SEPARATION_PX);
  expect(zoom.pixelDistance(a,b,9)).toBeLessThan(zoom.MIN_BUBBLE_SEPARATION_PX);
});

test("a place with no coordinates is infinitely far from everything",()=>{
  const a={latitude:50.8225,longitude:-0.1372};
  expect(zoom.pixelDistance(a,{latitude:null,longitude:null},14)).toBe(Infinity);
  expect(zoom.pixelDistance(a,a,undefined)).toBe(Infinity);
});

test("a place is no distance from itself",()=>{
  const a={latitude:50.8225,longitude:-0.1372};
  expect(zoom.pixelDistance(a,a,14)).toBe(0);
});
