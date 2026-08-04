#!/usr/bin/env node

// Guards the screen-alignment work recorded in docs/SCREEN-INVENTORY.md:
//
//   1. The four sensitive routes the inventory found ungated stay gated.
//   2. Writes to RLS-protected tables check that a row actually changed,
//      because a policy refusal returns no error -- only zero rows.
//   3. app/_layout.js keeps declaring exactly the routes that exist on disk.
//   4. Nothing navigates to /property/reviews/:id, which resolves to no file.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];
let passed=0;

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative}: file is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function contains(relative,needles){
  const content=read(relative);
  for(const needle of needles){
    check(content.includes(needle),`${relative}: expected to contain ${JSON.stringify(needle)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. The admin claim screens run the shared gate
// ---------------------------------------------------------------------------

contains("hooks/useAdminGate.js",[
  "export function useAdminGate",
  "auth.getUser()",
  "router.replace(\"/auth/login\")",
  "select(\"is_admin\")"
]);

for(const screen of ["app/admin/claims.js","app/admin/dashboard.js"]){
  contains(screen,[
    "useAdminGate",
    "if(allowed) loadClaims();",
    "if(!allowed){"
  ]);
}

// ---------------------------------------------------------------------------
// 2. The review-action screens require a session and confirm ownership
// ---------------------------------------------------------------------------

const reviewActions=[
  {file:"app/business/review-action.js",table:"businesses",column:"business_id"},
  {file:"app/property/review-action.js",table:"properties",column:"property_id"}
];

for(const {file,table,column} of reviewActions){
  contains(file,[
    "auth.getUser()",
    "router.replace(\"/auth/login\")",
    `.from("${table}")`,
    "select(\"owner_id\")",
    `review.${column}`,
    "Only the owner of this listing can respond to its reviews.",
    "useFeedback"
  ]);

  const content=read(file);

  // Both writes must ask for the affected rows back and act on an empty result.
  const updates=content.match(/\.update\(/g) || [];
  check(updates.length===2,`${file}: expected 2 review updates, found ${updates.length}`);

  const selectsAfterUpdate=content.match(/\.eq\("id",id\)\s*\n\s*\.select\(\)/g) || [];
  check(
    selectsAfterUpdate.length===2,
    `${file}: every review update must end in .select() so a refused write is detectable, found ${selectsAfterUpdate.length}`
  );

  const emptyGuards=content.match(/if\(!data \|\| data\.length===0\)\{/g) || [];
  check(
    emptyGuards.length===2,
    `${file}: every review update must treat an empty result as a rejection, found ${emptyGuards.length}`
  );
}

// The claim approvals do the same, on three tables.
const claimsScreen=read("app/admin/claims.js");
for(const marker of ["updatedBusiness","updatedProperty","updatedClaim"]){
  check(
    claimsScreen.includes(`!${marker} || ${marker}.length===0`),
    `app/admin/claims.js: ${marker} must be checked for an empty result`
  );
}
check(
  (read("app/admin/dashboard.js").match(/if\(!updated \|\| updated\.length===0\)\{/g) || []).length===1,
  "app/admin/dashboard.js: the claim update must treat an empty result as a rejection"
);

// ---------------------------------------------------------------------------
// 2b. Manager is a flag, not a value of account_type
// ---------------------------------------------------------------------------
// account_type must stay 'explorer' for everyone. Every explorer gate in the
// app and ~15 RPCs and triggers in the database test it for that exact value,
// so a screen that starts writing or comparing it against 'manager' silently
// revokes half of someone's account.

const managerGates=[
  "app/manager/dashboard.js",
  "app/manager/requests.js",
  "app/manager/membership-status/[id].js",
  "app/business/[id].js",
  "app/property/[id].js"
];

for(const screen of managerGates){
  const content=read(screen);

  check(
    content.includes("is_manager"),
    `${screen}: the manager gate must read is_manager`
  );
  check(
    !/account_type\s*[!=]==?\s*"manager"/.test(content),
    `${screen}: must not compare account_type against "manager"`
  );
}

// Signup must not choose a role -- the column default supplies 'explorer'.
const signup=read("app/auth/signup.js");
check(
  !signup.includes("account_type"),
  "app/auth/signup.js: must not write account_type; the column default supplies it"
);

// The upgrade goes through the RPC, never a column write.
const settings=read("app/settings.js");
contains("app/settings.js",[
  "set_manager_account",
  "useFeedback",
  "router.replace(\"/auth/login\")"
]);
check(
  !/\.update\(\s*\{[^}]*is_manager/.test(settings),
  "app/settings.js: is_manager must be set through set_manager_account, not a column update"
);

// The three roles are independent facts. menu.js used to collapse them into one
// scalar with `is_admin ? "admin" : account_type`, which hid the explorer and
// manager entries from every admin.
const menu=read("app/menu.js");
check(
  !/is_admin\s*\?\s*"admin"\s*:/.test(menu),
  "app/menu.js: must not collapse is_admin and account_type into a single role"
);
contains("app/menu.js",["isExplorer","isManager","isAdmin",'router.push("/settings")']);

// The grant that closes the escalation path.
const grantMigration=read("supabase/migrations/20260804090100_manager_account_rpc.sql");
const grantBlock=grantMigration.match(/grant update \(([^)]*)\) on public\.profiles/);
check(!!grantBlock,"20260804090100: expected a column-scoped UPDATE grant on profiles");
if(grantBlock){
  for(const forbidden of ["account_type","is_manager","is_admin"]){
    check(
      !grantBlock[1].includes(forbidden),
      `20260804090100: ${forbidden} must not appear in the profiles UPDATE grant`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. app/_layout.js matches the route files on disk
// ---------------------------------------------------------------------------

function routeFiles(dir,prefix=""){
  const routes=[];

  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const child=path.join(dir,entry.name);

    if(entry.isDirectory()){
      routes.push(...routeFiles(child,`${prefix}${entry.name}/`));
      continue;
    }

    if(!entry.name.endsWith(".js")) continue;

    // map.js and map.web.js are one route; _layout.js is not a route.
    const name=entry.name.replace(/\.web\.js$/,"").replace(/\.js$/,"");
    if(name==="_layout") continue;

    routes.push(`${prefix}${name}`);
  }

  return routes;
}

const onDisk=[...new Set(routeFiles(path.join(root,"app")))].sort();
const layout=read("app/_layout.js");
const declared=[...new Set(
  [...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((match)=>match[1])
)].sort();

const undeclared=onDisk.filter((route)=>!declared.includes(route));
const phantom=declared.filter((route)=>!onDisk.includes(route));

check(
  undeclared.length===0,
  `app/_layout.js: route files with no <Stack.Screen>: ${undeclared.join(", ")}`
);
check(
  phantom.length===0,
  `app/_layout.js: <Stack.Screen> entries with no route file: ${phantom.join(", ")}`
);

// ---------------------------------------------------------------------------
// 4. No link to the route that does not exist
// ---------------------------------------------------------------------------

function jsFiles(dir){
  const found=[];

  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const child=path.join(dir,entry.name);
    if(entry.isDirectory()) found.push(...jsFiles(child));
    else if(entry.name.endsWith(".js")) found.push(child);
  }

  return found;
}

const sources=[...jsFiles(path.join(root,"app")),...jsFiles(path.join(root,"components"))];
const deadLinks=sources.filter((file)=>/\/property\/reviews\/\$\{/.test(fs.readFileSync(file,"utf8")));

check(
  deadLinks.length===0,
  `/property/reviews/:id resolves to no route file; still linked from: ${deadLinks.map((f)=>path.relative(root,f)).join(", ")}`
);

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Screen gate check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Screen gate check passed (${passed} checks).`);
