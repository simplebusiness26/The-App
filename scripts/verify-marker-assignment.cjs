#!/usr/bin/env node

// Packet 2 acceptance: "No code path lets a manager set a marker directly."
//
// test/markers.test.js proves the assignment is a correct pure function. It
// cannot prove the absence of a second way in, because absence is not something
// a unit test observes -- so that half is checked here, at the source.
//
// The rule being defended is from design-system.md: colour carries state, the
// icon carries type. A manager who can pick a pin colour can say "an offer is
// running" with no offer, and the three inks stop meaning anything the moment
// one of them can be chosen for looking nice.

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

function filesUnder(dir,extension){
  const found=[];
  const absolute=path.join(root,dir);
  if(!fs.existsSync(absolute)) return found;

  for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const child=path.join(dir,entry.name);
    if(entry.isDirectory()) found.push(...filesUnder(child,extension));
    else if(entry.name.endsWith(extension)) found.push(child);
  }
  return found;
}

const MARKERS="utils/markers.js";
const PIN="components/PlaceMarker.js";
const PREVIEW="components/MarkerPreview.js";
const TOKENS="utils/tokens.js";
const DESIGN_SYSTEM="docs/design-system.md";

// Every check below reads code, not prose. Without this the script fails a file
// for explaining in a comment what it must not do -- which punishes exactly the
// commenting this repository is written in.
function code(content){
  return content
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

// ---------------------------------------------------------------------------
// 1. The database stores no marker
// ---------------------------------------------------------------------------
//
// A marker is derived, so there is nothing to store. A column would be a place
// for a manager-set value to live, and a place for the derived answer and the
// stored one to disagree.

// A marker-ish name followed by a SQL type is a column declaration. Matching
// the bare word instead would fail the taxonomy migration for the comment that
// explains why free-text categories meant no marker could be derived.
const MARKER_COLUMN_DDL=/\b(marker\w*|pin_colou?r|pin_icon|map_icon)\s+(text|jsonb|json|varchar|integer|boolean|uuid)\b/i;

for(const migration of filesUnder("supabase/migrations",".sql")){
  const content=fs.readFileSync(path.join(root,migration),"utf8");
  check(
    !MARKER_COLUMN_DDL.test(content),
    `${migration}: declares a marker column — markers are derived from the classification, never stored`
  );
}

// ---------------------------------------------------------------------------
// 2. No screen writes one
// ---------------------------------------------------------------------------
//
// Only unambiguous field names are banned. A local variable called `marker` is
// not a marker override, and neither is the `marker` prop PlaceMarker takes --
// what must not exist is a marker-shaped column being read or written.

const MARKER_FIELD=/\b(marker_colou?r|marker_icon|marker_state|pin_colou?r|pin_icon|map_icon)\b/;

for(const source of [...filesUnder("app",".js"),...filesUnder("components",".js")]){
  const content=code(fs.readFileSync(path.join(root,source),"utf8"));

  check(
    !MARKER_FIELD.test(content),
    `${source}: names a marker field — the marker comes from ${MARKERS}, it is not a value to store`
  );

  // The old map pins used pinColor, one hardcoded colour per listing kind.
  // That is type choosing colour, which is the thing this packet removed.
  check(
    !/pinColor/.test(content),
    `${source}: sets pinColor — colour carries state, so it cannot be chosen per listing kind`
  );
}

// ---------------------------------------------------------------------------
// 3. The preview is a preview
// ---------------------------------------------------------------------------

const preview=code(read(PREVIEW));

check(
  !/onChange|onSelect|onPress|setMarker/.test(preview),
  `${PREVIEW}: has a handler — it shows the marker the classification produces, it does not let one be chosen`
);
check(
  /markerForBusiness/.test(preview),
  `${PREVIEW}: does not derive its marker from ${MARKERS}`
);

// ---------------------------------------------------------------------------
// 4. The assignment takes no override
// ---------------------------------------------------------------------------

const markers=code(read(MARKERS));

check(
  !/export\s+(const|function)\s+set[A-Z]/.test(markers),
  `${MARKERS}: exports a setter — marker assignment is a pure function of the classification`
);
check(
  !/\b(glyphOverride|markerOverride|forceGlyph|forceColou?r|customMarker)\b/.test(markers),
  `${MARKERS}: accepts an override`
);

// ---------------------------------------------------------------------------
// 4b. The overprint is a channel, not a colour
// ---------------------------------------------------------------------------
//
// design-system.md: "a place hosting something. A second pink disc sits behind
// ... Deliberate misregistration". It exists because the product names more
// states than the palette has inks, and the alternative was a fourth colour --
// the one thing the palette rule forbids. So it must stay derived, and it must
// never introduce an ink of its own.

check(
  /overprint:hosting===true/.test(markers),
  `${MARKERS}: the overprint is not derived — a caller must not be able to switch the signature on`
);

const pinSource=code(read(PIN));

check(
  /marker\.overprint===true/.test(pinSource),
  `${PIN}: does not read the derived overprint flag`
);

check(
  /fill=\{marker\.fill\}/.test(pinSource),
  `${PIN}: the overprint disc does not reuse the marker's own ink — it must not introduce a colour`
);

// design-system.md, Pins: "Don't add a second signature."
check(
  !/(pulse|glow|halo|shadowRadius)/i.test(pinSource),
  `${PIN}: adds a second signature — the overprint is the only one, and a glow is banned outright`
);

const pin=code(read(PIN));

// PlaceMarker draws a descriptor and decides nothing. If it starts reading a
// classification it has become a second assignment, free to disagree with the
// first.
check(
  !/from\s+["'][^"']*taxonomy["']/.test(pin),
  `${PIN}: reads the taxonomy — it draws the marker ${MARKERS} worked out, it does not assign one`
);

// ---------------------------------------------------------------------------
// 5. Every colour is a token
// ---------------------------------------------------------------------------
//
// designer.md check 1, run automatically: "Any hex not in docs/design-system.md
// is a defect." Scoped to the files this packet introduced -- the older screens
// are full of untokenised colour and belong to Packet 11.

const tokens=new Set(
  [...read(DESIGN_SYSTEM).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

check(tokens.size>0,`${DESIGN_SYSTEM}: no colour tokens parsed — the token table has moved or changed shape`);

// Packet 20 finished: EVERY file in app/ and components/ is on the token table
// now, so the list is no longer a list. It is "all of them, except the map".
//
// The four map surfaces are excluded because Packet 21 rebuilds them on
// MapLibre for web, Android and iOS. Styling a file that is about to be
// replaced is work thrown away twice, and an exclusion with a reason and an
// end date is better than a colour that quietly never gets fixed.
//
// Hex inside a COMMENT is allowed. Several files explain which colour they used
// to be and why it went; deleting that sentence to satisfy a grep would throw
// away the reason and keep the rule.
const SKIP=new Set([
  "app/map.js",
  "app/map.web.js",
  "components/PlacesList.js",
  "components/MemoryPins.js"
]);

function everyScreen(dir,found=[]){
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const relative=`${dir}/${entry.name}`;
    if(entry.isDirectory()){everyScreen(relative,found);continue;}
    if(entry.name.endsWith(".js")) found.push(relative);
  }
  return found;
}

const TOKENISED=[...new Set([
  TOKENS,MARKERS,PIN,PREVIEW,
  ...everyScreen("app"),
  ...everyScreen("components")
])].filter((file)=>!SKIP.has(file));

for(const source of TOKENISED){
  const content=code(read(source));

  for(const match of content.matchAll(/#[0-9A-Fa-f]{6}\b/g)){
    check(
      tokens.has(match[0].toUpperCase()),
      `${source}: ${match[0]} is not in the ${DESIGN_SYSTEM} token table`
    );
  }
}

// The other direction, and the one that actually prevents drift: utils/tokens.js
// is the document's table in code, so the two must hold exactly the same
// colours. Without this, a colour could be dropped from the design system and
// live on in code, or added to code and never documented.
const inCode=new Set(
  [...read(TOKENS).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

for(const token of tokens){
  check(inCode.has(token),`${TOKENS}: ${token} is in ${DESIGN_SYSTEM} but not in the code table`);
}
for(const token of inCode){
  check(tokens.has(token),`${TOKENS}: ${token} is in the code table but not in ${DESIGN_SYSTEM}`);
}

// A blurred shadow belongs to a different product (design-system.md, Surfaces).
for(const source of TOKENISED.filter((file)=>file!==TOKENS && file!==MARKERS)){
  const content=read(source);
  const blurred=[...content.matchAll(/shadowRadius:\s*([0-9.]+)/g)].filter((m)=>Number(m[1])>0);

  check(
    blurred.length===0,
    `${source}: has a blurred shadow (shadowRadius > 0) — elevation is a hard offset shadow`
  );
}

// The three inks mean something. The navigation shell is not a state, so it may
// not spend one -- an active tab is a place you are, not a state a place is in.
// This is designer.md's second hard check, on the one component most likely to
// reach for a brand colour.
const tabBar=code(read("components/TabBar.js"));

for(const ink of ["blue","pink","yellow"]){
  check(
    !new RegExp(`INK\\.${ink}\\b`).test(tabBar),
    `components/TabBar.js: uses INK.${ink} — the three inks carry state, never decoration`
  );
}

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Marker assignment check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Marker assignment check passed (${passed} checks; ${tokens.size} colour tokens).`);
