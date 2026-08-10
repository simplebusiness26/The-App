/* eslint-env jest */

// Packet 8f1: the living map.
//
// Watched failing first against a list that never called the live read model, a
// time window that let a Tuesday lunchtime event through as "Tonight", a
// normaliser that kept the duplicate 'place' rows, and a pin whose live state
// was a fourth colour.
//
// Every clock here is injected. A time-window test that reads the wall clock
// passes on a Tuesday and fails on a Saturday, which is worse than no test.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {supabase}=require("../services/supabase");
const {installFixture,restoreRouterParams,textOf}=require("./fixture");

const {
  ACTIVITY_STATES,
  ACTIVITY_STATE_SENTENCE,
  DEFAULT_TIME_WINDOW,
  TIME_WINDOWS,
  activitiesInWindow,
  activityState,
  inWindow,
  toActivities,
  toActivity,
  windowRange
}=require("../utils/liveActivity");
const {markerForActivity,MARKER_STATES}=require("../utils/markers");

const PlacesList=require("../components/PlacesList").default;

const mountedTrees=[];

// A fixed Wednesday, 14:00 local. Every assertion below is relative to this.
const WED_2PM=new Date(2026,7,12,14,0,0).getTime();

function row(overrides={}){
  return{
    item_type:"linkup",
    item_id:"a1",
    title:"Pier swim",
    subtitle:"outdoors · 3/8 joined",
    area:"Hastings",
    starts_at:new Date(WED_2PM+60*60*1000).toISOString(),
    ends_at:new Date(WED_2PM+3*60*60*1000).toISOString(),
    latitude:50.855,
    longitude:0.573,
    distance_km:1.2,
    status:"open",
    image_url:null,
    deep_link:"/linkups/a1",
    action_label:"View Link-up",
    ...overrides
  };
}

async function render(element){
  let tree;
  await act(async()=>{tree=create(element);});
  mountedTrees.push(tree);
  return tree;
}

afterEach(()=>{
  while(mountedTrees.length){
    const tree=mountedTrees.pop();
    act(()=>{tree.unmount();});
  }
  restoreRouterParams();
  jest.clearAllMocks();
});

describe("the shared read model",()=>{
  test("a business that is already a static pin is not repeated as live",()=>{
    const activities=toActivities([
      row(),
      row({item_type:"place",item_id:"b1",title:"The Old Pier",starts_at:null,ends_at:null})
    ],WED_2PM);

    // Otherwise the map stacks a second pin on the first and calls the
    // duplicate "happening".
    expect(activities).toHaveLength(1);
    expect(activities[0].kind).toBe("linkup");
  });

  test("an activity with no position is dropped rather than placed at 0,0",()=>{
    // Number(null) is 0 and Number.isFinite(0) is true, so the naive check puts
    // this in the Gulf of Guinea.
    expect(toActivity(row({latitude:null,longitude:null}),WED_2PM)).toBeNull();
    expect(toActivity(row({latitude:"",longitude:""}),WED_2PM)).toBeNull();
    expect(toActivity(row({latitude:0,longitude:0}),WED_2PM)).not.toBeNull();
  });

  test("every live kind survives normalisation",()=>{
    const kinds=["linkup","checkin","event","activity"];
    const activities=toActivities(kinds.map((kind,index)=>row({item_type:kind,item_id:`x${index}`})),WED_2PM);

    expect(activities.map(item=>item.kind)).toEqual(kinds);
    for(const activity of activities){
      expect(activity.deepLink).toBeTruthy();
      expect(activity.key).toContain(activity.kind);
    }
  });
});

describe("what state something is in",()=>{
  test("started and not finished is live",()=>{
    const item=row({
      starts_at:new Date(WED_2PM-30*60*1000).toISOString(),
      ends_at:new Date(WED_2PM+30*60*1000).toISOString()
    });
    expect(activityState(toActivity(item,WED_2PM),WED_2PM)).toBe(ACTIVITY_STATES.LIVE);
  });

  test("within ninety minutes of starting is soon, beyond it is scheduled",()=>{
    const soon=row({starts_at:new Date(WED_2PM+60*60*1000).toISOString()});
    const later=row({starts_at:new Date(WED_2PM+5*60*60*1000).toISOString()});

    expect(activityState(toActivity(soon,WED_2PM),WED_2PM)).toBe(ACTIVITY_STATES.SOON);
    expect(activityState(toActivity(later,WED_2PM),WED_2PM)).toBe(ACTIVITY_STATES.SCHEDULED);
  });

  test("every state has a sentence, because colour is never the only carrier",()=>{
    for(const state of Object.values(ACTIVITY_STATES)){
      expect(ACTIVITY_STATE_SENTENCE[state]).toBeTruthy();
    }
  });
});

describe("Now / Tonight / Weekend",()=>{
  test("there are exactly three windows and Now is the default",()=>{
    expect(TIME_WINDOWS.map(w=>w.key)).toEqual(["now","tonight","weekend"]);
    expect(DEFAULT_TIME_WINDOW).toBe("now");
  });

  test("Now means in progress this minute, not soon",()=>{
    const running=toActivity(row({
      starts_at:new Date(WED_2PM-10*60*1000).toISOString(),
      ends_at:new Date(WED_2PM+10*60*1000).toISOString()
    }),WED_2PM);
    const startingSoon=toActivity(row({starts_at:new Date(WED_2PM+20*60*1000).toISOString()}),WED_2PM);

    expect(inWindow(running,"now",WED_2PM)).toBe(true);
    expect(inWindow(startingSoon,"now",WED_2PM)).toBe(false);
  });

  test("Tonight starts at 5pm and runs to 4am, so a 1am Link-up is still tonight",()=>{
    const {from,to}=windowRange("tonight",WED_2PM);

    expect(new Date(from).getHours()).toBe(17);
    expect(new Date(to).getHours()).toBe(4);
    expect(new Date(to).getDate()).toBe(new Date(WED_2PM).getDate()+1);

    const lateNight=toActivity(row({
      starts_at:new Date(2026,7,13,1,0,0).toISOString(),
      ends_at:new Date(2026,7,13,3,0,0).toISOString()
    }),WED_2PM);

    expect(inWindow(lateNight,"tonight",WED_2PM)).toBe(true);
  });

  test("a Wednesday lunchtime event is not Tonight",()=>{
    const lunch=toActivity(row({
      starts_at:new Date(2026,7,12,12,0,0).toISOString(),
      ends_at:new Date(2026,7,12,13,0,0).toISOString()
    }),WED_2PM);

    expect(inWindow(lunch,"tonight",WED_2PM)).toBe(false);
  });

  test("Weekend is the coming Saturday and Sunday",()=>{
    const {from,to}=windowRange("weekend",WED_2PM);

    expect(new Date(from).getDay()).toBe(6);        // Saturday
    expect(new Date(to).getDay()).toBe(1);          // Monday 00:00, exclusive end
    expect(new Date(from).getDate()).toBe(15);      // Sat 15 Aug 2026

    const saturdayEvent=toActivity(row({
      starts_at:new Date(2026,7,15,11,0,0).toISOString(),
      ends_at:new Date(2026,7,15,16,0,0).toISOString()
    }),WED_2PM);

    expect(inWindow(saturdayEvent,"weekend",WED_2PM)).toBe(true);
    expect(inWindow(saturdayEvent,"tonight",WED_2PM)).toBe(false);
  });

  test("during the weekend, Weekend is the rest of it and not the next one",()=>{
    const SAT_10AM=new Date(2026,7,15,10,0,0).getTime();
    const {from,to}=windowRange("weekend",SAT_10AM);

    expect(from).toBe(SAT_10AM);
    expect(new Date(to).getDate()).toBe(17);        // Monday 00:00
  });

  test("an all-day event counts as tonight because the windows overlap",()=>{
    // Overlap, not containment: it did not start tonight but it is on tonight.
    const allDay=toActivity(row({
      starts_at:new Date(2026,7,12,9,0,0).toISOString(),
      ends_at:new Date(2026,7,12,23,0,0).toISOString()
    }),WED_2PM);

    expect(inWindow(allDay,"tonight",WED_2PM)).toBe(true);
  });
});

describe("the activity marker",()=>{
  test("a live pin is not a fourth ink",()=>{
    const live=markerForActivity({kind:"linkup",state:ACTIVITY_STATES.LIVE});
    const scheduled=markerForActivity({kind:"linkup",state:ACTIVITY_STATES.SCHEDULED});

    // The palette has three inks and the product has more states than that.
    // Words carry the difference; colour must not.
    expect(live.fill).toBe(scheduled.fill);
    expect(live.state).toBe(MARKER_STATES.SCHEDULED);
    expect(live.label).toContain("Happening now.");
    expect(scheduled.label).toContain("Scheduled here.");
  });

  test("a caller cannot force a colour or a glyph",()=>{
    const forced=markerForActivity({kind:"linkup",state:"live",fill:"#FFC61A",glyph:"star"});

    expect(forced.fill).not.toBe("#FFC61A");
    expect(forced.glyph).not.toBe("star");
  });
});

describe("the shipping path is alive",()=>{
  // EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set, so PlacesList is what a person
  // actually sees. These assertions are the packet.

  test("a signed-in Explorer sees what is happening, above the places",async()=>{
    installFixture({
      user:{id:"u1"},
      rpc:{get_live_discovery:[row({
        starts_at:new Date(Date.now()-10*60*1000).toISOString(),
        ends_at:new Date(Date.now()+60*60*1000).toISOString()
      })]}
    });

    const tree=await render(React.createElement(PlacesList,null));
    const text=textOf(tree.toJSON());

    expect(text).toContain("Happening");
    expect(text).toContain("Pier swim");

    // lastIndexOf, because "Businesses" is also the label of a type-filter chip
    // that renders above both sections. The first match is that chip; the
    // section heading is the last one. indexOf here compared the Happening
    // heading against the chip and failed on correct markup.
    expect(text.indexOf("Happening")).toBeLessThan(text.lastIndexOf("Businesses"));
  });

  test("a signed-out visitor is never asked for live data, and still gets the places",async()=>{
    installFixture({user:null,rpc:{get_live_discovery:[row()]}});

    await render(React.createElement(PlacesList,null));

    // get_live_discovery raises 'Explorer account required.' for a null
    // auth.uid(), so asking would put an error on the map for every visitor.
    for(const call of supabase.rpc.mock.calls){
      expect(call[0]).not.toBe("get_live_discovery");
    }
    expect(supabase.from).toHaveBeenCalledWith("businesses");
  });

  test("a failed live read leaves the places alone",async()=>{
    installFixture({user:{id:"u1"}});
    supabase.rpc.mockImplementation(()=>Promise.resolve({data:null,error:{message:"boom"}}));

    const tree=await render(React.createElement(PlacesList,null));

    expect(supabase.from).toHaveBeenCalledWith("businesses");
    expect(textOf(tree.toJSON())).toContain("Businesses");
  });

  test("an empty window instructs rather than sulks",async()=>{
    installFixture({user:{id:"u1"},rpc:{get_live_discovery:[]}});

    const tree=await render(React.createElement(PlacesList,null));
    const text=textOf(tree.toJSON());

    expect(text).toMatch(/Check in somewhere or start a Link-up/);
    expect(text).not.toMatch(/Nothing here yet/i);
  });

  test("the live layer never reads a live table directly",async()=>{
    installFixture({user:{id:"u1"},rpc:{get_live_discovery:[row()]}});

    await render(React.createElement(PlacesList,null));

    const tables=supabase.from.mock.calls.map(call=>call[0]);
    expect(tables).not.toContain("live_checkins");
    expect(tables).not.toContain("linkups");
    expect(tables).not.toContain("activity_sessions");
  });
});

describe("windows only narrow what is happening",()=>{
  test("filtering by time never removes a place",()=>{
    const activities=toActivities([row()],WED_2PM);

    // The static places are a separate query entirely; this asserts the model
    // returns only activity, so no caller can accidentally filter places by it.
    expect(activitiesInWindow(activities,"now",WED_2PM).every(a=>a.kind!=="place")).toBe(true);
    expect(activitiesInWindow(activities,"weekend",WED_2PM).every(a=>a.kind!=="place")).toBe(true);
  });
});
