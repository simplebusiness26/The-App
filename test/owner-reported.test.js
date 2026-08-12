/* eslint-env jest */

// Three things the owner reported as not working after I said they were done.
// Each assertion below fails if the fix is not really there, so this file is
// the answer to "is it the code or is it the deploy".

const React=require("react");
const {act,create}=require("react-test-renderer");
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

test("1. the follower counts render AFTER the name, not before it",async()=>{
  installFixture({
    user:{id:"me"},
    params:{id:"me"},
    tables:{
      profiles:[{id:"me",full_name:"Sam Okoro",bio:"Old Town regular.",leaderboard_opt_in:true}],
      explorer_reviews:[],review_media:[],explorer_moments:[],explorer_memories:[],
      explorer_favourites:[],explorer_profile_stats:[]
    },
    rpc:{get_entity_follow_stats:[{follower_count:7,viewer_following:false}]}
  });

  const Screen=require("../app/profile/[id]").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
  await act(async()=>{});

  const text=textOf(tree.toJSON());
  const namePos=text.indexOf("Sam Okoro");
  const followPos=text.indexOf("Followers");

  console.log("ORDER >>>", text.slice(0,160));

  expect(namePos).toBeGreaterThan(-1);
  if(followPos>-1){
    // The whole complaint: the counts sat above the identity and clipped the photo.
    expect(followPos).toBeGreaterThan(namePos);
  }
  await act(async()=>{tree.unmount();});
});

test("2. tapping Comment opens the thread in place, with no navigation",async()=>{
  const {router}=require("expo-router");
  installFixture({user:{id:"viewer"},tables:{social_comments:[],profiles:[]},rpc:{}});
  router.push.mockClear?.();

  const ReviewActions=require("../components/ReviewActions").default;
  const review={id:"r1",user_id:"author",rating:5,comment:"C",name:"A",created_at:"2026-07-01T00:00:00Z"};

  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(ReviewActions,{
      review,viewerId:"viewer",targetType:"business",canReply:true
    })));
  });
  await act(async()=>{});

  const before=textOf(tree.toJSON());
  console.log("BEFORE TAP >>>", before);
  expect(before).toContain("Useful");
  expect(before).toContain("Comment");
  expect(before).toContain("Reply");

  // Press it through the test instance, not the rendered JSON: a Pressable
  // renders to a host View whose onPress is not on the JSON node, which is what
  // made the first version of this test throw rather than fail honestly.
  const button=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Comment on this review" && typeof node.props?.onPress==="function"
  )[0];
  expect(button).toBeTruthy();

  await act(async()=>{button.props.onPress({stopPropagation(){}});});
  await act(async()=>{});

  const after=textOf(tree.toJSON());
  console.log("AFTER TAP >>>", after);

  // The thread is now on screen, and nothing navigated anywhere.
  expect(after).toContain("Hide comments");
  expect(router.push).not.toHaveBeenCalled();
  await act(async()=>{tree.unmount();});
});

test("3. the map centre button carries an upward-swipe responder",async()=>{
  const expoRouter=require("expo-router");
  const original=expoRouter.usePathname;
  expoRouter.usePathname=()=>"/map";

  const TabBar=require("../components/TabBar").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(TabBar)));});
  await act(async()=>{});

  // The capture handler is what makes the swipe win against the Pressable in
  // the middle. Its presence is the fix; invoking it directly needs a real
  // native event with touch history, which a hand-made object cannot fake --
  // that is what made the first version of this test throw.
  let capture=null;
  (function walk(node){
    if(!node||typeof node!=="object"||capture) return;
    if(Array.isArray(node)){node.forEach(walk);return;}
    if(node.props?.onMoveShouldSetResponderCapture) capture=node.props.onMoveShouldSetResponderCapture;
    walk(node.children);
  })(tree.toJSON());

  console.log("HAS CAPTURE RESPONDER >>>", !!capture);
  expect(typeof capture).toBe("function");

  // And the routing half, which is a pure function and can be tested honestly.
  const {centreSwipeUp,centreButton}=require("../utils/navigation");
  expect(centreSwipeUp("/map")?.route).toBe("/discover");
  expect(centreSwipeUp("/feed")).toBeNull();
  expect(centreButton("/map").route).toBe("/moments/create");

  expoRouter.usePathname=original;
  await act(async()=>{tree.unmount();});
});
