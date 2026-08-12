/* eslint-env jest */

// "yes both but its not a useful button for memories or moments its a like
//  button"
//
// Two things. Memories could not be liked or commented on at all -- social_likes
// and social_comments accepted 'review' and 'moment' and nothing else -- so a
// Memory somebody deliberately shared with friends was the one piece of content
// in the app nobody could say anything back to.
//
// And the word matters. Useful is an endorsement of a REVIEW: it says "this
// helped me decide" and since 20260812150000 it pays the reviewer a point. Like
// is a response to a Moment or a Memory: it says you liked seeing it and means
// nothing else. Same table, two words, two different acts.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");

const ME="me-1";
const OWNER="owner-1";

const MEMORY={
  id:"mem-1",user_id:OWNER,title:"The pier at dusk",note:"Chips.",
  visibility:"friends",archive_visibility:"friends",media_url:null,
  target_type:null,target_id:null,target_name:null,show_on_profile:false,
  created_at:"2026-08-01T12:00:00Z",map_until:null,live_until:null
};

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function render({viewerId=ME,likes=[]}={}){
  installFixture({
    user:{id:viewerId},
    params:{id:"mem-1"},
    tables:{
      explorer_memories:[MEMORY],
      social_likes:likes,
      social_comments:[],
      explorer_memory_shares:[],
      explorer_follows:[],
      profiles:[]
    },
    rpc:{}
  });

  const MemoryPage=require("../app/memories/[id]").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(MemoryPage)));});
  await act(async()=>{});
  return tree;
}

afterEach(()=>{restoreRouterParams();});

it("offers a Like on a Memory, and calls it a Like",async()=>{
  const tree=await render();
  const text=textOf(tree.toJSON());
  console.log("MEMORY SCREEN >>>",text.slice(0,260));

  // The word. Useful belongs to reviews and must not appear here.
  expect(text).not.toContain("Useful");
  expect(text).not.toContain("useful");

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels.toLowerCase()).toContain("like");

  await act(async()=>{tree.unmount();});
});

it("shows the like count it was given rather than counting up from zero",async()=>{
  const tree=await render({likes:[
    {user_id:"a"},{user_id:"b"},{user_id:ME}
  ]});

  const text=textOf(tree.toJSON());
  console.log("WITH THREE LIKES >>>",text.slice(0,200));
  expect(text).toContain("3");

  await act(async()=>{tree.unmount();});
});

it("puts a comment box on the Memory, not on a screen somewhere else",async()=>{
  const tree=await render();
  const text=textOf(tree.toJSON());

  // CommentThread's own empty state. Its presence is the thing being asserted:
  // before this, a Memory had no way to be replied to at all.
  expect(text).toMatch(/comment/i);

  await act(async()=>{tree.unmount();});
});

it("passes 'memory' as the target, not 'moment'",async()=>{
  const tree=await render();

  const likeButton=tree.root.findAll(
    (node)=>node.props?.targetType!==undefined && node.props?.targetId==="mem-1",
    {deep:true}
  );

  expect(likeButton.length).toBeGreaterThan(0);
  for(const node of likeButton){
    expect(node.props.targetType).toBe("memory");
  }

  await act(async()=>{tree.unmount();});
});

it("keeps Useful on reviews -- the two words did not merge",()=>{
  const endorse=require("fs").readFileSync(
    require("path").join(__dirname,"..","components","EndorseButton.js"),"utf8"
  );
  // EndorseButton still says Useful, still targets a review, and still refuses
  // to render an action for the review's own author.
  expect(endorse).toContain("Useful");
  expect(endorse).toContain('"review"');
  expect(endorse).toContain("viewerId===ownerId");

  const like=require("fs").readFileSync(
    require("path").join(__dirname,"..","components","LikeButton.js"),"utf8"
  );
  // LikeButton says nothing about usefulness and takes whatever target it is
  // given, which is why it needed no change to serve Memories.
  expect(like).not.toContain("Useful");
  expect(like).toContain("targetType");
});
