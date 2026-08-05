/* eslint-env jest */

// Packet 7. The rule under test is the packet's whole point: "Every
// recommendation must carry a visible reason string. If the reason cannot be
// computed, the item does not appear."
//
// That is a rule about what is NOT shown, so most of these assert absence.

const {REASON_KINDS,SECTIONS,recommend,reasonFor}=require("../utils/discover");

const NOW=new Date("2026-08-04T12:00:00Z").getTime();
const ctx={now:NOW,area:"Hove"};

function at(offsetMs){
  return new Date(NOW+offsetMs).toISOString();
}

describe("a reason has to be true to be shown",()=>{
  it("says nothing about an item it knows nothing about",()=>{
    // No distance, no area, no time, not saved. There is no honest sentence to
    // write, so there is none.
    expect(reasonFor({id:"x",title:"A place"},ctx)).toBeNull();
  });

  it("drops that item rather than showing a blank reason",()=>{
    const items=[
      {id:"known",distance_km:0.4},
      {id:"unknown"}
    ];
    const out=recommend(items,ctx);

    expect(out.map((item)=>item.id)).toEqual(["known"]);
    expect(out[0].reason).toBeTruthy();
  });

  it("never returns an item without a reason",()=>{
    const messy=[
      {id:"a"},
      {id:"b",distance_km:null},
      {id:"c",area:""},
      {id:"d",starts_at:"not-a-date"},
      {id:"e",area:"Somewhere else"},
      {id:"f",distance_km:2.5}
    ];

    for(const item of recommend(messy,ctx)){
      expect(typeof item.reason).toBe("string");
      expect(item.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("survives nonsense input rather than inventing a reason",()=>{
    expect(reasonFor(null,ctx)).toBeNull();
    expect(recommend(null,ctx)).toEqual([]);
    expect(recommend(undefined)).toEqual([]);
  });
});

describe("what the reasons actually say",()=>{
  it("puts an explicit signal above everything else",()=>{
    // Saved beats a distance and a start time, because the person already said
    // this one matters.
    const reason=reasonFor({saved:true,distance_km:0.2,starts_at:at(30*60*1000)},ctx);
    expect(reason).toBe("You saved this");
  });

  it("says something is on when the clock says so",()=>{
    expect(reasonFor({starts_at:at(-30*60*1000),ends_at:at(30*60*1000)},ctx)).toBe("On now");
  });

  it("does not call a finished thing live",()=>{
    expect(reasonFor({starts_at:at(-3*60*60*1000),ends_at:at(-60*60*1000)},ctx)).toBeNull();
  });

  it("counts down to something starting soon",()=>{
    expect(reasonFor({starts_at:at(40*60*1000)},ctx)).toBe("Starts in 40 minutes");
    expect(reasonFor({starts_at:at(2*60*60*1000)},ctx)).toBe("Starts in 2 hours");
  });

  it("does not count down to something days away",()=>{
    // Six hours is the limit. Beyond that "starts in 92 hours" is a fact, not
    // a reason to look now.
    expect(reasonFor({starts_at:at(4*24*60*60*1000)},ctx)).toBeNull();
  });

  it("reports a distance the database measured",()=>{
    expect(reasonFor({distance_km:2.35},ctx)).toBe("2.4 km from you");
    expect(reasonFor({distance_km:0.32},ctx)).toBe("300 m from you");
  });

  it("does not round a close distance down to nothing",()=>{
    // "0 m from you" would be a claim about somebody's exact position.
    expect(reasonFor({distance_km:0.004},ctx)).toBe("50 m from you");
  });

  it("uses the area only when it is the Explorer's own",()=>{
    expect(reasonFor({area:"Hove"},ctx)).toBe("In Hove");
    expect(reasonFor({area:"hove"},ctx)).toBe("In hove");
    expect(reasonFor({area:"Lewes"},ctx)).toBeNull();
    expect(reasonFor({area:"Hove"},{now:NOW})).toBeNull();
  });

  it("never claims popularity, because nothing measures it",()=>{
    const reasons=[
      reasonFor({saved:true},ctx),
      reasonFor({starts_at:at(-1),ends_at:at(HOURS(1))},ctx),
      reasonFor({starts_at:at(20*60*1000)},ctx),
      reasonFor({distance_km:1},ctx),
      reasonFor({area:"Hove"},ctx)
    ].filter(Boolean).join(" ").toLowerCase();

    for(const banned of ["popular","trending","everyone","best","top pick"]){
      expect(reasons).not.toContain(banned);
    }
  });
});

function HOURS(n){return n*60*60*1000;}

describe("the sections",()=>{
  it("covers the ones the brief names that this app has data for",()=>{
    expect(SECTIONS.map((section)=>section.key)).toEqual([
      "for-you","happening-now","events","clubs","linkups","saved"
    ]);
  });

  it("instructs in every empty state rather than reporting an absence",()=>{
    for(const section of SECTIONS){
      expect(section.empty.length).toBeGreaterThan(20);
      // "Empty states are instructions, not moods."
      expect(section.empty.toLowerCase()).not.toContain("nothing here");
      expect(section.empty.toLowerCase()).not.toContain("no results");
      // An instruction tells you what to do, so it names an action.
      expect(/save|check in|add|start|tap|set /i.test(section.empty)).toBe(true);
    }
  });

  it("has a title for every section",()=>{
    for(const section of SECTIONS){
      expect(typeof section.title).toBe("string");
      expect(section.title.length).toBeGreaterThan(0);
    }
  });

  it("names its reason kinds",()=>{
    expect(REASON_KINDS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The screen. The pure function above refuses to produce a reasonless item;
// these prove the screen has no path around it.
// ---------------------------------------------------------------------------

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {installFixture,textOf,labelsOf}=require("./fixture");

const VIEWER={id:"viewer-1"};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

async function openDiscover({user=VIEWER,tables={},rpc={}}={}){
  installFixture({
    user,
    tables:{profiles:user ? [{id:user.id,area:"Hove"}] : [],...tables},
    rpc
  });

  const Screen=require("../app/discover").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
  await act(async()=>{});
  return tree;
}

describe("the Discover screen",()=>{
  const soon=new Date(Date.now()+40*60*1000).toISOString();
  const later=new Date(Date.now()+3*60*60*1000).toISOString();

  it("shows a reason on every card it renders",async()=>{
    const tree=await openDiscover({
      tables:{
        events:[{id:"e1",name:"Night Market",category:"Market",area:"Hove",starts_at:soon,ends_at:later,status:"published"}],
        explorer_favourites:[{id:"f1",target_type:"business",target_id:"b1",target_name:"The Lamb and Flag"}]
      }
    });

    const labels=labelsOf(tree.toJSON());
    const cards=labels.filter((label)=>label.includes("Night Market") || label.includes("Lamb and Flag"));

    expect(cards.length).toBeGreaterThan(0);
    // The accessible name of every card is "<title>. <reason>." -- a card with
    // no reason would end after the title.
    for(const label of cards) expect(label.split(". ").length).toBeGreaterThan(1);

    await act(async()=>{tree.unmount();});
  });

  it("leaves out an item nothing true can be said about",async()=>{
    const tree=await openDiscover({
      tables:{
        // No area, no coordinates, no dates. Nothing to say.
        activity_clubs:[{id:"c1",name:"Mystery Club",category:"Unknown",status:"open"}]
      }
    });

    expect(textOf(tree.toJSON())).not.toContain("Mystery Club");

    await act(async()=>{tree.unmount();});
  });

  it("keeps the same item once it can be placed",async()=>{
    const tree=await openDiscover({
      tables:{
        activity_clubs:[{id:"c1",name:"Mystery Club",category:"Swimming",location:"Hove",status:"open"}]
      }
    });

    expect(textOf(tree.toJSON())).toContain("Mystery Club");
    expect(textOf(tree.toJSON())).toContain("In Hove");

    await act(async()=>{tree.unmount();});
  });

  it("instructs in an empty section rather than reporting an absence",async()=>{
    const tree=await openDiscover({});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Tap the heart on any place to keep it here.");
    expect(text.toLowerCase()).not.toContain("nothing here");

    await act(async()=>{tree.unmount();});
  });

  it("reads Saved from the same table the profile Collections tab reads",async()=>{
    const tree=await openDiscover({
      tables:{
        explorer_favourites:[
          {id:"f1",target_type:"business",target_id:"b1",target_name:"Kept Place",is_public:false}
        ]
      }
    });

    // Own list, so a private save still shows. The Collections tab filters
    // is_public because that is somebody else looking at your profile.
    expect(textOf(tree.toJSON())).toContain("Kept Place");
    expect(textOf(tree.toJSON())).toContain("You saved this");

    await act(async()=>{tree.unmount();});
  });

  it("says so when live activity could not be loaded",async()=>{
    installFixture({
      user:VIEWER,
      tables:{profiles:[{id:VIEWER.id,area:"Hove"}]}
    });
    const {supabase}=require("../services/supabase");
    supabase.rpc.mockImplementation((name)=>Promise.resolve(
      name==="get_live_discovery"
        ? {data:null,error:{message:"Explorer account required."}}
        : {data:null,error:null}
    ));

    const Screen=require("../app/discover").default;
    let tree;
    await act(async()=>{tree=create(wrap(React.createElement(Screen)));});
    await act(async()=>{});

    // An empty section would read as "nothing is happening", which is a
    // different and untrue statement.
    expect(textOf(tree.toJSON())).toContain("could not be loaded");

    await act(async()=>{tree.unmount();});
  });

  it("does not promise a Feed section it would have to maintain twice",async()=>{
    const tree=await openDiscover({});
    const labels=labelsOf(tree.toJSON()).join(" ");

    // app/feed.js already is that screen. Discover points at it.
    expect(labels).toContain("Open the Explorer feed");

    await act(async()=>{tree.unmount();});
  });
});
