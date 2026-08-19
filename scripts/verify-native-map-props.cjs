#!/usr/bin/env node
"use strict";

// Do the props we pass the native map actually exist.
//
// WHY THIS EXISTS, AND WHY THE TEST SUITE CANNOT DO IT
//
// test/living-map-cross-platform.test.js mocks @maplibre/maplibre-react-native,
// because a native map cannot render in Jest. That mock accepts every prop it
// is given, so it proves the WIRING -- this many markers, in this order, with
// these ids -- and it cannot tell whether the real component has ever heard of
// the prop carrying that information.
//
// FOUR REAL BUGS SHIPPED THROUGH THAT HOLE
//
// The library went from v10 to v11 and renamed things. Every one of these was
// written, tested, built into an APK and installed on a phone before anyone
// found out, because a React component silently ignores a prop it does not
// know:
//
//   attributionEnabled -> attribution     the credit bar could not be moved
//   logoEnabled        -> logo            so the MapLibre logo drew anyway
//   defaultSettings    -> initialViewState  no start position: the map opened
//                                           on the entire world
//   coordinate         -> lngLat          markers had no position, so not one
//                                           pin was drawn
//
// The last two are what the owner saw on the phone: a world map with nothing
// on it, while the web map opened on Brighton covered in pins.
//
// So this reads the props out of the source and checks each one against the
// type definitions of the version actually installed in node_modules. A rename
// in a future upgrade fails here, in CI, in a second -- instead of on a phone.
//
//   node scripts/verify-native-map-props.cjs

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const PACKAGE="@maplibre/maplibre-react-native";
const TYPES=path.join(root,"node_modules",PACKAGE,"lib/typescript/module");

const SOURCES=["components/LivingMap.js"];

// Props every React Native view takes, which live in ViewProps rather than in
// the component's own definition.
const INHERITED=new Set(["style","testID","ref","key","children","accessibilityLabel","accessibilityRole","pointerEvents"]);

function fail(message){
  console.log(`\n${message}`);
  process.exitCode=1;
}

if(!fs.existsSync(TYPES)){
  console.log(`${PACKAGE} is not installed, so its props cannot be checked.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Every .d.ts in the package, so a component can be found wherever it lives
// ---------------------------------------------------------------------------

const definitions=new Map();
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(!entry.name.endsWith(".d.ts")) continue;
    definitions.set(entry.name.replace(/\.d\.ts$/,""),fs.readFileSync(full,"utf8"));
  }
})(TYPES);

// ---------------------------------------------------------------------------
// The props actually passed, read off the opening tag
// ---------------------------------------------------------------------------
// A hand-rolled scan rather than a regex, because an opening tag can hold
// `{...}` values, quoted values, bare booleans and /* comments */ between the
// attributes -- and this file uses all four.

function propsOf(source,component){
  const found=new Set();
  const opener=new RegExp(`<${component}(?=[\\s/>])`,"g");

  for(const match of source.matchAll(opener)){
    let index=match.index+match[0].length;

    while(index<source.length){
      const character=source[index];

      if(/\s/.test(character)){index+=1;continue;}
      if(character===">") break;
      if(character==="/" && source[index+1]===">") break;

      // A comment between attributes.
      if(character==="/" && source[index+1]==="*"){
        const close=source.indexOf("*/",index);
        index=close===-1 ? source.length : close+2;
        continue;
      }
      if(character==="/" && source[index+1]==="/"){
        const close=source.indexOf("\n",index);
        index=close===-1 ? source.length : close+1;
        continue;
      }

      // Spread props defeat this check; say so rather than passing quietly.
      if(character==="{"){
        return{found,spread:true};
      }

      const name=source.slice(index).match(/^[A-Za-z_][\w.]*/);
      if(!name) break;
      found.add(name[0]);
      index+=name[0].length;

      while(index<source.length && /\s/.test(source[index])) index+=1;
      if(source[index]!=="=") continue;   // a bare boolean prop
      index+=1;
      while(index<source.length && /\s/.test(source[index])) index+=1;

      if(source[index]==="{"){
        let depth=0;
        while(index<source.length){
          if(source[index]==="{") depth+=1;
          if(source[index]==="}"){depth-=1;if(depth===0){index+=1;break;}}
          index+=1;
        }
        continue;
      }

      const quote=source[index];
      if(quote==='"' || quote==="'"){
        const close=source.indexOf(quote,index+1);
        index=close===-1 ? source.length : close+1;
      }
    }
  }

  return{found,spread:false};
}

// ---------------------------------------------------------------------------
// The interfaces a props interface inherits from
// ---------------------------------------------------------------------------
//
// `interface FooProps extends BaseProps, PressableSourceProps { ... }`. Each
// name is looked up across every .d.ts in the package, because the base often
// lives in types/ rather than beside the component.

function interfaceBody(name){
  for(const text of definitions.values()){
    const match=text.match(new RegExp(`interface\\s+${name}\\b[^{]*\\{`));
    if(!match) continue;

    let index=match.index+match[0].length;
    let depth=1;
    const start=index;
    while(index<text.length && depth>0){
      if(text[index]==="{") depth+=1;
      if(text[index]==="}") depth-=1;
      index+=1;
    }
    return text.slice(start,index);
  }
  return "";
}

function baseInterfaces(types){
  const bodies=[];
  for(const match of types.matchAll(/interface\s+\w+\s+extends\s+([^{]+)\{/g)){
    for(const raw of match[1].split(",")){
      const name=raw.trim().replace(/<.*$/,"");
      if(!name) continue;
      const body=interfaceBody(name);
      if(body) bodies.push(body);
    }
  }
  return bodies;
}

// ---------------------------------------------------------------------------

let checked=0;
const problems=[];

for(const file of SOURCES){
  const source=fs.readFileSync(path.join(root,file),"utf8");

  // Only the components imported from the map package itself. PlaceMarker and
  // the rest are ours.
  const importLine=source.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*"${PACKAGE}"`));
  if(!importLine){
    problems.push(`${file} does not import ${PACKAGE}, so this gate is checking nothing`);
    continue;
  }

  const components=importLine[1].split(",").map((name)=>name.trim()).filter(Boolean);

  for(const component of components){
    const types=definitions.get(component);
    if(!types){
      problems.push(`${file}: <${component}> is imported but ${PACKAGE} has no ${component}.d.ts -- it may have been renamed or removed`);
      continue;
    }

    const {found,spread}=propsOf(source,component);
    if(spread){
      problems.push(`${file}: <${component}> is given spread props, which this gate cannot read. Pass them by name.`);
      continue;
    }

    // A props interface may EXTEND another one that lives in a different file --
    // GeoJSONSourceProps extends PressableSourceProps, which is where onPress
    // and hitbox are declared. Reading only the component's own .d.ts reported
    // a real, supported prop as missing, which would have pushed somebody into
    // deleting working code to get the gate green. So the bases are followed.
    const searchable=[types,...baseInterfaces(types)];

    for(const prop of found){
      if(INHERITED.has(prop)) continue;
      checked+=1;

      // Declared on the props interface -- or on one it extends -- as `name:`
      // or `name?:`.
      if(searchable.some((text)=>new RegExp(`\\b${prop}\\??\\s*:`).test(text))) continue;

      problems.push(`${file}: <${component} ${prop}={...}> -- ${component} has no prop called "${prop}" in the installed version. It will be ignored silently.`);
    }
  }
}

const version=JSON.parse(
  fs.readFileSync(path.join(root,"node_modules",PACKAGE,"package.json"),"utf8")
).version;

console.log(`Native map props: checked ${checked} against ${PACKAGE}@${version}.`);

if(problems.length){
  fail(`${problems.length} problem${problems.length===1 ? "" : "s"}:\n`);
  for(const problem of problems) console.log(`  ${problem}`);
  console.log("\nA React component ignores a prop it does not know, in silence. That is");
  console.log("why this is a gate and not something the tests can find.");
}else{
  console.log("Every prop exists on the component it is passed to.");
}
