#!/usr/bin/env node
"use strict";

// Packet 8f1: the living map.
//
// CLAUDE.md names the gap this closes as the highest-priority fix in the
// project: live data "lives on a separate /live screen and never reaches the
// main map". The failure mode this gate exists to prevent is the quiet one --
// the living layer being added to app/map.js only, which renders nothing today
// because no Google Maps key is set, leaving the shipping path untouched while
// every test goes green.

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

function code(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const MAP="app/map.js";
const LIST="components/PlacesList.js";
const MODEL="utils/liveActivity.js";
const MARKERS="utils/markers.js";

const map=code(read(MAP));
const list=code(read(LIST));
const model=code(read(MODEL));
const markers=code(read(MARKERS));

// ---------------------------------------------------------------------------
// 1. BOTH map surfaces are alive, not just the one behind an API key
// ---------------------------------------------------------------------------
//
// This is the check the whole packet turns on. app/map.js only renders when
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set, and it is not, so PlacesList is what
// a person actually sees. A living map in one file and not the other is the
// gap re-created one level down.

// Each of these matches a USE, not a mention. The first version of this block
// tested for the bare identifier, and three separate demonstrations passed
// against broken code: `get_live_discovery` still matched inside
// `get_live_discovery_DISABLED`, and `toActivities` / `ACTIVITY_STATE_SENTENCE`
// were both satisfied by the import line alone after every call site was
// deleted. A gate that a rename defeats is decoration.

for(const [file,source] of [[MAP,map],[LIST,list]]){
  check(
    /rpc\(\s*["']get_live_discovery["']/.test(source),
    `${file}: never calls get_live_discovery — the live layer must reach this surface, not only the other one`
  );
  check(
    /\btoActivities\s*\(/.test(source),
    `${file}: does not normalise live rows through ${MODEL}`
  );
  check(
    /\bactivitiesInWindow\s*\(/.test(source),
    `${file}: does not apply the time window`
  );
  check(
    /\bmarkerForActivity\s*\(/.test(source),
    `${file}: does not derive activity pins from ${MARKERS}`
  );
  check(
    /\bTIME_WINDOWS\s*\.\s*map\s*\(/.test(source),
    `${file}: does not render the Now / Tonight / Weekend filters`
  );
}

// app/map.web.js is what the WEB actually renders -- Metro's platform extension
// means app/map.js never loads there. It is legal for it to carry no living
// layer of its own only because it delegates entirely to PlacesList, which has
// one. If it ever grows its own implementation, the living map silently stops
// existing on the only platform currently in use.
const MAP_WEB="app/map.web.js";
const mapWeb=code(read(MAP_WEB));

check(
  /<PlacesList/.test(mapWeb),
  `${MAP_WEB}: does not delegate to PlacesList — the web map must not be a second implementation without the living layer`
);

check(
  !/MapView|react-native-maps/.test(mapWeb),
  `${MAP_WEB}: references the native map — react-native-maps has no web build`
);

// ---------------------------------------------------------------------------
// 2. No second read model
// ---------------------------------------------------------------------------
//
// get_live_discovery already returns Link-ups, check-ins, events and club
// sessions in one shape. Querying those tables directly from a map surface
// would be a second answer to the same question, free to disagree with the
// first -- RULES.md's "second table for the same noun", one layer up.

for(const [file,source] of [[MAP,map],[LIST,list]]){
  for(const table of ["linkups","live_checkins","activity_sessions"]){
    check(
      !new RegExp(`from\\(["']${table}["']\\)`).test(source),
      `${file}: reads ${table} directly — the live read model is get_live_discovery`
    );
  }
}

// The model itself must not grow a database call. It is a pure normaliser.
check(
  !/supabase|from\(|rpc\(/.test(model),
  `${MODEL}: touches the database — it is a pure read model over rows the caller fetched`
);

// ---------------------------------------------------------------------------
// 3. A signed-out visitor still gets a map
// ---------------------------------------------------------------------------
//
// get_live_discovery raises 'Explorer account required.' when auth.uid() is
// null. Calling it unconditionally would put an error on the map for every
// signed-out visitor, and the living layer is an addition, never a gate.

for(const [file,source] of [[MAP,map],[LIST,list]]){
  check(
    /getUser\(\)/.test(source) && /if\(!user\)/.test(source),
    `${file}: calls the live read model without checking for a signed-in Explorer first`
  );
}

// A failed live read must not empty the static pins.
for(const [file,source] of [[MAP,map],[LIST,list]]){
  check(
    /setActivities\(\[\]\)/.test(source),
    `${file}: does not fall back to an empty living layer — a live failure must leave the places alone`
  );
}

// ---------------------------------------------------------------------------
// 4. The time windows are pure and testable
// ---------------------------------------------------------------------------
//
// A filter whose behaviour depends on the wall clock cannot be tested, so every
// entry point takes the current time as an argument.

for(const fn of ["activityState","windowRange","inWindow","toActivity"]){
  check(
    new RegExp(`export function ${fn}\\([^)]*now=`).test(model),
    `${MODEL}: ${fn}() does not accept an injectable clock`
  );
}

// Every reading of the wall clock must be a default parameter value. Anything
// else is a function whose answer changes under a test that never moved time.
// `/now\(\)/` was the first version of this and matched `Date.now()` itself,
// so it failed on the correct code -- the check has to name the shape it wants,
// not the substring.
const clockReads=[...model.matchAll(/Date\.now\(\)/g)].length;
const injectedClocks=[...model.matchAll(/now=Date\.now\(\)/g)].length;

check(
  clockReads===injectedClocks,
  `${MODEL}: reads the clock somewhere other than a default parameter (${clockReads} reads, ${injectedClocks} injected)`
);

check(
  !/new Date\(\)/.test(model),
  `${MODEL}: constructs a Date from the wall clock — the clock is passed in`
);

// ---------------------------------------------------------------------------
// 5. Static places are not duplicated as "live"
// ---------------------------------------------------------------------------
//
// get_live_discovery returns a 'place' row for every reviewed business. The map
// already draws those as static pins, so letting them through would stack a
// second pin on the first and call the duplicate live.

check(
  /STATIC_KINDS/.test(model) && /"place"/.test(model),
  `${MODEL}: does not exclude the 'place' rows — they are already static pins on both surfaces`
);

// ---------------------------------------------------------------------------
// 6. The palette rule survives
// ---------------------------------------------------------------------------
//
// The product describes more event states than the design system has inks. The
// resolution is that words carry the difference, NOT a fourth colour.

check(
  /MARKER_STATES\.SCHEDULED/.test(markers.slice(markers.indexOf("markerForActivity"))),
  `${MARKERS}: markerForActivity does not use an existing marker state — a live pin must not become a fourth ink`
);

check(
  !/INK\.(live|now|red|green|orange|purple)/.test(markers),
  `${MARKERS}: names an ink outside the three — the palette does not grow to fit a state`
);

// Every activity state has a sentence, so colour is never the only carrier.
check(
  /ACTIVITY_STATE_SENTENCE/.test(model),
  `${MODEL}: has no spoken sentence per activity state`
);

for(const [file,source] of [[MAP,map],[LIST,list]]){
  // Indexed, not merely imported.
  check(
    /ACTIVITY_STATE_SENTENCE\s*\[/.test(source),
    `${file}: renders activity pins without saying the state in words`
  );
}

// ---------------------------------------------------------------------------
// 7. Live things are reachable
// ---------------------------------------------------------------------------
//
// A pin that cannot be opened answers "what is happening" and not "how do I
// join", which is the next question in CLAUDE.md's list.

for(const [file,source] of [[MAP,map],[LIST,list]]){
  check(
    /deepLink/.test(source),
    `${file}: activity rows have no route — the loop needs See → Decide → Join`
  );
}

// An empty state is an instruction, not a mood.
check(
  !/Nothing here yet/i.test(list),
  `${LIST}: uses a banned empty-state phrase — write an instruction`
);

// ---------------------------------------------------------------------------

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nLiving map check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Living map check passed (${passed} checks).`);
