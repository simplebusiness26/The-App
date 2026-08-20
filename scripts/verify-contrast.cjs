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

function resolve(value,context){
  if(context){
    if(context.locals && context.locals[value]) value=context.locals[value];
    const blended=composite(value,context.backdrop);
    if(blended) return blended;
    if(/^"?rgba?\(/.test(String(value))) return null;
  }
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

const VALUE=`INK\\.\\w+|"#[0-9A-Fa-f]{3,6}"|"white"|"black"|"rgba?\\([^")]*\\)"|[A-Z][A-Z0-9_]{2,}`;

// ---------------------------------------------------------------------------
// TRANSLUCENT GROUNDS, AND THE BACKDROP A FILE DECLARES FOR THEM.
//
// A chip drawn over the camera viewfinder is filled rgba(231,232,225,.14) --
// paper at 14%, the artifact's own value. There is no hex to compare against:
// what a reader actually sees is that tint composited over whatever is behind
// it, and the thing behind it is a photograph.
//
// This gate used to give up on those and walk up to the nearest ancestor with
// a solid colour, which on the camera screen is the paper screen ground -- so
// it reported paper-on-paper, 1.00:1, for text that is in fact paper on a
// near-black viewfinder at about 11:1. The build's response was to redraw the
// chrome as solid ink so the gate could read it. That is the gate rewriting
// the design, which is exactly backwards.
//
// So a file may declare what its translucent chrome is drawn over:
//
//   // @contrast-backdrop INK.ink
//
// and a translucent ground is composited over that before judging. The
// declaration is a claim about the screen and is reviewable as one -- it names
// a token, it lives next to the code, and a wrong one shows up the moment
// anybody looks at the screenshot.
function backdropFor(source){
  const declared=source.match(/@contrast-backdrop\s+(INK\.\w+|#[0-9A-Fa-f]{3,6})/);
  if(!declared) return null;
  return resolve(declared[1].startsWith("#") ? `"${declared[1]}"` : declared[1]);
}

// `const VF_GLASS="rgba(231,232,225,0.14)"` -- a colour named once and used six
// times is still a colour.
function localColours(source){
  const table={};
  for(const m of source.matchAll(/const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*("(?:#[0-9A-Fa-f]{3,6}|rgba?\([^")]*\))")/g)){
    table[m[1]]=m[2];
  }
  return table;
}

function composite(value,backdrop){
  const m=String(value).replace(/"/g,"").match(/^rgba?\(([^)]*)\)$/);
  if(!m) return null;
  const parts=m[1].split(",").map((n)=>Number(n.trim()));
  if(parts.length<3) return null;
  const alpha=parts.length>3 ? parts[3] : 1;
  if(!backdrop) return null;
  const base=backdrop.replace("#","");
  const over=[0,1,2].map((i)=>{
    const under=parseInt(base.slice(i*2,i*2+2),16);
    return Math.round(parts[i]*alpha+under*(1-alpha));
  });
  return `#${over.map((n)=>n.toString(16).padStart(2,"0")).join("")}`;
}

const failures=[];
let pairs=0;

for(const file of files){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const context={backdrop:backdropFor(source),locals:localColours(source)};

  // A style block is the innermost { ... } with no braces inside it, which is
  // what StyleSheet.create entries and inline style objects both look like.
  for(const match of source.matchAll(/\{([^{}]*)\}/g)){
    const block=match[1];

    const background=block.match(new RegExp(`backgroundColor\\s*:\\s*(${VALUE})`));
    const foreground=block.match(new RegExp(`\\bcolor\\s*:\\s*(${VALUE})`));
    if(!background || !foreground) continue;

    const ground=resolve(background[1],context);
    const text=resolve(foreground[1],context);
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
  const context={backdrop:backdropFor(source),locals:localColours(source)};
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

    const text=resolve(foregroundMatch[1],context);
    const ground=resolve(backgroundMatch[1],context);
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
