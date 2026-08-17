/* eslint-env jest */

// Packet 6: map bottom cards.
//
// The first acceptance criterion is the awkward one -- "map position unchanged
// after opening, swiping and dismissing" -- because it is a statement about
// something NOT happening. It is asserted here by reading the MapView's own
// props before and after a marker tap: an uncontrolled map keeps its position,
// and a `region` prop appearing is what would take it away.
//
// The second criterion matters more in practice. No Google Maps API key is set,
// so per PROJECT-LOG.md the list fallback is what ships, and every card
// assertion below is also run against it.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");

const {installFixture,textOf,labelsOf}=require("./fixture");
const {CARD_KINDS,toCard,heroImageFor,summaryFor,reviewTargetType}=require("../utils/placeCards");
const {nearestFirst,distanceRank}=require("../utils/geo");

const BUSINESSES=[
  {id:"b1",name:"The Lamb and Flag",category:"food_and_drink",business_type:"pub",claimed:true,address:"12 Market Street",latitude:50.822,longitude:-0.137},
  {id:"b2",name:"Bean There",category:"food_and_drink",business_type:"unclassified",claimed:true,address:"3 High Street",latitude:50.823,longitude:-0.138},
  {id:"b3",name:"Far Tavern",category:"food_and_drink",business_type:"bar",claimed:false,address:"90 Long Road",latitude:51.9,longitude:-0.9}
];
const PROPERTIES=[{id:"p1",name:"Harbour Cottage",address:"4 Harbour Road",latitude:50.8225,longitude:-0.1372}];
const CLUBS=[{id:"c1",name:"Sea Swimmers",category:"Swimming",status:"open",location:"West Beach",address:"West Beach steps",latitude:50.8221,longitude:-0.1371}];

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

function nodes(node,type,found=[]){
  if(!node || typeof node!=="object") return found;
  if(Array.isArray(node)){node.forEach((child)=>nodes(child,type,found));return found;}
  if(node.type===type) found.push(node);
  nodes(node.children,type,found);
  return found;
}

function pressable(tree,label){
  // Searched on the element tree rather than toJSON(): a Pressable renders as a
  // host View whose props no longer carry onPress, so the JSON tree can find
  // the control but never fire it.
  const hits=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  );
  return hits[0] || null;
}

async function render(Screen){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
  await act(async()=>{});
  return tree;
}

function fixture(){
  installFixture({
    user:{id:"visitor-1"},
    tables:{businesses:BUSINESSES,properties:PROPERTIES,activity_clubs:CLUBS,profiles:[],explorer_favourites:[]}
  });
}

describe("the card set",()=>{
  const cards=[
    ...BUSINESSES.map((row)=>toCard(CARD_KINDS.BUSINESS,row)),
    ...PROPERTIES.map((row)=>toCard(CARD_KINDS.PROPERTY,row)),
    ...CLUBS.map((row)=>toCard(CARD_KINDS.CLUB,row))
  ];

  // WHAT REPLACED THE SWIPE SET
  //
  // cardsAround() built "the tapped place, then its eight nearest", and
  // components/PlaceCards.js drew them as a swipeable sheet captioned "1 of 8
  // nearby". Both are gone. The owner: "I don't want that place card to come
  // up" -- it sat in the same corner as Directions and covered the route --
  // and browsing a list of nearby places is Discover's job.
  //
  // What the panel needs instead is below: one place, its picture, its type,
  // its score and a sentence.

  it("finds the hero image wherever that kind of place keeps it",()=>{
    // Three tables built at different times: a business has `image` and a
    // `photos` array, a property has `photos`, a club has `image_url`.
    expect(heroImageFor({kind:CARD_KINDS.BUSINESS,image:"a.jpg",photos:["b.jpg"]})).toBe("a.jpg");
    expect(heroImageFor({kind:CARD_KINDS.BUSINESS,photos:["b.jpg"]})).toBe("b.jpg");
    expect(heroImageFor({kind:CARD_KINDS.PROPERTY,photos:["c.jpg"]})).toBe("c.jpg");
    expect(heroImageFor({kind:CARD_KINDS.CLUB,image_url:"d.jpg"})).toBe("d.jpg");
  });

  it("shows no picture rather than somebody else's",()=>{
    // A manager who has uploaded nothing gets an empty block that says so. A
    // stock photograph of somewhere else would be the map telling a lie.
    expect(heroImageFor({kind:CARD_KINDS.BUSINESS})).toBeNull();
    expect(heroImageFor({kind:CARD_KINDS.PROPERTY,photos:[]})).toBeNull();
    expect(heroImageFor({kind:CARD_KINDS.CLUB})).toBeNull();
    expect(heroImageFor(null)).toBeNull();
  });

  it("cuts a long description at the end of a word",()=>{
    const long="A ".repeat(200);
    const cut=summaryFor({description:long});
    expect(cut.length).toBeLessThan(long.length);
    expect(cut.endsWith("\u2026")).toBe(true);

    // A short one is left alone, with no trailing ellipsis to imply more.
    expect(summaryFor({description:"A small pub by the harbour."})).toBe("A small pub by the harbour.");
    expect(summaryFor({description:null})).toBe("");
    expect(summaryFor(null)).toBe("");
  });

  it("translates the map's word for a club into the reviews' word",()=>{
    // The map says "club", a review says "activity_club". Both are real, and
    // asking for the wrong one returns zero reviews in silence.
    expect(reviewTargetType(CARD_KINDS.CLUB)).toBe("activity_club");
    expect(reviewTargetType(CARD_KINDS.BUSINESS)).toBe("business");
    expect(reviewTargetType(CARD_KINDS.PROPERTY)).toBe("property");
  });

  it("keys by kind as well as id, because three tables have their own ids",()=>{
    const clash=[toCard(CARD_KINDS.BUSINESS,{id:"same"}),toCard(CARD_KINDS.PROPERTY,{id:"same"})];
    expect(clash[0].key).not.toBe(clash[1].key);
  });

  it("shows the same marker the pin shows",()=>{
    // A card and the pin it came from disagreeing about what a place is would
    // be the map contradicting itself.
    const {markerForBusiness}=require("../utils/markers");
    const card=toCard(CARD_KINDS.BUSINESS,BUSINESSES[0]);
    expect(card.marker).toEqual(markerForBusiness(BUSINESSES[0]));
  });

  it("sends each kind to its own page",()=>{
    expect(toCard(CARD_KINDS.BUSINESS,BUSINESSES[0]).route).toBe("/business/b1");
    expect(toCard(CARD_KINDS.PROPERTY,PROPERTIES[0]).route).toBe("/property/p1");
    expect(toCard(CARD_KINDS.CLUB,CLUBS[0]).route).toBe("/activity-clubs/c1");
  });

  it("keeps a place with no coordinates rather than dropping it",()=>{
    // A stay whose position nobody recorded is still a stay. It has no pin, but
    // it still has a card, a page and a name.
    const noCoords=toCard(CARD_KINDS.PROPERTY,{id:"p9",name:"Nowhere",address:"?"});
    expect(noCoords.key).toBe("property-p9");
    expect(noCoords.route).toBe("/property/p9");
  });

  it("survives being handed nothing",()=>{
    expect(toCard("nonsense",{id:"x"})).toBeNull();
    expect(toCard(CARD_KINDS.BUSINESS,null)).toBeNull();
  });
});

describe("the distance helper",()=>{
  it("sorts nearer rows first",()=>{
    const origin={latitude:0,longitude:0};
    const rows=[{id:"far",latitude:10,longitude:10},{id:"near",latitude:1,longitude:1}];
    expect(nearestFirst(origin,rows).map((r)=>r.id)).toEqual(["near","far"]);
  });

  it("keeps the given order when there is no origin",()=>{
    const rows=[{id:"a"},{id:"b"}];
    expect(nearestFirst(null,rows).map((r)=>r.id)).toEqual(["a","b"]);
  });

  it("sorts a row with no coordinates last rather than dropping it",()=>{
    const origin={latitude:0,longitude:0};
    const rows=[{id:"unknown"},{id:"known",latitude:5,longitude:5}];
    expect(nearestFirst(origin,rows).map((r)=>r.id)).toEqual(["known","unknown"]);
    expect(distanceRank(origin,{id:"unknown"})).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("the map keeps its position",()=>{
  const KEY="EXPO_PUBLIC_GOOGLE_MAPS_API_KEY";
  let original;

  beforeEach(()=>{original=process.env[KEY];process.env[KEY]="test-key";});
  afterEach(()=>{
    if(original===undefined) delete process.env[KEY];
    else process.env[KEY]=original;
  });

  it("renders a map",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);
    // MapLibre now. The name changed; what is being asserted did not.
    expect(nodes(tree.toJSON(),"MapLibreMap")).toHaveLength(1);
    await act(async()=>{tree.unmount();});
  });

  it("does not move when a card is opened",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const before=nodes(tree.toJSON(),"MapLibreCamera")[0].props;
    const markers=nodes(tree.toJSON(),"MapLibreMarker");
    expect(markers.length).toBeGreaterThan(0);

    await act(async()=>{markers[0].props.onPress();});

    const after=nodes(tree.toJSON(),"MapLibreCamera")[0].props;

    // The camera is uncontrolled: given a starting position once and never told
    // where to be again. MapLibre's controlled prop is `center` on the Camera,
    // the way react-native-maps' was `region` on the MapView -- different name,
    // identical trap, and it would drag the map back on every render.
    //
    // The starting position is asserted to EXIST first, and that is not
    // pedantry. This test used to compare `before.defaultSettings` with
    // `after.defaultSettings` -- the v10 prop name -- so it was comparing
    // undefined with undefined and passing on a camera that had never been
    // given a position at all. The map opened on the whole world on a phone
    // while this test was green.
    expect(before.initialViewState).toEqual({
      center:[-0.1372,50.8225],
      zoom:12
    });
    expect(after.initialViewState).toEqual(before.initialViewState);
    expect(after.center).toBeUndefined();
    expect(before.center).toBeUndefined();

    await act(async()=>{tree.unmount();});
  });

  it("opens a draggable sheet on the tapped place, Peek first, with the directions inside its Full content",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const markers=nodes(tree.toJSON(),"MapLibreMarker");
    await act(async()=>{markers[0].props.onPress();});

    // Peek: a glance, not the whole panel. The full content -- hero image,
    // score, Directions -- has not rendered yet.
    const peekLabels=labelsOf(tree.toJSON()).join(" ");
    expect(textOf(tree.toJSON())).toContain("The Lamb and Flag");
    expect(peekLabels).not.toContain("Get directions");

    // The non-gesture fallback: no onOpenFullPage is supplied, so this snaps
    // the sheet to Full rather than leaving the map.
    const viewFull=pressable(tree,"View full page");
    expect(viewFull).not.toBeNull();
    await act(async()=>{viewFull.props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" ");

    // Named, not "place card". One panel's worth of content, for the place
    // that was tapped, now filling the sheet's Full level.
    expect(labels).toContain("Close The Lamb and Flag");
    expect(labels).toContain("Open The Lamb and Flag");

    // THE WHOLE POINT OF THE CHANGE. Directions used to be a separate card at
    // the same bottom corner as the swipe sheet, so asking for a route put a
    // place card over the answer. They are in the sheet's own content now,
    // and a panel cannot cover itself.
    expect(labels).toContain("Get directions");

    // And the swipe set has gone with it: no "1 of 8 nearby".
    expect(textOf(tree.toJSON())).not.toContain("nearby");

    // Dismissing leaves the map exactly where it was.
    const regionWhileOpen=nodes(tree.toJSON(),"MapLibreCamera")[0].props.initialViewState;
    expect(regionWhileOpen).toBeTruthy();
    const close=pressable(tree,"Close The Lamb and Flag");
    expect(close).not.toBeNull();

    await act(async()=>{close.props.onPress();});

    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Close The Lamb and Flag");
    expect(nodes(tree.toJSON(),"MapLibreCamera")[0].props.initialViewState).toEqual(regionWhileOpen);

    await act(async()=>{tree.unmount();});
  });
});

describe("the map no longer needs a Google key, and the list is still there",()=>{
  const KEY="EXPO_PUBLIC_GOOGLE_MAPS_API_KEY";
  let original;

  beforeEach(()=>{original=process.env[KEY];delete process.env[KEY];});
  afterEach(()=>{if(original!==undefined) process.env[KEY]=original;});

  it("draws a map with no key set at all",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    // This test used to assert the opposite: no key meant no map, and the list
    // WAS the map. That was true for the whole life of the app and it is the
    // thing Packet 21 exists to end. MapLibre and OpenFreeMap need no key, no
    // account and no card.
    expect(nodes(tree.toJSON(),"MapLibreMap").length).toBeGreaterThan(0);

    await act(async()=>{tree.unmount();});
  });

  // THE LIST BUTTON HAS GONE FROM THE MAP'S FILTER ROW.
  //
  // The owner: the List option "should be the Discover page's job". So these
  // render components/PlacesList.js directly. It is still the surface that
  // shows when the map cannot load, and still the better one for a screen
  // reader -- what changed is that it is no longer a filter competing with the
  // page built for browsing.
  it("no longer offers a list button on the map",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const toList=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Show a list instead of the map",
      {deep:true}
    );

    expect(toList).toHaveLength(0);
    await act(async()=>{tree.unmount();});
  });

  it("still shows the same places in a list, from the same model",async()=>{
    fixture();
    const tree=await render(require("../components/PlacesList").default);

    expect(textOf(tree.toJSON())).toContain("The Lamb and Flag");
    expect(nodes(tree.toJSON(),"MapLibreMap")).toHaveLength(0);

    await act(async()=>{tree.unmount();});
  });

  it("opens the same panel from a list row",async()=>{
    fixture();
    const tree=await render(require("../components/PlacesList").default);

    const row=pressable(tree,"The Lamb and Flag");
    expect(row).not.toBeNull();
    await act(async()=>{row.props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" ");
    expect(labels).toContain("Close The Lamb and Flag");
    // The panel offers the full page rather than replacing it.
    expect(labels).toContain("Open The Lamb and Flag");

    await act(async()=>{tree.unmount();});
  });
});
