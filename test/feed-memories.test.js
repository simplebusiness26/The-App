/* eslint-env jest */

// Step 11: Memories appear in the feed.
//
// And two live bugs in the same function, both from renames that landed
// elsewhere and were never followed through:
//
//   moments were filtered on `m.visibility='public'`, a value
//   explorer_moments has REFUSED since 20260811220000 unified the audience
//   vocabulary. So the feed showed your own Moments and your friends', and a
//   Moment deliberately shared with everyone was invisible to anybody
//   following you who was not also a friend.
//
//   review comment counts read `target_type='video_review'`, renamed to
//   'review' in 20260811150000. Every review in the feed showed 0 comments.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const expoRouter=require("expo-router");

const ME="me-1";

function row(overrides){
  return{
    item_id:"x1",item_type:"moment",actor_id:"them",actor_name:"Sam Okoro",
    actor_photo:null,created_at:"2026-08-12T00:00:00Z",caption:"Chips on the pier",
    rating:null,verified_qr:false,target_type:null,target_id:null,target_name:null,
    target_image_url:null,media_type:null,media_url:null,thumbnail_url:null,
    duration_seconds:null,like_count:2,comment_count:3,viewer_liked:false,
    source_reasons:[],...overrides
  };
}

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function renderFeed(items){
  installFixture({user:{id:ME},tables:{},rpc:{get_explorer_social_feed:items}});
  const Feed=require("../app/feed").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Feed)));});
  await act(async()=>{});
  return tree;
}

afterEach(()=>{restoreRouterParams();});

describe("a Memory in the feed",()=>{
  it("says it was kept, not shared",async()=>{
    const tree=await renderFeed([row({item_type:"memory",item_id:"mem-1",caption:"The pier at dusk"})]);
    const text=textOf(tree.toJSON());
    console.log("MEMORY ROW >>>",text.slice(0,180));

    // The word separates it from a Moment on a feed where both are a photo and
    // a sentence.
    expect(text).toContain("kept a Memory");
    expect(text).not.toContain("shared a Moment");

    await act(async()=>{tree.unmount();});
  });

  it("gets a Like, not a Useful",async()=>{
    const tree=await renderFeed([row({item_type:"memory",item_id:"mem-1"})]);

    const like=tree.root.findAll(
      (node)=>node.props?.targetType==="memory",
      {deep:true}
    );
    expect(like.length).toBeGreaterThan(0);
    expect(textOf(tree.toJSON())).not.toContain("Useful");

    await act(async()=>{tree.unmount();});
  });

  it("opens the Memory rather than a place page",async()=>{
    const tree=await renderFeed([row({item_type:"memory",item_id:"mem-1"})]);

    // The comment count is a control now -- a Memory can be commented on since
    // 20260812160000 -- and it opens the Memory, where the thread lives.
    const controls=tree.root.findAll(
      (node)=>typeof node.props?.onPress==="function",
      {deep:true}
    );

    let opened=false;
    for(const control of controls){
      expoRouter.router.push.mockClear();
      await act(async()=>{control.props.onPress({});});
      const went=expoRouter.router.push.mock.calls.map((call)=>String(call[0]));
      if(went.some((route)=>route==="/memories/mem-1")) opened=true;
    }

    expect(opened).toBe(true);

    await act(async()=>{tree.unmount();});
  });
});

describe("a review still gets Useful",()=>{
  it("does not become a Like by accident",async()=>{
    const tree=await renderFeed([row({item_type:"review",item_id:"r1",rating:5})]);
    expect(textOf(tree.toJSON())).toContain("Useful");
    await act(async()=>{tree.unmount();});
  });
});

describe("the two bugs in get_explorer_social_feed",()=>{
  const migration=require("fs").readFileSync(
    require("path").join(
      __dirname,"..","supabase","migrations",
      "20260812190000_memories_in_the_feed.sql"
    ),"utf8"
  );

  // Comments stripped: the file explains at length what was wrong, and those
  // sentences quote the broken code on purpose.
  const code=migration.replace(/^\s*--.*$/gm,"");

  it("asks can_see_content instead of hand-rolling the audience test",()=>{
    expect(code).toContain("guestbook_private.can_see_content(m.user_id,v.id,m.visibility)");
    expect(code).not.toMatch(/m\.visibility='public'/);
  });

  it("counts review comments on the value that is actually written",()=>{
    expect(code).toContain("c.target_type='review' and c.target_id=er.id");
    // 'video_review' survives only in the explanation of what was wrong.
    expect(code).not.toContain("video_review");
  });

  it("only carries Moments that are still live",()=>{
    // A Moment expires. A feed still carrying last week's contradicts the word.
    expect(migration).toContain("m.expires_at > now()");
  });

  it("asks whichever Memory audience is in force right now",()=>{
    // A Memory has two on purpose -- agreeing to be seen today is not agreeing
    // to be seen for ever -- so picking one would break the promise in one
    // direction or the other.
    expect(migration).toMatch(/live_until is not null and x\.live_until > now\(\)[\s\S]*x\.visibility else x\.archive_visibility/);
  });
});
