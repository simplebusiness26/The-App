#!/usr/bin/env node
"use strict";

// Can somebody READ it.
//
// WHY THIS EXISTS
//
// The riso pass (scripts/riso-pass.cjs) turned this app from a dark theme into
// the light one docs/design-system.md describes. It did that by mapping each
// colour to a token by the role of its style key, and that is the right way to
// do it -- but it means a background and the text on it are decided
// SEPARATELY, by two independent guesses. Two right answers can still make an
// unreadable pair.
//
// It already happened. The first pass understood `#rrggbb` and nothing else, so
// `backgroundColor:"#222226"` became a light card while `color:"white"` sat
// there untouched, because "white" is a word rather than a hex. White text on a
// near-white card. It looks fine in a diff and it is invisible on a phone.
//
// So this gate does not check that tokens were used. It checks what a person
// would actually see: it takes the real hex values out of utils/tokens.js,
// computes the WCAG contrast ratio for every background/text pair in every
// style block, and fails on anything below the readable threshold.
//
//   node scripts/verify-contrast.cjs
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not judge taste, spacing or hierarchy. Contrast is the one part of
// visual design with a number attached, and this checks the number.

const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");

// ---------------------------------------------------------------------------
// The palette, read from the one file that defines it
// ---------------------------------------------------------------------------
// Copying the hex values in here would create a second palette free to drift
// from the first, which is the exact failure utils/tokens.js exists to prevent.

const TOKENS={};
for(const [,name,hex] of fs.readFileSync(path.join(root,"utils/tokens.js"),"utf8")
  .matchAll(/(\w+)\s*:\s*"(#[0-9A-Fa-f]{6})"/g)){
  TOKENS[name]=hex;
}

// Colours that are not tokens but still appear as literal values. They are what
// the pass is meant to remove; while any survive, they still have to be judged.
const NAMED={white:"#FFFFFF",black:"#000000",transparent:null};

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

function channel(value){
  const c=value/255;
  return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
}

function relativeLuminance(hex){
  const clean=hex.replace("#","");
  const r=channel(parseInt(clean.slice(0,2),16));
  const g=channel(parseInt(clean.slice(2,4),16));
  const b=channel(parseInt(clean.slice(4,6),16));
  return 0.2126*r+0.7152*g+0.0722*b;
}

function contrast(foreground,background){
  const a=relativeLuminance(foreground);
  const b=relativeLuminance(background);
  const light=Math.max(a,b);
  const dark=Math.min(a,b);
  return (light+0.05)/(dark+0.05);
}

// 4.5:1 for body text, 3:1 once the text is large -- the WCAG AA numbers. Large
// means 18pt and up, or bold at 14pt and up.
const BODY=4.5;
const LARGE=3;

function resolve(value){
  const token=value.match(/^INK\.(\w+)$/);
  if(token) return TOKENS[token[1]] || null;
  const named=value.replace(/"/g,"").toLowerCase();
  if(named in NAMED) return NAMED[named];
  if(/^#[0-9A-Fa-f]{6}$/.test(named)) return named;
  if(/^#[0-9A-Fa-f]{3}$/.test(named)){
    return `#${named[1]}${named[1]}${named[2]}${named[2]}${named[3]}${named[3]}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Every style block in the app
// ---------------------------------------------------------------------------

const files=[];
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(entry.name.endsWith(".js")) files.push(path.relative(root,full));
  }
})(path.join(root,"app"));
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(entry.name.endsWith(".js")) files.push(path.relative(root,full));
  }
})(path.join(root,"components"));

const VALUE=`INK\\.\\w+|"#[0-9A-Fa-f]{3,6}"|"white"|"black"`;

const failures=[];
let pairs=0;

for(const file of files){
  const source=fs.readFileSync(path.join(root,file),"utf8");

  // A style block is the innermost { ... } with no braces inside it, which is
  // what StyleSheet.create entries and inline style objects both look like.
  for(const match of source.matchAll(/\{([^{}]*)\}/g)){
    const block=match[1];

    const background=block.match(new RegExp(`backgroundColor\\s*:\\s*(${VALUE})`));
    const foreground=block.match(new RegExp(`\\bcolor\\s*:\\s*(${VALUE})`));
    if(!background || !foreground) continue;

    const ground=resolve(background[1]);
    const text=resolve(foreground[1]);
    // transparent resolves to null: there is no pair to judge, because what is
    // behind it is whatever the parent painted.
    if(!ground || !text) continue;

    pairs+=1;

    const size=block.match(/fontSize\s*:\s*(\d+)/);
    const bold=/fontWeight\s*:\s*"(bold|[789]00)"/.test(block);
    const large=(size && Number(size[1])>=18) || (bold && size && Number(size[1])>=14);
    const need=large ? LARGE : BODY;

    const ratio=contrast(text,ground);
    if(ratio+0.005<need){
      const line=source.slice(0,match.index).split("\n").length;
      failures.push({
        file,line,
        text:foreground[1],ground:background[1],
        ratio:ratio.toFixed(2),need
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The pair that is written in two places
// ---------------------------------------------------------------------------
// The check above only sees a background and its text when they are in the same
// style block. The commonest badge in this app is not written that way:
//
//   memberAvatar:{width:50,height:50,borderRadius:25,backgroundColor:INK.hair}
//   memberInitial:{color:INK.card,fontWeight:"bold"}
//
// Two blocks, and neither is wrong on its own. On screen it is a grey circle
// with an almost-white letter in it. So where the JSX puts a <Text> directly
// inside a <View>, the two styles are read as the pair they are.

// The same module scripts/riso-pass.cjs uses to decide what is behind a piece
// of text. Two answers to that question would let the tool "fix" what the gate
// then calls broken, on every run, for ever.
const {pairsFor}=require("./style-pairs.cjs");

function blockFor(source,name){
  const match=source.match(new RegExp(`\\b${name}\\s*:\\s*\\{([^{}]*)\\}`));
  return match ? match[1] : null;
}

for(const file of files){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const paints=(name)=>{
    const block=blockFor(source,name);
    return !!block && new RegExp(`backgroundColor\\s*:\\s*(${VALUE})`).test(block);
  };
  const setsColour=(name)=>{
    const block=blockFor(source,name);
    return !!block && new RegExp(`\\bcolor\\s*:\\s*(${VALUE})`).test(block);
  };

  const seen=new Set();
  for(const {text:textName,ground:groundName} of pairsFor(source,paints,setsColour)){
    if(seen.has(`${textName}|${groundName}`)) continue;
    seen.add(`${textName}|${groundName}`);

    const inner=blockFor(source,textName);
    const outer=blockFor(source,groundName);
    if(!inner || !outer) continue;

    // A Text with its own background was judged in its own right above.
    if(new RegExp(`backgroundColor\\s*:\\s*(${VALUE})`).test(inner)) continue;

    const foregroundMatch=inner.match(new RegExp(`\\bcolor\\s*:\\s*(${VALUE})`));
    const backgroundMatch=outer.match(new RegExp(`backgroundColor\\s*:\\s*(${VALUE})`));
    if(!foregroundMatch || !backgroundMatch) continue;

    const text=resolve(foregroundMatch[1]);
    const ground=resolve(backgroundMatch[1]);
    if(!text || !ground) continue;

    pairs+=1;

    const size=inner.match(/fontSize\s*:\s*(\d+)/);
    const bold=/fontWeight\s*:\s*"(bold|[789]00)"/.test(inner);
    const large=(size && Number(size[1])>=18) || (bold && size && Number(size[1])>=14);
    const need=large ? LARGE : BODY;

    const ratio=contrast(text,ground);
    if(ratio+0.005<need){
      const line=source.slice(0,source.indexOf(`${textName}:`)).split("\n").length;
      failures.push({
        file,line,
        text:`styles.${textName} ${foregroundMatch[1]}`,
        ground:`styles.${groundName} ${backgroundMatch[1]}`,
        ratio:ratio.toFixed(2),need
      });
    }
  }
}

// ---------------------------------------------------------------------------

console.log(`Contrast: checked ${pairs} background/text pairs in ${files.length} files.`);

if(failures.length){
  console.log(`\n${failures.length} unreadable:\n`);
  for(const bad of failures){
    console.log(`  ${bad.file}:${bad.line}  ${bad.text} on ${bad.ground} is ${bad.ratio}:1, needs ${bad.need}:1`);
  }
  console.log("\nFix the pair, not the gate. A colour nobody can read is a broken screen.");
  process.exit(1);
}

console.log("Every pair is readable.");
