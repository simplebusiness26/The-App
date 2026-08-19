/* eslint-env jest */

// THE MAP'S LADDER, DRIVEN THROUGH THE REAL SCREEN.
//
// docs/spec-ladder.json carries every capability the locked specs name. The map
// surface was missing most of its middle and top: the recenter button, the
// long-press crosshair and its confirm, the pin sheet's quick actions, the
// Layers tray and the three controls in it, and the Map & location group in
// Settings. scripts/verify-spec-ladder.cjs can now say they are THERE; only a
// test can say they WORK.
//
// So each one is exercised the way a person reaches it: open the tray, move the
// dial, and assert that what the renderer is handed actually changed.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {router}=require("expo-router");

// The permission ask goes through utils/permissions.js, which is where every
// "may this person do this" question in the app is answered. Mocking the
// module the phone actually talks to, rather than the app's own gate, is what
// makes this a test of the gate rather than of itself.
jest.mock("expo-location",()=>({
  requestForegroundPermissionsAsync:jest.fn(),
  getCurrentPositionAsync:jest.fn(),
  Accuracy:{Balanced:3}
}));

const Location=require("expo-location");
const {resetMapPreferences}=require("../utils/mapPreferences");

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,element)
  );
}

const BUSINESS={id:"b1",name:"The Lamb and Flag",category:"food_and_drink",
  business_type:"pub",claimed:true,address:"1 Pier Road",latitude:50.8220,longitude:-0.1370};
const NEIGHBOUR={id:"b2",name:"Bean There",category:"food_and_drink",
  business_type:"cafe",claimed:true,address:"3 High Street",latitude:50.8223,longitude:-0.1374};
const THIRD={id:"b3",name:"The Anchor",category:"food_and_drink",
  business_type:"bar",claimed:true,address:"7 Quay",latitude:50.8226,longitude:-0.1378};

const LIVE=[{
  item_id:"l1",item_type:"linkup",title:"Sunset swim",subtitle:"Outdoors",
  area:"Brighton",latitude:50.8226,longitude:-0.1373,
  starts_at:new Date(Date.now()-10*60000).toISOString(),
  ends_at:new Date(Date.now()+60*60000).toISOString(),
  status:"live",deep_link:"/linkups/l1"
}];

function fixture({user={id:"me"},live=LIVE}={}){
  installFixture({
    user,
    tables:{businesses:[BUSINESS,NEIGHBOUR,THIRD],properties:[],activity_clubs:[]},
    rpc:{get_live_discovery:live}
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
  )[0];
}

// The renderer, whichever platform's it is: the one node holding onViewportChange.
function renderer(tree){
  return tree.root.findAll((node)=>typeof node.props?.onViewportChange==="function",{deep:true})[0];
}

async function press(tree,label){
  const node=control(tree,label);
  expect(node).toBeTruthy();
  await act(async()=>{node.props.onPress();});
  await act(async()=>{});
}

async function openLayers(tree){
  await press(tree,"Map layers");
}

async function moveTo(tree,zoom){
  await act(async()=>{
    renderer(tree).props.onViewportChange({north:51.2,south:50.5,east:1.0,west:-1.0,zoom});
  });
  await act(async()=>{});
  return renderer(tree).props;
}

beforeEach(()=>{
  resetMapPreferences();
  Location.requestForegroundPermissionsAsync.mockReset();
  Location.getCurrentPositionAsync.mockReset();
});

afterEach(()=>{restoreRouterParams();});

// ---------------------------------------------------------------------------
// map.recenter
// ---------------------------------------------------------------------------

describe("recentring the map on where you are",()=>{
  it("asks for the location only when the button is pressed, and never on open",async()=>{
    fixture();
    const tree=await renderMap();

    // A permission prompt that appears because a screen opened is the one
    // people refuse for ever.
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
    Location.getCurrentPositionAsync.mockResolvedValue({coords:{latitude:50.83,longitude:-0.14}});

    await press(tree,"Recenter the map on where you are");

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(renderer(tree).props.focus).toMatchObject({latitude:50.83,longitude:-0.14});

    await act(async()=>{tree.unmount();});
  });

  it("moves the camera again when it is pressed a second time from the same spot",async()=>{
    fixture();
    const tree=await renderMap();

    Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
    Location.getCurrentPositionAsync.mockResolvedValue({coords:{latitude:50.83,longitude:-0.14}});

    await press(tree,"Recenter the map on where you are");
    const first=renderer(tree).props.focus.stamp;

    await press(tree,"Recenter the map on where you are");
    const second=renderer(tree).props.focus.stamp;

    // The renderers fly to `focus` when its identity changes. Without a stamp
    // the second press changes nothing and the button looks broken to exactly
    // the person most likely to press it twice.
    expect(second).not.toBe(first);

    await act(async()=>{tree.unmount();});
  });

  it("says what happened when the answer is no, and leaves the map alone",async()=>{
    fixture();
    const tree=await renderMap();

    Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"denied"});

    await press(tree,"Recenter the map on where you are");

    // A refused permission is not an error and not a dead end.
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(textOf(tree.toJSON())).toContain("needs your location");
    expect(renderer(tree).props.focus).toBeNull();

    // And it can be dismissed.
    await press(tree,"Close the location message");
    expect(textOf(tree.toJSON())).not.toContain("needs your location");

    await act(async()=>{tree.unmount();});
  });

  it("asks through the app's one permission point rather than the phone directly",()=>{
    const fs=require("fs");
    const path=require("path");
    const source=fs.readFileSync(path.join(__dirname,"..","components/LivingMapScreen.js"),"utf8")
      .replace(/\/\*[\s\S]*?\*\//g,"")
      .replace(/(^|[^:])\/\/.*$/gm,"$1");

    expect(source).toContain("askForLocation");
    expect(source).not.toContain("requestForegroundPermissionsAsync");
    expect(source).not.toContain("expo-location");
  });
});

// ---------------------------------------------------------------------------
// map.longPress
// ---------------------------------------------------------------------------

describe("the long-press crosshair",()=>{
  it("draws a reticle on the spot that was held, and confirms before it acts",async()=>{
    fixture();
    const tree=await renderMap();

    // Nothing mid-press: no crosshair on a map nobody is holding.
    expect(tree.root.findAll((node)=>node.props?.testID==="drop-reticle",{deep:true})).toHaveLength(0);

    await act(async()=>{
      renderer(tree).props.onDropPin({latitude:50.822531,longitude:-0.137244,x:180,y:400});
    });

    const labels=labelsOf(tree.toJSON()).join(" | ");
    expect(labels).toContain("Drop a Link-up here");
    expect(labels).toContain("Not here");
    // Nothing has happened yet. A long press is easy to do while panning.
    expect(router.push).not.toHaveBeenCalled();

    await act(async()=>{tree.unmount();});
  });

  it("puts the crosshair where the finger was, not in the middle of the map",async()=>{
    fixture();
    const tree=await renderMap();

    await act(async()=>{
      renderer(tree).props.onDropPin({latitude:50.8225,longitude:-0.1372,x:180,y:400});
    });

    // 36 is half the reticle, so the point sits under its centre.
    const marks=tree.root.findAll(
      (node)=>Array.isArray(node.props?.style)
        && node.props.style.some((entry)=>entry && entry.left===180-36 && entry.top===400-36),
      {deep:true}
    );
    expect(marks.length).toBeGreaterThan(0);

    await act(async()=>{tree.unmount();});
  });

  it("both the crosshair and the chip go when it is confirmed",async()=>{
    fixture();
    const tree=await renderMap();

    await act(async()=>{
      renderer(tree).props.onDropPin({latitude:50.822531,longitude:-0.137244,x:10,y:10});
    });
    await press(tree,"Drop a Link-up here");

    expect(router.push).toHaveBeenCalledWith("/linkups/create?lat=50.82&lng=-0.14");
    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Drop a Link-up here");

    await act(async()=>{tree.unmount();});
  });
});

// ---------------------------------------------------------------------------
// map.layersTray, map.heatDial, map.styleSwitch, map.clusterToggle
// ---------------------------------------------------------------------------

describe("the Layers tray",()=>{
  it("is not on the screen until somebody asks for it",async()=>{
    fixture();
    const tree=await renderMap();

    expect(textOf(tree.toJSON())).not.toContain("Map style");

    await openLayers(tree);
    const text=textOf(tree.toJSON());
    expect(text).toContain("Moment heat");
    expect(text).toContain("Map style");
    expect(text).toContain("Group nearby pins");

    // And it closes again.
    await press(tree,"Hide the map layers");
    expect(textOf(tree.toJSON())).not.toContain("Map style");

    await act(async()=>{tree.unmount();});
  });

  it("the heat dial changes MapLibre's real weight and intensity paint",async()=>{
    fixture();
    const tree=await renderMap();
    const {heatmapPaint}=require("../utils/markers");

    await openLayers(tree);

    await press(tree,"NOW");
    const now=renderer(tree).props.heatTimeframe;

    await press(tree,"WEEK");
    const week=renderer(tree).props.heatTimeframe;

    expect(now).toBe("now");
    expect(week).toBe("week");

    // The dial is only worth having if it reaches the paint. At NOW every live
    // Moment weighs the same, so the wash is where people are POSTING; at WEEK
    // each one weighs what it has gathered.
    const atNow=heatmapPaint({timeframe:now});
    const atWeek=heatmapPaint({timeframe:week});

    expect(atNow["heatmap-weight"].at(-1)).toBe(1);
    expect(atWeek["heatmap-weight"].at(-1)).toBeGreaterThan(1);
    expect(atNow["heatmap-intensity"]).toBeGreaterThan(atWeek["heatmap-intensity"]);

    await act(async()=>{tree.unmount();});
  });

  it("the style switch offers three real styles and changes the one being drawn",async()=>{
    fixture();
    const tree=await renderMap();
    const {STYLE_CHOICES,styleFor}=require("../utils/mapProvider");

    expect(STYLE_CHOICES).toHaveLength(3);
    // The instrument is the winning design's own map, so it is the default.
    expect(renderer(tree).props.styleKey).toBe("instrument");

    await openLayers(tree);
    await press(tree,"Quiet map style. A pale, low-contrast map.");

    expect(renderer(tree).props.styleKey).toBe("quiet");
    // Three keys, three different styles -- not three names for one.
    const resolved=STYLE_CHOICES.map((choice)=>styleFor(choice.key));
    expect(new Set(resolved).size).toBe(3);

    await act(async()=>{tree.unmount();});
  });

  it("turning grouping off draws every pin individually at every zoom",async()=>{
    fixture();
    const tree=await renderMap();

    const groupedFar=await moveTo(tree,9);
    expect(groupedFar.clusters.length).toBeGreaterThan(0);
    expect(groupedFar.places.length).toBeLessThan(3);

    await openLayers(tree);
    await press(tree,"Stop grouping nearby pins");

    const loose=await moveTo(tree,9);
    expect(loose.clusters).toHaveLength(0);
    expect(loose.places).toHaveLength(3);

    await act(async()=>{tree.unmount();});
  });

  it("the grouping the renderers draw is MapLibre's own clustering",()=>{
    const fs=require("fs");
    const path=require("path");
    const read=(file)=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")
      .replace(/\/\*[\s\S]*?\*\//g,"")
      .replace(/(^|[^:])\/\/.*$/gm,"$1");

    // cluster:true on the GeoJSON source, on both platforms. Verified against
    // the installed native binding by scripts/verify-native-map-props.cjs.
    expect(read("components/LivingMap.web.js")).toContain("cluster:true");
    expect(read("components/LivingMap.js")).toMatch(/GeoJSONSource[\s\S]{0,400}cluster\b/);

    // And neither of them decides what the circle looks like.
    for(const file of ["components/LivingMap.js","components/LivingMap.web.js"]){
      expect(read(file)).toContain("clusterPaint(");
    }
  });
});

// ---------------------------------------------------------------------------
// map.livePill
// ---------------------------------------------------------------------------

describe("the live-nearby pill",()=>{
  it("counts what is happening and opens Live Nearby",async()=>{
    fixture();
    const tree=await renderMap();

    await press(tree,"1 happening nearby. Open Live Nearby.");
    expect(router.push).toHaveBeenCalledWith("/live");

    await act(async()=>{tree.unmount();});
  });

  it("is not drawn at all when nothing is happening",async()=>{
    fixture({live:[]});
    const tree=await renderMap();

    // A pill reading zero is furniture.
    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Open Live Nearby");

    await act(async()=>{tree.unmount();});
  });
});

// ---------------------------------------------------------------------------
// map.quickActions
// ---------------------------------------------------------------------------

describe("the pin sheet's quick actions",()=>{
  async function openPin(tree){
    const pin=tree.root.findAll(
      (node)=>node.type==="MapLibreMarker" && node.props.id==="business-b1",
      {deep:true}
    )[0];
    await act(async()=>{pin.props.onPress();});
    await act(async()=>{});
  }

  it("appear only once a pin is open",async()=>{
    fixture();
    const tree=await renderMap();

    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Check in at");

    await openPin(tree);
    // Peek is a glance: a name and where it is, nothing to act on yet.
    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("Check in at");

    await press(tree,"View full page");

    const labels=labelsOf(tree.toJSON()).join(" | ");
    expect(labels).toContain("Check in at The Lamb and Flag");
    expect(labels).toContain("Directions to The Lamb and Flag");
    expect(labels).toContain("Leave a review for The Lamb and Flag");

    await act(async()=>{tree.unmount();});
  });

  it("carries the place through to the check-in, rather than opening an empty form",async()=>{
    fixture();
    const tree=await renderMap();

    await openPin(tree);
    await press(tree,"View full page");
    await press(tree,"Check in at The Lamb and Flag");

    const target=router.push.mock.calls.map((call)=>call[0]).find((url)=>String(url).includes("/checkins/create"));
    expect(target).toBeTruthy();
    expect(target).toContain("placeId=b1");
    expect(target).toContain("placeName=The%20Lamb%20and%20Flag");
    expect(target).toContain("lat=50.822");

    await act(async()=>{tree.unmount();});
  });

  it("carries type and id into the Review Composer",async()=>{
    fixture();
    const tree=await renderMap();

    await openPin(tree);
    await press(tree,"View full page");
    await press(tree,"Leave a review for The Lamb and Flag");

    // The Composer's own contextual route: the type is the path and the id is
    // the last segment, which is what components/ReviewComposer.js reads.
    expect(router.push).toHaveBeenCalledWith("/business/review/b1");

    await act(async()=>{tree.unmount();});
  });

  it("asks the one Directions panel for a route rather than drawing a second",async()=>{
    fixture();
    const tree=await renderMap();

    await openPin(tree);
    await press(tree,"View full page");

    const before=tree.root.findAll(
      (node)=>typeof node.props?.startSignal==="number",
      {deep:true}
    )[0].props.startSignal;

    Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"denied"});
    await press(tree,"Directions to The Lamb and Flag");

    const after=tree.root.findAll(
      (node)=>typeof node.props?.startSignal==="number",
      {deep:true}
    )[0].props.startSignal;

    expect(after).toBe(before+1);

    await act(async()=>{tree.unmount();});
  });
});

// ---------------------------------------------------------------------------
// map.settings
// ---------------------------------------------------------------------------

describe("Account & Safety > Map & location",()=>{
  async function renderSettings(){
    installFixture({
      user:{id:"me"},
      tables:{
        profiles:[{id:"me",email:"me@example.com",area:"Brighton",show_area:false,
          leaderboard_opt_in:true,visibility:"nobody"}],
        manager_capabilities:[],
        businesses:[],properties:[],activity_clubs:[],events:[]
      },
      rpc:{}
    });

    const Settings=require("../app/settings").default;
    let tree;
    await act(async()=>{
      tree=create(React.createElement(FeedbackProvider,null,React.createElement(Settings)));
    });
    await act(async()=>{});
    return tree;
  }

  it("holds the default style, the default radius and the OpenStreetMap credit",async()=>{
    const tree=await renderSettings();
    const text=textOf(tree.toJSON());
    const {ATTRIBUTION,ATTRIBUTION_URL}=require("../utils/mapProvider");

    expect(text).toContain("Map & location");
    expect(text).toContain("DEFAULT MAP STYLE");
    expect(text).toContain("DEFAULT LIVE-NEARBY RADIUS");

    // THE ATTRIBUTION MOVED INTO THIS GROUP. It did not shrink and it did not
    // go: it is the licence condition that lets the map itself stay clean.
    expect(text).toContain(ATTRIBUTION);
    expect(text).toContain(ATTRIBUTION_URL);
    expect(labelsOf(tree.toJSON()).join(" "))
      .toContain("Open the OpenStreetMap copyright and licence page");

    await act(async()=>{tree.unmount();});
  });

  it("a style chosen here is the one an already-open map draws",async()=>{
    const settings=await renderSettings();
    const map=await renderMap();

    expect(renderer(map).props.styleKey).toBe("instrument");

    await press(settings,"Standard map style. A full-colour map with more detail.");
    await act(async()=>{});

    // A preference nothing reads is not a preference.
    expect(renderer(map).props.styleKey).toBe("standard");

    await act(async()=>{map.unmount();settings.unmount();});
  });

  it("the default radius is where Live Nearby starts looking",async()=>{
    const {mapPreferences,setMapPreferences}=require("../utils/mapPreferences");
    expect(mapPreferences().radiusKm).toBe(25);

    setMapPreferences({radiusKm:5});
    expect(mapPreferences().radiusKm).toBe(5);

    // Only the values app/live.js's own dial has detents for, so a default can
    // always be shown as chosen. Anything else falls back to the default rather
    // than being stored -- a preference the dial cannot display is a dial with
    // nothing selected.
    setMapPreferences({radiusKm:7});
    expect(mapPreferences().radiusKm).toBe(25);
  });
});
