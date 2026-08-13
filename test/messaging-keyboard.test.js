/* eslint-env jest */

// The keyboard used to cover the composer, and the thread used to yank you to
// the bottom while you were reading.
//
// The old screen had a KeyboardAvoidingView configured
// `behavior={Platform.OS==="ios" ? "padding" : undefined}` -- which is no
// behaviour at all on Android, where it was relying on the window resizing
// underneath it. Expo now enables edge-to-edge by default and the window does
// not resize, so on Android the keyboard simply sat on top of the input and the
// Send button. There was also no keyboardVerticalOffset despite the app drawing
// its own header, so the iOS half was out by that height too.
//
// It is now a number -- the keyboard's own reported height, applied as padding
// -- which is the reason this file can exist at all. A layout behaviour is very
// hard to assert on; a number is not.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Keyboard}=require("react-native");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {installFixture,restoreRouterParams}=require("./fixture");
const expoRouter=require("expo-router");
const {StyleSheet}=require("react-native");

const KEYBOARD_HEIGHT=336;

function flatten(style){
  return StyleSheet.flatten(style) || {};
}

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,element)
  );
}

async function mount(){
  const Screen=require("../app/messages/[id]").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
  await act(async()=>{});
  return tree;
}

// The screen's outermost box, the one carrying the keyboard padding.
function screenBox(tree){
  return tree.root.findAll(
    (node)=>{
      const style=flatten(node.props?.style);
      return style.flex===1 && style.backgroundColor!==undefined && style.paddingBottom!==undefined;
    },
    {deep:true}
  )[0] || null;
}

function composer(tree){
  return tree.root.findAll(
    (node)=>{
      const style=flatten(node.props?.style);
      return style.flexDirection==="row" && style.borderTopWidth===2 && style.paddingBottom!==undefined;
    },
    {deep:true}
  )[0] || null;
}

function input(tree){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Your message" && typeof node.props?.onChangeText==="function",
    {deep:true}
  )[0] || null;
}

function sendButton(tree){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Send" && typeof node.props?.onPress==="function",
    {deep:true}
  )[0] || null;
}

// The listeners hooks/useKeyboardInset.js registers, captured as it registers
// them. Keyboard.emit is not reliably present under jest-expo, and going
// through the real emitter would be testing React Native rather than the hook.
const listeners=new Map();

beforeEach(()=>{
  listeners.clear();
  jest.spyOn(Keyboard,"addListener").mockImplementation((event,handler)=>{
    listeners.set(event,handler);
    return {remove:()=>listeners.delete(event)};
  });
});

afterEach(()=>{
  Keyboard.addListener.mockRestore?.();
});

async function fire(event,payload){
  const handler=listeners.get(event);
  if(!handler) return false;
  await act(async()=>{handler(payload);});
  return true;
}

async function showKeyboard(){
  // Whichever one this platform registered. Exactly one of them exists, which
  // is itself the thing worth checking: the hook must not register `will` on
  // Android, where it never fires.
  const fired=(await fire("keyboardDidShow",{endCoordinates:{height:KEYBOARD_HEIGHT}}))
    || (await fire("keyboardWillShow",{endCoordinates:{height:KEYBOARD_HEIGHT}}));
  expect(fired).toBe(true);
}

async function hideKeyboard(){
  const fired=(await fire("keyboardDidHide",{})) || (await fire("keyboardWillHide",{}));
  expect(fired).toBe(true);
}

beforeEach(()=>{
  installFixture({
    user:{id:"me"},
    params:{id:"conv-1"},
    tables:{
      conversations:[{id:"conv-1",kind:"friend",target_type:null,target_id:null}],
      conversation_members:[{conversation_id:"conv-1",user_id:"me"},{conversation_id:"conv-1",user_id:"them"}],
      direct_messages:[
        {id:"m1",sender_id:"them",body:"Hello",created_at:"2026-08-13T10:00:00Z"},
        {id:"m2",sender_id:"me",body:"Hi",created_at:"2026-08-13T10:01:00Z"}
      ],
      profiles:[{id:"them",full_name:"Sam Okoro"}]
    },
    rpc:{mark_conversation_read:null,send_message:null}
  });
});

afterEach(()=>{
  restoreRouterParams();
});

test("the composer moves up by exactly the keyboard's height",async()=>{
  const tree=await mount();

  expect(flatten(screenBox(tree).props.style).paddingBottom).toBe(0);

  await showKeyboard();
  expect(flatten(screenBox(tree).props.style).paddingBottom).toBe(KEYBOARD_HEIGHT);

  await hideKeyboard();
  expect(flatten(screenBox(tree).props.style).paddingBottom).toBe(0);
});

test("the input and Send are still there with the keyboard up",async()=>{
  const tree=await mount();
  await showKeyboard();

  expect(input(tree)).not.toBeNull();
  expect(sendButton(tree)).not.toBeNull();
});

test("the draft survives the keyboard opening and closing",async()=>{
  const tree=await mount();

  await act(async()=>{input(tree).props.onChangeText("half a thought");});
  await showKeyboard();
  await hideKeyboard();

  expect(input(tree).props.value).toBe("half a thought");
});

test("nothing hard-codes a device offset",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","app","messages","[id].js"),"utf8"
  );

  // The two shapes of the old bug: a platform-conditional behaviour that was
  // undefined on Android, and a magic number standing in for a measurement.
  expect(source).not.toMatch(/KeyboardAvoidingView[\s\S]{0,200}behavior=/);
  expect(source).not.toMatch(/keyboardVerticalOffset=\{?\s*\d+/);
  expect(source).not.toMatch(/paddingBottom:\s*96/);
});

test("the composer no longer reserves 96px for a tab bar that is not over it",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","app","messages","[id].js"),"utf8"
  );

  // components/TabBar.js is a SIBLING of the Stack in app/_layout.js, so this
  // screen's box already ends above it. 96 was counting it twice.
  const match=source.match(/composer:\{[^}]*paddingBottom:(\d+)/);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBeLessThan(40);
});

test("the thread does not yank you to the bottom on every reflow",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","app","messages","[id].js"),"utf8"
  );

  // It settles once, and after that only sending moves it. The old version
  // called scrollToEnd unconditionally from onContentSizeChange, which fires
  // whenever anything reflows -- including the keyboard opening while somebody
  // was reading history.
  expect(source).toMatch(/onContentSizeChange=\{\(\)=>\{/);
  expect(source).toMatch(/settled\.current/);
  expect(source).toMatch(/readingHistory\.current/);
  expect(source).not.toMatch(/onContentSizeChange=\{\(\)=>scroller\.current\?\.scrollToEnd/);
});

test("scrolling up marks the reader as reading history",async()=>{
  const tree=await mount();

  const scroll=tree.root.findAll(
    (node)=>typeof node.props?.onScroll==="function" && typeof node.props?.onContentSizeChange==="function",
    {deep:true}
  )[0];
  expect(scroll).toBeDefined();

  // 600px of content, a 400px window, sitting at the very top: 200 from the
  // bottom, which is well past the margin.
  await act(async()=>{
    scroll.props.onScroll({nativeEvent:{
      layoutMeasurement:{height:400},
      contentOffset:{y:0},
      contentSize:{height:600}
    }});
  });

  // The keyboard opening must now NOT move them.
  await showKeyboard();
  expect(flatten(screenBox(tree).props.style).paddingBottom).toBe(KEYBOARD_HEIGHT);
});
