/* eslint-env jest */

// Packet 5a. These assertions exist so the shared place layout can be built
// without silently dropping a control.
//
// Written and watched fail BEFORE components/PlaceLayout.js existed, against
// the original hand-written screens, then re-run unchanged after the rewrite.
// That is the whole point: a refactor test that is written after the refactor
// only proves the new code does what the new code does.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");

const {installFixture,restoreRouterParams,textOf,labelsOf}=require("./fixture");

afterEach(restoreRouterParams);

const OWNER={id:"owner-1"};
const VISITOR={id:"visitor-1"};

const BUSINESS={
  id:"biz-1",
  name:"The Lamb and Flag",
  category:"food_and_drink",
  business_type:"pub",
  claimed:true,
  owner_id:OWNER.id,
  description:"A corner pub with a back room.",
  address:"12 Market Street",
  opening_hours:"Noon till late",
  phone:"01273 000000",
  website:"lambandflag.example",
  photos:["https://example.test/1.jpg"]
};

const PROPERTY={
  id:"prop-1",
  name:"Harbour Cottage",
  host:"Sam",
  owner_id:OWNER.id,
  description:"Two bedrooms, sea view.",
  address:"4 Harbour Road",
  photos:["https://example.test/2.jpg"]
};

const REVIEW={
  id:"rev-1",
  rating:5,
  name:"Alex",
  review_title:"Worth the walk",
  comment:"Quiet on a Tuesday.",
  created_at:"2026-07-01T12:00:00Z",
  moderation_status:"published",
  user_id:"visitor-1",
  points_awarded:3,
  verified_qr:true
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(
      FeedbackProvider,
      null,
      React.createElement(NotificationProvider,null,element)
    )
  );
}

async function render(modulePath){
  const Screen=require(modulePath).default;
  let tree;

  await act(async()=>{
    tree=create(wrap(React.createElement(Screen)));
  });

  // The loaders await several queries before their last setState. One act()
  // flushes the render and the effect that starts them; this one lets them
  // finish, so assertions see the loaded screen rather than its spinner.
  await act(async()=>{});

  return tree;
}

async function unmount(tree){
  await act(async()=>{tree.unmount();});
}

describe("the business place page",()=>{
  async function open({user,business=BUSINESS,reviews=[REVIEW]}){
    installFixture({
      user,
      params:{id:BUSINESS.id},
      tables:{
        businesses:business ? [business] : [],
        reviews,
        profiles:user ? [{id:user.id,account_type:"explorer"}] : [],
        explorer_favourites:[]
      }
    });
    return render("../app/business/[id]");
  }

  it("shows the place, its classification and its details",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("The Lamb and Flag");
    // The classification, not the raw key. This is also the criterion "listing
    // type displayed matches the map marker for the same record" -- both come
    // from classificationLabel().
    expect(text).toContain("Pub");
    expect(text).not.toContain("food_and_drink");
    expect(text).toContain("12 Market Street");
    expect(text).toContain("Noon till late");

    await unmount(tree);
  });

  it("keeps the review controls a visitor needs",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    // The success metric is completed experiences, and a verified review is
    // one. Losing this link in a refactor would be the most expensive
    // silent regression in the app.
    expect(text).toContain("Leave a Business Review");

    await unmount(tree);
  });

  it("offers a signed-in Explorer the favourite control",async()=>{
    const tree=await open({user:VISITOR});
    const labels=labelsOf(tree.toJSON()).join(" ");

    expect(labels).toContain("favourites");

    await unmount(tree);
  });

  it("renders published reviews with their rating and body",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Worth the walk");
    expect(text).toContain("Quiet on a Tuesday.");
    expect(text).toContain("Alex");

    await unmount(tree);
  });

  it("shows the owner an edit control and nobody else",async()=>{
    const asOwner=await open({user:OWNER});
    expect(textOf(asOwner.toJSON())).toContain("Edit");
    await unmount(asOwner);

    const asVisitor=await open({user:VISITOR});
    expect(textOf(asVisitor.toJSON())).not.toContain("Edit");
    await unmount(asVisitor);
  });

  it("offers the claim flow only on an unmanaged place",async()=>{
    const unclaimed=await open({
      user:VISITOR,
      business:{...BUSINESS,owner_id:null,claimed:false}
    });
    expect(textOf(unclaimed.toJSON()).toLowerCase()).toContain("claim");
    await unmount(unclaimed);

    const managed=await open({user:VISITOR});
    expect(textOf(managed.toJSON()).toLowerCase()).not.toContain("claim this");
    await unmount(managed);
  });

  it("says so when the place cannot be loaded",async()=>{
    const tree=await open({user:VISITOR,business:null});
    expect(textOf(tree.toJSON())).toContain("could not be loaded");
    await unmount(tree);
  });

  it("instructs rather than shrugs when there are no reviews",async()=>{
    const tree=await open({user:VISITOR,reviews:[]});
    const text=textOf(tree.toJSON());

    expect(text).toContain("No reviews yet");
    // "Empty states are instructions, not moods."
    expect(text).toContain("Be the first");

    await unmount(tree);
  });

  it("shows no later-stage controls",async()=>{
    // The brief draws Directions, Book a table and Get tickets on this page.
    // They are Stage Four and Stage Five, RULES.md bans placeholder UI for
    // later stages, and CLAUDE.md's approved-exceptions note cuts them
    // explicitly. This is the assertion that keeps them out.
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON()).toLowerCase();

    for(const banned of ["directions","book a table","get tickets","coming soon"]){
      expect(text).not.toContain(banned);
    }

    await unmount(tree);
  });
});

describe("the property place page",()=>{
  async function open({user,property=PROPERTY,reviews=[REVIEW]}){
    installFixture({
      user,
      params:{id:PROPERTY.id},
      tables:{
        properties:property ? [property] : [],
        reviews,
        profiles:user ? [{id:user.id,account_type:"explorer"}] : [],
        explorer_favourites:[]
      }
    });
    return render("../app/property/[id]");
  }

  it("shows the property and its details",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Harbour Cottage");
    expect(text).toContain("4 Harbour Road");

    await unmount(tree);
  });

  it("keeps the review control",async()=>{
    const tree=await open({user:VISITOR});
    expect(textOf(tree.toJSON())).toContain("Leave a Property Review");
    await unmount(tree);
  });

  it("shows the owner the printable QR route and nobody else",async()=>{
    const asOwner=await open({user:OWNER});
    expect(textOf(asOwner.toJSON())).toContain("Printable");
    await unmount(asOwner);

    const asVisitor=await open({user:VISITOR});
    expect(textOf(asVisitor.toJSON())).not.toContain("Printable");
    await unmount(asVisitor);
  });

  it("never shows the verification code itself on the public page",async()=>{
    // The QR is the proof that somebody was on site. A public page that
    // rendered it would make every verified review forgeable from a sofa.
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("not displayed publicly");

    await unmount(tree);
  });

  it("says so when the property cannot be loaded",async()=>{
    const tree=await open({user:VISITOR,property:null});
    expect(textOf(tree.toJSON())).toContain("could not be loaded");
    await unmount(tree);
  });
});

// ---------------------------------------------------------------------------
// Packet 5b. Same discipline as 5a: these were written and watched failing
// against the original app/events/[id].js and app/activity-clubs/[id].js
// before either was touched.
// ---------------------------------------------------------------------------

const MANAGER={id:"manager-1"};

const STARTED_EVENT={
  id:"evt-1",
  name:"Harbour Night Market",
  category:"Market",
  status:"published",
  manager_id:MANAGER.id,
  description:"Stalls along the quay.",
  location:"The Quay",
  address:"Harbour Road",
  starts_at:"2026-07-01T18:00:00Z",
  ends_at:"2026-07-01T22:00:00Z",
  price:0,
  capacity:200,
  image_url:"https://example.test/e.jpg",
  booking_url:"https://example.test/book"
};

const FUTURE_EVENT={...STARTED_EVENT,starts_at:"2099-01-01T18:00:00Z",ends_at:"2099-01-01T22:00:00Z"};

const EVENT_REVIEW={
  id:"erev-1",
  rating:4,
  reviewer_name:"Kit",
  review_title:"Busy but good",
  comment:"Go early.",
  created_at:"2026-07-02T10:00:00Z",
  user_id:"visitor-1",
  points_awarded:2,
  verified_qr:true
};

const CLUB={
  id:"club-1",
  name:"Tuesday Sea Swimmers",
  category:"Swimming",
  manager_id:MANAGER.id,
  description:"We swim, then we get chips.",
  location:"West Beach",
  address:"West Beach steps",
  price:0,
  member_limit:20,
  image_url:"https://example.test/c.jpg"
};

const CLUB_REVIEW={
  id:"crev-1",
  rating:5,
  reviewer_name:"Robin",
  review_title:"Friendly",
  comment:"Nobody minds if you are slow.",
  created_at:"2026-07-03T10:00:00Z",
  user_id:"visitor-1",
  points_awarded:4
};

describe("the event place page",()=>{
  async function open({user,event=STARTED_EVENT,reviews=[EVENT_REVIEW]}){
    installFixture({
      user,
      params:{id:STARTED_EVENT.id},
      tables:{
        events:event ? [event] : [],
        event_reviews:reviews,
        profiles:user ? [{id:user.id,account_type:"explorer"}] : [],
        explorer_favourites:[]
      }
    });
    return render("../app/events/[id]");
  }

  it("shows the event, when it is and where",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Harbour Night Market");
    expect(text).toContain("The Quay");
    expect(text).toContain("Market");

    await unmount(tree);
  });

  it("offers the review control once the event has started",async()=>{
    const tree=await open({user:VISITOR});
    expect(textOf(tree.toJSON())).toContain("Leave an Event Review");
    await unmount(tree);
  });

  it("says when reviews unlock instead of offering them early",async()=>{
    // Not a later-stage placeholder: reviews genuinely unlock when the event
    // starts, and saying so is state, which is what this app is built on.
    const tree=await open({user:VISITOR,event:FUTURE_EVENT});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Reviews unlock when the event starts");
    expect(text).not.toContain("Leave an Event Review");

    await unmount(tree);
  });

  it("shows manager controls only to the manager",async()=>{
    const asManager=await open({user:MANAGER});
    expect(textOf(asManager.toJSON())).toContain("Edit event");
    await unmount(asManager);

    const asVisitor=await open({user:VISITOR});
    expect(textOf(asVisitor.toJSON())).not.toContain("Edit event");
    await unmount(asVisitor);
  });

  it("renders published event reviews",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Kit");
    expect(text).toContain("Go early.");

    await unmount(tree);
  });

  it("offers the favourite control",async()=>{
    const tree=await open({user:VISITOR});
    expect(labelsOf(tree.toJSON()).join(" ")).toContain("favourites");
    await unmount(tree);
  });

  it("says so when the event cannot be found",async()=>{
    const tree=await open({user:VISITOR,event:null});
    expect(textOf(tree.toJSON()).toLowerCase()).toContain("could not be found");
    await unmount(tree);
  });

  it("shows no later-stage controls",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON()).toLowerCase();

    for(const banned of ["directions","book a table","get tickets","coming soon"]){
      expect(text).not.toContain(banned);
    }

    await unmount(tree);
  });
});

describe("the activity club place page",()=>{
  async function open({user,club=CLUB,membership=null,reviews=[CLUB_REVIEW],sessions=[],announcements=[]}){
    installFixture({
      user,
      params:{id:CLUB.id},
      tables:{
        activity_clubs:club ? [club] : [],
        activity_club_reviews:reviews,
        activity_sessions:sessions,
        activity_announcements:announcements,
        activity_club_stats:[{club_id:CLUB.id,member_count:6,spaces_remaining:14}],
        activity_memberships:membership ? [membership] : [],
        profiles:user ? [{id:user.id,account_type:"explorer",full_name:"Test Explorer"}] : [],
        explorer_favourites:[]
      }
    });
    return render("../app/activity-clubs/[id]");
  }

  it("shows the club, where it meets and what it costs",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Tuesday Sea Swimmers");
    expect(text).toContain("West Beach");
    expect(text).toContain("Free to attend");

    await unmount(tree);
  });

  it("shows how many members and spaces there are",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("6");
    expect(text).toContain("spaces left");

    await unmount(tree);
  });

  it("invites a non-member to request a place",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Request to join");
    expect(text).toContain("Send Join Request");

    await unmount(tree);
  });

  it("tells a pending applicant they are waiting",async()=>{
    const tree=await open({
      user:VISITOR,
      membership:{id:"m1",club_id:CLUB.id,user_id:VISITOR.id,status:"pending",applied_at:"2026-07-01T09:00:00Z",application_note:"I swim slowly"}
    });
    const text=textOf(tree.toJSON());

    expect(text).toContain("PENDING APPROVAL");
    expect(text).toContain("I swim slowly");
    expect(text).not.toContain("Send Join Request");

    await unmount(tree);
  });

  it("opens the private board only to approved members",async()=>{
    const approved=await open({
      user:VISITOR,
      membership:{id:"m1",club_id:CLUB.id,user_id:VISITOR.id,status:"approved"}
    });
    expect(textOf(approved.toJSON())).toContain("Message Board");
    await unmount(approved);

    const stranger=await open({user:VISITOR});
    expect(textOf(stranger.toJSON())).not.toContain("Message Board");
    await unmount(stranger);
  });

  it("offers the review control only to a member or former member",async()=>{
    const approved=await open({
      user:VISITOR,
      membership:{id:"m1",club_id:CLUB.id,user_id:VISITOR.id,status:"approved"}
    });
    expect(textOf(approved.toJSON())).toContain("Leave an Activity Club Review");
    await unmount(approved);

    const stranger=await open({user:VISITOR});
    expect(textOf(stranger.toJSON())).not.toContain("Leave an Activity Club Review");
    await unmount(stranger);
  });

  it("shows the manager their dashboard link and no join form",async()=>{
    const tree=await open({user:MANAGER});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Manager Dashboard");
    expect(text).not.toContain("Send Join Request");

    await unmount(tree);
  });

  it("lists upcoming sessions and announcements",async()=>{
    const tree=await open({
      user:VISITOR,
      sessions:[{id:"s1",club_id:CLUB.id,title:"Morning dip",starts_at:"2099-01-01T07:00:00Z",capacity:12}],
      announcements:[{id:"a1",club_id:CLUB.id,title:"Tide times",message:"High tide at seven."}]
    });
    const text=textOf(tree.toJSON());

    expect(text).toContain("Morning dip");
    expect(text).toContain("Tide times");
    expect(text).toContain("High tide at seven.");

    await unmount(tree);
  });

  it("renders published club reviews",async()=>{
    const tree=await open({user:VISITOR});
    const text=textOf(tree.toJSON());

    expect(text).toContain("Robin");
    expect(text).toContain("Nobody minds if you are slow.");

    await unmount(tree);
  });

  it("says so when the club cannot be loaded",async()=>{
    const tree=await open({user:VISITOR,club:null});
    expect(textOf(tree.toJSON())).toContain("could not be loaded");
    await unmount(tree);
  });
});
