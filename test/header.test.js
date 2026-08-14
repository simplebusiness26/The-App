/* eslint-env jest */

// The header.
//
// The owner: "the header is the ugliest part of the app... I dislike how it
// drops the whole page down, very old school. There shouldn't be a back button
// on the news feed, messages, map, leaderboard or profile -- only on child
// pages. Keep the hamburger everywhere. Let's get smart."
//
// It was a 60px card-coloured bar with a 2px border, INSIDE the navigator, on
// every screen -- so every screen started below it, including the map, where it
// pushed the search box off the map and left a strip of nothing above it. And
// it carried a back arrow on all 77 screens, including the five you cannot go
// back from.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {NotificationProvider}=require("../context/NotificationContext");
const {DrawerProvider}=require("../context/DrawerContext");
const {installFixture,restoreRouterParams}=require("./fixture");
const {isRootScreen,headerFloatsOver,TABS}=require("../utils/navigation");

const expoRouter=require("expo-router");
const Header=require("../components/Header").default;

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(NotificationProvider,null,
      React.createElement(DrawerProvider,null,element))
  );
}

async function renderAt(pathname){
  expoRouter.usePathname.mockReturnValue(pathname);

  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Header)));});
  await act(async()=>{});
  return tree;
}

// Comments stripped before asserting on source. Both of the checks below name
// the thing they are refusing, so a file that explains WHY it does not do
// something would fail a check that reads its own reasoning.
function code(source){
  return source.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");
}

function labels(tree){
  const found=[];
  (function walk(node){
    if(!node || typeof node!=="object") return;
    if(Array.isArray(node)){node.forEach(walk);return;}
    if(node.props?.accessibilityLabel) found.push(node.props.accessibilityLabel);
    walk(node.children);
  })(tree.toJSON());
  return found;
}

beforeEach(()=>{installFixture({user:{id:"me"}});});
afterEach(()=>{
  restoreRouterParams();
  // Put it back, or the next file inherits whatever screen this one was on.
  expoRouter.usePathname.mockReturnValue("/");
});

// ---------------------------------------------------------------------------
// The rule, as data
// ---------------------------------------------------------------------------

test("the five tabs and the splash are places you live, not places you leave",()=>{
  for(const tab of TABS) expect(isRootScreen(tab.route)).toBe(true);
  expect(isRootScreen("/")).toBe(true);

  // A trailing slash is the same screen.
  expect(isRootScreen("/feed/")).toBe(true);
});

test("a child page is somewhere you can leave",()=>{
  for(const path of ["/business/b1","/settings","/notifications","/memories/m1","/profile/other"]){
    expect(isRootScreen(path)).toBe(false);
  }
});

test("only the full-bleed screens are floated over",()=>{
  expect(headerFloatsOver("/map")).toBe(true);
  expect(headerFloatsOver("/camera")).toBe(true);
  // A page gets its space reserved, so nothing on it can be covered.
  expect(headerFloatsOver("/feed")).toBe(false);
  expect(headerFloatsOver("/business/b1")).toBe(false);
});

// ---------------------------------------------------------------------------
// What is actually drawn
// ---------------------------------------------------------------------------

test("no back arrow on a tab root",async()=>{
  for(const tab of TABS){
    const tree=await renderAt(tab.route);
    expect(labels(tree)).not.toContain("Go back");
    await act(async()=>{tree.unmount();});
  }
});

test("a back arrow on a child page",async()=>{
  const tree=await renderAt("/business/b1");
  expect(labels(tree)).toContain("Go back");
  await act(async()=>{tree.unmount();});
});

test("the hamburger is on every screen, root or not",async()=>{
  // The owner asked for this in as many words.
  for(const pathname of ["/map","/feed","/business/b1","/settings","/"]){
    const tree=await renderAt(pathname);
    expect(labels(tree)).toContain("Open quick access");
    expect(labels(tree)).toContain("Open notifications");
    await act(async()=>{tree.unmount();});
  }
});

test("pressing back on a root does nothing rather than guessing",async()=>{
  // There is no control to press, and the handler refuses anyway -- belt and
  // braces, because an arrow that appears for one render and navigates is worse
  // than one that never appears.
  const tree=await renderAt("/feed");
  expoRouter.router.back.mockClear();
  expoRouter.router.replace.mockClear();

  expect(labels(tree)).not.toContain("Go back");
  expect(expoRouter.router.back).not.toHaveBeenCalled();
  expect(expoRouter.router.replace).not.toHaveBeenCalled();

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// It is not a bar any more
// ---------------------------------------------------------------------------

test("the header has no bar: no fill, no border across the screen",()=>{
  const source=code(fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"components","Header.js"),"utf8"
  ));
  const container=source.split("container:{")[1].split("},")[0];

  // THE COMPLAINT, ASSERTED. A card-coloured strip with a 2px rule under it,
  // across the top of every screen including the map.
  expect(container).not.toMatch(/backgroundColor/);
  expect(container).not.toMatch(/borderBottomWidth|borderWidth/);

  // Each control carries its own ground instead, so it stays readable over a
  // map tile or a photograph.
  expect(source).toMatch(/chip:\{[\s\S]*?backgroundColor:INK\.card/);
});

test("the header is not inside the navigator any more",()=>{
  const layout=code(fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"app","_layout.js"),"utf8"
  ));

  // `header:()=> <Header/>` on the Stack reserves its height on EVERY screen.
  // That is the "drops the whole page down".
  expect(layout).not.toMatch(/header:\(\)=>/);
  expect(layout).toMatch(/screenOptions=\{\{headerShown:false\}\}/);

  // One absolutely positioned layer, and space reserved only where it does not
  // float.
  expect(layout).toMatch(/headerFloatsOver\(/);
  expect(layout).toMatch(/paddingTop:clearHeader/);
});

test("the map and the camera keep their own controls clear of it",()=>{
  const root=path.resolve(__dirname,"..");

  for(const file of ["components/LivingMapScreen.js","app/camera.js"]){
    const source=code(fs.readFileSync(path.join(root,file),"utf8"));
    // Both float, so nothing reserves space for them -- they have to clear the
    // chips themselves or the header sits on top of a search box.
    expect(source).toMatch(/useHeaderClearance\(\)/);
  }
});

// A screen has no business crashing over a missing provider.
test("the clearance survives with no SafeAreaProvider above it",async()=>{
  const {useHeaderClearance,HEADER_HEIGHT}=require("../components/Header");

  function Probe({onValue}){
    onValue(useHeaderClearance());
    return null;
  }

  let measured=null;
  let tree;
  await act(async()=>{
    tree=create(React.createElement(Probe,{onValue:(value)=>{measured=value;}}));
  });

  expect(measured).toBe(HEADER_HEIGHT);
  await act(async()=>{tree.unmount();});
});
