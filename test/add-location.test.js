/* eslint-env jest */

// Where a Moment or a Memory says it happened.
//
// The owner: "the app needs to take your location coz that's how it knows where
// to put your moment on the map, and at least if you don't want your exact
// location on the map it goes to your area -- same with memory."
//
// The "same with memory" half was not a preference, it was a gap:
// app/memories/create.js never asked for a location and never sent one, so a
// standalone Memory carried no coordinates and could not appear on the map at
// all.
//
// This is safety-critical under RULES.md, so what is asserted here is mostly
// what must NOT happen.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");

const {
  LOCATION_DETAIL,
  roundCoordinate,
  roundToArea,
  roundLocation,
  COORDINATE_PRECISION,
  AREA_PRECISION
} = require("../utils/places");

jest.mock("expo-location",()=>({
  requestForegroundPermissionsAsync:jest.fn(),
  getCurrentPositionAsync:jest.fn(),
  Accuracy:{Balanced:3}
}));

const Location=require("expo-location");
const AddLocation=require("../components/AddLocation").default;

// A deliberately precise fix -- a doorstep, to six decimal places.
const DOORSTEP={coords:{latitude:50.822512,longitude:-0.137243}};

function press(tree,match){
  const hits=tree.root.findAll(
    (node)=>typeof node.props?.accessibilityLabel==="string"
      && node.props.accessibilityLabel.includes(match)
      && typeof node.props?.onPress==="function",
    {deep:true}
  );
  return hits[0] || null;
}

async function render(props){
  let tree;
  await act(async()=>{tree=create(React.createElement(AddLocation,props));});
  await act(async()=>{});
  return tree;
}

beforeEach(()=>{
  Location.requestForegroundPermissionsAsync.mockReset();
  Location.getCurrentPositionAsync.mockReset();
});

// ---------------------------------------------------------------------------
// The rounding
// ---------------------------------------------------------------------------

test("an area is a kilometre and a spot is a hundred metres",()=>{
  expect(COORDINATE_PRECISION).toBe(3);
  expect(AREA_PRECISION).toBe(2);

  expect(roundCoordinate(50.822512)).toBe(50.823);
  expect(roundToArea(50.822512)).toBe(50.82);
});

// Being vaguer than asked is a mistake somebody can live with. The other way
// round is a doorstep on a map.
test("an unrecognised precision rounds to the area, not to the spot",()=>{
  expect(roundLocation(50.822512,LOCATION_DETAIL.EXACT)).toBe(50.823);
  expect(roundLocation(50.822512,LOCATION_DETAIL.AREA)).toBe(50.82);
  expect(roundLocation(50.822512,"anything else")).toBe(50.82);
  expect(roundLocation(50.822512,undefined)).toBe(50.82);
});

test("nothing is not rounded into zero",()=>{
  // Number(null) is 0, and 0,0 is a real place in the Gulf of Guinea.
  expect(roundToArea(null)).toBeNull();
  expect(roundToArea(undefined)).toBeNull();
  expect(roundLocation(null,LOCATION_DETAIL.EXACT)).toBeNull();
});

// ---------------------------------------------------------------------------
// The control
// ---------------------------------------------------------------------------

test("nothing is chosen until somebody chooses it, and no permission is asked for",async()=>{
  await render({value:null,onChange:jest.fn()});

  // Not on mount. Not on render. Only when a button that says what it does is
  // pressed. RULES.md: opt-in is never the fallback branch.
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test("a precise fix is rounded on the device before it is handed over",async()=>{
  Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
  Location.getCurrentPositionAsync.mockResolvedValue(DOORSTEP);

  const onChange=jest.fn();
  const tree=await render({value:null,onChange});

  await act(async()=>{press(tree,"this spot").props.onPress();});

  expect(onChange).toHaveBeenCalledWith({
    latitude:50.823,
    longitude:-0.137,
    detail:LOCATION_DETAIL.EXACT
  });

  await act(async()=>{tree.unmount();});
});

test("my area only really is vaguer, not the same number with a different name",async()=>{
  Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
  Location.getCurrentPositionAsync.mockResolvedValue(DOORSTEP);

  const onChange=jest.fn();
  const tree=await render({value:null,onChange});

  await act(async()=>{press(tree,"my area only").props.onPress();});

  expect(onChange).toHaveBeenCalledWith({
    latitude:50.82,
    longitude:-0.14,
    detail:LOCATION_DETAIL.AREA
  });

  await act(async()=>{tree.unmount();});
});

test("a refused permission sends nothing at all, and says so",async()=>{
  Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"denied"});

  const onChange=jest.fn();
  const tree=await render({value:null,onChange});

  await act(async()=>{press(tree,"this spot").props.onPress();});

  // Not a stale coordinate, not a guess, not the last known fix: null.
  expect(onChange).toHaveBeenCalledWith(null);
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();

  await act(async()=>{tree.unmount();});
});

test("a fix that never arrives sends nothing",async()=>{
  Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
  Location.getCurrentPositionAsync.mockRejectedValue(new Error("no fix"));

  const onChange=jest.fn();
  const tree=await render({value:null,onChange});

  await act(async()=>{press(tree,"this spot").props.onPress();});
  expect(onChange).toHaveBeenCalledWith(null);

  await act(async()=>{tree.unmount();});
});

test("half a coordinate is not a location",async()=>{
  Location.requestForegroundPermissionsAsync.mockResolvedValue({status:"granted"});
  Location.getCurrentPositionAsync.mockResolvedValue({coords:{latitude:50.8225,longitude:null}});

  const onChange=jest.fn();
  const tree=await render({value:null,onChange});

  await act(async()=>{press(tree,"this spot").props.onPress();});
  expect(onChange).toHaveBeenCalledWith(null);

  await act(async()=>{tree.unmount();});
});

test("pressing the chosen one again takes the location off",async()=>{
  const onChange=jest.fn();
  const tree=await render({
    value:{latitude:50.823,longitude:-0.137,detail:LOCATION_DETAIL.EXACT},
    onChange
  });

  await act(async()=>{press(tree,"Remove the location").props.onPress();});

  expect(onChange).toHaveBeenCalledWith(null);
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// Both screens, and only where it is honest to ask
// ---------------------------------------------------------------------------

test("a Moment and a Memory use the same control, and neither rolls its own",()=>{
  const root=path.resolve(__dirname,"..");

  for(const file of ["app/moments/create.js","app/memories/create.js"]){
    const source=fs.readFileSync(path.join(root,file),"utf8");

    expect(source).toMatch(/<AddLocation/);

    // Two screens each asking expo-location for a fix and rounding it their own
    // way is how one of them ends up sending a doorstep. The rounding lives in
    // utils/places.js and the asking lives in components/AddLocation.js.
    expect(source).not.toMatch(/getCurrentPositionAsync/);
    expect(source).not.toMatch(/requestForegroundPermissionsAsync/);

    // Offered ONLY for a standalone post. An attached one takes the place's own
    // coordinates on insert, and a second answer here could disagree with it.
    expect(source).toMatch(/!selectedPlace && <AddLocation|\{!selectedPlace && \(/);
  }
});
