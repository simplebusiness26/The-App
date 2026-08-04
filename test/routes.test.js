/* eslint-env jest */

const fs=require("fs");
const path=require("path");
const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");

const appDir=path.resolve(__dirname,"..","app");

// Discovered from the file tree rather than listed, so a new route cannot be
// added without also being mounted here. A hardcoded list would rot the first
// time someone adds a screen, and rot silently.
function routeFiles(dir,prefix=""){
  const found=[];

  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const child=path.join(dir,entry.name);

    if(entry.isDirectory()){
      found.push(...routeFiles(child,`${prefix}${entry.name}/`));
      continue;
    }

    if(!entry.name.endsWith(".js")) continue;
    if(entry.name==="_layout.js") continue;

    found.push({name:`${prefix}${entry.name}`,file:child});
  }

  return found;
}

const routes=routeFiles(appDir);

// The providers app/_layout.js wraps every screen in. Without FeedbackProvider,
// any screen calling useFeedback throws "must be used inside FeedbackProvider"
// -- which would be a failure of the harness, not of the screen.
function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(
      FeedbackProvider,
      null,
      React.createElement(NotificationProvider,null,element)
    )
  );
}

describe("every route mounts without throwing",()=>{
  it("finds routes to test",()=>{
    // Guards against the suite silently passing because discovery broke and
    // it.each() received an empty array.
    expect(routes.length).toBeGreaterThan(50);
  });

  it.each(routes.map((route)=>[route.name,route.file]))("%s",async(name,file)=>{
    const routeModule=require(file);
    const Screen=routeModule.default;

    expect(typeof Screen).toBe("function");

    let tree;

    // The render and the effects it schedules both run inside act(), so a
    // screen whose loader throws fails here rather than warning after the
    // assertion has already passed.
    await act(async()=>{
      tree=create(wrap(React.createElement(Screen)));
    });

    expect(tree.toJSON()).not.toBeUndefined();

    await act(async()=>{
      tree.unmount();
    });
  });
});
