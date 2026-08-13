#!/usr/bin/env node
"use strict";

// A Moment and a Memory are made at the camera. Nowhere else.
//
// WHAT THIS EXISTS TO STOP COMING BACK
//
// There used to be four ways to create a Memory and only one of them opened a
// camera:
//
//   utils/drawer.js          "Keep a memory"  -> /memories/create
//   components/MyMap.js      "Keep a Memory"  -> /memories/create
//   app/create.js            "Keep a memory"  -> /memories/create   (orphan route)
//   app/camera.js            "A Memory"       -> /memories/create?photo=...
//
// and /memories/create opens the photo LIBRARY when it arrives with nothing.
// So three of the four were standalone uploaders wearing the create screen's
// clothes. Moments had the same shape: the feed and every place page pushed
// straight to /moments/create.
//
// The create screens are not the problem and are not being removed -- they are
// the second half of the flow, where the caption, the place and the audience
// are chosen. What is removed is REACHING them without a photo. Each now sends
// you to the camera instead of showing an empty form.
//
// This gate checks the entry points rather than the screens, because that is
// where the rule actually lives and where it will quietly break: somebody adds
// a helpful "add a Memory" button to a display surface and the whole thing is
// undone.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");

const failures=[];
let checks=0;

function read(relative){
  const full=path.join(root,relative);
  if(!fs.existsSync(full)) return null;
  return fs.readFileSync(full,"utf8");
}

// Comments describe the rule at length in these files. Strip them, or the gate
// fails on its own explanation.
function code(source){
  return source
    .split("\n")
    .filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

function check(condition,message){
  checks+=1;
  if(!condition) failures.push(message);
}

// ---------------------------------------------------------------------------
// 1. Both create screens send an empty arrival to the camera
// ---------------------------------------------------------------------------

for(const screen of ["app/moments/create.js","app/memories/create.js"]){
  const source=read(screen);
  check(source!==null,`${screen}: missing`);
  if(!source) continue;

  check(
    /router\.replace\("\/camera"\)/.test(code(source)),
    `${screen}: does not send an empty arrival to the camera — reached with no photo it becomes a standalone uploader again`
  );
}

// ---------------------------------------------------------------------------
// 2. No display surface pushes straight to a create screen
// ---------------------------------------------------------------------------
// The camera is the only file allowed to, because that IS the flow.

const ALLOWED_TO_PUSH_CREATE=new Set(["app/camera.js"]);

function walk(dir){
  const out=[];
  if(!fs.existsSync(dir)) return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){out.push(...walk(full));continue;}
    if(entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const offenders=[];

for(const dir of ["app","components","utils","hooks"]){
  for(const file of walk(path.join(root,dir))){
    const relative=path.relative(root,file);
    if(ALLOWED_TO_PUSH_CREATE.has(relative)) continue;
    // The create screens themselves may mention their own path.
    if(relative==="app/moments/create.js" || relative==="app/memories/create.js") continue;

    const source=code(fs.readFileSync(file,"utf8"));

    // A navigation to a create screen: router.push/replace, a <Link href>, or a
    // route: entry in a menu table.
    const patterns=[
      /router\.(push|replace)\(\s*["'`]\/(moments|memories)\/create/,
      /href=["'`]\/(moments|memories)\/create/,
      /route:\s*["'`]\/(moments|memories)\/create/
    ];

    if(patterns.some((pattern)=>pattern.test(source))) offenders.push(relative);
  }
}

checks+=1;
if(offenders.length){
  failures.push(
    `these navigate straight to a create screen, bypassing the camera: ${offenders.join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// 3. The orphaned launcher is gone
// ---------------------------------------------------------------------------
// app/create.js offered "Post a moment" and "Keep a memory" as rows. Nothing
// navigated to it -- the centre tab became the map -- so it was 174 lines of
// working duplicate creation routes reachable only by typing the URL.

check(read("app/create.js")===null,"app/create.js is back: it is a duplicate creation launcher with no way in");

const layout=read("app/_layout.js") || "";
check(
  !/<Stack\.Screen name="create"\/>/.test(layout),
  "app/_layout.js still declares the create route"
);

// ---------------------------------------------------------------------------
// 4. The camera carries a place preset through
// ---------------------------------------------------------------------------
// A place page's "post a Moment here" now routes via the camera. If the camera
// dropped target_type/target_id, camera-only creation would have quietly cost
// every Moment posted from a place page its place.

const camera=code(read("app/camera.js") || "");
check(/target_type/.test(camera) && /target_id/.test(camera),
  "app/camera.js does not carry target_type/target_id through to the create screen — a Moment posted from a place page would lose its place");

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Camera-only creation check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error("\nA display surface may offer a SHORTCUT to the camera. It may not become a creation surface.");
  process.exit(1);
}

console.log(`Camera-only creation check passed (${checks} checks).`);
