/* eslint-env jest */

// Packet 8a: the three figures and the scrapbook tabs.
//
// Watched failing first against a profile that labelled total_points as an
// Explorer Score, one that offered a visitor the My Map tab, and one that
// listed a Club the Explorer had only applied to.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {installFixture,restoreRouterParams,labelsOf,textOf}=require("./fixture");

const ExplorerProfileScreen=require("../components/ExplorerProfileScreen").default;

const mountedTrees=[];
const OWNER="11111111-1111-1111-1111-111111111111";
const VISITOR="22222222-2222-2222-2222-222222222222";

function baseTables(){
  return{
    profiles:[{id:OWNER,full_name:"Ada",account_type:"explorer",leaderboard_opt_in:false}],
    explorer_profile_stats:[{user_id:OWNER,review_count:6,average_rating_given:4.5,total_points:120,verified_review_count:2,video_review_count:1}],
    explorer_reviews:[],
    explorer_favourites:[],
    explorer_moments:[],
    activity_memberships:[]
  };
}

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

async function render(element){
  let tree;
  await act(async()=>{tree=create(wrap(element));});
  mountedTrees.push(tree);
  return tree;
}

// Without the providers. The failure tests below break the Supabase client on
// purpose, and NotificationContext shares that client and has the same
// unprotected-await problem -- so wrapping would fail the test in a component
// this suite is not about. ExplorerProfileScreen uses no context of its own.
async function renderBare(element){
  let tree;
  await act(async()=>{tree=create(element);});
  mountedTrees.push(tree);
  return tree;
}

function press(tree,label){
  const hit=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
  return hit;
}

afterEach(()=>{
  while(mountedTrees.length){
    const tree=mountedTrees.pop();
    act(()=>{tree.unmount();});
  }
  restoreRouterParams();
  jest.clearAllMocks();
});

describe("three separately labelled figures",()=>{
  test("each figure says what it counts",async()=>{
    installFixture({
      user:{id:OWNER},
      tables:baseTables(),
      rpc:{get_explorer_review_reputation:[{total_endorsements:7,reviews_with_endorsement:3,average_endorsements_per_review:1.17}]}
    });

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const labels=labelsOf(tree.toJSON());

    // Asserted on each figure's own spoken label, not on the page text. The
    // first version looked for "REVIEW REPUTATION" anywhere, and the reputation
    // CARD further down the page carries that same phrase -- so deleting the
    // third figure entirely left the test green.
    expect(labels).toContain("Average review score given: 4.5 out of 5");
    expect(labels).toContain("Review points: 120");
    expect(labels).toContain("Review reputation: 7 endorsements");
  });

  test("total_points is never called an Explorer Score",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));

    // Explorer Score belongs to Packet 9a and does not exist yet. Naming it
    // here would label a thing 9a has to build and then contradict.
    expect(textOf(tree.toJSON())).not.toMatch(/Explorer Score/i);
  });

  test("the average is labelled as scores this Explorer gave",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const text=textOf(tree.toJSON());

    // An Explorer cannot receive a review -- RULES.md is explicit that reviews
    // attach to places, clubs and events. "AVG RATING" left that ambiguous.
    expect(text).toContain("GIVEN");
    expect(text).not.toContain("AVG RATING");
  });
});

describe("the scrapbook tabs",()=>{
  test("the owner is offered all five, in the brief's order",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const labels=labelsOf(tree.toJSON());

    for(const tab of ["Adventures","Reviews","My Map","Collections","Clubs"]){
      expect(labels).toContain(`Show ${tab}`);
    }
  });

  test("a visitor is not offered My Map at all",async()=>{
    installFixture({user:{id:VISITOR},tables:baseTables(),rpc:{}});

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const labels=labelsOf(tree.toJSON());

    // Not an empty tab. Absent. "A profile of another Explorer shows strictly
    // less than your own" holds by construction.
    expect(labels).not.toContain("Show My Map");
    expect(labels).toContain("Show Adventures");
  });

  test("Adventures opens first and Reviews is reachable",async()=>{
    installFixture({
      user:{id:OWNER},
      tables:{...baseTables(),explorer_moments:[{id:"m1",caption:"A walk",status:"published",created_at:"2026-08-01"}]},
      rpc:{}
    });

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));

    expect(textOf(tree.toJSON())).toContain("Memories");

    await act(async()=>{press(tree,"Show Reviews").props.onPress();});

    const text=textOf(tree.toJSON());
    expect(text).toContain("Review gallery");
    expect(text).not.toContain("A walk");
  });
});

describe("the Clubs tab",()=>{
  test("only approved memberships are asked for",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});

    await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));

    // A pending application is this Explorer asking, not a Club they are in.
    // Listing it on a profile any visitor can read would publish a request
    // that was never accepted.
    const membershipQuery=supabase.from.mock.results
      .map((result)=>result.value)
      .find((value)=>value?.eq?.mock?.calls?.some((call)=>call[0]==="status" && call[1]==="approved"));

    expect(membershipQuery).toBeTruthy();
    expect(supabase.from).toHaveBeenCalledWith("activity_memberships");
  });

  test("a Club the Explorer belongs to is listed and opens",async()=>{
    installFixture({
      user:{id:OWNER},
      tables:{...baseTables(),activity_memberships:[{
        id:"mem1",
        club_id:"c1",
        status:"approved",
        activity_clubs:{id:"c1",name:"Hastings Runners",category:"running",location:"Hastings",status:"open"}
      }]},
      rpc:{}
    });

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    await act(async()=>{press(tree,"Show Clubs").props.onPress();});

    expect(textOf(tree.toJSON())).toContain("Hastings Runners");
    expect(labelsOf(tree.toJSON())).toContain("Open Hastings Runners");
  });

  test("a membership row whose Club failed to join is dropped, not rendered blank",async()=>{
    installFixture({
      user:{id:OWNER},
      tables:{...baseTables(),activity_memberships:[{id:"mem1",club_id:"c1",status:"approved",activity_clubs:null}]},
      rpc:{}
    });

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    await act(async()=>{press(tree,"Show Clubs").props.onPress();});

    // Otherwise this throws on row.activity_clubs.name.
    expect(textOf(tree.toJSON())).toContain("Join a Club");
  });
});

describe("a failing load is never a blank screen",()=>{
  // Reproduced in a real browser before this was written: with the Supabase
  // calls failing at the network layer, the profile rendered the header and the
  // tab bar and then NOTHING -- no message, no retry, nothing to tap. The
  // loader had no try/catch, so a rejected promise skipped setLoading(false)
  // and the screen sat on a textless spinner forever.

  test("a rejected auth call shows an error and a way out",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});
    supabase.auth.getUser.mockImplementation(()=>Promise.reject(new Error("network down")));

    const tree=await renderBare(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const text=textOf(tree.toJSON());

    expect(text).toContain("Profile unavailable");
    expect(labelsOf(tree.toJSON())).toContain("Try again");
  });

  test("a rejected table read shows an error rather than an endless spinner",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});
    supabase.from.mockImplementation(()=>{throw new Error("boom");});

    const tree=await renderBare(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));

    expect(textOf(tree.toJSON())).toContain("Profile unavailable");
  });

  test("the Clubs read failing does not cost the whole profile",async()=>{
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});
    const realFrom=supabase.from.getMockImplementation();
    supabase.from.mockImplementation((name)=>{
      if(name==="activity_memberships") throw new Error("clubs down");
      return realFrom(name);
    });

    const tree=await render(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    const text=textOf(tree.toJSON());

    // One tab failing is not worth a whole profile.
    expect(text).not.toContain("Profile unavailable");
    expect(text).toContain("Ada");
  });
  test("a request that never settles still ends in an error, not a spinner",async()=>{
    jest.useFakeTimers();
    installFixture({user:{id:OWNER},tables:baseTables(),rpc:{}});
    supabase.auth.getUser.mockImplementation(()=>new Promise(()=>{}));   // never settles

    const tree=await renderBare(React.createElement(ExplorerProfileScreen,{profileId:OWNER}));
    await act(async()=>{jest.advanceTimersByTime(16000);});

    expect(textOf(tree.toJSON())).toContain("Profile unavailable");
    jest.useRealTimers();
  });
});
