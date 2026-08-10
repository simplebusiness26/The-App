#!/usr/bin/env node
"use strict";

// Packet 8f2: the trending formula and source reasons.
//
// The rules here are the ones a passing test would not notice. A trending list
// that quietly rewards volume, or that lets private content move a public
// ranking, renders perfectly and scores well. The defect is in what the formula
// is allowed to consider, which is a source question.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function read(file){
  return fs.readFileSync(path.join(root,file),"utf8");
}

function code(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const MODEL="utils/trending.js";
const FEED="app/feed.js";
const MIGRATION="supabase/migrations/20260810030000_feed_source_reasons_and_trending.sql";

const model=code(read(MODEL));
const feed=code(read(FEED));
const sql=read(MIGRATION);

// ---------------------------------------------------------------------------
// 1. All eight factors the owner named exist, separately
// ---------------------------------------------------------------------------
//
// Named individually so a weight can be argued with one at a time. A single
// opaque scoring expression is a ranking nobody will ever change.

for(const factor of [
  "recencyScore","velocityScore","distinctPeopleScore","proximityScore",
  "isModerationClear","passesAntiSpam","cappedContributions","isPublicOnly"
]){
  check(
    new RegExp(`export function ${factor}\\s*\\(`).test(model),
    `${MODEL}: ${factor}() is missing — the owner named eight factors and each must be separately arguable`
  );
}

// ---------------------------------------------------------------------------
// 2. The gates are gates, not weights
// ---------------------------------------------------------------------------
//
// Moderation, privacy and anti-spam must be able to zero a score outright. If
// any of them became a multiplier, enough engagement would outvote them.

const scoreBody=model.slice(model.indexOf("export function trendingScore"));

for(const [gate,why] of [
  ["isModerationClear","a reported thing is a problem, not a trend"],
  ["isPublicOnly","a private Moment must never move a public ranking"],
  ["passesAntiSpam","one person must not be able to make a place trend"]
]){
  check(
    new RegExp(`if\\(!${gate}\\(`).test(scoreBody),
    `${MODEL}: ${gate} is not an early return in trendingScore — ${why}, so it cannot be a weight`
  );
}

// ---------------------------------------------------------------------------
// 3. Volume alone cannot trend
// ---------------------------------------------------------------------------

check(
  /MINIMUM_DISTINCT_POSTERS\s*=\s*[2-9]/.test(model),
  `${MODEL}: does not require more than one distinct poster`
);

check(
  /MAX_COUNTED_PER_POSTER\s*=\s*[1-9]/.test(model) && /Math\.min\(/.test(model),
  `${MODEL}: does not cap one account's repeat posting — volume from a single account would compound`
);

check(
  /Math\.sqrt\(/.test(model),
  `${MODEL}: distinct people scale linearly — the tenth person should add less than the second`
);

// Proximity multiplies rather than adds, so distance cannot be outrun.
check(
  /\*\s*proximityScore\(/.test(model),
  `${MODEL}: proximity is not multiplicative — trending in another town would still be trending`
);

// Unknown distance must not be treated as near. Matched on the branch itself:
// `return 0.5` appears twice in proximityScore, so looking for the literal
// anywhere let one of the two branches be changed with the gate still green.
check(
  /distanceKm===null \|\| distanceKm===undefined\) return 0\.5;/.test(model),
  `${MODEL}: an unknown distance is not neutral — anything with a missing coordinate would float to the top`
);

check(
  /!Number\.isFinite\(km\) \|\| km<0\) return 0\.5;/.test(model),
  `${MODEL}: a nonsense distance is not neutral`
);

// Scoped to the trending function's own body. The first version of this check
// searched the whole file for "order by" near pow/exp/log and matched
// `get_exp`lorer_social_feed -- a false positive entirely of the regex's making,
// which is exactly how a gate gets switched off.
const trendingBody=sql.slice(
  sql.indexOf("create or replace function public.get_trending_places"),
  sql.indexOf("comment on function public.get_trending_places")
);

// ---------------------------------------------------------------------------
// 4. Source reasons are a list
// ---------------------------------------------------------------------------
//
// The owner was explicit: an array, deduplicated, not one lossy label.

check(
  /new Set\(/.test(model),
  `${MODEL}: source reasons are not deduplicated`
);

check(
  /export function orderReasons/.test(model) && /REASON_ORDER/.test(model),
  `${MODEL}: reasons have no defined order — the first one shown should be the most specific`
);

// The feed must tolerate a row with no reasons, because that is every row until
// the migration is applied.
check(
  /reasonsFor\s*\(/.test(feed),
  `${FEED}: does not render source reasons`
);

check(
  /reasonsFor\(item\)\.length\s*>\s*0/.test(feed),
  `${FEED}: does not guard on an empty reason list — every row has none until the 8f2 migration is applied`
);

// ---------------------------------------------------------------------------
// 5. The ranking is not in SQL
// ---------------------------------------------------------------------------
//
// The migration returns counts. Ranking that lives in SQL can only be changed
// by a migration and can only be checked against production.

check(trendingBody.length>0,`${MIGRATION}: get_trending_places not found`);

// It returns every qualifying row, unordered and unlimited. Ranking and
// truncation are the client's, where they can be changed without a migration.
check(
  !/\blimit\s+\d/i.test(trendingBody),
  `${MIGRATION}: get_trending_places truncates — the client ranks, so the database must not decide what falls off the end`
);

// Every `order by` in there must be inside an array_agg picking the most recent
// snapshot. A top-level one would be a ranking.
const orderBys=(trendingBody.match(/order by/gi) || []).length;
const snapshotOrders=(trendingBody.match(/array_agg\([^)]*order by/gi) || []).length;

check(
  orderBys===snapshotOrders,
  `${MIGRATION}: get_trending_places orders its result (${orderBys} order-by, ${snapshotOrders} inside array_agg) — it returns counts, and utils/trending.js scores them`
);

check(
  /distinct p\.user_id/.test(sql),
  `${MIGRATION}: does not count DISTINCT posters — distinctness is the whole anti-gaming story and only the database can establish it`
);

check(
  /distinct l\.user_id/.test(sql),
  `${MIGRATION}: does not count DISTINCT engagers`
);

// Public only, said twice: RLS plus an explicit predicate. Scoped to the
// trending body -- the feed function also contains visibility='public', so
// checking the whole file passed while trending's own filter was deleted.
check(
  /visibility='public'/.test(trendingBody),
  `${MIGRATION}: get_trending_places does not restrict to public Moments — an aggregate that moves when one person posts privately is still a disclosure`
);

check(
  !/security definer/i.test(sql),
  `${MIGRATION}: uses SECURITY DEFINER — trending must read as the caller so row level security decides what is counted`
);

check(
  /distinct_posters>=2/.test(sql),
  `${MIGRATION}: does not enforce the anti-spam floor server-side as well as client-side`
);

// ---------------------------------------------------------------------------

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nTrending check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Trending check passed (${passed} checks).`);
