#!/usr/bin/env node

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
    check(content.includes(needle),`${relative}: missing required contract ${JSON.stringify(needle)}`);
  }
}

const requiredFiles=[
  "app/linkups/index.js",
  "app/linkups/create.js",
  "app/linkups/[id].js",
  "app/linkups/edit/[id].js",
  "app/linkups/board/[id].js",
  "app/checkins/create.js",
  "app/live.js",
  "app/safety/blocked.js",
  "components/DateTimeField.js",
  "components/LinkupForm.js",
  "components/ProfileSafetyActions.js",
  "utils/linkups.js",
  "supabase/migrations/20260802211500_linkups_live_tables.sql",
  "supabase/migrations/20260802211600_linkups_live_actions.sql",
  "supabase/migrations/20260802211700_linkups_live_discovery.sql",
  "supabase/migrations/20260802211800_harden_linkups_live_privacy.sql",
  "supabase/migrations/20260802211900_linkups_live_performance.sql"
];

for(const file of requiredFiles){
  check(fs.existsSync(path.join(root,file)),`${file}: required file is missing`);
}

contains("app/_layout.js",[
  'name="linkups/index"',
  'name="linkups/create"',
  'name="linkups/[id]"',
  'name="linkups/edit/[id]"',
  'name="linkups/board/[id]"',
  'name="live"',
  'name="checkins/create"',
  'name="safety/blocked"'
]);

// utils/drawer.js is RETIRED (DesignLab redesign -- see
// scripts/verify-screen-gates.cjs's own note on where every drawer row went).
// Each of these four routes has a real in-app link of its own, independent of
// the drawer, and still does:
contains("app/linkups/index.js",['router.push("/live")']);
contains("app/messages/index.js",['router.push("/linkups")']);
contains("app/live.js",['router.push("/checkins/create")']);
// checkins/create is also the Create hub's own "Check in" branch now --
// reachable from any screen, not only from Live Nearby.
contains("components/CreateHub.js",['navigate("/checkins/create")']);
contains("app/settings.js",['router.push("/safety/blocked")']);

contains("components/LinkupForm.js",[
  "requestForegroundPermissionsAsync",
  "toFixed(3)",
  "Never publish a private home address",
  "p_meeting_point_details",
  "p_max_attendees",
  "p_visibility",
  "limit<2 || limit>50"
]);

// Rebuild Packet 4 removed the account_type check that used to be asserted
// here. Every account is an Explorer -- 20260803120000:10 retired the other
// value -- so the test could not fail, and pinning it in a gate is what kept
// the parallel-user-type model alive. The requirement underneath it was
// "refuse somebody who is not signed in", which is what is checked instead.
contains("app/linkups/create.js",[
  'rpc("create_linkup"',
  'router.replace("/auth/login")',
  'router.replace(`/linkups/${data}`)'
]);

contains("app/linkups/[id].js",[
  'rpc("refresh_live_system")',
  '"join_linkup"',
  '"leave_linkup"',
  '"cancel_linkup"',
  '"remove_linkup_attendee"',
  'router.push(`/linkups/board/${id}`)',
  'report_live_safety',
  'block_explorer'
]);

contains("app/linkups/board/[id].js",[
  'rpc("post_linkup_message"',
  'rpc("delete_linkup_message"',
  'p_is_announcement:isOwner&&announcement',
  'report_live_safety',
  'linkup_messages',
  'readOnly'
]);

contains("app/checkins/create.js",[
  'rpc("start_live_checkin"',
  "requestForegroundPermissionsAsync",
  "[30,60,120,240]",
  // Rebuild Packet 8 removed the per-check-in visibility choice. Who can see a
  // check-in is one setting on the profile, and it is a ceiling.
  //
  // This used to require the string 'followers', and that was the bug rather
  // than the contract: RULES.md says presence caps at friends and never uses
  // followers, and the profile setting could be set wider than either. The
  // screen now sends the word the rule actually is, and the database caps it
  // again with can_see_content(owner, viewer, 'friends') so an older build
  // sending 'followers' is translated rather than trusted.
  'p_visibility:"friends"',
  'visibility',
  'Only use public places',
  'customActivity',
  'activity==="Other"?customActivity.trim():activity.trim()'
]);

contains("app/live.js",[
  'rpc("get_live_discovery"',
  'rpc("refresh_live_system")',
  'rpc("end_live_checkin"',
  'report_live_safety',
  'p_radius_km:radius',
  'p_window_hours:windowHours',
  'item.item_type==="checkin"'
]);

contains("components/ProfileSafetyActions.js",[
  'block_explorer',
  'unblock_explorer',
  'report_live_safety',
  'p_target_type:"user"'
]);

contains("app/notifications.js",[
  'return "live"',
  '{key:"live",label:"Live"}',
  'linkup_joined',
  'linkup_message',
  'linkup_cancelled',
  'linkup_reminder',
  'linkup_follower_created'
]);

contains("context/NotificationContext.js",[
  'rpc("refresh_live_system")'
]);

const tableMigration=read("supabase/migrations/20260802211500_linkups_live_tables.sql").toLowerCase();
const actionMigration=read("supabase/migrations/20260802211600_linkups_live_actions.sql").toLowerCase();
const discoveryMigration=read("supabase/migrations/20260802211700_linkups_live_discovery.sql").toLowerCase();
const hardeningMigration=read("supabase/migrations/20260802211800_harden_linkups_live_privacy.sql").toLowerCase();
const performanceMigration=read("supabase/migrations/20260802211900_linkups_live_performance.sql").toLowerCase();
const allMigrations=`${tableMigration}\n${actionMigration}\n${discoveryMigration}\n${hardeningMigration}\n${performanceMigration}`;

for(const table of [
  "linkups",
  "linkup_private_details",
  "linkup_attendees",
  "linkup_messages",
  "live_checkins",
  "user_blocks",
  "live_safety_reports"
]){
  check(tableMigration.includes(`create table if not exists public.${table}`),`migrations: ${table} table creation missing`);
  check(tableMigration.includes(`alter table public.${table} enable row level security`),`migrations: ${table} RLS enablement missing`);
}

for(const contract of [
  "for update",
  "max_attendees between 2 and 50",
  "live_checkins_one_active_per_user",
  "security definer",
  "revoke all",
  "from public,anon",
  "to authenticated",
  "meeting_point_details",
  "linkup_private_select_members",
  "linkup_messages_select_members"
]){
  check(allMigrations.includes(contract),`migrations: missing security/data contract ${contract}`);
}

for(const rpc of [
  "create_linkup",
  "update_linkup",
  "join_linkup",
  "leave_linkup",
  "cancel_linkup",
  "remove_linkup_attendee",
  "post_linkup_message",
  "delete_linkup_message",
  "start_live_checkin",
  "end_live_checkin",
  "block_explorer",
  "unblock_explorer",
  "report_live_safety",
  "refresh_live_system",
  "get_live_discovery"
]){
  check(allMigrations.includes(`function public.${rpc}`),`migrations: ${rpc} function missing`);
}

for(const rule of [
  "five link-ups in 24 hours",
  "please slow down before posting again",
  "this board is read-only",
  "end your current check-in before starting another",
  "check-ins can last between 15 minutes and four hours",
  "only explorer accounts can join link-ups",
  "only explorer accounts can check in"
]){
  check(allMigrations.includes(rule),`migrations: missing validation ${rule}`);
}

for(const notification of [
  "linkup_follower_created",
  "linkup_joined",
  "linkup_left",
  "linkup_full",
  "linkup_updated",
  "linkup_cancelled",
  "linkup_removed",
  "linkup_message",
  "linkup_announcement",
  "linkup_reminder"
]){
  check(allMigrations.includes(notification),`migrations: notification type ${notification} missing`);
}

for(const privacyContract of [
  "create schema if not exists private",
  "private.can_view_linkup",
  "not private.linkup_users_blocked",
  "round(v_latitude::numeric,2)",
  "round(v_longitude::numeric,2)",
  "security invoker",
  "business not found",
  "activity club not found",
  "event not found",
  "daily report limit",
  "you cannot report your own content or profile",
  "status=case when a.user_id=v_user then 'left' else 'removed' end"
]){
  check(hardeningMigration.includes(privacyContract),`privacy migration: missing contract ${privacyContract}`);
}

check(performanceMigration.includes("linkup_messages_user_created_idx"),"performance migration: message author index missing");
check(performanceMigration.includes("not private.linkup_user_is_explorer")&&performanceMigration.includes("'reminders',0"),"performance migration: non-Explorer reminder no-op missing");
check(discoveryMigration.includes("with items(item_type,item_id,title,subtitle,area"),"discovery migration: explicit CTE column contract missing");
check(discoveryMigration.includes("'linkup'::text")&&discoveryMigration.includes("'checkin'")&&discoveryMigration.includes("'event'")&&discoveryMigration.includes("'activity'")&&discoveryMigration.includes("'place'"),"discovery migration: one or more discovery item types missing");
check(discoveryMigration.includes("limit 100"),"discovery migration: response limit missing");

if(failures.length){
  console.error(`Link-ups and Live Discovery release gate FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Link-ups and Live Discovery release gate passed (${passed} checks).`);
