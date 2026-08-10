/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {router}=require("expo-router");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminAreas=require("../app/admin/areas").default;

const AREAS=[
  {id:"area-county",name:"East Sussex",area_type:"county",parent_area_id:null,slug:"east-sussex",status:"active"},
  {id:"area-town",name:"Hastings",area_type:"town",parent_area_id:"area-county",slug:"hastings",status:"active"}
];

const UNMATCHED_AREAS=[{
  source_table:"activity_clubs",
  source_column:"location",
  raw_value:"Hastings Old Town",
  normalised_value:"hastings old town",
  row_count:2
}];

const UNMATCHED_PLACES=[{
  place_type:"park",
  raw_value:"Preston Park",
  normalised_value:"preston park",
  row_count:3
}];

const QUALITY={
  ownership_issues:[{
    issue_id:"claim-1",
    issue_type:"approved_claim_mismatch",
    listing_type:"business",
    listing_id:"business-1",
    listing_name:"The Lantern Cafe",
    summary:"Approved claim is not reflected by the business owner or claimed flag.",
    created_at:"2026-08-01T10:00:00Z"
  }],
  missing_area_counts:[
    {source_table:"businesses",row_count:26},
    {source_table:"properties",row_count:9}
  ]
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

function installAreaReports({errorRpc=null}={}){
  const queries=[];

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name)=>{
    if(name==="guestbook_is_admin") return Promise.resolve({data:true,error:null});
    if(name===errorRpc) return Promise.resolve({data:null,error:{message:`${name} failed`}});
    if(name==="get_unmatched_area_report") return Promise.resolve({data:UNMATCHED_AREAS,error:null});
    if(name==="get_unmatched_public_place_report") return Promise.resolve({data:UNMATCHED_PLACES,error:null});
    if(name==="admin_get_data_quality_report") return Promise.resolve({data:QUALITY,error:null});
    return Promise.resolve({data:null,error:null});
  });
  supabase.from.mockImplementation((table)=>{
    const query={table};
    query.select=jest.fn(()=>query);
    query.order=jest.fn(()=>query);
    query.then=(resolve,reject)=>Promise.resolve({data:AREAS,error:null}).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderAreas(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminAreas)));});
  return tree;
}

function control(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
}

describe("Admin Dashboard Stage 7 areas and data quality",()=>{
  let tree;

  beforeEach(()=>jest.clearAllMocks());
  afterEach(async()=>{
    if(tree){
      await act(async()=>tree.unmount());
      tree=null;
    }
  });

  it("loads all read-only reports and renders the known issue without guessing",async()=>{
    const queries=installAreaReports();
    tree=await renderAreas();
    const text=textOf(tree.toJSON());

    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("geo_areas");
    expect(queries[0].select).toHaveBeenCalledWith(
      "id,name,area_type,parent_area_id,slug,status"
    );
    expect(supabase.rpc).toHaveBeenCalledWith("get_unmatched_area_report");
    expect(supabase.rpc).toHaveBeenCalledWith("get_unmatched_public_place_report");
    expect(supabase.rpc).toHaveBeenCalledWith("admin_get_data_quality_report");
    expect(text).toContain("East Sussex");
    expect(text).toContain("Inside East Sussex");
    expect(text).toContain("Hastings Old Town");
    expect(text).toContain("Preston Park");
    expect(text).toContain("35 Rows without a canonical area");
    expect(text).toContain("The Lantern Cafe");
    expect(text).toContain("They never guess an area or repair ownership automatically.");
  });

  it("opens the canonical listing for an ownership issue",async()=>{
    installAreaReports();
    tree=await renderAreas();

    await act(async()=>{
      control(tree,"Open data-quality issue for The Lantern Cafe").props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith("/business/business-1");
  });

  it("shows one honest error instead of partial quality data",async()=>{
    installAreaReports({errorRpc:"admin_get_data_quality_report"});
    tree=await renderAreas();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Data-quality reports could not be loaded");
    expect(text).toContain("admin_get_data_quality_report failed");
    expect(text).not.toContain("The Lantern Cafe");
    expect(text).not.toContain("Preston Park");
  });
});
