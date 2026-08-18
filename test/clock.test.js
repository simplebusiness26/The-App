/* eslint-env jest */

// One answer to "what time is it".
//
// This formatter was written twice -- eventClock in app/events/index.js and
// sessionClock in app/activity-clubs/[id].js -- by two parallel rebuilds that
// each needed it and neither owned utils/. By the time they landed they had
// already drifted: one printed a weekday and the other did not, so the same
// instant read as "THU 20 AUG 19:30" on a club and "20 AUG 19:30" on an event.
//
// These tests exist to stop it splitting again.

const {shortClock,needsFullDate,RELATIVE_WINDOW_MS}=require("../utils/clock");

const NOON=new Date("2026-08-18T12:00:00Z").getTime();
const at=(iso)=>new Date(iso).getTime();

test("something happening now says so, and never counts down past zero",()=>{
  expect(shortClock(new Date(NOON).toISOString(),NOON)).toBe("NOW");
  expect(shortClock("2026-08-18T11:30:00Z",NOON)).toBe("NOW");
});

test("inside the hour it counts minutes, and never rounds down to zero",()=>{
  expect(shortClock("2026-08-18T12:40:00Z",NOON)).toBe("IN 40M");
  // 20 seconds away is still "IN 1M", not "IN 0M" -- a countdown that reaches
  // zero while the thing has not started reads as broken.
  expect(shortClock("2026-08-18T12:00:20Z",NOON)).toBe("IN 1M");
});

test("inside the relative window it counts hours",()=>{
  expect(shortClock("2026-08-18T14:00:00Z",NOON)).toBe("IN 2H");
});

test("past the window it stops counting and states a time",()=>{
  const later=shortClock(new Date(NOON+RELATIVE_WINDOW_MS+60000).toISOString(),NOON);
  expect(later).not.toMatch(/^IN /);
  expect(later).toMatch(/\d{2}:\d{2}$/);
});

test("no weekday in the meta column",()=>{
  // The column is about twelve characters wide. "THU, 20 AUG 03:37" pushed the
  // whole row's text across; the weekday survives in the full date line under
  // the row, where there is room for it.
  const out=shortClock("2026-09-12T19:30:00Z",NOON);
  expect(out).not.toMatch(/MON|TUE|WED|THU|FRI|SAT|SUN/);
});

test("a bad or missing value formats as nothing, never as Invalid Date",()=>{
  expect(shortClock(null)).toBe("");
  expect(shortClock("")).toBe("");
  expect(shortClock("not a date")).toBe("");
});

test("the full date shows only while the clock is still counting down",()=>{
  // Otherwise the row prints its date twice, in two different formats.
  expect(needsFullDate("2026-08-18T14:00:00Z",NOON)).toBe(true);
  expect(needsFullDate("2026-09-12T19:30:00Z",NOON)).toBe(false);
  expect(needsFullDate("nonsense",NOON)).toBe(false);
});

test("both screens read the same clock",()=>{
  const fs=require("fs"), path=require("path");
  const root=path.join(__dirname,"..");
  for(const file of ["app/events/index.js","app/activity-clubs/[id].js"]){
    const source=fs.readFileSync(path.join(root,file),"utf8");
    expect(source).toMatch(/utils\/clock/);
    // No local re-implementation left behind.
    expect(source).not.toMatch(/function (event|session)Clock\(/);
  }
});
