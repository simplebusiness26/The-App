/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Alert}=require("react-native");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminActivities=require("../app/admin/activities").default;

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,element)
  );
}

function installActivities({errorTable=null,total=2}={}){
  const rows={
    activity_clubs:[
      {id:"club-1",name:"Hastings Runners",category:"Running",location:"Alexandra Park",status:"open",created_at:"2026-08-01T10:00:00Z"},
      {id:"club-2",name:"Sea Swimmers",category:"Swimming",location:"The beach",status:"draft",created_at:"2026-08-02T10:00:00Z"}
    ],
    events:[
      {id:"event-1",name:"Summer Fair",category:"Community",location:"Town Square",status:"published",starts_at:"2026-08-20T10:00:00Z"}
    ]
  };
  const queries=[];

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name,payload)=>{
    if(name==="guestbook_is_admin") return Promise.resolve({data:true,error:null});
    if(name==="admin_set_activity_state"){
      const table=payload.p_target_type==="activity_club" ? "activity_clubs" : "events";
      const row=rows[table].find((item)=>item.id===payload.p_target_id);
      if(row) row.status=payload.p_state;
      return Promise.resolve({
        data:{target_id:payload.p_target_id,state:payload.p_state},
        error:null
      });
    }
    return Promise.resolve({data:null,error:null});
  });

  supabase.from.mockImplementation((table)=>{
    const query={table};
    query.select=jest.fn(()=>query);
    query.order=jest.fn(()=>query);
    query.range=jest.fn(()=>query);
    query.then=(resolve,reject)=>Promise.resolve(
      table===errorTable
        ? {data:null,count:null,error:{message:`${table} read failed`}}
        : {data:rows[table] || [],count:table==="events" ? 1 : total,error:null}
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderActivities(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminActivities)));});
  return tree;
}

function control(tree,label,handler="onPress"){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.[handler]==="function",
    {deep:true}
  )[0];
}

function confirmButton(){
  const call=Alert.alert.mock.calls[Alert.alert.mock.calls.length-1];
  return call?.[2]?.find((button)=>button.style!=="cancel");
}

describe("Admin Dashboard Stage 5 activities",()=>{
  let tree;

  beforeEach(()=>jest.clearAllMocks());
  afterEach(async()=>{
    if(tree){
      await act(async()=>tree.unmount());
      tree=null;
    }
  });

  it("loads an explicit-column, paginated club page",async()=>{
    const queries=installActivities({total:30});
    tree=await renderActivities();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Hastings Runners");
    expect(text).toContain("Sea Swimmers");
    expect(text).toContain("30 total");
    expect(queries[0].table).toBe("activity_clubs");
    expect(queries[0].select).toHaveBeenCalledWith(
      "id,name,category,location,status,created_at",
      {count:"exact"}
    );
    expect(queries[0].range).toHaveBeenCalledWith(0,24);

    await act(async()=>{
      control(tree,"Next activity page").props.onPress();
    });
    expect(queries[1].range).toHaveBeenCalledWith(25,49);
  });

  it("switches to the separately paginated event queue",async()=>{
    const queries=installActivities();
    tree=await renderActivities();

    await act(async()=>{
      control(tree,"Manage Events").props.onPress();
    });

    expect(queries[1].table).toBe("events");
    expect(queries[1].select).toHaveBeenCalledWith(
      "id,name,category,location,status,starts_at",
      {count:"exact"}
    );
    expect(textOf(tree.toJSON())).toContain("Summer Fair");
    expect(textOf(tree.toJSON())).not.toContain("Hastings Runners");
  });

  it("requires a reason before opening the confirmation",async()=>{
    installActivities();
    tree=await renderActivities();

    await act(async()=>{
      control(tree,"Hide Hastings Runners").props.onPress();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith("admin_set_activity_state",expect.anything());
    expect(textOf(tree.toJSON())).toContain("Decision reason required");
  });

  it("confirms a hide and changes state through one audited RPC",async()=>{
    installActivities();
    tree=await renderActivities();

    await act(async()=>{
      control(tree,"State-change reason for Hastings Runners","onChangeText")
        .props.onChangeText("The organiser asked for the club to be hidden temporarily.");
    });
    await act(async()=>{
      control(tree,"Hide Hastings Runners").props.onPress();
    });

    expect(confirmButton().style).toBe("destructive");
    await act(async()=>{
      await confirmButton().onPress();
    });

    expect(supabase.rpc).toHaveBeenCalledWith("admin_set_activity_state",{
      p_target_type:"activity_club",
      p_target_id:"club-1",
      p_state:"draft",
      p_reason:"The organiser asked for the club to be hidden temporarily."
    });
    expect(textOf(tree.toJSON())).toContain("Activity state changed");
    expect(textOf(tree.toJSON())).toMatch(/State:\s+Draft/);
  });

  it("shows a load error without stale activity cards",async()=>{
    installActivities({errorTable:"activity_clubs"});
    tree=await renderActivities();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Activities could not be loaded");
    expect(text).toContain("activity_clubs read failed");
    expect(text).not.toContain("Hastings Runners");
  });
});
