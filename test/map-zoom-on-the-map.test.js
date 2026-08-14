/* eslint-env jest */

// The owner's complaint, driven through the real screen.
//
//   "You got pop ups that aren't even at the location. They're just popping up
//    in random places, and they're also popping up when you're so far out the
//    map... I don't want it to be this frequent."
//
// utils/mapZoom.js, utils/mapClusters.js and utils/liveBubbles.js each have
// their own tests, and all three passed while the map was a mess -- because
// nothing connected them. components/LivingMapScreen.js never told the bubble
// controller how far out the map was, and components/LivingMap.web.js and
// LivingMap.js never told the screen.
//
// So this asserts the WIRING: move the map, and what is drawn changes.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

// Five places within a few hundred metres of each other in Brighton, and one
// a long way off. Zoomed out they are one heap; in a street they are five
// separate things.
const BUSINESSES=[
  {id:"b1",name:"The Lamb and Flag",category:"food_and_drink",business_type:"pub",claimed:true,address:"1 Pier Road",latitude:50.8220,longitude:-0.1370},
  {id:"b2",name:"Bean There",category:"food_and_drink",business_type:"cafe",claimed:true,address:"3 High Street",latitude:50.8223,longitude:-0.1374},
  {id:"b3",name:"The Anchor",category:"food_and_drink",business_type:"bar",claimed:true,address:"7 Quay",latitude:50.8226,longitude:-0.1378},
  // Hastings. Never in the same cluster as Brighton at any zoom.
  {id:"b4",name:"Far Tavern",category:"food_and_drink",business_type:"bar",claimed:true,address:"90 Long Road",latitude:50.8543,longitude:0.5729}
];
const PROPERTIES=[{id:"p1",name:"Harbour Cottage",address:"2 Quay",latitude:50.8229,longitude:-0.1382,show_availability:true,rooms_available:2}];
const CLUBS=[{id:"c1",name:"Sea Swimmers",category:"Outdoors",location:"The beach",address:"",latitude:50.8232,longitude:-0.1386,status:"open",spaces_available:true}];

function fixture(){
  installFixture({
    user:{id:"me"},
    tables:{businesses:BUSINESSES,properties:PROPERTIES,activity_clubs:CLUBS},
    rpc:{get_live_discovery:[]}
  });
}

async function renderMap(){
  const LivingMapScreen=require("../components/LivingMapScreen").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(LivingMapScreen)));});
  await act(async()=>{});
  return tree;
}

// The renderer, whichever it is, is the one node holding onViewportChange.
function renderer(tree){
  return tree.root.findAll((node)=>typeof node.props?.onViewportChange==="function",{deep:true})[0];
}

// Brighton, wide enough to hold everything above.
function viewportAt(zoom){
  return {north:51.2,south:50.5,east:1.0,west:-1.0,zoom};
}

async function moveTo(tree,zoom){
  await act(async()=>{renderer(tree).props.onViewportChange(viewportAt(zoom));});
  await act(async()=>{});
  return renderer(tree).props;
}

afterEach(()=>{restoreRouterParams();});

test("the map tells the screen where it is looking",async()=>{
  fixture();
  const tree=await renderMap();

  // The prop exists and is wired, which is the whole thing that was missing.
  expect(renderer(tree)).toBeTruthy();

  await act(async()=>{tree.unmount();});
});

test("far out the pins collapse into counted clusters, and close in they do not",async()=>{
  fixture();
  const tree=await renderMap();

  const far=await moveTo(tree,9);
  expect(far.clusters.length).toBeGreaterThan(0);
  expect(far.places.length).toBeLessThan(6);
  // Nothing is lost: everything is either a single or inside a cluster.
  expect(far.places.length+far.clusters.reduce((sum,c)=>sum+c.count,0)).toBe(6);
  // And a cluster carries a number and a sentence, because size is never the
  // only carrier of meaning.
  expect(far.clusters[0].count).toBeGreaterThan(1);
  expect(far.clusters[0].label).toContain("places here");

  const close=await moveTo(tree,17);
  expect(close.clusters).toHaveLength(0);
  expect(close.places).toHaveLength(6);

  await act(async()=>{tree.unmount();});
});

test("Hastings is never swallowed into Brighton's cluster",async()=>{
  fixture();
  const tree=await renderMap();

  const far=await moveTo(tree,9);

  const clustered=far.clusters.flatMap((cluster)=>cluster.members.map((m)=>m.id));
  expect(clustered).not.toContain("b4");
  expect(far.places.map((place)=>place.id)).toContain("b4");

  await act(async()=>{tree.unmount();});
});

test("one bubble at county zoom, up to three in a street",async()=>{
  fixture();
  const tree=await renderMap();

  const far=await moveTo(tree,9);
  expect(far.bubbles.length).toBeLessThanOrEqual(1);

  const close=await moveTo(tree,17);
  expect(close.bubbles.length).toBeGreaterThan(far.bubbles.length);
  expect(close.bubbles.length).toBeLessThanOrEqual(3);

  await act(async()=>{tree.unmount();});
});

// THE "RANDOM PLACES" ONE.
//
// A bubble's tail points at a pin. When that pin is inside a cluster the tail
// points into a heap, which is exactly what the owner saw. Every bubble drawn
// must belong to something drawn on its own.
test("every bubble belongs to a pin that is actually drawn on its own",async()=>{
  fixture();
  const tree=await renderMap();

  for(const zoom of [9,12,14,17]){
    const props=await moveTo(tree,zoom);

    const drawn=new Set([
      ...props.places.map((place)=>place.card?.key),
      ...props.activity.map((item)=>item.key)
    ]);

    for(const bubble of props.bubbles){
      expect(bubble.anchorKey).toBeTruthy();
      expect(drawn.has(bubble.anchorKey)).toBe(true);
    }
  }

  await act(async()=>{tree.unmount();});
});

test("a bubble is never drawn for something off the edge of the screen",async()=>{
  fixture();
  const tree=await renderMap();

  // Brighton only. Hastings is off screen, and its property bubble must not
  // appear pointing at the edge.
  await act(async()=>{
    renderer(tree).props.onViewportChange({north:50.83,south:50.81,east:-0.12,west:-0.15,zoom:17});
  });
  await act(async()=>{});

  for(const bubble of renderer(tree).props.bubbles){
    expect(Number(bubble.latitude)).toBeLessThanOrEqual(50.83);
    expect(Number(bubble.latitude)).toBeGreaterThanOrEqual(50.81);
  }

  await act(async()=>{tree.unmount();});
});

// Count was only half the complaint. "I don't want it to be this frequent" is a
// rate, and one bubble changing every four seconds is still a flicker.
//
// The far-zoom half of this is NOT asserted by driving the clock, and the
// reason is worth writing down: at county zoom every one of these pins ends up
// inside a cluster, so no bubble is eligible at all and there is nothing to
// time. That is the fix working. The rate itself is asserted in
// test/map-zoom.test.js, and what is asserted here is that the screen uses it.
test("the rotation runs at the zoom's own rate, not a fixed one",async()=>{
  jest.useFakeTimers();

  try{
    fixture();
    const tree=await renderMap();

    await act(async()=>{renderer(tree).props.onViewportChange(viewportAt(17));});
    await act(async()=>{});

    const keys=()=>renderer(tree).props.bubbles.map((bubble)=>bubble.key).join("|");
    const before=keys();
    expect(before).not.toBe("");

    // Just short of the close-zoom interval: nothing moves.
    await act(async()=>{jest.advanceTimersByTime(4000);});
    expect(keys()).toBe(before);

    // And on it goes at 4200, which is BUBBLE_INTERVAL_BY_BAND.close.
    await act(async()=>{jest.advanceTimersByTime(300);});
    expect(keys()).not.toBe(before);

    await act(async()=>{tree.unmount();});
  }finally{
    jest.useRealTimers();
  }
});

test("the interval comes from the zoom, and a change of zoom restarts the timer",()=>{
  const fs=require("fs");
  const path=require("path");
  const screen=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","LivingMapScreen.js"),"utf8"
  );

  expect(screen).toMatch(/const interval=bubbleIntervalFor\(viewport\?\.zoom\)/);
  // In the dependency list, or the old rate keeps running after a zoom.
  expect(screen).toMatch(/\},\[candidateCount,interval\]\)/);
});
