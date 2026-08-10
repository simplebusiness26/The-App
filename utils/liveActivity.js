// Packet 8f1: the shared activity read model, and the time windows.
//
// THE GAP THIS CLOSES, in CLAUDE.md's words: "the 'live' data (check-ins,
// Link-ups, event state) lives on a separate /live screen and never reaches the
// main map, which still only renders static business/property/club pins. That
// contradicts the core promise and is the highest-priority fix."
//
// The read model was already there. `get_live_discovery` has returned
// Link-ups, check-ins, events and club sessions in one uniform shape since
// 20260802211700 -- item_type, position, start, end, status and a deep link.
// Nothing needed to be built in the database. What was missing is this file and
// the map calling it: a normaliser that turns those rows into something a pin
// can be, and the three time windows the product asks for.
//
// So there is deliberately no new RPC and no migration in this packet. Adding a
// second read model for data the first one already returns is exactly the
// "second table for the same noun" that RULES.md warns about, one layer up.
//
// Everything here is pure. No database, no clock except the one passed in --
// a time filter whose behaviour depends on the wall clock is a time filter that
// cannot be tested.

// `place` rows are businesses with reviews. The map already draws every
// business as a static pin, so letting them through would put a second pin on
// top of the first and call the duplicate "live". Dropped here, once, rather
// than filtered at each call site.
const STATIC_KINDS=new Set(["place"]);

export const ACTIVITY_KINDS={
  LINKUP:"linkup",
  CHECKIN:"checkin",
  EVENT:"event",
  ACTIVITY:"activity"
};

// How close to starting counts as "starting soon". CLAUDE.md describes events
// moving through upcoming, starting soon, live, busy, finished; this is the
// boundary between the first two.
const SOON_MINUTES=90;

export const ACTIVITY_STATES={
  LIVE:"live",
  SOON:"soon",
  SCHEDULED:"scheduled"
};

// The sentence each state gets. Colour is never the only carrier of meaning
// (design-system.md, accessibility floor), and these are also what a screen
// reader reads out.
export const ACTIVITY_STATE_SENTENCE={
  [ACTIVITY_STATES.LIVE]:"Happening now.",
  [ACTIVITY_STATES.SOON]:"Starting soon.",
  [ACTIVITY_STATES.SCHEDULED]:"Scheduled here."
};

export const TIME_WINDOWS=[
  {key:"now",label:"Now"},
  {key:"tonight",label:"Tonight"},
  {key:"weekend",label:"Weekend"}
];

export const DEFAULT_TIME_WINDOW="now";

function time(value){
  if(!value) return null;
  const parsed=new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

// Number(null) is 0 and Number.isFinite(0) is true, so the obvious version of
// this accepts a null coordinate and plots it off the coast of Africa. Packet
// 8b hit the same thing on Memories.
function coordinate(value){
  if(value===null || value===undefined || value==="") return null;
  const parsed=Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function activityState(item,now=Date.now()){
  const startsAt=time(item?.startsAt ?? item?.starts_at);
  const endsAt=time(item?.endsAt ?? item?.ends_at);

  // Already started and not yet finished. A check-in is the clearest case:
  // it exists only while it is live.
  if(startsAt!==null && startsAt<=now && (endsAt===null || endsAt>now)) return ACTIVITY_STATES.LIVE;
  if(startsAt!==null && startsAt>now && startsAt-now<=SOON_MINUTES*60*1000) return ACTIVITY_STATES.SOON;
  return ACTIVITY_STATES.SCHEDULED;
}

// The three windows, as explicit ranges rather than as predicates, so a test can
// assert the boundary rather than the answer.
//
// Tonight runs to 4am because a night out does not end at midnight, and a
// Link-up at 1am on Saturday belongs to Friday night in every way except the
// date. Weekend is the coming Saturday and Sunday, and during the weekend it is
// the rest of it rather than the next one.
export function windowRange(key,now=Date.now()){
  const start=new Date(now);

  if(key==="tonight"){
    const from=new Date(start);
    from.setHours(17,0,0,0);
    const to=new Date(start);
    to.setDate(to.getDate()+1);
    to.setHours(4,0,0,0);

    // After 4am but before 5pm, "tonight" is still tonight. Between midnight
    // and 4am it is the night already in progress, so the window started
    // yesterday evening.
    if(start.getHours()<4){
      from.setDate(from.getDate()-1);
      to.setDate(to.getDate()-1);
    }

    return {from:Math.max(from.getTime(),now),to:to.getTime()};
  }

  if(key==="weekend"){
    const from=new Date(start);
    const day=from.getDay();               // 0 Sunday … 6 Saturday
    const untilSaturday=(6-day+7)%7;

    from.setDate(from.getDate()+untilSaturday);
    from.setHours(0,0,0,0);

    const to=new Date(from);
    // Saturday 00:00 → Monday 00:00 covers both days.
    to.setDate(to.getDate()+2);
    to.setHours(0,0,0,0);

    // Mid-weekend, the window is what is left of it, not the next one.
    if(day===6 || day===0){
      const thisSaturday=new Date(start);
      thisSaturday.setDate(thisSaturday.getDate()-(day===0 ? 1 : 0));
      thisSaturday.setHours(0,0,0,0);
      const thisEnd=new Date(thisSaturday);
      thisEnd.setDate(thisEnd.getDate()+2);
      return {from:now,to:thisEnd.getTime()};
    }

    return {from:from.getTime(),to:to.getTime()};
  }

  // "Now" is what a person could walk into this minute, not a forecast.
  return {from:now,to:now};
}

// An item belongs to a window when its own interval overlaps the window's.
// Overlap rather than containment: an all-day event is happening tonight even
// though it did not start tonight, and a Link-up that runs past 4am is still a
// tonight Link-up.
export function inWindow(item,key,now=Date.now()){
  const {from,to}=windowRange(key,now);
  const startsAt=time(item?.startsAt ?? item?.starts_at);
  const endsAt=time(item?.endsAt ?? item?.ends_at) ?? startsAt;

  if(startsAt===null) return false;

  if(key==="now") return startsAt<=now && (endsAt===null || endsAt>now);

  return startsAt<=to && (endsAt===null || endsAt>=from);
}

// One live row from get_live_discovery, as something a pin and a card can both
// read. Returns null for anything unusable, so a caller filters once.
export function toActivity(row,now=Date.now()){
  if(!row || STATIC_KINDS.has(row.item_type)) return null;

  const latitude=coordinate(row.latitude);
  const longitude=coordinate(row.longitude);

  // A pin needs a position. An activity without one is real and belongs on the
  // /live list; it just cannot be drawn, so the map drops it rather than
  // inventing a location.
  if(latitude===null || longitude===null) return null;

  const activity={
    key:`${row.item_type}-${row.item_id}`,
    kind:row.item_type,
    id:row.item_id,
    title:row.title || "Something is happening",
    subtitle:row.subtitle || "",
    area:row.area || "",
    latitude,
    longitude,
    startsAt:row.starts_at || null,
    endsAt:row.ends_at || null,
    imageUrl:row.image_url || null,
    deepLink:row.deep_link || null,
    actionLabel:row.action_label || null
  };

  activity.state=activityState(activity,now);
  return activity;
}

export function toActivities(rows,now=Date.now()){
  return (rows || []).map((row)=>toActivity(row,now)).filter(Boolean);
}

export function activitiesInWindow(activities,key,now=Date.now()){
  return (activities || []).filter((activity)=>inWindow(activity,key,now));
}
