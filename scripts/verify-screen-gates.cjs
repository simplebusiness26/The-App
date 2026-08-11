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

// Rebuild Packet 4 moved the RPC itself into utils/permissions.js, so there is
// one definition of "is an administrator" rather than one per caller. The
// requirement is unchanged -- the answer still comes from the database helper
// the RLS policies use -- so the assertion follows the indirection instead of
// being dropped.
contains("hooks/useAdminGate.js",[
  "export function useAdminGate",
  "auth.getUser()",
  "router.replace(\"/auth/login\")",
  "isAdministrator()"
]);

contains("utils/permissions.js",[
  "export async function isAdministrator",
  "rpc(\"guestbook_is_admin\")",
  "export async function managesAnyListing",
  "rpc(\"manages_any_listing\")"
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
  {file:"app/business/review-action.js",table:"businesses",kind:"business"},
  {file:"app/property/review-action.js",table:"properties",kind:"property"}
];

for(const {file,table,kind} of reviewActions){
  contains(file,[
    "auth.getUser()",
    "router.replace(\"/auth/login\")",
    `.from("${table}")`,
    "select(\"owner_id\")",
    // Rebuild Packet 10: the review is read from the one review table, and the
    // listing it is about is identified by target_type/target_id rather than by
    // a per-type foreign key on a copy.
    'from("explorer_reviews")',
    `review.target_type!=="${kind}"`,
    "review.target_id",
    "Only the owner of this listing can respond to its reviews.",
    "useFeedback"
  ]);

  const content=read(file);

  // The requirement is unchanged -- a refused reply must be detectable -- but
  // the mechanism is not, so the assertion follows it.
  //
  // These used to be direct .update() calls on the legacy `reviews` table,
  // where RLS refuses by matching no rows and reporting no error, so the screen
  // had to ask for the rows back and treat an empty result as a rejection.
  // explorer_reviews grants update at table level, so that approach would have
  // needed a policy letting a manager write the row -- and a policy cannot say
  // "only these three columns changed", which would have let a manager rewrite
  // the rating and the text of somebody else's review.
  //
  // Both writes go through SECURITY DEFINER functions now. They check who
  // manages the listing and raise, so the refusal arrives as an error rather
  // than as silence, and there is nothing to detect by counting rows.
  check(
    !/\.update\(/.test(content),
    `${file}: writes a review row directly -- a reply must go through respond_to_review or challenge_review, which check who manages the listing`
  );

  for(const rpc of ["respond_to_review","challenge_review"]){
    check(
      new RegExp(`rpc\\("${rpc}"`).test(content),
      `${file}: does not call ${rpc}`
    );
  }

  const errorGuards=content.match(/if\(updateError\)\{/g) || [];
  check(
    errorGuards.length===2,
    `${file}: every reply must surface the function's refusal, found ${errorGuards.length} error guards`
  );
}

// Stage 4a replaces the former three-request claim approval with one database
// transaction. The screen gathers an auditable reason, confirms the action and
// calls only that RPC; listing assignment and claim state must never drift into
// separate client writes again.
const claimsScreen=read("app/admin/claims.js");
const claimsScreenCode=readCode("app/admin/claims.js");
for(const needle of [
  "useFeedback",
  "Alert.alert(",
  'rpc("admin_decide_claim"',
  "p_claim_id:claim.id",
  "p_decision:decision",
  "p_reason:reason",
  'rpc("admin_decide_capability_request"',
  "p_request_id:request.id",
  "Decision reason for",
  "Access requests could not be loaded"
]){
  check(
    claimsScreen.includes(needle),
    `app/admin/claims.js: Stage 4a expected to contain ${JSON.stringify(needle)}`
  );
}

const capabilityDecisionMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_capability_decisions.sql"));
check(
  capabilityDecisionMigrations.length===1,
  `supabase/migrations: expected one Stage 4b capability-decision migration, found ${capabilityDecisionMigrations.length}`
);
if(capabilityDecisionMigrations.length===1){
  const relative=`supabase/migrations/${capabilityDecisionMigrations[0]}`;
  const migration=read(relative);
  const migrationCode=migration.toLowerCase();

  contains(relative,[
    "add column if not exists decided_by uuid",
    "create policy manager_capability_requests_read_authenticated",
    "create policy manager_capabilities_read_authenticated",
    "revoke insert,update,delete on public.manager_capabilities from anon,authenticated",
    "revoke insert,update,delete on public.manager_capability_requests from anon,authenticated",
    "create or replace function public.reset_resubmitted_capability_request()",
    "create or replace function public.admin_decide_capability_request(",
    "security definer",
    "set search_path=''",
    "for update",
    "insert into public.manager_capabilities(user_id)",
    "update public.manager_capabilities",
    "update public.manager_capability_requests",
    "insert into public.admin_audit_log",
    "grant execute on function public.admin_decide_capability_request(uuid,text,text)"
  ]);
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_decide_capability_request\(uuid,text,text\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: capability-decision RPC must start with no Data API execution grants`
  );

  for(const operation of ["insert","update"]){
    const grant=migration.match(
      new RegExp(`grant\\s+${operation}\\s*\\(([^)]+)\\)\\s+on\\s+public\\.manager_capability_requests\\s+to\\s+authenticated`,"i")
    );
    check(!!grant,`${relative}: expected a column-scoped capability-request ${operation.toUpperCase()} grant`);
    if(grant){
      const columns=grant[1].split(",").map((column)=>column.trim().toLowerCase());
      check(!columns.includes("admin_note"),`${relative}: Explorers must not write admin_note`);
      check(!columns.includes("decided_by"),`${relative}: Explorers must not write decided_by`);
    }
  }

  check(
    migrationCode.trimStart().includes("begin;") && migrationCode.trimEnd().endsWith("commit;"),
    `${relative}: Stage 4b schema changes must be one migration transaction`
  );
}

check(
  !readCode("app/manager/dashboard.js").includes("decided_at:null"),
  "app/manager/dashboard.js: resubmission metadata must be reset by the database trigger"
);
for(const forbidden of [".update(",".insert(",".delete(",'select("*")']){
  check(
    !claimsScreenCode.includes(forbidden),
    `app/admin/claims.js: claim decisions must not use client ${JSON.stringify(forbidden)}`
  );
}

const claimDecisionMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_claim_decisions.sql"));
check(
  claimDecisionMigrations.length===1,
  `supabase/migrations: expected one Stage 4a claim-decision migration, found ${claimDecisionMigrations.length}`
);
if(claimDecisionMigrations.length===1){
  const relative=`supabase/migrations/${claimDecisionMigrations[0]}`;
  const migration=read(relative);
  const migrationCode=migration.toLowerCase();

  contains(relative,[
    "create table public.admin_audit_log",
    "alter table public.admin_audit_log enable row level security",
    "revoke all on public.admin_audit_log from public,anon,authenticated",
    "grant select on public.admin_audit_log to authenticated",
    "create or replace function public.admin_decide_claim(",
    "security definer",
    "set search_path=''",
    "for update",
    "update public.businesses",
    "update public.properties",
    "update public.claims",
    "insert into public.admin_audit_log",
    "revoke update on public.claims from authenticated",
    "grant execute on function public.admin_decide_claim(uuid,text,text)"
  ]);
  check(
    !/grant\s+insert[\s\S]*?on\s+public\.admin_audit_log\s+to\s+(anon|authenticated)/i.test(migration),
    `${relative}: Data API roles must not be able to forge audit records`
  );
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_decide_claim\(uuid,text,text\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: claim-decision RPC must start with no Data API execution grants`
  );
  check(
    migrationCode.trimStart().includes("begin;") && migrationCode.trimEnd().endsWith("commit;"),
    `${relative}: Stage 4a schema changes must be one migration transaction`
  );
}

// Stage 5 keeps clubs and events recoverable: administrators change only the
// public state through one audited RPC, never delete activity from the client.
const adminActivities=read("app/admin/activities.js");
const adminActivitiesCode=readCode("app/admin/activities.js");
contains("app/admin/activities.js",[
  "useAdminGate",
  "useFeedback",
  "Alert.alert(",
  'rpc("admin_set_activity_state"',
  "p_target_type:type.targetType",
  "p_target_id:row.id",
  "p_state:nextState",
  "p_reason:reason",
  '.range(from,from+PAGE_SIZE-1)',
  "Activities could not be loaded",
  "Decision reason required"
]);
for(const forbidden of [".update(",".insert(",".delete(",'select("*")']){
  check(
    !adminActivitiesCode.includes(forbidden),
    `app/admin/activities.js: activity administration must not use client ${JSON.stringify(forbidden)}`
  );
}

const activityStateMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_activity_states.sql"));
check(
  activityStateMigrations.length===1,
  `supabase/migrations: expected one Stage 5 activity-state migration, found ${activityStateMigrations.length}`
);
if(activityStateMigrations.length===1){
  const relative=`supabase/migrations/${activityStateMigrations[0]}`;
  const migration=read(relative);
  const migrationCode=migration.toLowerCase();

  contains(relative,[
    "create or replace function public.admin_set_activity_state(",
    "security definer",
    "set search_path=''",
    "for update",
    "update public.activity_clubs",
    "update public.events",
    "insert into public.admin_audit_log",
    "grant execute on function public.admin_set_activity_state(text,uuid,text,text)"
  ]);
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_set_activity_state\(text,uuid,text,text\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: activity-state RPC must start with no Data API execution grants`
  );
  check(
    migrationCode.trimStart().includes("begin;") && migrationCode.trimEnd().endsWith("commit;"),
    `${relative}: Stage 5 schema changes must be one migration transaction`
  );
}

// Stage 6 reviews the two report systems already used by the app through one
// bounded RPC, then records every decision through a second atomic RPC. The
// Explorer directory is read-only and deliberately omits contact fields.
const adminModeration=read("app/admin/moderation.js");
const adminModerationCode=readCode("app/admin/moderation.js");
contains("app/admin/moderation.js",[
  "useAdminGate",
  "useFeedback",
  "Alert.alert",
  'rpc("admin_get_moderation_queue"',
  'rpc("admin_decide_report"',
  "p_limit:PAGE_SIZE",
  "p_offset:page*PAGE_SIZE",
  "Decision reason required",
  "Moderation reports could not be loaded",
  "Private meeting points and attendee lists are never loaded here."
]);
for(const forbidden of [".from(",".update(",".insert(",".delete("]){
  check(
    !adminModerationCode.includes(forbidden),
    `app/admin/moderation.js: report reads and decisions must use the bounded RPC, not ${JSON.stringify(forbidden)}`
  );
}

const adminExplorers=read("app/admin/explorers.js");
const adminExplorersCode=readCode("app/admin/explorers.js");
contains("app/admin/explorers.js",[
  "useAdminGate",
  'const PAGE_SIZE=25',
  // Rebuild Packet 5 dropped account_type from this select. The column is
  // pinned to 'explorer' by 20260811130000 and is no longer writable by any
  // client, so displaying it to an administrator showed the same word on every
  // row. The point of the assertion -- that this screen names its columns
  // rather than selecting * -- is unchanged.
  'const PROFILE_COLUMNS="id,full_name,is_admin"',
  'const CAPABILITY_COLUMNS="user_id,businesses_status,properties_status,activity_clubs_status,events_status"',
  '.from("manager_capabilities")',
  '.in("user_id",ids)',
  ".range(from,from+PAGE_SIZE-1)",
  "without exposing contact or private-location fields",
  "Explorers could not be loaded"
]);
for(const forbidden of ['select("*")',".update(",".insert(",".delete(","email,","phone,","area,"]){
  check(
    !adminExplorersCode.includes(forbidden),
    `app/admin/explorers.js: read-only safe directory must not contain ${JSON.stringify(forbidden)}`
  );
}

const moderationMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_moderation.sql"));
check(
  moderationMigrations.length===1,
  `supabase/migrations: expected one Stage 6 moderation migration, found ${moderationMigrations.length}`
);
if(moderationMigrations.length===1){
  const relative=`supabase/migrations/${moderationMigrations[0]}`;
  const migration=read(relative);
  const migrationCode=migration
    .split("\n")
    .filter((line)=>!line.trim().startsWith("--"))
    .join("\n")
    .toLowerCase();

  contains(relative,[
    "alter table public.social_reports",
    "alter table public.live_safety_reports",
    "drop policy if exists social_reports_admin_update",
    "revoke update on public.social_reports from authenticated",
    "create or replace function public.admin_get_moderation_queue(",
    "create or replace function public.admin_decide_report(",
    "security definer",
    "set search_path=''",
    "for update",
    "update public.explorer_moments set status='removed'",
    "update public.social_comments set status='removed'",
    "update public.linkups set status='cancelled'",
    "update public.linkup_messages",
    "update public.live_checkins",
    "insert into public.admin_audit_log",
    "grant execute on function public.admin_get_moderation_queue(text,integer,integer)",
    "grant execute on function public.admin_decide_report(text,uuid,text,text)"
  ]);
  for(const privateField of [
    "linkup_private_details","linkup_attendees","meeting_point","latitude","longitude","email","phone"
  ]){
    check(
      !migrationCode.includes(privateField),
      `${relative}: moderation queue must not read private field/table ${privateField}`
    );
  }
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_get_moderation_queue\(text,integer,integer\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: moderation-read RPC must start with no Data API execution grants`
  );
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_decide_report\(text,uuid,text,text\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: moderation-decision RPC must start with no Data API execution grants`
  );
  check(
    migrationCode.trimStart().includes("begin;") && migrationCode.trimEnd().endsWith("commit;"),
    `${relative}: Stage 6 schema changes must be one migration transaction`
  );
}

// Stage 7 exposes data discrepancies and the audit trail without adding a
// client-side repair path. Area reports remain grouped and read-only, while
// audit rows omit the free-form JSON details field from the screen query.
const adminAreas=read("app/admin/areas.js");
const adminAreasCode=readCode("app/admin/areas.js");
contains("app/admin/areas.js",[
  "useAdminGate",
  'const AREA_COLUMNS="id,name,area_type,parent_area_id,slug,status"',
  '.from("geo_areas")',
  'rpc("get_unmatched_area_report")',
  'rpc("get_unmatched_public_place_report")',
  'rpc("admin_get_data_quality_report")',
  "They never guess an area or repair ownership automatically.",
  "Data-quality reports could not be loaded"
]);
for(const forbidden of ['select("*")',".update(",".insert(",".delete("]){
  check(
    !adminAreasCode.includes(forbidden),
    `app/admin/areas.js: Stage 7 report must remain read-only and not contain ${JSON.stringify(forbidden)}`
  );
}

const adminAudit=read("app/admin/audit.js");
const adminAuditCode=readCode("app/admin/audit.js");
contains("app/admin/audit.js",[
  "useAdminGate",
  'const PAGE_SIZE=25',
  'const AUDIT_COLUMNS="id,actor_id,action,target_type,target_id,reason,created_at"',
  '.from("admin_audit_log")',
  '.from("profiles").select("id,full_name")',
  ".range(from,from+PAGE_SIZE-1)",
  "append-only history of admin decisions",
  "Audit history could not be loaded"
]);
for(const forbidden of ['select("*")',".update(",".insert(",".delete(","details,","email","phone"]){
  check(
    !adminAuditCode.includes(forbidden),
    `app/admin/audit.js: append-only safe history must not contain ${JSON.stringify(forbidden)}`
  );
}

const dataQualityMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_data_quality.sql"));
check(
  dataQualityMigrations.length===1,
  `supabase/migrations: expected one Stage 7 data-quality migration, found ${dataQualityMigrations.length}`
);
if(dataQualityMigrations.length===1){
  const relative=`supabase/migrations/${dataQualityMigrations[0]}`;
  const migration=read(relative);
  const migrationCode=migration
    .split("\n")
    .filter((line)=>!line.trim().startsWith("--"))
    .join("\n")
    .toLowerCase();

  contains(relative,[
    "create or replace function public.admin_get_data_quality_report()",
    "stable",
    "security definer",
    "set search_path=''",
    "b.owner_id is distinct from c.user_id",
    "p.owner_id is distinct from c.user_id",
    "'business_owner_state'",
    "'ownership_issues'",
    "'missing_area_counts'",
    "revoke all on function public.admin_get_data_quality_report()",
    "grant execute on function public.admin_get_data_quality_report()"
  ]);
  check(
    !/\b(?:update|insert\s+into|delete\s+from)\s+public\./i.test(migrationCode),
    `${relative}: data-quality RPC must not repair or mutate live rows`
  );
  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_get_data_quality_report\(\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(migration),
    `${relative}: data-quality RPC must start with no Data API execution grants`
  );
  check(
    migrationCode.trimStart().includes("begin;") && migrationCode.trimEnd().endsWith("commit;"),
    `${relative}: Stage 7 schema changes must be one migration transaction`
  );
}

// Stage 2 gives /admin/dashboard one responsibility: a count-only overview.
// It must not grow the invalid claims.user_id -> profiles join or duplicate
// the approval writes that belong to /admin/claims again.
const adminDashboard=read("app/admin/dashboard.js");
const adminDashboardCode=readCode("app/admin/dashboard.js");
for(const table of [
  "claims","manager_capability_requests","businesses","properties","public_places",
  "activity_clubs","events","social_reports","live_safety_reports","profiles",
  "geo_areas","admin_audit_log"
]){
  check(
    adminDashboard.includes(`table:"${table}"`),
    `app/admin/dashboard.js: Stage 2 overview must count ${table}`
  );
}
contains("app/admin/dashboard.js",[
  'select("id",{count:"exact",head:true})',
  'router.push("/admin/claims")',
  'router.push("/admin/listings")',
  'router.push("/admin/activities")',
  'router.push("/admin/moderation")',
  'router.push("/admin/explorers")',
  'router.push("/admin/areas")',
  'router.push("/admin/audit")',
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

// The first live Stage 3 verification proved that a CASE inside a `public`
// policy does not safely shield anon from a restricted helper: Postgres may
// evaluate the helper before deciding which branch wins. The corrective
// migration must therefore give anon and authenticated disjoint SELECT rules.
const catalogueAnonSplitMigrations=fs.readdirSync(migrationDirectory)
  .filter((name)=>name.endsWith("_admin_listing_catalogue_anon_split.sql"));
check(
  catalogueAnonSplitMigrations.length===1,
  `supabase/migrations: expected one Stage 3 anon-policy correction, found ${catalogueAnonSplitMigrations.length}`
);
if(catalogueAnonSplitMigrations.length===1){
  const relative=`supabase/migrations/${catalogueAnonSplitMigrations[0]}`;
  const migration=read(relative);
  contains(relative,[
    'drop policy if exists "Public can view published activity clubs"',
    'drop policy if exists "Published events are public and managers see their own"',
    "create policy activity_clubs_read_anon",
    "create policy activity_clubs_read_authenticated",
    "create policy events_read_anon",
    "create policy events_read_authenticated"
  ]);
  check(
    (migration.match(/for\s+select\s+to\s+anon/gi)||[]).length===2,
    `${relative}: both signed-out policies must be scoped only to anon`
  );
  check(
    (migration.match(/for\s+select\s+to\s+authenticated/gi)||[]).length===2,
    `${relative}: both signed-in policies must be scoped only to authenticated`
  );
  check(
    (migration.match(/\(select\s+public\.guestbook_is_admin\(\)\)/gi)||[]).length===2,
    `${relative}: only the two authenticated policies should use the admin helper`
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
  /managesAnyListing\(\)/.test(drawerCode),
  "components/QuickAccessDrawer.js: the Manage section must be decided by managesAnyListing(), which asks the database rather than letting the client guess"
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
  "account_type","is_admin","area","show_area","leaderboard_opt_in",
  // Rebuild Packet 8. The ceiling on who may see this Explorer's position,
  // added by 20260811170000 and defaulting to 'nobody'.
  "location_sharing"
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
