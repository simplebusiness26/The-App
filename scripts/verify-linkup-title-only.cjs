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

const createScreen=read("app/linkups/create.js");
const form=read("components/LinkupForm.js");
const migration=read("supabase/migrations/20260802212100_quick_create_linkup.sql").toLowerCase();

check(createScreen.includes('import LinkupForm from "../../components/LinkupForm"'),"create screen: full LinkupForm import is missing");
// A pattern rather than the exact characters -- see the note in
// verify-linkup-create-navigation.cjs. The guarantee is "the create screen
// renders the full form in title-only mode", not "these props in this order".
check(/<LinkupForm[^>]*\bonSubmit=\{create\}[^>]*\btitleOnly\b/.test(createScreen),"create screen: full form is not configured for title-only submission");
check(createScreen.includes('rpc("create_linkup"'),"create screen: create_linkup RPC is missing");
check(!createScreen.includes('rpc("quick_create_linkup"'),"create screen: obsolete quick-create-only RPC is still used");

for(const label of [
  "Description",
  "Category",
  "Starts",
  "Ends",
  "Area",
  "Public meeting place",
  "Exact meeting instructions",
  "Maximum attendees",
  "Who can see this?"
]){
  check(form.includes(`>${label}<`) || form.includes(`>${label}</Text>`),`full form: ${label} field is missing`);
}

check(form.includes("titleOnly=false"),"form: titleOnly mode is missing");
check(form.includes("if(!titleOnly){"),"form: optional-field validation is not isolated from title-only creation");
check(form.includes('Add a title with between 3 and 100 characters.'),"form: title validation is missing");
check(form.includes("safeLimit"),"form: safe attendee fallback is missing");
check(form.includes("safeStart")&&form.includes("safeEnd"),"form: safe date fallbacks are missing");

for(const contract of [
  "create or replace function public.create_linkup",
  "details will be added by the organiser.",
  "local area",
  "public meeting place to be confirmed",
  "when p_max_attendees between 2 and 50",
  "else 8",
  "when p_visibility in ('public','followers')",
  "else 'public'",
  "drop function if exists public.quick_create_linkup(text)",
  "grant execute on function public.create_linkup"
]){
  check(migration.includes(contract),`title-only migration: missing contract ${contract}`);
}

if(failures.length){
  console.error(`Title-only Link-up creation gate FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Title-only Link-up creation gate passed (${passed} checks).`);
