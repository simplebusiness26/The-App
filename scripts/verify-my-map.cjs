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
// My Map draws with the app's own map now, and that changed what has to be
// checked here.
//
// It used to draw with react-native-maps behind an EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
// check -- and the key was never set, so the "map" was a list wearing a map's
// name. There is no key any more because MapLibre needs none, so the thing to
// verify is no longer "does it cope without a key" but "does it cope without a
// working map", which is a real failure and not a configuration one.
const PINS="components/MemoryPins.js";
const pins=code(read(PINS));

check(
  /from\s+"\.\/LivingMap"/.test(pins),
  `${PINS}: does not draw with the app's own map — a second map component is a second camera to get wrong and a second logo to forget to turn off`
);

check(
  /onUnavailable/.test(pins),
  `${PINS}: has no fallback for a map that cannot run — no WebGL and a dead tile host are real, and a blank rectangle is the worst answer to either`
);

check(
  /MemoryRow/.test(pins),
  `${PINS}: the fallback must be the Memory list, which is also the surface a screen reader wants`
);

// ---------------------------------------------------------------------------
// 6. react-native-maps is gone, and stays gone
// ---------------------------------------------------------------------------
//
// This check used to be subtler: react-native-maps declares no `browser` entry,
// so importing it from anything the web bundle reaches pulled a native-only
// module into web. 8b imported MapView into components/MyMap.js,
// ExplorerProfileScreen imports MyMap, and every profile on web went blank.
// Jest could not catch it -- test/setup.js mocked react-native-maps, and the
// mock is exactly what made the native-only import look fine.
//
// The whole library is now removed: MapLibre draws both maps, on all three
// platforms, with no key and no Google logo. So the rule is no longer "only
// with a .web.js sibling". It is simply: not at all, anywhere.

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
  const source=code(read(file));
  check(
    !/from\s+["']react-native-maps["']/.test(source),
    `${file}: imports react-native-maps — it was removed with the Google map. Draw with components/LivingMap.`
  );
}

check(
  !Object.keys(JSON.parse(read("package.json")).dependencies || {}).includes("react-native-maps"),
  "package.json: react-native-maps is back in dependencies — the Google map was removed on purpose, and with it the only map in this app that carried somebody else's logo"
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
