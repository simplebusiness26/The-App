/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminAudit=require("../app/admin/audit").default;

const AUDIT_ROWS=[
  {
    id:"audit-1",
    actor_id:"admin-1",
    action:"claim.approved",
    target_type:"business",
    target_id:"business-1",
    reason:"Ownership documents were verified.",
    created_at:"2026-08-09T10:00:00Z"
  },
  {
    id:"audit-2",
    actor_id:"admin-2",
    action:"report.dismissed",
    target_type:"social_report",
    target_id:"report-1",
    reason:"The content does not breach the community rules.",
    created_at:"2026-08-09T09:00:00Z"
  }
];

const ACTORS=[
  {id:"admin-1",full_name:"Alex Admin"},
  {id:"admin-2",full_name:"Sam Admin"}
];

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

function installAudit({errorTable=null,total=2}={}){
  const queries=[];

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name)=>Promise.resolve({
    data:name==="guestbook_is_admin" ? true : null,
    error:null
  }));
  supabase.from.mockImplementation((table)=>{
    const query={table};
    query.select=jest.fn(()=>query);
    query.order=jest.fn(()=>query);
    query.range=jest.fn(()=>query);
    query.in=jest.fn(()=>query);
    query.then=(resolve,reject)=>Promise.resolve(
      table===errorTable
        ? {data:null,count:null,error:{message:`${table} read failed`}}
        : table==="admin_audit_log"
          ? {data:AUDIT_ROWS,count:total,error:null}
          : {data:ACTORS,error:null}
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderAudit(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminAudit)));});
  return tree;
}

function control(tree,label,handler="onPress"){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.[handler]==="function",
    {deep:true}
  )[0];
}

describe("Admin Dashboard Stage 7 audit history",()=>{
  let tree;

  beforeEach(()=>jest.clearAllMocks());
  afterEach(async()=>{
    if(tree){
      await act(async()=>tree.unmount());
      tree=null;
    }
  });

  it("loads an explicit-column, paginated page and batches safe actor names",async()=>{
    const queries=installAudit({total:30});
    tree=await renderAudit();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Claim Approved");
    expect(text).toContain("Alex Admin");
    expect(text).toContain("Ownership documents were verified.");
    expect(text).toContain("30 records · Page 1 of 2");
    expect(queries.map((query)=>query.table)).toEqual(["admin_audit_log","profiles"]);
    expect(queries[0].select).toHaveBeenCalledWith(
      "id,actor_id,action,target_type,target_id,reason,created_at",
      {count:"exact"}
    );
    expect(queries[0].select.mock.calls[0][0]).not.toContain("details");
    expect(queries[0].range).toHaveBeenCalledWith(0,24);
    expect(queries[1].select).toHaveBeenCalledWith("id,full_name");
    expect(queries[1].in).toHaveBeenCalledWith("id",["admin-1","admin-2"]);

    await act(async()=>{control(tree,"Next audit page").props.onPress();});
    expect(queries[2].range).toHaveBeenCalledWith(25,49);
  });

  it("searches only the loaded audit page",async()=>{
    installAudit();
    tree=await renderAudit();

    await act(async()=>{
      control(tree,"Search audit history","onChangeText").props.onChangeText("dismissed");
    });

    expect(textOf(tree.toJSON())).toContain("Report Dismissed");
    expect(textOf(tree.toJSON())).not.toContain("Claim Approved");
  });

  it("shows one load error without partial audit records",async()=>{
    installAudit({errorTable:"profiles"});
    tree=await renderAudit();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Audit history could not be loaded");
    expect(text).toContain("profiles read failed");
    expect(text).not.toContain("Ownership documents were verified.");
  });
});
