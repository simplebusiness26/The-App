/* eslint-env jest */

// Admin Dashboard Stage 4a acceptance tests. A claim decision must be one RPC
// call with a reason and a confirmation; the screen must never reproduce the
// former separate listing and claim updates.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Alert}=require("react-native");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminClaims=require("../app/admin/claims").default;

const CLAIMS=[
  {
    id:"claim-business",
    user_id:"explorer-1",
    business_id:"business-1",
    property_id:null,
    note:"I run this cafe.",
    created_at:"2026-08-09T10:00:00Z",
    status:"pending"
  },
  {
    id:"claim-property",
    user_id:"explorer-2",
    business_id:null,
    property_id:"property-1",
    note:"The booking records match my details.",
    created_at:"2026-08-08T10:00:00Z",
    status:"pending"
  }
];

const CAPABILITY_REQUESTS=[{
  id:"capability-1",
  user_id:"explorer-3",
  capability:"activity_clubs",
  status:"pending",
  request_note:"I organise a local running club.",
  requested_at:"2026-08-09T12:00:00Z"
}];

const ROWS={
  profiles:[
    {id:"explorer-1",full_name:"Alex Rivers",email:"alex@example.com",phone:"07000 000001"},
    {id:"explorer-2",full_name:"Sam Coast",email:"sam@example.com",phone:"07000 000002"},
    {id:"explorer-3",full_name:"Robin Fields",email:"robin@example.com",phone:"07000 000003"}
  ],
  businesses:[{id:"business-1",name:"The Lantern Cafe"}],
  properties:[{id:"property-1",name:"Seaview Stay"}]
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,element)
  );
}

function installQueue({errorTable=null,decisionError=null}={}){
  const queries=[];
  let decided=false;

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name,payload)=>{
    if(name==="guestbook_is_admin") return Promise.resolve({data:true,error:null});
    if(name==="admin_decide_claim"){
      if(decisionError) return Promise.resolve({data:null,error:{message:decisionError}});
      decided=true;
      return Promise.resolve({
        data:{claim_id:payload.p_claim_id,decision:payload.p_decision},
        error:null
      });
    }
    if(name==="admin_decide_capability_request"){
      if(decisionError) return Promise.resolve({data:null,error:{message:decisionError}});
      decided=true;
      return Promise.resolve({
        data:{request_id:payload.p_request_id,decision:payload.p_decision},
        error:null
      });
    }
    return Promise.resolve({data:null,error:null});
  });

  supabase.from.mockImplementation((table)=>{
    const query={table};
    query.select=jest.fn(()=>query);
    query.eq=jest.fn(()=>query);
    query.in=jest.fn(()=>query);
    query.order=jest.fn(()=>query);
    query.then=(resolve,reject)=>Promise.resolve(
      table===errorTable
        ? {data:null,error:{message:`${table} read failed`}}
        : {
            data:table==="claims"
              ? (decided ? [] : CLAIMS)
              : table==="manager_capability_requests"
                ? (decided ? [] : CAPABILITY_REQUESTS)
                : (ROWS[table] || []),
            error:null
          }
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderClaims(){
  let tree;
  await act(async()=>{
    tree=create(wrap(React.createElement(AdminClaims)));
  });
  return tree;
}

function control(tree,label,handler){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.[handler]==="function",
    {deep:true}
  )[0];
}

function confirmButton(){
  const call=Alert.alert.mock.calls[Alert.alert.mock.calls.length-1];
  return call?.[2]?.find((button)=>button.style!=="cancel");
}

describe("Admin Dashboard Stage 4a listing claims",()=>{
  let tree;

  beforeEach(()=>{
    jest.clearAllMocks();
  });

  afterEach(async()=>{
    if(tree){
      await act(async()=>{tree.unmount();});
      tree=null;
    }
  });

  it("loads both queues with five batched, explicit-column reads",async()=>{
    const queries=installQueue();
    tree=await renderClaims();
    const text=textOf(tree.toJSON());

    expect(text).toContain("2 claims waiting");
    expect(text).toContain("The Lantern Cafe");
    expect(text).toContain("Seaview Stay");
    expect(text).toContain("Alex Rivers");
    expect(text).toContain("Sam Coast");
    expect(text).toContain("1 request waiting");
    expect(text).toContain("Activity clubs");
    expect(text).toContain("Robin Fields");

    expect(queries.map((query)=>query.table)).toEqual([
      "claims","manager_capability_requests","profiles","businesses","properties"
    ]);
    for(const query of queries){
      expect(query.select).toHaveBeenCalledTimes(1);
      expect(query.select.mock.calls[0][0]).not.toBe("*");
    }
    expect(queries[2].in).toHaveBeenCalledWith("id",["explorer-1","explorer-2","explorer-3"]);
    expect(queries[3].in).toHaveBeenCalledWith("id",["business-1"]);
    expect(queries[4].in).toHaveBeenCalledWith("id",["property-1"]);
  });

  it("requires a reason before opening a decision confirmation",async()=>{
    installQueue();
    tree=await renderClaims();

    await act(async()=>{
      control(tree,"Approve claim for The Lantern Cafe","onPress").props.onPress();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith("admin_decide_claim",expect.anything());
    expect(textOf(tree.toJSON())).toContain("Decision reason required");
  });

  it("confirms and approves through one audited RPC payload",async()=>{
    installQueue();
    tree=await renderClaims();

    await act(async()=>{
      control(tree,"Decision reason for The Lantern Cafe","onChangeText")
        .props.onChangeText("Ownership documents match the Explorer details.");
    });
    await act(async()=>{
      control(tree,"Approve claim for The Lantern Cafe","onPress").props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(Alert.alert.mock.calls[Alert.alert.mock.calls.length-1][0])
      .toBe("Approve this listing claim?");

    await act(async()=>{
      await confirmButton().onPress();
    });

    expect(supabase.rpc).toHaveBeenCalledWith("admin_decide_claim",{
      p_claim_id:"claim-business",
      p_decision:"approved",
      p_reason:"Ownership documents match the Explorer details."
    });
    expect(textOf(tree.toJSON())).toContain("Claim decision saved");
    expect(textOf(tree.toJSON())).toContain("No pending listing claims");
  });

  it("marks rejection confirmation as destructive and records its reason",async()=>{
    installQueue();
    tree=await renderClaims();

    await act(async()=>{
      control(tree,"Decision reason for Seaview Stay","onChangeText")
        .props.onChangeText("The supplied details do not match the listing records.");
    });
    await act(async()=>{
      control(tree,"Reject claim for Seaview Stay","onPress").props.onPress();
    });

    expect(confirmButton().style).toBe("destructive");

    await act(async()=>{
      await confirmButton().onPress();
    });

    expect(supabase.rpc).toHaveBeenCalledWith("admin_decide_claim",{
      p_claim_id:"claim-property",
      p_decision:"rejected",
      p_reason:"The supplied details do not match the listing records."
    });
  });

  it("confirms Manager access and decides it through the capability RPC",async()=>{
    installQueue();
    tree=await renderClaims();

    await act(async()=>{
      control(
        tree,
        "Decision reason for Activity clubs access requested by Robin Fields",
        "onChangeText"
      ).props.onChangeText("The club identity and organiser details were verified.");
    });
    await act(async()=>{
      control(
        tree,
        "Approve Activity clubs access for Robin Fields",
        "onPress"
      ).props.onPress();
    });

    expect(Alert.alert.mock.calls[Alert.alert.mock.calls.length-1][0])
      .toBe("Approve this capability request?");

    await act(async()=>{
      await confirmButton().onPress();
    });

    expect(supabase.rpc).toHaveBeenCalledWith("admin_decide_capability_request",{
      p_request_id:"capability-1",
      p_decision:"approved",
      p_reason:"The club identity and organiser details were verified."
    });
    expect(textOf(tree.toJSON())).toContain("Capability decision saved");
    expect(textOf(tree.toJSON())).toContain("No pending capability requests");
  });

  it("shows one honest load error instead of a partial claim queue",async()=>{
    installQueue({errorTable:"profiles"});
    tree=await renderClaims();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Access requests could not be loaded");
    expect(text).toContain("profiles read failed");
    expect(text).not.toContain("The Lantern Cafe");
    expect(text).not.toContain("Seaview Stay");
  });

  it("keeps the queue and shows feedback when the RPC refuses a decision",async()=>{
    installQueue({decisionError:"Claim has already been decided."});
    tree=await renderClaims();

    await act(async()=>{
      control(tree,"Decision reason for The Lantern Cafe","onChangeText")
        .props.onChangeText("Verified against the submitted ownership records.");
    });
    await act(async()=>{
      control(tree,"Approve claim for The Lantern Cafe","onPress").props.onPress();
    });
    await act(async()=>{
      await confirmButton().onPress();
    });

    const text=textOf(tree.toJSON());
    expect(text).toContain("Claim decision failed");
    expect(text).toContain("Claim has already been decided.");
    expect(text).toContain("The Lantern Cafe");
  });
});
