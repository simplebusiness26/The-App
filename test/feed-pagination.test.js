/* eslint-env jest */

// The feed loads a page at a time now. These are the ways that goes wrong.
//
// The old screen asked for p_limit:40, p_offset:0 and rendered all forty into a
// ScrollView. The failure modes of the replacement are all invisible in a
// screenshot and all obvious in a test: a second request firing while the first
// is in flight, a page appending rows it already has, requests continuing past
// the end of the feed, and a failed page wiping the rows already on screen.
//
// test/fixture.js mocks supabase.rpc by NAME and ignores its arguments, which
// would hand every page the same array back for ever. So these drive the mock
// directly and assert on the cursor the screen sends.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {installFixture}=require("./fixture");

const PAGE_SIZE=20;

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,
      React.createElement(NotificationProvider,null,element))
  );
}

// A page of n rows whose created_at descends, so a real cursor can be taken
// from the last one.
function page(startIndex,count){
  return Array.from({length:count},(_,i)=>{
    const n=startIndex+i;
    return {
      item_id:`item-${n}`,
      item_type:"moment",
      actor_id:"actor-1",
      actor_name:"Sam Okoro",
      created_at:new Date(Date.UTC(2026,7,13,12,0,0)-n*60000).toISOString(),
      caption:`Post ${n}`,
      like_count:0,
      comment_count:0,
      viewer_liked:false,
      source_reasons:[]
    };
  });
}

// Every get_explorer_social_feed call the screen made, as its argument object.
function feedCalls(){
  return supabase.rpc.mock.calls
    .filter((call)=>call[0]==="get_explorer_social_feed")
    .map((call)=>call[1]);
}

function textOf(node){
  if(node===null||node===undefined||typeof node==="boolean") return "";
  if(typeof node==="string"||typeof node==="number") return String(node);
  if(Array.isArray(node)) return node.map(textOf).join(" ");
  if(node.children!==undefined) return textOf(node.children);
  return "";
}

function rowKeys(tree){
  // Each card is found by the profile press its actor row carries; one per row.
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===undefined && typeof node.props?.onPress==="function",
    {deep:true}
  ).length;
}

// Every tree this file makes, so it can be taken down again.
//
// FlatList is a VirtualizedList, and a VirtualizedList schedules a timer to
// work out which rows to keep mounted. Left mounted, that timer fires after
// Jest has torn the test environment down, which makes the RUN exit 1 while
// every test still passes -- the exact shape of the CI failure this project
// had a week ago, and the reason the exit code is now checked rather than the
// summary line.
const trees=[];

afterEach(async()=>{
  for(const tree of trees.splice(0)){
    await act(async()=>{tree.unmount();});
  }
});

async function mount(){
  const Feed=require("../app/feed").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Feed)));});
  await act(async()=>{});
  trees.push(tree);
  return tree;
}

// The FlatList the screen renders, so a test can fire onEndReached the way
// scrolling would.
function list(tree){
  return tree.root.findAll(
    (node)=>typeof node.props?.onEndReached==="function" && Array.isArray(node.props?.data),
    {deep:true}
  )[0];
}

beforeEach(()=>{
  installFixture({user:{id:"me"},tables:{},rpc:{}});
});

test("asks for a bounded first page, not the whole feed",async()=>{
  supabase.rpc.mockImplementation((name)=>Promise.resolve(
    name==="get_explorer_social_feed" ? {data:page(0,PAGE_SIZE),error:null} : {data:null,error:null}
  ));

  await mount();

  const calls=feedCalls();
  expect(calls.length).toBe(1);
  expect(calls[0].p_limit).toBe(PAGE_SIZE);
  expect(calls[0].p_limit).toBeLessThanOrEqual(25);
  // The first page carries no cursor.
  expect(calls[0].p_before).toBeNull();
  expect(calls[0].p_before_id).toBeNull();
});

test("the next page is asked for with the last row as the cursor, and appends",async()=>{
  let call=0;
  supabase.rpc.mockImplementation((name)=>{
    if(name!=="get_explorer_social_feed") return Promise.resolve({data:null,error:null});
    call+=1;
    return Promise.resolve({data:call===1 ? page(0,PAGE_SIZE) : page(PAGE_SIZE,PAGE_SIZE),error:null});
  });

  const tree=await mount();
  expect(list(tree).props.data.length).toBe(PAGE_SIZE);

  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});

  const calls=feedCalls();
  expect(calls.length).toBe(2);
  // The cursor is the OLDEST row held, not the newest -- the newest would
  // re-serve almost the whole page.
  const first=page(0,PAGE_SIZE);
  expect(calls[1].p_before).toBe(first[first.length-1].created_at);
  expect(calls[1].p_before_id).toBe(first[first.length-1].item_id);

  // Appended, not replaced.
  expect(list(tree).props.data.length).toBe(PAGE_SIZE*2);
  expect(list(tree).props.data[0].item_id).toBe("item-0");
});

test("a page repeating rows we already hold cannot duplicate them",async()=>{
  let call=0;
  supabase.rpc.mockImplementation((name)=>{
    if(name!=="get_explorer_social_feed") return Promise.resolve({data:null,error:null});
    call+=1;
    // Page two overlaps page one by half. The keyset should make this
    // impossible; the screen must survive it anyway.
    return Promise.resolve({data:call===1 ? page(0,PAGE_SIZE) : page(PAGE_SIZE/2,PAGE_SIZE),error:null});
  });

  const tree=await mount();
  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});

  const keys=list(tree).props.data.map((row)=>`${row.item_type}-${row.item_id}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys.length).toBe(PAGE_SIZE+PAGE_SIZE/2);
});

test("two onEndReached in one frame produce one request, not two",async()=>{
  supabase.rpc.mockImplementation((name)=>Promise.resolve(
    name==="get_explorer_social_feed" ? {data:page(0,PAGE_SIZE),error:null} : {data:null,error:null}
  ));

  const tree=await mount();

  await act(async()=>{
    list(tree).props.onEndReached();
    list(tree).props.onEndReached();
    list(tree).props.onEndReached();
  });
  await act(async()=>{});

  // One first page, one next page. Not four.
  expect(feedCalls().length).toBe(2);
});

test("a short page means the end, and no further requests are made",async()=>{
  supabase.rpc.mockImplementation((name)=>Promise.resolve(
    // Fewer rows than asked for: there is no more.
    name==="get_explorer_social_feed" ? {data:page(0,4),error:null} : {data:null,error:null}
  ));

  const tree=await mount();
  expect(feedCalls().length).toBe(1);

  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});
  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});

  expect(feedCalls().length).toBe(1);
});

test("an empty next page stops the requests without emptying the list",async()=>{
  let call=0;
  supabase.rpc.mockImplementation((name)=>{
    if(name!=="get_explorer_social_feed") return Promise.resolve({data:null,error:null});
    call+=1;
    return Promise.resolve({data:call===1 ? page(0,PAGE_SIZE) : [],error:null});
  });

  const tree=await mount();
  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});

  expect(list(tree).props.data.length).toBe(PAGE_SIZE);

  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});
  expect(feedCalls().length).toBe(2);
});

test("a failed later page keeps everything already loaded, and offers a retry",async()=>{
  let call=0;
  supabase.rpc.mockImplementation((name)=>{
    if(name!=="get_explorer_social_feed") return Promise.resolve({data:null,error:null});
    call+=1;
    if(call===1) return Promise.resolve({data:page(0,PAGE_SIZE),error:null});
    if(call===2) return Promise.resolve({data:null,error:{message:"network"}});
    return Promise.resolve({data:page(PAGE_SIZE,PAGE_SIZE),error:null});
  });

  const tree=await mount();
  await act(async()=>{list(tree).props.onEndReached();});
  await act(async()=>{});

  // THE ASSERTION THAT MATTERS: the twenty rows already on screen survived the
  // twenty-first failing.
  expect(list(tree).props.data.length).toBe(PAGE_SIZE);

  const retry=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Try loading more posts again" && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
  expect(retry).toBeDefined();

  await act(async()=>{retry.props.onPress();});
  await act(async()=>{});
  expect(list(tree).props.data.length).toBe(PAGE_SIZE*2);
});

test("a failed FIRST page shows the feed-unavailable state",async()=>{
  supabase.rpc.mockImplementation((name)=>Promise.resolve(
    name==="get_explorer_social_feed" ? {data:null,error:{message:"network"}} : {data:null,error:null}
  ));

  const tree=await mount();
  expect(textOf(tree.toJSON())).toContain("Feed unavailable");
  expect(list(tree).props.data.length).toBe(0);
});

test("the feed is a virtualised list, not a ScrollView holding every row",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","app","feed.js"),"utf8"
  );

  // The specific thing that made it slow: every row mounted at once.
  expect(source).toContain("FlatList");
  expect(source).not.toMatch(/<ScrollView/);
  expect(source).toContain("keyExtractor");
  expect(source).toContain("onEndReached");
});

test("the feed does not make one auth call per row",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  // LikeButton is rendered once per Moment and Memory. It used to call
  // auth.getUser() in its own effect, so a page of twenty fired twenty
  // round trips for one answer the screen already had.
  // Comments stripped first: the file explains at length that it USED to call
  // auth.getUser(), and that explanation is worth keeping. What must be gone is
  // the call.
  const strip=(source)=>source
    .split("\n")
    .filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  const likeButton=strip(fs.readFileSync(path.join(root,"components","LikeButton.js"),"utf8"));
  expect(likeButton).not.toMatch(/supabase\.auth\.getUser/);
  expect(likeButton).toMatch(/viewerId/);

  // And the row is handed the answer instead.
  const card=fs.readFileSync(path.join(root,"components","FeedCard.js"),"utf8");
  expect(card).toMatch(/viewerId=\{viewerId\}/);
});
