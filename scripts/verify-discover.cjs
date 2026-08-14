#!/usr/bin/env node

// Packet 7: the Discover screen.
//
// "Every recommendation must carry a visible reason string. If the reason
// cannot be computed, the item does not appear."
//
// test/discover.test.js proves the reason engine refuses to produce a
// reasonless item, and that the screen shows what it is given. This proves
// there is no second path: that every list on the screen goes through
// `recommend`, and that nothing renders a row straight from a query.

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
    .replace(/\{\/\*[\s\S]*?\*\/\}/g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const SCREEN="app/discover.js";
const ENGINE="utils/discover.js";

const screen=code(read(SCREEN));
const engine=code(read(ENGINE));

// ---------------------------------------------------------------------------
// 1. Every section goes through the gate
// ---------------------------------------------------------------------------
//
// setItems is where the screen decides what exists. Each value must be a
// recommend() call: a raw array there is a section that skipped the rule.

// There is more than one place this can be written: the signed-out branch
// clears it with setItems({}), and the sections are built into a named object
// first now so their scores can be filled in with ONE query before they are
// shown. Both shapes are read, and the biggest object literal with keys in it
// is the section table whichever way it was written.
const setItemsCalls=[
  ...[...screen.matchAll(/setItems\(\{([\s\S]*?)\}\);/g)].map((match)=>match[1]),
  ...[...screen.matchAll(/const sections=\{([\s\S]*?)\n    \};/g)].map((match)=>match[1])
].filter((body)=>body.includes(":"));

const setItems=setItemsCalls.sort((a,b)=>b.length-a.length)[0] || null;

check(!!setItems,`${SCREEN}: could not find the section table — the shape of this screen has changed and this check needs rewriting`);

if(setItems){
  const assignments=[...setItems.matchAll(/["']?([a-z-]+)["']?\s*:\s*([^,\n]+)/g)];

  check(assignments.length>0,`${SCREEN}: no sections found in setItems`);

  for(const [,key,value] of assignments){
    check(
      value.includes("recommend("),
      `${SCREEN}: section "${key}" is not passed through recommend() — an item with no reason would reach the screen`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The engine drops rather than blanks
// ---------------------------------------------------------------------------

check(
  /return reason \? \{\.\.\.item,reason\} : null;/.test(engine),
  `${ENGINE}: recommend() must drop an item with no reason, not attach an empty one`
);
check(
  /return null;/.test(engine),
  `${ENGINE}: reasonFor() must be able to return null — a function that always finds a reason is not applying the rule`
);

// ---------------------------------------------------------------------------
// 3. No reason the data cannot support
// ---------------------------------------------------------------------------
//
// Nothing in this app measures popularity. A reason string claiming it would
// be the recommendation inventing its own justification, which is the failure
// the rule exists to prevent.

for(const word of ["popular","trending","top pick","everyone is"]){
  check(
    !engine.toLowerCase().includes(word),
    `${ENGINE}: mentions "${word}" — nothing in this app measures that, so it cannot be a reason`
  );
}

// ---------------------------------------------------------------------------
// 4. Empty states instruct
// ---------------------------------------------------------------------------
//
// design-system.md: "Empty states are instructions, not moods."

const empties=[...engine.matchAll(/empty:"([^"]+)"/g)].map((match)=>match[1]);

check(empties.length>=6,`${ENGINE}: expected an empty state for every section, found ${empties.length}`);

for(const empty of empties){
  check(
    /save|check in|add|start|tap|set /i.test(empty),
    `${ENGINE}: the empty state "${empty}" reports an absence without saying what to do about it`
  );
  check(
    !/nothing here|no results|oops/i.test(empty),
    `${ENGINE}: the empty state "${empty}" is a mood, not an instruction`
  );
}

// ---------------------------------------------------------------------------
// 5. Saved reads the store the Collections tab reads
// ---------------------------------------------------------------------------

check(
  /from\("explorer_favourites"\)/.test(screen),
  `${SCREEN}: the Saved section must read explorer_favourites, the same table the profile Collections tab reads`
);
check(
  /from\("explorer_favourites"\)/.test(code(read("components/ExplorerProfileScreen.js"))),
  "components/ExplorerProfileScreen.js: no longer reads explorer_favourites — the two have diverged"
);

// The screen shows its own list, so it must not copy the profile's is_public
// filter. That filter is for somebody else looking at your profile.
check(
  !/explorer_favourites[\s\S]{0,200}is_public/.test(screen),
  `${SCREEN}: filters own favourites by is_public — that is the filter for somebody else looking at your profile, not for your own list`
);

// ---------------------------------------------------------------------------
// 6. The colours are tokens
// ---------------------------------------------------------------------------

const tokens=new Set(
  [...read("docs/design-system.md").matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

for(const file of [SCREEN,ENGINE]){
  for(const match of read(file).matchAll(/#[0-9A-Fa-f]{6}\b/g)){
    check(
      tokens.has(match[0].toUpperCase()),
      `${file}: ${match[0]} is not in the docs/design-system.md token table`
    );
  }
}

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Discover check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Discover check passed (${passed} checks; ${empties.length} sections).`);