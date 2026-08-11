#!/usr/bin/env node
"use strict";

// Packet 7 -- "friends only" means both people, on every surface that shows
// where somebody is.
//
// THE BUG THIS CLOSES
//
// Following is one-way and needs no permission. So a "followers only" check-in
// was visible to anybody who chose to follow you, including somebody you had
// never followed back and somebody following you specifically to watch where
// you go. Moments, the feed and Memories had used guestbook_private.are_friends
// -- a mutual test -- since 20260805120300. Presence, the most sensitive thing
// in the app, was the one surface left on the weaker rule.
//
// WHY A GATE AND NOT JUST A MIGRATION
//
// The one-way test was copied into three places rather than shared, and the
// third is easy to miss: the RLS policy protects the table, but Live Nearby
// reads through get_live_discovery, a security-invoker function carrying its
// own copy of the rule. Fixing two of three leaves the feed showing what the
// table refuses, and nothing would look wrong.
//
// So this asserts the shape rather than the fix: no surface that reads
// live_checkins or linkups may decide visibility with a single-direction
// follow lookup, whichever migration adds it.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const migrationsDir=path.join(root,"supabase","migrations");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

const migrations=fs.readdirSync(migrationsDir)
  .filter((name)=>name.endsWith(".sql"))
  .sort()
  .map((name)=>({
    name,
    body:fs.readFileSync(path.join(migrationsDir,name),"utf8").replace(/^\s*--.*$/gm,"")
  }));

check(migrations.length>0,"supabase/migrations: nothing to check");

// ---------------------------------------------------------------------------
// 1. The three definitions, each in its last form, must use are_friends
// ---------------------------------------------------------------------------

const surfaces=[
  {
    label:"private.can_view_linkup",
    start:/create\s+or\s+replace\s+function\s+private\.can_view_linkup/i,
    // The whole function body, to its terminating $$;
    extract:(body)=>{
      const at=body.search(/create\s+or\s+replace\s+function\s+private\.can_view_linkup/i);
      if(at<0) return null;
      const end=body.indexOf("$$;",body.indexOf("$$",at)+2);
      return body.slice(at,end);
    }
  },
  {
    label:"live_checkins_select_visible",
    start:/create\s+policy\s+live_checkins_select_visible/i,
    extract:(body)=>{
      const at=body.search(/create\s+policy\s+live_checkins_select_visible/i);
      if(at<0) return null;
      const end=body.indexOf(");",at);
      return body.slice(at,end);
    }
  },
  {
    label:"public.get_live_discovery",
    start:/create\s+or\s+replace\s+function\s+public\.get_live_discovery/i,
    extract:(body)=>{
      const at=body.search(/create\s+or\s+replace\s+function\s+public\.get_live_discovery/i);
      if(at<0) return null;
      const end=body.indexOf("$$;",body.indexOf("$$",at)+2);
      return body.slice(at,end);
    }
  }
];

for(const surface of surfaces){
  let latest=null;
  let latestFile=null;

  for(const migration of migrations){
    if(!surface.start.test(migration.body)) continue;
    const found=surface.extract(migration.body);
    if(found){latest=found;latestFile=migration.name;}
  }

  check(latest!==null,`supabase/migrations: ${surface.label} is never defined`);
  if(latest===null) continue;

  // The failure shape: a follow lookup in one direction only. are_friends
  // checks both, which is why it is the only acceptable form here.
  const oneWay=/explorer_follows\s+f\s+where\s+f\.follower_id\s*=/i.test(latest);
  check(
    !oneWay,
    `${latestFile}: ${surface.label} decides visibility with a one-way follow lookup -- anybody who follows you, unanswered, can see where you are`
  );

  check(
    /are_friends/.test(latest),
    `${latestFile}: ${surface.label} does not use guestbook_private.are_friends, so "friends only" does not mean friends here`
  );
}

// ---------------------------------------------------------------------------
// 2. Public still means public
// ---------------------------------------------------------------------------
// Narrowing somebody who deliberately chose Public down to friends would be
// deciding for them in the opposite direction. Both surfaces must still honour
// the choice they were given.

for(const label of ["live_checkins_select_visible","get_live_discovery"]){
  const holder=[...migrations].reverse().find((migration)=>
    new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(migration.body)
  );
  if(!holder) continue;
  check(
    /visibility='public'/.test(holder.body),
    `${holder.name}: ${label} no longer honours a deliberate Public choice`
  );
}

// ---------------------------------------------------------------------------
// 3. are_friends stays mutual, and stays away from anon
// ---------------------------------------------------------------------------
// Everything above rests on this one function. If it were ever relaxed to a
// single direction, all three surfaces would quietly widen at once.

const friendsDef=[...migrations].reverse().find((migration)=>
  /create\s+or\s+replace\s+function\s+guestbook_private\.are_friends/i.test(migration.body)
);

check(friendsDef!==undefined,"supabase/migrations: guestbook_private.are_friends is never defined");

if(friendsDef){
  const at=friendsDef.body.search(/create\s+or\s+replace\s+function\s+guestbook_private\.are_friends/i);
  const body=friendsDef.body.slice(at,friendsDef.body.indexOf("$$;",friendsDef.body.indexOf("$$",at)+2));

  const directions=(body.match(/explorer_follows\s+f\s+where\s+f\.follower_id/g)||[]).length;
  check(
    directions===2,
    `${friendsDef.name}: are_friends checks ${directions} follow direction(s), not 2 -- a friend is two Explorers who follow each other`
  );

  check(
    /revoke\s+all\s+on\s+function\s+guestbook_private\.are_friends\(uuid,uuid\)\s+from\s+public\s*,\s*anon/i
      .test(friendsDef.body),
    `${friendsDef.name}: are_friends is not revoked from anon`
  );
}

// ---------------------------------------------------------------------------
// 4. Becoming friends is announced to both people
// ---------------------------------------------------------------------------
// The dedupe key must not depend on who followed first: notifications has a
// unique index on (recipient_user_id, dedupe_key), so an order-dependent key
// would let a follow/unfollow/refollow cycle send the same notice repeatedly.

const notifier=[...migrations].reverse().find((migration)=>
  /notify_friendship_formed/.test(migration.body)
);

check(notifier!==undefined,"supabase/migrations: nothing announces a new friendship");

if(notifier){
  check(
    /least\([^)]*\)[\s\S]{0,80}greatest\(/.test(notifier.body),
    `${notifier.name}: the friendship dedupe key is not order-independent, so refollowing re-sends the notice`
  );
  check(
    /after\s+insert\s+on\s+public\.explorer_follows/i.test(notifier.body),
    `${notifier.name}: the friendship notice is not attached to a follow`
  );
}

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nFriends visibility gate failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Friends visibility gate passed (${passed} checks).`);
