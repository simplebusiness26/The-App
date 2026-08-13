#!/usr/bin/env node
"use strict";

// `npm audit`, with a written list of what has been looked at and accepted.
//
// WHY NOT JUST `npm audit --audit-level=moderate`
//
// Because it had been red for weeks and could not be made green from this
// repository, and a step that always fails is worse than no step at all: it
// trains everybody to skip the whole job. That is not a hypothetical here --
// this project spent twenty-two runs with a red CI that nobody looked at, and
// the reason nobody looked was that it was always red.
//
// The 15 advisories all trace to ONE package. Everything else npm lists is the
// chain that reaches it:
//
//   image-size  ->  metro  ->  @expo/metro / @react-native/metro-config
//                          ->  expo, react-native, and everything using them
//
// npm's only offered fix is `--force`, which installs expo@53 -- a DOWNGRADE
// from 57 and a breaking change. That is not a fix.
//
// WHAT THE RISK ACTUALLY IS
// Both advisories are denial of service in image-size's ICNS, JXL and HEIF
// parsers: a crafted image sends the parser into an infinite loop. image-size
// is used by METRO, the bundler. Metro runs on a developer's machine, at build
// time, over files already in the project. It is not in the shipped app and no
// Explorer's phone ever runs it. Exploiting this means putting a malicious
// image into your own repository and then building it.
//
// So it is accepted, in writing, with a date -- and everything else still
// fails. A NEW advisory, or these two turning up somewhere other than metro's
// image-size, goes red exactly as before.

const {execFileSync}=require("child_process");

// Reviewed 13 August 2026. Re-check when Expo is next upgraded: metro is an
// Expo dependency and a newer Expo is the only thing that will move it.
const ACCEPTED=[
  {
    url:"https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
    module:"image-size",
    why:"DoS in the ICNS parser. image-size is used by metro, the bundler, which runs at build time on a developer machine and is not in the shipped app."
  },
  {
    url:"https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
    module:"image-size",
    why:"DoS in the JXL and HEIF parsers. Same reasoning: metro, build time, never on a phone."
  }
];

const ACCEPTED_URLS=new Set(ACCEPTED.map((entry)=>entry.url));

let report;
try{
  // npm audit exits non-zero when it finds anything, so the output is read from
  // the error rather than treated as a failure.
  const stdout=execFileSync("npm",["audit","--json"],{encoding:"utf8",maxBuffer:32*1024*1024});
  report=JSON.parse(stdout);
}catch(error){
  if(!error.stdout){
    console.error("Dependency audit could not run:",error.message);
    process.exit(1);
  }
  try{
    report=JSON.parse(error.stdout);
  }catch{
    console.error("Dependency audit produced output that could not be read.");
    process.exit(1);
  }
}

// Every distinct advisory, and which package it is really in. `via` entries are
// either a string (the name of another package that carries it) or the advisory
// itself as an object.
const found=new Map();

for(const [name,entry] of Object.entries(report?.vulnerabilities || {})){
  for(const via of entry?.via || []){
    if(typeof via==="string") continue;
    if(!via?.url) continue;

    found.set(via.url,{
      url:via.url,
      title:via.title || "",
      severity:via.severity || entry.severity || "unknown",
      module:via.name || name
    });
  }
}

const unexpected=[...found.values()].filter((advisory)=>{
  if(!ACCEPTED_URLS.has(advisory.url)) return true;

  // Accepted for image-size specifically. The same advisory id appearing
  // against a different package is a different situation and is not covered.
  const accepted=ACCEPTED.find((entry)=>entry.url===advisory.url);
  return accepted.module!==advisory.module;
});

// An allowlist that has stopped matching anything is an allowlist somebody
// should delete, and saying so is the only way that ever happens.
const stale=ACCEPTED.filter((entry)=>!found.has(entry.url));

if(unexpected.length){
  console.error("Dependency audit failed on advisories that are NOT on the accepted list:\n");
  for(const advisory of unexpected){
    console.error(`  - [${advisory.severity}] ${advisory.module}: ${advisory.title}`);
    console.error(`    ${advisory.url}`);
  }
  console.error("\nEither fix it, or add it to ACCEPTED in scripts/verify-audit.cjs with a written reason.");
  process.exit(1);
}

console.log(`Dependency audit passed (${found.size} advisories, ${ACCEPTED.length - stale.length} accepted in writing).`);

for(const entry of ACCEPTED){
  if(stale.includes(entry)) continue;
  console.log(`  accepted  ${entry.module}  ${entry.url}`);
  console.log(`            ${entry.why}`);
}

for(const entry of stale){
  console.log(`  NO LONGER PRESENT  ${entry.module}  ${entry.url}`);
  console.log("            Remove it from ACCEPTED in scripts/verify-audit.cjs.");
}
