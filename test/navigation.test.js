/* eslint-env jest */

// Packet 3 acceptance. The criterion that matters is "every existing route
// still reachable, nothing deleted, nothing orphaned" -- a navigation change is
// the easiest way in this codebase to lose a screen silently, and it has
// happened before: a menu loader dropped ten links and five gate scripts stayed
// green throughout.

const fs=require("fs");
const path=require("path");
const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");

const {TABS,FULL_SCREEN_ROUTES,activeTabKey,isTabBarHidden}=require("../utils/navigation");

const appDir=path.resolve(__dirname,"..","app");

function routeNames(dir,prefix=""){
  const found=[];

  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const child=path.join(dir,entry.name);

    if(entry.isDirectory()){
      found.push(...routeNames(child,`${prefix}${entry.name}/`));
      continue;
    }

    if(!entry.name.endsWith(".js")) continue;

    const name=entry.name.replace(/\.web\.js$/,"").replace(/\.js$/,"");
    if(name==="_layout") continue;

    found.push(`${prefix}${name}`);
  }

  return [...new Set(found)];
}

const onDisk=routeNames(appDir);

// A route path as a person would type it, from the file name.
function routePath(name){
  return `/${name.replace(/\/index$/,"")}`;
}

const paths=onDisk.map(routePath);

describe("the tab set points at real screens",()=>{
  it("has five tabs in the order the brief names",()=>{
    expect(TABS.map((tab)=>tab.label)).toEqual([
      "Map","Discover","Create","Leaderboard","Profile"
    ]);
  });

  it("raises exactly one, and it is the centre",()=>{
    const raised=TABS.filter((tab)=>tab.raised);
    expect(raised).toHaveLength(1);
    expect(TABS.indexOf(raised[0])).toBe(2);
  });

  it.each(TABS.map((tab)=>[tab.label,tab.route]))(
    "%s points at a route file that exists",
    (_label,route)=>{
      // A tab pointing at nothing is the worst outcome of this packet: it looks
      // finished and dead-ends on every tap.
      expect(paths).toContain(route);
    }
  );

  it("mounts every tab root without throwing",async()=>{
    for(const tab of TABS){
      const name=onDisk.find((route)=>routePath(route)===tab.route);
      const Screen=require(path.join(appDir,`${name}.js`)).default;

      expect(typeof Screen).toBe("function");

      let tree;
      await act(async()=>{
        tree=create(wrap(React.createElement(Screen)));
      });
      expect(tree.toJSON()).not.toBeUndefined();
      await act(async()=>{tree.unmount();});
    }
  });
});

describe("no route was lost",()=>{
  // The inventory before this packet, recorded by hand from the file tree at
  // commit 46a75d8 -- the tip before the navigation shell. Packet 3 adds two
  // routes and removes none, so this list plus discover and create is the whole
  // of what must be on disk. Anything else means a screen was deleted or
  // orphaned while moving navigation around.
  const BEFORE=[
    "activity-clubs/[id]","activity-clubs/add","activity-clubs/edit/[id]",
    "activity-clubs/index","activity-clubs/message-board/[id]",
    "activity-clubs/review/[id]","admin/claims","admin/dashboard",
    "auth/forgot-password","auth/login","auth/signup","auth/update-password",
    "business/[id]","business/add","business/dashboard","business/edit",
    "business/edit/[id]","business/review-action","business/review/[id]",
    "business/reviews","checkins/create","connections/[id]","events/[id]",
    "events/add","events/edit/[id]","events/index","events/review/[id]",
    "explorers","feed","guest/[id]","index","leaderboards","linkups/[id]",
    "linkups/board/[id]","linkups/create","linkups/edit/[id]","linkups/index",
    "live","manager/dashboard","manager/membership-status/[id]",
    "manager/qr/[type]/[id]","manager/requests","map","menu","moments/[id]",
    "moments/create","notifications","place","profile","profile/[id]",
    "profile/edit","property/[id]","property/add","property/dashboard",
    "property/edit","property/edit/[id]","property/review-action",
    "property/review/[id]","property/reviews","qr/[code]","safety/blocked",
    "saved","scan","settings","social-comments/[id]"
  ];

  // Packet 3 added the two tab roots. Packet 8e added the three screens a
  // canonical public place needs to exist at all: a way in, the place's own
  // page, and the administrator screen that creates one. Named here rather
  // than folded into BEFORE, so a route that appears without being named
  // still fails.
  const ADDED=["create","discover","places/index","places/[id]","admin/public-places",
    "memories/create","memories/[id]"];

  // Packet 4 deleted exactly one route, and the brief told it to: "Delete the
  // old menu page once every link has a new home." Every link did -- that is
  // what test/drawer.test.js asserts, row by row, against the menu as it was.
  // Listing the removal here rather than editing BEFORE keeps the deletion
  // deliberate: a route that vanishes without being named still fails.
  const REMOVED=["menu"];

  it("keeps every route that existed before, except the one deliberately removed",()=>{
    const missing=BEFORE.filter((route)=>!onDisk.includes(route) && !REMOVED.includes(route));
    expect(missing).toEqual([]);
  });

  it("removed the routes it said it removed, and no others",()=>{
    expect(REMOVED.filter((route)=>onDisk.includes(route))).toEqual([]);
  });

  it("adds only the routes the packets are allowed to add",()=>{
    const unexpected=onDisk.filter((route)=>!BEFORE.includes(route) && !ADDED.includes(route));
    expect(unexpected).toEqual([]);
  });

  it("declares every route on disk in the root layout",()=>{
    // Belt and braces with verify-screen-gates.cjs. That script is a grep and
    // this is a test, and the failure they guard against -- a route file that
    // no navigator knows about -- is invisible until someone deep-links to it.
    const layout=fs.readFileSync(path.join(appDir,"_layout.js"),"utf8");
    const declared=[...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m)=>m[1]);

    expect(onDisk.filter((route)=>!declared.includes(route))).toEqual([]);
  });
});

describe("the bar hides only where the brief says",()=>{
  it("hides on the QR scanner",()=>{
    expect(isTabBarHidden("/scan")).toBe(true);
  });

  it("does not hide on the map tab",()=>{
    // /map IS the Map tab. Hiding the bar there would strand a person on the
    // tab they just opened; the brief's "full-screen map" is a mode Packet 6
    // has not built yet.
    expect(isTabBarHidden("/map")).toBe(false);
  });

  it.each(paths.filter((route)=>!FULL_SCREEN_ROUTES.includes(route)).map((route)=>[route]))(
    "shows on %s",
    (route)=>{
      expect(isTabBarHidden(route)).toBe(false);
    }
  );

  it("names only surfaces that exist",()=>{
    for(const route of FULL_SCREEN_ROUTES){
      expect(paths).toContain(route);
    }
  });
});

describe("the active tab follows the screen",()=>{
  it.each(TABS.map((tab)=>[tab.route,tab.key]))("%s lights %s",(route,key)=>{
    expect(activeTabKey(route)).toBe(key);
  });

  it("keeps a tab lit on screens beneath it",()=>{
    // Opening a profile from the Profile tab is still being in Profile. A bar
    // with nothing lit reads as broken.
    expect(activeTabKey("/profile/abc")).toBe("profile");
    expect(activeTabKey("/profile/edit")).toBe("profile");
  });

  it("lights nothing on a screen that is under no tab",()=>{
    expect(activeTabKey("/settings")).toBeNull();
    expect(activeTabKey("/")).toBeNull();
  });

  it("does not confuse a prefix for a parent",()=>{
    // /mapsomething is not under /map.
    expect(activeTabKey("/mapsomething")).toBeNull();
  });
});

describe("the shell did not change how back works",()=>{
  it("still navigates with a Stack, not a tab navigator",()=>{
    // The Android hardware back button follows the navigator. The bar was put
    // beside the Stack rather than replacing it precisely so back behaviour is
    // the behaviour that already shipped -- this asserts the structure that
    // claim rests on.
    const layout=fs.readFileSync(path.join(appDir,"_layout.js"),"utf8");

    expect(layout).toContain("<Stack");
    expect(layout).not.toContain("<Tabs");
    expect(layout).toContain("<TabBar/>");
  });
});

describe("the bar renders",()=>{
  const expoRouter=require("expo-router");
  let originalUsePathname;

  beforeEach(()=>{originalUsePathname=expoRouter.usePathname;});
  afterEach(()=>{expoRouter.usePathname=originalUsePathname;});

  async function renderAt(pathname){
    expoRouter.usePathname=()=>pathname;

    const TabBar=require("../components/TabBar").default;
    let tree;
    await act(async()=>{
      tree=create(wrap(React.createElement(TabBar)));
    });
    return tree;
  }

  function textOf(node,found=[]){
    if(node===null || node===undefined) return found;
    if(typeof node==="string"){found.push(node);return found;}
    if(Array.isArray(node)){for(const child of node) textOf(child,found);return found;}
    if(typeof node==="object") textOf(node.children,found);
    return found;
  }

  function labelsOf(node,found=[]){
    if(!node || typeof node!=="object") return found;
    if(Array.isArray(node)){node.forEach((child)=>labelsOf(child,found));return found;}
    if(node.props?.accessibilityRole==="tab") found.push(node.props.accessibilityLabel);
    labelsOf(node.children,found);
    return found;
  }

  it("offers every tab on an ordinary screen",async()=>{
    const tree=await renderAt("/settings");

    // All five are reachable and named. Compared as a set: the raised button is
    // drawn after the bar rather than inside it, so tree order is not visual
    // order -- that is what stops Android clipping it.
    expect(labelsOf(tree.toJSON()).sort()).toEqual(TABS.map((tab)=>tab.label).sort());

    // Only four carry a visible caption; the raised Create button is the icon
    // alone. Those four appear in the order the brief lists them.
    const captions=TABS.filter((item)=>!item.raised).map((item)=>item.label);
    expect(textOf(tree.toJSON()).filter((value)=>captions.includes(value))).toEqual(captions);

    await act(async()=>{tree.unmount();});
  });

  it("renders nothing at all on the scanner",async()=>{
    const tree=await renderAt("/scan");
    // The test wrapper still renders; what must be empty is the bar itself.
    expect(tree.toJSON().children).toBeNull();
    await act(async()=>{tree.unmount();});
  });

  it("marks the current tab selected for a screen reader",async()=>{
    const tree=await renderAt("/leaderboards");

    const selected=[];
    (function walk(node){
      if(!node || typeof node!=="object") return;
      if(Array.isArray(node)){node.forEach(walk);return;}
      if(node.props?.accessibilityState?.selected) selected.push(node.props.accessibilityLabel);
      walk(node.children);
    })(tree.toJSON());

    // Exactly one, and the right one. Colour is not the carrier.
    expect(selected).toEqual(["Leaderboard"]);

    await act(async()=>{tree.unmount();});
  });
});

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}
