/* eslint-env jest */

// Two things the owner reported after testing the APK:
//
//   "when your on the map you cant click any other navigation in the footer
//    your stuck on the map until you go on the camera or discover page"
//
//   "I also dont like that black bar above the bottom nav navigation"
//
// Plus the third: the upward swipe worked, but it fired all at once instead of
// the button coming up with the finger.
//
// All three are checked here rather than described, because "done" has meant
// "committed" too many times in this project.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {
  dragOffset,
  isDragging,
  dragOpens,
  DRAG_MAX,
  DRAG_THRESHOLD
}=require("../utils/navigation");

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

// StyleSheet.create hands back opaque ids, not objects, so the styles have to
// be resolved rather than spread.
const {StyleSheet}=require("react-native");
function flatten(style){
  return StyleSheet.flatten(style) || {};
}

async function renderAt(pathname){
  const expoRouter=require("expo-router");
  const original=expoRouter.usePathname;
  expoRouter.usePathname=()=>pathname;

  const TabBar=require("../components/TabBar").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(TabBar)));});
  await act(async()=>{});

  expoRouter.usePathname=original;
  return tree;
}

// The box carrying the pan handlers is the one that used to cover the bar.
function findGestureBox(node,found=[]){
  if(!node || typeof node!=="object") return found;
  if(Array.isArray(node)){node.forEach((child)=>findGestureBox(child,found));return found;}
  if(node.props?.onMoveShouldSetResponderCapture) found.push(node);
  findGestureBox(node.children,found);
  return found;
}

describe("the footer works while you are on the map",()=>{
  it("does not put an invisible box over the other four tabs",async()=>{
    const tree=await renderAt("/map");
    const boxes=findGestureBox(tree.toJSON());

    expect(boxes.length).toBe(1);
    const style=flatten(boxes[0].props.style);

    // The bug, exactly: left:0 AND right:0 stretches this box across all five
    // tab slots, and it is drawn last, so every touch in the footer landed on
    // it. A finite width is the fix.
    const spansTheBar=style.left===0 && style.right===0;
    expect(spansTheBar).toBe(false);
    expect(typeof style.width).toBe("number");
    expect(style.width).toBeLessThan(200);

    await act(async()=>{tree.unmount();});
  });

  it("still gives every tab its own pressable, map included",async()=>{
    const tree=await renderAt("/map");

    const tabs=tree.root.findAll(
      (node)=>node.props?.accessibilityRole==="tab" && typeof node.props?.onPress==="function",
      {deep:true}
    );

    // Five: four in the row plus the raised centre.
    expect(tabs.length).toBeGreaterThanOrEqual(5);

    await act(async()=>{tree.unmount();});
  });

  it("paints the strip above the bar instead of leaving it see-through",async()=>{
    const tree=await renderAt("/map");

    // The footer's outermost box. Found by role rather than by position, since
    // the provider wraps it.
    const shell=tree.root.findAll(
      (node)=>node.props?.accessibilityRole==="tablist",
      {deep:true}
    )[0];
    const outer=flatten(shell.props.style);

    // Transparent here showed whatever is behind the app, and behind the app is
    // black. That strip IS the black bar the owner reported.
    expect(outer.backgroundColor).not.toBe("transparent");
    expect(outer.backgroundColor).toBeTruthy();
    // And the top line moved out here with it, so there is one edge rather than
    // a line floating in the middle of a painted block.
    expect(outer.borderTopWidth).toBe(2);

    await act(async()=>{tree.unmount();});
  });
});

describe("the centre button is dragged, not swiped",()=>{
  it("moves with the finger and stops at the ceiling",()=>{
    expect(dragOffset(0)).toBe(0);
    expect(dragOffset(-10)).toBe(-10);
    expect(dragOffset(-40)).toBe(-40);
    // Past the ceiling it stops rather than sailing off.
    expect(dragOffset(-500)).toBe(-DRAG_MAX);
    // And it never goes below where it sits.
    expect(dragOffset(30)).toBe(0);
  });

  it("starts following the finger long before it would open anything",()=>{
    // 8px up: moving, but letting go there does nothing.
    expect(isDragging(0,-8)).toBe(true);
    expect(dragOpens(0,-8)).toBe(false);

    // Past the threshold, letting go opens Discover.
    expect(dragOpens(0,-(DRAG_THRESHOLD+1))).toBe(true);
  });

  it("ignores a tap and a sideways swipe",()=>{
    expect(isDragging(0,-1)).toBe(false);
    expect(isDragging(0,0)).toBe(false);
    // Mostly sideways is a sideways swipe, not a drag up.
    expect(isDragging(-60,-20)).toBe(false);
    expect(dragOpens(-90,-40)).toBe(false);
  });

  it("wires that arithmetic into the button, not a copy of it",async()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","TabBar.js"),"utf8"
    );

    // The component must call the shared functions. A second copy of the
    // numbers inside the component is how the tested thing and the shipped
    // thing drift apart.
    expect(source).toContain("dragOffset(gesture.dy)");
    expect(source).toContain("onPanResponderMove");
    expect(source).toContain("dragOpens(gesture.dx,gesture.dy)");
  });
});
