#!/usr/bin/env node
"use strict";

// The scoring engine: the ledger, the caps, and what a public board may say.
//
// Every rule here is one a passing test would not notice. A score that a client
// can write itself looks identical on screen to one it cannot. A leaderboard
// that leaks a visit count renders beautifully. These are source contracts
// because that is the only place the defect exists.
//
// The privacy findings this defends come from .claude/agents/privacy-reviewer.md
// check 6 (reconstruction) and check 7 ("leakage through the back door"):
// counts and ordered lists reveal position without a coordinate ever appearing.
//
// WHY THIS READS EVERY MIGRATION AND NOT ONE FILE
//
// It used to read 20260810040000 alone. That was fine while one file defined
// the engine and became a hole the moment a second one touched it: a later
// migration could have replaced award_checkin_score with a version that skipped
// the caps, or widened get_explorer_score, and this gate would have gone on
// checking the original and passing. So every definition below is the LAST one
// across all migrations in order -- the same thing Postgres ends up with.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const migrationsDir=path.join(root,"supabase","migrations");
let passed=0;
const failures=[];

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

const migrations=fs.readdirSync(migrationsDir)
  .filter((name)=>name.endsWith(".sql"))
  .sort()
  .map((name)=>({name,body:fs.readFileSync(path.join(migrationsDir,name),"utf8")}));

check(migrations.length>0,"supabase/migrations: nothing to check");

// Comments stripped, so a gate cannot be satisfied by prose describing the rule
// it is meant to enforce.
function code(source){
  return source.replace(/^\s*--.*$/gm,"");
}

const ALL=migrations.map((m)=>code(m.body)).join("\n");

// The last DEFINITION of a function, and which file it came from.
//
// It has to match `create [or replace] function <name>(` and not the bare name.
// The first version searched for `function <name>` and found the LAST mention
// in the file -- which for every one of these is the `create trigger ... execute
// function` line or a `comment on function`, not the definition. It sliced from
// there, got a few characters, and reported nine rules as broken against code
// that implements all of them. A gate that fails on correct code is as useless
// as one that passes on broken code.
function latest(name){
  const definition=new RegExp(
    `create\\s+(or\\s+replace\\s+)?function\\s+${name.replace(/\./g,"\\.")}\\s*\\(`,
    "g"
  );

  let found="";
  let file="";
  for(const migration of migrations){
    const body=code(migration.body);
    let at=-1;
    definition.lastIndex=0;
    for(let match=definition.exec(body);match;match=definition.exec(body)){
      at=match.index;
    }
    if(at===-1) continue;
    const end=body.indexOf("$$;",at);
    found=end===-1 ? body.slice(at) : body.slice(at,end);
    file=migration.name;
  }
  return{body:found,file};
}

function fn(name){return latest(name).body;}
function where(name){return latest(name).file||"supabase/migrations";}

// ---------------------------------------------------------------------------
// 1. A client cannot write itself a score
// ---------------------------------------------------------------------------

check(
  /revoke all on public\.explorer_score_events from anon,authenticated;/.test(ALL),
  "supabase/migrations: does not revoke ledger access from clients"
);

check(
  /grant select on public\.explorer_score_events to authenticated;/.test(ALL),
  "supabase/migrations: does not grant the read an Explorer needs for their own score"
);

check(
  !/grant\s+(insert|update|delete)[^;]*explorer_score_events/i.test(ALL),
  "supabase/migrations: grants a write on the score ledger — points must be awarded server-side only"
);

check(
  /alter table public\.explorer_score_events enable row level security/.test(ALL),
  "supabase/migrations: the score ledger has no row level security"
);

check(
  /for select to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/.test(ALL),
  "supabase/migrations: an Explorer can read score rows that are not theirs"
);

// ---------------------------------------------------------------------------
// 2. Diminishing returns, and caps in the database
// ---------------------------------------------------------------------------

const points=fn("guestbook_private.checkin_points");

check(
  /power\(2,/.test(points),
  `${where("guestbook_private.checkin_points")}: check-in points do not diminish — the 5th check-in at a place must score less than the 1st`
);

// subject_key, formerly place_key. Renamed in 20260812150000 because the same
// column now answers "how much has this Explorer already earned for THIS
// thing" for a review as well as a place. Same column, same rule.
check(
  /count\(\*\)[\s\S]*subject_key=p_place/.test(points),
  `${where("guestbook_private.checkin_points")}: diminishing returns are not keyed to the same place`
);

const caps=fn("guestbook_private.score_within_caps");

check(
  /awarded_on=\(now\(\) at time zone 'utc'\)::date/.test(caps),
  "supabase/migrations: has no daily cap"
);

check(
  /awarded_on>=\(\(now\(\) at time zone 'utc'\)::date-6\)/.test(caps),
  "supabase/migrations: has no weekly cap"
);

for(const awarder of [
  "guestbook_private.award_review_score",
  "guestbook_private.award_checkin_score",
  "guestbook_private.award_endorsement_score"
]){
  check(
    /score_within_caps/.test(fn(awarder)),
    `${where(awarder)}: ${awarder} awards without checking the caps`
  );
}

// ---------------------------------------------------------------------------
// 2b. Endorsements are capped per review, and pay the author
// ---------------------------------------------------------------------------
//
// Nineteen accounts. Without a per-review cap, two people taking turns
// endorsing each other could top the board in an evening — the 100/400 daily
// and weekly caps are generous enough for real activity and would not stop it.

const endorsement=fn("guestbook_private.endorsement_points");

check(
  endorsement.length>0,
  "supabase/migrations: guestbook_private.endorsement_points is never defined"
);

check(
  /subject_key=p_review::text/.test(endorsement),
  `${where("guestbook_private.endorsement_points")}: the endorsement cap is not keyed to the review, so it caps the wrong thing`
);

check(
  /source='endorsement'/.test(endorsement) && />=\s*5/.test(endorsement),
  `${where("guestbook_private.endorsement_points")}: no per-review ceiling on endorsement points`
);

const awardEndorsement=fn("guestbook_private.award_endorsement_score");

check(
  /select er\.user_id into v_author/.test(awardEndorsement),
  `${where("guestbook_private.award_endorsement_score")}: the point does not go to whoever wrote the review`
);

check(
  /if v_author=new\.user_id then return new; end if;/.test(awardEndorsement),
  `${where("guestbook_private.award_endorsement_score")}: endorsing your own review would score`
);

check(
  /if new\.target_type<>'review' then return new; end if;/.test(awardEndorsement),
  `${where("guestbook_private.award_endorsement_score")}: scores likes on things that are not reviews`
);

// source_id must be the like row, not the review — two endorsements of the same
// review would otherwise collide on (source,source_id) and the second would be
// silently dropped.
check(
  /values \(v_author,'endorsement',new\.id,new\.target_id::text/.test(awardEndorsement),
  `${where("guestbook_private.award_endorsement_score")}: the endorsement is not keyed to the like row, so a second endorsement of the same review would be dropped`
);

// ---------------------------------------------------------------------------
// 3. Removing a contribution removes its points
// ---------------------------------------------------------------------------

check(
  /delete from public\.explorer_score_events\s*\n?\s*where source=tg_argv\[0\] and source_id=old\.id/.test(ALL),
  "supabase/migrations: deleting a contribution does not remove its points"
);

for(const trigger of ["explorer_review_unscored","live_checkin_unscored","social_likes_unscored"]){
  check(
    new RegExp(`create trigger ${trigger} after delete`).test(ALL),
    `supabase/migrations: ${trigger} is missing — a withdrawn contribution would keep its points`
  );
}

// ---------------------------------------------------------------------------
// 4. Nothing readable can be turned back into movement
// ---------------------------------------------------------------------------

const publicScore=fn("public.get_explorer_score");

check(
  /select coalesce\(sum\(points\),0\)::bigint/.test(publicScore),
  "supabase/migrations: get_explorer_score is not a single opaque total"
);

check(
  !/group by/i.test(publicScore),
  "supabase/migrations: get_explorer_score groups its result — a per-source split is a visit count"
);

check(
  !/subject_key|place_key/.test(publicScore) && !/awarded_on/.test(publicScore),
  "supabase/migrations: get_explorer_score exposes a subject or a date"
);

const breakdown=fn("public.get_explorer_score_breakdown");

check(
  /user_id=\(select auth\.uid\(\)\)/.test(breakdown),
  "supabase/migrations: the score breakdown is not filtered to the caller — it is the owner's alone"
);

check(
  !/security definer/i.test(breakdown),
  "supabase/migrations: the breakdown is SECURITY DEFINER — it must read as the caller so RLS refuses other people's rows"
);

check(
  !/uuid/.test(breakdown.split("returns table")[1]?.split(")")[0] || ""),
  "supabase/migrations: the breakdown takes a user id — that would let one Explorer request another's split"
);

check(
  !/subject_key|place_key/.test(breakdown),
  "supabase/migrations: subject_key escapes through a reader — it is the one column that could rebuild movement"
);

// ---------------------------------------------------------------------------
// 4b. The public board says a position and a total, and nothing else
// ---------------------------------------------------------------------------
//
// This is the check that had to exist the moment the board started ranking on
// the ledger (20260812140000). Review points are a fixed 5, or 15 verified. So
// publishing a review count next to a ledger total means anybody can compute
//
//   check-in points = points - (5 x unverified) - (15 x verified)
//
// and, knowing the halving rule, work back to roughly how many different places
// somebody has been. The counts were on the board before and were harmless only
// because points came from reviews alone.

const board=fn("public.get_explorer_leaderboard");

check(
  board.length>0,
  "supabase/migrations: public.get_explorer_leaderboard is never defined"
);

const boardReturns=board.split("returns table")[1]?.split("$$")[0] || "";

for(const leaked of ["review_count","verified_reviews","video_reviews","checkin","subject_key","place_key","awarded_on"]){
  check(
    !new RegExp(`\\b${leaked}\\b`).test(boardReturns),
    `${where("public.get_explorer_leaderboard")}: the public board returns ${leaked} — a count beside a ledger total can be subtracted back into a visit history`
  );
}

check(
  /explorer_score_events/.test(board),
  `${where("public.get_explorer_leaderboard")}: the board does not rank on the score ledger`
);

check(
  /leaderboard_opt_in/.test(board),
  `${where("public.get_explorer_leaderboard")}: the board ignores the opt-out`
);

// An area is shown only by somebody who chose to show one.
check(
  /show_area/.test(board),
  `${where("public.get_explorer_leaderboard")}: the board publishes an area without checking show_area`
);

// The tiebreak must not encode the hidden split either. Ordering by a column
// the board refuses to return still leaks it, one step removed.
check(
  !/order by points desc,\s*(verified|video|review_count)/.test(board),
  `${where("public.get_explorer_leaderboard")}: ties are broken on a hidden count — the order would encode the split the columns were removed to hide`
);

// ---------------------------------------------------------------------------
// 5. It does not redefine a figure other packets already show
// ---------------------------------------------------------------------------

check(
  !/update public\.explorer_profile_stats/i.test(ALL),
  "supabase/migrations: rewrites the existing review-points figures — Explorer Score is added alongside them, not on top of them"
);

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Score engine check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Score engine check passed (${passed} checks).`);
