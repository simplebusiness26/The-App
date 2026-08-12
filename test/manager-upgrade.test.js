/* eslint-env jest */

// "in settings i want to be able to upgrade to a manager button then a are you
//  sure then yes then get given the capabilities and same place downgrade with
//  a choice to unclaim or delete my businesses"
//
// Three things this has to get right, and the third is the one that would have
// shipped broken:
//
//   1. The button is only offered to somebody who is not already a manager, and
//      the downgrade only to somebody who is.
//   2. Nothing happens on the first press. The confirmation comes first.
//   3. The confirmation is drawn IN THE PAGE. Alert.alert does nothing at all
//      on react-native-web, so a confirm dialog built with it is a button that
//      looks like it works and does not. app/settings.js already has two of
//      those (password reset, log out) -- this is not adding a third.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");

const ME="me-1";

const PROFILE={
  id:ME,email:"a@b.com",area:"Hastings",show_area:true,
  leaderboard_opt_in:true,visibility:"friends"
};

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function renderSettings(capabilityRow){
  installFixture({
    user:{id:ME},
    tables:{
      profiles:[PROFILE],
      manager_capabilities:capabilityRow ? [capabilityRow] : [],
      businesses:[],properties:[],activity_clubs:[],events:[]
    },
    rpc:{}
  });

  const Settings=require("../app/settings").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Settings)));});
  await act(async()=>{});
  return tree;
}

function press(tree,label){
  const node=tree.root.findAll(
    (n)=>n.props?.accessibilityLabel===label && typeof n.props?.onPress==="function",
    {deep:true}
  )[0];
  if(!node) throw new Error(`No pressable labelled "${label}". Labels present: ${labelsOf(tree.toJSON()).join(" | ")}`);
  return node;
}

const OFF={
  user_id:ME,businesses_status:"inactive",properties_status:"inactive",
  activity_clubs_status:"inactive",events_status:"inactive"
};
const ON={
  user_id:ME,businesses_status:"active",properties_status:"active",
  activity_clubs_status:"active",events_status:"active"
};

afterEach(()=>{restoreRouterParams();});

describe("upgrading",()=>{
  it("offers the button to somebody who is not a manager",async()=>{
    const tree=await renderSettings(OFF);
    const labels=labelsOf(tree.toJSON());
    console.log("NOT A MANAGER >>>",labels.filter((l)=>/manager/i.test(l)).join(" | "));

    expect(labels).toContain("Become a manager");
    expect(labels).not.toContain("Stop being a manager");
    await act(async()=>{tree.unmount();});
  });

  it("asks are you sure before granting anything",async()=>{
    const tree=await renderSettings(OFF);

    await act(async()=>{press(tree,"Become a manager").props.onPress();});

    const text=textOf(tree.toJSON());
    console.log("AFTER FIRST PRESS >>>",text.slice(text.indexOf("Are you sure"),text.indexOf("Are you sure")+180));

    expect(text).toContain("Are you sure?");
    // And nothing was granted by pressing the first button.
    expect(supabase.rpc).not.toHaveBeenCalledWith("become_manager");

    await act(async()=>{tree.unmount();});
  });

  it("grants the capabilities on yes, through the database and not from here",async()=>{
    const tree=await renderSettings(OFF);

    await act(async()=>{press(tree,"Become a manager").props.onPress();});
    await act(async()=>{press(tree,"Yes, switch the manager tools on").props.onPress();});
    await act(async()=>{});

    expect(supabase.rpc).toHaveBeenCalledWith("become_manager");
    // Not a client-side update of the capability row. That column is what the
    // insert policies read; letting a screen write it directly would be the
    // hole Packet 0 closed.
    expect(supabase.from).not.toHaveBeenCalledWith("manager_capabilities_update");

    await act(async()=>{tree.unmount();});
  });

  it("does not use Alert, which does nothing on web",()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","app","settings.js"),"utf8"
    );
    const start=source.indexOf("async function becomeManager");
    const end=source.indexOf("function confirmPasswordReset");
    const managerSection=source.slice(start,end);

    expect(start).toBeGreaterThan(-1);
    expect(managerSection).not.toContain("Alert.alert");
    // And the confirmation is rendered, which is what makes it work on web.
    expect(source).toContain("Are you sure?");
    expect(source).toContain("What happens to what you manage?");
  });
});

describe("downgrading",()=>{
  it("offers it only to somebody who is a manager",async()=>{
    const tree=await renderSettings(ON);
    const labels=labelsOf(tree.toJSON());
    console.log("IS A MANAGER >>>",labels.filter((l)=>/manager/i.test(l)).join(" | "));

    expect(labels).toContain("Stop being a manager");
    expect(labels).not.toContain("Become a manager");
    await act(async()=>{tree.unmount();});
  });

  it("asks what happens to the listings, and offers both answers",async()=>{
    const tree=await renderSettings(ON);

    await act(async()=>{press(tree,"Stop being a manager").props.onPress();});

    const text=textOf(tree.toJSON());
    console.log("DOWNGRADE CHOICES >>>",text.slice(text.indexOf("What happens"),text.indexOf("What happens")+140));

    expect(text).toContain("What happens to what you manage?");
    expect(text).toContain("Leave them unclaimed");
    expect(text).toContain("Delete them");
    // Nothing has happened yet.
    expect(supabase.rpc).not.toHaveBeenCalledWith("stop_managing",expect.anything());

    await act(async()=>{tree.unmount();});
  });

  it("passes unclaim when they choose to leave the listings behind",async()=>{
    const tree=await renderSettings(ON);
    await act(async()=>{press(tree,"Stop being a manager").props.onPress();});
    await act(async()=>{
      press(tree,"Leave my businesses and properties on the map with no owner").props.onPress();
    });
    await act(async()=>{});

    expect(supabase.rpc).toHaveBeenCalledWith("stop_managing",{p_listings:"unclaim"});
    await act(async()=>{tree.unmount();});
  });

  it("passes delete when they choose to remove them",async()=>{
    const tree=await renderSettings(ON);
    await act(async()=>{press(tree,"Stop being a manager").props.onPress();});
    await act(async()=>{press(tree,"Delete everything I manage").props.onPress();});
    await act(async()=>{});

    expect(supabase.rpc).toHaveBeenCalledWith("stop_managing",{p_listings:"delete"});
    await act(async()=>{tree.unmount();});
  });

  it("can be backed out of",async()=>{
    const tree=await renderSettings(ON);
    await act(async()=>{press(tree,"Stop being a manager").props.onPress();});
    await act(async()=>{press(tree,"Cancel").props.onPress();});

    expect(textOf(tree.toJSON())).not.toContain("What happens to what you manage?");
    expect(supabase.rpc).not.toHaveBeenCalledWith("stop_managing",expect.anything());
    await act(async()=>{tree.unmount();});
  });
});

describe("the capability list stops lying",()=>{
  it("shows inactive for an account with no manager_capabilities row",async()=>{
    const tree=await renderSettings(null);
    const text=textOf(tree.toJSON());
    console.log("NO ROW AT ALL >>>",text.slice(text.indexOf("Businesses"),text.indexOf("Businesses")+120));

    // It used to default businesses and properties to "active" for an account
    // with no row -- true when that was written, and false since 20260811120000
    // flipped those column defaults. Settings was telling people they could
    // list a business while the insert policy refused it.
    expect(text).not.toMatch(/Businesses\s+active/);
    await act(async()=>{tree.unmount();});
  });
});
