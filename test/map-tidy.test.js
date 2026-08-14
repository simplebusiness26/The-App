/* eslint-env jest */

// "The whole map's still a mess... sort it out, clean it up, tidy it up, make
//  it make sense."
//
// Five separate complaints from four screenshots of the live Android build,
// each with its own cause. This asserts each cause is gone rather than that the
// screen renders.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {installFixture,labelsOf,textOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {TYPE_FILTERS,liveMatchesType}=require("../hooks/useLivingMap");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

const BUSINESS={id:"b1",name:"The Lamb and Flag",category:"food_and_drink",
  business_type:"pub",claimed:true,address:"1 Pier Road",latitude:50.822,longitude:-0.137};
const PROPERTY={id:"p1",name:"Harbour Cottage",address:"2 Quay",latitude:50.8225,longitude:-0.1372};
const CLUB={id:"c1",name:"Sea Swimmers",category:"Outdoors",location:"The beach",address:"",
  latitude:50.8221,longitude:-0.1371,status:"open"};

const NOW=Date.now();
const DAY=1000*60*60*24;

const LIVE=[
  {item_id:"e1",item_type:"event",title:"Pier fireworks",subtitle:"Music",area:"Brighton",
   latitude:50.8230,longitude:-0.1380,starts_at:new Date(NOW-600000).toISOString(),
   ends_at:new Date(NOW+3600000).toISOString(),status:"live",deep_link:"/events/e1"},
  {item_id:"l1",item_type:"linkup",title:"Sunset swim",subtitle:"Outdoors",area:"Brighton",
   latitude:50.8226,longitude:-0.1373,starts_at:new Date(NOW-600000).toISOString(),
   ends_at:new Date(NOW+3600000).toISOString(),status:"live",deep_link:"/linkups/l1"}
];

// Two months old, which is the case that made the Memories map look empty.
const MEMORIES=[
  {id:"m1",user_id:"me",title:"The pier at dusk",media_url:"https://example.test/a.jpg",
   target_name:"The Pier",latitude:50.8224,longitude:-0.1371,
   created_at:new Date(NOW-60*DAY).toISOString(),
   map_until:new Date(NOW-50*DAY).toISOString(),status:"published"}
];

function fixture({user={id:"me"},memories=MEMORIES,live=LIVE}={}){
  installFixture({
    user,
    tables:{
      businesses:[BUSINESS],
      properties:[PROPERTY],
      activity_clubs:[CLUB],
      explorer_moments:[],
      explorer_memories:memories
    },
    rpc:{get_live_discovery:live,get_moment_heat:[]}
  });
}

async function renderMap(){
  const LivingMapScreen=require("../components/LivingMapScreen").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(LivingMapScreen)));});
  await act(async()=>{});
  return tree;
}

function control(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0] || null;
}

async function tap(tree,label){
  await act(async()=>{control(tree,label).props.onPress();});
  await act(async()=>{});
}

function renderer(tree){
  return tree.root.findAll(
    (node)=>typeof node.props?.onViewportChange==="function",
    {deep:true}
  )[0];
}

afterEach(()=>{restoreRouterParams();});

// ---------------------------------------------------------------------------
// 1. The map is clean until you ask
// ---------------------------------------------------------------------------

test("the map opens with no search box and no chips on it",async()=>{
  // The owner's screenshots: a search box and two rows of chips covering a
  // third of the screen, one of them over a photo bubble.
  fixture();
  const tree=await renderMap();

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels).toContain("Search the map");
  expect(labels).toContain("Filter the map");

  // And nothing else. No filter chips, no search field.
  expect(labels).not.toContain("Show Businesses");
  expect(labels).not.toContain("Show busy areas");

  await act(async()=>{tree.unmount();});
});

test("each icon opens its own panel and closes it again",async()=>{
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  expect(labelsOf(tree.toJSON()).join(" | ")).toContain("Show Businesses");

  // "Have them so they can be hidden after as well."
  await tap(tree,"Hide the map filters");
  expect(labelsOf(tree.toJSON()).join(" | ")).not.toContain("Show Businesses");

  await tap(tree,"Search the map");
  expect(labelsOf(tree.toJSON()).join(" | ")).toContain("Search the map");
  await act(async()=>{tree.unmount();});
});

test("only one panel is ever open, so nothing stacks over the map",async()=>{
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Search the map");

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels).not.toContain("Show Businesses");

  await act(async()=>{tree.unmount();});
});

test("a filter left on is never invisible",async()=>{
  // A map quietly hiding two thirds of itself with no sign on screen is worse
  // than a chip.
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Properties");
  await tap(tree,"Hide the map filters");

  expect(textOf(tree.toJSON())).toContain("Properties");

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// 2. Events are a type
// ---------------------------------------------------------------------------

test("Events sits with Businesses, Properties and Activity Clubs",()=>{
  // The owner: "put events in with businesses properties and activities."
  expect(TYPE_FILTERS.map((entry)=>entry.key))
    .toEqual(["all","business","property","activity","event"]);
});

test("choosing Events reaches the live layer, not just the pins",()=>{
  // Events do not live in `places` -- they have a start and an end, so they
  // come through get_live_discovery. Without this the filter would hide every
  // static pin and leave events showing beside Link-ups: half a job.
  expect(liveMatchesType("event","event")).toBe(true);
  expect(liveMatchesType("linkup","event")).toBe(false);
  expect(liveMatchesType("checkin","event")).toBe(false);

  // A club session belongs to the club it is happening at.
  expect(liveMatchesType("club_session","activity")).toBe(true);
  expect(liveMatchesType("club_session","event")).toBe(false);

  // Everything shows under All.
  for(const kind of ["event","linkup","checkin","club_session"]){
    expect(liveMatchesType(kind,"all")).toBe(true);
  }
});

test("selecting Events shows the event and hides the Link-up and the pins",async()=>{
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Events");

  const props=renderer(tree).props;
  expect(props.activity.map((item)=>item.key)).toEqual(["event-e1"]);
  expect(props.places).toHaveLength(0);

  await act(async()=>{tree.unmount();});
});

test("selecting Businesses hides the event",async()=>{
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Businesses");

  expect(renderer(tree).props.activity).toHaveLength(0);
  expect(renderer(tree).props.places.map((place)=>place.id)).toEqual(["b1"]);

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// 3. Memories mode
// ---------------------------------------------------------------------------

test("Memories mode draws Memories that are months old",async()=>{
  // THE ONE THE OWNER SAW. The slider used to end at today whatever the data
  // said, and it opens at its right-hand end, so a two-month-old Memory sat
  // outside the ten-day window and the map looked empty.
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Memories on a timeline");

  expect(renderer(tree).props.pins.map((pin)=>pin.key)).toContain("memory-m1");

  await act(async()=>{tree.unmount();});
});

test("in Memories mode the places are faint, and not tappable",async()=>{
  // The owner asked for Memories only, then chose to keep the places for
  // orientation. Faint and inert: a Memories map where tapping opens a pub is a
  // map of pubs with Memories on it.
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Memories on a timeline");

  const props=renderer(tree).props;
  expect(props.placeOpacity).toBeLessThan(0.5);
  expect(props.placeOpacity).toBeGreaterThan(0);
  expect(props.onSelectPlace).toBeUndefined();

  await act(async()=>{tree.unmount();});
});

test("no clusters and no bubbles over a history",async()=>{
  // A "Spaces open" bubble on a map of last April is the live map leaking into
  // the one that replaced it.
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Memories on a timeline");

  expect(renderer(tree).props.clusters).toEqual([]);
  expect(renderer(tree).props.bubbles).toEqual([]);

  await act(async()=>{tree.unmount();});
});

test("leaving Memories mode puts the map back",async()=>{
  fixture();
  const tree=await renderMap();

  await tap(tree,"Filter the map");
  await tap(tree,"Show Memories on a timeline");
  await tap(tree,"Leave the Memories timeline");

  const props=renderer(tree).props;
  expect(props.placeOpacity).toBe(1);
  expect(typeof props.onSelectPlace).toBe("function");

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// 4. A bubble sits on its own pin
// ---------------------------------------------------------------------------

test("the native bubble anchors its BOTTOM to the coordinate",()=>{
  // It was {x:0.5, y:1.35}, which anchors a point 35% of the bubble's height
  // BELOW its bottom edge -- pushing the bubble roughly thirty pixels up, tail
  // pointing at empty air. The owner: "these floating reviews, they're not
  // floating above their business, they're just popping up randomly."
  //
  // Only the phone had it: components/LivingMap.web.js uses anchor:"bottom",
  // which is this, correctly, and always did.
  // Comments stripped: the file names the value it is refusing, so a check that
  // read its own reasoning would fail on a correct file.
  const native=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","LivingMap.js"),"utf8"
  ).replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");

  expect(native).toMatch(/anchor=\{\{x:0\.5,y:1\}\}/);
  expect(native).not.toMatch(/y:1\.35/);
});

test("the bubble lifts itself by exactly half a pin",()=>{
  // The anchor puts the bottom of the bubble ON the coordinate, and a pin is
  // 34px drawn centred on the same coordinate -- so without the lift the tail
  // tip lands in the middle of the pin instead of on top of it.
  const bubble=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","LiveBubble.js"),"utf8"
  );
  const marker=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","PlaceMarker.js"),"utf8"
  );

  const pin=Number(marker.match(/const CANVAS=(\d+)/)[1]);
  const lift=Number(bubble.match(/const PIN_RADIUS=(\d+)/)[1]);

  expect(lift).toBe(pin/2);
  expect(bubble).toMatch(/stack:\{marginBottom:PIN_RADIUS\}/);
});

test("every drawn bubble is at exactly the coordinates of its own pin",async()=>{
  // The property "not above the business they reviewed" is a violation of.
  fixture();
  const tree=await renderMap();

  for(const zoom of [10,13,16,18]){
    await act(async()=>{
      renderer(tree).props.onViewportChange({north:51.2,south:50.5,east:1,west:-1,zoom});
    });
    await act(async()=>{});

    const props=renderer(tree).props;
    const at=new Map();
    for(const place of props.places) at.set(place.card?.key,place);
    for(const item of props.activity) at.set(item.key,item);

    for(const drawn of props.bubbles){
      const pin=at.get(drawn.anchorKey);
      expect(pin).toBeTruthy();
      expect(Number(drawn.latitude)).toBe(Number(pin.latitude));
      expect(Number(drawn.longitude)).toBe(Number(pin.longitude));
    }
  }

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// 5. One Log in
// ---------------------------------------------------------------------------

test("a signed-out visitor is offered Log in once, with Create account",async()=>{
  // There were two at the same time -- the header's and FloatingLogin's.
  // The owner: "look at the logins and the buttons in the way."
  fixture({user:null});
  const tree=await renderMap();

  const logins=labelsOf(tree.toJSON()).filter((label)=>/^Log in$/i.test(label));
  expect(logins).toHaveLength(1);
  // The pair won because it carries this, and a header has no room for it.
  expect(labelsOf(tree.toJSON())).toContain("Create account");

  await act(async()=>{tree.unmount();});
});

test("the header carries no Log in at all",()=>{
  const header=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","Header.js"),"utf8"
  );
  expect(header).not.toMatch(/accessibilityLabel="Log in"/);
  expect(header).not.toMatch(/auth\/login/);
});
