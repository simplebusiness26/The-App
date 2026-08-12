/* eslint-env jest */

// Packet 8b: My Map.
//
// Watched failing first against a component with its owner guard removed, one
// mounted for every viewer, one asking for the profile-shelf scope, and one
// that dropped uncoordinated Memories without saying so.
//
// The assertion that matters most is the negative one: a visitor gets no
// element at all. An empty section and an absent section look identical in a
// screenshot and are completely different in a diff six months from now.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {supabase}=require("../services/supabase");
const {installFixture,restoreRouterParams,textOf}=require("./fixture");

const MyMap=require("../components/MyMap").default;
const {markerForMemory,MARKER_STATES}=require("../utils/markers");

const mountedTrees=[];

const OWNER="11111111-1111-1111-1111-111111111111";
const VISITOR="22222222-2222-2222-2222-222222222222";

function memory(overrides={}){
  return{
    id:"m1",
    user_id:OWNER,
    title:"The pier at dusk",
    note:"",
    media_url:null,
    target_type:"business",
    target_id:"b1",
    target_name:"The Old Pier",
    latitude:50.821,
    longitude:-0.137,
    visibility:"private",
    archive_visibility:"private",
    live_until:null,
    is_live:false,
    show_on_profile:false,
    created_at:"2026-08-01T10:00:00Z",
    ...overrides
  };
}

// Rendered bare, with no provider wrapper. MyMap uses no context, and the
// wrapper would put a SafeAreaProvider element in the tree -- which would make
// `toJSON()` non-null for a visitor and quietly destroy the one assertion this
// suite exists for.
async function render(element){
  let tree;
  await act(async()=>{
    tree=create(element);
  });
  mountedTrees.push(tree);
  return tree;
}

afterEach(()=>{
  while(mountedTrees.length){
    const tree=mountedTrees.pop();
    act(()=>{tree.unmount();});
  }
  restoreRouterParams();
  jest.clearAllMocks();
});

describe("My Map is the owner's alone",()=>{
  test("a visitor gets no element, not an empty one",async()=>{
    installFixture({
      user:{id:VISITOR},
      rpc:{get_explorer_memories:[memory()]}
    });

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:VISITOR}));

    // Absent, not empty. The privacy review was explicit that an empty section
    // is a thing a later change can accidentally populate.
    expect(tree.toJSON()).toBeNull();
    expect(textOf(tree.toJSON())).not.toContain("My Map");
  });

  test("a signed-out viewer gets no element",async()=>{
    installFixture({user:null,rpc:{get_explorer_memories:[memory()]}});

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:undefined}));

    expect(tree.toJSON()).toBeNull();
  });

  test("a visitor's map is never even requested",async()=>{
    installFixture({
      user:{id:VISITOR},
      rpc:{get_explorer_memories:[memory()]}
    });

    await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:VISITOR}));

    // Not merely filtered after the fact -- the request is never issued.
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test("the owner sees their own map",async()=>{
    installFixture({
      user:{id:OWNER},
      rpc:{get_explorer_memories:[memory()]}
    });

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));
    const text=textOf(tree.toJSON());

    expect(text).toContain("My Map");
    expect(text).toContain("Only you can see this map.");

    // It is a MAP now, so the Memory is a pin rather than a line of text.
    //
    // It used to be a list wearing a map's name: the old renderer only drew a
    // MapView if EXPO_PUBLIC_GOOGLE_MAPS_API_KEY was set, and it never was, so
    // every owner got MemoryRows. MapLibre needs no key, so there is an actual
    // map here for the first time -- and no Google logo on it, which was the
    // last third-party badge left in the app.
    const pins=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true});
    expect(pins).toHaveLength(1);
    expect(pins[0].props.id).toBe("m1");
    expect(pins[0].props.lngLat.every(Number.isFinite)).toBe(true);
  });

  test("falls back to the list when the map cannot run",async()=>{
    installFixture({
      user:{id:OWNER},
      rpc:{get_explorer_memories:[memory()]}
    });

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));

    // No WebGL, a dead tile host, a style that will not load -- all the same
    // thing to somebody looking at it, and a blank rectangle is the worst
    // possible answer. The Memories come back as rows.
    const renderer=tree.root.findAll(
      (node)=>typeof node.props?.onUnavailable==="function",
      {deep:true}
    )[0];
    expect(renderer).toBeTruthy();

    await act(async()=>{renderer.props.onUnavailable("Failed to fetch");});

    expect(textOf(tree.toJSON())).toContain("The pier at dusk");
  });
});

describe("what it reads",()=>{
  test("it asks for the whole archive, not the profile shelf",async()=>{
    installFixture({user:{id:OWNER},rpc:{get_explorer_memories:[memory()]}});

    await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));

    expect(supabase.rpc).toHaveBeenCalledWith("get_explorer_memories",{
      p_user_id:OWNER,
      p_scope:"all"
    });
  });

  test("it never reads a table directly, and never reads check-ins",async()=>{
    installFixture({user:{id:OWNER},rpc:{get_explorer_memories:[memory()]}});

    await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));

    // A check-in is the one thing this app promises to forget. My Map going
    // anywhere near live_checkins is the defect 8d exists to prevent.
    expect(supabase.from).not.toHaveBeenCalled();
    for(const call of supabase.rpc.mock.calls){
      expect(call[0]).toBe("get_explorer_memories");
    }
  });

  test("a Memory with no location is excluded from the pins and counted out loud",async()=>{
    installFixture({
      user:{id:OWNER},
      rpc:{get_explorer_memories:[
        memory(),
        memory({id:"m2",title:"No location kept",latitude:null,longitude:null})
      ]}
    });

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));
    const text=textOf(tree.toJSON());

    // Silently showing a smaller map than the archive would be a quiet lie.
    expect(text).toContain("1 Memory has no location");
    expect(text).not.toContain("No location kept");
  });

  test("an empty map tells the owner what to do rather than how to feel",async()=>{
    installFixture({user:{id:OWNER},rpc:{get_explorer_memories:[]}});

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));
    const text=textOf(tree.toJSON());

    expect(text).toContain("Keep a Memory of a place you went");
    expect(text).not.toMatch(/Nothing here yet/i);
  });

  test("a failed load says so instead of showing an empty map",async()=>{
    installFixture({user:{id:OWNER}});
    supabase.rpc.mockImplementation(()=>Promise.resolve({data:null,error:{message:"boom"}}));

    const tree=await render(React.createElement(MyMap,{ownerId:OWNER,viewerId:OWNER}));

    expect(textOf(tree.toJSON())).toContain("Your map could not be loaded.");
  });
});

describe("the marker",()=>{
  test("a Memory's phase is not a fourth ink",async()=>{
    const live=markerForMemory(memory({is_live:true,live_until:"2099-01-01T00:00:00Z"}));
    const archived=markerForMemory(memory({is_live:false}));

    // Same colour in both phases. The phase is said in words; if it ever became
    // a colour, the three-ink rule would be carrying a fourth meaning.
    expect(live.fill).toBe(archived.fill);
    expect(live.state).toBe(MARKER_STATES.EXISTS);
  });

  test("it takes no colour or glyph from the caller",()=>{
    const forced=markerForMemory(memory({fill:"#FF3D6E",glyph:"star",state:"offer"}));

    expect(forced.fill).not.toBe("#FF3D6E");
    expect(forced.glyph).not.toBe("star");
    expect(forced.state).toBe(MARKER_STATES.EXISTS);
  });

  test("every Memory gets a marker with a spoken label",()=>{
    for(const type of ["business","property","activity_club","event","public_place",null]){
      const marker=markerForMemory(memory({target_type:type}));
      expect(marker.glyph).toBeTruthy();
      expect(marker.label).toContain("Memory.");
    }
  });
});
