/* eslint-env jest */

// Packet 5a. The harness Packet 0 did not build.
//
// test/routes.test.js mounts every screen against an empty Supabase result and
// asserts it does not throw. That catches a crash and nothing else: a screen
// with no data renders none of its conditional controls, so the claim button,
// the favourite button, the review link and the owner's edit button are all
// absent in a passing smoke test. A refactor could delete any of them and stay
// green.
//
// This lets a test say "here is a business, here is who is looking at it" and
// then assert what appears. Without it, Packet 5's rewrite of five shipped
// screens would be unverifiable, which is why 5a starts here rather than with
// the layout.

const {supabase}=require("../services/supabase");
const expoRouter=require("expo-router");

// Route params are mocked as {} for the smoke tests, so a screen that reads
// useLocalSearchParams().id never starts loading at all -- it sits on its
// spinner and every assertion sees "Loading...". A place page is nothing
// without an id, so the fixture has to supply one.
const originalUseLocalSearchParams=expoRouter.useLocalSearchParams;

export function restoreRouterParams(){
  expoRouter.useLocalSearchParams=originalUseLocalSearchParams;
}

// A PostgREST-shaped result for a list of rows. Every builder method returns
// the same object so any chain length works, and awaiting it gives the rows.
function query(rows){
  const builder={};

  const chainable=[
    "select","insert","update","upsert","delete","eq","neq","gt","gte","lt",
    "lte","like","ilike","is","in","or","and","not","contains","order",
    "limit","range","filter","match"
  ];

  for(const method of chainable) builder[method]=jest.fn(()=>builder);

  // .single() errors when there is no row, the way PostgREST does. Screens
  // branch on that error to show "could not be loaded", so faking it as a null
  // would hide the error path rather than test it.
  builder.single=jest.fn(()=>Promise.resolve(
    rows.length
      ? {data:rows[0],error:null}
      : {data:null,error:{message:"JSON object requested, multiple (or no) rows returned"}}
  ));

  builder.maybeSingle=jest.fn(()=>Promise.resolve({data:rows[0] ?? null,error:null}));
  builder.then=(resolve,reject)=>Promise.resolve({data:rows,error:null}).then(resolve,reject);

  return builder;
}

// `tables` maps a table name to the rows it should return. A table left out
// returns nothing, which is the same as the row not existing.
export function installFixture({user=null,tables={},rpc={},params=null}={}){
  if(params) expoRouter.useLocalSearchParams=()=>params;
  supabase.auth.getUser.mockImplementation(()=>Promise.resolve({data:{user},error:null}));
  supabase.from.mockImplementation((name)=>query(tables[name] ?? []));
  supabase.rpc.mockImplementation((name)=>Promise.resolve({data:rpc[name] ?? null,error:null}));
}

// ---------------------------------------------------------------------------
// Reading what a screen rendered
// ---------------------------------------------------------------------------

export function allText(node,found=[]){
  if(node===null || node===undefined) return found;
  if(typeof node==="string"){found.push(node);return found;}
  if(Array.isArray(node)){for(const child of node) allText(child,found);return found;}
  if(typeof node==="object") allText(node.children,found);
  return found;
}

// Joined so an assertion can look for a phrase that React split across several
// text nodes -- "Leave a Business Review" is one string, but a label built from
// an expression is not.
export function textOf(tree){
  return allText(tree).join(" ");
}

export function labelsOf(node,found=[]){
  if(!node || typeof node!=="object") return found;
  if(Array.isArray(node)){node.forEach((child)=>labelsOf(child,found));return found;}
  if(node.props?.accessibilityLabel) found.push(node.props.accessibilityLabel);
  labelsOf(node.children,found);
  return found;
}
