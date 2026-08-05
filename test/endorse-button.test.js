/* eslint-env jest */

// Packet 8c: review reputation.
//
// Written and watched fail against a version of EndorseButton with the
// self-endorsement guard removed and the wording reverted to "Like", then
// re-run unchanged once the real component was in place -- the same
// discipline test/place-page.test.js used for the shared layout: a test
// written after the code it is meant to catch proves nothing.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {installFixture,labelsOf,textOf}=require("./fixture");
const {router}=require("expo-router");

const EndorseButton=require("../components/EndorseButton").default;

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function render(props){
  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(EndorseButton,props)));
  });
  return tree;
}

// EndorseButton calls supabase.from("social_likes") itself, outside any
// screen's load(); this reads back what that call was given, the way
// map-cards.test.js reads a pressed marker's onPress rather than trusting a
// snapshot.
function lastSocialLikesCall(){
  const calls=supabase.from.mock.calls;
  for(let i=calls.length-1;i>=0;i-=1){
    if(calls[i][0]==="social_likes") return supabase.from.mock.results[i].value;
  }
  return null;
}

function pressable(tree,label){
  const hits=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  );
  return hits[0] || null;
}

beforeEach(()=>{
  installFixture({user:{id:"visitor-1"},tables:{social_likes:[]}});
});

test("hides the endorse action on the reviewer's own review, but still shows the count",async()=>{
  const tree=await render({
    reviewId:"rev-1",
    ownerId:"owner-1",
    viewerId:"owner-1",
    initialCount:4,
    initialEndorsed:false
  });

  expect(labelsOf(tree.toJSON())).toContain("4 people found this review useful");
  // No pressable control for the owner -- there is nothing a press could do
  // that the database would not already reject.
  const control=tree.root.findAll(
    (node)=>typeof node.props?.onPress==="function" && node.type!==undefined,
    {deep:true}
  ).find((node)=>node.props?.accessibilityLabel?.includes("Mark as useful"));
  expect(control).toBeUndefined();

  await act(async()=>{});
});

test("says Useful, never Like",async()=>{
  const tree=await render({
    reviewId:"rev-1",
    ownerId:"owner-1",
    viewerId:"visitor-1",
    initialCount:2,
    initialEndorsed:false
  });

  const text=textOf(tree.toJSON());
  expect(text).toContain("Useful");
  expect(text).not.toContain("Like");

  await act(async()=>{});
});

test("marking a review as useful writes to social_likes and increments the count",async()=>{
  const tree=await render({
    reviewId:"rev-1",
    ownerId:"owner-1",
    viewerId:"visitor-1",
    initialCount:2,
    initialEndorsed:false
  });

  const button=pressable(tree,"Mark as useful. 2 people found this review useful.");
  expect(button).toBeTruthy();

  await act(async()=>{button.props.onPress();});
  await act(async()=>{});

  const call=lastSocialLikesCall();
  expect(call.insert).toHaveBeenCalledWith({user_id:"visitor-1",target_type:"review",target_id:"rev-1"});
  expect(labelsOf(tree.toJSON())).toContain("Remove useful mark. 3 people found this review useful.");
});

test("removing an endorsement deletes the row and decrements the count",async()=>{
  const tree=await render({
    reviewId:"rev-1",
    ownerId:"owner-1",
    viewerId:"visitor-1",
    initialCount:3,
    initialEndorsed:true
  });

  const button=pressable(tree,"Remove useful mark. 3 people found this review useful.");
  expect(button).toBeTruthy();

  await act(async()=>{button.props.onPress();});
  await act(async()=>{});

  const call=lastSocialLikesCall();
  expect(call.delete).toHaveBeenCalled();
  expect(call.eq).toHaveBeenCalledWith("user_id","visitor-1");
  expect(call.eq).toHaveBeenCalledWith("target_type","review");
  expect(call.eq).toHaveBeenCalledWith("target_id","rev-1");
  expect(labelsOf(tree.toJSON())).toContain("Mark as useful. 2 people found this review useful.");
});

test("a signed-out viewer is sent to log in instead of endorsing anonymously",async()=>{
  const tree=await render({
    reviewId:"rev-1",
    ownerId:"owner-1",
    viewerId:null,
    initialCount:0,
    initialEndorsed:false
  });

  const button=pressable(tree,"Mark as useful. 0 people found this review useful.");
  expect(button).toBeTruthy();

  await act(async()=>{button.props.onPress();});

  expect(router.push).toHaveBeenCalledWith("/auth/login");
  const call=lastSocialLikesCall();
  expect(call).toBeNull();
});
