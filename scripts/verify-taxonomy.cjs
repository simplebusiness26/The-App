#!/usr/bin/env node

// Packet 1: "The enum lives in one file, exported, used everywhere. If a second
// list of business types appears anywhere in the codebase, that's a bug."
//
// Two things are checked, and the second is the one that earns its keep:
//
//   1. utils/taxonomy.js is the only place the taxonomy is written down.
//   2. It has not drifted from what the migration seeded into the database.
//
// A catalogue table is only acceptable as "one source" because of check 2. The
// database is what actually enforces category/type pairs via
// businesses_classification_fk, so if the JS list and the seeded rows disagree,
// the app offers choices the database refuses -- which is worse than no
// validation at all, because it fails at save time in front of a user.

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

const TAXONOMY_FILE="utils/taxonomy.js";
const MIGRATION="supabase/migrations/20260804120000_business_taxonomy.sql";

// ---------------------------------------------------------------------------
// 1. Parse the JS source
// ---------------------------------------------------------------------------

const taxonomy=read(TAXONOMY_FILE);

// The module writes the unclassified key as the exported UNCLASSIFIED constant
// rather than a literal, so resolve it before matching. Parsing by regex rather
// than importing is forced by the file being ESM inside a CommonJS package.
function parseEntries(block){
  const resolved=block
    .replace(/key:UNCLASSIFIED/g,'key:"unclassified"')
    .replace(/category:UNCLASSIFIED/g,'category:"unclassified"');

  return [...resolved.matchAll(/\{key:"([^"]+)",label:"([^"]+)"(?:,category:"([^"]+)")?\}/g)]
    .map((m)=>({key:m[1],label:m[2],category:m[3]}));
}

const categoriesBlock=(taxonomy.match(/export const CATEGORIES=\[([\s\S]*?)\];/) || [])[1] || "";
const typesBlock=(taxonomy.match(/export const TYPES=\[([\s\S]*?)\];/) || [])[1] || "";

const jsCategories=parseEntries(categoriesBlock);
const jsTypes=parseEntries(typesBlock);

check(jsCategories.length>0,`${TAXONOMY_FILE}: no CATEGORIES parsed`);
check(
  jsCategories.some((c)=>c.key==="unclassified"),
  `${TAXONOMY_FILE}: an "unclassified" category is required so nothing is ever null`
);

for(const type of jsTypes){
  check(
    !!type.category && jsCategories.some((c)=>c.key===type.category),
    `${TAXONOMY_FILE}: type "${type.key}" names category "${type.category}", which is not in CATEGORIES`
  );
}

// ---------------------------------------------------------------------------
// 2. Parse what the migration seeded, and compare
// ---------------------------------------------------------------------------

const migration=read(MIGRATION);

const sqlCategories=[...migration.matchAll(/\('([a-z_]+)','([^']+)',(\d+)\)/g)]
  .filter((m)=>migration.slice(0,m.index).lastIndexOf("insert into public.business_categories")>
               migration.slice(0,m.index).lastIndexOf("insert into public.business_types"))
  .map((m)=>({key:m[1],label:m[2]}));

const sqlTypes=[...migration.matchAll(/\('([a-z_]+)','([a-z_]+)','([^']+)',(\d+)\)/g)]
  .map((m)=>({category:m[1],key:m[2],label:m[3]}));

function compare(name,jsList,sqlList,keyOf){
  const jsKeys=jsList.map(keyOf).sort();
  const sqlKeys=sqlList.map(keyOf).sort();

  const missingInSql=jsKeys.filter((k)=>!sqlKeys.includes(k));
  const missingInJs=sqlKeys.filter((k)=>!jsKeys.includes(k));

  check(
    missingInSql.length===0,
    `${name}: in ${TAXONOMY_FILE} but never seeded by the migration: ${missingInSql.join(", ")}`
  );
  check(
    missingInJs.length===0,
    `${name}: seeded by the migration but absent from ${TAXONOMY_FILE}: ${missingInJs.join(", ")}`
  );
}

compare("categories",jsCategories,sqlCategories,(c)=>c.key);
compare("types",jsTypes,sqlTypes,(t)=>`${t.category}/${t.key}`);

for(const jsCategory of jsCategories){
  const match=sqlCategories.find((c)=>c.key===jsCategory.key);
  if(match){
    check(
      match.label===jsCategory.label,
      `category "${jsCategory.key}": label is "${jsCategory.label}" in JS but "${match.label}" in the migration`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. No second list anywhere else
// ---------------------------------------------------------------------------

function jsFiles(dir){
  const found=[];
  if(!fs.existsSync(dir)) return found;

  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const child=path.join(dir,entry.name);
    if(entry.isDirectory()) found.push(...jsFiles(child));
    else if(entry.name.endsWith(".js")) found.push(child);
  }
  return found;
}

const sources=[
  ...jsFiles(path.join(root,"app")),
  ...jsFiles(path.join(root,"components")),
  ...jsFiles(path.join(root,"utils")),
  ...jsFiles(path.join(root,"hooks"))
].filter((file)=>path.relative(root,file)!==TAXONOMY_FILE);

// Every seeded type key, as a quoted literal. Finding one outside the taxonomy
// module means a list is being restated somewhere it can drift.
const typeKeys=jsTypes.map((t)=>t.key);

for(const file of sources){
  const relative=path.relative(root,file);
  const content=fs.readFileSync(file,"utf8");

  const restated=typeKeys.filter((key)=>
    new RegExp(`["'\`]${key}["'\`]`).test(content)
  );

  check(
    restated.length===0,
    `${relative}: restates business type(s) ${restated.join(", ")} — import from ${TAXONOMY_FILE} instead`
  );
}

check(
  !fs.existsSync(path.join(root,"components","Categories.js")),
  "components/Categories.js still exists and holds a second category list"
);

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Taxonomy check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(
  `Taxonomy check passed (${passed} checks; ${jsCategories.length} categories, ${jsTypes.length} types, JS and migration agree).`
);
