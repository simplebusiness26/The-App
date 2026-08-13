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
  "app/explorers.js",
  "app/connections/[id].js",
  "app/feed.js",
  "app/moments/create.js",
  "app/moments/[id].js",
  "app/social-comments/[id].js",
  "components/FollowButton.js",
  "components/ProfileSocialBar.js",
  "components/LikeButton.js",
  "components/CommentThread.js",
  "components/MomentMediaPreview.js",
  "utils/socialMedia.js",
  "supabase/migrations/20260802155202_explorer_social_layer.sql",
  "supabase/migrations/20260802183000_explorer_social_interaction_cleanup.sql",
  "supabase/migrations/20260802184500_explorer_social_notification_deep_links.sql",
  "supabase/migrations/20260802190000_harden_explorer_social_rpc_permissions.sql",
  "supabase/migrations/20260802191500_fix_activity_club_moment_attachments.sql"
];

for(const file of requiredFiles) check(fs.existsSync(path.join(root,file)),`${file}: required file is missing`);

contains("app/_layout.js",[
  'name="explorers"',
  'name="connections/[id]"',
  'name="feed"',
  'name="moments/create"',
  'name="moments/[id]"',
  'name="social-comments/[id]"'
]);

contains("utils/drawer.js",[
  'route:"/feed"',
  'route:"/explorers"'
]);

// Rebuild Packet 4 removed the account_type check that used to be asserted
// here. Every account is an Explorer -- 20260803120000:10 retired the other
// value -- so the test could not fail, and pinning it in a gate is what kept
// the parallel-user-type model alive. The requirement underneath it was
// "refuse somebody who is not signed in", which is what is checked instead.
// Split in two because the feed row moved to components/FeedCard.js. The
// screen keeps the fetch, the sign-in refusal and the navigation; the row keeps
// the buttons. Checking for <LikeButton in app/feed.js after that move would
// have failed on a change that broke nothing -- and, worse, would have been
// "fixed" by pasting the string back into a file that no longer draws it.
contains("app/feed.js",[
  'rpc("get_explorer_social_feed"',
  'router.replace("/auth/login")',
  // Packet 11 retired 'video_review' as a comment target. Comments used to
  // need a review with a published video on it, so the text and photo reviews
  // most people write could be endorsed but never answered. One name for the
  // thing now, and every published review takes a comment.
  'type:"review"',
  'router.push(`/moments/${item.item_id}`)',
  // The camera, not the uploader. The feed's "New Moment" used to push to
  // /moments/create, which opens the photo library -- a creation route that
  // never went near a camera. What must hold is that the feed still OFFERS the
  // act; where it sends you is the camera-only rule's business.
  'router.push("/camera")'
]);

// The half that moved with the row.
contains("components/FeedCard.js",[
  '<LikeButton',
  '<EndorseButton'
]);

contains("app/moments/create.js",[
  'router.replace("/auth/login")',
  'mediaTypes:["images"]',
  'mediaTypes:["videos"]',
  'videoMaxDuration:30',
  '52_428_800',
  'seconds>30.25',
  'prepareSocialAsset',
  'releaseSocialAsset',
  '<MomentMediaPreview',
  'statuses:["open","full"]',
  'status:"published"',
  '.remove([uploadedPath])'
]);

contains("components/MomentMediaPreview.js",[
  'React.createElement("img"',
  'React.createElement("video"',
  'controls:true',
  'playsInline:true',
  'onError:handleError'
]);

contains("utils/socialMedia.js",[
  'URL.createObjectURL(asset.file)',
  'URL.revokeObjectURL(asset.previewUri)',
  'asset.file.arrayBuffer()',
  'asset?.previewUri || asset?.uri',
  'if(!bytes?.byteLength)'
]);

contains("components/FollowButton.js",[
  '.from("explorer_follows")',
  'follower_id',
  'following_id'
]);

contains("components/ProfileSocialBar.js",[
  'get_explorer_follow_counts',
  '/connections/'
]);

contains("components/LikeButton.js",[
  '.from("social_likes")',
  'target_type',
  'target_id'
]);

contains("components/CommentThread.js",[
  '.from("social_comments")',
  '.from("social_reports")',
  'maxLength={500}',
  'clean.length>500'
]);

contains("app/notifications.js",[
  'Social',
  'social_follow',
  'social_moment',
  'social_like',
  'social_comment',
  'deep_link'
]);

const migrationFiles=requiredFiles.filter(file=>file.startsWith("supabase/migrations/"));
const migrations=migrationFiles.map(read).join("\n").toLowerCase();
for(const table of ["explorer_follows","explorer_moments","social_likes","social_comments","social_reports"]){
  check(migrations.includes(`create table if not exists public.${table}`),`migrations: ${table} table creation missing`);
  check(migrations.includes(`alter table public.${table} enable row level security`),`migrations: ${table} RLS enablement missing`);
}

for(const contract of [
  "get_explorer_follow_counts",
  "get_explorer_social_feed",
  "security invoker",
  "to authenticated",
  "social-media",
  "cleanup_social_interactions",
  "social_notification_trigger"
]){
  check(migrations.includes(contract.toLowerCase()),`migrations: missing security/data contract ${contract}`);
}

const hardening=read("supabase/migrations/20260802190000_harden_explorer_social_rpc_permissions.sql").toLowerCase();
check(hardening.includes("revoke all") && hardening.includes("from public,anon"),"RPC hardening: anonymous/public execute revocation missing");
check(hardening.includes("security invoker"),"RPC hardening: SECURITY INVOKER missing");
check(hardening.includes("to authenticated"),"RPC hardening: authenticated grant missing");

const clubFix=read("supabase/migrations/20260802191500_fix_activity_club_moment_attachments.sql").toLowerCase();
check(clubFix.includes("open") && clubFix.includes("full"),"Activity Club attachment validation must allow open/full clubs");

if(failures.length){
  console.error(`Explorer social release gate FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Explorer social release gate passed (${passed} checks).`);
