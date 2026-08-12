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

// Nothing is skipped any more.
//
// The five map surfaces used to be, because Packet 21 was about to rebuild them
// and styling a file that is about to be rewritten is work thrown away twice.
// Packet 21 has landed: app/map.js and app/map.web.js are three lines each with
// no colour in them, MemoryPins draws through MemoryRow, and PlacesList is the
// list half of the Living Map rather than a temporary stand-in for a map that
// did not exist. It is a surface people use, so it gets the same treatment as
// every other surface.
const SKIP=new Set([]);

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

// Every way this codebase writes a colour, reduced to one shape before anything
// tries to classify it.
//
// The first run of this pass only understood #rrggbb, which is why
// components/PlacesList.js came out of it with `borderColor:"#ccc"` and
// `color:"white"` untouched -- and why the contrast repair below had to special
// case the named whites it could not see. Short hex and the two colour names
// this app actually uses are the same information written differently.
function normalise(value){
  const raw=String(value).trim().toLowerCase();
  if(raw==="white") return "#FFFFFF";
  if(raw==="black") return "#000000";
  if(/^#[0-9a-f]{3}$/.test(raw)){
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  if(/^#[0-9a-f]{6}$/.test(raw)) return raw.toUpperCase();
  return null;
}

// Six-digit first, so "#ffffff" never matches as "#fff" with three characters
// left over. The closing quote in the patterns below does the rest.
const COLOUR=/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|white|black/;

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

// ---------------------------------------------------------------------------
// Which way up is this file
// ---------------------------------------------------------------------------
// The rules below were written for a dark screen, because most of this app was
// one. Fourteen files never were: app/manager/*, app/notifications.js,
// components/PlacesList.js and the rest were always white cards on a pale grey
// page. Running the dark rules over them produces the opposite of what they say.
//
// Look at what it did to PlacesList on the first attempt. `backgroundColor:
// "#222"` was the SELECTED filter chip -- a dark chip in a light screen -- and
// "dark background becomes card" turned it into exactly the same colour as the
// unselected chips beside it. Readable, tokenised, and no longer able to show
// you which filter you had picked. `borderColor:"#ccc"` -- a hairline -- became
// INK.ink, the heaviest line in the palette.
//
// So the tool asks the file which way up it is first. A colour does not mean
// "surface" or "selected" on its own; it means one of those RELATIVE to the
// screen it sits on.
function polarity(source){
  const values=[...source.matchAll(/backgroundColor\s*:\s*"(#[0-9A-Fa-f]{3,6}|white|black)"/g)]
    .map((match)=>normalise(match[1]))
    .filter(Boolean)
    .map(luminance);

  if(!values.length) return "dark";
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=sorted[Math.floor(sorted.length/2)];
  return middle<0.5 ? "dark" : "light";
}

// The screen itself is paper and everything sitting on it is card. Which is
// which comes from the name, because that is the only thing that knows.
const GROUND=/^(screen|container|page|root|safe|body|wrap|wrapper|background)$/i;

function tokenFor(key,hex,theme="dark",styleName=""){
  const meaning=meaningfulToken(hex);
  const light=luminance(hex);

  if(/^(background|backgroundColor)$/.test(key) || /BackgroundColor$/.test(key)){
    if(meaning) return meaning;

    if(theme==="light"){
      // A light file's own ground is light. A DARK background in it is a
      // deliberate strong surface -- a selected chip, a filled button -- and
      // ink is the palette's strong surface.
      if(light<0.35) return "ink";
      // Anything visibly greyer than the page is a grey: an avatar circle, a
      // disabled button, a placeholder. #ddd is one of those, and mapping it to
      // card would make it disappear into the surface it sits on.
      if(light<0.90) return "hair";
      return GROUND.test(styleName) ? "paper" : "card";
    }

    // Dark screens become paper, dark surfaces on them become card. Both are
    // light now, which is the whole point of the pass.
    if(light<0.12) return "paper";
    if(light<0.30) return "card";
    if(light<0.55) return "hair";
    return "card";
  }

  if(key==="color" || /^(text|tint|placeholderTextColor)/.test(key) || /Color$/.test(key)===false && key==="color"){
    if(meaning) return meaning;

    if(theme==="light"){
      // Light text in a light file is text on one of those strong surfaces.
      if(light>0.75) return "card";
      // #666 is the muted text this app writes everywhere, and it lands at
      // exactly 0.40 -- so the boundary has to be below it, not on it.
      if(light>=0.35) return "inkSoft";
      return "ink";
    }

    // Text was light on dark; it becomes ink on paper. Mid-greys were the
    // muted text and stay muted.
    if(light>0.75) return "ink";
    if(light>0.40) return "inkSoft";
    return "ink";
  }

  if(/^border/.test(key) || /BorderColor$/.test(key)){
    if(meaning) return meaning;
    // Either way up, the question is the same one: was this line meant to be
    // barely there, or meant to be seen. A line close to its own screen is a
    // hairline; a line that contrasts with it is a real edge.
    if(theme==="light") return light>0.55 ? "hair" : "ink";
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
  if(!COLOUR.test(source)) continue;

  let touched=false;
  const theme=polarity(source);

  // The style this colour belongs to -- `container` in `container:{...}`. It is
  // what tells paper from card, and a chip from the screen behind it.
  const enclosing=(before)=>{
    const match=before.match(/(\w+)\s*:\s*\{[^{}]*$/);
    return match ? match[1] : "";
  };

  // key:"#hex" and key: "#hex", short hex and "white" included
  source=source.replace(
    new RegExp(`(\\b[A-Za-z]+)(\\s*:\\s*)"(${COLOUR.source})"`,"g"),
    (whole,key,gap,value,offset,whole_source)=>{
      const hex=normalise(value);
      // A colour word in a key this tool does not recognise is left alone and
      // reported, exactly like an unclassifiable hex.
      const token=hex && tokenFor(key,hex,theme,enclosing(whole_source.slice(0,offset)));
      if(!token){unclassified.push(`${file}: ${key}:"${value}"`);return whole;}
      touched=true;
      replaced+=1;
      return `${key}${gap}INK.${token}`;
    }
  );

  // color="#hex" as a JSX attribute
  source=source.replace(
    new RegExp(`(\\b[A-Za-z]+)=\\{?"(${COLOUR.source})"\\}?`,"g"),
    (whole,key,value)=>{
      const hex=normalise(value);
      const token=hex && tokenFor(key,hex,theme);
      if(!token){unclassified.push(`${file}: ${key}="${value}"`);return whole;}
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
      const foreground=block.match(/\bcolor\s*:\s*INK\.([a-zA-Z]+)/);
      if(!background || !foreground) return whole;
      if(!TOKENS[background[1]] || !TOKENS[foreground[1]]) return whole;

      // Whether a pair works is a measurement, not a judgement about which
      // colours sound strong. Pink is #FF3D6E and reads as a bold colour, but
      // white on it is 3.07:1 -- under the 4.5:1 a person needs -- while ink on
      // it is 5.2:1. scripts/verify-contrast.cjs checks the same sums after.
      const size=block.match(/fontSize\s*:\s*(\d+)/);
      const bold=/fontWeight\s*:\s*"(bold|[789]00)"/.test(block);
      const large=(size && Number(size[1])>=18) || (bold && size && Number(size[1])>=14);

      if(readable(foreground[1],background[1],large)) return whole;

      const want=readable("card",background[1],large) ? "card"
        : readable("ink",background[1],large) ? "ink"
          : null;
      if(!want) return whole;

      repaired+=1;
      return `{${block.replace(/(\bcolor\s*:\s*)INK\.[a-zA-Z]+/,`$1INK.${want}`)}}`;
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

// ---------------------------------------------------------------------------
// The pair that is written in two places
// ---------------------------------------------------------------------------
// The repair above only sees a background and its text when they sit in the
// SAME style block. Almost nothing in this app is written that way:
//
//   submitButton:{backgroundColor:INK.blue,borderRadius:14,padding:16}
//   submitText:{color:INK.ink,fontWeight:"900"}
//
// Two blocks, and the first run of this pass had no way to connect them. It
// mapped `color:"white"` to INK.ink because ink is what light text becomes on a
// light screen -- correct for a paragraph, wrong for the label on a blue
// button, which is what nearly every one of them was. Ink on blue is 2.77:1.
// It shipped that way on every filled button in the app.
//
// So the pair is found by NAME. This codebase is consistent about it --
// `submitButton`/`submitText`, `chipActive`/`chipTextActive`,
// `avatarFallback`/`avatarLetter` -- and a name is the only link there is when
// the two declarations never touch.

const SUFFIX=["Text","Title","Label","Name","Value","Letter","Initial","Icon","Body","Hint","Sub"];
// A container's name usually ends in what kind of thing it is. `locationButton`
// pairs with `locationText`, not `locationButtonText`.
const CONTAINER=/(Button|Card|Pill|Panel|Chip|Badge|Box|Row|Wrap|Bar|Tab|Tag|Circle|Avatar|Header|Banner|Section|Fallback)$/;

// And where the names have nothing in common -- `hero` with `eyebrow`,
// `avatarFallback` with `avatarLetter` -- the JSX says what the names do not:
// this Text is drawn inside that View. scripts/style-pairs.cjs works that out,
// and scripts/verify-contrast.cjs checks the result using the same module, so
// the tool and the gate cannot disagree about what is behind a piece of text.
const {groundsFor}=require("./style-pairs.cjs");

// NOT luminance() above. That one is a brightness heuristic -- a flat weighted
// average -- and it is fine for asking "is this colour dark or light" when
// choosing a token. Contrast is not a heuristic: WCAG defines it on
// gamma-corrected channels, and the flat version gets the answer wrong by
// enough to matter. It called white on green unreadable and left every green
// badge in the app alone.
function contrastLuminance(hex){
  const {r,g,b}=rgb(hex);
  const channel=(value)=>{
    const c=value/255;
    return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
  };
  return 0.2126*channel(r)+0.7152*channel(g)+0.0722*channel(b);
}

function readable(textToken,groundToken,large){
  const need=large ? 3 : 4.5;
  const a=contrastLuminance(TOKENS[textToken]);
  const b=contrastLuminance(TOKENS[groundToken]);
  const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  return ratio+0.005>=need;
}

let pairsRepaired=0;
const unreachable=[];

for(const file of files){
  if(SKIP.has(file)) continue;

  const full=path.join(root,file);
  let source=fs.readFileSync(full,"utf8");
  if(!/INK\./.test(source)) continue;

  const blocks={};
  for(const match of source.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) blocks[match[1]]=match[2];

  let touched=false;

  // Which ground is each piece of text drawn on. Two sources of evidence, and
  // they are not equal.
  //
  // The JSX is a fact: `<View style={styles.avatarFallback}><Text
  // style={styles.avatarLetter}>` says exactly what is behind that letter. The
  // naming convention is an inference, and in app/feed.js it gets this one
  // wrong -- `avatar` is the grey circle behind a photo, `avatarFallback` is
  // the blue one behind a letter, and "avatar"+"Letter" picks the wrong one.
  // Trusting both equally made the tool alternate between two answers on every
  // run, each undoing the last.
  const nested=groundsFor(
    source,
    (name)=>/backgroundColor\s*:\s*INK\./.test(blocks[name] || ""),
    (name)=>/\bcolor\s*:\s*INK\./.test(blocks[name] || "")
  );

  const named=new Map();
  for(const [name,body] of Object.entries(blocks)){
    if(!/backgroundColor\s*:\s*INK\./.test(body)) continue;

    const active=/Active$/.test(name);
    const stem=(active ? name.slice(0,-6) : name).replace(CONTAINER,"");

    for(const suffix of SUFFIX){
      // Most specific first, and only one claim per suffix. `emptyButton` has
      // its own `emptyButtonText`, so it must NOT also claim the generic
      // `emptyText` that belongs to `emptyCard` beside it -- that false pair is
      // what made the tool report an unresolvable conflict on a screen where
      // nothing was wrong.
      const candidates=active
        ? [name+suffix,stem+suffix+"Active",stem+"Text"+"Active"]
        : [name+suffix,stem+suffix];

      const candidate=candidates.find((option)=>blocks[option]);
      if(!candidate) continue;
      if(!named.has(candidate)) named.set(candidate,new Set());
      named.get(candidate).add(name);
    }
  }

  for(const textName of new Set([...nested.keys(),...named.keys()])){
    // Evidence beats inference.
    const grounds=[...(nested.get(textName) || named.get(textName) || [])]
      .map((name)=>blocks[name]?.match(/backgroundColor\s*:\s*INK\.(\w+)/))
      .filter(Boolean)
      .map((match)=>match[1])
      .filter((token)=>TOKENS[token]);

    if(!grounds.length) continue;

    const text=blocks[textName];
    // Its own background means it was judged in its own right.
    if(/backgroundColor\s*:\s*INK\./.test(text)) continue;

    const colour=text.match(/\bcolor\s*:\s*INK\.(\w+)/);
    if(!colour || !TOKENS[colour[1]]) continue;

    const size=text.match(/fontSize\s*:\s*(\d+)/);
    const bold=/fontWeight\s*:\s*"(bold|[789]00)"/.test(text);
    const large=(size && Number(size[1])>=18) || (bold && size && Number(size[1])>=14);

    // Readable on every ground it is drawn on, not just the last one looked at.
    const worksEverywhere=(token)=>grounds.every((ground)=>readable(token,ground,large));
    if(worksEverywhere(colour[1])) continue;

    const want=worksEverywhere("card") ? "card"
      : worksEverywhere("ink") ? "ink"
        : null;

    // One style, two grounds, and no single colour readable on both. That is a
    // design decision -- the style needs splitting -- and a tool that picked
    // one would just break the other screen. Say so and change nothing.
    if(!want){
      unreachable.push(`${file}: ${textName} is drawn on ${[...new Set(grounds)].join(" and ")}; no one colour is readable on both`);
      continue;
    }

    const before=source;
    source=source.replace(
      new RegExp(`(\\b${textName}\\s*:\\s*\\{[^{}]*?\\bcolor\\s*:\\s*)INK\\.${colour[1]}\\b`),
      `$1INK.${want}`
    );

    // A rewrite that did not land must not be counted as one. The pattern
    // cannot reach past a nested object -- `textShadowOffset:{...}` in the
    // middle of a block hides everything after it -- and a tool that reports
    // repairs it did not make is worse than one that admits it could not.
    if(source===before){
      unreachable.push(`${file}: ${textName} should be INK.${want}`);
      continue;
    }

    blocks[textName]=blocks[textName].replace(
      new RegExp(`(\\bcolor\\s*:\\s*)INK\\.${colour[1]}\\b`),
      `$1INK.${want}`
    );
    pairsRepaired+=1;
    touched=true;
  }

  if(touched && write) fs.writeFileSync(full,source,"utf8");
}

console.log(`${write ? "Rewrote" : "Would rewrite"} ${changedFiles} files, ${replaced} colours, ${repaired+pairsRepaired} contrast pairs repaired.`);

if(unreachable.length){
  const unique=[...new Set(unreachable)];
  console.log(`\n${unique.length} pairs this tool could not reach -- fix by hand:`);
  for(const item of unique) console.log(`  ${item}`);
}

if(unclassified.length){
  console.log(`\n${unclassified.length} left alone because the role was not clear:`);
  for(const item of unclassified.slice(0,40)) console.log(`  ${item}`);
  if(unclassified.length>40) console.log(`  ... and ${unclassified.length-40} more`);
}
