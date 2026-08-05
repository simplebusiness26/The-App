/* eslint-env jest */

// Admin Dashboard Stage 3 acceptance tests: one searchable catalogue for every
// listing type an administrator needs to inspect. This screen is deliberately
// read-only. Editing and destructive actions stay on their dedicated screens.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {supabase}=require("../services/supabase");
const {router}=require("expo-router");
const {textOf}=require("./fixture");

const AdminListings=require("../app/admin/listings").default;

const ROWS={
  businesses:[{
    id:"business-1",
    name:"The Lantern Cafe",
    business_type:"cafe",
    category:"cafe",
    address:"1 High Street"
  }],
  properties:[{
    id:"property-1",
    name:"Seaview Stay",
    address:"2 Coast Road"
  }],
  public_places:[{
    id:"place-1",
    name:"Pelham Beach",
    place_type:"beach",
    location_description:"The seafront",
    status:"published"
  }],
  activity_clubs:[{
    id:"club-1",
    name:"Hastings Runners",
    category:"Running",
    location:"Alexandra Park",
    status:"open"
  }],
  events:[{
    id:"event-1",
    name:"Summer Fair",
    category:"Community",
    location:"Town Square",
    status:"published"
  }]
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    element
  );
}

function installCatalogue({errorTable=null}={}){
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
    query.then=(resolve,reject)=>Promise.resolve(
      table===errorTable
        ? {data:null,error:{message:"read failed"}}
        : {data:ROWS[table] || [],error:null}
    ).then(resolve,reject);
    queries.push(query);
    return query;
  });

  return queries;
}

async function renderCatalogue(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminListings)));});
  return tree;
}

function control(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && (
      typeof node.props?.onPress==="function" || typeof node.props?.onChangeText==="function"
    ),
    {deep:true}
  )[0];
}

describe("Admin Dashboard Stage 3 listing catalogue",()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
  });

  it("loads all five listing types using explicit, non-sensitive columns",async()=>{
    const queries=installCatalogue();
    const tree=await renderCatalogue();
    const text=textOf(tree.toJSON());

    expect(text).toContain("5 listings");
    for(const name of [
      "The Lantern Cafe","Seaview Stay","Pelham Beach","Hastings Runners","Summer Fair"
    ]) expect(text).toContain(name);

    expect(queries.map((query)=>query.table)).toEqual([
      "businesses","properties","public_places","activity_clubs","events"
    ]);
    for(const query of queries){
      expect(query.select).toHaveBeenCalledTimes(1);
      const columns=query.select.mock.calls[0][0];
      expect(columns).not.toBe("*");
      expect(columns).not.toContain("owner_id");
      expect(columns).not.toContain("manager_id");
    }

    await act(async()=>{tree.unmount();});
  });

  it("searches across names and listing details",async()=>{
    installCatalogue();
    const tree=await renderCatalogue();

    await act(async()=>{control(tree,"Search admin listings").props.onChangeText("beach");});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Pelham Beach");
    expect(text).not.toContain("The Lantern Cafe");
    expect(text).toContain("1 listing");

    await act(async()=>{tree.unmount();});
  });

  it("filters by listing type and opens the canonical detail route",async()=>{
    installCatalogue();
    const tree=await renderCatalogue();

    await act(async()=>{control(tree,"Show only Events").props.onPress();});
    const text=textOf(tree.toJSON());
    expect(text).toContain("Summer Fair");
    expect(text).not.toContain("Pelham Beach");

    await act(async()=>{control(tree,"Open Summer Fair").props.onPress();});
    expect(router.push).toHaveBeenCalledWith("/events/event-1");

    await act(async()=>{tree.unmount();});
  });

  it("shows one honest error instead of a partial catalogue",async()=>{
    installCatalogue({errorTable:"events"});
    const tree=await renderCatalogue();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Listings could not be loaded");
    expect(text).toContain("Try again");
    expect(text).not.toContain("The Lantern Cafe");
    expect(text).not.toContain("Pelham Beach");

    await act(async()=>{tree.unmount();});
  });
});
