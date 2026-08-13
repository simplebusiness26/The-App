// Which bubbles are on the map right now, and which are not.
//
// THE PROBLEM THIS EXISTS TO PREVENT
// Every marker deciding for itself whether to show a popup. Twenty pins in view
// and twenty popups is not a live map, it is a mess -- and each one would be
// making that decision without knowing what the other nineteen were doing. So
// nothing draws a bubble on its own: candidates are offered here, and this
// decides.
//
// It is a pure function of (candidates, viewport, tick, selection). No timers,
// no state, no React. A component calls it on a tick and draws what it gets
// back, which is the only way "no more than three bubbles, rotating, and never
// two on the same pin" can be tested at all.
//
// WHAT IS NOT HERE
// Moments. They are the heatmap -- "what is happening here now?" is a density
// question, not a per-pin one -- and letting them into the rotation would drown
// everything else, because there are more of them than of anything else. See
// utils/mapLayers.js.

// Two or three. Three is the brief's ceiling; the shape of the map decides
// whether the third one has anywhere to go without covering another pin.
export const MAX_AUTOMATIC_BUBBLES=3;

// How long one bubble stays up before the rotation moves on.
export const BUBBLE_MS=4200;

// The kinds of thing that may surface, most important first. Priority is a
// property of the KIND, not of the row: a review with a photo is always more
// interesting than "spaces open", and encoding that here rather than at each
// call site is what stops two surfaces disagreeing.
export const BUBBLE_PRIORITY={
  event:0,          // happening now, and it will not be happening later
  review:1,         // somebody's photo of the place
  activity_club:2,  // spaces open
  property:3        // availability
};

export function bubblePriority(kind){
  const rank=BUBBLE_PRIORITY[kind];
  return typeof rank==="number" ? rank : 99;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

// A review may only bubble if it has an IMAGE. The bubble IS the photo -- a
// compact rounded picture, not a card of text, a name and a star rating. A
// review without one has nothing to show and does not become a bubble.
export function reviewIsEligible(review){
  return !!review?.media_url && review?.media_type==="image";
}

// A club bubbles only when its manager has said there is room. Off is not
// "unknown", it is "do not surface this" -- and it never removes the pin.
export function clubIsEligible(club){
  return club?.spaces_available===true && club?.status!=="full";
}

// A property bubbles only when its manager has turned it on AND there is
// something true to say. No invented inventory: if the app does not know a
// number, the bubble says "Available" and nothing more.
export function propertyIsEligible(property){
  return property?.show_availability===true;
}

export function propertyAvailabilityText(property){
  const rooms=Number(property?.rooms_available);
  if(Number.isFinite(rooms) && rooms>0){
    return rooms===1 ? "Room available" : `${rooms} rooms`;
  }
  return "Available";
}

// An event bubbles while it is on, or about to be.
export function eventBubbleText(event,now=Date.now()){
  const starts=new Date(event?.starts_at).getTime();
  const ends=new Date(event?.ends_at).getTime();

  if(Number.isFinite(starts) && Number.isFinite(ends) && now>=starts && now<=ends){
    return "Happening now";
  }

  if(!Number.isFinite(starts) || starts<now) return "";

  const minutesAway=(starts-now)/60000;
  if(minutesAway<=60) return "Starting soon";

  // Tonight, meaning later today.
  const startDay=new Date(starts);
  const today=new Date(now);
  const sameDay=startDay.getFullYear()===today.getFullYear()
    && startDay.getMonth()===today.getMonth()
    && startDay.getDate()===today.getDate();

  return sameDay ? "Tonight" : "";
}

// Only an event that is actually on gets the celebration. "Tonight" is not a
// thing to let off confetti about.
export function eventDeservesCelebration(event,now=Date.now()){
  return eventBubbleText(event,now)==="Happening now";
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

// A bubble for something off the edge of the screen is a bubble pointing at
// nothing. `viewport` is {north,south,east,west}; a missing one means no
// filtering rather than no bubbles, because a map that has not reported its
// bounds yet should still be able to show something.
export function inViewport(candidate,viewport){
  if(!viewport) return true;

  const {north,south,east,west}=viewport;
  if(![north,south,east,west].every((value)=>Number.isFinite(Number(value)))) return true;

  const latitude=Number(candidate?.latitude);
  const longitude=Number(candidate?.longitude);
  if(!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  return latitude<=Number(north) && latitude>=Number(south)
    && longitude<=Number(east) && longitude>=Number(west);
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

// Two bubbles within this many degrees of each other would overlap on screen.
// Roughly 300m at these latitudes -- deliberately generous, because a bubble
// covering another bubble is worse than one fewer bubble.
export const COLLISION_DEGREES=0.003;

function collides(candidate,chosen){
  return chosen.some((other)=>
    Math.abs(Number(candidate.latitude)-Number(other.latitude))<COLLISION_DEGREES &&
    Math.abs(Number(candidate.longitude)-Number(other.longitude))<COLLISION_DEGREES
  );
}

// ---------------------------------------------------------------------------
// The controller
// ---------------------------------------------------------------------------

// `tick` advances once per BUBBLE_MS. Passing it in rather than reading a clock
// is what makes the rotation testable: the same tick always produces the same
// bubbles.
export function bubblesAt(candidates,{tick=0,viewport=null,limit=MAX_AUTOMATIC_BUBBLES,selectedKey=null}={}){
  const eligible=(candidates || [])
    .filter((candidate)=>candidate && candidate.key)
    .filter((candidate)=>inViewport(candidate,viewport))
    // A selected bubble is not part of the automatic rotation. It stays open
    // because somebody opened it, and it must not use up one of the three.
    .filter((candidate)=>candidate.key!==selectedKey);

  if(!eligible.length) return [];

  // Stable order: priority, then key. Without the key the order of two equal
  // candidates depends on the order rows arrived, and the rotation would jitter
  // whenever a query came back in a different sequence.
  const ordered=[...eligible].sort((a,b)=>{
    const byPriority=bubblePriority(a.kind)-bubblePriority(b.kind);
    if(byPriority!==0) return byPriority;
    return String(a.key).localeCompare(String(b.key));
  });

  // Rotate the whole list by the tick, so everything gets a turn rather than
  // the top three being the only things anybody ever sees.
  const offset=ordered.length ? (tick % ordered.length) : 0;
  const rotated=[...ordered.slice(offset),...ordered.slice(0,offset)];

  const chosen=[];
  for(const candidate of rotated){
    if(chosen.length>=limit) break;
    if(collides(candidate,chosen)) continue;
    chosen.push(candidate);
  }

  return chosen;
}
