/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {router}=require("expo-router");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminExplorers=require("../app/admin/explorers").default;

const PROFILES=[
  {id:"explorer-1",full_name:"Alex Rivers",is_admin:false,account_type:"explorer"},
  {id:"explorer-2",full_name:"Sam Coast",is_admin:true,account_type:"explorer"},
  {id:"explorer-3",full_name:"Robin Fields",is_admin:false,account_type:"explorer"}
];

const CAPABILITIES=[{
  user_id:"explorer-1",
  businesses_status:"active",
  properties_status:"inactive",
  activity_clubs_status:"trial",
  events_status:"inactive"
}];

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

function installDirectory({errorTable=null,total=3}={}){
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
        : table==="profiles"
          ? {data:PROFILES,count:total,error:null}
          : {data:CAPABILITIES,error:null}
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderDirectory(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminExplorers)));});
  return tree;
}

function control(tree,label,handler="onPress"){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.[handler]==="function",
    {deep:true}
  )[0];
}

describe("Admin Dashboard Stage 6 Explorer directory",()=>{
  let tree;

  beforeEach(()=>jest.clearAllMocks());
  afterEach(async()=>{
    if(tree){
      await act(async()=>tree.unmount());
      tree=null;
    }
  });

  it("loads one explicit-column page and batches Manager capabilities",async()=>{
    const queries=installDirectory({total:30});
    tree=await renderDirectory();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Alex Rivers");
    expect(text).toContain("Sam Coast");
    expect(text).toContain("Manager capabilities: Businesses, Activity Clubs");
    expect(text).toContain("30 Explorers · Page 1 of 2");
    expect(queries.map((query)=>query.table)).toEqual(["profiles","manager_capabilities"]);
    expect(queries[0].select).toHaveBeenCalledWith(
      "id,full_name,is_admin,account_type",
      {count:"exact"}
    );
    expect(queries[0].range).toHaveBeenCalledWith(0,24);
    expect(queries[1].select).toHaveBeenCalledWith(
      "user_id,businesses_status,properties_status,activity_clubs_status,events_status"
    );
    expect(queries[1].in).toHaveBeenCalledWith(
      "user_id",
      ["explorer-1","explorer-2","explorer-3"]
    );

    await act(async()=>{control(tree,"Next Explorer page").props.onPress();});
    expect(queries[2].range).toHaveBeenCalledWith(25,49);
  });

  it("searches and filters only the loaded safe directory page",async()=>{
    installDirectory();
    tree=await renderDirectory();

    await act(async()=>{
      control(tree,"Search Explorer directory","onChangeText").props.onChangeText("Sam");
    });
    expect(textOf(tree.toJSON())).toContain("Sam Coast");
    expect(textOf(tree.toJSON())).not.toContain("Alex Rivers");

    await act(async()=>{
      control(tree,"Search Explorer directory","onChangeText").props.onChangeText("");
      control(tree,"Show Managers in Explorer directory").props.onPress();
    });
    expect(textOf(tree.toJSON())).toContain("Alex Rivers");
    expect(textOf(tree.toJSON())).not.toContain("Sam Coast");
  });

  it("opens the canonical Explorer profile",async()=>{
    installDirectory();
    tree=await renderDirectory();

    await act(async()=>{
      control(tree,"Open Explorer profile for Alex Rivers").props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith("/profile/explorer-1");
  });

  it("shows one load error without a partial directory",async()=>{
    installDirectory({errorTable:"manager_capabilities"});
    tree=await renderDirectory();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Explorers could not be loaded");
    expect(text).toContain("manager_capabilities read failed");
    expect(text).not.toContain("Alex Rivers");
  });
});
