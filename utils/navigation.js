// The navigation shell: the tab set and the hide rule, as data and a pure
// function, so both are testable without rendering anything and there is one
// list rather than one per surface that wants to know which tab is active.
//
// REWRITTEN for the DesignLab redesign (locked architecture:
// blend-morville-cooper + blend-wroblewski-clark-map). The old shell was
// News Feed / Messages / raised-MAP / Leaderboard / Profile, with the raised
// centre button swapping to Camera on the map and a drag-up gesture opening
// Discover. FINAL_PRODUCT_CONTRACT.md replaces all of that:
//
//   Tabs (5, NONE raised): Map · Happening · Community · Messages · Me
//   Global floating action: Create -- reachable identically from any screen,
//     not a tab, not gesture/route-contingent. See components/CreateHub.js.
//
// So the raised-button machinery (MAP_CENTRE_ACTION, MAP_CENTRE_SWIPE_UP,
// centreButton(), centreSwipeUp(), the drag arithmetic) is gone rather than
// adapted -- keeping it around unused would be a second, disagreeing answer
// to "what does the centre of the bar do", and the centre of the bar no
// longer does anything special.
//
// A NOTE FOR WHOEVER BUILDS THE HAPPENING AND COMMUNITY DESTINATIONS
//
// The contract asks for Happening (For You/Discover · Live Now · Events ·
// Clubs · Link-ups) and Community (Feed · Explorers · Leaderboard) as ONE
// segmented destination each. Building that segmented container screen is
// explicitly out of this packet's scope -- "Do not touch anything under
// app/happening-equivalent routes (discover/live/events/activity-clubs/
// linkups), Community-equivalent routes (feed/explorers/leaderboards)...
// other agents own those." So these tabs point at the best existing single
// screen for now (Discover, Feed) rather than a route that does not exist
// yet. Whoever builds the real segmented screens should add the new route
// file, register it in app/_layout.js, and repoint HAPPENING_ROUTE/
// COMMUNITY_ROUTE below at it -- that is a one-line change once it exists.
export const HAPPENING_ROUTE="/discover";
export const COMMUNITY_ROUTE="/feed";

// `signedIn:true` marks a tab that needs an account. It is not a security
// boundary and never hides the tab: a signed-out visitor still sees all five,
// and tapping one takes them to the log-in screen with the destination
// remembered. Hiding them would make the app look emptier than it is, which is
// the opposite of "open the map and see your local world come alive".
//
// Map and Happening carry signedIn:false -- both work for a visitor today
// (/map has no gate, /discover's drawer row was GATES.ALWAYS). Community,
// Messages and Me all need an account, same as the screens they point at.
export const TABS=[
  {key:"map",label:"Map",route:"/map",glyph:"map"},
  {key:"happening",label:"Happening",route:HAPPENING_ROUTE,glyph:"compass"},
  {key:"community",label:"Community",route:COMMUNITY_ROUTE,glyph:"community",signedIn:true},
  {key:"messages",label:"Messages",route:"/messages",glyph:"message",signedIn:true},
  {key:"me",label:"Me",route:"/profile",glyph:"person",signedIn:true}
];

// Where a signed-out visitor goes when they tap a tab that needs an account.
// `withNext` appends the tab's own route as `?next=`, so auth/login.js's
// existing safeDestination()/`next` handling sends them back to the exact tab
// they meant to open rather than dropping them on the splash -- the same
// "return to the exact in-progress action" rule the Create hub's gated
// actions follow.
export const LOGIN_ROUTE="/auth/login";

export function withNext(route){
  return `${LOGIN_ROUTE}?next=${encodeURIComponent(route)}`;
}

// Surfaces that take the whole screen, where a bar of navigation on top of a
// camera or a photo is in the way rather than useful. Empty, same as before
// the redesign -- see the historical note this file used to carry: /scan
// tried this once and it stranded people with no way back. Nothing new here
// needs it either: the Create hub is an overlay above the bar, not a route.
export const FULL_SCREEN_ROUTES=[];

export function isTabBarHidden(pathname){
  return FULL_SCREEN_ROUTES.includes(normalise(pathname));
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

// IS THIS A PLACE YOU CAN LEAVE, OR A PLACE YOU LIVE?
//
// Unchanged rule, now driven by the new five. `/` is in it too: the splash
// has nowhere behind it.
export function isRootScreen(pathname){
  const path=normalise(pathname);
  if(path==="/") return true;
  return TABS.some((tab)=>tab.route===path);
}

// Screens the header floats over instead of sitting above. Unchanged: the map
// and the camera are both full-bleed surfaces where a solid bar across the
// top pushes their own controls down.
export const HEADER_FLOATS_OVER=["/map","/camera"];

export function headerFloatsOver(pathname){
  return HEADER_FLOATS_OVER.includes(normalise(pathname));
}

// The active tab for a path, or null when a person is somewhere off the tab
// set. Detail screens keep their tab lit: opening a place from the map is
// still being in the map, and a bar with nothing lit reads as broken.
export function activeTabKey(pathname){
  const path=normalise(pathname);

  const exact=TABS.find((tab)=>tab.route===path);
  if(exact) return exact.key;

  for(const tab of TABS){
    if(path.startsWith(`${tab.route}/`)) return tab.key;
  }

  return null;
}

function normalise(pathname){
  const path=String(pathname || "");
  if(path.length>1 && path.endsWith("/")) return path.slice(0,-1);
  return path;
}
