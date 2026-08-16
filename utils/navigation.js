// Alex challenger navigation: the shell expresses the whole service rather than
// preserving the frozen app's five historical destinations.
//
// Product capabilities are not removed. Feed and Leaderboard remain reachable
// through Quick Access / contextual surfaces. The primary dock answers the five
// questions that carry a real-world journey: what fits, what is happening,
// where is it, who am I committed to, and what is mine.
export const TABS=[
  {key:"explore",label:"Explore",route:"/discover",glyph:"compass",signedIn:false},
  {key:"now",label:"Now",route:"/live",glyph:"pulse",signedIn:true},
  // `raised` is retained as behavioural metadata for centreButton(). Alex's
  // visual dock does NOT draw the old raised circular button.
  {key:"map",label:"Map",route:"/map",glyph:"map",raised:true,signedIn:false},
  {key:"inbox",label:"Inbox",route:"/messages",glyph:"message",signedIn:true},
  {key:"you",label:"You",route:"/profile",glyph:"person",signedIn:true}
];

// Feed and Leaderboard are no longer primary dock destinations in Alex's IA,
// but the owner explicitly defined them as home-like surfaces with no Back
// control. Keeping that behaviour does not require putting them back in TABS.
export const AUXILIARY_ROOT_ROUTES=["/feed","/leaderboard"];

// On the Map, the central spatial slot becomes the existing unified Camera.
// Moment, Memory and QR recognition still begin there; no new creation route is
// invented.
export const MAP_CENTRE_ACTION={
  key:"camera",
  label:"Camera",
  route:"/camera",
  glyph:"camera",
  signedIn:true
};

// Preserve the existing upward Map gesture even though Discover is now visible
// in the dock. Redundant access is preferable to silently removing a working,
// owner-reported interaction during a design-only tournament.
export const MAP_CENTRE_SWIPE_UP={
  key:"discover",
  label:"Discover",
  route:"/discover",
  glyph:"compass",
  signedIn:false
};

export const LOGIN_ROUTE="/auth/login";
export const FULL_SCREEN_ROUTES=[];

export function centreButton(pathname){
  if(normalise(pathname)==="/map") return MAP_CENTRE_ACTION;
  return TABS.find((tab)=>tab.raised);
}

export function centreSwipeUp(pathname){
  return normalise(pathname)==="/map" ? MAP_CENTRE_SWIPE_UP : null;
}

export const DRAG_START=4;
export const DRAG_THRESHOLD=28;
export const DRAG_MAX=64;
export function dragOffset(dy){
  const travelled=Number(dy)||0;
  return Math.min(0,Math.max(-DRAG_MAX,travelled));
}
export function isDragging(dx,dy){
  return dy < -DRAG_START && Math.abs(dy) > Math.abs(dx);
}
export function dragOpens(dx,dy){
  return dy < -DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx);
}

export function isTabBarHidden(pathname){
  return FULL_SCREEN_ROUTES.includes(normalise(pathname));
}

export function isRootScreen(pathname){
  const path=normalise(pathname);
  if(path==="/") return true;
  if(AUXILIARY_ROOT_ROUTES.includes(path)) return true;
  return TABS.some((tab)=>tab.route===path);
}

export const HEADER_FLOATS_OVER=["/map","/camera"];
export function headerFloatsOver(pathname){
  return HEADER_FLOATS_OVER.includes(normalise(pathname));
}

// Active navigation follows product context, not only URL prefix. This is what
// lets Events / Clubs / Places feel like deeper Explore work and Link-ups feel
// like deeper Now work without moving any route files.
export function activeTabKey(pathname){
  const path=normalise(pathname);
  const exact=TABS.find((tab)=>tab.route===path);
  if(exact) return exact.key;

  if(path.startsWith("/messages/") || path.includes("/message-board/") || path.includes("/board/")) return "inbox";
  if(path.startsWith("/profile/") || path.startsWith("/connections/") || path.startsWith("/memories/")) return "you";
  if(path.startsWith("/linkups") || path.startsWith("/checkins")) return "now";
  if(
    path.startsWith("/events") ||
    path.startsWith("/activity-clubs") ||
    path.startsWith("/places") ||
    path.startsWith("/business") ||
    path.startsWith("/property")
  ) return "explore";
  if(path.startsWith("/map/")) return "map";

  return null;
}

function normalise(pathname){
  const path=String(pathname || "");
  if(path.length>1 && path.endsWith("/")) return path.slice(0,-1);
  return path;
}