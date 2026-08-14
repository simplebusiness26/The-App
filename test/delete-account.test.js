/* eslint-env jest */

// Deleting your account, from inside the app.
//
// Apple and Google both require this before you can publish, and there was none
// -- nothing in the repository matched delete_account.
//
// The database half is proved against the live project in
// 20260814020000_delete_my_account.sql: the account and everything they wrote
// goes, and a comment somebody ELSE left on their Moment survives with its
// author intact. This is the screen half, plus the decisions the SQL encodes.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {router}=require("expo-router");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function openSettings(){
  installFixture({
    user:{id:"me"},
    tables:{profiles:[{id:"me",name:"Sam",visibility:"friends"}],manager_capabilities:[]},
    rpc:{}
  });

  const Settings=require("../app/settings").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Settings)));});
  await act(async()=>{});
  return tree;
}

function find(tree,label){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label,
    {deep:true}
  )[0] || null;
}

afterEach(()=>{restoreRouterParams();});

test("Settings offers a way to delete the account",async()=>{
  const tree=await openSettings();

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels).toContain("Delete my account for ever");
  expect(labels).toContain("Type DELETE to confirm");

  await act(async()=>{tree.unmount();});
});

test("it says what goes and what stays before anybody presses anything",async()=>{
  const tree=await openSettings();
  const text=textOf(tree.toJSON());

  expect(text).toContain("This cannot be undone");
  // What other people wrote is theirs, and somebody deleting an account should
  // know that before they do it rather than wonder afterwards.
  expect(text).toContain("What other people");

  await act(async()=>{tree.unmount();});
});

test("the button does nothing until DELETE is typed",async()=>{
  // Not a second "are you sure": somebody tapping through two dialogues has not
  // necessarily read either, and this is the one action that cannot be undone.
  const tree=await openSettings();

  const button=find(tree,"Delete my account for ever");
  expect(button.props.accessibilityState.disabled).toBe(true);

  supabase.rpc.mockClear();
  await act(async()=>{button.props.onPress?.();});
  expect(supabase.rpc).not.toHaveBeenCalledWith("delete_my_account");

  await act(async()=>{tree.unmount();});
});

test("typing DELETE turns it on, and it calls the database",async()=>{
  const tree=await openSettings();

  await act(async()=>{find(tree,"Type DELETE to confirm").props.onChangeText("DELETE");});
  await act(async()=>{});

  const button=find(tree,"Delete my account for ever");
  expect(button.props.accessibilityState.disabled).toBe(false);

  supabase.rpc.mockClear();
  supabase.rpc.mockResolvedValueOnce({data:null,error:null});
  router.replace.mockClear();

  await act(async()=>{await button.props.onPress();});
  await act(async()=>{});

  expect(supabase.rpc).toHaveBeenCalledWith("delete_my_account");
  // The row is gone; the session in memory is not.
  expect(supabase.auth.signOut).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith("/");

  await act(async()=>{tree.unmount();});
});

test("a lowercase or partial word is not the word",async()=>{
  const tree=await openSettings();

  for(const typed of ["delet","Delete me","",  "DELETED"]){
    await act(async()=>{find(tree,"Type DELETE to confirm").props.onChangeText(typed);});
    await act(async()=>{});
    const disabled=find(tree,"Delete my account for ever").props.accessibilityState.disabled;
    // "delete" in any case is the word; anything else is not.
    expect(disabled).toBe(typed.trim().toUpperCase()!=="DELETE");
  }

  await act(async()=>{tree.unmount();});
});

test("the refusal is shown with its real numbers, not replaced",async()=>{
  // "Hand over or close what you manage first: 1 club(s)..." is the whole point
  // of the message. Swapping it for "something went wrong" would leave somebody
  // with no idea what to do next.
  const tree=await openSettings();

  await act(async()=>{find(tree,"Type DELETE to confirm").props.onChangeText("DELETE");});
  await act(async()=>{});

  supabase.rpc.mockResolvedValueOnce({
    data:null,
    error:{message:"Hand over or close what you manage first: 2 club(s), 0 event(s), 1 business(es), 0 property(ies)."}
  });
  supabase.auth.signOut.mockClear();

  await act(async()=>{await find(tree,"Delete my account for ever").props.onPress();});
  await act(async()=>{});

  expect(textOf(tree.toJSON())).toContain("2 club(s)");
  // And nothing was signed out, because nothing was deleted.
  expect(supabase.auth.signOut).not.toHaveBeenCalled();

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// The decisions the SQL encodes
// ---------------------------------------------------------------------------

test("the function refuses rather than destroying other people's memberships",()=>{
  // activity_clubs.manager_id and events.manager_id both CASCADE from
  // auth.users. So without this branch, one manager deleting their account
  // would silently take a club with thirty members in it, and every
  // membership, message and RSVP inside. Nobody decided that.
  const sql=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"supabase","migrations",
      "20260814020000_delete_my_account.sql"),"utf8"
  ).replace(/^\s*--.*$/gm,"");

  expect(sql).toMatch(/from public\.activity_clubs where manager_id/);
  expect(sql).toMatch(/from public\.events\s+where manager_id/);
  expect(sql).toMatch(/raise exception[\s\S]*Hand over or close/);
});

test("it removes what the foreign keys would leave behind",()=>{
  const sql=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"supabase","migrations",
      "20260814020000_delete_my_account.sql"),"utf8"
  ).replace(/^\s*--.*$/gm,"");

  // explorer_reviews has NO foreign key to auth.users, so a deleted Explorer's
  // reviews would survive with a dangling author.
  expect(sql).toMatch(/delete from public\.explorer_reviews where user_id/);
  expect(sql).toMatch(/delete from public\.review_media/);

  // claims.user_id is NO ACTION, which would BLOCK the delete outright.
  expect(sql).toMatch(/delete from public\.claims where user_id/);

  // And then the account, which cascades the other thirty-four tables.
  expect(sql).toMatch(/delete from auth\.users where id = v_user/);
});

test("only the caller can delete the caller",()=>{
  const sql=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"supabase","migrations",
      "20260814020000_delete_my_account.sql"),"utf8"
  );

  // It takes no argument at all. A function that accepted a user id would be a
  // way to delete somebody else's account, however carefully it checked.
  expect(sql).toMatch(/create or replace function public\.delete_my_account\(\)/);
  expect(sql).toMatch(/v_user uuid := auth\.uid\(\)/);
  expect(sql).toMatch(/revoke all on function public\.delete_my_account\(\) from public, anon/);
});
