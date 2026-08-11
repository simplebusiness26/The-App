#!/usr/bin/env node
"use strict";

// Packet 4 -- there is one place that answers "may this person do this".
//
// What this guards against is drift back. profiles.account_type was read in 35
// places across 16 files, every one of them asking a question that cannot fail
// any more: 20260803120000_unify_account_model.sql:10 set every 'manager' row
// to 'explorer', and signup stopped offering the choice. Those checks were the
// parallel-user-type model RULES.md forbids, still running, and each one would
// have hidden a real person the moment a row's value drifted.
//
// The failure mode is quiet: somebody adds one `account_type` check back to a
// new screen, it passes review because it looks like the ten around it, and the
// fork is alive again. So this asserts the column is not read anywhere in the
// client at all.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function stripComments(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

function jsFilesUnder(dir){
  const found=[];
  const absolute=path.join(root,dir);
  if(!fs.existsSync(absolute)) return found;

  for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const full=path.join(absolute,entry.name);
    if(entry.isDirectory()) found.push(...jsFilesUnder(path.join(dir,entry.name)));
    else if(entry.name.endsWith(".js")) found.push({rel:path.join(dir,entry.name),full});
  }
  return found;
}

const files=[
  ...jsFilesUnder("app"),
  ...jsFilesUnder("components"),
  ...jsFilesUnder("hooks"),
  ...jsFilesUnder("utils")
];

check(files.length>0,"no source files found -- this gate is not looking at anything");

// ---------------------------------------------------------------------------
// 1. Nothing reads account_type
// ---------------------------------------------------------------------------
// Two exemptions, both write-or-display rather than a permission decision, and
// both owned by Packet 5:
//
//   app/auth/signup.js       -- writes the column once, at account creation
//   app/admin/explorers.js   -- shows it to an administrator as a data field
//
// utils/permissions.js is exempt because it is the file explaining why the
// column is not used; the check strips comments before looking, so its prose
// would not match anyway.

const EXEMPT=new Set([
  path.join("app","auth","signup.js"),
  path.join("app","admin","explorers.js"),
  path.join("utils","permissions.js")
]);

for(const file of files){
  if(EXEMPT.has(file.rel)) continue;

  const code=stripComments(fs.readFileSync(file.full,"utf8"));
  check(
    !/account_type/.test(code),
    `${file.rel}: reads profiles.account_type -- every account is an Explorer, so this test cannot fail and would hide a real person if the value ever drifted. Ask utils/permissions.js instead.`
  );
}

// ---------------------------------------------------------------------------
// 2. The module exists and answers each question exactly once
// ---------------------------------------------------------------------------

const permissionsPath=path.join(root,"utils","permissions.js");
check(fs.existsSync(permissionsPath),"utils/permissions.js is missing");

if(fs.existsSync(permissionsPath)){
  const permissions=fs.readFileSync(permissionsPath,"utf8");

  for(const fn of ["signedIn","isAdministrator","managesAnyListing","hasManagerCapability"]){
    check(
      new RegExp(`export\\s+async\\s+function\\s+${fn}\\s*\\(`).test(permissions),
      `utils/permissions.js: does not export ${fn}`
    );
  }

  check(
    /rpc\("guestbook_is_admin"\)/.test(permissions),
    "utils/permissions.js: isAdministrator does not call guestbook_is_admin -- the client must not carry a second definition of administrator"
  );
  check(
    /rpc\("has_manager_capability"/.test(permissions),
    "utils/permissions.js: nothing calls has_manager_capability, so the button and the insert policy can disagree"
  );
}

// ---------------------------------------------------------------------------
// 3. Nothing outside the module calls the permission RPCs directly
// ---------------------------------------------------------------------------
// A screen that calls guestbook_is_admin() itself is a second definition, which
// is the thing this packet removed.

for(const file of files){
  if(file.rel===path.join("utils","permissions.js")) continue;

  const code=stripComments(fs.readFileSync(file.full,"utf8"));
  for(const rpc of ["guestbook_is_admin","manages_any_listing","has_manager_capability"]){
    check(
      !new RegExp(`rpc\\(\\s*["']${rpc}["']`).test(code),
      `${file.rel}: calls ${rpc} directly -- go through utils/permissions.js so there is one answer`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. account_type must not be writable by a client
// ---------------------------------------------------------------------------
// 20260803214309:39 recorded this as open and it stayed open for a week:
// account_type sat in the profiles INSERT and UPDATE column grants, so any
// signed-in Explorer could set their own. The comment directly above the second
// grant said "nobody can promote themselves" while granting the column that
// did. Closed by 20260811130000; this is what stops it being granted back.

const migrationsDir=path.join(root,"supabase","migrations");
const migrationNames=fs.readdirSync(migrationsDir)
  .filter((name)=>name.endsWith(".sql"))
  .sort();

for(const verb of ["insert","update"]){
  const pattern=new RegExp(
    `grant\\s+${verb}\\s*\\(([^)]*)\\)\\s*on\\s+public\\.profiles\\s+to\\s+authenticated`,
    "gi"
  );

  let last=null;
  let lastFile=null;
  for(const name of migrationNames){
    const body=fs.readFileSync(path.join(migrationsDir,name),"utf8")
      .replace(/^\s*--.*$/gm,"");
    let match;
    while((match=pattern.exec(body))!==null){
      last=match[1];
      lastFile=name;
    }
    pattern.lastIndex=0;
  }

  check(last!==null,`supabase/migrations: no ${verb} column grant found on public.profiles`);

  if(last!==null){
    check(
      !/\baccount_type\b/.test(last),
      `${lastFile}: account_type is in the ${verb} grant on public.profiles -- any Explorer can promote themselves`
    );
    check(
      !/\bis_admin\b/.test(last),
      `${lastFile}: is_admin is in the ${verb} grant on public.profiles -- any Explorer can make themselves an administrator`
    );
  }
}

// The constraint is what makes the fork unrepresentable rather than merely
// unused: with 'manager' impossible, no future policy or screen can start
// branching on the value again.
const constrained=migrationNames.some((name)=>
  /check\s*\(\s*account_type\s*=\s*'explorer'\s*\)/i
    .test(fs.readFileSync(path.join(migrationsDir,name),"utf8"))
);
check(
  constrained,
  "supabase/migrations: nothing pins profiles.account_type to 'explorer', so a second account type can be written again"
);

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nPermission check point failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Permission check point passed (${passed} checks).`);
