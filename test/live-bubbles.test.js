/* eslint-env jest */

// The bubble controller.
//
// The thing being prevented is every marker deciding for itself whether to show
// a popup. Twenty pins in view and twenty popups is not a live map, and each of
// those twenty decisions would be made without knowing what the other nineteen
// were doing. So these are all questions the controller has to answer and a
// marker cannot.

const bubbles=require("../utils/liveBubbles");

function candidate(key,kind,latitude,longitude){
  return {key,kind,latitude,longitude};
}

// Far enough apart not to collide.
function spread(count,kind="review"){
  return Array.from({length:count},(_,i)=>candidate(`${kind}-${i}`,kind,50.85+i*0.05,0.57+i*0.05));
}

test("never shows more than three automatic bubbles",()=>{
  const many=spread(12);
  for(let tick=0;tick<12;tick+=1){
    expect(bubbles.bubblesAt(many,{tick}).length).toBeLessThanOrEqual(bubbles.MAX_AUTOMATIC_BUBBLES);
  }
});

test("rotates, so everything gets a turn rather than the top three for ever",()=>{
  const many=spread(9);
  const seen=new Set();

  for(let tick=0;tick<9;tick+=1){
    for(const shown of bubbles.bubblesAt(many,{tick})) seen.add(shown.key);
  }

  expect(seen.size).toBe(9);
});

test("the same tick always produces the same bubbles",()=>{
  const many=spread(9);
  const once=bubbles.bubblesAt(many,{tick:4}).map((b)=>b.key);
  const twice=bubbles.bubblesAt(many,{tick:4}).map((b)=>b.key);
  expect(once).toEqual(twice);
});

test("an event outranks a review, which outranks spaces and availability",()=>{
  const mixed=[
    candidate("p1","property",50.85,0.57),
    candidate("c1","activity_club",51.00,0.70),
    candidate("r1","review",51.20,0.90),
    candidate("e1","event",51.40,1.10)
  ];

  expect(bubbles.bubblesAt(mixed,{tick:0}).map((b)=>b.kind))
    .toEqual(["event","review","activity_club"]);
});

test("two things in the same spot do not stack bubbles on each other",()=>{
  const together=[
    candidate("a","review",50.8552,0.5729),
    // Well within the collision distance.
    candidate("b","review",50.8553,0.5730),
    candidate("c","review",50.9500,0.6500)
  ];

  const shown=bubbles.bubblesAt(together,{tick:0});
  expect(shown.length).toBe(2);
  expect(shown.map((b)=>b.key).sort()).toEqual(["a","c"]);
});

test("a bubble for something off screen is not drawn",()=>{
  const viewport={north:51.0,south:50.8,east:0.7,west:0.4};

  const some=[
    candidate("inside","review",50.86,0.57),
    candidate("north","review",55.00,0.57),
    candidate("west","review",50.86,-3.00)
  ];

  expect(bubbles.bubblesAt(some,{tick:0,viewport}).map((b)=>b.key)).toEqual(["inside"]);
});

test("no viewport yet means no filtering, not no bubbles",()=>{
  // A map that has not reported its bounds should still be able to show
  // something rather than sitting empty.
  expect(bubbles.bubblesAt(spread(3),{tick:0,viewport:null}).length).toBe(3);
});

test("a selected bubble is separate, and does not use up one of the three",()=>{
  const many=spread(9);
  const withSelection=bubbles.bubblesAt(many,{tick:0,selectedKey:"review-0"});

  // Still three automatic ones, and the selected one is not among them --
  // it stays open on its own because somebody opened it.
  expect(withSelection.length).toBe(3);
  expect(withSelection.map((b)=>b.key)).not.toContain("review-0");
});

test("nothing eligible means nothing shown, and no crash",()=>{
  expect(bubbles.bubblesAt([],{tick:0})).toEqual([]);
  expect(bubbles.bubblesAt(null,{tick:3})).toEqual([]);
  expect(bubbles.bubblesAt([null,undefined,{}],{tick:1})).toEqual([]);
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test("a review without an image never becomes a bubble",()=>{
  // The bubble IS the photo. A review with no photo has nothing to show, and
  // filling it with the text, the reviewer's name and a star rating is the
  // clutter this whole system exists to avoid.
  expect(bubbles.reviewIsEligible({media_url:"x.jpg",media_type:"image"})).toBe(true);
  expect(bubbles.reviewIsEligible({media_url:null,media_type:null})).toBe(false);
  expect(bubbles.reviewIsEligible({media_url:"x.mp4",media_type:"video"})).toBe(false);
  expect(bubbles.reviewIsEligible(null)).toBe(false);
});

test("a club bubbles only when its manager says there is room",()=>{
  expect(bubbles.clubIsEligible({spaces_available:true,status:"open"})).toBe(true);
  expect(bubbles.clubIsEligible({spaces_available:false,status:"open"})).toBe(false);
  // Off is "do not surface this", not "unknown" -- and a full club does not
  // advertise space whatever the toggle says.
  expect(bubbles.clubIsEligible({spaces_available:true,status:"full"})).toBe(false);
  expect(bubbles.clubIsEligible({})).toBe(false);
});

test("a property bubbles only when its manager turned it on",()=>{
  expect(bubbles.propertyIsEligible({show_availability:true})).toBe(true);
  expect(bubbles.propertyIsEligible({show_availability:false})).toBe(false);
  expect(bubbles.propertyIsEligible({})).toBe(false);
});

test("property availability says only what is actually known",()=>{
  // No invented inventory. Without a number it says the one true thing.
  expect(bubbles.propertyAvailabilityText({show_availability:true})).toBe("Available");
  expect(bubbles.propertyAvailabilityText({rooms_available:1})).toBe("Room available");
  expect(bubbles.propertyAvailabilityText({rooms_available:2})).toBe("2 rooms");
  expect(bubbles.propertyAvailabilityText({rooms_available:0})).toBe("Available");
  expect(bubbles.propertyAvailabilityText({rooms_available:"lots"})).toBe("Available");
});

test("an event says which of the three states it is in, or nothing",()=>{
  const now=Date.parse("2026-08-13T19:00:00Z");
  const at=(offsetMinutes)=>new Date(now+offsetMinutes*60000).toISOString();

  expect(bubbles.eventBubbleText({starts_at:at(-30),ends_at:at(60)},now)).toBe("Happening now");
  expect(bubbles.eventBubbleText({starts_at:at(30),ends_at:at(120)},now)).toBe("Starting soon");
  expect(bubbles.eventBubbleText({starts_at:at(180),ends_at:at(300)},now)).toBe("Tonight");
  // Tomorrow is not a live state.
  expect(bubbles.eventBubbleText({starts_at:at(60*30),ends_at:at(60*31)},now)).toBe("");
  // Over.
  expect(bubbles.eventBubbleText({starts_at:at(-300),ends_at:at(-120)},now)).toBe("");
});

test("only an event actually happening gets the celebration",()=>{
  const now=Date.parse("2026-08-13T19:00:00Z");
  const at=(offsetMinutes)=>new Date(now+offsetMinutes*60000).toISOString();

  expect(bubbles.eventDeservesCelebration({starts_at:at(-30),ends_at:at(60)},now)).toBe(true);
  // "Tonight" is not a thing to let off confetti about.
  expect(bubbles.eventDeservesCelebration({starts_at:at(180),ends_at:at(300)},now)).toBe(false);
  expect(bubbles.eventDeservesCelebration({starts_at:at(30),ends_at:at(120)},now)).toBe(false);
});

// ---------------------------------------------------------------------------
// Zoom, and the pin a bubble belongs to
// ---------------------------------------------------------------------------
//
// The owner, on the Android build: "you got pop ups that aren't even at the
// location, they're just popping up in random places, and they're also popping
// up when you're so far out the map". Both halves are below.

test("far out shows one bubble, a street shows three",()=>{
  const many=spread(9);

  expect(bubbles.bubblesAt(many,{tick:0,zoom:9}).length).toBe(1);
  expect(bubbles.bubblesAt(many,{tick:0,zoom:13}).length).toBe(2);
  expect(bubbles.bubblesAt(many,{tick:0,zoom:16}).length).toBe(3);
});

test("a bubble may not point at a pin that a cluster swallowed",()=>{
  const some=[
    {key:"review-1",kind:"review",anchorKey:"business-1",latitude:50.85,longitude:0.57},
    {key:"review-2",kind:"review",anchorKey:"business-2",latitude:51.20,longitude:0.90}
  ];

  // business-2 is inside a cluster, so only the first may surface.
  const shown=bubbles.bubblesAt(some,{tick:0,zoom:16,visibleAnchors:new Set(["business-1"])});
  expect(shown.map((entry)=>entry.key)).toEqual(["review-1"]);
});

test("with nothing drawn on its own, nothing bubbles at all",()=>{
  const some=[{key:"review-1",kind:"review",anchorKey:"business-1",latitude:50.85,longitude:0.57}];
  expect(bubbles.bubblesAt(some,{tick:0,zoom:16,visibleAnchors:new Set()})).toEqual([]);
});

// The map is drawn before it has reported a viewport, and a candidate written
// before this change carries no anchor. Neither may empty the map.
test("no anchor set given means no anchor filtering",()=>{
  const some=[{key:"review-1",kind:"review",anchorKey:"business-1",latitude:50.85,longitude:0.57}];
  expect(bubbles.bubblesAt(some,{tick:0,zoom:16}).length).toBe(1);
});

// Collision used to be a fixed 0.003 degrees -- "roughly 300m", which at county
// zoom is about two pixels. So the rule that was meant to stop bubbles
// overlapping did nothing at exactly the zoom being complained about.
test("two places a few hundred metres apart collide far out and not close in",()=>{
  const together=[
    {key:"a",kind:"review",latitude:50.8500,longitude:0.5700},
    {key:"b",kind:"review",latitude:50.8530,longitude:0.5700}
  ];

  expect(bubbles.bubblesAt(together,{tick:0,zoom:16}).length).toBe(2);
  expect(bubbles.bubblesAt(together,{tick:0,zoom:12,limit:3}).length).toBe(1);
});

// "I want a variety of bubbles" -- the photos are "too prominent". There are
// more reviews with photos than of anything else, and the old order was
// priority-then-key, so in practice the map showed photos, photos, photos.
test("three slots are three different kinds of thing, not three photos",()=>{
  const mixed=[
    ...Array.from({length:6},(_,i)=>candidate(`r-${i}`,"review",50.85+i*0.05,0.57+i*0.05)),
    candidate("e-1","event",52.10,1.60),
    candidate("c-1","activity_club",52.40,1.90)
  ];

  const kinds=bubbles.bubblesAt(mixed,{tick:0,zoom:16}).map((entry)=>entry.kind);
  expect(new Set(kinds).size).toBe(3);
  // The event still goes first: priority decides the order, it no longer
  // decides all three slots.
  expect(kinds[0]).toBe("event");
});

test("with one slot the most important kind still wins",()=>{
  const mixed=[
    candidate("r-1","review",50.85,0.57),
    candidate("e-1","event",52.10,1.60)
  ];

  expect(bubbles.bubblesAt(mixed,{tick:0,zoom:9}).map((entry)=>entry.kind)).toEqual(["event"]);
});

test("everything still gets a turn as the rotation advances",()=>{
  const many=spread(9);
  const seen=new Set();

  for(let tick=0;tick<9;tick+=1){
    for(const shown of bubbles.bubblesAt(many,{tick,zoom:16})) seen.add(shown.key);
  }

  expect(seen.size).toBe(9);
});
