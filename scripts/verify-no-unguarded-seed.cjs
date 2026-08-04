#!/usr/bin/env node

// Packet 0: no migration may insert development data into a database that did
// not ask for it.
//
// Three migrations seeded rows for manager@test.com unconditionally, and one of
// them raised an exception when that auth user was absent -- so a fresh
// `supabase db reset` on a clean project failed outright. They are now opt-in
// behind `guestbook.seed_test_data`, and this keeps them that way.
//
// The rule is deliberately narrow: a migration that references a hardcoded test
// account must also read the opt-in setting. It does not try to judge whether
// any given INSERT is "real" data, because that is not decidable from the file.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const migrationsDir=path.join(root,"supabase","migrations");

const SEED_SETTING="guestbook.seed_test_data";

// Markers that a migration is writing development data rather than schema.
const TEST_ACCOUNT_MARKERS=[
  "manager@test.com",
  "explorer@test.com",
  "explorer2@test.com"
];

const failures=[];
let checked=0;

for(const name of fs.readdirSync(migrationsDir).sort()){
  if(!name.endsWith(".sql")) continue;

  const sql=fs.readFileSync(path.join(migrationsDir,name),"utf8");
  const marker=TEST_ACCOUNT_MARKERS.find((m)=>sql.includes(m));

  if(!marker) continue;

  checked+=1;

  if(!sql.includes(SEED_SETTING)){
    failures.push(
      `${name}: references ${marker} but never reads ${SEED_SETTING}, so it would seed test data on any fresh apply`
    );
    continue;
  }

  // The guard has to come before the first write, or it guards nothing.
  const guardAt=sql.indexOf(SEED_SETTING);
  const firstWrite=[...sql.matchAll(/^\s*(insert|update|delete)\s/gim)]
    .map((match)=>match.index)
    .sort((a,b)=>a-b)[0];

  if(firstWrite!==undefined && guardAt>firstWrite){
    failures.push(
      `${name}: reads ${SEED_SETTING} only after its first write, so the guard has no effect`
    );
  }
}

if(checked===0){
  failures.push(
    "no migration referencing a test account was found -- this check has silently stopped checking anything"
  );
}

if(failures.length){
  console.error("Unguarded seed data check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Seed data check passed (${checked} test-data migrations, all opt-in behind ${SEED_SETTING}).`);
