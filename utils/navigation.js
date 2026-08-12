// The navigation shell: the tab set and the hide rule, as data and a pure
// function, so both are testable without rendering anything and there is one
// list rather than one per surface that wants to know which tab is active.

// Camera · News Feed · MAP · Explorer Score · Profile, in order. The map sits
// in the raised centre slot because the map is the product -- everything else
// in this app is a layer on it.
//
// `signedIn:true` marks a tab that needs an account. It is not a security
// boundary and never hides the tab: a signed-out visitor still sees all five,
// and tapping one takes them to the log-in screen with the destination
// remembered. Hiding them would make the app look emptier than it is, which is
// the opposite of "open the map and see your local world come alive".
//
// Two notes on where these point today:
//
//   Camera points at /moments/create, which is the post-a-photo screen that
//   exists. It opens the photo library rather than a camera -- there is no
//   camera capture anywhere in this app yet. Packet 16 builds that and this tab
//   is what it lands in. Pointing the tab at a screen that does not exist, or
//   at a coming-soon panel, would be the placeholder UI RULES.md rules out.
//
//   Explorer Score points at /leaderboards. The screen keeps its route and its
//   RPC; only what a person reads changes. WHICH figure it should rank on is an
//   open question -- there are two things in the database that could be called
//   Explorer Score -- and that is Decision 1 in docs/REBUILD-PLAN.md.
export const TABS=[
  {key:"feed",label:"News Feed",route:"/feed",glyph:"feed",signedIn:true},
  {key:"messages",label:"Messages",route:"/messages",glyph:"message",signedIn:true},
  {key:"map",label:"Map",route:"/map",glyph:"map",raised:true},
  {key:"score",label:"Leaderboard",route:"/leaderboards",glyph:"trophy",signedIn:true},
  {key:"profile",label:"Profile",route:"/profile",glyph:"person",signedIn:true}
];

// What the raised centre button becomes when you are already on the map. The
// map tab cannot usefully take you to the map, so the slot carries the thing
// you most want in front of a place: the camera.
//
// It is the Camera, not the scanner. The camera is where a Moment, a Memory and
// a QR scan all start -- one capture surface with three outcomes -- so pointing
// the centre of the map at the scanner alone would name one of the three and
// hide the other two.
export const MAP_CENTRE_ACTION={
  key:"camera",
  label:"Camera",
  route:"/moments/create",
  glyph:"camera",
  signedIn:true
};

// And swiping UP on that button opens Discover. The map is the surface you are
// on; Discover is what is worth going to see. Putting it on an upward swipe
// from the centre keeps it one thumb-reach away without spending a tab on it,
// which is why Discover lost its tab in the first place.
export const MAP_CENTRE_SWIPE_UP={
  key:"discover",
  label:"Discover",
  route:"/discover",
  signedIn:false
};

// Where a signed-out visitor goes when they tap a tab that needs an account.
export const LOGIN_ROUTE="/auth/login";

// Surfaces that take the whole screen, where a bar of navigation on top of a
// camera or a photo is in the way rather than useful.
//
// This list is now EMPTY, and that is the resolution of a real conflict rather
// than an oversight.
//
// /scan used to be in it. The raised centre button becomes Scan QR while you
// are on the map, so with /scan hidden the bar, pressing that button destroyed
// the bar it lives in: you arrive at the scanner with no way back except the
// system gesture, and the button you just pressed no longer exists. Two ways
// out -- make scanning an overlay instead of a route, or let the scanner keep
// the bar. The second is one line and loses nothing: the scanner is a small
// viewfinder and a text field, not a full-bleed camera, so 62px of navigation
// costs it nothing and buys a way out.
//
// A full-screen photo viewer and an expanded map mode both belong here when
// they exist. Neither does today: app/moments/[id].js is a scrolling detail
// screen with a photo in it, and /map IS the map tab.
export const FULL_SCREEN_ROUTES=[];

// What the raised centre button is on a given screen. On the map it is the
// scanner; everywhere else it is the map itself. Returned as data so the bar
// renders it without knowing the rule, and so a test can assert the swap
// without mounting anything.
export function centreButton(pathname){
  const onMap=normalise(pathname)==="/map";
  if(onMap) return MAP_CENTRE_ACTION;
  return TABS.find((tab)=>tab.raised);
}

// What an upward swipe on the centre button does, or null where it does
// nothing. Only the map has one -- everywhere else the centre IS the map, and
// a hidden gesture on a button whose job is already obvious is just a way to
// lose people.
export function centreSwipeUp(pathname){
  return normalise(pathname)==="/map" ? MAP_CENTRE_SWIPE_UP : null;
}

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
