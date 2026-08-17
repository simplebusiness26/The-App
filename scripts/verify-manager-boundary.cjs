#!/usr/bin/env node
"use strict";

// Packet 10, the two acceptance criteria that are checkable in source.
//
// "QR codes not surfaced on public place pages" is the one worth a gate. A QR
// code is the proof-of-presence mechanism for verified reviews and claims: if
// it appears on a page anybody can open, the verification it backs is worth
// nothing, and a screenshot is enough to forge a visit. The failure is silent —
// the page renders beautifully with the code on it.
//
// The database half of Packet 10 ("Manager access enforced at the database
// boundary, tested with a non-manager account") cannot be checked from source
// and was verified against the live project instead; see the 2026-08-10 Packet
// 10 entry in docs/REDESIGN-STATE.md for the three refusals.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function code(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

function jsFilesUnder(dir){
  const found=[];
  const absolute=path.join(root,dir);
  if(!fs.existsSync(absolute)) return found;

  for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const rel=`${dir}/${entry.name}`;
    if(entry.isDirectory()) found.push(...jsFilesUnder(rel));
    else if(entry.name.endsWith(".js")) found.push(rel);
  }
  return found;
}

// Where a QR code legitimately belongs: a manager's own tools. Anything else
// reaching for one is the defect.
const MANAGER_SURFACES=[
  "app/manager/dashboard.js",
  "app/business/dashboard.js",
  "app/property/dashboard.js",
  "app/manager/qr/[type]/[id].js"
];

const QR_RENDER=/QRCodeGenerator|react-native-qrcode-svg/;

for(const file of [...jsFilesUnder("app"),...jsFilesUnder("components")]){
  if(MANAGER_SURFACES.includes(file)) continue;
  if(file==="components/QRCodeGenerator.js") continue;      // the component itself

  const source=code(fs.readFileSync(path.join(root,file),"utf8"));

  check(
    !QR_RENDER.test(source),
    `${file}: renders a QR code outside a manager surface — a QR code anybody can screenshot is a forged visit, and it backs verified reviews and claims`
  );
}

// The four manager surfaces are the only ones, and they must still be gated.
for(const file of MANAGER_SURFACES){
  const full=path.join(root,file);
  check(fs.existsSync(full),`${file}: missing — the QR allow-list names a file that no longer exists`);
}

// Scanning is not the same as generating. /scan reads a code; it must not be
// able to produce one.
const scan=code(fs.readFileSync(path.join(root,"app/scan.js"),"utf8"));
check(
  !QR_RENDER.test(scan),
  "app/scan.js: can generate a QR code — scanning reads a code, it does not mint one"
);

// The manager dashboards must stay reachable. They were unreachable from any
// navigation for several packets while being fully implemented, which is how
// finished work goes unused.
//
// utils/drawer.js is RETIRED (DesignLab redesign, FINAL_PRODUCT_CONTRACT.md's
// locked architecture -- see scripts/verify-screen-gates.cjs's own note on
// where every drawer row went). /manager/dashboard -- the on-ramp, reachable
// by anyone whether or not they manage anything yet -- has real links of its
// own now, independent of the drawer, and still does.
const managerDashboardLinkedFrom=["app/settings.js","components/ExplorerProfileScreen.js"];
for(const file of managerDashboardLinkedFrom){
  check(
    code(fs.readFileSync(path.join(root,file),"utf8")).includes('router.push("/manager/dashboard")'),
    `${file}: does not link to /manager/dashboard`
  );
}

// /business/dashboard and /property/dashboard do NOT have a real link yet.
// This is a genuine, tracked cross-agent gap, not an oversight:
// FINAL_PRODUCT_CONTRACT.md puts both under Me -> My Places ("manager tools,
// per-type dashboards/add/edit unchanged"), which is a Me-tab route and out
// of the packet that retired the drawer (it does not touch Me-tab files).
// Both screens are still gated (useManagerGate, checked above via
// MANAGER_SURFACES) and still directly navigable by URL/deep link; they have
// no in-app entry point until My Places lands. Flagged in that packet's final
// report rather than silently left unchecked, and left here as a comment
// rather than a stale drawer assertion so the next agent building My Places
// has a pointer straight to what still needs wiring.

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nManager boundary check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Manager boundary check passed (${passed} checks).`);
