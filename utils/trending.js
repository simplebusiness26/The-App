// Packet 8f2: what is trending, and why something is in your feed.
//
// THE FORMULA IS THE DELIVERABLE. The owner's instruction was that a trending
// formula be *defined* before any trending code is written, and named eight
// inputs: recency, engagement velocity, distinct posters, distinct engagers,
// geographic relevance, moderation signals, anti-spam, and public content only.
// All eight are here, each as its own named function, so a weight can be argued
// with by looking at one thing.
//
// WHY IT IS A PURE MODULE AND NOT A QUERY. Ranking that lives inside SQL can
// only be changed by a migration, and can only be checked by running it against
// production. This takes rows and returns an order, so every rule below has a
// test that fails when the rule changes.
//
// WHAT TRENDING IS FOR, and what it must not become. CLAUDE.md's success metric
// is completed local experiences, not browsing. So this ranks *places worth
// going to*, and every factor is a fact about real people doing real things --
// how many different Explorers, how recently, how close. There is deliberately
// no factor for "how much engagement it got" on its own, because that rewards
// posting, and no factor a manager can buy.

// ---------------------------------------------------------------------------
// The eight factors
// ---------------------------------------------------------------------------

// 1. RECENCY. A half-life rather than a cliff: something two hours old should
//    outrank something ten hours old, without anything vanishing at a boundary.
const RECENCY_HALF_LIFE_HOURS=6;

export function recencyScore(ageHours){
  if(!Number.isFinite(ageHours) || ageHours<0) return 0;
  return Math.pow(0.5,ageHours/RECENCY_HALF_LIFE_HOURS);
}

// 2. ENGAGEMENT VELOCITY, not engagement. Twenty likes in an hour is a
//    different signal from twenty likes over a fortnight, and only the first
//    means "something is happening there now". Divided by age so an old popular
//    place cannot sit at the top forever.
export function velocityScore(engagements,ageHours){
  const safeAge=Math.max(Number(ageHours) || 0,0.5);
  return (Number(engagements) || 0)/safeAge;
}

// 3. DISTINCT POSTERS and 4. DISTINCT ENGAGERS. The anti-gaming heart of this.
//    One person posting ten times about their own bar is one person; ten people
//    posting once each is a place worth walking to. Both use a square root so
//    the tenth distinct person adds less than the second, and neither can be
//    manufactured by volume from a single account.
export function distinctPeopleScore(distinctPosters,distinctEngagers){
  return Math.sqrt(Math.max(Number(distinctPosters) || 0,0))
       + Math.sqrt(Math.max(Number(distinctEngagers) || 0,0));
}

// 5. GEOGRAPHIC RELEVANCE. Trending in another town is not trending. Decays with
//    distance and is *multiplicative*, so nothing far away can win on engagement
//    alone. Unknown distance is treated as neutral rather than near -- guessing
//    "close" would let anything with a missing coordinate to the top.
const DISTANCE_HALF_LIFE_KM=4;

export function proximityScore(distanceKm){
  if(distanceKm===null || distanceKm===undefined) return 0.5;
  const km=Number(distanceKm);
  if(!Number.isFinite(km) || km<0) return 0.5;
  return Math.pow(0.5,km/DISTANCE_HALF_LIFE_KM);
}

// 6. MODERATION SIGNALS. A reported or hidden thing is not "trending", it is a
//    problem. This is a gate, not a weight -- no amount of engagement should be
//    able to outvote it.
export function isModerationClear(item){
  if(item?.status==="removed" || item?.status==="hidden" || item?.status==="cancelled") return false;
  if(item?.hidden===true || item?.removed===true) return false;
  return (Number(item?.open_report_count) || 0)===0;
}

// 7. ANTI-SPAM. Two rules, both about people rather than content:
//    a place needs more than one distinct poster before it can trend at all,
//    and one account's repeated posting is capped rather than compounded.
const MINIMUM_DISTINCT_POSTERS=2;
const MAX_COUNTED_PER_POSTER=3;

export function passesAntiSpam(place){
  return (Number(place?.distinct_posters) || 0)>=MINIMUM_DISTINCT_POSTERS;
}

export function cappedContributions(perPosterCounts){
  return (perPosterCounts || []).reduce(
    (total,count)=>total+Math.min(Number(count) || 0,MAX_COUNTED_PER_POSTER),
    0
  );
}

// 8. PUBLIC CONTENT ONLY. Trending is a public surface. A friends-only Moment or
//    a private Memory must never be able to influence it, even in aggregate --
//    a count is still a disclosure if it only moves when one person posts.
export function isPublicOnly(item){
  const visibility=item?.visibility;
  return visibility===undefined || visibility===null || visibility==="public";
}

// ---------------------------------------------------------------------------
// Putting them together
// ---------------------------------------------------------------------------
//
// Gates first, then a score. The multiplication by proximity is deliberate:
// every other factor is additive and can compensate for a weak one, but being
// in the wrong town cannot be compensated for.

export function trendingScore(place,now=Date.now()){
  if(!place) return 0;
  if(!isModerationClear(place)) return 0;
  if(!isPublicOnly(place)) return 0;
  if(!passesAntiSpam(place)) return 0;

  const ageHours=Math.max((now-new Date(place.last_activity_at || place.created_at || now).getTime())/3600000,0);

  const signal=
    recencyScore(ageHours)*2
    + velocityScore(cappedContributions(place.per_poster_counts) + (Number(place.engagements) || 0),ageHours)
    + distinctPeopleScore(place.distinct_posters,place.distinct_engagers);

  return signal*proximityScore(place.distance_km);
}

export function rankTrending(places,now=Date.now(),limit=10){
  return (places || [])
    .map((place)=>({place,score:trendingScore(place,now)}))
    .filter((entry)=>entry.score>0)
    // Ties break on distinct posters, then on id, so the order is stable rather
    // than whatever the database happened to return.
    .sort((a,b)=>
      b.score-a.score
      || (Number(b.place.distinct_posters) || 0)-(Number(a.place.distinct_posters) || 0)
      || String(a.place.id || "").localeCompare(String(b.place.id || ""))
    )
    .slice(0,limit)
    .map((entry)=>entry.place);
}

// ---------------------------------------------------------------------------
// Source reasons
// ---------------------------------------------------------------------------
//
// "Why am I seeing this?" answered as a LIST, not one lossy label -- the owner
// was explicit. A Moment can be in your feed because you follow the poster AND
// because it is at a place you follow; collapsing that to one reason throws away
// the more interesting half.
//
// Deduplicated and ordered most-specific first, so the first reason is the most
// informative one rather than whichever was computed first.

export const SOURCE_REASONS={
  OWN:"Yours",
  FOLLOWED_EXPLORER:"You follow this Explorer",
  FOLLOWED_PLACE:"You follow this place",
  FOLLOWED_AREA:"In an area you follow",
  ATTENDING:"You are going to this",
  TRENDING_NEARBY:"Trending near you"
};

const REASON_ORDER=[
  SOURCE_REASONS.OWN,
  SOURCE_REASONS.ATTENDING,
  SOURCE_REASONS.FOLLOWED_EXPLORER,
  SOURCE_REASONS.FOLLOWED_PLACE,
  SOURCE_REASONS.FOLLOWED_AREA,
  SOURCE_REASONS.TRENDING_NEARBY
];

export function orderReasons(reasons){
  const unique=[...new Set((reasons || []).filter(Boolean))];
  return unique.sort((a,b)=>{
    const left=REASON_ORDER.indexOf(a);
    const right=REASON_ORDER.indexOf(b);
    return (left===-1 ? REASON_ORDER.length : left)-(right===-1 ? REASON_ORDER.length : right);
  });
}

// The database is the only thing that knows the viewer's follow graph without
// shipping it to the client, so `source_reasons` arrives on the row. This
// tolerates its absence: until the 8f2 migration is applied the feed simply
// shows no reasons, rather than breaking or inventing one.
export function reasonsFor(item){
  return orderReasons(item?.source_reasons);
}
