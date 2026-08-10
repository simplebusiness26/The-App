// Packet 2 of docs/REDESIGN-BRIEF.md: marker assignment from type.
//
// The rule this file exists to hold, from design-system.md: colour carries
// STATE, the icon carries TYPE. A pin is a state, not a dot. If a business type
// ever starts choosing a colour, the three-ink rule is broken -- blue, pink and
// yellow stop meaning anything and become decoration.
//
// So the assignment is two independent lookups:
//
//   classification -> glyph   (utils/taxonomy.js owns which, this file draws it)
//   state          -> colour  (three inks, nothing else)
//
// Everything here is pure. Nothing reads the database, nothing holds state, and
// there is deliberately no way to pass a colour or a glyph in from outside --
// see scripts/verify-marker-assignment.cjs, which fails the build if a marker
// override appears anywhere.

import {classificationLabel,glyphForClassification,UNCLASSIFIED} from "./taxonomy";
import {INK} from "./tokens";
import {ACTIVITY_STATE_SENTENCE} from "./liveActivity";

// The three inks, and what each one means. These are the design system's, not
// this file's -- do not add a fourth.
//
// Nothing in the repository currently produces `offer`: no table records one.
// It is defined because the state vocabulary is design-system.md's and is
// meaningless with a third of it missing, and because MARKER_STATE_INK is what
// the contrast test checks. No screen renders an offer pin, so there is no dead
// control on screen -- only an unreached branch of a pure function.
export const MARKER_STATES={
  EXISTS:"exists",
  SCHEDULED:"scheduled",
  OFFER:"offer"
};

const MARKER_STATE_INK={
  [MARKER_STATES.EXISTS]:INK.blue,
  [MARKER_STATES.SCHEDULED]:INK.pink,
  [MARKER_STATES.OFFER]:INK.yellow
};

const MARKER_STATE_SENTENCE={
  [MARKER_STATES.EXISTS]:"A place that exists.",
  [MARKER_STATES.SCHEDULED]:"Something is scheduled here.",
  [MARKER_STATES.OFFER]:"An offer is running."
};

// White is only legible on ink-blue and ink (design-system.md, accessibility
// floor: "Never white on ink-yellow"). Every other fill takes an ink glyph.
const GLYPH_INK_ON_WHITE_SAFE=[INK.blue,INK.ink];

// ---------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------
//
// Drawn as data rather than JSX so this module stays pure and testable, and so
// components/PlaceMarker.js is the only place that knows about react-native-svg.
// Each glyph is a list of primitives on a 16x16 canvas, stroked in the glyph
// ink -- flat, no gradients, matching the print register of the borders.
//
// Hand-authored because designer.md refuses a new icon set without asking. Keep
// them at this weight: a pin renders these at 16px inside a 34px circle.

const GLYPHS={
  // Food and drink
  cup:[
    {path:"M3.4 4.8h6.4v3.6a3.2 3.2 0 0 1-6.4 0z"},
    {path:"M9.8 5.6h1.3a1.5 1.5 0 0 1 0 3h-1.3"},
    {path:"M2.6 12.4h8.8"}
  ],
  cocktail:[
    {path:"M3.3 4.2h9.4L8 9.1z"},
    {path:"M8 9.1v3.6"},
    {path:"M5.6 12.7h4.8"}
  ],
  tankard:[
    {path:"M4 5h5.8v7.6H4z"},
    {path:"M9.8 6.9h1.5a1.7 1.7 0 0 1 0 3.4H9.8"},
    {path:"M4 7.5h5.8"}
  ],
  cutlery:[
    {path:"M4.8 3.2v3.3"},
    {path:"M7.2 3.2v3.3"},
    {path:"M4.6 6.5h2.8"},
    {path:"M6 6.5v6.3"},
    {path:"M11.2 3.2v9.6"},
    {path:"M11.2 3.2c1.5 1.3 1.5 4.4 0 5.5"}
  ],

  // Entertainment and nightlife
  note:[
    {path:"M6.4 12V3.9l6-1.4v8"},
    {circle:[4.8,12,1.7]},
    {circle:[10.8,10.5,1.7]}
  ],

  // Health and wellbeing
  leaf:[
    {path:"M12.8 3.2c.5 5.2-2.9 8.9-8 8.5-.5-5.2 2.9-8.9 8-8.5z"},
    {path:"M4.2 12.4 10.6 5.6"}
  ],

  // Shopping
  bag:[
    {path:"M3.4 5.6h9.2l.7 7.2H2.7z"},
    {path:"M5.9 5.6V4.4a2.1 2.1 0 0 1 4.2 0v1.2"}
  ],

  // Attractions and experiences
  star:[
    {path:"M8 2.6 9.7 6.1l3.9.5-2.8 2.7.7 3.8L8 11.3l-3.5 1.8.7-3.8-2.8-2.7 3.9-.5z"}
  ],

  // Essential local services
  signpost:[
    {path:"M8 2.8v10.4"},
    {path:"M8 4.4h4.2l1.4 1.5-1.4 1.5H8"},
    {path:"M8 8.6H3.8L2.4 10.1l1.4 1.5H8"}
  ],

  // Unclassified -- a place located but not described yet.
  ring:[
    {circle:[8,8,4.2]},
    {circle:[8,8,1.3],fill:true}
  ],

  // Places that are not businesses, so have no business_type to read.
  home:[
    {path:"M2.6 7.9 8 3.2l5.4 4.7"},
    {path:"M4.3 7.4v5.8h7.4V7.4"}
  ],
  people:[
    {circle:[6,5.9,2.1]},
    {path:"M2.5 13.2c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5"},
    {circle:[11.2,6.6,1.6]},
    {path:"M10.4 10c1.9 0 3.1 1.3 3.1 3.2"}
  ]
};

export function glyphNames(){
  return Object.keys(GLYPHS);
}

export function glyphPrimitives(name){
  return GLYPHS[name] || null;
}

// ---------------------------------------------------------------------------
// Marker assignment
// ---------------------------------------------------------------------------

// The one place a marker is built. Everything below is a thin caller.
//
// `claimed:false` is not an error state and is not a fourth ink: design-system
// .md gives it a dashed border on a card fill, "an invitation, not an error".
// The state is still recorded, so the pin can say what it is while saying that
// nobody manages it yet.
// `stateSentence` is deliberately NOT an override in the sense the gate bans.
// It cannot change the fill, the glyph or the state -- those are still derived
// here and nowhere else. It exists because Packet 8f1 needs to say "Happening
// now" and "Starting soon" on a pin whose ink is, correctly, the one ink the
// design system has for "something is scheduled here". The palette has three
// inks; the product describes four event states. Words carry the difference the
// colour cannot, which is the accessibility floor's position anyway.
function buildMarker({glyph,state,typeSentence,claimed,stateSentence}){
  const fill=claimed ? MARKER_STATE_INK[state] : INK.card;
  const glyphInk=GLYPH_INK_ON_WHITE_SAFE.includes(fill) ? INK.card : INK.ink;

  return {
    glyph,
    state,
    fill,
    glyphInk,
    border:INK.ink,
    borderStyle:claimed ? "solid" : "dashed",
    // Colour is never the only carrier of state (design-system.md,
    // accessibility floor). Every pin ships the sentence a screen reader gets.
    label:claimed
      ? `${typeSentence} ${stateSentence || MARKER_STATE_SENTENCE[state]}`
      : `${typeSentence} Nobody manages this yet.`
  };
}

// The type label a place shows on its page. Exported so a place page and its
// map pin cannot disagree about what the place is -- Packet 5's criterion
// "listing type displayed matches the map marker for the same record" holds by
// construction rather than by two files happening to agree.
export const PROPERTY_TYPE_LABEL="Property";
export const CLUB_TYPE_LABEL="Club";

// Events are not on the map yet -- app/map.js renders businesses, properties
// and clubs. The label lives here anyway so that when Packet 6 or 7 puts an
// event on the map it is forced to use the same word the event page shows,
// rather than inventing a second one. There is deliberately no markerForEvent()
// until something renders it.
export const EVENT_TYPE_LABEL="Event";
export const LINKUP_TYPE_LABEL="Link-up";

export function typeLabelForBusiness(business){
  return classificationLabel(business);
}

// Packet 2's pure function: a business's classification decides its glyph, and
// nothing about the classification touches the colour.
export function markerForBusiness(business){
  const category=business?.category || UNCLASSIFIED;
  const type=business?.business_type || UNCLASSIFIED;

  return buildMarker({
    glyph:glyphForClassification(category,type),
    state:MARKER_STATES.EXISTS,
    // classificationLabel falls back to the category when the type is
    // unclassified, so a food and drink place reads as "Food and drink." rather
    // than the useless "Not yet classified."
    typeSentence:`${typeLabelForBusiness(business)}.`,
    // businesses.claimed defaults to false in the database, so === true matches
    // it exactly: a query that forgets to select the column shows the pin as
    // unclaimed rather than inventing a manager for it.
    claimed:business?.claimed===true
  });
}

// A property is a place, so it exists in blue like any other. It has no
// business_type to read, so its glyph is fixed rather than assigned.
export function markerForProperty(){
  return buildMarker({
    glyph:"home",
    state:MARKER_STATES.EXISTS,
    typeSentence:`${PROPERTY_TYPE_LABEL}.`,
    claimed:true
  });
}

// A club is a recurring thing with sessions, which is "something scheduled
// here" -- pink, per the design system, not a colour of its own.
export function markerForClub(){
  return buildMarker({
    glyph:"people",
    state:MARKER_STATES.SCHEDULED,
    typeSentence:`${CLUB_TYPE_LABEL}.`,
    claimed:true
  });
}

// Packet 8b: a Memory on your own map.
//
// A Memory's two phases are NOT a marker state. It would be easy to give an
// archived Memory a different ink and call that state, but the three inks mean
// what is true of a *place* -- it exists, something is scheduled there, an offer
// is running -- and a Memory's phase is a fact about who may read a row. Adding
// a fourth meaning to the palette to express it would break the rule the whole
// packet-2 gate exists to hold. My Map says live or archived in words instead,
// which is also the only form a screen reader gets.
//
// It is blue because the place it records exists. Solid border: this is your own
// record and there is nothing unclaimed about it.
export const MEMORY_TYPE_LABEL="Memory";

// The Memory row carries `target_type` but not a business's category or type, so
// there is no classification to look up here. Only the two types whose glyph is
// fixed rather than assigned can be drawn honestly; everything else falls back
// to the ring, which already means "a place located but not described yet".
const MEMORY_GLYPHS={
  property:"home",
  activity_club:"people"
};

// Packet 8f1: something happening, on the living map.
//
// THE INK PROBLEM, STATED PLAINLY RATHER THAN SOLVED QUIETLY.
// design-system.md gives three inks and reserves one for offers, so there are
// two available for places and activity. CLAUDE.md describes events moving
// through "upcoming, starting soon, live, busy, finished" -- five states, and
// Link-ups, check-ins and club sessions have their own. Five into two does not
// go, and inventing a fourth ink is the one thing the palette rule forbids.
//
// So every activity pin is pink: something is scheduled or happening here,
// which is true of all of them and is exactly what that ink means. Whether it
// is live now, starting soon or later is carried by the pin's spoken label and
// by the card, never by colour alone. That is not a workaround -- the
// accessibility floor already requires the words -- but it does mean the map
// cannot currently show "live" and "later" apart at a glance, and that is a
// real product limitation the owner should decide on rather than something to
// paper over with a fourth colour.
export function markerForActivity(activity){
  return buildMarker({
    glyph:ACTIVITY_GLYPHS[activity?.kind] || "ring",
    state:MARKER_STATES.SCHEDULED,
    typeSentence:`${ACTIVITY_TYPE_LABEL[activity?.kind] || "Activity"}.`,
    claimed:true,
    stateSentence:ACTIVITY_STATE_SENTENCE[activity?.state]
  });
}

const ACTIVITY_GLYPHS={
  linkup:"people",
  checkin:"people",
  event:"star",
  activity:"people"
};

const ACTIVITY_TYPE_LABEL={
  linkup:LINKUP_TYPE_LABEL,
  checkin:"Explorer here now",
  event:EVENT_TYPE_LABEL,
  activity:CLUB_TYPE_LABEL
};

export function markerForMemory(memory){
  return buildMarker({
    glyph:MEMORY_GLYPHS[memory?.target_type] || "ring",
    state:MARKER_STATES.EXISTS,
    typeSentence:`${MEMORY_TYPE_LABEL}.`,
    claimed:true
  });
}
