/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {StyleSheet}=require("react-native");
const {centreButton,centreSwipeUp}=require("../utils/navigation");

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

function flatten(style){return StyleSheet.flatten(style) || {};}

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

describe("the Alex map dock keeps navigation usable",()=>{
  it("gives all five dock positions a real pressable on Map",async()=>{
    const tree=await renderAt("/map");
    const tabs=tree.root.findAll(
      (node)=>node.props?.accessibilityRole==="tab" && typeof node.props?.onPress==="function",
      {deep:true}
    );
    expect(tabs.length).toBe(5);
    await act(async()=>{tree.unmount();});
  });

  it("uses one continuous dark dock instead of the frozen raised-circle footer",async()=>{
    const tree=await renderAt("/map");
    const shell=tree.root.findAll((node)=>node.props?.accessibilityRole==="tablist",{deep:true})[0];
    expect(shell).toBeTruthy();

    const darkRows=tree.root.findAll((node)=>{
      const style=flatten(node.props?.style);
      return style.flexDirection==="row" && style.borderRadius===24 && !!style.backgroundColor;
    },{deep:true});
    expect(darkRows.length).toBeGreaterThanOrEqual(1);

    const source=require("fs").readFileSync(require("path").join(__dirname,"..","components","TabBar.js"),"utf8");
    expect(source).not.toContain("PanResponder");
    expect(source).not.toContain("raisedWrap");
    expect(source).toContain("styles.centreTab");

    await act(async()=>{tree.unmount();});
  });

  it("makes Explore explicit and removes the hidden Discover gesture",()=>{
    expect(centreSwipeUp("/map")).toBeNull();
    expect(centreButton("/map").label).toBe("Camera");
  });

  it("does not overlay a full-width invisible gesture box on the other tabs",async()=>{
    const tree=await renderAt("/map");
    const gestureBoxes=tree.root.findAll(
      (node)=>node.props?.onMoveShouldSetResponderCapture || node.props?.onMoveShouldSetResponder,
      {deep:true}
    );
    expect(gestureBoxes).toHaveLength(0);
    await act(async()=>{tree.unmount();});
  });
});
