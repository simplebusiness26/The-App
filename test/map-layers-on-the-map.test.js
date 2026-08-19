/* eslint-env jest */

// The four map jobs, now that there is a map to draw them on.
//
// utils/mapLayers.js had the rules -- fading, the on-map window, heat, where a
// dropped Link-up gets its location -- written and tested three packets before
// anything could draw them. test/map-layers.test.js still covers the
// arithmetic. This covers what reaches the screen.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,labelsOf,textOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {router}=require("expo-router");

const DAY=1000*60*60*24;

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

const BUSINESS={id:"b1",name:"The Lamb and Flag",category:"food_and_drink",
  business_type:"pub",claimed:true,address:"1 Pier Road",latitude:50.822,longitude:-0.137};

function moment(overrides={}){
  return{
    id:"mo1",user_id:"someone",media_url:"https://example.test/a.jpg",
    target_name:"The Pier",latitude:50.8226,longitude:-0.1373,
    created_at:new Date(Date.now()-3600000).toISOString(),
    expires_at:new Date(Date.now()+20*DAY).toISOString(),
    status:"published",
    ...overrides
  };
}

function memory(overrides={}){
  return{
    id:"me1",user_id:"someone",title:"The pier at dusk",
    media_url:"https://example.test/b.jpg",target_name:"The Pier",
    latitude:50.8224,longitude:-0.1371,
    created_at:new Date(Date.now()-2*DAY).toISOString(),
    map_until:new Date(Date.now()+8*DAY).toISOString(),
    status:"published",
    ...overrides
  };
}

function fixture({user={id:"me"},moments=[moment()],memories=[memory()],heat=[]}={}){
  installFixture({
    user,
    tables:{
      businesses:[BUSINESS],
      properties:[],
      activity_clubs:[],
      explorer_moments:moments,
      explorer_memories:memories
    },
    rpc:{get_live_discovery:[],get_moment_heat:heat}
  });
}

async function renderMap(){
  const LivingMapScreen=require("../components/LivingMapScreen").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(LivingMapScreen)));});
  await act(async()=>{});
  return tree;
}

function pins(tree){
  return tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true});
}

function press(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
}

// THE CONTROLS ARE BEHIND AN ICON NOW.
//
// The owner: "put the search behind an icon button and same for the filters,
// have them so they can be hidden after as well." So a test that wants a filter
// has to open the panel first, exactly as a person does.
async function openFilters(tree){
  const button=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Filter the map"
      && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
  await act(async()=>{button.props.onPress();});
  await act(async()=>{});
}

afterEach(()=>{restoreRouterParams();jest.clearAllMocks();});

describe("Moments and Memories are on the map",()=>{
  it("draws one pin each, alongside the places",async()=>{
    fixture();
    const tree=await renderMap();
    const ids=pins(tree).map((node)=>node.props.id);

    expect(ids).toContain("business-b1");
    expect(ids).toContain("moment-mo1");
    expect(ids).toContain("memory-me1");
  });

  it("leaves out a Moment that has expired and a Memory past its map window",async()=>{
    fixture({
      moments:[moment({expires_at:new Date(Date.now()-DAY).toISOString()})],
      memories:[memory({map_until:new Date(Date.now()-DAY).toISOString()})]
    });
    const tree=await renderMap();
    const ids=pins(tree).map((node)=>node.props.id);

    // Gone from the MAP. Not deleted -- both rows are still there, and both
    // still open from the profile and the feed.
    expect(ids).not.toContain("moment-mo1");
    expect(ids).not.toContain("memory-me1");
    expect(ids).toContain("business-b1");
  });

  it("fades a Memory as its window runs out, and never to nothing",async()=>{
    // Three quarters through an eight-day window is where the fade starts.
    fixture({
      memories:[memory({
        created_at:new Date(Date.now()-7.5*DAY).toISOString(),
        map_until:new Date(Date.now()+0.5*DAY).toISOString()
      })]
    });
    const tree=await renderMap();
    const pin=pins(tree).find((node)=>node.props.id==="memory-me1");
    const faded=pin.findAll((node)=>typeof node.props?.style?.opacity==="number",{deep:true})[0];

    expect(faded.props.style.opacity).toBeLessThan(1);
    // A pin at 4% is one nobody can tap, which is worse than one that is gone.
    expect(faded.props.style.opacity).toBeGreaterThanOrEqual(0.35);
  });

  it("can be turned off without touching the places",async()=>{
    fixture();
    const tree=await renderMap();

    await openFilters(tree);
    await act(async()=>{press(tree,"Hide Moments and Memories").props.onPress();});

    const ids=pins(tree).map((node)=>node.props.id);
    expect(ids).not.toContain("moment-mo1");
    expect(ids).not.toContain("memory-me1");
    expect(ids).toContain("business-b1");
  });

  it("opens the post rather than a place card",async()=>{
    fixture();
    const tree=await renderMap();
    const pin=pins(tree).find((node)=>node.props.id==="moment-mo1");

    await act(async()=>{pin.props.onPress();});

    expect(router.push).toHaveBeenCalledWith("/moments/mo1");
  });

  it("asks for nothing at all when nobody is signed in",async()=>{
    fixture({user:null});
    await renderMap();

    // Not filtered afterwards -- never requested. A signed-out visitor gets the
    // places and no people.
    const asked=supabase.from.mock.calls.map((call)=>call[0]);
    expect(asked).not.toContain("explorer_moments");
    expect(asked).not.toContain("explorer_memories");
  });
});

describe("busy areas",()=>{
  // WHAT CHANGED, AND WHY THESE TESTS LOOK DIFFERENT
  //
  // The heat used to be computed in hooks/useLivingMap.js from whatever the
  // VIEWER could see -- Moments, Memories and reviews, friends-only ones
  // included -- and drawn as one flat yellow circle per ~1km grid square, each
  // labelled "A busy area. 3 posts from 3 Explorers." It needed a floor of
  // three posts from two different Explorers, because otherwise a patch that
  // was warm for you alone was a statement about one of your friends.
  //
  // The owner asked for Snapchat's: "if people post a public moment it gets
  // hot". So it is one RPC now -- get_moment_heat(), public Moments only, the
  // post's audience AND the author's profile ceiling both 'everyone' -- drawn
  // as a real density layer.
  //
  // The floor went with it, and that is not a loosening. Public-only removes
  // the leak the floor was patching: every point is already on the map as a
  // Moment pin that any signed-in Explorer can open, and the heatmap is now
  // identical for everybody rather than a different map per person.

  const HOT=[
    {latitude:50.8226,longitude:-0.1373,attention:12},
    {latitude:50.8227,longitude:-0.1374,attention:0},
    {latitude:50.8229,longitude:-0.1371,attention:40}
  ];

  function heatLayer(tree){
    const renderer=tree.root.findAll(
      (node)=>node.props?.heat!==undefined && typeof node.props?.onViewportChange==="function",
      {deep:true}
    )[0];
    return renderer?.props?.heat || null;
  }

  it("is off until it is asked for",async()=>{
    fixture({heat:HOT});
    const tree=await renderMap();

    await openFilters(tree);
    expect(labelsOf(tree.toJSON()).join(" ")).toContain("Show busy areas");
    expect(heatLayer(tree).features).toHaveLength(0);

    await act(async()=>{tree.unmount();});
  });

  it("draws a point for every public Moment, weighted by attention",async()=>{
    fixture({heat:HOT});
    const tree=await renderMap();

    await openFilters(tree);
    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    const layer=heatLayer(tree);
    expect(layer.type).toBe("FeatureCollection");
    expect(layer.features).toHaveLength(3);

    const weights=layer.features.map((feature)=>feature.properties.weight);
    // A Moment counts for existing, and attention adds on a curve -- so the one
    // with 40 is hotter than the one with 12, and not three times hotter.
    expect(weights[1]).toBeLessThan(weights[0]);
    expect(weights[0]).toBeLessThan(weights[2]);
    expect(weights[2]).toBeLessThan(weights[1]*4);

    await act(async()=>{tree.unmount();});
  });

  it("asks the database, and never builds heat out of what this viewer can see",async()=>{
    // THE PRIVACY ONE. If this file ever went back to reading explorer_moments
    // and counting them, friends-only posts would be back in the layer and
    // everybody's heatmap would be a different map again.
    fixture({heat:HOT});
    const tree=await renderMap();

    await openFilters(tree);
    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("get_moment_heat");

    await act(async()=>{tree.unmount();});
  });

  it("never carries who posted, or anything that could find them",async()=>{
    fixture({heat:HOT});
    const tree=await renderMap();

    await openFilters(tree);
    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    // A position and a weight. The function returns no id, no author and no
    // view count, and nothing here may add one.
    for(const feature of heatLayer(tree).features){
      expect(Object.keys(feature.properties)).toEqual(["weight"]);
      expect(feature.geometry.coordinates).toHaveLength(2);
    }

    const drawn=JSON.stringify(tree.toJSON());
    for(const poster of ["one","two","three","someone"]){
      expect(drawn).not.toContain(`"${poster}"`);
    }

    await act(async()=>{tree.unmount();});
  });

  it("a signed-out visitor is never asked for it",async()=>{
    fixture({user:null,heat:HOT});
    await renderMap();

    for(const call of supabase.rpc.mock.calls){
      expect(call[0]).not.toBe("get_moment_heat");
    }
  });
});

describe("dropping a Link-up on the map",()=>{
  it("asks first, and says the spot is rounded",async()=>{
    fixture();
    const tree=await renderMap();

    const renderer=tree.root.findAll(
      (node)=>typeof node.props?.onDropPin==="function",
      {deep:true}
    )[0];
    expect(renderer).toBeTruthy();

    await act(async()=>{renderer.props.onDropPin({latitude:50.822531,longitude:-0.137244});});

    const text=textOf(tree.toJSON());
    expect(text).toContain("Start a Link-up here?");
    // A long press is easy to do by accident while panning.
    expect(labelsOf(tree.toJSON()).join(" ")).toContain("Not here");
    expect(text).toContain("rounded");
  });

  it("carries a rounded point, not the doorstep somebody held",async()=>{
    fixture();
    const tree=await renderMap();

    const renderer=tree.root.findAll(
      (node)=>typeof node.props?.onDropPin==="function",
      {deep:true}
    )[0];

    await act(async()=>{renderer.props.onDropPin({latitude:50.822531,longitude:-0.137244});});
    // The confirm is a chip that says what it does -- "Drop a Link-up here" --
    // under a crosshair on the spot somebody held. The panel above it still
    // asks the question ("Start a Link-up here?"); the control answers it.
    await act(async()=>{press(tree,"Drop a Link-up here").props.onPress();});

    // 2 decimal places: about a street, which is what a meeting point is.
    expect(router.push).toHaveBeenCalledWith("/linkups/create?lat=50.82&lng=-0.14");
  });

  it("goes away if somebody did not mean it",async()=>{
    fixture();
    const tree=await renderMap();

    const renderer=tree.root.findAll(
      (node)=>typeof node.props?.onDropPin==="function",
      {deep:true}
    )[0];

    await act(async()=>{renderer.props.onDropPin({latitude:50.8225,longitude:-0.1372});});
    await act(async()=>{press(tree,"Not here").props.onPress();});

    expect(textOf(tree.toJSON())).not.toContain("Start a Link-up here?");
    expect(router.push).not.toHaveBeenCalled();
  });
});
