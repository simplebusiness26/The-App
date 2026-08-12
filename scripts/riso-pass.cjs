#!/usr/bin/env node
"use strict";

// Packet 20, the riso pass -- as a tool rather than 63 files of hand edits.
//
// WHAT THIS IS NOT
//
// Not a find-and-replace of one colour for another. Most of this app is a DARK
// theme (#18181b screens, white text) and docs/design-system.md is a LIGHT one
// (paper #E7E8E1, ink #16181C). Mapping a dark colour to its nearest token
// would turn a dark background into a dark background and leave white text on
// it -- correct by the token list, unreadable on screen.
//
// So it maps by ROLE, and the role comes from the style key. `backgroundColor`
// and `color` want opposite ends of the palette, and only the key knows which
// is which.
//
// THE RULES
//
//   a saturated colour keeps its meaning: purple and blue -> ink-blue,
//   red -> ink-red, green -> ink-green, amber -> ink-yellow, pink -> ink-pink
//
//   backgroundColor  dark  -> paper (the screen) or card (a surface on it)
//                    light -> card
//   color            light -> ink, mid-grey -> ink-soft, dark -> ink
//   border*          -> hair, or ink where the original was already strong
//   shadowColor      -> ink
//
// Anything it cannot classify is REPORTED AND LEFT ALONE. A tool that guesses
// silently is how a screen ends up with white text on white.
//
//   node scripts/riso-pass.cjs --check    report only
//   node scripts/riso-pass.cjs --write    apply

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const write=process.argv.includes("--write");

// The four map surfaces are rebuilt in Packet 21 (MapLibre on web, Android and
// iOS). Styling them now is work thrown away twice.
const SKIP=new Set([
  "app/map.js",
  "app/map.web.js",
  "components/PlacesList.js",
  "components/MemoryPins.js",
  "components/MemoryPins.web.js"
]);

const TOKENS={
  paper:"#E7E8E1",
  card:"#F3F3ED",
  ink:"#16181C",
  inkSoft:"#63686F",
  hair:"#C9CBC2",
  water:"#BFD1CF",
  park:"#C2CFAF",
  blue:"#2B4BE8",
  pink:"#FF3D6E",
  yellow:"#FFC61A",
  green:"#1E7A4C",
  red:"#C2321F"
};

function rgb(hex){
  const clean=hex.replace("#","");
  return{
    r:parseInt(clean.slice(0,2),16),
    g:parseInt(clean.slice(2,4),16),
    b:parseInt(clean.slice(4,6),16)
  };
}

// Perceived brightness, 0..1.
function luminance(hex){
  const {r,g,b}=rgb(hex);
  return (0.2126*r+0.7152*g+0.0722*b)/255;
}

// How much colour there is, 0..1. Greys are near 0.
function saturation(hex){
  const {r,g,b}=rgb(hex);
  const max=Math.max(r,g,b);
  const min=Math.min(r,g,b);
  return max===0 ? 0 : (max-min)/max;
}

function hue(hex){
  const {r,g,b}=rgb(hex);
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  if(max===min) return 0;
  const d=max-min;
  let h;
  if(max===r) h=((g-b)/d+(g<b ? 6 : 0));
  else if(max===g) h=(b-r)/d+2;
  else h=(r-g)/d+4;
  return h*60;
}

// A saturated colour carries meaning and keeps it. This is the only place the
// three inks plus green and red are assigned, and it is by hue.
function meaningfulToken(hex){
  if(saturation(hex)<0.30) return null;
  const h=hue(hex);
  const light=luminance(hex);

  if(h>=200 && h<290) return "blue";        // blue and violet
  if(h>=290 || h<15) return light>0.45 ? "pink" : "red";
  if(h>=15 && h<50) return light>0.55 ? "yellow" : "red";
  if(h>=50 && h<90) return "yellow";
  if(h>=90 && h<180) return "green";
  return "blue";
}

function tokenFor(key,hex){
  const meaning=meaningfulToken(hex);
  const light=luminance(hex);

  if(/^(background|backgroundColor)$/.test(key) || /BackgroundColor$/.test(key)){
    if(meaning) return meaning;
    // Dark screens become paper, dark surfaces on them become card. Both are
    // light now, which is the whole point of the pass.
    if(light<0.12) return "paper";
    if(light<0.30) return "card";
    if(light<0.55) return "hair";
    return "card";
  }

  if(key==="color" || /^(text|tint|placeholderTextColor)/.test(key) || /Color$/.test(key)===false && key==="color"){
    if(meaning) return meaning;
    // Text was light on dark; it becomes ink on paper. Mid-greys were the
    // muted text and stay muted.
    if(light>0.75) return "ink";
    if(light>0.40) return "inkSoft";
    return "ink";
  }

  if(/^border/.test(key) || /BorderColor$/.test(key)){
    if(meaning) return meaning;
    return light<0.25 ? "hair" : "ink";
  }

  if(/^shadow/.test(key)) return "ink";
  if(/^tintColor$/.test(key)) return meaning || "ink";

  return null;
}

const files=[];
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(!entry.name.endsWith(".js")) continue;
    files.push(path.relative(root,full));
  }
})(path.join(root,"app"));
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(!entry.name.endsWith(".js")) continue;
    files.push(path.relative(root,full));
  }
})(path.join(root,"components"));

let changedFiles=0;
let replaced=0;
let repaired=0;
const unclassified=[];

for(const file of files){
  if(SKIP.has(file)) continue;

  const full=path.join(root,file);
  let source=fs.readFileSync(full,"utf8");
  if(!/#[0-9A-Fa-f]{6}\b/.test(source)) continue;

  let touched=false;

  // key:"#hex" and key: "#hex"
  source=source.replace(
    /(\b[A-Za-z]+)(\s*:\s*)"(#[0-9A-Fa-f]{6})"/g,
    (whole,key,gap,hex)=>{
      const token=tokenFor(key,hex.toUpperCase());
      if(!token){unclassified.push(`${file}: ${key}:"${hex}"`);return whole;}
      touched=true;
      replaced+=1;
      return `${key}${gap}INK.${token}`;
    }
  );

  // color="#hex" as a JSX attribute
  source=source.replace(
    /(\b[A-Za-z]+)=\{?"(#[0-9A-Fa-f]{6})"\}?/g,
    (whole,key,hex)=>{
      const token=tokenFor(key==="color" ? "color" : key,hex.toUpperCase());
      if(!token){unclassified.push(`${file}: ${key}="${hex}"`);return whole;}
      touched=true;
      replaced+=1;
      return `${key}={INK.${token}}`;
    }
  );

  // -------------------------------------------------------------------------
  // Contrast repair, and it is the step that decides whether this ships
  // -------------------------------------------------------------------------
  // A button was `backgroundColor:"#222226", color:"white"`. The first pass
  // turns the background into card -- a LIGHT colour -- and leaves the text
  // white, because "white" is a name and not a hex. White on card is invisible.
  //
  // So every style block is read back and its pair checked. This is not
  // tidying: without it the pass produces screens with unreadable buttons.

  source=source.replace(
    /\{([^{}]*(?:backgroundColor\s*:\s*INK\.[a-zA-Z]+)[^{}]*)\}/g,
    (whole,block)=>{
      const background=block.match(/backgroundColor\s*:\s*INK\.([a-zA-Z]+)/);
      if(!background) return whole;

      const darkGround=["ink","blue","red","green","pink"].includes(background[1]);
      let fixed=block;

      if(darkGround){
        // Dark ground wants light text.
        fixed=fixed.replace(/(\bcolor\s*:\s*)(INK\.ink\b|INK\.inkSoft\b|"black"|"#000"|"#000000")/g,"$1INK.card");
      }else{
        // Light ground wants dark text -- including the named whites the first
        // pass could not see.
        fixed=fixed.replace(/(\bcolor\s*:\s*)("white"|"#fff"|"#ffffff"|"#FFF"|"#FFFFFF"|INK\.card\b|INK\.paper\b)/g,"$1INK.ink");
      }

      if(fixed!==block) repaired+=1;
      return `{${fixed}}`;
    }
  );

  if(!touched) continue;

  // The import, with the right number of ../ for where this file sits.
  if(!/from\s+"[^"]*utils\/tokens"/.test(source)){
    const depth=file.split(path.sep).length-1;
    const prefix=depth<=1 ? "../" : "../".repeat(depth);
    const importLine=`import {INK} from "${prefix}utils/tokens";`;

    const lastImport=[...source.matchAll(/^import .*$/gm)].pop();
    source=lastImport
      ? source.slice(0,lastImport.index+lastImport[0].length)+"\n"+importLine+source.slice(lastImport.index+lastImport[0].length)
      : importLine+"\n"+source;
  }

  changedFiles+=1;
  if(write) fs.writeFileSync(full,source,"utf8");
}

console.log(`${write ? "Rewrote" : "Would rewrite"} ${changedFiles} files, ${replaced} colours, ${repaired} contrast pairs repaired.`);

if(unclassified.length){
  console.log(`\n${unclassified.length} left alone because the role was not clear:`);
  for(const item of unclassified.slice(0,40)) console.log(`  ${item}`);
  if(unclassified.length>40) console.log(`  ... and ${unclassified.length-40} more`);
}
