/* eslint-env jest */

const fs=require("fs");
const path=require("path");
const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {
  TABS,FULL_SCREEN_ROUTES,activeTabKey,isTabBarHidden,
  centreButton,centreSwipeUp
}=require("../utils/navigation");

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
function routePath(name){return `/${name.replace(/\/index$/,"")}`;}
const paths=onDisk.map(routePath);

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

function labelsOf(node,found=[]){
  if(!node || typeof node!=="object") return found;
  if(Array.isArray(node)){node.forEach((child)=>labelsOf(child,found));return found;}
  if(node.props?.accessibilityRole==="tab") found.push(node.props.accessibilityLabel);
  labelsOf(node.children,found);
  return found;
}

function textOf(node,found=[]){
  if(node===null || node===undefined) return found;
  if(typeof node==="string"){found.push(node);return found;}
  if(Array.isArray(node)){for(const child of node) textOf(child,found);return found;}
  if(typeof node==="object") textOf(node.children,found);
  return found;
}

describe("Alex primary navigation preserves product reachability",()=>{
  it("uses the whole-journey IA rather than the frozen five labels",()=>{
    expect(TABS.map((tab)=>tab.label)).toEqual(["Explore","Now","Map","Inbox","You"]);
    expect(TABS.map((tab)=>tab.route)).toEqual(["/discover","/live","/map","/messages","/profile"]);
  });

  it("keeps Map in the centre behavioural slot without requiring the old raised visual",()=>{
    const centre=TABS.filter((tab)=>tab.raised);
    expect(centre).toHaveLength(1);
    expect(TABS.indexOf(centre[0])).toBe(2);
    expect(centre[0].key).toBe("map");
  });

  it.each(TABS.map((tab)=>[tab.label,tab.route]))("%s points at a real route",(_label,route)=>{
    expect(paths).toContain(route);
  });

  it("keeps the unified Camera as the centre action while on Map",()=>{
    expect(centreButton("/settings").route).toBe("/map");
    expect(centreButton("/map").route).toBe("/camera");
    expect(centreButton("/map").label).toBe("Camera");
  });

  it("makes Explore visible while preserving the existing upward Map shortcut",()=>{
    expect(TABS[0].route).toBe("/discover");
    expect(centreSwipeUp("/map")?.route).toBe("/discover");
    expect(centreSwipeUp("/feed")).toBeNull();
  });
});

describe("the complete Xplorer route tree is still mounted",()=>{
  it("keeps exactly the frozen 76 declared Stack routes",()=>{
    const layout=fs.readFileSync(path.join(appDir,"_layout.js"),"utf8");
    const declared=[...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m)=>m[1]);
    expect(new Set(declared).size).toBe(76);
  });

  it("declares every route file on disk in the root Stack",()=>{
    const layout=fs.readFileSync(path.join(appDir,"_layout.js"),"utf8");
    const declared=[...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m)=>m[1]);
    expect(onDisk.filter((route)=>!declared.includes(route))).toEqual([]);
  });

  it("still uses a Stack so Android hardware back behaviour is preserved",()=>{
    const layout=fs.readFileSync(path.join(appDir,"_layout.js"),"utf8");
    expect(layout).toContain("<Stack");
    expect(layout).not.toContain("<Tabs");
    expect(layout).toContain("<TabBar/>");
  });

  it("hides no current route from the shared dock",()=>{
    expect(FULL_SCREEN_ROUTES).toEqual([]);
    expect(isTabBarHidden("/map")).toBe(false);
    expect(isTabBarHidden("/scan")).toBe(false);
  });
});

describe("active context follows the product journey",()=>{
  it.each(TABS.map((tab)=>[tab.route,tab.key]))("%s lights %s",(route,key)=>{
    expect(activeTabKey(route)).toBe(key);
  });

  it("groups deeper evaluation routes under Explore",()=>{
    expect(activeTabKey("/events/abc")).toBe("explore");
    expect(activeTabKey("/activity-clubs/abc")).toBe("explore");
    expect(activeTabKey("/places/abc")).toBe("explore");
    expect(activeTabKey("/business/abc")).toBe("explore");
  });

  it("groups live participation under Now",()=>{
    expect(activeTabKey("/linkups/abc")).toBe("now");
    expect(activeTabKey("/checkins/create")).toBe("now");
  });

  it("groups continuity under Inbox and identity under You",()=>{
    expect(activeTabKey("/messages/abc")).toBe("inbox");
    expect(activeTabKey("/linkups/board/abc")).toBe("inbox");
    expect(activeTabKey("/profile/abc")).toBe("you");
    expect(activeTabKey("/memories/abc")).toBe("you");
  });

  it("does not pretend utility screens are a primary journey phase",()=>{
    expect(activeTabKey("/settings")).toBeNull();
    expect(activeTabKey("/")).toBeNull();
    expect(activeTabKey("/mapsomething")).toBeNull();
  });
});

describe("the Alex dock renders accessibly",()=>{
  const expoRouter=require("expo-router");
  let originalUsePathname;

  beforeEach(()=>{originalUsePathname=expoRouter.usePathname;});
  afterEach(()=>{expoRouter.usePathname=originalUsePathname;});

  async function renderAt(pathname){
    expoRouter.usePathname=()=>pathname;
    const TabBar=require("../components/TabBar").default;
    let tree;
    await act(async()=>{tree=create(wrap(React.createElement(TabBar)));});
    return tree;
  }

  it("offers all five destinations on an ordinary screen",async()=>{
    const tree=await renderAt("/settings");
    const names=labelsOf(tree.toJSON()).map((label)=>label.replace(/\. Log in to open this\.$/,""));
    expect(names).toEqual(["Explore","Now","Map","Inbox","You"]);
    expect(textOf(tree.toJSON()).filter((value)=>TABS.map((tab)=>tab.label).includes(value))).toEqual(["Explore","Now","Map","Inbox","You"]);
    await act(async()=>{tree.unmount();});
  });

  it("keeps the dock on the scanner so there is a way out",async()=>{
    const tree=await renderAt("/scan");
    expect(tree.toJSON().children).not.toBeNull();
    await act(async()=>{tree.unmount();});
  });

  it("turns the centre into Camera on Map while keeping Explore visible and swipeable",async()=>{
    const tree=await renderAt("/map");
    const labels=labelsOf(tree.toJSON());
    expect(labels.some((label)=>label.startsWith("Camera"))).toBe(true);
    expect(labels.some((label)=>label.startsWith("Explore"))).toBe(true);
    expect(labels.some((label)=>/Drag up for Discover/.test(label))).toBe(true);
    await act(async()=>{tree.unmount();});
  });

  it("marks the current journey destination selected for a screen reader",async()=>{
    const tree=await renderAt("/discover");
    const selected=[];
    (function walk(node){
      if(!node || typeof node!=="object") return;
      if(Array.isArray(node)){node.forEach(walk);return;}
      if(node.props?.accessibilityState?.selected) selected.push(node.props.accessibilityLabel);
      walk(node.children);
    })(tree.toJSON());
    expect(selected.map((label)=>label.replace(/\. Log in to open this\.$/,""))).toEqual(["Explore"]);
    await act(async()=>{tree.unmount();});
  });
});