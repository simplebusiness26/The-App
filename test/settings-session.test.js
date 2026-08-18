/* eslint-env jest */

// The handlers have to be able to see who is signed in.
//
// app/settings.js destructured `user` inside load() and then read `user?.id`
// from logout(), togglePushMaster() and togglePushCategory(). Those are three
// different scopes, so at runtime all three threw a ReferenceError: logging out
// was broken, and so was every push toggle.
//
// Nothing caught it. test/push-notifications.test.js asserts the SOURCE
// contains forgetThisDevice(user?.id), which it did; the optional chaining made
// the line read as defensive when the identifier itself did not exist. So this
// checks the thing that was actually wrong -- that the name is bound in the
// component body, not just used in it.

const fs=require("fs");
const path=require("path");

const source=fs.readFileSync(path.join(__dirname,"..","app","settings.js"),"utf8");

test("the signed-in session is held where every handler can read it",()=>{
  expect(source).toMatch(/const\s*\[user,setUser\]\s*=\s*useState\(/);
  expect(source).toMatch(/setUser\(user\)/);
});

test("every handler that reads the session is downstream of that binding",()=>{
  const body=source.slice(source.indexOf("const [user,setUser]"));
  for(const handler of ["forgetThisDevice(user?.id)","savePushPreferences(user?.id","enablePushOnThisDevice(user?.id)"]){
    expect(body).toContain(handler);
  }
});
