/* eslint-env jest */

// Push notifications.
//
// There were none -- nothing in the repository matched expo-notifications,
// ExpoPushToken or push_token, so a notification only existed if you opened the
// app to look at it.
//
// The database half is proved against the live project in
// 20260814030000_push_notifications.sql: six behaviours, one queued row. This
// is the app half, and the rules the two have to agree on.

const fs=require("fs");
const path=require("path");
const {supabase}=require("../services/supabase");
const {PUSH_CATEGORIES,PUSH_CATEGORY_KEYS,NEVER_PUSHED,categoryForType}=require("../utils/pushCategories");

const root=path.resolve(__dirname,"..");
const MIGRATION=fs.readFileSync(
  path.join(root,"supabase","migrations","20260814030000_push_notifications.sql"),"utf8"
);

// ---------------------------------------------------------------------------
// Off, until somebody says otherwise
// ---------------------------------------------------------------------------

test("every category starts off, and so does the master switch",()=>{
  // RULES.md: every visibility flag defaults to off and opt-in is never the
  // fallback branch. A phone buzzing is not an exception to that.
  const {noPushes}=require("../utils/push");
  const blank=noPushes();

  expect(blank.enabled).toBe(false);
  for(const key of PUSH_CATEGORY_KEYS) expect(blank[key]).toBe(false);
});

test("the database says the same thing in its own defaults",()=>{
  // Columns rather than rows, so a MISSING row cannot mean "on".
  expect(MIGRATION).toMatch(/enabled boolean not null default false/);
  for(const key of PUSH_CATEGORY_KEYS){
    expect(MIGRATION).toMatch(new RegExp(`${key} boolean not null default false`));
  }
});

test("a failed read is treated as off, not as on",async()=>{
  // Guessing "on" because a read failed would be the app turning notifications
  // on for somebody who never asked.
  const {loadPushPreferences}=require("../utils/push");

  supabase.from=jest.fn(()=>({
    select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{message:"offline"}})})})
  }));

  const loaded=await loadPushPreferences("me");
  expect(loaded.enabled).toBe(false);
  for(const key of PUSH_CATEGORY_KEYS) expect(loaded[key]).toBe(false);
});

test("nobody signed in gets nothing, and is not asked for a permission",async()=>{
  const {loadPushPreferences}=require("../utils/push");
  expect((await loadPushPreferences(null)).enabled).toBe(false);
});

// ---------------------------------------------------------------------------
// The app and the database agree about what a category is
// ---------------------------------------------------------------------------

test("every category in the app exists as a column, and the reverse",()=>{
  // A category in one and not the other is a switch that controls nothing, or
  // a push nobody can turn off.
  const columns=[...MIGRATION.matchAll(/^\s+(\w+) boolean not null default false/gm)]
    .map((match)=>match[1])
    .filter((name)=>name!=="enabled");

  expect(columns.sort()).toEqual([...PUSH_CATEGORY_KEYS].sort());
});

test("every notification type the trigger routes has a home in the app",()=>{
  const routed=[...MIGRATION.matchAll(/when '(\w+)' then '(\w+)'/g)];
  expect(routed.length).toBeGreaterThan(10);

  for(const [,type,category] of routed){
    expect(categoryForType(type)).toBe(category);
  }
});

test("the noisiest notification in the app is never a push",()=>{
  // social_moment is 302 of the 802 rows on the live database and fires every
  // time somebody you follow posts. As a push that is a phone buzzing all
  // evening, and the first thing anybody does then is turn EVERYTHING off --
  // including what they wanted.
  expect(NEVER_PUSHED).toContain("social_moment");
  expect(categoryForType("social_moment")).toBeNull();
  expect(MIGRATION).not.toMatch(/when 'social_moment' then/);
});

test("every category says what it is in plain words",()=>{
  for(const category of PUSH_CATEGORIES){
    expect(category.label.length).toBeGreaterThan(2);
    expect(category.help.length).toBeGreaterThan(20);
    expect(category.types.length).toBeGreaterThan(0);
  }
});

// ---------------------------------------------------------------------------
// The permission
// ---------------------------------------------------------------------------

test("the permission is asked for in Settings, never on launch",()=>{
  // A push prompt on first open, before anybody knows what the app is, is how
  // notifications get turned off for ever.
  const layout=fs.readFileSync(path.join(root,"app","_layout.js"),"utf8");
  expect(layout).not.toMatch(/expo-notifications|requestPermissionsAsync/);

  const settings=fs.readFileSync(path.join(root,"app","settings.js"),"utf8");
  expect(settings).toMatch(/enablePushOnThisDevice/);
});

test("a refusal is an answer, and the switch goes back",()=>{
  const settings=fs.readFileSync(path.join(root,"app","settings.js"),"utf8");
  // The screen has to keep telling the truth about what will happen.
  expect(settings).toMatch(/if\(!granted\)\{[\s\S]{0,400}enabled:false/);
});

test("signing out takes this device off the list",()=>{
  // Otherwise somebody's old phone -- or a shared one -- keeps buzzing with
  // somebody else's messages after they have signed out of it.
  const settings=fs.readFileSync(path.join(root,"app","settings.js"),"utf8");
  expect(settings).toMatch(/forgetThisDevice\(user\?\.id\)[\s\S]{0,120}signOut/);
});

// ---------------------------------------------------------------------------
// What can read what
// ---------------------------------------------------------------------------

test("a device token is only ever visible to its owner",()=>{
  // A token is a way to make somebody's phone light up; a list of them is a
  // list of that person's devices.
  expect(MIGRATION).toMatch(/create policy push_tokens_own_all[\s\S]{0,240}user_id=\(select auth\.uid\(\)\)/);
});

test("no phone can read the queue at all",()=>{
  // A queue of everybody's notifications is not something a client should be
  // able to ask for. No policy is the correct amount of access.
  expect(MIGRATION).toMatch(/revoke all on public\.push_queue from anon, authenticated/);
  expect(MIGRATION).not.toMatch(/create policy [\w_]*push_queue/);
});

test("the sender uses the service role, because nothing else can read it",()=>{
  const fn=fs.readFileSync(
    path.join(root,"supabase","functions","send-push","index.ts"),"utf8"
  );
  expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);

  // Marked either way. A row that cannot be sent and is not marked is a row
  // the function retries for ever, which is a loop rather than a queue.
  expect(fn).toMatch(/sent_at: stamp, failed_reason/);
});
