/* eslint-env jest */

// The demo logins are a loaded gun pointed at the same foot as last time, so
// these tests are about the safety catch rather than the convenience.
//
// 1. Five taps, not one. A control a real person can find by accident is the
//    thing that was removed.
// 2. No environment variable, no credential. This is the one that matters: the
//    old panel's password was in the bundle whether or not anybody opened it.
// 3. The admin address is never a constant in the source.
//
// The two halves are tested separately because they fail separately: the
// component is asked what it renders, and utils/demoLogins.js is asked what it
// produces for a given environment. Loading the component inside
// jest.isolateModules would pull in a second copy of React and break the
// renderer, so the component gets a stubbed module instead.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Text}=require("react-native");

// The stub the component sees. Each test sets it before rendering.
const demo={enabled:true,offMessage:"Demo logins are off in this build.",accounts:[]};

jest.mock("../utils/demoLogins",()=>({
  get DEMO_ENABLED(){return demo.enabled;},
  get DEMO_OFF_MESSAGE(){return demo.offMessage;},
  demoAccounts:()=>demo.accounts
}));

const DemoLogins=require("../components/DemoLogins").default;

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
  )[0];
}

// The login screen's own heading is the target -- there is no separate logo to
// tap, on purpose.
async function tapHeading(tree,times){
  for(let i=0;i<times;i+=1){
    // Re-found every time: the component re-renders between taps.
    await act(async()=>{byLabel(tree,"Login").props.onPress();});
  }
}

async function render(props){
  let tree;
  await act(async()=>{
    tree=create(React.createElement(DemoLogins,props,React.createElement(Text,null,"Login")));
  });
  return tree;
}

// -- the environment half -------------------------------------------------
// Pure module, no React, so isolateModules is safe here.

function accountsFor(env){
  let result;
  jest.isolateModules(()=>{
    const previousPassword=process.env.EXPO_PUBLIC_DEMO_PASSWORD;
    const previousAdmin=process.env.EXPO_PUBLIC_DEMO_ADMIN_EMAIL;
    process.env.EXPO_PUBLIC_DEMO_PASSWORD=env.password ?? "";
    process.env.EXPO_PUBLIC_DEMO_ADMIN_EMAIL=env.adminEmail ?? "";

    // requireActual, because the module is mocked above for the component half.
    const module=jest.requireActual("../utils/demoLogins");
    result={enabled:module.DEMO_ENABLED,accounts:module.demoAccounts()};

    process.env.EXPO_PUBLIC_DEMO_PASSWORD=previousPassword;
    process.env.EXPO_PUBLIC_DEMO_ADMIN_EMAIL=previousAdmin;
  });
  return result;
}

test("no demo password in the environment means no account and no credential at all",()=>{
  const {enabled,accounts}=accountsFor({password:""});
  expect(enabled).toBe(false);
  expect(accounts).toEqual([]);
});

test("a demo password produces the three test accounts, and no admin unless its address is supplied",()=>{
  const withoutAdmin=accountsFor({password:"demo-pass"});
  expect(withoutAdmin.enabled).toBe(true);
  expect(withoutAdmin.accounts.map((a)=>a.email)).toEqual([
    "explorer@test.com","explorer2@test.com","manager@test.com"
  ]);
  expect(withoutAdmin.accounts.every((a)=>a.password==="demo-pass")).toBe(true);

  const withAdmin=accountsFor({password:"demo-pass",adminEmail:"someone@example.com"});
  expect(withAdmin.accounts.map((a)=>a.email)).toContain("someone@example.com");
});

test("no demo password or personal address is hardcoded in the source",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  for(const file of ["utils/demoLogins.js","components/DemoLogins.js","app/auth/login.js"]){
    const source=fs.readFileSync(path.join(root,file),"utf8");
    // The two shapes that actually shipped last time: a password constant and
    // a personal address. Test-account addresses are fine -- they open nothing
    // without the password, and they have to be somewhere.
    expect(source).not.toMatch(/password\s*[:=]\s*["'][^"']{6,}["']/i);
    expect(source).not.toMatch(/[\w.+-]+@gmail\.com/i);
  }
});

// -- the component half ---------------------------------------------------

beforeEach(()=>{
  demo.enabled=true;
  demo.accounts=[
    {key:"manager",label:"Manager",detail:"Tools unlocked",email:"manager@test.com",password:"demo-pass"}
  ];
});

test("four taps on the heading show nothing; the fifth opens the panel",async()=>{
  const tree=await render({onPick:jest.fn()});

  await tapHeading(tree,4);
  expect(textOf(tree.toJSON())).not.toContain("Demo logins");

  await tapHeading(tree,1);
  expect(textOf(tree.toJSON())).toContain("Demo logins");
});

test("pressing an account hands its credentials back to the login screen",async()=>{
  const onPick=jest.fn();
  const tree=await render({onPick});

  await tapHeading(tree,5);
  await act(async()=>{byLabel(tree,"Log in as Manager").props.onPress();});

  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick.mock.calls[0][0]).toMatchObject({email:"manager@test.com",password:"demo-pass"});
});

test("in a build with no demo password the panel opens empty and says why",async()=>{
  demo.enabled=false;
  demo.accounts=[];

  const tree=await render({onPick:jest.fn()});
  await tapHeading(tree,5);

  const shown=textOf(tree.toJSON());
  expect(shown).toContain("Demo logins are off in this build");
  expect(shown).not.toContain("manager@test.com");

  const buttons=tree.root.findAll(
    (node)=>typeof node.props?.accessibilityLabel==="string" && node.props.accessibilityLabel.startsWith("Log in as"),
    {deep:true}
  );
  expect(buttons).toHaveLength(0);
});
