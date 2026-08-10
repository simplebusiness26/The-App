/* eslint-env jest */

// Packet 8f2: the trending formula and source reasons.
//
// The owner's instruction was that the formula be defined before any trending
// code is written, with eight named inputs. Each one is asserted here on its
// own, because a ranking you cannot argue with one factor at a time is a
// ranking nobody will ever change.
//
// Every clock is injected. A recency test that reads the wall clock passes
// today and fails tomorrow.

const {
  SOURCE_REASONS,
  cappedContributions,
  distinctPeopleScore,
  isModerationClear,
  isPublicOnly,
  orderReasons,
  passesAntiSpam,
  proximityScore,
  rankTrending,
  reasonsFor,
  recencyScore,
  trendingScore,
  velocityScore
}=require("../utils/trending");

const NOW=new Date(2026,7,12,14,0,0).getTime();
const HOUR=3600000;

function place(overrides={}){
  return{
    id:"p1",
    distinct_posters:4,
    distinct_engagers:6,
    engagements:12,
    per_poster_counts:[1,1,1,1],
    distance_km:1,
    last_activity_at:new Date(NOW-HOUR).toISOString(),
    visibility:"public",
    status:"open",
    open_report_count:0,
    ...overrides
  };
}

describe("recency",()=>{
  test("halves every six hours",()=>{
    expect(recencyScore(0)).toBeCloseTo(1);
    expect(recencyScore(6)).toBeCloseTo(0.5);
    expect(recencyScore(12)).toBeCloseTo(0.25);
  });

  test("decays rather than falling off a cliff",()=>{
    // Nothing should vanish at a boundary; five and seven hours old are
    // different but neighbouring.
    expect(recencyScore(5)).toBeGreaterThan(recencyScore(7));
    expect(recencyScore(7)).toBeGreaterThan(0);
  });
});

describe("engagement velocity, not engagement",()=>{
  test("the same engagement counts for less as it ages",()=>{
    expect(velocityScore(20,1)).toBeGreaterThan(velocityScore(20,10));
  });

  test("twenty likes in an hour beats a hundred over a fortnight",()=>{
    expect(velocityScore(20,1)).toBeGreaterThan(velocityScore(100,336));
  });
});

describe("distinct people are the anti-gaming heart",()=>{
  test("more distinct people scores higher",()=>{
    expect(distinctPeopleScore(10,10)).toBeGreaterThan(distinctPeopleScore(2,2));
  });

  test("each additional person adds less than the last",()=>{
    const second=distinctPeopleScore(2,0)-distinctPeopleScore(1,0);
    const tenth=distinctPeopleScore(10,0)-distinctPeopleScore(9,0);
    expect(second).toBeGreaterThan(tenth);
  });
});

describe("geographic relevance",()=>{
  test("closer is better and distance cannot be outrun",()=>{
    expect(proximityScore(0)).toBeCloseTo(1);
    expect(proximityScore(4)).toBeCloseTo(0.5);
    expect(proximityScore(40)).toBeLessThan(0.01);
  });

  test("unknown distance is neutral, never treated as near",()=>{
    // Guessing "close" would float anything with a missing coordinate to the
    // top, which is exactly what a spammer with no location would want.
    expect(proximityScore(null)).toBe(0.5);
    expect(proximityScore(undefined)).toBe(0.5);
    expect(proximityScore("nonsense")).toBe(0.5);
    expect(proximityScore(null)).toBeLessThan(proximityScore(0));
  });

  test("being in the wrong town cannot be compensated for",()=>{
    const near=trendingScore(place({distance_km:0.5}),NOW);
    const far=trendingScore(place({distance_km:60,distinct_posters:50,distinct_engagers:500,engagements:5000}),NOW);
    expect(near).toBeGreaterThan(far);
  });
});

describe("moderation is a gate, not a weight",()=>{
  test("reported or hidden content cannot trend at any volume",()=>{
    expect(isModerationClear(place({open_report_count:1}))).toBe(false);
    expect(isModerationClear(place({status:"removed"}))).toBe(false);
    expect(isModerationClear(place({status:"cancelled"}))).toBe(false);

    const reported=place({open_report_count:1,distinct_posters:99,distinct_engagers:999,engagements:9999});
    expect(trendingScore(reported,NOW)).toBe(0);
  });

  test("clean content passes",()=>{
    expect(isModerationClear(place())).toBe(true);
  });
});

describe("anti-spam",()=>{
  test("one person cannot make a place trend",()=>{
    expect(passesAntiSpam(place({distinct_posters:1}))).toBe(false);
    expect(trendingScore(place({distinct_posters:1,per_poster_counts:[40]}),NOW)).toBe(0);
  });

  test("one account's repeat posting is capped, not compounded",()=>{
    expect(cappedContributions([40])).toBe(3);
    expect(cappedContributions([1,1,1,1])).toBe(4);
    // Ten people once each beats one person forty times.
    expect(cappedContributions([1,1,1,1,1,1,1,1,1,1])).toBeGreaterThan(cappedContributions([40]));
  });

  test("ten people once each outranks one person posting constantly",()=>{
    const crowd=place({distinct_posters:10,distinct_engagers:10,engagements:0,per_poster_counts:Array(10).fill(1)});
    const shouter=place({id:"p2",distinct_posters:2,distinct_engagers:0,engagements:0,per_poster_counts:[40,1]});
    expect(trendingScore(crowd,NOW)).toBeGreaterThan(trendingScore(shouter,NOW));
  });
});

describe("public content only",()=>{
  test("private and friends-only content never influences trending",()=>{
    expect(isPublicOnly({visibility:"friends"})).toBe(false);
    expect(isPublicOnly({visibility:"private"})).toBe(false);
    expect(isPublicOnly({visibility:"selected"})).toBe(false);

    // Even in aggregate: a count is still a disclosure if it only moves when
    // one person posts something they marked private.
    expect(trendingScore(place({visibility:"friends"}),NOW)).toBe(0);
  });

  test("public content, and content with no visibility concept, is eligible",()=>{
    expect(isPublicOnly({visibility:"public"})).toBe(true);
    expect(isPublicOnly({})).toBe(true);
  });
});

describe("ranking",()=>{
  test("nothing that fails a gate appears at all",()=>{
    const ranked=rankTrending([
      place({id:"ok"}),
      place({id:"reported",open_report_count:2}),
      place({id:"private",visibility:"private"}),
      place({id:"solo",distinct_posters:1})
    ],NOW);

    expect(ranked.map(p=>p.id)).toEqual(["ok"]);
  });

  test("recent local activity from many people wins",()=>{
    const ranked=rankTrending([
      place({id:"stale",last_activity_at:new Date(NOW-72*HOUR).toISOString()}),
      place({id:"hot",last_activity_at:new Date(NOW-0.5*HOUR).toISOString(),distinct_posters:8,distinct_engagers:20}),
      place({id:"faraway",distance_km:30})
    ],NOW);

    expect(ranked[0].id).toBe("hot");
    expect(ranked[ranked.length-1].id).toBe("faraway");
  });

  test("the order is stable rather than whatever the database returned",()=>{
    const a=place({id:"aaa"});
    const b=place({id:"bbb"});
    expect(rankTrending([a,b],NOW).map(p=>p.id)).toEqual(rankTrending([b,a],NOW).map(p=>p.id));
  });
});

describe("source reasons are a list, not one lossy label",()=>{
  test("several reasons survive together",()=>{
    const reasons=reasonsFor({source_reasons:[SOURCE_REASONS.FOLLOWED_PLACE,SOURCE_REASONS.FOLLOWED_EXPLORER]});
    // Collapsing this to one would throw away the more interesting half.
    expect(reasons).toHaveLength(2);
  });

  test("duplicates are removed",()=>{
    expect(orderReasons([SOURCE_REASONS.FOLLOWED_EXPLORER,SOURCE_REASONS.FOLLOWED_EXPLORER])).toEqual([SOURCE_REASONS.FOLLOWED_EXPLORER]);
  });

  test("the most specific reason comes first",()=>{
    const reasons=orderReasons([
      SOURCE_REASONS.TRENDING_NEARBY,
      SOURCE_REASONS.FOLLOWED_AREA,
      SOURCE_REASONS.OWN
    ]);
    expect(reasons[0]).toBe(SOURCE_REASONS.OWN);
    expect(reasons[reasons.length-1]).toBe(SOURCE_REASONS.TRENDING_NEARBY);
  });

  test("a row without reasons is tolerated rather than invented",()=>{
    // Until the 8f2 migration is applied the RPC returns no reasons at all. The
    // feed must show none rather than break or guess.
    expect(reasonsFor({})).toEqual([]);
    expect(reasonsFor(null)).toEqual([]);
  });
});
