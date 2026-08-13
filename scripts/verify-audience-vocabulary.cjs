#!/usr/bin/env node
"use strict";

// The check that was missing for two days, and what it cost.
//
// 20260811220000_canonical_audience.sql put the database on one audience
// vocabulary -- nobody, selected, close_friends, friends, followers, everyone --
// and added CHECK constraints refusing anything else. The app was supposed to
// follow. Most of it did.
//
// utils/memories.js did not. It kept offering 'private' and 'public', and
// DEFAULT_MEMORY_VISIBILITY was 'private', so the default path through the Keep
// a Memory screen was rejected by the database every single time. Nobody could
// keep a Memory, and 660 passing tests said nothing -- because every one of
// them compared the app's words against the app's own words. The only thing
// that knew was Postgres, and nothing asked it.
//
// app/linkups/[id].js did not either. It decided its audience label with
// `visibility==="followers" ? "Friends" : "Public"`, and Link-ups stopped
// storing 'followers' at the same rename -- so every Friends-only Link-up
// announced itself as Public to the people looking at it. RULES.md treats a
// privacy control that misreports itself as safety-critical, and it is.
//
// So this reads the source for the two banned words being used as an audience.
// It is deliberately narrow: 'public' is a perfectly good English word and this
// codebase uses it legitimately in a dozen places -- public places, public URLs,
// the Postgres `public` schema. What it refuses is those words appearing where
// an audience value belongs.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const DIRS=["app","components","utils","hooks","context"];

const BANNED=["private","public"];

// The keys whose VALUE is an audience. A banned word quoted immediately after
// one of these is the bug; the same word anywhere else is somebody's prose.
const AUDIENCE_KEYS=[
  "visibility",
  "audience",
  "archive_visibility",
  "archiveVisibility",
  "p_visibility",
  "postAudience",
  "profileVisibility"
];

// Legitimate uses, each one checked by hand rather than pattern-guessed.
const ALLOWED_SUBSTRINGS=[
  "public_place",     // a place type, not an audience
  "publicPlace",
  "public-places",
  "getPublicUrl",     // Supabase storage
  "publicUrl",
  'schema:"public"',  // realtime subscriptions
  "public."           // qualified SQL in a comment or an rpc name
];

// `isPrivate` was on that list, and it was a mistake caught by running this
// gate against the broken code: the line it excused was
// `const isPrivate=visibility==="private"`, which is one of the bugs. A derived
// boolean named after a concept is fine and does not need excusing -- nothing
// here matches a bare identifier, only an audience KEY next to a literal.

// utils/trending.js accepts 'public' ALONGSIDE 'everyone' on purpose, reading
// rows written before the rename. That is backward compatibility on a read
// path, which is the opposite of the bug this gate exists for -- it never
// writes the old word and never shows it to anybody.
const ALLOWED_FILES=new Set([
  path.join("utils","trending.js")
]);

const failures=[];
let filesRead=0;
let audienceLiteralsSeen=0;

function walk(dir){
  const out=[];
  if(!fs.existsSync(dir)) return out;

  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){out.push(...walk(full));continue;}
    if(entry.name.endsWith(".js")) out.push(full);
  }

  return out;
}

for(const dir of DIRS){
  for(const file of walk(path.join(root,dir))){
    const relative=path.relative(root,file);
    if(ALLOWED_FILES.has(relative)) continue;

    filesRead+=1;
    const lines=fs.readFileSync(file,"utf8").split("\n");

    lines.forEach((line,index)=>{
      // A line-comment is documentation. The bug is in code, and the fix for
      // this bug is largely comments explaining it -- a gate that fails on its
      // own explanation is a gate that gets deleted.
      if(/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if(ALLOWED_SUBSTRINGS.some((allowed)=>line.includes(allowed))) return;

      for(const key of AUDIENCE_KEYS){
        // key:"word"  key: "word"  key="word"  key === "word"  key !== 'word'
        const pattern=new RegExp(
          `${key}\\s*(?::|={1,3}|!==?)\\s*["']([a-z_]+)["']`,
          "g"
        );

        for(const match of line.matchAll(pattern)){
          audienceLiteralsSeen+=1;
          if(!BANNED.includes(match[1])) continue;

          failures.push(
            `${relative}:${index+1}: ${key} is '${match[1]}', a word the database refuses. ` +
            `The audience vocabulary is nobody, selected, close_friends, friends, followers, everyone.`
          );
        }
      }

      // The third shape: a constant whose NAME ends in the concept, holding the
      // value directly -- `DEFAULT_MEMORY_VISIBILITY="private"`. That one line
      // is what made the bug reach every user rather than only the ones who
      // changed the setting, because it was the default.
      for(const match of line.matchAll(/\b\w*(?:VISIBILITY|AUDIENCE|Visibility|Audience)\s*=\s*["']([a-z_]+)["']/g)){
        audienceLiteralsSeen+=1;
        if(!BANNED.includes(match[1])) continue;

        failures.push(
          `${relative}:${index+1}: a default audience is '${match[1]}', a word the database refuses. ` +
          `The audience vocabulary is nobody, selected, close_friends, friends, followers, everyone.`
        );
      }

      // The other shape: a list of audience options, as {key:"private",...}.
      // utils/memories.js held both banned words this way and neither was
      // adjacent to the word `visibility` on the line.
      for(const match of line.matchAll(/\bkey\s*:\s*["']([a-z_]+)["']/g)){
        if(!BANNED.includes(match[1])) continue;
        if(!/label\s*:/.test(line)) continue;   // an options list, not a lookup key

        audienceLiteralsSeen+=1;
        failures.push(
          `${relative}:${index+1}: an option list offers '${match[1]}', a word the database refuses. ` +
          `The audience vocabulary is nobody, selected, close_friends, friends, followers, everyone.`
        );
      }
    });
  }
}

// A gate that stops matching anything is a gate that has quietly switched off.
// There are dozens of audience literals in this app; zero means the patterns
// have drifted away from how the code is now written.
if(audienceLiteralsSeen===0){
  failures.push(
    "no audience literal was found anywhere -- this check has silently stopped checking"
  );
}

if(failures.length){
  console.error("Audience vocabulary check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error("\nSee RULES.md: one audience vocabulary, narrowest first, and never a synonym.");
  process.exit(1);
}

console.log(
  `Audience vocabulary check passed (${filesRead} files, ${audienceLiteralsSeen} audience values, none banned).`
);
