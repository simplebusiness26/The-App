#!/usr/bin/env node
"use strict";

// IS IT ACTUALLY BUILT ON THE INSTRUMENT.
//
// WHY THIS EXISTS
//
// The first attempt at this redesign changed the hex values in utils/tokens.js
// and stopped. Every screen picked the dark palette up automatically, every
// test passed, scripts/verify-contrast.cjs passed, and what shipped was the old
// app in new colours: same rounded cards, same filled pills, same emoji, same
// 2px print borders. The product owner looked at it and said it was nothing
// like what had been agreed.
//
// So a palette check is not enough. This checks the SHAPES -- the things that
// make the difference between a design system and a colour swap -- and it is
// deliberately mechanical, because "does this look like an instrument" is a
// judgement and "is there an emoji in this file" is not.
//
//   node scripts/verify-instrument.cjs
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not judge composition, hierarchy or taste, and passing it does not
// mean a screen is good. It means a screen has not fallen back to the shapes of
// the app this one replaced. Rendering and looking is still required -- see
// docs/instrument-kit.md, rule 10.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const SCAN=["app","components"];

// Files that are allowed to break a rule, each for a stated reason. An empty
// list is the goal; anything added here needs the reason written down.
const EXEMPT={
  // The kit defines the shapes, so it is the one place the raw values live.
  "components/instrument.js":["radius","border","alias"],
  // Compatibility aliases are declared here by definition.
  "utils/tokens.js":["alias"],
  // The shutter's ring is a drawn control, not a panel edge -- see the note
  // beside it. Every other border in this file is a hairline.
  "components/CameraCapture.js":["border"]
};

const files=[];
for(const dir of SCAN){
  (function walk(d){
    for(const entry of fs.readdirSync(d,{withFileTypes:true})){
      const full=path.join(d,entry.name);
      if(entry.isDirectory()){walk(full);continue;}
      if(entry.name.endsWith(".js")) files.push(full);
    }
  })(path.join(root,dir).replace(root+path.sep,""));
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

// Emoji, including the ones that arrive as a plain character rather than a
// surrogate pair. An emoji carries a colour and a weight the platform chose,
// which on a two-colour instrument face reads as a sticker on the housing.
const EMOJI=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

// The typographic characters that were standing in for icons: ⌕ ≡ ▤ ★ ▶ ✕ ✓ ×
// used as UI rather than as text somebody wrote.
//
// "×" is the interesting one, because it is legitimately a MULTIPLICATION SIGN
// in a measured value -- the camera's zoom readout says "2×" and that is the
// right character for it. So it only counts as a stand-in icon when it is the
// whole of the text, which is what a close button looks like.
const GLYPH_CHARS=/[⌕≡▤★☆▶✕✓✖◉●]/;
const LONE_TIMES=/>\s*×\s*<|["'`]\s*×\s*["'`]/;

// The print system's register. SHAPE.border is 1; the only 2px edge in the
// design is StateEdge's left rule, which the kit draws.
const HARD_BORDER=/border(?:Top|Right|Bottom|Left)?Width\s*:\s*[2-9]/;

// Radius comes from SHAPE.radius -- 6 controls, 10 cards, 14 sheets, 999 pills.
// A hand-typed number is the old card shape surviving a recolour.
const HARD_RADIUS=/borderRadius\s*:\s*(\d+)/g;
const ALLOWED_RADIUS=new Set([0,1,2,3,4]); // hairlines, ticks, tiny dots
// A radius that is exactly half of the thing's own width is a CIRCLE, not a
// card corner somebody typed from memory. Circles are legitimate -- a dial, a
// shutter, an avatar -- so the rule is about rectangles with invented corners.
const SIZE_IN_BLOCK=/(?:width|height|size)\s*:\s*(\d+)/g;

// The compatibility aliases. INK.ink in particular is the near-white readout
// colour now: borderColor:INK.ink drew a white outline around every feed card
// and a white ring around every pin on the map.
const ALIAS=/INK\.(paper|card|ink|inkSoft|hair|blue|pink|yellow|green|red)\b/;

// The innermost { ... } containing an offset -- the same definition of "a style
// block" scripts/verify-contrast.cjs uses.
function blockAround(source,offset){
  let open=source.lastIndexOf("{",offset);
  while(open>0&&source.slice(open+1,offset).includes("}")) open=source.lastIndexOf("{",open-1);
  const close=source.indexOf("}",offset);
  return source.slice(open<0?0:open,close<0?source.length:close);
}
function lineStart(lines,index){
  let n=0;
  for(let i=0;i<index;i++) n+=lines[i].length+1;
  return n;
}

// Read straight out of utils/navigation.js rather than restated here: two
// answers to "where does the Create action appear" is how the gate and the app
// drift apart.
const NAV=fs.readFileSync(path.join(root,"utils/navigation.js"),"utf8");
const HIDDEN_ROUTES=[
  ...(NAV.match(/CREATE_HIDDEN_EXACT=\[([^\]]*)\]/)?.[1]||"").split(","),
  ...(NAV.match(/CREATE_HIDDEN_PREFIX=\[([^\]]*)\]/)?.[1]||"").split(",")
].map(v=>v.replace(/["'\s\n]/g,"")).filter(Boolean);

function createHidden(file){
  // app/messages/[id].js -> /messages/
  const route="/"+file.replace(/^app[\\/]/,"").replace(/\.js$/,"").replace(/[\\]/g,"/");
  return HIDDEN_ROUTES.some((r)=>route===r||route.startsWith(r));
}

const failures=[];
function fail(file,rule,line,detail){
  if((EXEMPT[file]||[]).includes(rule)) return;
  failures.push({file,rule,line,detail});
}

for(const file of files){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const lines=source.split("\n");

  // BLOCK COMMENTS SPAN LINES. Testing each line on its own marks the middle
  // of a /* ... */ as code, which is how a note EXPLAINING that emoji are
  // banned gets reported as an emoji. Tracked properly instead.
  let inBlock=false;

  lines.forEach((line,i)=>{
    const n=i+1;
    const opens=line.includes("/*")&&!line.includes("*/");
    const isComment=inBlock||opens||/^\s*(\/\/|\*|\/\*)/.test(line)||/^\s*\{?\s*\/\*/.test(line);
    if(opens) inBlock=true;
    if(inBlock&&line.includes("*/")) inBlock=false;

    if(EMOJI.test(line)&&!isComment) fail(file,"emoji",n,line.trim().slice(0,70));
    if(!isComment&&(GLYPH_CHARS.test(line)||LONE_TIMES.test(line))&&/<Text|style=|:\s*"/.test(line)){
      fail(file,"glyph-char",n,line.trim().slice(0,70));
    }
    if(HARD_BORDER.test(line)&&!isComment) fail(file,"border",n,line.trim().slice(0,70));
    if(ALIAS.test(line)&&!isComment) fail(file,"alias",n,line.trim().slice(0,70));

    if(!isComment){
      for(const m of line.matchAll(HARD_RADIUS)){
        const value=Number(m[1]);
        if(ALLOWED_RADIUS.has(value)) continue;
        // Look for a width/height in the same style block that this radius is
        // exactly half of. That is a circle, and circles are the kit's own
        // shape language -- dials, apertures, avatars, pins.
        const block=blockAround(source,m.index!==undefined?lineStart(lines,i)+m.index:0);
        let circle=false;
        for(const size of block.matchAll(SIZE_IN_BLOCK)){
          if(Number(size[1])===value*2){circle=true;break;}
        }
        if(!circle) fail(file,"radius",n,`borderRadius:${value} — use SHAPE.radius`);
      }
    }
  });

  // A screen that scrolls must reserve the Create action's clearance, or its
  // last row sits under a button that floats over every route in the app.
  //
  // ...unless the button is not there. utils/navigation.js hides it on the
  // camera and on any message thread or board, because those screens already
  // have a composer pinned to the bottom edge and the floating button sat on
  // top of Send. Reserving clearance on one of those would push its composer
  // up to make room for a control that never appears.
  const isRoute=file.startsWith("app"+path.sep)&&!file.endsWith("_layout.js");
  const scrolls=/<(ScrollView|FlatList|SectionList)/.test(source);
  const reserves=/CREATE_HUB_CLEARANCE/.test(source);
  if(isRoute&&scrolls&&!reserves&&!createHidden(file)){
    fail(file,"clearance",0,"scrolls but does not reserve CREATE_HUB_CLEARANCE");
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const byRule={};
for(const f of failures) (byRule[f.rule]=byRule[f.rule]||[]).push(f);

const RULE_TEXT={
  emoji:"Emoji. Use <Glyph name=\"…\"/> — there are 66 icons; check GLYPH_NAMES.",
  "glyph-char":"A typographic character standing in for an icon. Use <Glyph/>.",
  border:"A border thicker than 1px. SHAPE.border is 1; 2px was the print system.",
  radius:"A hand-typed radius. Use SHAPE.radius — 6 / 10 / 14 / 999.",
  alias:"A compatibility alias. INK.ink is the near-white readout colour now.",
  clearance:"A scrolling screen with no CREATE_HUB_CLEARANCE in its bottom padding."
};

if(!failures.length){
  console.log(`Instrument: ${files.length} files, and every one is built on the kit.`);
  process.exit(0);
}

for(const [rule,list] of Object.entries(byRule)){
  console.log(`\n${rule.toUpperCase()} — ${RULE_TEXT[rule]}`);
  for(const f of list.slice(0,40)){
    console.log(`  ${f.file}${f.line?":"+f.line:""}  ${f.detail}`);
  }
  if(list.length>40) console.log(`  …and ${list.length-40} more`);
}
console.log(`\n${failures.length} breaches across ${new Set(failures.map(f=>f.file)).size} files.`);
console.log("See docs/instrument-kit.md.");
process.exit(1);
