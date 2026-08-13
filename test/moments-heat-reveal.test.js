/* eslint-env jest */

// Double tap a warm patch, see the Moments that made it warm.
//
// Two things are being protected here. First, that "here" means the CELL and
// not the viewport -- the tap was on a place, and returning everything on
// screen would answer a different question. Second, that adding a tap gesture
// to the heat layer does not break the gestures the map already has: pan,
// pinch, and the long press that drops a Link-up.

const {createDoubleTap,DOUBLE_TAP_MS}=require("../utils/doubleTap");
const {itemsInCell,heatCells,heatKey}=require("../utils/mapLayers");

// ---------------------------------------------------------------------------
// The gesture
// ---------------------------------------------------------------------------

test("two taps close together on the same thing is a double tap",()=>{
  const tap=createDoubleTap();
  expect(tap.tap("cell-a",1000)).toBe(false);
  expect(tap.tap("cell-a",1200)).toBe(true);
});

test("a single tap is not a double tap, which is what stops it eating pans",()=>{
  const tap=createDoubleTap();
  expect(tap.tap("cell-a",1000)).toBe(false);
});

test("two taps far apart in time are two single taps",()=>{
  const tap=createDoubleTap();
  expect(tap.tap("cell-a",1000)).toBe(false);
  expect(tap.tap("cell-a",1000+DOUBLE_TAP_MS+50)).toBe(false);
});

test("two taps on different cells are never a double tap",()=>{
  const tap=createDoubleTap();
  expect(tap.tap("cell-a",1000)).toBe(false);
  // Somebody tapping two warm patches in quick succession has not
  // double-tapped either of them.
  expect(tap.tap("cell-b",1100)).toBe(false);
});

test("three taps are one double tap, not two overlapping ones",()=>{
  const tap=createDoubleTap();
  expect(tap.tap("cell-a",1000)).toBe(false);
  expect(tap.tap("cell-a",1100)).toBe(true);
  // The third starts again rather than completing a second.
  expect(tap.tap("cell-a",1200)).toBe(false);
});

// ---------------------------------------------------------------------------
// What "here" means
// ---------------------------------------------------------------------------

// Two points that land in the SAME two-decimal cell, and one that does not.
// Chosen away from a rounding boundary on purpose: 50.855 and 50.8551 look
// adjacent and round to different cells, which is correct behaviour and a
// terrible pair to test with. This is the app's own grid, not an approximation
// of it -- itemsInCell and heatCells call the same heatKey.
const HERE={latitude:50.8562,longitude:0.5734};
const ALSO_HERE={latitude:50.8558,longitude:0.5738};
const ELSEWHERE={latitude:50.821,longitude:-0.137};

function moment(id,at){
  return {id,key:`moment-${id}`,kind:"moment",user_id:`u-${id}`,...at};
}

test("reveals only what is in the tapped cell, not the whole viewport",()=>{
  const moments=[
    moment(1,HERE),
    moment(2,ALSO_HERE),
    // Brighton. On screen at a wide zoom, and not in this cell.
    moment(3,ELSEWHERE)
  ];

  const cell={key:heatKey(HERE.latitude,HERE.longitude)};
  const revealed=itemsInCell(moments,cell);

  expect(revealed.map((m)=>m.id).sort()).toEqual([1,2]);
});

test("a cell with nothing in it reveals nothing, and does not throw",()=>{
  expect(itemsInCell([],{key:"50.86,0.57"})).toEqual([]);
  expect(itemsInCell(null,{key:"50.86,0.57"})).toEqual([]);
  // No cell at all -- a stray call must not return the world.
  expect(itemsInCell([moment(1,HERE)],null)).toEqual([]);
  expect(itemsInCell([moment(1,HERE)],{})).toEqual([]);
});

test("what a cell reveals is what the cell was built from",()=>{
  // Three contributions from two people, which is what heatCells requires
  // before a cell exists at all.
  const items=[
    moment(1,HERE),
    moment(2,ALSO_HERE),
    moment(3,HERE),
    moment(9,ELSEWHERE)
  ];
  items[1].user_id="u-other";

  const cells=heatCells(items);
  expect(cells.length).toBe(1);

  const revealed=itemsInCell(items,cells[0]);
  expect(revealed.length).toBe(cells[0].contributions);
});

test("the reveal cannot show anything the heat did not already count",()=>{
  // The privacy floor lives in heatCells: three contributions and two different
  // posters before a cell is drawn. Since a cell must exist before it can be
  // tapped, anything revealed was already visible as a Moment pin -- there is
  // no path here that discloses something the map was hiding.
  const oneAndOnly=[moment(1,HERE),moment(2,HERE),moment(3,HERE)];
  for(const item of oneAndOnly) item.user_id="just-me";

  // One person posting three times is not a busy street, so no cell exists...
  expect(heatCells(oneAndOnly)).toEqual([]);
  // ...and with no cell there is nothing to tap.
});

// ---------------------------------------------------------------------------
// The gestures that already existed
// ---------------------------------------------------------------------------

test("nothing in the tap recogniser claims or cancels a gesture",()=>{
  const source=require("fs").readFileSync(
    require("path").join(__dirname,"..","utils","doubleTap.js"),"utf8"
  );
  // Comments stripped: the file explains at length which mechanisms it is
  // deliberately NOT using, and a gate that fails on its own reasoning is a
  // gate somebody deletes.
  const code=source.split("\n").filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");

  // It observes taps that already happened. It must not be reaching into the
  // responder system or cancelling events, which is how a new gesture breaks
  // panning and the long press that drops a Link-up.
  expect(code).not.toMatch(/preventDefault|setResponder|PanResponder|stopPropagation/);
});

test("the long press that drops a Link-up is still wired on both maps",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  const native=fs.readFileSync(path.join(root,"components","LivingMap.js"),"utf8");
  const web=fs.readFileSync(path.join(root,"components","LivingMap.web.js"),"utf8");

  expect(native).toMatch(/onLongPress/);
  expect(web).toMatch(/contextmenu/);
  // And the heat layer is what gained the tap, not the map itself.
  expect(native).toMatch(/onHeatDoubleTap/);
  expect(web).toMatch(/dblclick/);
});
