#!/usr/bin/env node

// Packet 6: map bottom cards.
//
// test/map-cards.test.js proves the card behaves. This proves the two things a
// behaviour test cannot see: that the map is still uncontrolled, and that the
// feature does not assume a map exists.
//
// The second is the one the brief is emphatic about -- "Works with the current
// list fallback when no Maps API key is set (per PROJECT-LOG, this is the
// shipping state -- do not assume a map)". No key is set, so a card that only
// worked on react-native-maps would be a feature nobody could reach.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];
let passed=0;

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative}: file is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

function code(content){
  return content
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const MAP="app/map.js";
const LIST="components/PlacesList.js";
const SHEET="components/PlaceCards.js";
const MODEL="utils/placeCards.js";

// ---------------------------------------------------------------------------
// 1. The map stays uncontrolled
// ---------------------------------------------------------------------------

const map=code(read(MAP));

check(
  /initialRegion=\{/.test(map),
  `${MAP}: MapView must be given an initialRegion`
);
check(
  !/<MapView[^>]*\sregion=\{/.test(map),
  `${MAP}: MapView must not take a region prop — a controlled map is dragged back to a fixed point on every render, which is exactly what "map position unchanged" forbids`
);

// The sheet is a Modal, so it renders outside the map's view tree. Inside it,
// every card open would re-render the map.
check(
  /<Modal/.test(code(read(SHEET))),
  `${SHEET}: the card must render in a Modal, so opening one cannot re-render the map beneath it`
);

// ---------------------------------------------------------------------------
// 2. Both surfaces offer the card, and neither assumes a map
// ---------------------------------------------------------------------------

for(const surface of [MAP,LIST]){
  const content=code(read(surface));

  check(
    /<PlaceCards/.test(content),
    `${surface}: does not offer the bottom card`
  );
  check(
    /cardsAround\(/.test(content),
    `${surface}: must build its card set with cardsAround(), so the tapped place stays first`
  );
}

// The list fallback is the shipping path and must not import the map library.
check(
  !/react-native-maps/.test(code(read(LIST))),
  `${LIST}: must not import react-native-maps — it is the surface that runs when there is no map`
);
check(
  !/react-native-maps/.test(code(read(SHEET))),
  `${SHEET}: must not import react-native-maps — the card is shown with and without a map`
);

// Read inside the component, not at module scope, or the fallback cannot be
// exercised by a test and the shipping path stays unverified.
check(
  /const apiKey=process\.env\.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/.test(map),
  `${MAP}: the API key must be read inside the component so both paths are testable`
);

// ---------------------------------------------------------------------------
// 3. Reduced motion
// ---------------------------------------------------------------------------
//
// design-system.md: "prefers-reduced-motion: reduce disables all of it."

const sheet=code(read(SHEET));

check(
  /isReduceMotionEnabled/.test(sheet),
  `${SHEET}: must ask whether reduced motion is on`
);
check(
  /animationType=\{reduceMotion\s*\?\s*"none"/.test(sheet),
  `${SHEET}: must not slide when reduced motion is on`
);

// ---------------------------------------------------------------------------
// 4. No new dependency crept in
// ---------------------------------------------------------------------------
//
// RULES.md: "Ask before adding a dependency." Dragging and swiping were built
// with PanResponder and a paging ScrollView, both from react-native, so nothing
// had to be asked for.

const packageJson=read("package.json");

for(const banned of ["react-native-gesture-handler","react-native-reanimated","@gorhom/bottom-sheet"]){
  check(
    !packageJson.includes(`"${banned}"`),
    `package.json: ${banned} was added — the card was built with react-native's own PanResponder and ScrollView, and a new dependency needs asking for first`
  );
}

check(
  /PanResponder/.test(sheet),
  `${SHEET}: the drag is built on PanResponder`
);

// ---------------------------------------------------------------------------
// 5. The colours are tokens
// ---------------------------------------------------------------------------

const tokens=new Set(
  [...read("docs/design-system.md").matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

for(const file of [SHEET,MODEL]){
  for(const match of read(file).matchAll(/#[0-9A-Fa-f]{6}\b/g)){
    check(
      tokens.has(match[0].toUpperCase()),
      `${file}: ${match[0]} is not in the docs/design-system.md token table`
    );
  }
}

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Map card check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Map card check passed (${passed} checks).`);
