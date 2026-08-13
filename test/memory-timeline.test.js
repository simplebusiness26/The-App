/* eslint-env jest */

// The Memories map, moving through time.
//
// The assertion this file exists for is the last one: FADING IS NOT DELETING.
// A rule that dims a Memory off the map is one careless step from a rule that
// expires it, and a Memory is permanent scrapbook content -- it stops being
// drawn on one particular view and stays exactly as it was everywhere else.
//
// Everything else here is arithmetic, which is why the fade is a pure function
// with the clock passed in: "moving backwards reveals older Memories" is
// otherwise a thing you can only check by looking at it.

const timeline=require("../utils/memoryTimeline");

const DAY=timeline.DAY_MS;
const NOW=Date.parse("2026-08-13T12:00:00Z");

function memory(id,daysAgo){
  return {id,created_at:new Date(NOW-daysAgo*DAY).toISOString(),latitude:50.85,longitude:0.57};
}

// ---------------------------------------------------------------------------
// The ten-day window
// ---------------------------------------------------------------------------

test("a Memory at the slider's date is at full strength",()=>{
  expect(timeline.memoryProminence(memory(1,0),NOW)).toBe(1);
});

test("it stays at full strength across the middle of the window",()=>{
  // Ten days wide, two days of fade at each edge, so three days either side of
  // the slider is still full.
  expect(timeline.memoryProminence(memory(1,3),NOW)).toBe(1);
  expect(timeline.memoryProminence(memory(1,-3),NOW)).toBe(1);
});

test("it fades approaching the edge rather than snapping out",()=>{
  const atFour=timeline.memoryProminence(memory(1,4),NOW);
  const atFourAndAHalf=timeline.memoryProminence(memory(1,4.5),NOW);

  expect(atFour).toBeLessThan(1);
  expect(atFour).toBeGreaterThan(0);
  // Further from the slider is fainter. Monotonic, so it reads as movement
  // rather than flicker.
  expect(atFourAndAHalf).toBeLessThan(atFour);
});

test("it dims rather than vanishing while it is still inside the window",()=>{
  // A dense area should still read as dense at the edges of the window.
  expect(timeline.memoryProminence(memory(1,4.99),NOW))
    .toBeGreaterThanOrEqual(timeline.MIN_VISIBLE_OPACITY);
});

test("outside the window it is not drawn",()=>{
  expect(timeline.memoryProminence(memory(1,6),NOW)).toBe(0);
  expect(timeline.memoryProminence(memory(1,400),NOW)).toBe(0);
});

test("the fade is deterministic -- the same date and slider always agree",()=>{
  const subject=memory(1,4);
  const once=timeline.memoryProminence(subject,NOW);
  const twice=timeline.memoryProminence(subject,NOW);
  expect(once).toBe(twice);
});

test("a Memory with no usable date is simply not drawn, and does not throw",()=>{
  expect(timeline.memoryProminence({created_at:null},NOW)).toBe(0);
  expect(timeline.memoryProminence({created_at:"not a date"},NOW)).toBe(0);
  expect(timeline.memoryProminence(null,NOW)).toBe(0);
  expect(timeline.memoryProminence(memory(1,0),"nonsense")).toBe(0);
});

// ---------------------------------------------------------------------------
// Moving backwards
// ---------------------------------------------------------------------------

test("moving the slider backwards reveals older Memories and lets go of newer ones",()=>{
  const memories=[memory("today",0),memory("lastWeek",8),memory("lastMonth",30)];

  const nowShows=timeline.memoriesAt(memories,NOW).map((e)=>e.memory.id);
  expect(nowShows).toContain("today");
  expect(nowShows).not.toContain("lastWeek");
  expect(nowShows).not.toContain("lastMonth");

  const weekAgo=timeline.memoriesAt(memories,NOW-8*DAY).map((e)=>e.memory.id);
  expect(weekAgo).toContain("lastWeek");
  expect(weekAgo).not.toContain("today");

  const monthAgo=timeline.memoriesAt(memories,NOW-30*DAY).map((e)=>e.memory.id);
  expect(monthAgo).toEqual(["lastMonth"]);
});

test("what is shown comes back newest first, so the recent one draws on top",()=>{
  const memories=[memory("older",2),memory("newer",0),memory("middle",1)];
  expect(timeline.memoriesAt(memories,NOW).map((e)=>e.memory.id))
    .toEqual(["newer","middle","older"]);
});

// ---------------------------------------------------------------------------
// The slider's range
// ---------------------------------------------------------------------------

test("the range reaches the oldest Memory, whenever that was",()=>{
  // An Explorer with one Memory from last year needs the handle to get to it --
  // a fixed number of days would run off the end of their history.
  const memories=[memory("old",400),memory("new",1)];
  const range=timeline.timelineRange(memories,NOW);

  expect(range.empty).toBe(false);
  // With headroom, so the oldest can reach full strength rather than sitting
  // permanently half-faded at the very edge.
  expect(range.from).toBeLessThan(NOW-400*DAY);
  expect(timeline.memoryProminence(memories[0],range.from+timeline.WINDOW_HALF_MS)).toBe(1);
});

test("no Memories is an empty range rather than a broken one",()=>{
  const range=timeline.timelineRange([],NOW);
  expect(range.empty).toBe(true);
  expect(timeline.positionOf(NOW,range)).toBe(1);
});

test("position and time are inverses of each other",()=>{
  const range=timeline.timelineRange([memory("a",30),memory("b",0)],NOW);

  for(const position of [0,0.25,0.5,0.75,1]){
    const at=timeline.timeAtPosition(position,range);
    expect(timeline.positionOf(at,range)).toBeCloseTo(position,6);
  }
});

test("a position outside 0..1 is clamped rather than running off the timeline",()=>{
  const range=timeline.timelineRange([memory("a",30),memory("b",0)],NOW);
  expect(timeline.timeAtPosition(-5,range)).toBe(range.from);
  expect(timeline.timeAtPosition(9,range)).toBe(range.to);
});

// ---------------------------------------------------------------------------
// THE ONE THAT MATTERS
// ---------------------------------------------------------------------------

test("fading is presentation only -- nothing here expires, hides or deletes",()=>{
  const fs=require("fs");
  const path=require("path");
  const source=fs.readFileSync(
    path.join(__dirname,"..","utils","memoryTimeline.js"),"utf8"
  );
  const code=source.split("\n").filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

  // No writes of any kind. A file that decides what is DRAWN must never be able
  // to change what EXISTS.
  expect(code).not.toMatch(/supabase|\.delete\(|\.update\(|\.insert\(|rpc\(/);
  expect(code).not.toMatch(/expires_at|map_until|status/);

  // And the object handed back is the caller's own row, unmodified.
  const subject=memory("keep",0);
  const before=JSON.stringify(subject);
  timeline.memoriesAt([subject],NOW);
  timeline.memoryProminence(subject,NOW-400*DAY);
  expect(JSON.stringify(subject)).toBe(before);
});

test("a Memory faded to zero is still a Memory the moment the slider returns",()=>{
  const subject=memory("swim",30);

  expect(timeline.memoryProminence(subject,NOW)).toBe(0);
  // Nothing happened to it. Move the slider back and it is exactly as it was.
  expect(timeline.memoryProminence(subject,NOW-30*DAY)).toBe(1);
});
