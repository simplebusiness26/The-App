/* eslint-env jest */

// Packet 8e: canonical places, follows, and what a Moment carries.
//
// Each of these was watched failing before it was kept -- against a
// EntityFollowButton that wrote to the wrong table, a public place page with a
// reviews section, an admin screen with its gate removed, and a Moment create
// screen that asked for the device position on mount. A test written after the
// thing it is meant to catch proves nothing, which is the lesson this
// repository has now recorded four times.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {router}=require("expo-router");
const Location=require("expo-location");
const {installFixture,restoreRouterParams,labelsOf,textOf}=require("./fixture");

const EntityFollowButton=require("../components/EntityFollowButton").default;
const places=require("../utils/places");

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

async function render(element){
  let tree;
  await act(async()=>{
    tree=create(wrap(element));
  });
  return tree;
}

// Reads back the builder a given table was handed, the way the endorsement
// tests read social_likes: the assertion is about what the component asked the
// database to do, not about what it drew afterwards.
function lastCallTo(table){
  const calls=supabase.from.mock.calls;
  for(let i=calls.length-1;i>=0;i-=1){
    if(calls[i][0]===table) return supabase.from.mock.results[i].value;
  }
  return null;
}

function pressable(tree,label){
  const hits=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  );
  return hits[0] || null;
}

afterEach(()=>{
  restoreRouterParams();
});

// ---------------------------------------------------------------------------
// The words, before the screens that use them
// ---------------------------------------------------------------------------

describe("the shared vocabulary",()=>{
  it("offers the eight public place types the packet was scoped to",()=>{
    expect(places.PUBLIC_PLACE_TYPES.map((item)=>item.key)).toEqual([
      "park","beach","viewpoint","landmark","public_square","nature_area","attraction","other"
    ]);
  });

  it("makes a park followable and a Link-up not",()=>{
    const followable=places.FOLLOWABLE_ENTITY_TYPES.map((item)=>item.key);
    expect(followable).toContain("public_place");
    expect(followable).not.toContain("linkup");
  });

  it("defaults a Moment to friends, and lists friends first",()=>{
    // RULES.md: a visibility flag defaults to the closed setting. "Everyone,
    // forever" is a thing to choose, not a thing to fail to change.
    expect(places.DEFAULT_MOMENT_VISIBILITY).toBe("friends");
    expect(places.MOMENT_VISIBILITY[0].key).toBe("friends");
  });

  it("rounds a coordinate to three decimal places and refuses nonsense",()=>{
    expect(places.roundCoordinate(50.8552341)).toBe(50.855);
    expect(places.roundCoordinate("0.5729876")).toBe(0.573);
    expect(places.roundCoordinate(null)).toBeNull();
    expect(places.roundCoordinate("not a number")).toBeNull();
  });

  it("returns no route for a place type it does not know",()=>{
    expect(places.entityRoute("public_place","p1")).toBe("/places/p1");
    expect(places.entityRoute("linkup","l1")).toBeNull();
    expect(places.entityRoute("business",null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Following a place, and following a town
// ---------------------------------------------------------------------------

describe("EntityFollowButton",()=>{
  it("writes an entity follow to explorer_entity_follows",async()=>{
    installFixture({
      user:{id:"explorer-1"},
      rpc:{get_entity_follow_stats:[{follower_count:3,viewer_following:false}]}
    });

    const tree=await render(React.createElement(EntityFollowButton,{
      targetType:"public_place",
      targetId:"park-1",
      targetName:"Alexandra Park"
    }));

    await act(async()=>{
      pressable(tree,"Follow this public place").props.onPress();
    });

    const builder=lastCallTo("explorer_entity_follows");
    expect(builder).not.toBeNull();
    expect(builder.insert).toHaveBeenCalledWith({
      follower_id:"explorer-1",
      target_type:"public_place",
      target_id:"park-1"
    });
  });

  it("writes an area follow to explorer_location_follows, keyed by area_id",async()=>{
    // The two tables are not interchangeable: an area follow has a real
    // foreign key to geo_areas and no type discriminator at all.
    installFixture({
      user:{id:"explorer-1"},
      rpc:{get_location_follow_stats:[{follower_count:0,viewer_following:false}]}
    });

    const tree=await render(React.createElement(EntityFollowButton,{
      targetType:"geo_area",
      targetId:"area-1",
      targetName:"Hastings"
    }));

    await act(async()=>{
      pressable(tree,"Follow this area").props.onPress();
    });

    const builder=lastCallTo("explorer_location_follows");
    expect(builder).not.toBeNull();
    expect(builder.insert).toHaveBeenCalledWith({follower_id:"explorer-1",area_id:"area-1"});
    expect(lastCallTo("explorer_entity_follows")).toBeNull();
  });

  it("shows the count from the RPC rather than reading the follow rows",async()=>{
    // A follow row is readable only by the Explorer who made it. A count that
    // came from selecting rows would be zero for everybody else, and asking
    // for the rows at all is asking who follows this place.
    installFixture({
      user:{id:"explorer-1"},
      rpc:{get_entity_follow_stats:[{follower_count:12,viewer_following:true}]}
    });

    const tree=await render(React.createElement(EntityFollowButton,{
      targetType:"business",
      targetId:"biz-1",
      targetName:"The Coffee House"
    }));

    expect(textOf(tree.toJSON())).toContain("Following");
    expect(textOf(tree.toJSON())).toContain("12");
    expect(supabase.rpc).toHaveBeenCalledWith("get_entity_follow_stats",{
      p_target_type:"business",
      p_target_id:"biz-1"
    });
  });

  it("sends a signed-out Explorer to log in instead of writing a follow",async()=>{
    installFixture({user:null,rpc:{get_entity_follow_stats:[{follower_count:1,viewer_following:false}]}});

    const tree=await render(React.createElement(EntityFollowButton,{
      targetType:"event",
      targetId:"event-1",
      targetName:"Pier Fireworks"
    }));

    expect(textOf(tree.toJSON())).toContain("Log in to follow");

    await act(async()=>{
      pressable(tree,"Follow this event").props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith("/auth/login");
    expect(lastCallTo("explorer_entity_follows")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The page a park has instead of a spelling
// ---------------------------------------------------------------------------

describe("the public place page",()=>{
  const park={
    id:"park-1",
    name:"Alexandra Park",
    place_type:"park",
    area_id:"area-1",
    latitude:50.869,
    longitude:0.573,
    location_description:"Main gate on St Helens Road",
    description:"Victorian park with a boating lake.",
    image_url:null,
    status:"published"
  };

  function mountPage(){
    const PublicPlacePage=require("../app/places/[id]").default;
    return render(React.createElement(PublicPlacePage,null));
  }

  it("names the place, its type and its area, and offers both follows",async()=>{
    installFixture({
      user:{id:"explorer-1"},
      params:{id:"park-1"},
      tables:{
        public_places:[park],
        geo_areas:[{id:"area-1",name:"Hastings",area_type:"town",parent_area_id:"county-1"}],
        explorer_moments:[]
      },
      rpc:{
        get_entity_follow_stats:[{follower_count:2,viewer_following:false}],
        get_location_follow_stats:[{follower_count:5,viewer_following:false}]
      }
    });

    const tree=await mountPage();
    const text=textOf(tree.toJSON());
    const labels=labelsOf(tree.toJSON());

    expect(text).toContain("Alexandra Park");
    expect(text).toContain("Park");
    expect(text).toContain("Hastings");
    expect(labels).toContain("Follow this public place");
    expect(labels).toContain("Follow this area");
  });

  it("has no reviews section, because public places have no reviews table",async()=>{
    // The same reasoning 5c applied to link-ups: an empty reviews section
    // invites something the app cannot record. Omitted, not emptied.
    installFixture({
      user:{id:"explorer-1"},
      params:{id:"park-1"},
      tables:{public_places:[park],geo_areas:[],explorer_moments:[]},
      rpc:{get_entity_follow_stats:[{follower_count:0,viewer_following:false}]}
    });

    const tree=await mountPage();
    const text=textOf(tree.toJSON());

    expect(text).not.toContain("No reviews yet");
    expect(text).toContain("No Moments here yet");
  });

  it("says so when the place cannot be loaded",async()=>{
    installFixture({user:null,params:{id:"missing"},tables:{public_places:[]}});

    const tree=await mountPage();
    expect(textOf(tree.toJSON())).toContain("could not be loaded");
  });
});

// ---------------------------------------------------------------------------
// Who may create a public place
// ---------------------------------------------------------------------------

describe("the admin public places screen",()=>{
  function mountAdmin(){
    const AdminPublicPlaces=require("../app/admin/public-places").default;
    return render(React.createElement(AdminPublicPlaces,null));
  }

  it("refuses a non-admin instead of showing them a form",async()=>{
    installFixture({user:{id:"explorer-1"},rpc:{guestbook_is_admin:false}});

    const tree=await mountAdmin();
    const text=textOf(tree.toJSON());

    expect(text).toContain("admin account is required");
    expect(text).not.toContain("Add a place");
  });

  it("gives an admin the form",async()=>{
    installFixture({
      user:{id:"admin-1"},
      tables:{public_places:[],geo_areas:[{id:"area-1",name:"Hastings",area_type:"town"}]},
      rpc:{guestbook_is_admin:true}
    });

    const tree=await mountAdmin();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Add a place");
    expect(text).toContain("Hastings");
  });
});

// ---------------------------------------------------------------------------
// The Moment create screen
// ---------------------------------------------------------------------------

describe("creating a Moment",()=>{
  function mountCreate(){
    const CreateMoment=require("../app/moments/create").default;
    return render(React.createElement(CreateMoment,null));
  }

  it("asks who can see it, and offers friends as well as public",async()=>{
    installFixture({user:{id:"explorer-1"},tables:{profiles:[{account_type:"explorer"}]}});

    const tree=await mountCreate();
    const labels=labelsOf(tree.toJSON());

    expect(textOf(tree.toJSON())).toContain("Who can see this");
    expect(labels).toContain("Friends: Explorers you follow who follow you back");
    expect(labels).toContain("Public: Any Explorer, and it can appear in discovery");
  });

  it("never reads the device position on its own",async()=>{
    // The location control is an explicit, reversible tap. A Moment carries a
    // location because somebody pressed a button that says so.
    installFixture({user:{id:"explorer-1"},tables:{profiles:[{account_type:"explorer"}]}});

    await mountCreate();

    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("offers no official identity when nothing is attached",async()=>{
    // Tagging a business is not being one, and there is nothing to speak as
    // until a listing the viewer manages is actually selected.
    installFixture({user:{id:"explorer-1"},tables:{profiles:[{account_type:"explorer"}]}});

    const tree=await mountCreate();

    expect(textOf(tree.toJSON())).not.toContain("Post as");
  });
});
