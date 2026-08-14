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

// Packet 21 split the map screen three ways: the rules into a hook, the
// interface into one screen, the drawing into a per-platform renderer. These
// constants follow the rules to where they live now.
const MAP="components/LivingMap.js";
const SCREEN="components/LivingMapScreen.js";
const LIST="components/PlacesList.js";
const PANEL="components/PlacePanel.js";
const MODEL="utils/placeCards.js";

// ---------------------------------------------------------------------------
// 1. The map stays uncontrolled
// ---------------------------------------------------------------------------

const map=code(read(MAP));

// MapLibre v11's uncontrolled camera is `initialViewState`; react-native-maps'
// was `initialRegion`. Different name, same rule: the map is told where to
// start once and never told where to be again. The controlled forms -- a bare
// `center` on the Camera, react-native-maps' `region` -- drag it back on every
// render, which is exactly what "map position unchanged after opening, swiping
// and dismissing a card" forbids.
//
// THIS CHECK USED TO ASSERT `defaultSettings`, WHICH IS THE v10 NAME.
//
// So it passed while the real prop was being ignored, and reported a camera
// that had never been configured as correctly configured. The map opened on the
// whole world on a phone and this gate said it was fine. Asserting the name of
// a prop is worth nothing unless something also checks the prop EXISTS --
// that is scripts/verify-native-map-props.cjs, which reads the installed
// package's own type definitions.
check(
  /initialViewState=\{/.test(map),
  `${MAP}: the MapLibre Camera must be given initialViewState`
);
check(
  !/<Camera[^>]*\s(centerCoordinate|center)=\{/.test(map),
  `${MAP}: the Camera must not take a center prop — a controlled camera is dragged back to a fixed point on every render`
);
// There used to be a third check here, on components/LivingMap.legacy.js: the
// react-native-maps map, kept behind a switch until the MapLibre one had been
// seen on a real phone. It has been, so the file, the switch, the dependency
// and the Google Maps configuration are all gone -- and with them the last
// third-party logo in the app.

// ---------------------------------------------------------------------------
// 1b. Directions live INSIDE the panel, not beside it
// ---------------------------------------------------------------------------
//
// components/PlaceCards.js used to be a swipeable "1 of 8 nearby" sheet at
// bottom:12, and the Directions card sat at bottom:12 too -- the same corner,
// so asking for a route put a place card over the answer. The owner: "I don't
// want that place card to come up... it gets in the way of the directions",
// and Directions should carry "the hero image, the review score and a brief
// summary, all in one thing".
//
// One panel cannot cover itself, so the rule is that there is only one.
check(
  /<Directions/.test(code(read(PANEL))),
  `${PANEL}: must render Directions itself — a separate directions card in the same corner is what the panel replaced`
);
check(
  !/<Directions/.test(code(read(SCREEN))),
  `${SCREEN}: must not render Directions beside the panel — that is the overlap this replaced`
);

// The swipe is gone with it. Swiping to a place nobody tapped answered a
// question nobody asked, and browsing belongs on Discover.
for(const surface of [SCREEN,LIST,PANEL]){
  check(
    !/cardsAround\(|PlaceCards/.test(code(read(surface))),
    `${surface}: the swipeable place-card sheet is gone — one panel for the place that was tapped`
  );
}

// ---------------------------------------------------------------------------
// 2. Both surfaces offer the card, and neither assumes a map
// ---------------------------------------------------------------------------

for(const surface of [SCREEN,LIST]){
  const content=code(read(surface));

  check(
    /<PlacePanel/.test(content),
    `${surface}: does not offer the place panel`
  );
}

// The panel shows what the owner asked it to show, and each piece comes from
// the one place that decides it.
const panel=code(read(PANEL));
for(const [pattern,what] of [
  [/heroImageFor\(/,"the hero image"],
  [/loadPlaceRating\(/,"the review score"],
  [/summaryFor\(/,"a short summary"]
]){
  check(pattern.test(panel),`${PANEL}: must show ${what}`);
}

// The list must not import a native-only map library: it is what renders when
// the map will not, and on web react-native-maps has no build at all.
check(
  !/react-native-maps/.test(code(read(LIST))),
  `${LIST}: must not import react-native-maps — it is the surface that runs when the map does not`
);
check(
  !/react-native-maps/.test(code(read(PANEL))),
  `${PANEL}: must not import react-native-maps — the panel is shown with and without a map`
);

// THE OPPOSITE OF WHAT THIS USED TO CHECK.
//
// It required the Google key to be read inside the component, so that the
// no-key fallback could be tested -- because the fallback was the shipping path
// and the map was the branch nobody ever saw. Packet 21 ended that: the map
// needs no key at all, on any platform, and a key appearing here again would
// mean the primary map had gone back to needing billing.
for(const surface of [MAP,SCREEN,"components/LivingMap.web.js","hooks/useLivingMap.js"]){
  check(
    !/GOOGLE_MAPS_API_KEY|MAPBOX_TOKEN/.test(code(read(surface))),
    `${surface}: the map wants an API key — MapLibre and OpenFreeMap need none, and that is the point of the stack`
  );
}

// ---------------------------------------------------------------------------
// 3. Reduced motion
// ---------------------------------------------------------------------------
//
// The sliding modal this rule was written for is gone with components/
// PlaceCards.js. The panel does not animate at all, so the honest version of
// "reduced motion disables all of it" is that there is no motion to disable --
// and the way to keep that true is to refuse one being added quietly.
check(
  !/Animated|animationType|LayoutAnimation/.test(panel),
  `${PANEL}: the panel does not animate. Adding one needs the reduced-motion branch that components/PlaceCards.js used to carry.`
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

// ---------------------------------------------------------------------------
// 5. The colours are tokens
// ---------------------------------------------------------------------------

const tokens=new Set(
  [...read("docs/design-system.md").matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

for(const file of [PANEL,MODEL]){
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
