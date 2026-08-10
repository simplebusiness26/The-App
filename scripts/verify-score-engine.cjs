#!/usr/bin/env node
"use strict";

// Packet 9a: the scoring engine.
//
// Every rule here is one a passing test would not notice. A score that a client
// can write itself looks identical on screen to one it cannot. A leaderboard
// that leaks a visit count renders beautifully. These are source contracts
// because that is the only place the defect exists.
//
// The privacy findings this defends come from .claude/agents/privacy-reviewer.md
// check 7, "leakage through the back door": counts and ordered lists reveal
// position without a coordinate ever appearing.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

const MIGRATION="supabase/migrations/20260810040000_explorer_score_engine.sql";
const sql=fs.readFileSync(path.join(root,MIGRATION),"utf8");

function fn(name){
  const start=sql.indexOf(`function ${name}`);
  if(start===-1) return "";
  const end=sql.indexOf("$$;",start);
  return end===-1 ? sql.slice(start) : sql.slice(start,end);
}

// ---------------------------------------------------------------------------
// 1. A client cannot write itself a score
// ---------------------------------------------------------------------------
//
// The brief's first criterion. The ledger must carry no write grant at all --
// the triggers are SECURITY DEFINER, so they write regardless of what the
// caller may do.

check(
  /revoke all on public\.explorer_score_events from anon,authenticated;/.test(sql),
  `${MIGRATION}: does not revoke ledger access from clients`
);

check(
  /grant select on public\.explorer_score_events to authenticated;/.test(sql),
  `${MIGRATION}: does not grant the read an Explorer needs for their own score`
);

check(
  !/grant\s+(insert|update|delete)[^;]*explorer_score_events/i.test(sql),
  `${MIGRATION}: grants a write on the score ledger — points must be awarded server-side only`
);

check(
  /alter table public\.explorer_score_events enable row level security/.test(sql),
  `${MIGRATION}: the score ledger has no row level security`
);

check(
  /for select to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/.test(sql),
  `${MIGRATION}: an Explorer can read score rows that are not theirs`
);

// ---------------------------------------------------------------------------
// 2. Diminishing returns, and caps in the database
// ---------------------------------------------------------------------------

const points=fn("guestbook_private.checkin_points");

check(
  /power\(2,/.test(points),
  `${MIGRATION}: check-in points do not diminish — the 5th check-in at a place must score less than the 1st`
);

check(
  /count\(\*\)[\s\S]*place_key=p_place/.test(points),
  `${MIGRATION}: diminishing returns are not keyed to the same place`
);

const caps=fn("guestbook_private.score_within_caps");

check(
  /awarded_on=\(now\(\) at time zone 'utc'\)::date/.test(caps),
  `${MIGRATION}: has no daily cap`
);

check(
  /awarded_on>=\(\(now\(\) at time zone 'utc'\)::date-6\)/.test(caps),
  `${MIGRATION}: has no weekly cap`
);

for(const awarder of ["guestbook_private.award_review_score","guestbook_private.award_checkin_score"]){
  check(
    /score_within_caps/.test(fn(awarder)),
    `${MIGRATION}: ${awarder} awards without checking the caps`
  );
}

// ---------------------------------------------------------------------------
// 3. Deleting a contribution removes its points
// ---------------------------------------------------------------------------

check(
  /delete from public\.explorer_score_events\s*\n?\s*where source=tg_argv\[0\] and source_id=old\.id/.test(sql),
  `${MIGRATION}: deleting a contribution does not remove its points`
);

for(const trigger of ["explorer_review_unscored","live_checkin_unscored"]){
  check(
    new RegExp(`create trigger ${trigger} after delete`).test(sql),
    `${MIGRATION}: ${trigger} is missing — a deleted contribution would keep its points`
  );
}

// ---------------------------------------------------------------------------
// 4. The leaderboard cannot be read back as movement
// ---------------------------------------------------------------------------
//
// privacy-reviewer check 6 (reconstruction) and 7 (leakage through the back
// door). A per-source split is a visit count; a local leaderboard scoped to an
// area turns that into "was here roughly N times".

const publicScore=fn("public.get_explorer_score");

check(
  /select coalesce\(sum\(points\),0\)::bigint/.test(publicScore),
  `${MIGRATION}: get_explorer_score is not a single opaque total`
);

check(
  !/group by/i.test(publicScore),
  `${MIGRATION}: get_explorer_score groups its result — a per-source split is a visit count`
);

check(
  !/place_key/.test(publicScore) && !/awarded_on/.test(publicScore),
  `${MIGRATION}: get_explorer_score exposes a place or a date`
);

const breakdown=fn("public.get_explorer_score_breakdown");

check(
  /user_id=\(select auth\.uid\(\)\)/.test(breakdown),
  `${MIGRATION}: the score breakdown is not filtered to the caller — it is the owner's alone`
);

check(
  !/security definer/i.test(breakdown),
  `${MIGRATION}: the breakdown is SECURITY DEFINER — it must read as the caller so RLS refuses other people's rows`
);

check(
  !/uuid/.test(breakdown.split("returns table")[1]?.split(")")[0] || ""),
  `${MIGRATION}: the breakdown takes a user id — that would let one Explorer request another's split`
);

// place_key exists only for diminishing returns and must never leave the table.
check(
  !/place_key/.test(breakdown) && !/place_key/.test(publicScore),
  `${MIGRATION}: place_key escapes through a reader — it is the one column that could rebuild movement`
);

// ---------------------------------------------------------------------------
// 5. It does not redefine a figure eleven packets already show
// ---------------------------------------------------------------------------

check(
  !/update public\.explorer_profile_stats|alter table public\.explorer_reviews/i.test(sql),
  `${MIGRATION}: changes the existing review-points figures — Explorer Score is added alongside them, not on top of them`
);

// ---------------------------------------------------------------------------

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nScore engine check failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Score engine check passed (${passed} checks).`);
