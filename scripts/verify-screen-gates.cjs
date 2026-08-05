#!/usr/bin/env node

// Guards the screen-alignment work recorded in docs/SCREEN-INVENTORY.md:
//
//   1. Every admin route stays behind the shared database-backed admin gate.
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

// Checks that forbid a pattern have to read code only. A comment explaining why
// the pattern is banned contains the pattern, and would otherwise fail the very
// file it is documenting.
function readCode(relative){
  return read(relative)
    .split("\n")
    .filter((line)=>!line.trim().startsWith("//"))
    .join("\n");
}

// ---------------------------------------------------------------------------
// 1. Every admin screen runs the shared database-backed gate
// ---------------------------------------------------------------------------

contains("hooks/useAdminGate.js",[
  "export function useAdminGate",
  "auth.getUser()",
  "router.replace(\"/auth/login\")",
  "rpc(\"guestbook_is_admin\")"
]);

const adminRouteDirectory=path.join(root,"app/admin");
const adminRoutes=fs.readdirSync(adminRouteDirectory)
  .filter((name)=>name.endsWith(".js"))
  .map((name)=>`app/admin/${name}`)
  .sort();

check(adminRoutes.length>0,"app/admin: expected at least one admin route");

for(const screen of adminRoutes){
  contains(screen,["useAdminGate","allowed","gateError"]);
}

// The route gate and every RLS policy use the same helper. Reading
// profiles.is_admin directly here would create two definitions of admin.
check(
  !readCode("hooks/useAdminGate.js").includes('.from("profiles")'),
  "hooks/useAdminGate.js: must not implement a second admin check against profiles"
);

// ---------------------------------------------------------------------------
// 1b. A new profile cannot grant itself administrator access
// ---------------------------------------------------------------------------

const migrationDirectory=path.join(root,"supabase/migrations");
const adminSecurityMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_security_foundation.sql"));

check(
  adminSecurityMigrations.length===1,
  `supabase/migrations: expected one admin security foundation migration, found ${adminSecurityMigrations.length}`
);

if(adminSecurityMigrations.length===1){
  const relative=`supabase/migrations/${adminSecurityMigrations[0]}`;
  const migration=read(relative);

  check(
    /set\s+search_path\s*=\s*''/i.test(migration),
    `${relative}: guestbook_is_admin must pin an empty search_path`
  );
  check(
    /revoke\s+all\s+on\s+function\s+public\.guestbook_is_admin\(\)\s+from\s+public\s*,\s*anon/i.test(migration),
    `${relative}: guestbook_is_admin must not be executable by public or anon`
  );
  check(
    /grant\s+execute\s+on\s+function\s+public\.guestbook_is_admin\(\)\s+to\s+authenticated/i.test(migration),
    `${relative}: authenticated callers need the admin-check RPC`
  );
  check(
    /revoke\s+insert\s+on\s+public\.profiles\s+from\s+anon\s*,\s*authenticated/i.test(migration),
    `${relative}: broad profile INSERT must be revoked`
  );

  const insertGrant=migration.match(
    /grant\s+insert\s*\(([^)]+)\)\s+on\s+public\.profiles\s+to\s+authenticated/i
  );
  check(!!insertGrant,`${relative}: expected a column-scoped profile INSERT grant`);

  if(insertGrant){
    const columns=insertGrant[1].split(",").map((column)=>column.trim().toLowerCase());
    for(const column of ["id","full_name","email","phone","account_type"]){
      check(columns.includes(column),`${relative}: signup needs INSERT access to profiles.${column}`);
    }
    check(!columns.includes("is_admin"),`${relative}: profiles.is_admin must not be insertable by authenticated`);
  }

  check(
    /coalesce\s*\(\s*is_admin\s*,\s*false\s*\)\s*=\s*false/i.test(migration),
    `${relative}: the profile INSERT policy must reject is_admin=true as defence in depth`
  );
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

// The dedicated claim-review screen performs claim approvals on three tables.
const claimsScreen=read("app/admin/claims.js");
for(const marker of ["updatedBusiness","updatedProperty","updatedClaim"]){
  check(
    claimsScreen.includes(`!${marker} || ${marker}.length===0`),
    `app/admin/claims.js: ${marker} must be checked for an empty result`
  );
}

// Stage 2 gives /admin/dashboard one responsibility: a count-only overview.
// It must not grow the invalid claims.user_id -> profiles join or duplicate
// the approval writes that belong to /admin/claims again.
const adminDashboard=read("app/admin/dashboard.js");
const adminDashboardCode=readCode("app/admin/dashboard.js");
for(const table of ["claims","businesses","properties","public_places","activity_clubs","events"]){
  check(
    adminDashboard.includes(`table:"${table}"`),
    `app/admin/dashboard.js: Stage 2 overview must count ${table}`
  );
}
contains("app/admin/dashboard.js",[
  'select("id",{count:"exact",head:true})',
  'router.push("/admin/claims")',
  'router.push("/admin/listings")',
  'router.push("/admin/public-places")',
  "Overview could not be loaded"
]);
check(
  !adminDashboardCode.includes("profiles:user_id"),
  "app/admin/dashboard.js: must not restore the invalid claims.user_id -> profiles relationship"
);
check(
  !adminDashboardCode.includes(".update("),
  "app/admin/dashboard.js: claim decisions belong to /admin/claims, not the overview"
);

// Stage 3 is an inspection catalogue, not a second set of editing forms. It
// loads every canonical listing table, selects only visible catalogue fields,
// and hands each row to its existing detail route.
const adminListings=read("app/admin/listings.js");
const adminListingsCode=readCode("app/admin/listings.js");
for(const table of ["businesses","properties","public_places","activity_clubs","events"]){
  check(
    adminListings.includes(`table:"${table}"`),
    `app/admin/listings.js: Stage 3 catalogue must load ${table}`
  );
}
contains("app/admin/listings.js",[
  "Search admin listings",
  "Show only",
  "Listings could not be loaded",
  "useLocalSearchParams",
  "router.push(listing.route)"
]);
for(const forbidden of ['select("*")',".update(",".delete(","owner_id","manager_id"]){
  check(
    !adminListingsCode.includes(forbidden),
    `app/admin/listings.js: read-only catalogue must not contain ${JSON.stringify(forbidden)}`
  );
}

const catalogueMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_listing_catalogue_read_access.sql"));
check(
  catalogueMigrations.length===1,
  `supabase/migrations: expected one Stage 3 catalogue access migration, found ${catalogueMigrations.length}`
);
if(catalogueMigrations.length===1){
  const relative=`supabase/migrations/${catalogueMigrations[0]}`;
  const migration=read(relative);
  for(const table of ["activity_clubs","events"]){
    check(
      new RegExp(`alter\\s+policy[\\s\\S]+?on\\s+public\\.${table}[\\s\\S]+?using`,"i").test(migration),
      `${relative}: expected the existing ${table} SELECT policy to gain admin visibility`
    );
  }
  check(
    (migration.match(/\(select\s+public\.guestbook_is_admin\(\)\)/gi)||[]).length===2,
    `${relative}: both Stage 3 policies must use the database-owned admin helper`
  );
}

// ---------------------------------------------------------------------------
// 2b. The drawer must not empty itself when a profile read fails
// ---------------------------------------------------------------------------
// A build that selected a column which did not exist in the database took the
// eight Explorer links, Manager Dashboard and Admin Dashboard off the menu at
// once, silently: the query errored, the role flags stayed false, and every
// gated entry vanished with nothing shown. The menu is not a security boundary
// -- each destination re-checks the session and RLS decides the data -- so it
// must fail open and say so, never fail closed and say nothing.
//
// Packet 4 replaced app/menu.js with components/QuickAccessDrawer.js, reading
// its rows from utils/drawer.js. The checks moved with it rather than being
// deleted: the defect they were written for is a property of any menu.

const drawer=read("components/QuickAccessDrawer.js");
const drawerCode=readCode("components/QuickAccessDrawer.js");

check(
  drawer.includes("maybeSingle()"),
  "components/QuickAccessDrawer.js: the profile read must use maybeSingle(), so a missing row is not an error"
);
check(
  /profileResult\.error \|\| !profileResult\.data/.test(drawer),
  "components/QuickAccessDrawer.js: the profile read must handle both a failed query and a missing row"
);
check(
  drawer.includes("setNotice("),
  "components/QuickAccessDrawer.js: a failed profile read must tell the user, not fail silently"
);
check(
  !/is_admin\s*\?\s*"admin"\s*:/.test(drawerCode),
  "components/QuickAccessDrawer.js: must not collapse is_admin and account_type into one role, which hides every Explorer link from admins"
);

// The links themselves must stay reachable. Losing one is how this started.
// They live in utils/drawer.js now, which is also what test/drawer.test.js
// asserts against the old menu row by row.
contains("utils/drawer.js",[
  'route:"/map"',
  'route:"/activity-clubs"',
  'route:"/events"',
  'route:"/profile"',
  'route:"/settings"',
  'route:"/live"',
  'route:"/linkups"',
  'route:"/checkins/create"',
  'route:"/feed"',
  'route:"/explorers"',
  'route:"/scan"',
  'route:"/leaderboards"',
  'route:"/safety/blocked"',
  'route:"/manager/dashboard"',
  'route:"/admin/dashboard"',
  'route:"/admin/listings"'
]);

// The Manage section is the one with an entitlement behind it, and the
// entitlement must be the database's answer rather than the client's guess.
check(
  /supabase\.rpc\("manages_any_listing"\)/.test(drawerCode),
  "components/QuickAccessDrawer.js: the Manage section must be decided by the manages_any_listing() RPC"
);

for(const screen of ["app/business/dashboard.js","app/property/dashboard.js","app/manager/requests.js"]){
  contains(screen,["useManagerGate","managerGate.allowed"]);
}

// /manager/dashboard is the on-ramp: it is where an Explorer requests the
// capability to manage anything. Gating it on already managing something would
// close the only door in.
check(
  !readCode("app/manager/dashboard.js").includes("useManagerGate"),
  "app/manager/dashboard.js: must not use the manager gate — it is where a non-manager asks to become one"
);

// ---------------------------------------------------------------------------
// Nothing may read a profiles column that no migration creates. This is the
// exact defect: the client asked for is_manager, which existed only in an
// unapplied migration, so every role-gated entry disappeared.
const profileColumns=new Set([
  "id","full_name","email","phone","bio","profile_photo",
  "account_type","is_admin","area","show_area","leaderboard_opt_in"
]);

for(const file of ["components/QuickAccessDrawer.js","app/settings.js","app/profile/edit.js"]){
  const selects=[...readCode(file).matchAll(/\.from\("profiles"\)\s*\n?\s*\.select\("([^"]+)"\)/g)];

  for(const [,columnList] of selects){
    for(const column of columnList.split(",").map((c)=>c.trim())){
      check(
        profileColumns.has(column),
        `${file}: selects profiles.${column}, which no migration creates`
      );
    }
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
