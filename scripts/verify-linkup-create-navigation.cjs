#!/usr/bin/env node

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative} is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

const index=read("app/linkups/index.js");
const create=read("app/linkups/create.js");
const form=read("components/LinkupForm.js");
const layout=read("app/_layout.js");
const migration=read("supabase/migrations/20260802212100_quick_create_linkup.sql");

const titleValidation=form.indexOf('if(cleanTitle.length<3 || cleanTitle.length>100)');
const optionalValidation=form.indexOf('if(!titleOnly){');

const checks=[
  [index.includes('import {Link,router,useFocusEffect} from "expo-router"'),"Link-ups screen must import Expo Router Link"],
  [index.includes('<Link href="/linkups/create" asChild>'),"Create Link-up must use a real /linkups/create Link"],
  [index.includes('testID="create-linkup-button"'),"Create Link-up control must retain its regression test identifier"],
  [!index.includes('onPress={()=>router.push("/linkups/create")}'),"Create Link-up must not fall back to broken press-only navigation"],
  [create.includes("export default function CreateLinkup"),"Create Link-up route component is missing"],
  [create.includes('rpc("create_linkup"'),"Create Link-up route is not connected to create_linkup"],
  // A pattern, not the exact characters. This asserted one literal string and
  // broke the moment the form gained `initial` -- the prop that carries a point
  // somebody pressed and held on the map. What matters is that the create route
  // still renders the full form in title-only mode, not the order of its props.
  [/<LinkupForm[^>]*\bonSubmit=\{create\}[^>]*\btitleOnly\b/.test(create),"Create route must retain the full form with title-only validation"],
  [layout.includes('name="linkups/create"'),"Root router does not register linkups/create"],
  [form.includes('titleOnly=false'),"LinkupForm title-only mode is missing"],
  [titleValidation>=0,"Title validation is missing"],
  [optionalValidation>titleValidation,"Optional-field validation must be gated after title validation"],
  [form.includes('const safeStart=startIso || fallbackStart'),"Blank dates must receive a safe start default"],
  [form.includes('const safeEnd=(endIso && new Date(endIso)>new Date(safeStart))'),"Blank or invalid end times must receive a safe end default"],
  [form.includes('const safeLimit=Number.isInteger(limit) && limit>=2 && limit<=50 ? limit : 8'),"Blank or invalid capacity must default to eight"],
  [migration.includes("v_description:=case"),"Server must default a blank description"],
  [migration.includes("else coalesce(v_profile_area,'Local area')"),"Server must default a blank area"],
  [migration.includes("else 'Public meeting place to be confirmed'"),"Server must default a blank meeting place"],
  [migration.includes("else 8"),"Server must default blank capacity"],
  [migration.includes("else 'public'"),"Server must default blank visibility"],
  [migration.includes("char_length(v_title) not between 3 and 100"),"Server must still require a valid title"]
];

for(const [condition,message] of checks){
  if(!condition) failures.push(message);
}

if(failures.length){
  console.error(`Link-up create navigation and title-only check FAILED (${failures.length} issue${failures.length===1?"":"s"}).`);
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Link-up create navigation and title-only check passed (${checks.length} checks).`);
