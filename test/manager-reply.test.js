/* eslint-env jest */

// The owner, after testing the APK:
//
//   "i dont wanna be taken to a new page" / "the replies page is janky"
//   "the challenge did nothing"
//   "replies green, challenges red"
//
// The challenge one was the real bug. challenge_review set
// explorer_reviews.challenged, utils/reviews.js read it back, and no screen in
// the app drew it -- so pressing Challenge worked perfectly and looked exactly
// like pressing nothing.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {StyleSheet}=require("react-native");
const {installFixture,textOf}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {INK}=require("../utils/tokens");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

const BASE={
  id:"r1",user_id:"someone-else",rating:5,review_title:"T",comment:"C",
  name:"Alex",created_at:"2026-07-01T12:00:00Z",points_awarded:1,photos:[]
};

async function render(review,canReply){
  installFixture({user:{id:"viewer-1"},tables:{},rpc:{}});
  const ReviewActions=require("../components/ReviewActions").default;
  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(ReviewActions,{
      review,viewerId:"viewer-1",canReply
    })));
  });
  await act(async()=>{});
  return tree;
}

function coloursOf(tree){
  const found=new Set();
  tree.root.findAll(()=>true,{deep:true}).forEach((node)=>{
    const style=StyleSheet.flatten(node.props?.style);
    if(!style) return;
    ["color","backgroundColor","borderColor","borderLeftColor"].forEach((key)=>{
      if(style[key]) found.add(style[key]);
    });
  });
  return found;
}

describe("a challenged review says so",()=>{
  it("draws the dispute where anybody reading the review can see it",async()=>{
    const tree=await render({...BASE,challenged:true,challenge_reason:"They were never here."},false);
    const text=textOf(tree.toJSON());

    console.log("CHALLENGED, SEEN BY A VISITOR >>>",text);

    expect(text).toContain("THE MANAGER DISPUTES THIS REVIEW");
    expect(text).toContain("They were never here.");
    // And says what happens next, because "challenged" on its own is not an
    // outcome anybody can act on.
    expect(text).toContain("moderation");

    await act(async()=>{tree.unmount();});
  });

  it("says nothing at all when the review is not challenged",async()=>{
    const tree=await render({...BASE},false);
    expect(textOf(tree.toJSON())).not.toContain("DISPUTES");
    await act(async()=>{tree.unmount();});
  });

  it("does not offer Challenge twice",async()=>{
    const tree=await render({...BASE,challenged:true,challenge_reason:"x"},true);
    const text=textOf(tree.toJSON());
    // The block is there; the button to raise another one is not.
    expect(text).toContain("DISPUTES");
    expect(text).not.toContain("Challenge");
    await act(async()=>{tree.unmount();});
  });
});

describe("a manager's reply is inline, not a page",()=>{
  it("gives the manager both boxes on the review itself",async()=>{
    const tree=await render({...BASE},true);
    const text=textOf(tree.toJSON());

    console.log("MANAGER TOOLS >>>",text);
    expect(text).toContain("Reply");
    expect(text).toContain("Challenge");

    await act(async()=>{tree.unmount();});
  });

  it("opens the reply box in place when Reply is pressed",async()=>{
    const tree=await render({...BASE},true);

    const reply=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Reply to this review as the manager"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    await act(async()=>{reply.props.onPress({});});

    const text=textOf(tree.toJSON());
    console.log("AFTER PRESSING REPLY >>>",text);

    // The box, and the button that sends it, are now on screen -- and the
    // review is still on screen with them, which is the whole point.
    expect(text).toContain("Post reply");
    expect(text).toContain("Everybody");

    await act(async()=>{tree.unmount();});
  });

  it("routes nowhere -- there is no push left to a review-action screen",()=>{
    // Comments stripped: the file still explains in prose why the old route is
    // gone, and that sentence is not a route.
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","ReviewActions.js"),"utf8"
    ).replace(/^\s*\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"");

    expect(source).not.toContain("review-action");
    expect(source).not.toContain("router.push");
    expect(source).not.toContain("expo-router");
  });

  it("shows an existing reply to everybody, and the boxes to nobody else",async()=>{
    const tree=await render({...BASE,manager_response:"Sorry about that, come back in."},false);
    const text=textOf(tree.toJSON());

    expect(text).toContain("REPLY FROM THE MANAGER");
    expect(text).toContain("Sorry about that, come back in.");
    // A visitor gets no way to write one.
    expect(text).not.toContain("Post reply");
    expect(text).not.toContain("Challenge");

    await act(async()=>{tree.unmount();});
  });
});

describe("green agrees, red disputes",()=>{
  it("paints the reply green",async()=>{
    const tree=await render({...BASE,manager_response:"Thanks."},false);
    expect([...coloursOf(tree)]).toContain(INK.green);
    expect([...coloursOf(tree)]).not.toContain(INK.red);
    await act(async()=>{tree.unmount();});
  });

  it("paints the challenge red",async()=>{
    const tree=await render({...BASE,challenged:true,challenge_reason:"Not us."},false);
    expect([...coloursOf(tree)]).toContain(INK.red);
    await act(async()=>{tree.unmount();});
  });

  it("uses the token table, not two hexes typed into a component",()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","ManagerReply.js"),"utf8"
    );
    expect(source).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(source).toContain("INK.green");
    expect(source).toContain("INK.red");
  });
});
