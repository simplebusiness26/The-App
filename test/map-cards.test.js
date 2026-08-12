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
const {CARD_KINDS,cardsAround,toCard,indexOfCard}=require("../utils/placeCards");
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

  it("puts the tapped place first, whatever is nearest",()=>{
    // Swiping back must return you to what you tapped, not to whichever place
    // happens to be closest to it. Asserted on a far-away place so that
    // "sorted by distance from itself" cannot pass by accident -- the tapped
    // card is always zero distance from itself, which made an earlier attempt
    // to break this check quietly succeed.
    const tapped=cards.find((card)=>card.key==="business-b3");
    const around=cardsAround(tapped,cards);

    expect(around.map((card)=>card.key)).toContain("business-b3");
    expect(around[0].key).toBe("business-b3");
  });

  it("orders the rest by distance from it",()=>{
    const tapped=cards.find((card)=>card.key==="business-b1");
    const around=cardsAround(tapped,cards).map((card)=>card.key);

    // b3 is a long way off, so it comes last of the four neighbours.
    expect(around[0]).toBe("business-b1");
    expect(around[around.length-1]).toBe("business-b3");
  });

  it("never repeats the tapped place inside its own neighbours",()=>{
    const tapped=cards.find((card)=>card.key==="property-p1");
    const keys=cardsAround(tapped,cards).map((card)=>card.key);
    expect(new Set(keys).size).toBe(keys.length);
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
    // A stay whose position nobody recorded is still a stay.
    const noCoords=toCard(CARD_KINDS.PROPERTY,{id:"p9",name:"Nowhere",address:"?"});
    const tapped=cards[0];
    expect(cardsAround(tapped,[...cards,noCoords]).map((c)=>c.key)).toContain("property-p9");
  });

  it("survives being handed nothing",()=>{
    expect(cardsAround(null,cards)).toEqual([]);
    expect(toCard("nonsense",{id:"x"})).toBeNull();
    expect(indexOfCard(cards,"missing")).toBe(0);
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

  it("opens a card on the tapped place, and closes it again",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const markers=nodes(tree.toJSON(),"MapLibreMarker");
    await act(async()=>{markers[0].props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" ");
    expect(labels).toContain("Close place card");
    expect(textOf(tree.toJSON())).toContain("nearby");

    // Dismissing leaves the map exactly where it was.
    const regionWhileOpen=nodes(tree.toJSON(),"MapLibreCamera")[0].props.initialViewState;
    expect(regionWhileOpen).toBeTruthy();
    const close=pressable(tree,"Close place card");
    expect(close).not.toBeNull();

    await act(async()=>{close.props.onPress();});

    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Close place card");
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

  it("still offers the list, as a view rather than a fallback",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const toList=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Show a list instead of the map"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    expect(toList).toBeTruthy();
    await act(async()=>{toList.props.onPress();});

    // The same places, in a list, from the same Living Map model.
    expect(textOf(tree.toJSON())).toContain("The Lamb and Flag");
    expect(nodes(tree.toJSON(),"MapLibreMap")).toHaveLength(0);

    await act(async()=>{tree.unmount();});
  });

  it("opens the same card from a list row",async()=>{
    fixture();
    const tree=await render(require("../app/map").default);

    const toList=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Show a list instead of the map"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{toList.props.onPress();});

    const row=pressable(tree,"The Lamb and Flag");
    expect(row).not.toBeNull();
    await act(async()=>{row.props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" ");
    expect(labels).toContain("Close place card");
    // The card offers the full page rather than replacing it.
    expect(labels).toContain("Open The Lamb and Flag");

    await act(async()=>{tree.unmount();});
  });
});
