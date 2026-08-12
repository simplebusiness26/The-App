/* eslint-env jest */

// The Living Map's arithmetic, tested before the map exists.
//
// Four of the remaining jobs are map jobs and there is no map to draw them on
// until Packet 21. Building the renderer and the rules together is how the
// rules end up living inside a renderer and having to be written twice, once
// per platform. So the rules are here and Packet 21 draws them.

const {
  memoryPinOpacity,
  isOnMap,
  isOnMapAt,
  itemsOnMapAt,
  heatKey,
  heatCells,
  linkupLocationFrom,
  FADE_FRACTION,
  MIN_PIN_OPACITY,
  HEAT_PRECISION
}=require("../utils/mapLayers");

const DAY=1000*60*60*24;
const START=Date.parse("2026-08-01T00:00:00Z");

function memory(days,overrides={}){
  return{
    created_at:new Date(START).toISOString(),
    map_until:new Date(START+days*DAY).toISOString(),
    ...overrides
  };
}

describe("a Memory pin fades before it goes",()=>{
  it("is full strength for most of its window",()=>{
    const kept=memory(8);
    expect(memoryPinOpacity(kept,START)).toBe(1);
    expect(memoryPinOpacity(kept,START+5*DAY)).toBe(1);
    // Fading starts at three quarters through: day 6 of 8.
    expect(memoryPinOpacity(kept,START+6*DAY)).toBe(1);
  });

  it("fades across the last quarter, never to nothing",()=>{
    const kept=memory(8);
    const halfWayThroughFade=memoryPinOpacity(kept,START+7*DAY);

    expect(halfWayThroughFade).toBeLessThan(1);
    expect(halfWayThroughFade).toBeGreaterThan(MIN_PIN_OPACITY);

    // A pin at 4% is a pin nobody can tap, which is worse than one that is gone.
    const almostGone=memoryPinOpacity(kept,START+8*DAY-1000);
    expect(almostGone).toBeGreaterThanOrEqual(MIN_PIN_OPACITY);
  });

  it("scales the fade to the window rather than using a fixed duration",()=>{
    // A day-long Memory and a month-long one should be at the same point in
    // their fade at the same PROPORTION through, not the same number of hours.
    const short=memory(1);
    const long=memory(30);

    const threeQuarters=(days)=>START+days*(1-FADE_FRACTION)*DAY;
    expect(memoryPinOpacity(short,threeQuarters(1))).toBe(1);
    expect(memoryPinOpacity(long,threeQuarters(30))).toBe(1);

    const nearlyDone=(days)=>START+days*DAY-(days*DAY*FADE_FRACTION*0.1);
    expect(memoryPinOpacity(short,nearlyDone(1)))
      .toBeCloseTo(memoryPinOpacity(long,nearlyDone(30)),5);
  });

  it("is gone once the map window has passed, and only from the map",()=>{
    const kept=memory(8);
    expect(memoryPinOpacity(kept,START+9*DAY)).toBe(0);
    expect(isOnMap(kept,START+9*DAY)).toBe(false);
    // "A Memory leaving the current map is not a Memory being deleted."
    // Nothing here deletes, hides or changes the Memory itself.
  });

  it("never fades a Memory with no map window",()=>{
    expect(memoryPinOpacity({created_at:new Date(START).toISOString()},START+900*DAY)).toBe(1);
  });
});

describe("the time slider",()=>{
  const items=[
    {kind:"memory",created_at:"2026-08-01T00:00:00Z",map_until:"2026-08-08T00:00:00Z"},
    {kind:"moment",created_at:"2026-08-05T00:00:00Z",expires_at:"2026-08-06T00:00:00Z"},
    {kind:"review",created_at:"2026-07-01T00:00:00Z"}
  ];

  it("uses one rule for every kind of thing",()=>{
    // Four rules would disagree the first time somebody changed one.
    const at=Date.parse("2026-08-05T12:00:00Z");
    expect(itemsOnMapAt(items,at).map((item)=>item.kind).sort())
      .toEqual(["memory","moment","review"]);
  });

  it("leaves out what had not happened yet",()=>{
    const at=Date.parse("2026-07-15T00:00:00Z");
    expect(itemsOnMapAt(items,at).map((item)=>item.kind)).toEqual(["review"]);
  });

  it("leaves out what had already gone",()=>{
    const at=Date.parse("2026-08-09T00:00:00Z");
    expect(itemsOnMapAt(items,at).map((item)=>item.kind)).toEqual(["review"]);
  });

  it("keeps a thing that never leaves, for ever",()=>{
    expect(isOnMapAt({created_at:"2026-07-01T00:00:00Z"},Date.parse("2030-01-01T00:00:00Z"))).toBe(true);
  });

  it("refuses an unreadable instant rather than guessing",()=>{
    expect(isOnMapAt(items[0],"not a date")).toBe(false);
    expect(isOnMapAt(items[0],null)).toBe(false);
  });
});

describe("heat",()=>{
  function post(lat,lon,user,kind="moment"){
    return{latitude:lat,longitude:lon,user_id:user,kind};
  }

  it("grids coordinates to about a kilometre",()=>{
    expect(heatKey(50.8225,-0.1372)).toBe("50.82,-0.14");
    // Same cell, different bench.
    expect(heatKey(50.8231,-0.1375)).toBe(heatKey(50.8225,-0.1372));
    expect(HEAT_PRECISION).toBe(2);
  });

  it("refuses a row with no location instead of plotting it at 0,0",()=>{
    expect(heatKey(null,-0.13)).toBeNull();
    expect(heatKey("", "")).toBeNull();
  });

  it("will not draw a cell one person built",()=>{
    // A count is still a disclosure if it only moves when one person posts.
    const cells=heatCells([
      post(50.82,-0.13,"a"),post(50.82,-0.13,"a"),
      post(50.82,-0.13,"a"),post(50.82,-0.13,"a")
    ]);
    expect(cells).toEqual([]);
  });

  it("will not draw a cell with barely anything in it",()=>{
    expect(heatCells([post(50.82,-0.13,"a"),post(50.82,-0.13,"b")])).toEqual([]);
  });

  it("draws a cell several different Explorers built",()=>{
    const cells=heatCells([
      post(50.82,-0.13,"a"),post(50.82,-0.13,"b"),post(50.82,-0.13,"c")
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0].contributions).toBe(3);
    expect(cells[0].posterCount).toBe(3);
  });

  it("weights a review above a Memory above a Moment",()=>{
    const cells=heatCells([
      post(50.82,-0.13,"a","review"),
      post(50.82,-0.13,"b","memory"),
      post(50.82,-0.13,"c","moment")
    ]);
    expect(cells[0].weight).toBe(6);
  });

  it("hands back the busiest cell first",()=>{
    const cells=heatCells([
      post(50.82,-0.13,"a","review"),post(50.82,-0.13,"b","review"),post(50.82,-0.13,"c","review"),
      post(51.50,-0.12,"d"),post(51.50,-0.12,"e"),post(51.50,-0.12,"f")
    ]);
    expect(cells[0].weight).toBeGreaterThan(cells[1].weight);
  });

  it("never leaks who posted, only how many",()=>{
    const cells=heatCells([
      post(50.82,-0.13,"a"),post(50.82,-0.13,"b"),post(50.82,-0.13,"c")
    ]);
    expect(cells[0].posters).toBeUndefined();
    expect(JSON.stringify(cells)).not.toContain('"a"');
  });
});

describe("a Link-up dropped on the map",()=>{
  it("takes a place's exact position and name when dropped on a place",()=>{
    const at=linkupLocationFrom({
      kind:"place",type:"business",id:"b1",name:"The Pier Cafe",
      latitude:50.8225,longitude:-0.1372
    });

    expect(at.place_id).toBe("b1");
    expect(at.place_name).toBe("The Pier Cafe");
    expect(at.latitude).toBe(50.8225);
    expect(at.precise).toBe(true);
  });

  it("rounds an open-map point, because a meeting point is not a doorstep",()=>{
    const at=linkupLocationFrom({latitude:50.822531,longitude:-0.137244});

    expect(at.place_id).toBeNull();
    expect(at.place_name).toBeNull();
    expect(at.latitude).toBe(50.82);
    expect(at.longitude).toBe(-0.14);
    expect(at.precise).toBe(false);
  });

  it("returns nothing rather than a coordinate it did not get",()=>{
    expect(linkupLocationFrom({})).toBeNull();
    expect(linkupLocationFrom({latitude:null,longitude:null})).toBeNull();
    expect(linkupLocationFrom(null)).toBeNull();
  });
});
