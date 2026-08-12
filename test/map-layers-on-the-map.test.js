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

function fixture({user={id:"me"},moments=[moment()],memories=[memory()]}={}){
  installFixture({
    user,
    tables:{
      businesses:[BUSINESS],
      properties:[],
      activity_clubs:[],
      explorer_moments:moments,
      explorer_memories:memories
    },
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

function pins(tree){
  return tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true});
}

function press(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
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
  // Three posts from three different Explorers in one cell: the floor
  // utils/mapLayers.js sets before a cell is drawn at all.
  const crowd=[
    moment({id:"a",user_id:"one"}),
    moment({id:"b",user_id:"two"}),
    moment({id:"c",user_id:"three"})
  ];

  it("is off until it is asked for",async()=>{
    fixture({moments:crowd,memories:[]});
    const tree=await renderMap();

    expect(labelsOf(tree.toJSON()).join(" ")).toContain("Show busy areas");
    expect(pins(tree).map((n)=>n.props.id).some((id)=>String(id).startsWith("50."))).toBe(false);
  });

  it("draws a cell several Explorers built, and says how many in words",async()=>{
    fixture({moments:crowd,memories:[]});
    const tree=await renderMap();

    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" | ");
    expect(labels).toContain("A busy area. 3 posts from 3 Explorers.");
  });

  it("will not draw a cell one person built",async()=>{
    // A count that only moves when one person posts is that person's movements
    // with a number written on them.
    fixture({
      moments:[
        moment({id:"a",user_id:"one"}),
        moment({id:"b",user_id:"one"}),
        moment({id:"c",user_id:"one"})
      ],
      memories:[]
    });
    const tree=await renderMap();

    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("A busy area");
  });

  it("never carries who posted",async()=>{
    fixture({moments:crowd,memories:[]});
    const tree=await renderMap();

    await act(async()=>{press(tree,"Show busy areas").props.onPress();});

    const drawn=JSON.stringify(tree.toJSON());
    for(const poster of ["one","two","three"]){
      expect(drawn).not.toContain(`"${poster}"`);
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
    await act(async()=>{press(tree,"Start a Link-up here").props.onPress();});

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
