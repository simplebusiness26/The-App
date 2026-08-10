/* eslint-env jest */

// Packet 9b: the rank card.
//
// The list shows the top of the board. Everybody not on it learns nothing --
// which is most people, and precisely the ones a leaderboard exists to tell
// where they stand. Watched failing first against a screen with no card, one
// that invented a position for somebody outside the fetched window, and one
// that told an opted-out Explorer to publish a review.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {installFixture,restoreRouterParams,labelsOf,textOf}=require("./fixture");

const Leaderboards=require("../app/leaderboards.js").default;

const mountedTrees=[];
const ME="11111111-1111-1111-1111-111111111111";
const OTHER="22222222-2222-2222-2222-222222222222";

function profile(overrides={}){
  return{id:ME,full_name:"Ada",area:"Hastings",show_area:true,leaderboard_opt_in:true,...overrides};
}

function boardRow(overrides={}){
  return{rank:1,user_id:OTHER,full_name:"Someone",profile_photo:null,area:"Hastings",
    points:40,review_count:4,verified_reviews:1,video_reviews:0,...overrides};
}

async function render(){
  let tree;
  await act(async()=>{
    tree=create(React.createElement(
      SafeAreaProvider,
      {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
      React.createElement(FeedbackProvider,null,
        React.createElement(NotificationProvider,null,React.createElement(Leaderboards)))
    ));
  });
  mountedTrees.push(tree);
  return tree;
}

afterEach(()=>{
  while(mountedTrees.length){
    const tree=mountedTrees.pop();
    act(()=>{tree.unmount();});
  }
  restoreRouterParams();
  jest.clearAllMocks();
});

describe("the rank card",()=>{
  test("tells a ranked Explorer where they stand",async()=>{
    installFixture({
      user:{id:ME},
      tables:{profiles:[profile()]},
      rpc:{get_explorer_leaderboard:[
        boardRow(),
        boardRow({rank:2,user_id:ME,full_name:"Ada",points:25,review_count:3})
      ]}
    });

    const tree=await render();

    // Asserted on the card's spoken label, not on the page text: textOf joins
    // React's text nodes with spaces, so `#{rank}` reads as "# 2" and a
    // substring check on "#2" fails against correct markup.
    expect(textOf(tree.toJSON())).toContain("WHERE YOU STAND");
    expect(labelsOf(tree.toJSON())).toContain("You are ranked 2 with 25 points");
  });

  test("says so plainly when the viewer is not on the board",async()=>{
    installFixture({
      user:{id:ME},
      tables:{profiles:[profile()]},
      rpc:{get_explorer_leaderboard:[boardRow()]}
    });

    const tree=await render();
    const text=textOf(tree.toJSON());

    // Never invent a position for somebody outside the fetched window.
    expect(text).toContain("WHERE YOU STAND");
    expect(labelsOf(tree.toJSON())).toContain("You are not ranked in this period yet");
    expect(text).toContain("Publish a review");
  });

  test("an opted-out Explorer is told the real reason, not to post more",async()=>{
    installFixture({
      user:{id:ME},
      tables:{profiles:[profile({leaderboard_opt_in:false})]},
      rpc:{get_explorer_leaderboard:[boardRow()]}
    });

    const text=textOf((await render()).toJSON());

    // Telling somebody who opted out to publish a review would be advice that
    // cannot work, which is worse than no advice.
    expect(text).toContain("opted out");
    expect(text).not.toContain("Publish a review");
  });

  test("the card asks the database nothing the list has not already answered",async()=>{
    installFixture({
      user:{id:ME},
      tables:{profiles:[profile()]},
      rpc:{get_explorer_leaderboard:[boardRow({rank:3,user_id:ME,points:9,review_count:1})]}
    });

    await render();

    // One leaderboard call. A second query would be a second thing to keep in
    // step, and a second surface to review for what it exposes.
    const calls=supabase.rpc.mock.calls.filter(call=>call[0]==="get_explorer_leaderboard");
    expect(calls).toHaveLength(1);
  });

  test("singular and plural read correctly",async()=>{
    installFixture({
      user:{id:ME},
      tables:{profiles:[profile()]},
      rpc:{get_explorer_leaderboard:[boardRow({rank:1,user_id:ME,points:1,review_count:1})]}
    });

    const labels=labelsOf((await render()).toJSON());

    // The spoken label had this wrong -- "1 points" -- and the page text could
    // not show it, because textOf's spacing hides the boundary entirely.
    expect(labels).toContain("You are ranked 1 with 1 point");
    expect(labels).not.toContain("You are ranked 1 with 1 points");
  });
});
