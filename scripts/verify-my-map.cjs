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
// instead, and across both pin renderers -- the native map marker and the
// shared row -- because the platform split moved them out of MyMap.js.
const pinSources=["components/MemoryRow.js","components/MemoryPins.js"]
  .map((file)=>code(read(file)))
  .join("\n");
const markerCalls=[...pinSources.matchAll(/markerForMemory\s*\(/g)].length;

check(
  markerCalls>=2,
  `components/MemoryRow.js + components/MemoryPins.js: derive their marker from utils/markers.js in ${markerCalls} place(s), expected both the map pin and the list row`
);

check(
  !/markerForMemory|PlaceMarker/.test(map),
  `${MAP}: draws a pin itself — it owns the data and the guards, the platform-split renderers own the drawing`
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

// The phase is rendered as words wherever a Memory is drawn.
check(
  /phaseLabel\s*\(/.test(pinSources),
  "components/MemoryRow.js + components/MemoryPins.js: do not render the phase in words — colour is never the only carrier of meaning"
);

// ---------------------------------------------------------------------------
// 5. It does not assume a map
// ---------------------------------------------------------------------------
//
// app/map.js falls back to a list when no Google Maps key is set, and the
// ledger records that no key is set, which makes the fallback the shipping
// path. A My Map that only renders inside MapView would be blank in production.

// The key check lives in the native pin renderer now, not here.
const PINS="components/MemoryPins.js";
const PINS_WEB="components/MemoryPins.web.js";
const pins=code(read(PINS));

check(
  /EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/.test(pins),
  `${PINS}: does not check for a maps key — the brief is explicit that a map must not be assumed`
);

check(
  /if\(!apiKey\)/.test(pins),
  `${PINS}: has no fallback branch for a missing maps key`
);

// ---------------------------------------------------------------------------
// 6. react-native-maps must never be reachable from a web route
// ---------------------------------------------------------------------------
//
// This is the check that would have saved a broken profile screen.
//
// react-native-maps declares no `browser` entry, so importing it from anything
// the web bundle reaches pulls a native-only module into web. `app/map.web.js`
// has existed for exactly that reason since the map was built. 8b imported
// MapView directly into components/MyMap.js, ExplorerProfileScreen imports
// MyMap, and every profile on web went blank.
//
// Jest could not catch it: test/setup.js mocks react-native-maps, and the mock
// is precisely what makes the native-only import look fine. So this is a source
// rule, not a test.

check(
  !/react-native-maps/.test(map),
  `${MAP}: imports react-native-maps — it has no web build, and this file is reachable from a web route. Put the map in a platform-split component (see ${PINS_WEB})`
);

check(
  !/react-native-maps/.test(code(read(PINS_WEB))),
  `${PINS_WEB}: imports react-native-maps — the whole point of the .web.js split is that this file does not`
);

check(
  /react-native-maps/.test(pins),
  `${PINS}: no longer renders a real map — if the native map is gone, delete the split rather than leaving an empty half`
);

// Any component the profile can reach must be clean. A future MyMap that
// imports a map helper which imports react-native-maps would reintroduce this.
// The general rule, over every screen and component: a file may import
// react-native-maps ONLY if a .web.js sibling exists to replace it on web.
// app/map.js is legal because app/map.web.js exists; MemoryPins.js is legal
// because MemoryPins.web.js exists. Anything else is the 8b bug again.
function jsFilesUnder(dir){
  const found=[];
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const rel=`${dir}/${entry.name}`;
    if(entry.isDirectory()) found.push(...jsFilesUnder(rel));
    else if(entry.name.endsWith(".js")) found.push(rel);
  }
  return found;
}

for(const file of [...jsFilesUnder("app"),...jsFilesUnder("components")]){
  if(file.endsWith(".web.js")) continue;
  const source=code(read(file));
  if(!/from\s+["']react-native-maps["']/.test(source)) continue;

  const sibling=file.replace(/\.js$/,".web.js");
  check(
    fs.existsSync(path.join(root,sibling)),
    `${file}: imports react-native-maps but has no ${sibling} — it has no web build, so a web route reaching this file renders a blank screen`
  );
}

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
