/* eslint-env jest */

// The 0,0 bug, pinned down.
//
// `Number(null)` and `Number("")` are both 0, and `Number.isFinite(0)` is true.
// So the obvious coordinate check accepts a row with no location and treats it
// as a row sitting in the Gulf of Guinea. It appeared in three read paths (the
// map, Memories, the live model) and — worse — in four save-path guards, where
// it meant an empty coordinate field passed validation and the listing was
// written at 0,0.
//
// The distinction this file exists to hold: 0 is a real coordinate and must be
// kept; the *absence* of a value must be rejected. Those look identical after
// `Number()`.

const {coordinate,hasCoordinates}=require("../utils/coordinates");
const {validateEventForm}=require("../utils/events");

describe("coordinate()",()=>{
  test("absence is rejected",()=>{
    expect(coordinate(null)).toBeNull();
    expect(coordinate(undefined)).toBeNull();
    expect(coordinate("")).toBeNull();
  });

  test("zero is a real place and is kept",()=>{
    // The whole subtlety. If this ever returns null, a legitimate point on the
    // Prime Meridian at the Equator becomes "no location".
    expect(coordinate(0)).toBe(0);
    expect(coordinate("0")).toBe(0);
  });

  test("real values survive, as numbers",()=>{
    expect(coordinate(50.8225)).toBe(50.8225);
    expect(coordinate("-0.1372")).toBe(-0.1372);
  });

  test("nonsense is rejected",()=>{
    expect(coordinate("abc")).toBeNull();
    expect(coordinate(NaN)).toBeNull();
    expect(coordinate(Infinity)).toBeNull();
  });
});

describe("hasCoordinates()",()=>{
  test("a row with no location is not plottable",()=>{
    expect(hasCoordinates({latitude:null,longitude:null})).toBe(false);
    expect(hasCoordinates({latitude:"",longitude:""})).toBe(false);
    expect(hasCoordinates({latitude:50.8,longitude:null})).toBe(false);
    expect(hasCoordinates({})).toBe(false);
    expect(hasCoordinates(null)).toBe(false);
  });

  test("a row at 0,0 is plottable",()=>{
    expect(hasCoordinates({latitude:0,longitude:0})).toBe(true);
  });

  test("a located row is plottable",()=>{
    expect(hasCoordinates({latitude:50.8225,longitude:-0.1372})).toBe(true);
  });
});

describe("the save-path guards actually guard",()=>{
  function form(overrides={}){
    return{
      name:"Test Event",category:"music",address:"1 Test Street",
      latitude:50.8,longitude:-0.13,
      startDate:"2026-09-01",startTime:"18:00",
      endDate:"2026-09-01",endTime:"21:00",
      ...overrides
    };
  }

  test("a complete form is accepted",()=>{
    expect(validateEventForm(form()).error).toBeFalsy();
  });

  test("an empty coordinate is refused rather than saved as 0,0",()=>{
    // This is the case the old guard let through: Number("") is 0, which is
    // finite, so the Event was written to the database at 0,0.
    expect(validateEventForm(form({latitude:""})).error).toBeTruthy();
    expect(validateEventForm(form({longitude:""})).error).toBeTruthy();
    expect(validateEventForm(form({latitude:null})).error).toBeTruthy();
  });

  test("a genuine 0 is still accepted",()=>{
    expect(validateEventForm(form({latitude:0,longitude:0})).error).toBeFalsy();
  });
});
