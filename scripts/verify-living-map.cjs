#!/usr/bin/env node
"use strict";

// The living map: one brain, every surface.
//
// WHAT THIS USED TO CHECK, AND WHY IT CHANGED
//
// Packet 8f1 shipped the living layer into TWO files -- app/map.js and
// components/PlacesList.js -- because they were two implementations of the same
// screen. This gate existed to stop the layer being added to one and not the
// other, which would have looked complete while the shipping path stayed dead.
//
// Packet 21 removed the duplication rather than policing it. Both surfaces now
// render one screen over one hook. So the checks moved with the rules: what has
// to hold is that the live layer has exactly one source, that no screen has
// grown its own again, and that the list survives as a view of the same model.
//
// The count went UP. A gate that loses checks during a migration is a gate that
// stopped working.

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

const BRAIN="hooks/useLivingMap.js";
const SCREEN="components/LivingMapScreen.js";
const MAP="app/map.js";
const WEB="app/map.web.js";
const LIST="components/PlacesList.js";
const MODEL="utils/liveActivity.js";
const MARKERS="utils/markers.js";
const PROVIDER="utils/mapProvider.js";

const brain=code(read(BRAIN));
const screen=code(read(SCREEN));
const list=code(read(LIST));
const model=code(read(MODEL));
const markers=code(read(MARKERS));

// ---------------------------------------------------------------------------
// 1. The live layer has exactly one source
// ---------------------------------------------------------------------------

check(
  /rpc\(\s*["']get_live_discovery["']/.test(brain),
  `${BRAIN}: never calls get_live_discovery — the live layer has to come from somewhere`
);
check(/\btoActivities\s*\(/.test(brain),`${BRAIN}: does not normalise live rows through ${MODEL}`);
check(/\bactivitiesInWindow\s*\(/.test(brain),`${BRAIN}: does not apply the time window`);
check(/\bmarkerForActivity\s*\(/.test(brain),`${BRAIN}: does not derive activity pins from ${MARKERS}`);

// The filters moved behind an icon (components/MapControls.js) because the
// owner asked for the map to be clean: "put the search behind an icon button
// and same for the filters". So the screen HANDS the windows over rather than
// drawing them, and the check follows them to where they went.
const CONTROLS="components/MapControls.js";
const controls=code(read(CONTROLS));

check(
  /timeWindows=\{TIME_WINDOWS\}/.test(screen) && /timeWindows\s*\.\s*map\s*\(/.test(controls),
  `${SCREEN}/${CONTROLS}: does not render the Now / Tonight / Weekend filters`
);

// ---------------------------------------------------------------------------
// 2. And no surface may grow a second one
// ---------------------------------------------------------------------------
//
// This is the check that replaces the old pair, and it is stronger: the old one
// asked whether both copies were up to date, this one asks whether a copy
// exists at all.

for(const file of [MAP,WEB,SCREEN,LIST]){
  const source=code(read(file));
  check(
    !/rpc\(\s*["']get_live_discovery["']/.test(source),
    `${file}: calls get_live_discovery itself — the live read belongs to ${BRAIN}, once`
  );
  check(
    !/\bsupabase\b/.test(source),
    `${file}: reads the database directly — every surface goes through ${BRAIN}`
  );
}

for(const file of [MAP,WEB]){
  check(
    /<LivingMapScreen\s*\/>/.test(code(read(file))),
    `${file}: does not render LivingMapScreen — two platforms with two screens is how a layer goes missing on one of them`
  );
}

// ---------------------------------------------------------------------------
// 3. The list survives, as a view rather than a fallback
// ---------------------------------------------------------------------------
//
// "Do not delete PlacesList. It remains valuable for accessibility, degraded
// map operation, map-load failures and non-spatial browsing. However, it should
// no longer exist because Xplorer is incapable of rendering a map."

check(
  /useLivingMap\(\)/.test(list),
  `${LIST}: does not use ${BRAIN} — the list must be a view of the Living Map, not a second one`
);
check(
  /<PlacesList/.test(screen),
  `${SCREEN}: the list is unreachable — it is kept for map failures, screen readers and non-spatial browsing`
);

// ---------------------------------------------------------------------------
// 4. No second read model for what is happening
// ---------------------------------------------------------------------------

for(const table of ["linkups","live_checkins","activity_sessions"]){
  check(
    !new RegExp(`from\\(["']${table}["']\\)`).test(brain),
    `${BRAIN}: reads ${table} directly — the live read model is get_live_discovery`
  );
}

check(
  !/supabase|from\(|rpc\(/.test(model),
  `${MODEL}: touches the database — it is a pure read model over rows the caller fetched`
);

// ---------------------------------------------------------------------------
// 5. A signed-out visitor still gets a map, and a live failure leaves it alone
// ---------------------------------------------------------------------------

check(
  /getUser\(\)/.test(brain) && /if\(!user\)/.test(brain),
  `${BRAIN}: calls the live read model without checking for a signed-in Explorer first`
);

check(
  /setActivities\(\[\]\)/.test(brain),
  `${BRAIN}: does not fall back to an empty living layer — a live failure must leave the places alone`
);

// A row with no location must not be plotted at 0,0. Number(null) is 0 and
// Number.isFinite(0) is true, which is how it used to happen.
check(
  /hasCoordinates/.test(brain),
  `${BRAIN}: does not validate coordinates — a listing with no location lands in the Gulf of Guinea`
);

// ---------------------------------------------------------------------------
// 6. The time windows are pure and testable
// ---------------------------------------------------------------------------

for(const fn of ["activityState","windowRange","inWindow","toActivity"]){
  check(
    new RegExp(`export function ${fn}\\([^)]*now=`).test(model),
    `${MODEL}: ${fn}() does not accept an injectable clock`
  );
}

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
// 7. Static places are not duplicated as "live"
// ---------------------------------------------------------------------------

check(
  /STATIC_KINDS/.test(model) && /"place"/.test(model),
  `${MODEL}: does not exclude the 'place' rows — they are already static pins`
);

// ---------------------------------------------------------------------------
// 8. The palette rule survives
// ---------------------------------------------------------------------------

check(
  /MARKER_STATES\.SCHEDULED/.test(markers.slice(markers.indexOf("markerForActivity"))),
  `${MARKERS}: markerForActivity does not use an existing marker state — a live pin must not become a fourth ink`
);

check(
  !/INK\.(live|now|orange|purple)/.test(markers),
  `${MARKERS}: names an ink outside the table — the palette does not grow to fit a state`
);

check(
  /ACTIVITY_STATE_SENTENCE/.test(model),
  `${MODEL}: has no spoken sentence per activity state`
);

check(
  /ACTIVITY_STATE_SENTENCE\s*\[/.test(list),
  `${LIST}: renders activity rows without saying the state in words`
);

// ---------------------------------------------------------------------------
// 9. Live things are reachable
// ---------------------------------------------------------------------------

for(const file of [SCREEN,LIST]){
  check(
    /deepLink/.test(code(read(file))),
    `${file}: activity rows have no route — the loop needs See → Decide → Join`
  );
}

check(
  !/Nothing here yet/i.test(list),
  `${LIST}: uses a banned empty-state phrase — write an instruction`
);

// ---------------------------------------------------------------------------
// 10. The provider is isolated, and needs no key
// ---------------------------------------------------------------------------
//
// "We may keep this setup long term. We may replace it later. Do not couple
// Xplorer's product logic to OpenFreeMap." So the hostname lives in exactly one
// file, and changing that file changes the map on every platform.

const provider=code(read(PROVIDER));

check(
  /tiles\.openfreemap\.org/.test(provider),
  `${PROVIDER}: does not name a provider — something has to`
);

const everywhereElse=["app","components","hooks","utils"];
const offenders=[];
(function walk(dir){
  const full=path.join(root,dir);
  for(const entry of fs.readdirSync(full,{withFileTypes:true})){
    const relative=`${dir}/${entry.name}`;
    if(entry.isDirectory()){walk(relative);continue;}
    if(!entry.name.endsWith(".js")) continue;
    if(relative===PROVIDER) continue;
    if(/openfreemap|openmaptiles|tiles\./.test(code(read(relative)))) offenders.push(relative);
  }
})("utils");
for(const dir of ["app","components","hooks"]){
  (function walk(d){
    for(const entry of fs.readdirSync(path.join(root,d),{withFileTypes:true})){
      const relative=`${d}/${entry.name}`;
      if(entry.isDirectory()){walk(relative);continue;}
      if(!entry.name.endsWith(".js")) continue;
      if(/openfreemap|openmaptiles/.test(code(read(relative)))) offenders.push(relative);
    }
  })(dir);
}

check(
  offenders.length===0,
  `provider configuration has escaped ${PROVIDER} into: ${offenders.join(", ")}`
);

// Attribution is a licence condition, not decoration.
check(
  /ATTRIBUTION/.test(provider) && /OpenStreetMap/.test(provider),
  `${PROVIDER}: no attribution string — the data is OpenStreetMap's and the licence requires it on the map`
);

// No key, no token, no card. That is the whole reason for this stack.
for(const file of [BRAIN,SCREEN,PROVIDER,"components/LivingMap.web.js"]){
  const source=code(read(file));
  check(
    !/GOOGLE_MAPS_API_KEY|MAPBOX_TOKEN|accessToken/.test(source),
    `${file}: the primary map wants an API key — MapLibre and OpenFreeMap need none`
  );
}

// The controls decide nothing. Every value and setter is passed in, so this
// file cannot grow a second opinion about what a filter means.
check(
  !/supabase|useLivingMap/.test(controls),
  `${CONTROLS}: reads the database or the map hook. It is a surface for controls, not a second brain.`
);

// Both panels closed to start with, and both able to close again -- the owner
// asked for "so they can be hidden after as well".
check(
  /PANELS\.NONE/.test(code(read(SCREEN))),
  `${SCREEN}: the map must open with no panel showing`
);
check(
  /open===panel \? PANELS\.NONE : panel/.test(controls),
  `${CONTROLS}: an icon must toggle its panel shut as well as open`
);

// ---------------------------------------------------------------------------
// The heat layer, and the one rule in it that is a privacy rule
// ---------------------------------------------------------------------------
//
// The owner asked for Snapchat's heatmap: "if people post a public moment it
// gets hot". The word that matters is PUBLIC.
//
// The heat used to be computed in hooks/useLivingMap.js from whatever the
// VIEWER could see -- Moments, Memories and reviews, friends-only ones
// included. Two consequences nobody intended: everybody's heatmap was a
// different map, so a patch warm for you alone was a statement about one of
// your friends; and it needed a floor of three posts from two Explorers to
// paper over exactly that.
//
// get_moment_heat() (20260814000000) is the only source now, and it returns
// public Moments only -- the post's audience AND the author's profile ceiling
// both 'everyone'. If this file ever goes back to counting rows it read
// itself, the leak comes back with it.

const HEAT="utils/heatmap.js";
const heatBrain=code(read(BRAIN));

check(
  /supabase\.rpc\("get_moment_heat"\)/.test(heatBrain),
  `${BRAIN}: the heat must come from get_moment_heat() — it is the only thing that knows what "public" means`
);
check(
  !/heatCells\(/.test(heatBrain),
  `${BRAIN}: builds heat from rows it read itself. That puts friends-only posts back in a layer every Explorer can see.`
);

const heatmap=code(read(HEAT));

// Ground, and it gets out of the way before it can point at a building.
check(
  /HEAT_FADE_END/.test(heatmap) && /heatOpacityAt/.test(heatmap),
  `${HEAT}: the heat must fade out as the map zooms in`
);
for(const renderer of ["components/LivingMap.js","components/LivingMap.web.js"]){
  check(
    /heatOpacityAt\(/.test(code(read(renderer))),
    `${renderer}: draws heat without the zoom fade — a density field at street level puts a hot spot on one building`
  );
  // A renderer draws; it does not decide what a colour means.
  check(
    /heatmapPaint\(/.test(code(read(renderer))),
    `${renderer}: must take the heat paint from utils/markers.js rather than choosing colours`
  );
}

// A point is a position and a weight. The function returns no id, no author and
// no view count, and nothing in the app may add one back.
check(
  !/user_id|\bid\b\s*:/.test(heatmap.split("export function heatPoints")[1] || ""),
  `${HEAT}: a heat point carries something other than its weight`
);

// ---------------------------------------------------------------------------

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nLiving map check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Living map check passed (${passed} checks).`);
