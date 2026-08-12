/* eslint-env jest */

// "when you do become freinds can following turn into freinds"
//
// It matters more than a word. Friends-only is what a check-in, a Moment and
// the close friends list are all actually gated on
// (guestbook_private.are_friends -- both people, both directions). The button
// said "Following" whether or not the other person had followed back, so the
// state that decides who can see where you are was never named anywhere a
// person could see it.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");

const ME="me-1";
const THEM="them-1";

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function render(follows){
  installFixture({user:{id:ME},tables:{explorer_follows:follows},rpc:{}});
  const FollowButton=require("../components/FollowButton").default;
  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(FollowButton,{profileId:THEM})));
  });
  await act(async()=>{});
  return tree;
}

it("says Follow when neither of you has",async()=>{
  const tree=await render([]);
  expect(textOf(tree.toJSON())).toContain("Follow");
  expect(textOf(tree.toJSON())).not.toContain("Friends");
  await act(async()=>{tree.unmount();});
});

it("says Following when only you have",async()=>{
  const tree=await render([{id:"f1",follower_id:ME,following_id:THEM}]);
  const text=textOf(tree.toJSON());
  console.log("ONE WAY >>>",text);
  expect(text).toContain("Following");
  expect(text).not.toContain("Friends");
  await act(async()=>{tree.unmount();});
});

it("still says Follow when only THEY have -- being followed is not following",async()=>{
  const tree=await render([{id:"f2",follower_id:THEM,following_id:ME}]);
  const text=textOf(tree.toJSON());
  console.log("THEY FOLLOW ME >>>",text);
  expect(text).toBe("Follow");
  await act(async()=>{tree.unmount();});
});

it("says Friends once both of you have",async()=>{
  const tree=await render([
    {id:"f1",follower_id:ME,following_id:THEM},
    {id:"f2",follower_id:THEM,following_id:ME}
  ]);
  const text=textOf(tree.toJSON());
  console.log("BOTH WAYS >>>",text);
  expect(text).toContain("Friends");
  expect(text).not.toContain("Following");

  // And a screen reader is told what pressing it would cost.
  const labels=labelsOf(tree.toJSON());
  expect(labels.join(" ")).toContain("You are friends");

  await act(async()=>{tree.unmount();});
});
