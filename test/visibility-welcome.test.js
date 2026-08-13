/* eslint-env jest */

// The prompt a new Explorer gets, and the four things it must never do.
//
// It exists because profiles.visibility starts at 'nobody' -- correctly -- and
// nothing told anybody. It is also the most dangerous kind of component to add
// to this app, because a prompt about a privacy setting is one careless line
// away from being a prompt that CHANGES a privacy setting. So the assertions
// below are mostly about restraint:
//
//   1. it appears when onboarding_seen_at is null
//   2. it never appears again once that is set
//   3. neither button writes visibility -- only onboarding_seen_at
//   4. a failed or empty profile read shows nothing rather than a stuck modal

const React=require("react");
const {act,create}=require("react-test-renderer");
const {supabase}=require("../services/supabase");
const {installFixture}=require("./fixture");
const {router}=require("expo-router");

const VisibilityWelcome=require("../components/VisibilityWelcome").default;

function textOf(node){
  if(node===null||node===undefined||typeof node==="boolean") return "";
  if(typeof node==="string"||typeof node==="number") return String(node);
  if(Array.isArray(node)) return node.map(textOf).join(" ");
  if(node.children!==undefined) return textOf(node.children);
  if(node.props?.children!==undefined) return textOf(node.props.children);
  return "";
}

function byLabel(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  )[0] || null;
}

async function render(){
  let tree;
  await act(async()=>{tree=create(React.createElement(VisibilityWelcome));});
  await act(async()=>{});
  return tree;
}

// Every write the component made to `profiles`, as the objects it passed.
function profileWrites(){
  const calls=supabase.from.mock.calls;
  const writes=[];

  calls.forEach((call,index)=>{
    if(call[0]!=="profiles") return;
    const builder=supabase.from.mock.results[index].value;
    for(const update of builder.update.mock.calls) writes.push(update[0]);
  });

  return writes;
}

test("appears for an Explorer who has never been told, and says they are invisible",async()=>{
  installFixture({
    user:{id:"new-explorer"},
    tables:{profiles:[{id:"new-explorer",visibility:"nobody",onboarding_seen_at:null}]}
  });

  const tree=await render();
  const shown=textOf(tree.toJSON());

  expect(shown).toContain("Nobody can see you yet");
  expect(shown).toContain("visible only to you");
  // The way out is offered, not taken for them.
  expect(byLabel(tree,"Choose who can see what you share")).not.toBeNull();
  expect(byLabel(tree,"Stay private for now")).not.toBeNull();
});

test("never appears again once the Explorer has been told",async()=>{
  installFixture({
    user:{id:"old-explorer"},
    tables:{profiles:[{id:"old-explorer",visibility:"nobody",onboarding_seen_at:"2026-08-01T00:00:00Z"}]}
  });

  const tree=await render();
  expect(tree.toJSON()).toBeNull();
});

test("neither button changes visibility -- it only records that they were told",async()=>{
  installFixture({
    user:{id:"new-explorer"},
    tables:{profiles:[{id:"new-explorer",visibility:"nobody",onboarding_seen_at:null}]}
  });

  const tree=await render();
  await act(async()=>{byLabel(tree,"Stay private for now").props.onPress();});

  const writes=profileWrites();
  expect(writes.length).toBe(1);
  expect(Object.keys(writes[0])).toEqual(["onboarding_seen_at"]);
  // The assertion that matters: the word does not appear in anything written.
  expect(JSON.stringify(writes)).not.toContain("visibility");
});

test("the Settings route is opened rather than a setting being chosen for them",async()=>{
  installFixture({
    user:{id:"new-explorer"},
    tables:{profiles:[{id:"new-explorer",visibility:"nobody",onboarding_seen_at:null}]}
  });

  const tree=await render();
  await act(async()=>{byLabel(tree,"Choose who can see what you share").props.onPress();});

  expect(router.push).toHaveBeenCalledWith("/settings");
  const writes=profileWrites();
  expect(JSON.stringify(writes)).not.toContain("visibility");
});

test("shows nothing at all when there is no profile row to read",async()=>{
  installFixture({user:{id:"ghost"},tables:{profiles:[]}});

  const tree=await render();
  expect(tree.toJSON()).toBeNull();
});

test("shows nothing to a signed-out visitor",async()=>{
  installFixture({user:null,tables:{profiles:[]}});

  const tree=await render();
  expect(tree.toJSON()).toBeNull();
});

test("welcomes rather than warns somebody who has already opened up",async()=>{
  installFixture({
    user:{id:"open-explorer"},
    tables:{profiles:[{id:"open-explorer",visibility:"friends",onboarding_seen_at:null}]}
  });

  const tree=await render();
  const shown=textOf(tree.toJSON());

  expect(shown).toContain("Who can see what you share");
  expect(shown).not.toContain("Nobody can see you yet");
  expect(shown).toContain("friends");
});
