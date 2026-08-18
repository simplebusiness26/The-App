/* eslint-env jest */
const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {installFixture,restoreRouterParams}=require("./fixture");

function wrap(el){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:412,height:915},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,el)
  );
}

afterEach(()=>{restoreRouterParams();jest.clearAllMocks();});

const SCREENS=[
  ["login","../app/auth/login"],
  ["signup","../app/auth/signup"],
  ["forgot","../app/auth/forgot-password"],
  ["update","../app/auth/update-password"],
  ["edit","../app/profile/edit"],
  ["blocked","../app/safety/blocked"],
  ["connections","../app/connections/[id]"],
  ["privacy","../app/legal/privacy"],
  ["terms","../app/legal/terms"],
  ["conversation","../app/messages/[id]"],
  ["profile","../app/profile"]
];

for(const [name,path] of SCREENS){
  test(`${name} renders`,async()=>{
    installFixture({
      user:{id:"me"},
      tables:{
        profiles:[{id:"me",full_name:"Ada Lovelace",email:"me@example.com",area:"Hastings",show_area:true,bio:"Walks a lot.",visibility:"friends",leaderboard_opt_in:true}],
        explorer_profile_stats:[{user_id:"me",review_count:6,average_rating_given:4.5,total_points:120,verified_review_count:2,video_review_count:1}],
        explorer_reviews:[],explorer_favourites:[],explorer_moments:[],activity_memberships:[],
        user_blocks:[{blocked_id:"them",created_at:"2026-08-01"}],
        explorer_follows:[],manager_capabilities:[],
        conversations:[],conversation_members:[],direct_messages:[],
        businesses:[],properties:[],activity_clubs:[],events:[]
      },
      rpc:{}
    });
    const Screen=require(path).default;
    let tree;
    await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
    await act(async()=>{});
    expect(tree.toJSON()).toBeTruthy();
    await act(async()=>{tree.unmount();});
  });
}
