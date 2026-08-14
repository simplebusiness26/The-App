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
//   Camera points at /camera, which is a real camera. It used to point at
//   /moments/create -- the post-a-photo screen, which opens the PHOTO LIBRARY --
//   so the one control in this app named after a camera was the one control
//   that could not take a picture. app/camera.js takes the photo and hands it
//   to the Moment or Memory screen, and recognises a Xplorer QR code whenever
//   one is in front of it.
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
  route:"/camera",
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

// ---------------------------------------------------------------------------
// The drag, as arithmetic
// ---------------------------------------------------------------------------
// The centre button follows the finger, and the numbers that decide how live
// here rather than inside the component, so they can be checked without faking
// a touch. Fake touch events do not carry the history PanResponder reads, which
// is what made an earlier attempt at testing the gesture pass while the gesture
// itself did nothing.

// How far up before the button starts moving. Small: a drag has to begin when
// somebody means it. Still bigger than the pixel or two a tap wanders.
export const DRAG_START=4;
// How far up before letting go actually opens Discover. Bigger than DRAG_START
// so a drag that started by accident can be put back down.
export const DRAG_THRESHOLD=28;
// The furthest it travels, however far the finger keeps going.
export const DRAG_MAX=64;

// Where to draw the button for a finger that has moved dy. Negative is up.
export function dragOffset(dy){
  const travelled=Number(dy)||0;
  return Math.min(0,Math.max(-DRAG_MAX,travelled));
}

// Is this movement a drag at all, rather than a tap or a sideways swipe?
export function isDragging(dx,dy){
  return dy < -DRAG_START && Math.abs(dy) > Math.abs(dx);
}

// Let go here -- does Discover open?
export function dragOpens(dx,dy){
  return dy < -DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx);
}

export function isTabBarHidden(pathname){
  return FULL_SCREEN_ROUTES.includes(normalise(pathname));
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

// IS THIS A PLACE YOU CAN LEAVE, OR A PLACE YOU LIVE?
//
// The owner: "there shouldn't be a back button on the news feed, messages, map,
// leaderboard or profile -- only on child pages. Keep the hamburger everywhere.
// Let's get smart."
//
// They are right, and it is not only clutter. A back arrow on a tab root points
// at whatever you happened to be looking at before, which is not "back" in any
// sense somebody means it -- the tab bar is how you move between these five,
// and an arrow that competes with it teaches people the wrong model.
//
// The rule lives here, next to TABS, because it IS the tab list. `/` is in it
// too: the splash has nowhere behind it.
export function isRootScreen(pathname){
  const path=normalise(pathname);
  if(path==="/") return true;
  return TABS.some((tab)=>tab.route===path);
}

// Screens the header floats over instead of sitting above.
//
// The map is the whole point of this: it is a full-bleed surface, and 60px of
// solid bar across the top of it was the owner's "it drops the whole page down"
// -- the search box started below a bar rather than on the map. The camera is
// a viewfinder for the same reason.
//
// Everywhere else the content starts below the header. It is a transparent
// header over the page's own top padding rather than a card-coloured bar with a
// border, so nothing reads as bolted on, and nothing can be covered either.
export const HEADER_FLOATS_OVER=["/map","/camera"];

export function headerFloatsOver(pathname){
  return HEADER_FLOATS_OVER.includes(normalise(pathname));
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
