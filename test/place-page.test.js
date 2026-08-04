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
