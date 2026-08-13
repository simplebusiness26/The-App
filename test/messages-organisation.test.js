/* eslint-env jest */

// All | Friends | Managers | Message Boards.
//
// The thing most worth guarding here is not the filtering. It is that none of
// this reintroduces a Manager ACCOUNT. Manager is a capability an Explorer
// holds per listing -- 20260803120000 retired the parallel account type, and
// utils/permissions.js has a long note about the damage it did. A "Managers"
// tab is exactly the shape of change that quietly brings it back.
//
// So: the Managers tab is a filter over conversations about listings, the same
// Explorer can be on either side of one, and nothing anywhere asks "is this
// person a manager".

const React=require("react");
const {act,create}=require("react-test-renderer");
const {supabase}=require("../services/supabase");
const {installFixture}=require("./fixture");
const {router}=require("expo-router");

const views=require("../utils/messageViews");

function textOf(node){
  if(node===null||node===undefined||typeof node==="boolean") return "";
  if(typeof node==="string"||typeof node==="number") return String(node);
  if(Array.isArray(node)) return node.map(textOf).join(" ");
  if(node.children!==undefined) return textOf(node.children);
  return "";
}

function tab(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityRole==="tab"
      && String(node.props?.accessibilityLabel || "").startsWith(label),
    {deep:true}
  )[0] || null;
}

const CONVERSATIONS=[
  {conversation_id:"c-friend",kind:"friend",target_type:null,target_id:null,target_name:null,
   viewer_is_manager:false,other_id:"u2",other_name:"Sam Okoro",other_photo:null,
   last_message:"See you Saturday",last_message_at:"2026-08-13T10:00:00Z",unread_count:2},
  {conversation_id:"c-mine",kind:"listing",target_type:"business",target_id:"b1",target_name:"Bottle Alley Coffee",
   viewer_is_manager:true,other_id:"u3",other_name:"Priya Shah",other_photo:null,
   last_message:"Are you open Sunday?",last_message_at:"2026-08-13T09:00:00Z",unread_count:1},
  {conversation_id:"c-theirs",kind:"listing",target_type:"property",target_id:"p1",target_name:"Marine Court Flat",
   viewer_is_manager:false,other_id:"u4",other_name:"Alex Reid",other_photo:null,
   last_message:"Yes, still available",last_message_at:"2026-08-13T08:00:00Z",unread_count:0}
];

const BOARDS=[
  {board_kind:"linkup",board_id:"l1",title:"Sunday kickabout",subtitle:"Hastings",
   last_message:"Bring a bib",last_message_at:"2026-08-13T11:00:00Z",route:"/linkups/board/l1"},
  {board_kind:"activity_club",board_id:"a1",title:"Coastal Camera Club",subtitle:"St Leonards",
   last_message:null,last_message_at:null,route:"/activity-clubs/message-board/a1"}
];

async function mount(){
  const Screen=require("../app/messages/index").default;
  let tree;
  await act(async()=>{tree=create(React.createElement(Screen));});
  await act(async()=>{});
  return tree;
}

function installRpc({conversations=CONVERSATIONS,boards=BOARDS,boardError=null}={}){
  installFixture({user:{id:"me"},tables:{},rpc:{}});
  supabase.rpc.mockImplementation((name)=>{
    if(name==="get_conversations") return Promise.resolve({data:conversations,error:null});
    if(name==="get_message_boards") return Promise.resolve({data:boardError ? null : boards,error:boardError});
    return Promise.resolve({data:null,error:null});
  });
}

// -- the rules, with no rendering ------------------------------------------

test("Friends is friend conversations; Managers is conversations about a listing",()=>{
  expect(views.conversationsFor("friends",CONVERSATIONS).map((r)=>r.conversation_id))
    .toEqual(["c-friend"]);
  expect(views.conversationsFor("managers",CONVERSATIONS).map((r)=>r.conversation_id))
    .toEqual(["c-mine","c-theirs"]);
  expect(views.conversationsFor("all",CONVERSATIONS).length).toBe(3);
});

test("both sides of a listing conversation are Manager conversations",()=>{
  // THE ASSERTION ABOUT ACCOUNT TYPES. One of these the viewer manages and one
  // they do not, and both belong in the tab -- because the tab is about the
  // subject of the conversation, not about what kind of account anybody has.
  const managers=views.conversationsFor("managers",CONVERSATIONS);
  expect(managers.some((r)=>r.viewer_is_manager===true)).toBe(true);
  expect(managers.some((r)=>r.viewer_is_manager===false)).toBe(true);
});

test("the subtitle says which side you are on, and names the listing",()=>{
  expect(views.listingSubtitle(CONVERSATIONS[1],"Business")).toBe("You manage Bottle Alley Coffee");
  expect(views.listingSubtitle(CONVERSATIONS[2],"Property")).toBe("About Marine Court Flat");
  // A listing whose name could not be read still says something true.
  expect(views.listingSubtitle({kind:"listing",viewer_is_manager:false,target_name:null},"Event"))
    .toBe("About a event");
  expect(views.listingSubtitle(CONVERSATIONS[0],"Business")).toBe("");
});

test("Message Boards holds no conversations at all",()=>{
  expect(views.conversationsFor("boards",CONVERSATIONS)).toEqual([]);
});

test("nothing in the view rules asks whether a PERSON is a manager",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","utils","messageViews.js"),"utf8"
  );
  const code=source.split("\n").filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

  // The shapes of the retired model.
  expect(code).not.toMatch(/account_type/);
  expect(code).not.toMatch(/isManagerAccount|managerAccount|role\s*===/);
});

// -- the screen -------------------------------------------------------------

test("opens on All, showing every conversation",async()=>{
  installRpc();
  const tree=await mount();
  const text=textOf(tree.toJSON());

  expect(text).toContain("Sam Okoro");
  expect(text).toContain("Priya Shah");
  expect(text).toContain("Alex Reid");
});

test("Friends hides the listing conversations",async()=>{
  installRpc();
  const tree=await mount();

  await act(async()=>{tab(tree,"Friends").props.onPress();});
  const text=textOf(tree.toJSON());

  expect(text).toContain("Sam Okoro");
  expect(text).not.toContain("Priya Shah");
  expect(text).not.toContain("Alex Reid");
});

test("Managers shows both listing conversations and names the places",async()=>{
  installRpc();
  const tree=await mount();

  await act(async()=>{tab(tree,"Managers").props.onPress();});
  const text=textOf(tree.toJSON());

  expect(text).not.toContain("Sam Okoro");
  expect(text).toContain("You manage Bottle Alley Coffee");
  expect(text).toContain("About Marine Court Flat");
});

test("Message Boards lists the boards the database returned, and opens one",async()=>{
  installRpc();
  const tree=await mount();

  await act(async()=>{tab(tree,"Message Boards").props.onPress();});
  const text=textOf(tree.toJSON());

  expect(text).toContain("Sunday kickabout");
  expect(text).toContain("Coastal Camera Club");
  // No conversation leaks into the boards tab.
  expect(text).not.toContain("Sam Okoro");

  const open=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Open the Sunday kickabout board"
      && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
  await act(async()=>{open.props.onPress();});
  expect(router.push).toHaveBeenCalledWith("/linkups/board/l1");
});

test("a board the database did not return cannot appear",async()=>{
  // The screen shows what get_message_boards gave it and nothing else. That
  // function re-derives the boards' own read conditions, so an unauthorised
  // board is absent from the list rather than filtered out here -- there is no
  // client-side membership check to get wrong.
  installRpc({boards:[BOARDS[0]]});
  const tree=await mount();

  await act(async()=>{tab(tree,"Message Boards").props.onPress();});
  const text=textOf(tree.toJSON());

  expect(text).toContain("Sunday kickabout");
  expect(text).not.toContain("Coastal Camera Club");
});

test("a board list that fails does not take the inbox down with it",async()=>{
  installRpc({boardError:{message:"nope"}});
  const tree=await mount();

  // The inbox still works.
  expect(textOf(tree.toJSON())).toContain("Sam Okoro");

  await act(async()=>{tab(tree,"Message Boards").props.onPress();});
  expect(textOf(tree.toJSON())).toContain("message boards could not be loaded");
});

test("the tabs carry the unread count for what they contain",async()=>{
  installRpc();
  const tree=await mount();

  // 2 on the friend thread, 1 on a listing thread.
  expect(tab(tree,"All").props.accessibilityLabel).toBe("All, 3 unread");
  expect(tab(tree,"Friends").props.accessibilityLabel).toBe("Friends, 2 unread");
  expect(tab(tree,"Managers").props.accessibilityLabel).toBe("Managers, 1 unread");
});

test("boards and conversations are fetched in one round trip each, not per row",async()=>{
  installRpc();
  await mount();

  const names=supabase.rpc.mock.calls.map((call)=>call[0]);
  expect(names.filter((n)=>n==="get_conversations").length).toBe(1);
  expect(names.filter((n)=>n==="get_message_boards").length).toBe(1);
});
