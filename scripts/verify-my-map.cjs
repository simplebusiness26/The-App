#!/usr/bin/env node
"use strict";

// Packet 8b: My Map.
//
// This gate exists because the thing 8b must not do is invisible in a passing
// test. A My Map with a share control renders fine, mounts fine, and passes
// every behavioural assertion about showing the owner their own places. The
// defect would only ever be found by a person reading the diff.
//
// So the rules from the 2026-08-04 privacy review are asserted as source
// contracts, and each one was demonstrated failing before it was kept.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function read(file){
  return fs.readFileSync(path.join(root,file),"utf8");
}

// Comments describe what the code must not do, so they would satisfy almost
// every regex below. Strip them first or this gate proves nothing.
function code(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const MAP="components/MyMap.js";
const PROFILE="components/ExplorerProfileScreen.js";

const map=code(read(MAP));
const profile=code(read(PROFILE));

// ---------------------------------------------------------------------------
// 1. Sourced from Memories, never from check-ins
// ---------------------------------------------------------------------------
//
// The whole reason Memories exists. A check-in expires between 15 minutes and
// 4 hours and is deliberately unreadable to anyone else afterwards; plotting a
// history of them would turn "expires in 4 hours" into "remembered forever".

check(
  /get_explorer_memories/.test(map),
  `${MAP}: does not read get_explorer_memories — My Map is sourced from Memories`
);

check(
  !/live_checkins/.test(map),
  `${MAP}: reads live_checkins — a check-in is the one thing this app promises to forget, and a map of every check-in ever made is a permanent movement history`
);

check(
  !/start_live_checkin|checkins?\//.test(map),
  `${MAP}: touches the check-in system — 8b reads Memories and nothing else`
);

// It asks for the whole archive, not the profile shelf. show_on_profile decides
// what other people see on a profile; it is not a filter on your own map.
check(
  /p_scope\s*:\s*"all"/.test(map),
  `${MAP}: does not request the 'all' scope — your own map is your whole archive, not the show_on_profile subset`
);

// ---------------------------------------------------------------------------
// 2. Both locks, and neither may be removed
// ---------------------------------------------------------------------------
//
// Two independent owner comparisons. Either alone would be enough; that is
// exactly why both have to survive an edit that only understands one of them.

check(
  /viewerId\s*===\s*ownerId|ownerId\s*===\s*viewerId/.test(map),
  `${MAP}: does not compare viewerId to ownerId — this is the second lock and it must not depend on the caller`
);

check(
  /if\(!isOwner\)\s*return null/.test(map),
  `${MAP}: does not return null for a non-owner — a non-owner must get no element, not an empty one`
);

check(
  /isOwner\s*&&\s*<MyMap/.test(profile),
  `${PROFILE}: does not gate <MyMap> on isOwner — this is the first lock; the section must be absent for other viewers, not rendered empty`
);

// ---------------------------------------------------------------------------
// 3. No share control, no publication, no ordering
// ---------------------------------------------------------------------------
//
// explorer_favourites has is_public and Collections uses it. The equivalent
// here would be a published movement history, which is the one outcome the
// privacy review ruled out entirely.

check(
  !/is_public/.test(map),
  `${MAP}: names is_public — a personal map must not gain a publication flag`
);

check(
  !/\bshare\b|Share|explorer_memory_shares/.test(map),
  `${MAP}: has a share control — the review's conclusion holds only while one never exists`
);

check(
  !/setSort|sortOrder|sort_order/.test(map),
  `${MAP}: has a sort control — the review gave My Map no sort order`
);

check(
  !/supabase\s*\.\s*from\s*\(/.test(map),
  `${MAP}: reads a table directly — it goes through get_explorer_memories, which is SECURITY INVOKER so RLS decides what comes back`
);

// No write path of any kind. This screen shows; it does not change.
check(
  !/\.(insert|update|upsert|delete)\s*\(/.test(map),
  `${MAP}: writes — My Map is a read of your own archive`
);

// ---------------------------------------------------------------------------
// 4. The marker comes from utils/markers.js
// ---------------------------------------------------------------------------
//
// Packet 2's rule. A Memory's live/archived phase is not a fourth ink; it is
// said in words, which is also the only form a screen reader gets.

// `markerForMemory` on its own also matches the import line, so deleting every
// call site left this green the first time it was demonstrated. It counts calls
// instead: the component draws a pin in two places (the map marker and the
// fallback row) and both must derive it.
const markerCalls=[...map.matchAll(/markerForMemory\s*\(/g)].length;

check(
  markerCalls>=2,
  `${MAP}: derives its marker from utils/markers.js in ${markerCalls} place(s), expected both the map pin and the list row`
);

check(
  !/pinColor/.test(map),
  `${MAP}: sets pinColor — colour carries state, and it is not chosen per row`
);

const markers=code(read("utils/markers.js"));

check(
  /export function markerForMemory/.test(markers),
  "utils/markers.js: does not export markerForMemory"
);

check(
  /MARKER_STATES\.EXISTS/.test(markers.slice(markers.indexOf("markerForMemory"))),
  "utils/markers.js: markerForMemory does not use an existing marker state — a Memory's phase must not become a fourth ink"
);

// The phase is rendered as words somewhere in the component.
check(
  /phaseLabel/.test(map),
  `${MAP}: does not render the phase in words — colour is never the only carrier of meaning`
);

// ---------------------------------------------------------------------------
// 5. It does not assume a map
// ---------------------------------------------------------------------------
//
// app/map.js falls back to a list when no Google Maps key is set, and the
// ledger records that no key is set, which makes the fallback the shipping
// path. A My Map that only renders inside MapView would be blank in production.

check(
  /EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/.test(map),
  `${MAP}: does not check for a maps key — the brief is explicit that a map must not be assumed`
);

check(
  /apiKey\s*\n?\s*\?/.test(map) || /apiKey\s*\?/.test(map),
  `${MAP}: has no fallback branch for a missing maps key`
);

// An empty state is an instruction, not a mood. design-system.md bans the mood.
check(
  !/Nothing here yet|No memories yet|Nothing to see/i.test(read(MAP)),
  `${MAP}: uses a banned empty-state phrase — write an instruction`
);

check(
  /Keep a Memory/.test(map),
  `${MAP}: empty state does not tell a person what to do`
);

// ---------------------------------------------------------------------------

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nMy Map check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`My Map check passed (${passed} checks).`);
