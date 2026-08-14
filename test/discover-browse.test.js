/* eslint-env jest */

// Discover, now that browsing is its job.
//
// The map's filter row had a List button. The owner: that "should be the
// Discover page's job" -- so it came off the map, and three things had to
// arrive here with it.
//
//   A SEARCH BAR, because a browse surface you cannot search is a worse map.
//   SEE ON THE MAP, because sending somebody here has to be reversible.
//   CAROUSELS, because seven sections of six stacked boxes is forty-two boxes
//   and the owner's word for that was "too long".

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {router}=require("expo-router");

const BUSINESSES=[
  {id:"b1",name:"The Lamb and Flag",category:"food_and_drink",business_type:"pub",claimed:true,
   address:"1 Pier Road",image:"https://example.test/lamb.jpg",photos:[],latitude:50.822,longitude:-0.137},
  {id:"b2",name:"Bean There",category:"food_and_drink",business_type:"cafe",claimed:true,
   address:"3 High Street",image:null,photos:[],latitude:50.823,longitude:-0.138}
];

const CLUBS=[{id:"c1",name:"Sea Swimmers",category:"Outdoors",location:"West Beach",address:"",
  status:"open",image_url:null,latitude:50.8221,longitude:-0.1371}];

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

function fixture({user={id:"me"}}={}){
  installFixture({
    user,
    tables:{
      profiles:[{id:"me",area:"Brighton"}],
      businesses:BUSINESSES,
      properties:[],
      activity_clubs:CLUBS,
      events:[],
      linkups:[],
      explorer_favourites:[],
      explorer_reviews:[]
    },
    rpc:{get_live_discovery:[]}
  });
}

async function render(){
  const Discover=require("../app/discover").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Discover)));});
  await act(async()=>{});
  return tree;
}

function control(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label,
    {deep:true}
  )[0] || null;
}

async function type(tree,term){
  const box=control(tree,"Search businesses, stays or clubs");
  await act(async()=>{box.props.onChangeText(term);});
  // The search is debounced by 250ms, and every reply checks it is still the
  // one being waited for.
  await act(async()=>{jest.advanceTimersByTime(300);});
  await act(async()=>{});
}

beforeEach(()=>{jest.useFakeTimers();});
afterEach(()=>{jest.useRealTimers();restoreRouterParams();});

// ---------------------------------------------------------------------------
// The search bar
// ---------------------------------------------------------------------------

test("there is a search bar, and a way back to the map",async()=>{
  fixture();
  const tree=await render();

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels).toContain("Search businesses, stays or clubs");
  expect(labels).toContain("See all of this on the map");

  await act(async()=>{tree.unmount();});
});

test("one letter is not a search",async()=>{
  // Every keystroke firing a query across three tables is how a search box
  // becomes the slowest thing on a screen.
  fixture();
  const tree=await render();
  const {supabase}=require("../services/supabase");

  supabase.from.mockClear();
  await type(tree,"L");

  for(const call of supabase.from.mock.calls){
    expect(call[0]).not.toBe("properties");
  }

  await act(async()=>{tree.unmount();});
});

test("searching finds a business by name and says why it is showing",async()=>{
  fixture();
  const tree=await render();

  await type(tree,"Lamb");

  const text=textOf(tree.toJSON());
  expect(text).toContain("The Lamb and Flag");
  // The reason is never optional on this screen -- utils/discover.js drops any
  // item without one, and a search result's reason is that it matched.
  expect(text).toContain('Matches "Lamb"');

  await act(async()=>{tree.unmount();});
});

test("results replace the recommendations rather than sitting under them",async()=>{
  // Somebody who has typed a name is asking one question. Leaving seven
  // carousels of things they did not ask for under the answer is the screen
  // talking over them.
  fixture();
  const tree=await render();

  expect(textOf(tree.toJSON())).toContain("Happening now");

  await type(tree,"Lamb");
  expect(textOf(tree.toJSON())).not.toContain("Happening now");

  // Clearing it brings them back.
  await act(async()=>{control(tree,"Search businesses, stays or clubs").props.onChangeText("");});
  await act(async()=>{});
  expect(textOf(tree.toJSON())).toContain("Happening now");

  await act(async()=>{tree.unmount();});
});

test("it searches the same three tables the map draws",async()=>{
  // Searching here and searching there must not disagree about what exists.
  fixture();
  const tree=await render();
  const {supabase}=require("../services/supabase");

  supabase.from.mockClear();
  await type(tree,"Lamb");

  const asked=supabase.from.mock.calls.map((call)=>call[0]);
  expect(asked).toContain("businesses");
  expect(asked).toContain("properties");
  expect(asked).toContain("activity_clubs");

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// See on the map
// ---------------------------------------------------------------------------

test("a card sends the map to that place, not just to the map",async()=>{
  fixture();
  const tree=await render();
  await type(tree,"Lamb");

  router.push.mockClear();
  const seeIt=control(tree,"See The Lamb and Flag on the map");
  expect(seeIt).toBeTruthy();

  await act(async()=>{seeIt.props.onPress();});

  expect(router.push).toHaveBeenCalledWith("/map?lat=50.822&lng=-0.137");

  await act(async()=>{tree.unmount();});
});

test("tapping the card itself opens the place, not the map",async()=>{
  fixture();
  const tree=await render();
  await type(tree,"Lamb");

  router.push.mockClear();
  await act(async()=>{
    control(tree,'The Lamb and Flag. Matches "Lamb".').props.onPress();
  });

  expect(router.push).toHaveBeenCalledWith("/business/b1");

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// The cards
// ---------------------------------------------------------------------------

test("a place with no photo gets its own pin, never somebody else's photograph",async()=>{
  // A generic image of somewhere else would be the app telling a small lie
  // about a real place, every time it drew the card.
  const DiscoverCard=require("../components/DiscoverCard").default;
  const {markerForBusiness}=require("../utils/markers");

  let tree;
  await act(async()=>{
    tree=create(React.createElement(DiscoverCard,{item:{
      id:"business-b2",
      title:"Bean There",
      subtitle:"Cafe",
      reason:"Matches",
      image:null,
      marker:markerForBusiness(BUSINESSES[1]),
      route:"/business/b2"
    }}));
  });

  const drawn=JSON.stringify(tree.toJSON());
  expect(drawn).not.toContain("http");

  await act(async()=>{tree.unmount();});
});

test("no map button on something with nowhere to go",async()=>{
  const DiscoverCard=require("../components/DiscoverCard").default;

  let tree;
  await act(async()=>{
    tree=create(React.createElement(DiscoverCard,{item:{
      id:"linkup-1",title:"Sunset swim",reason:"Starts soon",route:"/linkups/1"
    }}));
  });

  expect(labelsOf(tree.toJSON()).join(" ")).not.toContain("on the map");

  await act(async()=>{tree.unmount();});
});

test("no score at all rather than a zero nobody earned",async()=>{
  const DiscoverCard=require("../components/DiscoverCard").default;

  let tree;
  await act(async()=>{
    tree=create(React.createElement(DiscoverCard,{item:{
      id:"business-b2",title:"Bean There",reason:"Matches",
      rating:{average:null,count:0},route:"/business/b2"
    }}));
  });

  expect(textOf(tree.toJSON())).not.toContain("★");

  await act(async()=>{tree.unmount();});
});

test("the sections are a vertical index, and the map keeps no list of its own",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  // Design round r001-a ("The Gazetteer"), directive 5: every horizontal
  // carousel is replaced by a stacked vertical index -- this assertion now
  // tracks that markup instead of the carousel it replaced.
  const discover=fs.readFileSync(path.join(root,"app","discover.js"),"utf8");
  expect(discover).toMatch(/<DiscoverSection/);
  expect(discover).not.toMatch(/<DiscoverCarousel/);
  expect(discover).not.toMatch(/ScrollView\s+horizontal/);

  // The List button is off the map's filter row for good.
  const map=fs.readFileSync(path.join(root,"components","LivingMapScreen.js"),"utf8");
  expect(map).not.toMatch(/Show a list instead of the map/);
});
