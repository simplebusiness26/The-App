// Packet 3 of docs/REDESIGN-BRIEF.md: the navigation shell.
//
// The tab set and the hide rule live here as data and a pure function, so both
// are testable without rendering anything, and so there is one list rather than
// one per surface that wants to know which tab is active.

// Map · Discover · Create · Leaderboard · Profile, in order. `raised` marks the
// centre tab the brief asks to sit above the bar.
//
// Two of these differ from the brief, because the repository disagrees with it
// and the repository wins:
//
//   Leaderboard. The brief says it points at a placeholder. app/leaderboards.js
//   is a finished screen with period and scope filters, shipped with the
//   Explorer social layer -- pointing a tab at an empty state instead would be
//   a regression, not a stub.
//
//   Discover. This one really is new, so /discover is the placeholder the brief
//   describes. It is not an empty screen: Packet 7 will build the real thing,
//   and until then it names the discovery surfaces that already work.
export const TABS=[
  {key:"map",label:"Map",route:"/map",glyph:"map"},
  {key:"discover",label:"Discover",route:"/discover",glyph:"compass"},
  {key:"create",label:"Create",route:"/create",glyph:"plus",raised:true},
  {key:"leaderboard",label:"Leaderboard",route:"/leaderboards",glyph:"trophy"},
  {key:"profile",label:"Profile",route:"/profile",glyph:"person"}
];

// Surfaces that take the whole screen, where a bar of navigation on top of a
// camera or a photo is in the way rather than useful.
//
// The brief names three: full-screen photo, QR scan, full-screen map. Only one
// of them exists in this app today.
//
//   /scan is the camera scanner, and is the real one.
//
//   There is no full-screen photo route. app/moments/[id].js is a scrolling
//   detail screen with a photo in it, not a viewer.
//
//   There is no full-screen map mode. /map IS the Map tab, so hiding the bar
//   there would strand a person on the tab they just opened. When Packet 6
//   gives the map an expanded mode, that mode goes in this list -- not /map.
//
// Recorded as a list rather than an if-statement so adding the other two later
// is one line, and so the test can assert what is in it.
export const FULL_SCREEN_ROUTES=["/scan"];

export function isTabBarHidden(pathname){
  return FULL_SCREEN_ROUTES.includes(normalise(pathname));
}

// The active tab for a path, or null when a person is somewhere off the tab
// set. Detail screens keep their tab lit: opening a place from the map is still
// being in the map, and a bar with nothing lit reads as broken.
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
