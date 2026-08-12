/* eslint-env jest */
const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");

// EndorseButton calls useFeedback, which throws without the provider. The real
// app has one in app/_layout.js; the test needs the same.
function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

const REVIEW={id:"r1",user_id:"someone-else",rating:5,review_title:"T",comment:"C",
  name:"Alex",created_at:"2026-07-01T12:00:00Z",points_awarded:1,photos:[]};

test("a review card shows Useful and Comment, and Reply only for a manager",async()=>{
  installFixture({user:{id:"viewer-1"},tables:{},rpc:{}});
  const ReviewActions=require("../components/ReviewActions").default;

  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(ReviewActions,{
      review:REVIEW,viewerId:"viewer-1",targetType:"business",canReply:false
    })));
  });
  await act(async()=>{});
  const plain=textOf(tree.toJSON());
  console.log("NON-MANAGER:",plain);
  expect(plain).toContain("Useful");
  expect(plain).toContain("Comment");
  expect(plain).not.toContain("Reply");
  await act(async()=>{tree.unmount();});

  await act(async()=>{
    tree=create(wrap(React.createElement(ReviewActions,{
      review:REVIEW,viewerId:"viewer-1",targetType:"business",canReply:true
    })));
  });
  await act(async()=>{});
  const mgr=textOf(tree.toJSON());
  console.log("MANAGER:",mgr);
  expect(mgr).toContain("Reply");
  await act(async()=>{tree.unmount();});
});
