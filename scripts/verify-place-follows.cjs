#!/usr/bin/env node

// Packet 8e: canonical places, canonical areas, follows, and what a Moment now
// carries.
//
// This is a source gate. It proves the contracts this packet depends on are
// still written down -- not that anything runs; test/place-follows.test.js and
// the manual plan cover the parts a grep cannot see.
//
// Every check here exists because deleting the thing it names would be silent
// otherwise. The ones that matter most are the privacy ones: an ORed-in old
// read policy, a friends filter dropped from the feed, or an official post that
// stops checking ownership are all invisible in a diff and expensive in
// production.

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

function contains(relative,needles){
  const content=read(relative);
  for(const needle of needles){
    check(content.includes(needle),`${relative}: missing required contract ${JSON.stringify(needle)}`);
  }
}

// Checks that forbid a pattern read code only: a comment explaining why
// something is banned contains the banned string.
function code(relative){
  return read(relative)
    .split("\n")
    .filter((line)=>!line.trim().startsWith("--") && !line.trim().startsWith("//"))
    .join("\n");
}

const AREAS="supabase/migrations/20260805120000_geo_areas_and_public_places.sql";
const REFS="supabase/migrations/20260805120100_area_and_place_references.sql";
const FOLLOWS="supabase/migrations/20260805120200_entity_and_location_follows.sql";
const MOMENTS="supabase/migrations/20260805120300_moment_place_visibility_and_actor.sql";
const ANON_SPLIT="supabase/migrations/20260805120400_moment_read_policy_anon_split.sql";

// ---------------------------------------------------------------------------
// 1. Every file the packet is made of exists
// ---------------------------------------------------------------------------

for(const file of [
  AREAS,REFS,FOLLOWS,MOMENTS,ANON_SPLIT,
  "utils/places.js",
  "components/EntityFollowButton.js",
  "app/places/index.js",
  "app/places/[id].js",
  "app/admin/public-places.js",
  "docs/PLACE_FOLLOW_TEST_PLAN.md"
]){
  check(fs.existsSync(path.join(root,file)),`${file}: required file is missing`);
}

// ---------------------------------------------------------------------------
// 2. Canonical areas, and a seed that does not guess
// ---------------------------------------------------------------------------

contains(AREAS,[
  "create table if not exists public.geo_areas",
  "area_type in ('town','city','county')",
  "parent_area_id uuid references public.geo_areas(id)",
  "create table if not exists public.geo_area_aliases",
  "alias_normalised text not null unique",
  "guestbook_private.normalise_area_text",
  "A county has no parent area.",
  "A town or city can only sit inside a county."
]);

const areaSql=read(AREAS);

for(const area of ["East Sussex","Hastings","St Leonards-on-Sea","Brighton"]){
  check(areaSql.includes(`'${area}'`),`${AREAS}: the launch hierarchy no longer seeds ${area}`);
}

// The whole approved alias list, and nothing else. A new alias is a product
// decision, so it fails here until somebody adds it deliberately.
const aliases=[...areaSql.matchAll(/\('(?:east-sussex|hastings|st-leonards-on-sea|brighton)','([^']+)'\)/g)]
  .map((match)=>match[1]);

const APPROVED=[
  "east sussex","hastings","hastings east sussex",
  "st leonards","st leonards on sea",
  "brighton","brighton and hove","brighton hove"
];

check(aliases.length>0,`${AREAS}: no seeded aliases were parsed — the seed has moved or changed shape`);

for(const alias of aliases){
  check(APPROVED.includes(alias),`${AREAS}: "${alias}" is not an approved alias — a new one is a product decision, not a migration detail`);
}

// The eight values that must stay unmatched. A park name is never an area
// alias: Preston Park is a park in Brighton, not a word for Brighton.
const MUST_STAY_UNMATCHED=[
  "hastings old town","hastings seafront","brighton seafront","brighton pier",
  "preston park","north laine","america ground","local area"
];

for(const value of MUST_STAY_UNMATCHED){
  check(!aliases.includes(value),`${AREAS}: "${value}" was seeded as an area alias — it must stay unmatched for a person to decide`);
}

// ---------------------------------------------------------------------------
// 3. Public places, as one general table
// ---------------------------------------------------------------------------

contains(AREAS,[
  "create table if not exists public.public_places",
  "'park','beach','viewpoint','landmark','public_square','nature_area','attraction','other'",
  "public_places_name_area_unique",
  "public_places_name_unplaced_unique",
  "alter table public.public_places enable row level security",
  "create policy public_places_admin_write",
  "public.guestbook_is_admin()"
]);

// ---------------------------------------------------------------------------
// 4. References are additive, and nothing is inferred from an address
// ---------------------------------------------------------------------------

contains(REFS,[
  "add column if not exists area_id uuid references public.geo_areas(id)",
  "add column if not exists public_place_id uuid references public.public_places(id)",
  "live_checkins_public_place_scope",
  "public.get_unmatched_area_report()",
  "Administrator access required."
]);

const refsCode=code(REFS);

check(
  !/update\s+public\.(businesses|properties)\s+\w*\s*set\s+area_id/i.test(refsCode),
  `${REFS}: backfills an area onto businesses or properties — neither has a town column, only a postal address, and parsing one is guessing`
);

check(
  /guestbook_private\.normalise_area_text\([^)]*\)=a\.alias_normalised/.test(refsCode),
  `${REFS}: the backfill no longer matches on an exact approved alias`
);

check(
  !/like\s*'%'\s*\|\|/i.test(refsCode),
  `${REFS}: matches areas with LIKE — the rule is exact approved aliases only`
);

// The check-in path keeps its free text.
contains(REFS,[
  "insert into public.live_checkins(user_id,place_type,target_id,public_place_id,place_name,area,area_id",
  "p_public_place_id uuid default null"
]);

check(
  !/alter table public\.live_checkins\s+drop column/i.test(refsCode),
  `${REFS}: drops a live_checkins column — the free-text place name and area must keep working`
);

// ---------------------------------------------------------------------------
// 5. Follows: five entity types, no Link-ups, no fan-out, own rows only
// ---------------------------------------------------------------------------

contains(FOLLOWS,[
  "create table if not exists public.explorer_entity_follows",
  "target_type in ('business','property','activity_club','event','public_place')",
  "create table if not exists public.explorer_location_follows",
  "area_id uuid not null references public.geo_areas(id)",
  "create policy explorer_entity_follows_read_own",
  "follower_id=(select auth.uid())",
  "public.get_entity_follow_stats",
  "public.get_location_follow_stats",
  "Follow limit reached."
]);

const followsCode=code(FOLLOWS);

check(
  !/'linkup'/.test(followsCode),
  `${FOLLOWS}: allows following a Link-up — a Link-up is joined, not followed`
);

check(
  !/insert into public\.notifications/i.test(followsCode),
  `${FOLLOWS}: sends a notification — following a place must not fan out to its followers`
);

check(
  !/create policy explorer_entity_follows_read[a-z_]* on public\.explorer_entity_follows\s+for select to authenticated using \(true\)/i.test(followsCode),
  `${FOLLOWS}: exposes every follow row — a follow list is a movement history, only the follower may read theirs`
);

// ---------------------------------------------------------------------------
// 6. Moments: location snapshot, visibility, actor identity
// ---------------------------------------------------------------------------

contains(MOMENTS,[
  "add column if not exists area_id uuid references public.geo_areas(id)",
  "add column if not exists visibility text not null default 'public'",
  "add column if not exists actor_type text not null default 'explorer'",
  "explorer_moments_visibility_check",
  "visibility in ('public','friends')",
  "actor_type in ('explorer','business','property','activity_club','event')",
  "explorer_moments_explorer_actor_is_author",
  "explorer_moments_official_is_public",
  "guestbook_private.are_friends",
  "guestbook_private.snapshot_moment_place",
  "round(new.latitude::numeric,3)",
  "round(new.longitude::numeric,3)",
  "An official Moment must be attached to the listing it speaks for",
  "You do not manage this listing",
  "You cannot mark your own review as useful"
]);

const momentsSql=read(MOMENTS);

// public_place may be attached and may not speak.
check(
  /target_type is null or target_type in \('business','property','activity_club','event','public_place'\)/.test(momentsSql),
  `${MOMENTS}: public_place is no longer an attachable Moment target`
);

check(
  !/actor_type in \([^)]*'public_place'/.test(momentsSql),
  `${MOMENTS}: allows posting as a public place — nobody speaks for a park until public places have a management model`
);

// The old read policy must be gone, not merely joined by a new one. Policies
// for the same command are ORed, so leaving it makes the new one decorative.
check(
  momentsSql.includes("drop policy if exists explorer_moments_public_read on public.explorer_moments"),
  `${MOMENTS}: does not drop explorer_moments_public_read — policies OR together, so every friends-only Moment would stay publicly readable`
);

// The read policy is split by role, and the split is not cosmetic: anon has
// no USAGE on guestbook_private and no EXECUTE on are_friends, so a single
// `to public` policy that calls it raises 42501 for a signed-out visitor
// rather than returning the public Moments. That shipped for the length of
// one migration and is why this check exists.
const anonSplit=read(ANON_SPLIT);

check(
  /create policy explorer_moments_read_anon on public\.explorer_moments\s+for select to anon/.test(anonSplit),
  `${ANON_SPLIT}: has no anon-specific read policy — a signed-out visitor would evaluate are_friends and be refused`
);

check(
  !/create policy explorer_moments_read_anon[\s\S]*?;/.exec(anonSplit)?.[0]?.includes("are_friends"),
  `${ANON_SPLIT}: the anon read policy calls are_friends — anon cannot execute it, so every Moment becomes unreadable when signed out`
);

check(
  /create policy explorer_moments_read_authenticated[\s\S]*visibility='friends' and guestbook_private\.are_friends/.test(anonSplit),
  `${ANON_SPLIT}: the authenticated read policy no longer restricts friends-only Moments to mutual follows`
);

check(
  !/for select to public/.test(code(ANON_SPLIT)),
  `${ANON_SPLIT}: a read policy targets "public", which includes anon — the two roles need different rules`
);

// The feed is the second lock on the same rule.
check(
  /or guestbook_private\.are_friends\(m\.user_id,v\.id\)/.test(momentsSql),
  `${MOMENTS}: get_explorer_social_feed no longer filters friends-only Moments — RLS is the first lock and this is the second`
);

check(
  momentsSql.includes("returns table(\n  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,created_at timestamptz,"),
  `${MOMENTS}: get_explorer_social_feed's return type changed — app/feed.js reads these columns by name`
);

// 8c's fix and the activity-club widening both survive this rewrite.
check(
  momentsSql.includes("status in ('open','full')"),
  `${MOMENTS}: reverted the activity-club Moment attachment fix from 20260802191500`
);

// The official fan-out is narrowed, not widened.
check(
  /if new\.actor_type='explorer' then[\s\S]*from public\.explorer_follows f/.test(momentsSql),
  `${MOMENTS}: an official Moment notifies the poster's personal followers — official posts belong in the feed, not in a push`
);

check(
  /new\.visibility='public' or guestbook_private\.are_friends\(new\.user_id,f\.follower_id\)/.test(momentsSql),
  `${MOMENTS}: notifies one-way followers about a friends-only Moment they cannot open`
);

check(
  !/explorer_entity_follows|explorer_location_follows/.test(code(MOMENTS).split("social_notification_trigger")[1] || ""),
  `${MOMENTS}: fans notifications out to entity or location followers — that is a preferences feature, not this packet`
);

// ---------------------------------------------------------------------------
// 7. The screens
// ---------------------------------------------------------------------------

contains("utils/places.js",[
  "PUBLIC_PLACE_TYPES",
  "FOLLOWABLE_ENTITY_TYPES",
  "MOMENT_VISIBILITY",
  "DEFAULT_MOMENT_VISIBILITY=\"friends\"",
  "COORDINATE_PRECISION=3"
]);

const places=read("utils/places.js");

check(
  !/key:"linkup"/.test(places),
  "utils/places.js: offers a Link-up as a followable entity"
);

check(
  /\{\s*key:"friends"/.test(places.slice(places.indexOf("MOMENT_VISIBILITY"))),
  "utils/places.js: Friends is no longer the first Moment audience — the closed setting is the default"
);

contains("components/EntityFollowButton.js",[
  "explorer_entity_follows",
  "explorer_location_follows",
  "get_entity_follow_stats",
  "get_location_follow_stats"
]);

check(
  !/\.from\("explorer_entity_follows"\)[\s\S]{0,120}\.select\(/.test(read("components/EntityFollowButton.js")),
  "components/EntityFollowButton.js: selects follow rows directly — the count comes from the RPC so a follower list cannot be read"
);

contains("app/moments/create.js",[
  "DEFAULT_MOMENT_VISIBILITY",
  "MOMENT_VISIBILITY",
  "visibility:audience",
  "actor_type:official ? placeType : \"explorer\"",
  "actor_id:official ? selectedPlace.id : user.id",
  "public_place:{label:\"Public place\"",
  "<AddLocation"
]);

const create=read("app/moments/create.js");

check(
  create.includes("const canPostOfficially=!!user"),
  "app/moments/create.js: no longer decides whether the official option may appear"
);

check(
  /PLACE_TYPES\[placeType\]\.manager\(selectedPlace\)===user\.id/.test(create),
  "app/moments/create.js: offers official posting without comparing the viewer to the listing's manager"
);

// ---------------------------------------------------------------------------
// Where a post says it happened
// ---------------------------------------------------------------------------
//
// This used to check one screen's own location button. It is one shared control
// now -- components/AddLocation.js -- because a Memory had NO location handling
// at all: app/memories/create.js never asked and never sent, so a standalone
// Memory carried no coordinates and could not appear on the map. Two screens
// each rounding a coordinate their own way is how one of them ships a doorstep.
//
// The owner asked for the second precision: "if you don't want your exact
// location on the map it goes to your area, same with memory."

const LOCATION="components/AddLocation.js";
const addLocation=read(LOCATION);

for(const screen of ["app/moments/create.js","app/memories/create.js"]){
  const source=read(screen);

  check(
    /<AddLocation/.test(source),
    `${screen}: must offer the shared location control`
  );
  check(
    !/getCurrentPositionAsync|requestForegroundPermissionsAsync/.test(source),
    `${screen}: reads the device position itself — asking belongs in ${LOCATION}, once`
  );
  check(
    /\{!selectedPlace &&/.test(source),
    `${screen}: must only offer a location for a standalone post — an attached one takes the place's own coordinates on insert`
  );
}

// Never on mount, never on render: only inside a handler for a button that
// says what it does.
check(
  !/(useEffect|useMemo)\([\s\S]{0,300}requestForegroundPermissionsAsync/.test(addLocation),
  `${LOCATION}: asks for the location permission outside an explicit action`
);

// Rounded on the device, so a precise coordinate never leaves it. The database
// rounds again on insert; that is the floor, not the protection.
check(
  /roundLocation\(/.test(addLocation),
  `${LOCATION}: must round through roundLocation() so "my area only" cannot send a doorstep`
);

// Nothing is on by default, and every answer is reversible.
check(
  /accessibilityState=\{\{selected:active\}\}/.test(addLocation),
  `${LOCATION}: must say which precision is selected`
);
check(
  /if\(active\)\{onChange\?\.\(null\)/.test(addLocation),
  `${LOCATION}: the location control is no longer an explicit, reversible tap`
);
check(
  !/useState\((true|LOCATION_DETAIL)/.test(addLocation),
  `${LOCATION}: a precision is preselected — RULES.md, opt-in is never the fallback branch`
);

contains("app/checkins/create.js",[
  "p_public_place_id:publicPlaceId",
  "public_places"
]);

check(
  read("app/checkins/create.js").includes("setPlaceName(value);setTargetId(null);setPublicPlaceId(null);"),
  "app/checkins/create.js: typing a place name no longer clears the canonical reference, so the id and the text could disagree"
);

// showReviews={false} used to be asserted here, and the reason was sound: there
// was no public_place_reviews table, so a reviews section on a park invited
// something the app could not record. Rebuild Packet 10 removed the reason
// rather than the section -- explorer_reviews.target_type includes public_place
// now, and a park is a place, not its own concept. The park page reads the same
// one table as every other place page.
contains("app/places/[id].js",[
  'loadPlaceReviews("public_place"',
  "targetType=\"public_place\"",
  "targetType=\"geo_area\""
]);

check(
  !read("app/places/[id].js").includes("showReviews={false}"),
  "app/places/[id].js: reviews are switched off, but parks are reviewable now"
);

contains("app/admin/public-places.js",[
  "useAdminGate",
  "showFeedback",
  "Alert.alert"
]);

// Both write paths, not one. An RLS refusal returns no error and no rows, so a
// save or a hide that only looks at `error` reports success while nothing
// happened -- the failure verify-screen-gates.cjs was written after.
check(
  (read("app/admin/public-places.js").match(/if\(!data \|\| !data\.length\)/g) || []).length>=2,
  "app/admin/public-places.js: a write path does not check that a row actually changed — an RLS refusal returns no error, only zero rows"
);

// Reachable from somewhere. An unreachable screen is a screen nobody has.
//
// utils/drawer.js is RETIRED (DesignLab redesign -- see
// scripts/verify-screen-gates.cjs's own note). /admin/public-places has a
// real link independent of the drawer and still does; /places does not yet,
// and that is a genuine, tracked cross-agent gap rather than an oversight:
// FINAL_PRODUCT_CONTRACT.md's Map tab contents put "List toggle -> Public
// Places" on the Map tab itself, which is components/LivingMapScreen.js and
// out of the packet that retired the drawer (it does not touch map files).
// Until that toggle lands, /places is declared and reachable by direct
// navigation but has no in-app entry point -- flagged in that packet's final
// report rather than silently left unchecked.
contains("app/admin/dashboard.js",['router.push("/admin/public-places")']);
contains("app/_layout.js",['name="places/index"','name="places/[id]"','name="admin/public-places"']);

// ---------------------------------------------------------------------------

if(failures.length){
  console.error(`Place and follow check failed (${passed} passed, ${failures.length} failed):\n`);
  for(const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Place and follow check passed (${passed} checks).`);
