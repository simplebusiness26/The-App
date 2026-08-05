// Packet 7 of docs/REDESIGN-BRIEF.md: the Discover screen.
//
// The rule the whole packet turns on:
//
//   "Every recommendation must carry a visible reason string. If the reason
//    cannot be computed, the item does not appear."
//
// So the reason is not a label added to a card after the fact. It is the
// admission ticket, and this module is where it is issued. `reasonFor` returns
// a sentence or null, and `recommend` drops everything that got null.
//
// That ordering matters: a reason computed after selection ends up being
// written to justify whatever was already on screen, which is how "Recommended
// for you" comes to mean "we had this row handy".
//
// Every reason below is derived from something the database actually holds --
// a distance, an area, a start time, a saved row. None is invented, and none
// says "popular" or "trending", because nothing in this app measures either.

const MINUTE=60*1000;
const HOUR=60*MINUTE;

// Ordered. The first reason that can be computed is the one shown, so the most
// specific thing known about an item wins over the vaguest.
export const REASON_KINDS=[
  "saved",
  "happening",
  "starting",
  "near",
  "area"
];

export function reasonFor(item,context={}){
  if(!item) return null;

  const now=Number.isFinite(context.now) ? context.now : Date.now();

  // 1. You said so. Nothing beats an explicit signal from the person.
  if(item.saved) return "You saved this";

  // 2. It is on right now, and the data says so rather than the copy.
  if(isLive(item,now)) return "On now";

  // 3. It starts soon enough to walk to.
  const startsIn=startsInMs(item,now);
  if(startsIn!==null && startsIn>0 && startsIn<=6*HOUR) return `Starts ${relative(startsIn)}`;

  // 4. It is measurably close.
  const distance=Number(item.distance_km);
  if(Number.isFinite(distance) && distance>=0) return `${formatDistance(distance)} from you`;

  // 5. It is in the area the Explorer says they are in.
  const area=String(item.area || "").trim();
  const viewerArea=String(context.area || "").trim();
  if(area && viewerArea && area.toLowerCase()===viewerArea.toLowerCase()) return `In ${area}`;

  // Nothing true could be said about why this is here, so it is not.
  return null;
}

function isLive(item,now){
  const starts=time(item.starts_at);
  const ends=time(item.ends_at);
  if(starts===null) return false;
  if(starts>now) return false;
  if(ends!==null && ends<=now) return false;
  return true;
}

function startsInMs(item,now){
  const starts=time(item.starts_at);
  return starts===null ? null : starts-now;
}

function time(value){
  if(!value) return null;
  const parsed=new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function relative(ms){
  const minutes=Math.round(ms/MINUTE);
  if(minutes<1) return "in under a minute";
  if(minutes<60) return `in ${minutes} minute${minutes===1 ? "" : "s"}`;
  const hours=Math.round(minutes/60);
  return `in ${hours} hour${hours===1 ? "" : "s"}`;
}

function formatDistance(km){
  if(km<1) return `${Math.max(50,Math.round(km*1000/50)*50)} m`;
  return `${km.toFixed(1)} km`;
}

// The gate. Items without a reason are dropped rather than shown with a blank
// line where the reason should be.
export function recommend(items,context={}){
  return (items || [])
    .map((item)=>{
      const reason=reasonFor(item,context);
      return reason ? {...item,reason} : null;
    })
    .filter(Boolean);
}

// Every section, and what it says when it has nothing. design-system.md:
// "Empty states are instructions, not moods." Each of these tells a person what
// to do next rather than reporting an absence.
export const SECTIONS=[
  {
    key:"for-you",
    title:"For you",
    empty:"Save a place or set your area in Settings, and this fills up."
  },
  {
    key:"happening-now",
    title:"Happening now",
    empty:"Nothing is running near you right now. Check in somewhere and you will be the first thing here."
  },
  {
    key:"events",
    title:"Events",
    empty:"No events are coming up nearby. Add one from Create if you are running something."
  },
  {
    key:"clubs",
    title:"Clubs",
    empty:"No clubs have sessions coming up. Start one from Create."
  },
  {
    key:"linkups",
    title:"Link-ups",
    empty:"Nobody has opened a Link-up near you. Start one and see who comes."
  },
  {
    key:"saved",
    title:"Saved",
    empty:"Tap the heart on any place to keep it here."
  }
];
