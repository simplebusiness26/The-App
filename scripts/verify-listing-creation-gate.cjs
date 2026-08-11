#!/usr/bin/env node
"use strict";

// Packet 0 -- businesses and properties may only be created by an Explorer who
// has that capability unlocked.
//
// The failure this guards against is silent and total. From
// 20260803211732_rls_policies_and_grants.sql until
// 20260811120000_gate_business_and_property_creation.sql, the insert policy on
// both tables was `with check (auth.uid() = owner_id)` -- "you may create a
// business as long as you say it is yours", which everybody can say. Nothing in
// the app looked wrong: the Add screens were drawer-gated, so the hole was only
// reachable by calling the database directly, and no screen would ever have
// shown it.
//
// A gate that only checks the new migration exists would pass forever while
// somebody re-added the open policy in a later file. So this walks every
// migration in timestamp order and asserts the LAST word on each policy is the
// gated one.
//
// What this cannot check: that the database actually refuses the insert. That
// needs two real accounts against the live project and is recorded in the
// packet notes, not here.

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
  .sort();

check(migrations.length>0,"supabase/migrations: no migrations found at all");

// Strip SQL line comments so a policy quoted inside a "TO UNDO" note does not
// count as the live definition. Block comments are not used in these files.
function sql(source){
  return source.replace(/^\s*--.*$/gm,"");
}

const all=migrations.map((name)=>({
  name,
  body:sql(fs.readFileSync(path.join(migrationsDir,name),"utf8"))
}));

// ---------------------------------------------------------------------------
// 1. The last insert policy on each table must require the capability
// ---------------------------------------------------------------------------

for(const table of ["businesses","properties"]){
  const pattern=new RegExp(
    `create\\s+policy\\s+"[^"]*"\\s+on\\s+public\\.${table}\\s+for\\s+insert[\\s\\S]*?with\\s+check\\s*\\(([\\s\\S]*?)\\);`,
    "gi"
  );

  let last=null;
  let lastFile=null;
  for(const migration of all){
    let match;
    while((match=pattern.exec(migration.body))!==null){
      last=match[1];
      lastFile=migration.name;
    }
    pattern.lastIndex=0;
  }

  check(
    last!==null,
    `supabase/migrations: no insert policy found for public.${table}`
  );

  if(last!==null){
    check(
      /has_manager_capability/.test(last),
      `${lastFile}: the last insert policy on public.${table} does not call has_manager_capability -- anybody signed in can create one`
    );
    check(
      new RegExp(`has_manager_capability\\(\\s*'${table}'\\s*\\)`).test(last),
      `${lastFile}: the insert policy on public.${table} checks the wrong capability`
    );
    check(
      /owner_id\s*=\s*\(?\s*select\s+auth\.uid\(\)|auth\.uid\(\)\s*=\s*owner_id/i.test(last),
      `${lastFile}: the insert policy on public.${table} no longer ties the row to the Explorer creating it`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The capability columns must not default to granted
// ---------------------------------------------------------------------------
// businesses_status and properties_status were added `default 'active'`
// (20260801140000:11-14), which is why approving any one capability handed out
// these two as well: admin_decide_capability_request inserts a bare row
// (20260810001000:141-143) and the defaults fill the rest in.

for(const column of ["businesses_status","properties_status"]){
  const pattern=new RegExp(
    `alter\\s+column\\s+${column}\\s+set\\s+default\\s+'([a-z_]+)'|${column}[^,;]*?default\\s+'([a-z_]+)'`,
    "gi"
  );

  let last=null;
  let lastFile=null;
  for(const migration of all){
    let match;
    while((match=pattern.exec(migration.body))!==null){
      last=match[1]||match[2];
      lastFile=migration.name;
    }
    pattern.lastIndex=0;
  }

  check(
    last!==null,
    `supabase/migrations: no default found for manager_capabilities.${column}`
  );

  if(last!==null){
    check(
      last==="inactive",
      `${lastFile}: manager_capabilities.${column} defaults to '${last}' -- a bare insert grants the capability to somebody who never asked for it`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. The predicate itself must exist and stay one function
// ---------------------------------------------------------------------------

const withPredicate=all.filter((migration)=>
  /create\s+or\s+replace\s+function\s+public\.has_manager_capability/i.test(migration.body)
);

check(
  withPredicate.length>0,
  "supabase/migrations: public.has_manager_capability is never defined"
);

const definition=withPredicate[withPredicate.length-1];
if(definition){
  check(
    /grant\s+execute\s+on\s+function\s+public\.has_manager_capability\(text\)\s+to\s+authenticated/i
      .test(definition.body),
    `${definition.name}: has_manager_capability is not executable by authenticated -- every gated insert will fail`
  );
  check(
    !/to\s+anon/i.test(
      (definition.body.match(/grant\s+execute\s+on\s+function\s+public\.has_manager_capability[^;]*;/i)||[""])[0]
    ),
    `${definition.name}: has_manager_capability is granted to anon`
  );
}

if(failures.length){
  for(const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nListing creation gate failed (${passed} passed, ${failures.length} failed).`);
  process.exit(1);
}

console.log(`Listing creation gate passed (${passed} checks).`);
