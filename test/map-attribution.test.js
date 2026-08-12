/* eslint-env jest */

// Where the OpenStreetMap credit went, and the deal that lets the map be clean.
//
// The map draws no attribution any more. That is only allowed because the
// credit is somewhere else -- shown full size for five seconds on every launch,
// and permanently in Settings with a link to the licence. The two halves are
// one decision, and this file is what stops half of it being deleted later by
// somebody who does not know it was load-bearing.
//
// If a future change removes the splash or the Settings section, these tests
// fail and the message says to put the credit back on the map.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {
  ATTRIBUTION,
  ATTRIBUTION_SHORT,
  ATTRIBUTION_COPYRIGHT,
  ATTRIBUTION_URL
}=require("../utils/mapProvider");

function read(file){
  return fs.readFileSync(path.join(__dirname,"..",file),"utf8");
}

function code(source){
  return source.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");
}

afterEach(()=>{restoreRouterParams();jest.useRealTimers();});

describe("the map carries no branding",()=>{
  it("turns both MapLibre controls off, on both platforms",()=>{
    const native=code(read("components/LivingMap.js"));
    const web=code(read("components/LivingMap.web.js"));

    // Off at the component. Not drawn and then covered.
    expect(native).toMatch(/attribution=\{false\}/);
    expect(native).toMatch(/logo=\{false\}/);
    expect(web).toMatch(/attributionControl:false/);
  });

  it("does not hide the controls behind something instead of disabling them",()=>{
    // A cover, a clip or a negative offset would still be MapLibre drawing its
    // branding -- and would break the moment the library moved it.
    for(const file of ["components/LivingMap.js","components/LivingMap.web.js","components/LivingMapScreen.js"]){
      const source=code(read(file));
      expect(source).not.toMatch(/maplibregl-ctrl-attrib|mapboxgl-ctrl|display\s*:\s*none|visibility\s*:\s*hidden/);
    }
  });

  it("never writes a provider name into a screen",()=>{
    // utils/mapProvider.js is still the only file allowed to name one.
    for(const file of ["components/LivingMapScreen.js","components/StartupSplash.js","app/index.js"]){
      expect(code(read(file))).not.toMatch(/openfreemap|maplibre/i);
    }
  });
});

describe("the credit is still in the app",()=>{
  it("shows it on startup, in words a person can read",async()=>{
    const StartupSplash=require("../components/StartupSplash").default;

    let tree;
    await act(async()=>{tree=create(React.createElement(StartupSplash));});

    expect(textOf(tree.toJSON())).toContain(ATTRIBUTION_SHORT);
    expect(ATTRIBUTION_SHORT).toBe("Map data from OpenStreetMap");

    await act(async()=>{tree.unmount();});
  });

  it("keeps it up for a full five seconds and cannot be tapped past",async()=>{
    jest.useFakeTimers();
    const {SPLASH_MS}=require("../components/StartupSplash");
    const StartupSplash=require("../components/StartupSplash").default;

    expect(SPLASH_MS).toBeGreaterThanOrEqual(5000);

    let tree;
    await act(async()=>{tree=create(React.createElement(StartupSplash));});

    // Still there one tick before the five seconds are up.
    await act(async()=>{jest.advanceTimersByTime(SPLASH_MS-1);});
    expect(textOf(tree.toJSON())).toContain(ATTRIBUTION_SHORT);

    // Nothing on the screen dismisses it early.
    expect(tree.root.findAll(
      (node)=>typeof node.props?.onPress==="function",
      {deep:true}
    )).toHaveLength(0);

    await act(async()=>{jest.advanceTimersByTime(1);});
    expect(tree.toJSON()).toBeNull();

    await act(async()=>{tree.unmount();});
  });

  it("is mounted by the shell, so it covers every way the app can start",()=>{
    const layout=code(read("app/_layout.js"));
    expect(layout).toMatch(/<StartupSplash\s*\/>/);
    expect(layout).toMatch(/import StartupSplash from/);
  });

  it("states it permanently in Settings, with the licence link",async()=>{
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

    const text=textOf(tree.toJSON());
    console.log("SETTINGS LICENCE >>>",text.slice(text.indexOf("About and licences"),text.indexOf("About and licences")+200));

    expect(text).toContain("About and licences");
    expect(text).toContain(ATTRIBUTION);
    expect(text).toContain(ATTRIBUTION_COPYRIGHT);
    expect(text).toContain(ATTRIBUTION_URL);
    expect(labelsOf(tree.toJSON()).join(" "))
      .toContain("Open the OpenStreetMap copyright and licence page");

    await act(async()=>{tree.unmount();});
  });

  it("names OpenStreetMap in every one of those places",()=>{
    // The licence is about the DATA source. "OpenFreeMap" alone would not do.
    expect(ATTRIBUTION).toContain("OpenStreetMap");
    expect(ATTRIBUTION_SHORT).toContain("OpenStreetMap");
    expect(ATTRIBUTION_COPYRIGHT).toContain("OpenStreetMap");
    expect(ATTRIBUTION_URL).toContain("openstreetmap.org");
  });
});

describe("the app opens on the map",()=>{
  it("renders the same map screen the /map route does, not a copy",()=>{
    // A second implementation of the map would drift from the first the week
    // after it was written.
    expect(code(read("app/index.js"))).toContain("<LivingMapScreen/>");
    expect(code(read("app/map.js"))).toContain("<LivingMapScreen/>");
    expect(code(read("app/map.web.js"))).toContain("<LivingMapScreen/>");
  });

  it("offers a way in that does not depend on the header",async()=>{
    // The header's future is undecided and the app now OPENS here, so a signed
    // out visitor must be able to get an account from the map itself.
    installFixture({
      user:null,
      tables:{businesses:[],properties:[],activity_clubs:[]},
      rpc:{}
    });

    const LivingMapScreen=require("../components/LivingMapScreen").default;
    let tree;
    await act(async()=>{
      tree=create(React.createElement(FeedbackProvider,null,React.createElement(LivingMapScreen)));
    });
    await act(async()=>{});

    const labels=labelsOf(tree.toJSON()).join(" | ");
    expect(labels).toContain("Log in");
    expect(labels).toContain("Create account");

    await act(async()=>{tree.unmount();});
  });

  it("hides it once somebody is signed in",async()=>{
    installFixture({
      user:{id:"me"},
      tables:{businesses:[],properties:[],activity_clubs:[]},
      rpc:{get_live_discovery:[]}
    });

    const LivingMapScreen=require("../components/LivingMapScreen").default;
    let tree;
    await act(async()=>{
      tree=create(React.createElement(FeedbackProvider,null,React.createElement(LivingMapScreen)));
    });
    await act(async()=>{});

    // Not "Log in" as a substring of something else -- the button itself.
    expect(labelsOf(tree.toJSON())).not.toContain("Log in");

    await act(async()=>{tree.unmount();});
  });
});
