#!/usr/bin/env node

// Packet 8d: Memories, and the two-phase lifecycle that is the whole point.
//
// The checks that matter here are the ones about the archive. A Memory that
// was public while it was live must not stay publicly readable afterwards
// unless its creator said so, and that has to be true of the row rather than
// of a screen. Everything below exists because removing it would be silent.

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

function code(relative){
  return read(relative)
    .split("\n")
    .filter((line)=>!line.trim().startsWith("--") && !line.trim().startsWith("//"))
    .join("\n");
}

const MIGRATION="supabase/migrations/20260805130000_explorer_memories.sql";

for(const file of [
  MIGRATION,
  "utils/memories.js",
  "app/memories/create.js",
  "app/memories/[id].js",
  "docs/MEMORIES_TEST_PLAN.md"
]){
  check(fs.existsSync(path.join(root,file)),`${file}: required file is missing`);
}

// ---------------------------------------------------------------------------
// 1. A table of its own, and never sourced from check-ins
// ---------------------------------------------------------------------------

contains(MIGRATION,[
  "create table if not exists public.explorer_memories",
  "create table if not exists public.explorer_memory_shares",
  "visibility text not null default 'private'",
  "archive_visibility text not null default 'private'",
  "show_on_profile boolean not null default false",
  "live_until timestamptz"
]);

const sql=read(MIGRATION);
const sqlCode=code(MIGRATION);

// The 2026-08-04 privacy review's conclusion, kept enforceable: My Map reads
// Memories, and a Memory is never assembled out of the thing the app promises
// to forget.
check(
  !/from public\.live_checkins/i.test(sqlCode),
  `${MIGRATION}: reads live_checkins — a Memory is created deliberately, never reconstructed from expiring check-ins`
);

// ---------------------------------------------------------------------------
// 2. The archive starts closed, and is never inherited
// ---------------------------------------------------------------------------

check(
  /archive_visibility text not null default 'private'/.test(sql),
  `${MIGRATION}: archive_visibility does not default to private`
);

check(
  !/archive_visibility\s*(:?=|,)\s*(new\.)?visibility\b/.test(sqlCode),
  `${MIGRATION}: copies visibility into archive_visibility — consenting to be seen today is not consenting to be seen forever`
);

// ---------------------------------------------------------------------------
// 3. Anything shared expires
// ---------------------------------------------------------------------------

contains(MIGRATION,[
  "explorer_memories_shared_needs_expiry",
  "check (visibility='private' or live_until is not null)",
  "A Memory other people can see needs an end date for its live period"
]);

// ---------------------------------------------------------------------------
// 4. The phase decides which rule applies -- in the database
// ---------------------------------------------------------------------------

contains(MIGRATION,[
  "guestbook_private.memory_is_live",
  "guestbook_private.can_read_memory"
]);

check(
  /case when guestbook_private\.memory_is_live\(m\.live_until\)[\s\S]{0,120}then m\.visibility[\s\S]{0,80}else m\.archive_visibility end/.test(sql),
  `${MIGRATION}: can_read_memory no longer picks the rule by phase — that branch IS the packet`
);

check(
  /if p_viewer is not null and m\.user_id=p_viewer then return true/.test(sql),
  `${MIGRATION}: the creator can no longer read their own Memory in both phases`
);

check(
  /if v_rule='friends' then return guestbook_private\.are_friends/.test(sql),
  `${MIGRATION}: 'friends' is no longer a mutual-follow test`
);

check(
  /if v_rule='selected' then[\s\S]{0,200}explorer_memory_shares/.test(sql),
  `${MIGRATION}: 'selected' no longer uses the share relationship`
);

// The read policy is split by role for the reason 20260805120400 recorded:
// anon cannot execute anything in guestbook_private.
check(
  /create policy explorer_memories_read_anon on public\.explorer_memories\s+for select to anon/.test(sql),
  `${MIGRATION}: no anon read policy — a signed-out visitor would evaluate a guestbook_private function and be refused`
);

check(
  !/create policy explorer_memories_read_anon[\s\S]*?;/.exec(sql)?.[0]?.includes("can_read_memory"),
  `${MIGRATION}: the anon policy calls can_read_memory, which anon cannot execute`
);

check(
  /create policy explorer_memories_read_anon[\s\S]*?;/.exec(sql)?.[0]?.includes("archive_visibility='public'"),
  `${MIGRATION}: the anon policy does not fall back to archive_visibility after expiry`
);

check(
  !/for select to public/.test(sqlCode),
  `${MIGRATION}: a read policy targets "public", which includes anon`
);

// ---------------------------------------------------------------------------
// 5. show_on_profile is a filter, not a permission
// ---------------------------------------------------------------------------

check(
  /security invoker|SECURITY INVOKER/.test(sql) || !/security definer/i.test(
    /create or replace function public\.get_explorer_memories[\s\S]*?\$\$/.exec(sql)?.[0] || ""
  ),
  `${MIGRATION}: get_explorer_memories is SECURITY DEFINER — it would decide visibility instead of row level security deciding it`
);

check(
  !/show_on_profile[\s\S]{0,80}(or|and)[\s\S]{0,40}visibility='public'/.test(sqlCode),
  `${MIGRATION}: show_on_profile is being treated as a permission rather than a filter`
);

contains("components/ExplorerProfileScreen.js",[
  "get_explorer_memories",
  "p_scope:\"profile\""
]);

// ---------------------------------------------------------------------------
// 6. The screens say both decisions out loud
// ---------------------------------------------------------------------------

// 'private' and 'public', until 2026-08-13. This gate asserted them, which is
// part of why the bug lived: the canonical-audience migration made the database
// refuse both words, nobody could keep a Memory at all, and every check in this
// file went on passing because it was comparing the app to itself. The closed
// setting is still the default -- it is now spelled the way the database spells
// it. scripts/verify-audience-vocabulary.cjs is the check that reads the words
// rather than trusting them.
contains("utils/memories.js",[
  "DEFAULT_MEMORY_VISIBILITY=\"nobody\"",
  "DEFAULT_ARCHIVE_VISIBILITY=\"nobody\"",
  "MEMORY_VISIBILITY",
  "ARCHIVE_VISIBILITY",
  "LIVE_DURATIONS"
]);

const memoriesUtil=read("utils/memories.js");

check(
  /\{\s*key:"nobody"/.test(memoriesUtil.slice(memoriesUtil.indexOf("MEMORY_VISIBILITY"))),
  "utils/memories.js: nobody is no longer the first live audience — the closed setting is the default"
);

contains("app/memories/create.js",[
  "WHO CAN SEE IT WHILE IT IS LIVE",
  "AFTERWARDS",
  "live_until:isPrivate ? null : liveUntilFrom(duration)",
  "archive_visibility:archiveVisibility",
  "show_on_profile:showOnProfile"
]);

check(
  read("app/memories/create.js").includes("useState(DEFAULT_ARCHIVE_VISIBILITY)"),
  "app/memories/create.js: the archive setting no longer starts from the closed default"
);

check(
  !/archiveVisibility\s*=\s*visibility|setArchiveVisibility\(visibility\)/.test(read("app/memories/create.js")),
  "app/memories/create.js: copies the live audience into the archive setting"
);

contains("app/memories/[id].js",[
  "setArchiveVisibility",
  "toggleProfile",
  "confirmDelete",
  "Alert.alert",
  "showFeedback"
]);

const detail=read("app/memories/[id].js");

check(
  (detail.match(/if\(!data \|\| !data\.length\)/g) || []).length>=1 && detail.includes("!data.length"),
  "app/memories/[id].js: a write path does not check that a row actually changed — an RLS refusal returns no error, only zero rows"
);

check(
  detail.includes("Changing this never puts the Memory back on the live map"),
  "app/memories/[id].js: no longer tells the owner that reopening the archive does not restore live visibility"
);

// ---------------------------------------------------------------------------
// 7. Nothing from a later packet crept in
// ---------------------------------------------------------------------------

for(const [file,banned,why] of [
  [MIGRATION,/trending|activity_score|place_activity/i,"ranking and trending belong to 8f2"],
  [MIGRATION,/create (or replace )?view public\.activity/i,"the shared activity projection belongs to 8f1"],
  ["app/memories/create.js",/My Map|my_map/i,"My Map is 8b"]
]){
  check(!banned.test(code(file)),`${file}: ${why}`);
}

contains("app/_layout.js",['name="memories/create"','name="memories/[id]"']);
contains("utils/drawer.js",['route:"/memories/create"']);

if(failures.length){
  console.error(`Memories check failed (${passed} passed, ${failures.length} failed):\n`);
  for(const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Memories check passed (${passed} checks).`);
