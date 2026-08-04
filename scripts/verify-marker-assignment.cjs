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

for(const source of [MARKERS,PIN,PREVIEW]){
  const content=read(source);

  for(const match of content.matchAll(/#[0-9A-Fa-f]{6}\b/g)){
    check(
      tokens.has(match[0].toUpperCase()),
      `${source}: ${match[0]} is not in the ${DESIGN_SYSTEM} token table`
    );
  }
}

// A blurred shadow belongs to a different product (design-system.md, Surfaces).
for(const source of [PIN,PREVIEW]){
  const content=read(source);
  const blurred=[...content.matchAll(/shadowRadius:\s*([0-9.]+)/g)].filter((m)=>Number(m[1])>0);

  check(
    blurred.length===0,
    `${source}: has a blurred shadow (shadowRadius > 0) — elevation is a hard offset shadow`
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
