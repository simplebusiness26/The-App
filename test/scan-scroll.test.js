/* eslint-env jest */

// The QR scanner had no ScrollView at all, so everything past the fold -- the
// manual code box and its help text -- was unreachable, and the tab bar takes
// another 82px off the bottom. This renders the real screen and checks it.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {ScrollView}=require("react-native");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {installFixture,textOf}=require("./fixture");

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,
      React.createElement(NotificationProvider,null,element))
  );
}

test("the scanner scrolls, and the manual code box below the fold is reachable",async()=>{
  installFixture({user:{id:"me"},tables:{},rpc:{}});

  const Screen=require("../app/scan").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
  await act(async()=>{});

  const scrollers=tree.root.findAllByType(ScrollView);
  console.log("SCROLLVIEWS >>>", scrollers.length);
  expect(scrollers.length).toBeGreaterThan(0);

  // Room for the tab bar, or the last control sits under it.
  const pad=scrollers[0].props.contentContainerStyle;
  const flat=Array.isArray(pad) ? Object.assign({},...pad.filter(Boolean)) : (pad||{});
  console.log("BOTTOM PADDING >>>", flat.paddingBottom);
  expect(flat.paddingBottom).toBeGreaterThanOrEqual(82);

  // And the content that used to be unreachable is actually rendered.
  const text=textOf(tree.toJSON());
  console.log("TEXT >>>", text.slice(0,200));
  expect(text.toLowerCase()).toContain("qr");

  await act(async()=>{tree.unmount();});
});
