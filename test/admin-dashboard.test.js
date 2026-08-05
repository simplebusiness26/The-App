/* eslint-env jest */

// Admin Dashboard Stage 2 acceptance tests.
//
// The shipped dashboard duplicated the claims screen and asked PostgREST to
// infer claims.user_id -> profiles.id. That relationship does not exist:
// claims.user_id points to auth.users, so the whole screen failed before it
// could show an honest pending total. The overview below deliberately asks
// only for exact counts and leaves claim decisions to /admin/claims.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {supabase}=require("../services/supabase");
const {router}=require("expo-router");
const {textOf}=require("./fixture");

const AdminDashboard=require("../app/admin/dashboard").default;

const LIVE_STAGE_2_COUNTS={
  claims:1,
  businesses:26,
  properties:9,
  public_places:1,
  activity_clubs:8,
  events:9
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

async function renderDashboard(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminDashboard)));});
  return tree;
}

function installAdminOverview({counts=LIVE_STAGE_2_COUNTS,errorTable=null}={}){
  const queries=[];

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name)=>Promise.resolve({
    data:name==="guestbook_is_admin" ? true : null,
    error:null
  }));
  supabase.from.mockImplementation((table)=>{
    const query={table,status:null};
    query.select=jest.fn(()=>query);
    query.eq=jest.fn((column,value)=>{
      query.status={column,value};
      return query;
    });
    query.then=(resolve,reject)=>Promise.resolve(
      table===errorTable
        ? {data:null,count:null,error:{message:"count failed"}}
        : {data:null,count:counts[table],error:null}
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

function pressable(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
}

describe("Admin Dashboard Stage 2",()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
  });

  it("shows the six real overview totals without a relational claims join",async()=>{
    const queries=installAdminOverview();
    const tree=await renderDashboard();
    const text=textOf(tree.toJSON());

    for(const phrase of [
      "1 Pending claims",
      "26 Businesses",
      "9 Properties",
      "1 Public places",
      "8 Activity clubs",
      "9 Events"
    ]) expect(text).toContain(phrase);

    expect(queries).toHaveLength(6);
    for(const query of queries){
      expect(query.select).toHaveBeenCalledWith("id",{count:"exact",head:true});
      expect(query.select.mock.calls.flat().join(" ")).not.toContain("profiles:user_id");
    }

    const claims=queries.find((query)=>query.table==="claims");
    expect(claims.eq).toHaveBeenCalledWith("status","pending");
  });

  it("opens the dedicated claim-review screen",async()=>{
    installAdminOverview();
    const tree=await renderDashboard();

    await act(async()=>{pressable(tree,"Review pending claims").props.onPress();});

    expect(router.push).toHaveBeenCalledWith("/admin/claims");
  });

  it("opens the existing public-place manager",async()=>{
    installAdminOverview();
    const tree=await renderDashboard();

    await act(async()=>{pressable(tree,"Manage public places").props.onPress();});

    expect(router.push).toHaveBeenCalledWith("/admin/public-places");
  });

  it("shows one honest load error instead of turning failed counts into zero",async()=>{
    installAdminOverview({
      counts:{...LIVE_STAGE_2_COUNTS,claims:0},
      errorTable:"businesses"
    });
    const tree=await renderDashboard();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Overview could not be loaded");
    expect(text).toContain("Try again");
    expect(text).not.toContain("0 Pending claims");
    expect(text).not.toContain("0 Businesses");
  });
});
