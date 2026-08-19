#!/usr/bin/env node
"use strict";

// DID THE SPEC ACTUALLY GET BUILT.
//
// WHY THIS EXISTS
//
// A tournament locked three specs. The winning UI entry won on its COMPLEXITY
// LADDER -- the list of what each surface genuinely does at four levels of
// depth: what is one tap away, what appears only in context, what an expert can
// reach, and what belongs in preferences. That ladder is the product.
//
// It was not built. The design system was built instead: tokens, a component
// kit, a glyph set, a rendering harness, a palette gate. Every one of those
// measures how the app LOOKS. Not one of them asks whether the thing the spec
// NAMED exists. So the app could pass every check in the repo while missing the
// flash control, the precision tray, the layers tray, the recenter button and
// the capture defaults -- and it did, and the product owner had to be the one
// to notice.
//
// This closes that hole. docs/spec-ladder.json carries every capability the
// locked specs name, quoted verbatim, each with a mechanical detection rule.
// If a capability is not in the code, this fails and says which one.
//
//   npm run verify:spec
//
// WHAT IT IS NOT
//
// It cannot judge whether a built capability is any GOOD -- that is what
// rendering and a human eye are for. It answers exactly one question, the one
// nothing else in this repo was asking: is it there at all.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const ladder=JSON.parse(fs.readFileSync(path.join(root,"docs","spec-ladder.json"),"utf8"));

// Comments are stripped before matching. A file that merely EXPLAINS a
// capability in a note must not satisfy the check for having it -- that is how
// a gate turns into a spell-checker.
function code(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .split("\n")
    .filter((line)=>!/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

const results=[];
for(const item of ladder.items){
  const bodies=item.files
    .map((f)=>path.join(root,f))
    .filter((f)=>fs.existsSync(f))
    .map((f)=>code(fs.readFileSync(f,"utf8")));

  const missing=[];
  for(const pattern of item.must){
    const re=new RegExp(pattern);
    if(!bodies.some((b)=>re.test(b))) missing.push(pattern);
  }
  results.push({...item,present:!bodies.length?false:missing.length===0,missing,noFiles:!bodies.length});
}

const built=results.filter((r)=>r.present);
const gaps=results.filter((r)=>!r.present);

const BY_LEVEL=["immediate","contextual","precision","configuration","scenario"];
console.log(`Spec ladder: ${built.length}/${results.length} capabilities present.\n`);

if(gaps.length){
  let surface=null;
  for(const level of BY_LEVEL){
    for(const g of gaps.filter((r)=>r.level===level)){
      if(g.surface!==surface){surface=g.surface;console.log(`\n${surface.toUpperCase()}`);}
      console.log(`  [${g.level}] ${g.id}`);
      console.log(`     spec: ${g.spec}`);
      console.log(`     not found: ${g.noFiles?"none of its files exist":g.missing.join("  |  ")}`);
      console.log(`     looked in: ${g.files.join(", ")}`);
    }
  }
  console.log(`\n${gaps.length} capabilities the locked spec names are missing from the code.`);
  console.log("Source: "+ladder.source);
  process.exit(1);
}

console.log("Every capability the locked specs name is present.");
console.log("Source: "+ladder.source);
