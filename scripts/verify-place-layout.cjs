#!/usr/bin/env node

// Packet 5a acceptance: "All six page types use one component; grep proves no
// duplicate."
//
// Two corrections to that wording, both recorded in docs/REDESIGN-STATE.md.
// There are five page types, not six -- `park` has no table, no row and no
// page. And 5a covers two of them; 5b adds events and clubs, 5c adds link-ups
// after a privacy review. CONVERTED below is the list that grows.
//
// test/place-page.test.js proves the converted screens still show what they
// showed before. This proves the duplication actually went away, which a
// behaviour test cannot see: two screens rendering identical markup by copy and
// paste pass every assertion in that file.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const failures=[];
let passed=0;

function check(condition,message){
  if(condition) passed+=1;
  else failures.push(message);
}

function read(relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){
    failures.push(`${relative}: file is missing`);
    return "";
  }
  return fs.readFileSync(file,"utf8");
}

function code(content){
  return content
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1");
}

const LAYOUT="components/PlaceLayout.js";

// Grown one packet at a time. 5a converted business and property; 5b added
// events and activity clubs. 5c appends link-ups, and not before the privacy
// review the ledger records as its first task.
const CONVERTED=[
  "app/business/[id].js",
  "app/property/[id].js",
  "app/events/[id].js",
  "app/activity-clubs/[id].js",
  "app/linkups/[id].js"
];

// ---------------------------------------------------------------------------
// 1. Every converted page uses the layout
// ---------------------------------------------------------------------------

for(const screen of CONVERTED){
  const content=code(read(screen));

  check(
    /import\s+PlaceLayout\s+from/.test(content),
    `${screen}: does not import ${LAYOUT}`
  );
  check(
    /<PlaceLayout/.test(content),
    `${screen}: imports the layout but does not render it`
  );
}

// ---------------------------------------------------------------------------
// 2. And none of them kept a copy of it
// ---------------------------------------------------------------------------
//
// The markup that was duplicated across the two screens, named by the thing it
// built. Finding any of it outside the layout means the extraction was partial,
// which is worse than not having done it -- two places to change, one of which
// nobody remembers.

const LAYOUT_ONLY=[
  ["formatReviewDate","the review date formatter"],
  ["reviewCard:","the review card style"],
  ["modalBackdrop:","the photo viewer"],
  ["heroPhoto:","the hero photo strip"],
  ["statCard:","the rating block"],
  // Added in 5b. The event and club screens spelled the same pieces
  // differently, which is how four copies of a review card came to exist.
  ["reviewPhoto:","the review photo strip"],
  ["pointsBadge:","the points badge"],
  ["emptyStars:","the star rating"]
];

for(const screen of CONVERTED){
  const content=code(read(screen));

  for(const [needle,what] of LAYOUT_ONLY){
    check(
      !content.includes(needle),
      `${screen}: still defines ${what} (${needle}) — it belongs to ${LAYOUT} alone`
    );
  }
}

const layout=code(read(LAYOUT));

for(const [needle,what] of LAYOUT_ONLY){
  check(
    layout.includes(needle),
    `${LAYOUT}: does not define ${what} (${needle}) — the shared layout is where it should live`
  );
}

// ---------------------------------------------------------------------------
// 3. No later-stage controls
// ---------------------------------------------------------------------------
//
// The brief draws Directions, "Book a table" and "Get tickets" on this page.
// Directions is Stage Four, the other two are Stage Five, and CLAUDE.md's
// approved-exceptions note cuts all three explicitly: "It does not license the
// Stage Four and Stage Five surfaces the brief draws in passing."
//
// property.booking_url is not one of these. It is an existing column holding a
// manager's own link out, shipped before this brief, and opening someone else's
// booking page is not this app taking a booking.

const BANNED=[
  ["directions","Directions is Stage Four"],
  ["book a table","Book a table is Stage Five"],
  ["get tickets","Get tickets is Stage Five"],
  ["coming soon","RULES.md bans placeholder UI for later stages"]
];

for(const file of [LAYOUT,...CONVERTED]){
  const content=code(read(file)).toLowerCase();

  for(const [needle,why] of BANNED){
    check(
      !content.includes(needle),
      `${file}: mentions "${needle}" — ${why}`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. The page and the pin agree about what a place is
// ---------------------------------------------------------------------------
//
// "Listing type displayed matches the map marker for the same record." The only
// way to hold that is one source: utils/markers.js exports the labels its own
// markers are built from, and the pages must read them rather than writing
// their own string.

// Matched at the point of use, not on the import. Checking only that the
// identifier appears somewhere in the file passes on an import left behind
// after the prop was hardcoded -- which is exactly how this check was first
// written, and it failed to notice the label being replaced with a literal.
check(
  /typeLabel=\{[^}]*typeLabelForBusiness\(/.test(code(read("app/business/[id].js"))),
  "app/business/[id].js: typeLabel must come from typeLabelForBusiness(), not be written here"
);
check(
  /typeLabel=\{PROPERTY_TYPE_LABEL\}/.test(code(read("app/property/[id].js"))),
  "app/property/[id].js: typeLabel must be PROPERTY_TYPE_LABEL, not be written here"
);
check(
  /typeLabel=\{CLUB_TYPE_LABEL\}/.test(code(read("app/activity-clubs/[id].js"))),
  "app/activity-clubs/[id].js: typeLabel must be CLUB_TYPE_LABEL, not be written here"
);
// Events are not on the map yet, so there is no marker to disagree with. The
// label is still taken from utils/markers.js so that whichever packet puts an
// event on the map inherits the same word rather than inventing a second one.
check(
  /typeLabel=\{EVENT_TYPE_LABEL\}/.test(code(read("app/events/[id].js"))),
  "app/events/[id].js: typeLabel must be EVENT_TYPE_LABEL, not be written here"
);
check(
  /typeLabel=\{LINKUP_TYPE_LABEL\}/.test(code(read("app/linkups/[id].js"))),
  "app/linkups/[id].js: typeLabel must be LINKUP_TYPE_LABEL, not be written here"
);

// ---------------------------------------------------------------------------
// 4b. The link-up page keeps its second lock
// ---------------------------------------------------------------------------
//
// Packet 5c is a privacy gate. The database is the real boundary: the policy
// linkup_private_select_members restricts linkup_private_details to the creator
// and active members, and a real non-member was verified to read zero rows from
// the live project. These checks defend the layer above it, which exists so a
// mistake in the first one is not the only thing standing between a meeting
// point and a stranger.

const linkupPage=code(read("app/linkups/[id].js"));

check(
  /joined\s*&&\s*privateDetails/.test(linkupPage),
  "app/linkups/[id].js: the meeting point must stay behind a joined check, even though RLS also enforces it"
);
check(
  /report_live_safety/.test(linkupPage),
  "app/linkups/[id].js: the report control must remain — it is what a person needs when a Link-up goes wrong"
);
check(
  /block_explorer/.test(linkupPage),
  "app/linkups/[id].js: the block control must remain"
);
check(
  /showReviews=\{false\}/.test(linkupPage),
  "app/linkups/[id].js: link-ups have no reviews table, so the reviews section must be omitted rather than emptied"
);

// The policy itself must still be declared. A migration that dropped it would
// leave the client check as the only thing between a meeting point and anyone
// who can open the page.
const privacyMigration=read("supabase/migrations/20260802211800_harden_linkups_live_privacy.sql");
check(
  /create policy linkup_private_select_members on public\.linkup_private_details/.test(privacyMigration),
  "the linkup_private_select_members policy is missing — the meeting point would have no server-side boundary"
);
check(
  /is_active_linkup_member/.test(privacyMigration) && /is_linkup_creator/.test(privacyMigration),
  "the private-details policy must restrict to active members and the creator"
);

const markers=code(read("utils/markers.js"));
check(
  /typeSentence:`\$\{typeLabelForBusiness\(business\)\}\.`/.test(markers),
  "utils/markers.js: the business marker must use the same label the page shows"
);
check(
  /typeSentence:`\$\{PROPERTY_TYPE_LABEL\}\.`/.test(markers),
  "utils/markers.js: the property marker must use the same label the page shows"
);
check(
  /typeSentence:`\$\{CLUB_TYPE_LABEL\}\.`/.test(markers),
  "utils/markers.js: the club marker must use the same label the page shows"
);

// ---------------------------------------------------------------------------
// 5. The colours are tokens
// ---------------------------------------------------------------------------

const tokens=new Set(
  [...read("docs/design-system.md").matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m)=>m[0].toUpperCase())
);

for(const file of [LAYOUT,...CONVERTED]){
  for(const match of read(file).matchAll(/#[0-9A-Fa-f]{6}\b/g)){
    check(
      tokens.has(match[0].toUpperCase()),
      `${file}: ${match[0]} is not in the docs/design-system.md token table`
    );
  }
}

// ---------------------------------------------------------------------------

if(failures.length){
  console.error("Place layout check failed:\n");
  for(const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${passed} checks passed, ${failures.length} failed.`);
  process.exit(1);
}

console.log(`Place layout check passed (${passed} checks; ${CONVERTED.length} converted page types).`);
