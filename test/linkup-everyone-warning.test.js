/* eslint-env jest */

// A Link-up may be visible to everyone. It may not be visible to everyone by
// accident.
//
// The owner's decision: keep the Everyone option, but the organiser has to be
// told what it means at the moment they post. So the form refuses to submit an
// Everyone Link-up until the organiser has ticked the acknowledgement, and the
// tick clears whenever the audience changes -- an acknowledgement given for one
// choice must never travel to another.
//
// Written against the unchanged form first: with the warning removed, test 1
// fails (onSubmit fires with 'everyone' and no acknowledgement) and test 3
// fails (the tick survives a switch to Friends and back).

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture}=require("./fixture");

const LinkupForm=require("../components/LinkupForm").default;

// Walks both shapes: the rendered JSON tree (children on the node) and a React
// element tree (children under props).
function textOf(node){
  if(node===null||node===undefined||typeof node==="boolean") return "";
  if(typeof node==="string"||typeof node==="number") return String(node);
  if(Array.isArray(node)) return node.map(textOf).join(" ");
  if(node.children!==undefined) return textOf(node.children);
  if(node.props?.children!==undefined) return textOf(node.props.children);
  return "";
}

async function render(onSubmit){
  let tree;
  await act(async()=>{
    tree=create(React.createElement(LinkupForm,{onSubmit,titleOnly:true}));
  });
  return tree;
}

// The audience buttons and the acknowledgement are all plain Pressables, so
// they are found by the text they carry rather than by a test id -- a test id
// would pass even if the wording that does the actual warning disappeared.
function pressableSaying(tree,fragment){
  const hits=tree.root.findAll(
    (node)=>typeof node.props?.onPress==="function" && textOf(node.props?.children).includes(fragment),
    {deep:true}
  );
  // The innermost match: the outer View wrapping a button also "contains" it.
  return hits[hits.length-1] || null;
}

async function press(node){
  await act(async()=>{node.props.onPress();});
}

beforeEach(()=>{
  installFixture({user:{id:"me"}});
});

test("an Everyone Link-up will not post until the organiser has been told what Everyone means",async()=>{
  const onSubmit=jest.fn(()=>Promise.resolve());
  const tree=await render(onSubmit);

  // Friends is the default, so nothing is being warned about yet.
  expect(textOf(tree.toJSON())).not.toContain("Everyone means everyone");

  await press(pressableSaying(tree,"Everyone"));

  const warned=textOf(tree.toJSON());
  expect(warned).toContain("Everyone means everyone");
  expect(warned).toContain("Every Explorer signed in to Xplorer can see this Link-up");
  expect(warned).toContain("I understand this Link-up is visible to every Explorer.");

  // Title is valid, so the only thing standing between this and a post is the
  // acknowledgement.
  const title=tree.root.findAll((node)=>typeof node.props?.onChangeText==="function",{deep:true})[0];
  await act(async()=>{title.props.onChangeText("Sunday kickabout");});

  await press(pressableSaying(tree,"Create Link-up"));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(textOf(tree.toJSON())).toContain("Tick the box to confirm");

  await press(pressableSaying(tree,"I understand this Link-up is visible to every Explorer."));
  await press(pressableSaying(tree,"Create Link-up"));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0].p_visibility).toBe("everyone");
});

test("a Friends Link-up posts without a warning, because there is nothing to warn about",async()=>{
  const onSubmit=jest.fn(()=>Promise.resolve());
  const tree=await render(onSubmit);

  const title=tree.root.findAll((node)=>typeof node.props?.onChangeText==="function",{deep:true})[0];
  await act(async()=>{title.props.onChangeText("Sunday kickabout");});

  await press(pressableSaying(tree,"Create Link-up"));

  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0].p_visibility).toBe("friends");
});

test("the acknowledgement does not survive a change of audience",async()=>{
  const onSubmit=jest.fn(()=>Promise.resolve());
  const tree=await render(onSubmit);

  const title=tree.root.findAll((node)=>typeof node.props?.onChangeText==="function",{deep:true})[0];
  await act(async()=>{title.props.onChangeText("Sunday kickabout");});

  await press(pressableSaying(tree,"Everyone"));
  await press(pressableSaying(tree,"I understand this Link-up is visible to every Explorer."));
  await press(pressableSaying(tree,"Friends"));
  await press(pressableSaying(tree,"Everyone"));

  await press(pressableSaying(tree,"Create Link-up"));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(textOf(tree.toJSON())).toContain("Tick the box to confirm");
});
