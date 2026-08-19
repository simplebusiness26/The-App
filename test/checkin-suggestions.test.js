/* eslint-env jest */

// What a check-in fills in for you, and what it refuses to.
//
// The locked UX spec asks for four defaults on this screen -- the place, the
// activity, an hour, and an audience -- so that confirming a check-in from a
// place page is one press. Three of those are ordinary product choices. The
// fourth is not: the spec says the audience defaults to Followers, and
// RULES.md says presence never uses followers, because following is one-way
// and needs no permission.
//
// So this file checks two different kinds of thing, and the second matters
// more than the first:
//
//   1. the suggestions are sensible, honest about being suggestions, and
//      survive a place with no category, no coordinates, or no match at all
//   2. the narrowing actually happens, and the word the screen SENDS is the
//      same word utils/checkinSuggestions.js says it should send -- checked
//      against the real source of app/checkins/create.js, because a comment
//      claiming they agree is not evidence that they do

const fs=require("fs");
const path=require("path");

const {
  CHECKIN_ACTIVITIES,
  DEFAULT_CHECKIN_ACTIVITY,
  DEFAULT_CHECKIN_MINUTES,
  PRESENCE_AUDIENCE_CEILING,
  REQUESTED_CHECKIN_AUDIENCE,
  activityForCategory,
  categoryLabel,
  checkinDefaults,
  nearestPlace,
  normalisePosition,
  presenceAudience
}=require("../utils/checkinSuggestions");

const {PUBLIC_PLACE_TYPES}=require("../utils/places");

const screen=fs.readFileSync(
  path.join(__dirname,"..","app","checkins","create.js"),
  "utf8"
);

// ---------------------------------------------------------------------------
// Activity, from the place's category
// ---------------------------------------------------------------------------

describe("the activity suggested from a place's category",()=>{
  test("every category in the real taxonomy gets an activity the screen offers",()=>{
    // The two lists are joined by this function and nothing else, so a new
    // public place type with no entry, or an entry naming an activity the chips
    // do not include, would pre-select a chip that cannot light up.
    for(const type of PUBLIC_PLACE_TYPES){
      expect(CHECKIN_ACTIVITIES).toContain(activityForCategory(type.key));
    }
  });

  test("a park is walking and a beach is not",()=>{
    expect(activityForCategory("park")).toBe("Walking");
    expect(activityForCategory("beach")).toBe("Relaxing");
    expect(activityForCategory("viewpoint")).toBe("Exploring");
  });

  test("no category, or one nobody has seen before, still lands on a real activity",()=>{
    expect(activityForCategory(null)).toBe(DEFAULT_CHECKIN_ACTIVITY);
    expect(activityForCategory(undefined)).toBe(DEFAULT_CHECKIN_ACTIVITY);
    expect(activityForCategory("skate_bowl")).toBe(DEFAULT_CHECKIN_ACTIVITY);
  });

  test("the fallback is never Other, because Other means type something",()=>{
    // "Other" opens a text field. Falling back to it would turn "confirming is
    // a single tap" into a typing job exactly when the app knows least about
    // where somebody is standing.
    expect(DEFAULT_CHECKIN_ACTIVITY).not.toBe("Other");
    expect(activityForCategory("nonsense")).not.toBe("Other");
  });

  test("the screen renders the same list this file maps onto",()=>{
    expect(screen).toContain("CHECKIN_ACTIVITIES.map");
  });

  test("a suggestion can say where it came from",()=>{
    expect(categoryLabel("park")).toBe("Park");
    expect(categoryLabel("nonsense")).toBe("Public place");
  });
});

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

describe("the pre-selected duration",()=>{
  test("is one hour",()=>{
    expect(DEFAULT_CHECKIN_MINUTES).toBe(60);
  });

  test("is one of the four chips the screen actually draws",()=>{
    // The list lives in the screen because the release gate pins the literal.
    // A default that is not in it would leave every chip unselected.
    const durations=screen.match(/\[\s*30\s*,\s*60\s*,\s*120\s*,\s*240\s*\]/);
    expect(durations).not.toBeNull();
    expect(JSON.parse(durations[0])).toContain(DEFAULT_CHECKIN_MINUTES);
  });

  test("the screen starts on it rather than on the old two hours",()=>{
    expect(screen).toContain("useState(DEFAULT_CHECKIN_MINUTES)");
  });
});

// ---------------------------------------------------------------------------
// The audience -- the part that is safety, not taps
// ---------------------------------------------------------------------------

describe("presence narrows the spec's default audience",()=>{
  test("the spec asked for followers and presence caps at friends",()=>{
    expect(REQUESTED_CHECKIN_AUDIENCE).toBe("followers");
    expect(PRESENCE_AUDIENCE_CEILING).toBe("friends");
    expect(presenceAudience(REQUESTED_CHECKIN_AUDIENCE)).toBe("friends");
  });

  test("everyone narrows too",()=>{
    expect(presenceAudience("everyone")).toBe("friends");
  });

  test("a narrower audience is left alone",()=>{
    expect(presenceAudience("close_friends")).toBe("close_friends");
    expect(presenceAudience("selected")).toBe("selected");
    expect(presenceAudience("nobody")).toBe("nobody");
  });

  test("an audience nobody recognises narrows rather than being trusted",()=>{
    expect(presenceAudience("public")).toBe("friends");
    expect(presenceAudience(undefined)).toBe("friends");
  });

  test("the word the screen sends is the word this file computes",()=>{
    // The screen writes the literal because scripts/verify-linkups-live.cjs
    // pins it. This is what stops the literal and the rule drifting apart into
    // two different answers about who can see where somebody is.
    expect(screen).toContain(`p_visibility:"${presenceAudience(REQUESTED_CHECKIN_AUDIENCE)}"`);
  });

  test("the screen says the narrowing out loud instead of quietly doing it",()=>{
    expect(screen).toContain("PRESENCE_NARROWING");
    expect(screen).toMatch(/Followers is the wider audience/);
  });
});

// ---------------------------------------------------------------------------
// The nearest place, when nothing said which one
// ---------------------------------------------------------------------------

describe("the nearest place",()=>{
  const here={latitude:50.855,longitude:0.573};
  const places=[
    {id:"far",name:"Bexhill Green",latitude:50.84,longitude:0.47},
    {id:"near",name:"Alexandra Park",latitude:50.86,longitude:0.575},
    {id:"nowhere",name:"Unplotted Common",latitude:null,longitude:null}
  ];

  test("is the nearest one",()=>{
    expect(nearestPlace(places,here).id).toBe("near");
  });

  test("reads a device fix as readily as a flat row",()=>{
    expect(nearestPlace(places,{coords:here}).id).toBe("near");
  });

  test("a place with no recorded position is never the nearest one",()=>{
    // utils/geo.js sorts those last rather than dropping them, which is right
    // for a list and wrong for a single answer: "nearest" would be a place
    // nobody has ever plotted.
    expect(nearestPlace([{id:"nowhere",latitude:null,longitude:null}],here)).toBeNull();
  });

  test("no fix means no suggestion, not a guess",()=>{
    expect(nearestPlace(places,null)).toBeNull();
    expect(nearestPlace(places,{latitude:null,longitude:null})).toBeNull();
    expect(nearestPlace(places,{coords:{latitude:"",longitude:""}})).toBeNull();
  });

  test("nothing nearby is an empty answer, not a crash",()=>{
    expect(nearestPlace([],here)).toBeNull();
    expect(nearestPlace(undefined,here)).toBeNull();
  });

  test("0,0 is a real place and is not mistaken for a missing one",()=>{
    expect(normalisePosition({latitude:0,longitude:0})).toEqual({latitude:0,longitude:0});
  });
});

// ---------------------------------------------------------------------------
// The three defaults arrive together
// ---------------------------------------------------------------------------

describe("checkinDefaults",()=>{
  test("answers all three questions for a place",()=>{
    expect(checkinDefaults({place_type:"beach"})).toEqual({
      activity:"Relaxing",
      minutes:60,
      audience:"friends"
    });
  });

  test("answers them for a place with no category at all",()=>{
    expect(checkinDefaults(null)).toEqual({
      activity:DEFAULT_CHECKIN_ACTIVITY,
      minutes:60,
      audience:"friends"
    });
  });
});

// ---------------------------------------------------------------------------
// The suggestions stay suggestions
// ---------------------------------------------------------------------------

describe("nothing here is a lock",()=>{
  test("opening the screen reads the location permission and never asks for it",()=>{
    // Auto-suggesting the nearest place must not turn opening a screen into a
    // permission prompt. The read is getForegroundPermissionsAsync; the one
    // control that ASKS is still the "Add approximate location" button, and it
    // still asks.
    expect(screen).toContain("getForegroundPermissionsAsync");
    expect(screen).toContain("requestForegroundPermissionsAsync");
  });

  test("the suggestion is applied once, so switching place type does not take it back",()=>{
    expect(screen).toContain("suggested.current");
  });

  test("the place, the activity and the duration all stay changeable",()=>{
    // Each of the three is still wired to the control that changes it.
    expect(screen).toContain("onPress={()=>selectPlace(place)}");
    expect(screen).toContain("onPress={()=>setActivity(item)}");
    expect(screen).toContain("onChange={setMinutes}");
  });

  test("the device position is used for ranking and is not attached to the check-in",()=>{
    // Sending a coordinate is opt-in. suggestPlace ranks with the fix and never
    // calls setLatitude/setLongitude -- only useLocation, behind the button,
    // does that.
    const suggest=screen.slice(screen.indexOf("async function suggestPlace"),screen.indexOf("function applySuggestion"));
    expect(suggest).toContain("nearestPlace");
    expect(suggest).not.toContain("setLatitude");
    expect(suggest).not.toContain("setLongitude");
  });
});

// ---------------------------------------------------------------------------
// The screen, mounted, from a place page
// ---------------------------------------------------------------------------
//
// Everything above is a rule. This is the claim the rules exist to support:
// arriving from a place detail page, the whole form is already answered and
// confirming is ONE press.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {installFixture,restoreRouterParams,allText}=require("./fixture");

const PARK={
  id:"park-1",
  name:"Alexandra Park",
  place_type:"park",
  area_id:"area-1",
  latitude:50.869,
  longitude:0.573,
  location_description:"Main gate on St Helens Road",
  status:"published"
};

const BEACH={
  id:"beach-1",
  name:"Pelham Beach",
  place_type:"beach",
  area_id:"area-1",
  latitude:50.855,
  longitude:0.588,
  status:"published"
};

const trees=[];

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:412,height:915},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

async function mountCheckin(params){
  installFixture({
    user:{id:"explorer-1"},
    params,
    tables:{
      public_places:[PARK,BEACH],
      profiles:[{area:"",visibility:"friends"}],
      geo_areas:[{name:"Hastings"}]
    },
    rpc:{start_live_checkin:null}
  });

  const CreateCheckin=require("../app/checkins/create").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(CreateCheckin,null)));});
  trees.push(tree);
  return tree;
}

// A Row speaks its title, its sentence and its measured value as one label
// ("Alexandra Park. Main gate on St Helens Road"), so a finder that demands an
// exact match finds every chip and no place. Prefix, then.
function control(tree,label){
  return tree.root.findAll(
    (node)=>typeof node.props?.accessibilityLabel==="string"
      && (node.props.accessibilityLabel===label || node.props.accessibilityLabel.startsWith(`${label}.`))
      && typeof node.props?.onPress==="function",
    {deep:true}
  )[0] || null;
}

// What a text field is holding. A TextInput's value is a prop, not a child, so
// nothing that walks the rendered text can see it -- which is how a screen can
// look empty in a test while showing the right thing on a phone.
function fieldValue(tree,placeholder){
  const input=tree.root.findAll(
    (node)=>node.props?.placeholder===placeholder && typeof node.props?.onChangeText==="function",
    {deep:true}
  )[0];
  return input ? input.props.value : null;
}

function selectedLabels(tree){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityState?.selected===true && node.props?.accessibilityLabel,
    {deep:true}
  ).map((node)=>node.props.accessibilityLabel);
}

afterEach(async()=>{
  restoreRouterParams();
  await act(async()=>{for(const tree of trees) tree.unmount();});
  trees.length=0;
  jest.clearAllMocks();
});

describe("arriving from a place page",()=>{
  it("pre-fills the place, suggests the activity from its category and pre-selects an hour",async()=>{
    const tree=await mountCheckin({place:"park-1"});
    const text=allText(tree.toJSON()).join(" | ");

    expect(text).toContain("Alexandra Park");
    // The suggestion says it is one.
    expect(text).toContain("SUGGESTED");
    expect(text).toContain("Suggested from park");

    const selected=selectedLabels(tree);
    expect(selected).toContain("Walking");   // a park
    expect(selected).toContain("1h");        // the pre-selected duration chip
  });

  it("fills the broad area from the place, so nothing is left to type",async()=>{
    const tree=await mountCheckin({place:"park-1"});
    expect(fieldValue(tree,"Hastings or Central Hastings")).toBe("Hastings");
    expect(fieldValue(tree,"Alexandra Park")).toBe("Alexandra Park");
  });

  it("confirms in a single press, and sends friends rather than followers",async()=>{
    const tree=await mountCheckin({place:"park-1"});

    const confirm=control(tree,"Check in at Alexandra Park");
    expect(confirm).not.toBeNull();

    await act(async()=>{confirm.props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("start_live_checkin",expect.objectContaining({
      p_public_place_id:"park-1",
      p_place_name:"Alexandra Park",
      p_area:"Hastings",
      p_activity:"Walking",
      p_minutes:60,
      p_visibility:"friends"
    }));
  });

  it("lets every suggestion be changed before it is confirmed",async()=>{
    const tree=await mountCheckin({place:"park-1"});

    await act(async()=>{control(tree,"Coffee").props.onPress();});
    await act(async()=>{control(tree,"4h").props.onPress();});
    await act(async()=>{control(tree,"Pelham Beach").props.onPress();});
    await act(async()=>{control(tree,"Check in at Pelham Beach").props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("start_live_checkin",expect.objectContaining({
      p_public_place_id:"beach-1",
      p_activity:"Coffee",
      p_minutes:240
    }));
  });

  it("still works when the link names a place the catalogue does not hold",async()=>{
    const tree=await mountCheckin({place:"not-a-place"});
    const text=allText(tree.toJSON()).join(" | ");
    // No suggestion, no crash, and the catalogue is still there to pick from.
    expect(text).toContain("Alexandra Park");
    expect(text).not.toContain("SUGGESTED");
  });
});

describe("arriving from the global Create button",()=>{
  const Location=require("expo-location");

  it("suggests the nearest place when location was already granted",async()=>{
    Location.getForegroundPermissionsAsync.mockResolvedValueOnce({granted:true,status:"granted"});
    Location.getCurrentPositionAsync.mockResolvedValueOnce({coords:{latitude:50.856,longitude:0.589}});

    const tree=await mountCheckin({});
    const text=allText(tree.toJSON()).join(" | ");

    expect(text).toContain("NEAREST");
    // Pelham Beach is the nearer of the two, and a beach suggests Relaxing.
    expect(selectedLabels(tree)).toContain("Relaxing");
    expect(control(tree,"Check in at Pelham Beach")).not.toBeNull();
  });

  it("asks for nothing and suggests nothing when location was refused",async()=>{
    const tree=await mountCheckin({});

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(allText(tree.toJSON()).join(" | ")).not.toContain("NEAREST");
    // The screen is still usable: the catalogue is listed and can be picked from.
    expect(control(tree,"Alexandra Park")).not.toBeNull();
  });

  it("survives a granted permission with no fix available",async()=>{
    Location.getForegroundPermissionsAsync.mockResolvedValueOnce({granted:true,status:"granted"});
    Location.getCurrentPositionAsync.mockRejectedValueOnce(new Error("no fix"));

    const tree=await mountCheckin({});
    expect(allText(tree.toJSON()).join(" | ")).not.toContain("NEAREST");
  });
});

// ---------------------------------------------------------------------------
// The query has to ask for what the screen uses
// ---------------------------------------------------------------------------

describe("the catalogue query",()=>{
  test("selects the columns the suggestion needs",()=>{
    // area_id was missing from this select for a while and nothing noticed: the
    // fixture returns whole rows however narrow the select is, so the broad
    // area filled itself in every test and in no real app.
    const select=screen.match(/from\("public_places"\)\.select\("([^"]+)"\)/);
    expect(select).not.toBeNull();
    for(const column of ["id","name","place_type","area_id","latitude","longitude"]){
      expect(select[1].split(",")).toContain(column);
    }
  });
});
