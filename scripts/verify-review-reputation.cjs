#!/usr/bin/env node

// Packet 8c: review reputation.
//
// The rule this defends: a review's own author cannot endorse it, Moments
// keep the word "Like" and reviews use "Useful", and the two are different
// components rather than one component with a label prop -- so a future edit
// to Moment behaviour cannot accidentally rewrite what a review endorsement
// means, and vice versa.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];
let passed=0;

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative}: file is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

function code(content){
  return content
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const ENDORSE="components/EndorseButton.js";
const LIKE="components/LikeButton.js";
const FEED="app/feed.js";
const PROFILE="components/ExplorerProfileScreen.js";
const VIDEO_COMMENTS="app/social-comments/[id].js";
const MOMENT_DETAIL="app/moments/[id].js";
const MIGRATION="supabase/migrations/20260805090000_review_endorsement_reputation.sql";

for(const file of [ENDORSE,MIGRATION]){
  check(fs.existsSync(path.join(root,file)),`${file}: required file is missing`);
}

// ---------------------------------------------------------------------------
// 1. EndorseButton is review-shaped, not a relabelled LikeButton
// ---------------------------------------------------------------------------

const endorse=code(read(ENDORSE));

check(/\.from\("social_likes"\)/.test(endorse),`${ENDORSE}: must write to social_likes, the existing endorsement table`);
check(/"review"/.test(endorse),`${ENDORSE}: target_type must be fixed to "review" — this component is not generic`);
check(/Useful/.test(endorse),`${ENDORSE}: must say "Useful", not a generic "Like"`);
check(!/>Like</.test(endorse) && !/"Like"/.test(endorse),`${ENDORSE}: must not use the word "Like" as its label — that word belongs to Moments`);

// The self-endorsement UI guard: the button must compare viewer to owner and
// stop before it ever calls .insert for that case.
check(
  /viewerId(?:\s*&&\s*ownerId)?\s*&&\s*ownerId\s*&&\s*viewerId===ownerId|viewerId===ownerId/.test(endorse),
  `${ENDORSE}: does not compare viewerId to ownerId — nothing stops a reviewer's own review reaching the endorse control`
);
check(
  /disabled[\s\S]{0,40}accessibilityLabel/.test(endorse) || /disabled\s+accessibilityRole="text"/.test(endorse),
  `${ENDORSE}: the owner's-own-review branch must render a disabled, non-actionable view, not a pressable that would only fail server-side`
);

// ---------------------------------------------------------------------------
// 2. LikeButton is untouched -- Moments still say Like
// ---------------------------------------------------------------------------

const like=read(LIKE);
check(!/Useful/.test(like),`${LIKE}: must not have picked up "Useful" — Moment likes stay Likes`);
check(/liked \? "Remove like" : "Like"/.test(like),`${LIKE}: Like/Remove like wording changed — Moments must keep this component as-is`);

// ---------------------------------------------------------------------------
// 3. Every review call-site uses EndorseButton; every Moment call-site keeps LikeButton
// ---------------------------------------------------------------------------

const feed=code(read(FEED));
check(/import EndorseButton from "\.\.\/components\/EndorseButton"/.test(feed),`${FEED}: does not import EndorseButton`);
check(/<EndorseButton/.test(feed),`${FEED}: does not render EndorseButton for review feed items`);
check(/<LikeButton/.test(feed),`${FEED}: Moments must still render LikeButton in the feed`);
check(
  /isMoment \? \(\s*<LikeButton/.test(feed) || /isMoment\s*\?\s*\(/.test(feed),
  `${FEED}: the moment/review branch must decide which button renders — a single unconditional button would give reviews the wrong one`
);

const profile=code(read(PROFILE));
check(!/LikeButton/.test(profile),`${PROFILE}: still references LikeButton — reviews on the profile must use EndorseButton, not Like`);
check(/<EndorseButton/.test(profile),`${PROFILE}: does not render EndorseButton on review cards`);
check(/get_explorer_review_reputation/.test(profile),`${PROFILE}: does not call the reputation RPC`);

for(const figure of ["total_endorsements","reviews_with_endorsement","average_endorsements_per_review","most_useful_review_id","most_useful_review_count"]){
  check(profile.includes(figure),`${PROFILE}: does not render the "${figure}" reputation figure`);
}

const videoComments=code(read(VIDEO_COMMENTS));
check(!/LikeButton/.test(videoComments),`${VIDEO_COMMENTS}: still references LikeButton — a video review's own like control must be EndorseButton`);
check(/<EndorseButton/.test(videoComments),`${VIDEO_COMMENTS}: does not render EndorseButton`);

const momentDetail=code(read(MOMENT_DETAIL));
check(/<LikeButton/.test(momentDetail),`${MOMENT_DETAIL}: a Moment's own like control must stay LikeButton — Moments were explicitly out of scope for this packet`);
check(!/EndorseButton/.test(momentDetail),`${MOMENT_DETAIL}: must not reference EndorseButton — a Moment is not a review`);

// ---------------------------------------------------------------------------
// 4. Database: self-endorsement is blocked, reputation is computable
// ---------------------------------------------------------------------------

const migration=read(MIGRATION).toLowerCase();

check(migration.includes("cannot mark your own review as useful"),`${MIGRATION}: missing the self-endorsement rejection`);
check(migration.includes("create or replace function guestbook_private.validate_social_target"),`${MIGRATION}: does not replace the shared social validation trigger`);
check(migration.includes("create or replace function public.get_explorer_review_reputation"),`${MIGRATION}: missing the reputation aggregate function`);
check(migration.includes("security invoker"),`${MIGRATION}: reputation function must be security invoker, matching explorer_profile_stats`);
check(migration.includes("status='published'") || migration.includes("status = 'published'"),`${MIGRATION}: reputation query must exclude non-published reviews`);
check(migration.includes("grant execute on function public.get_explorer_review_reputation"),`${MIGRATION}: missing the execute grant for the reputation function`);

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Review reputation check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Review reputation check passed (${passed} checks).`);
