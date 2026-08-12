/* eslint-env jest */

// Packet 21: one Living Map, three platforms.
//
// The failure this file exists to prevent is the one the whole packet is shaped
// around: web and native drifting into two products. They cannot share a
// renderer -- a browser canvas and a native view are not the same thing -- so
// what has to be shared is everything that is not drawing, and what has to be
// proven is that it IS shared.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");

function read(file){
  return fs.readFileSync(path.join(__dirname,"..",file),"utf8");
}

function code(source){
  return source.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");
}

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

const BUSINESS={id:"b1",name:"The Lamb and Flag",category:"food_and_drink",
  business_type:"pub",claimed:true,address:"1 Pier Road",latitude:50.822,longitude:-0.137};
const NOWHERE={id:"b2",name:"Ghost Cafe",category:"food_and_drink",
  business_type:"cafe",claimed:true,address:"",latitude:null,longitude:null};
const PROPERTY={id:"p1",name:"Harbour Cottage",address:"2 Quay",latitude:50.8225,longitude:-0.1372};
const CLUB={id:"c1",name:"Sea Swimmers",category:"Outdoors",location:"The beach",
  address:"",latitude:50.8221,longitude:-0.1371,status:"open"};

const LIVE=[{
  item_id:"l1",item_type:"linkup",title:"Sunset swim",subtitle:"Outdoors",
  area:"Brighton",latitude:50.8226,longitude:-0.1373,
  // Happening right now, so it survives the default "Now" window.
  starts_at:new Date(Date.now()-10*60000).toISOString(),
  ends_at:new Date(Date.now()+60*60000).toISOString(),
  status:"live",deep_link:"/linkups/l1"
}];

function fixture({user={id:"me"},live=LIVE}={}){
  installFixture({
    user,
    tables:{
      businesses:[BUSINESS,NOWHERE],
      properties:[PROPERTY],
      activity_clubs:[CLUB]
    },
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

afterEach(()=>{restoreRouterParams();});

describe("everything that is not drawing is shared",()=>{
  it("both platform entry points render the same screen",()=>{
    // If either grows an implementation of its own, the platforms have started
    // to drift and one of them will quietly lose a feature.
    expect(code(read("app/map.js"))).toContain("<LivingMapScreen/>");
    expect(code(read("app/map.web.js"))).toContain("<LivingMapScreen/>");
  });

  it("no screen reads the database any more",()=>{
    for(const file of [
      "app/map.js","app/map.web.js",
      "components/LivingMapScreen.js","components/PlacesList.js",
      "components/LivingMap.js","components/LivingMap.web.js"
    ]){
      expect(code(read(file))).not.toContain("supabase");
    }
  });

  it("neither renderer decides what a marker means",()=>{
    // Colour means state and the glyph means type, and utils/markers.js is the
    // only place that is decided. A renderer that built its own descriptor
    // would be a second visual language.
    for(const file of ["components/LivingMap.js","components/LivingMap.web.js"]){
      const source=code(read(file));
      expect(source).not.toMatch(/MARKER_STATES|INK\.(blue|pink|yellow)\b/);
    }
  });

  it("the provider is named in exactly one file",()=>{
    const offenders=[];
    for(const dir of ["app","components","hooks","utils"]){
      const walk=(d)=>{
        for(const entry of fs.readdirSync(path.join(__dirname,"..",d),{withFileTypes:true})){
          const relative=`${d}/${entry.name}`;
          if(entry.isDirectory()){walk(relative);continue;}
          if(!entry.name.endsWith(".js")) continue;
          if(relative==="utils/mapProvider.js") continue;
          if(/openfreemap|openmaptiles/.test(code(read(relative)))) offenders.push(relative);
        }
      };
      walk(dir);
    }
    // Moving off OpenFreeMap has to be a change to one module, not a sweep.
    expect(offenders).toEqual([]);
  });

  it("needs no key, no token and no card on any platform",()=>{
    for(const file of [
      "hooks/useLivingMap.js","components/LivingMapScreen.js",
      "components/LivingMap.js","components/LivingMap.web.js","utils/mapProvider.js"
    ]){
      expect(code(read(file))).not.toMatch(/GOOGLE_MAPS_API_KEY|MAPBOX_TOKEN|accessToken/);
    }
  });
});

describe("what reaches the map",()=>{
  it("carries businesses, properties and clubs",async()=>{
    fixture();
    const tree=await renderMap();

    const markers=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true});
    const ids=markers.map((node)=>node.props.id);

    expect(ids).toContain("business-b1");
    expect(ids).toContain("property-p1");
    // CARD_KINDS.CLUB is "club" -- three tables with their own ids, so the
    // key carries the kind as well as the id.
    expect(ids).toContain("club-c1");

    await act(async()=>{tree.unmount();});
  });

  it("carries live activity, on top of the places",async()=>{
    fixture();
    const tree=await renderMap();

    const markers=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true});
    const ids=markers.map((node)=>node.props.id);

    expect(ids.some((id)=>String(id).includes("linkup"))).toBe(true);
    // Drawn after the static pins, so a live thing sits on top of the place it
    // is happening at rather than under it.
    expect(ids.indexOf(ids.find((id)=>String(id).includes("linkup"))))
      .toBeGreaterThan(ids.indexOf("business-b1"));

    await act(async()=>{tree.unmount();});
  });

  it("never plots a listing that has no location",async()=>{
    fixture();
    const tree=await renderMap();

    const ids=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true})
      .map((node)=>node.props.id);

    // Number(null) is 0 and Number.isFinite(0) is true, so the obvious check
    // puts every locationless listing in the Gulf of Guinea.
    expect(ids).not.toContain("business-b2");

    await act(async()=>{tree.unmount();});
  });

  it("keeps the static places when the live read fails",async()=>{
    installFixture({
      user:{id:"me"},
      tables:{businesses:[BUSINESS],properties:[],activity_clubs:[]},
      rpc:{}
    });
    supabase.rpc.mockImplementation(()=>Promise.resolve({data:null,error:{message:"live is down"}}));

    const tree=await renderMap();
    const ids=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true})
      .map((node)=>node.props.id);

    expect(ids).toContain("business-b1");

    await act(async()=>{tree.unmount();});
  });

  it("gives a signed-out visitor the static map without asking for live data",async()=>{
    fixture({user:null});
    const tree=await renderMap();

    // get_live_discovery is SECURITY DEFINER and raises for a signed-out
    // caller, so it is not asked. The living layer is an addition, never a gate.
    expect(supabase.rpc).not.toHaveBeenCalledWith("get_live_discovery",expect.anything());

    const ids=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true})
      .map((node)=>node.props.id);
    expect(ids).toContain("business-b1");

    await act(async()=>{tree.unmount();});
  });
});

describe("the controls survived the move",()=>{
  it("offers search, the four type filters and the three time windows",async()=>{
    fixture();
    const tree=await renderMap();

    const labels=labelsOf(tree.toJSON()).join(" | ");
    console.log("MAP CONTROLS >>>",labels);

    expect(labels).toContain("Search the map");
    for(const filter of ["All","Businesses","Properties","Activity Clubs"]){
      expect(labels).toContain(`Show ${filter}`);
    }
    expect(labels).toContain("Show what is happening");
    for(const window of ["now","tonight","weekend"]){
      expect(labels).toContain(`Show what is happening ${window}`);
    }

    await act(async()=>{tree.unmount();});
  });

  it("narrows the map when a type filter is chosen",async()=>{
    fixture();
    const tree=await renderMap();

    const onlyProperties=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Show Properties"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    await act(async()=>{onlyProperties.props.onPress();});

    const ids=tree.root.findAll((node)=>node.type==="MapLibreMarker",{deep:true})
      .map((node)=>node.props.id);

    expect(ids).toContain("property-p1");
    expect(ids).not.toContain("business-b1");

    await act(async()=>{tree.unmount();});
  });

  it("keeps the list reachable, as a view of the same model",async()=>{
    fixture();
    const tree=await renderMap();

    const toList=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Show a list instead of the map"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    expect(toList).toBeTruthy();
    await act(async()=>{toList.props.onPress();});

    expect(textOf(tree.toJSON())).toContain("The Lamb and Flag");
    expect(tree.root.findAll((node)=>node.type==="MapLibreMap",{deep:true})).toHaveLength(0);

    await act(async()=>{tree.unmount();});
  });
});

describe("Xplorer renders the Xplorer experience",()=>{
  it("opens its own place card rather than a provider popup",async()=>{
    fixture();
    const tree=await renderMap();

    const pin=tree.root.findAll(
      (node)=>node.type==="MapLibreMarker" && node.props.id==="business-b1",
      {deep:true}
    )[0];

    await act(async()=>{pin.props.onPress();});

    const labels=labelsOf(tree.toJSON()).join(" ");
    expect(labels).toContain("Close place card");
    expect(labels).toContain("Open The Lamb and Flag");

    await act(async()=>{tree.unmount();});
  });
});
