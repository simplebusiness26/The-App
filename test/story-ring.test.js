/* eslint-env jest */

// Moments & Memories, step 4: a Moment is NOW.
//
// The profile carried a permanent grid of every Moment somebody had ever
// posted. That made a Moment a Memory with a different name -- same photo, same
// permanence, two words for one thing -- and it contradicted the one sentence
// the spec is built on. Moments are live for a day, watched through the ring on
// the profile picture, and then gone.
//
// Nothing is deleted. The rows stay; they stop having a permanent home.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function renderRing(storyState){
  installFixture({
    user:{id:"viewer"},
    tables:{},
    rpc:{get_moment_story_state:storyState}
  });

  const StoryRing=require("../components/StoryRing").default;
  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(
      StoryRing,
      {ownerId:"owner-1",onOpen:()=>{}},
      React.createElement(require("react-native").Text,null,"AVATAR")
    )));
  });
  await act(async()=>{});
  return tree;
}

function ringStyle(tree){
  const {StyleSheet}=require("react-native");
  const nodes=tree.root.findAll((node)=>typeof node.type==="string",{deep:true});
  for(const node of nodes){
    const style=StyleSheet.flatten(node.props?.style);
    if(style && style.borderRadius && "borderWidth" in style) return style;
  }
  return null;
}

describe("the ring",()=>{
  it("draws nothing when there is nothing live",async()=>{
    const tree=await renderRing([{live_count:0,unseen_count:0}]);

    // No ring AND no button. A control that opens an empty viewer is worse than
    // no control.
    expect(labelsOf(tree.toJSON())).toEqual([]);
    const style=ringStyle(tree);
    expect(style?.borderWidth || 0).toBe(0);

    await act(async()=>{tree.unmount();});
  });

  it("draws a solid ring for something unwatched, and says how many",async()=>{
    const tree=await renderRing([{live_count:3,unseen_count:2}]);

    const labels=labelsOf(tree.toJSON());
    console.log("UNWATCHED >>>",labels.join(" | "));
    expect(labels.join(" ")).toContain("Watch 2 new Moments");

    const style=ringStyle(tree);
    expect(style.borderWidth).toBe(3);
    expect(style.opacity).toBe(1);

    await act(async()=>{tree.unmount();});
  });

  it("fades the ring once everything has been watched",async()=>{
    const tree=await renderRing([{live_count:3,unseen_count:0}]);

    const labels=labelsOf(tree.toJSON());
    console.log("ALL WATCHED >>>",labels.join(" | "));
    // Still openable -- "still there, you have seen it" rather than a nag.
    expect(labels.join(" ")).toContain("again");

    const style=ringStyle(tree);
    expect(style.borderWidth).toBe(3);
    expect(style.opacity).toBeLessThan(1);

    await act(async()=>{tree.unmount();});
  });

  it("asks for counts and never for content",async()=>{
    const {supabase}=require("../services/supabase");
    const tree=await renderRing([{live_count:1,unseen_count:1}]);

    expect(supabase.rpc).toHaveBeenCalledWith("get_moment_story_state",{p_owner_id:"owner-1"});
    // The Moments themselves are fetched only when somebody taps. A profile
    // listing must not be usable to enumerate what somebody posted.
    expect(supabase.rpc).not.toHaveBeenCalledWith("get_live_moments",expect.anything());
    expect(supabase.from).not.toHaveBeenCalledWith("explorer_moments");

    await act(async()=>{tree.unmount();});
  });
});

describe("the viewer",()=>{
  const MOMENTS=[
    {id:"m1",caption:"Pier",media_type:"image",media_url:"http://x/1.jpg",
     created_at:"2026-08-12T00:00:00Z",expires_at:"2026-09-11T00:00:00Z",
     target_name:"The Pier",target_type:"public_place",target_id:"p1",viewed:true},
    {id:"m2",caption:"Chips",media_type:"image",media_url:"http://x/2.jpg",
     created_at:"2026-08-12T01:00:00Z",expires_at:"2026-09-11T00:00:00Z",
     target_name:null,target_type:null,target_id:null,viewed:false}
  ];

  async function renderViewer(){
    installFixture({
      user:{id:"viewer"},
      tables:{},
      rpc:{get_live_moments:MOMENTS,mark_moment_viewed:null}
    });

    const StoryViewer=require("../components/StoryViewer").default;
    let tree;
    await act(async()=>{
      tree=create(wrap(React.createElement(StoryViewer,{
        ownerId:"owner-1",ownerName:"Sam Okoro",visible:true,onClose:()=>{}
      })));
    });
    await act(async()=>{});
    return tree;
  }

  it("opens on the first thing the viewer has not watched",async()=>{
    const tree=await renderViewer();
    const text=textOf(tree.toJSON());
    console.log("VIEWER >>>",text);

    // m1 is already watched, so it opens on m2.
    expect(text).toContain("Chips");
    expect(text).not.toContain("Pier");

    await act(async()=>{tree.unmount();});
  });

  it("marks a Moment watched on arrival, not on close",async()=>{
    const {supabase}=require("../services/supabase");
    const tree=await renderViewer();

    expect(supabase.rpc).toHaveBeenCalledWith("mark_moment_viewed",{p_moment_id:"m2"});

    await act(async()=>{tree.unmount();});
  });

  it("says when the Moment goes, because that is what makes it a Moment",async()=>{
    const tree=await renderViewer();
    expect(textOf(tree.toJSON())).toMatch(/Gone in/);
    await act(async()=>{tree.unmount();});
  });

  it("can be walked backwards and forwards",async()=>{
    const tree=await renderViewer();

    const back=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Previous Moment" && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{back.props.onPress();});

    expect(textOf(tree.toJSON())).toContain("Pier");

    const forward=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Next Moment" && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{forward.props.onPress();});

    expect(textOf(tree.toJSON())).toContain("Chips");

    await act(async()=>{tree.unmount();});
  });
});

describe("the permanent grid is gone",()=>{
  it("no longer renders every Moment somebody ever posted",()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","ExplorerProfileScreen.js"),"utf8"
    ).replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");

    // The grid mapped over a `moments` array. There is no such array now --
    // only a count of what is live, for the stat card.
    expect(source).not.toContain("moments.map");
    expect(source).toContain("StoryRing");
    expect(source).toContain("liveMomentCount");
  });

  it("counts only Moments that are still live",()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","ExplorerProfileScreen.js"),"utf8"
    );
    // An expired Moment is not something this Explorer currently has.
    expect(source).toMatch(/gt\("expires_at"/);
  });
});
