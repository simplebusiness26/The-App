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
import {INK,SHAPE,HEAT_RAMP} from "./tokens";
import {BASE_WEIGHT,MAX_WEIGHT} from "./heatmap";
import {ACTIVITY_STATE_SENTENCE} from "./liveActivity";

// The three inks, and what each one means. These are the design system's, not
// this file's -- do not add a fourth.
//
// Resolved 2026-08-10, the palette decision DOC-AMENDMENTS.md had left open:
// **riso stays**. Twelve packets are built on this table, the marker semantics
// here are better thought through than the brief's, and switching would
// invalidate the token table, this file and every tokenised screen. The brief's
// structural ideas were already ported; its colours were not.
//
// The cost of keeping three inks is that the product describes more states than
// there are colours. That is paid by the overprint (a second channel) and by
// every pin carrying a spoken sentence -- never by a fourth ink.
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

// WHICH GLYPH INK, AND WHY IT INVERTED.
//
// Under the print system the pins were saturated inks on warm paper, and the
// question was which of them white was legible on. The instrument inverts that
// completely: every state ink is now a BRIGHT colour on a near-black housing,
// so the contrast table in docs/design-system.md gives all three of them dark
// text -- `ground`, never `readout`. There is no exception, so there is no
// list any more. An unclaimed pin is the one that goes the other way: its fill
// is the panel surface, so its glyph is the light readout.

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
function buildMarker({glyph,letter,state,typeSentence,claimed,stateSentence,hosting}){
  const fill=claimed ? MARKER_STATE_INK[state] : INK.card;
  // WHICH GLYPH INK, TRANSCRIBED FROM THE ARTIFACT.
  //
  //   .pin-blue   { background:rgba(43,75,232,.82); color:#fff; }
  //   .pin-pink   { background:rgba(255,61,110,.82); color:var(--ink); }
  //   .pin-yellow { background:rgba(255,198,26,.82); color:var(--ink); }
  //   .pin-dashed { background:rgba(243,243,237,.7); color:var(--ink-soft); }
  //
  // Blue is dark enough to take white; pink and yellow are not, and take ink.
  // This is a per-ink answer, not a rule with one branch -- a previous pass
  // collapsed it to "all filled inks take dark text", which is right on a dark
  // housing and wrong on this one.
  const glyphInk=!claimed
    ? INK.inkSoft
    : state===MARKER_STATES.EXISTS ? "#FFFFFF" : INK.ink;

  return {
    glyph,
    // THE PIN CARRIES A LETTER, NOT A PICTURE.
    //
    // The artifact draws its pin face as one mono capital sized to the disc:
    //
    //   var PIN_GLYPH = {business:'B', property:'P', club:'C', event:'E', place:'L'};
    //   '<span class="mono" style="font-size:12px;letter-spacing:0">'+PIN_GLYPH[p.type]+'</span>'
    //
    // -- runs/.../rounds/ui/blend-dewith-mengto-pins/artifact.html, renderMap().
    //
    // This map used to draw a category picture instead: a cup for a cafe, a
    // leaf for a gym, a bag for a shop. That is more information per pin, and
    // it is not the design that won. A letter is legible at 34px in a way a
    // six-subpath drawing is not, it says the one thing the map legend is
    // about (what KIND of listing this is), and category detail is on the
    // place page one tap away. `glyph` is kept alongside because cards,
    // rows and the Discover well still draw the category mark at sizes where
    // it reads -- it is only the pin face that is typographic.
    letter,
    state,
    fill,
    glyphInk,
    // A HAIRLINE, NOT A PRINT REGISTER. This was INK.ink at 2px -- and INK.ink
    // is the near-white readout colour now, so every pin on the map wore a
    // white ring. A claimed pin's edge is the housing itself, which reads as
    // the pin being cut out of the map; an unclaimed one keeps the dashed
    // hairline the design system asks for.
    // Every pin carries the same 2px ink border, claimed or not; the dashed
    // one differs only in its border STYLE. The artifact draws no other edge.
    border:INK.ink,
    borderStyle:claimed ? "solid" : "dashed",
    // design-system.md's overprint: "a place hosting something". It is a second
    // channel rather than a fourth ink, which is how the map can show "happening
    // now" apart from "on Saturday" without growing the palette. Derived here
    // like everything else -- a caller cannot switch it on.
    overprint:hosting===true,
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
    letter:"B",
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
    letter:"P",
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
    letter:"C",
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
    letter:ACTIVITY_LETTER[activity?.kind] || "E",
    state:MARKER_STATES.SCHEDULED,
    typeSentence:`${ACTIVITY_TYPE_LABEL[activity?.kind] || "Activity"}.`,
    claimed:true,
    stateSentence:ACTIVITY_STATE_SENTENCE[activity?.state],
    // Happening right now gets the overprint. Starting soon and scheduled do
    // not: the signature has to mean one thing, and "on at this moment" is the
    // distinction the map could not previously draw at all.
    hosting:activity?.state==="live"
  });
}

const ACTIVITY_GLYPHS={
  linkup:"people",
  checkin:"people",
  event:"star",
  activity:"people"
};

// The artifact's table names five kinds; this app has more things on its map
// than the artifact's demo did, so the two it never had to draw get the letter
// their own noun starts with -- K for a Link-up (L is taken by a public place),
// and E for an event, which is the artifact's own choice.
const ACTIVITY_LETTER={
  linkup:"K",
  checkin:"H",   // an explorer HERE now
  event:"E",
  activity:"C"
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
    letter:"M",
    state:MARKER_STATES.EXISTS,
    typeSentence:`${MEMORY_TYPE_LABEL}.`,
    claimed:true
  });
}

// A Moment on the map.
//
// Pink, and that is not decoration. MARKER_STATES.SCHEDULED means "something is
// happening here", which is exactly what a Moment records and is the same thing
// the activity pins say -- so a Moment reads as part of the living layer rather
// than as another place. A Memory is blue because it records a place that
// exists and is not itself an event.
//
// The star glyph is the only one in the table that means "worth marking" rather
// than a kind of venue, which is the honest choice for a post about a place
// rather than the place itself.
export const MOMENT_TYPE_LABEL="Moment";

export function markerForMoment(){
  return buildMarker({
    glyph:"star",
    letter:"O",
    state:MARKER_STATES.SCHEDULED,
    typeSentence:`${MOMENT_TYPE_LABEL}.`,
    stateSentence:"Somebody posted from here.",
    claimed:true
  });
}

// Heat: how much has happened around a point, as ground rather than as a pin.
//
// It is NOT a marker and deliberately does not go through buildMarker. A marker
// says something about a PLACE -- it exists, something is scheduled there -- and
// heat is not a place; it is a count of what people have posted nearby. Giving
// it a pin's shape and one of the pin inks would make the map say two different
// things with one colour.
//
// Yellow because it is the one ink in the table that no pin in this app
// currently uses: nothing produces an offer, so yellow is free to mean this
// without colliding. Every cell still carries a sentence, because colour is
// never the only carrier of meaning.
// How a route is drawn. Here for the same reason heatAppearance is: the map
// renderers are forbidden from knowing what a colour MEANS
// (test/living-map-cross-platform.test.js bans INK.blue/pink/yellow in either
// of them), so the appearance is decided in this file and handed over.
//
// THE READOUT, not one of the three state inks. exists/scheduled/offer say what
// state a PLACE is in; a route is not a place and borrowing one would make the
// map lie. The casing is the housing colour, which on the dark map style keeps
// the line readable over land, water and heat alike -- the same job the old
// paper casing did on the light one, with the ground swapped.
export function routeAppearance(){
  return {
    colour:INK.ink,
    width:5,
    casingColour:INK.paper,
    casingWidth:9,
    label:"Your route"
  };
}

// How a live bubble is painted, and the confetti palette.
//
// Here rather than in either renderer for the usual reason: a renderer draws,
// it does not decide what a colour means, and test/living-map-cross-platform
// forbids INK.blue/pink/yellow appearing in one.
//
// THE CONFETTI IS A RECORDED EXCEPTION. docs/design-system.md says the three
// inks only ever say what state a PLACE is in and are never decoration. The
// owner asked for a celebration burst on a live Event and, told about the
// conflict, chose the confetti. So it exists, in exactly one place, fired once,
// only for an Event that is actually happening. It is a decision, not drift.
export function bubbleAppearance(){
  return {
    card:INK.card,
    ink:INK.ink,
    blank:INK.hair
  };
}

export function celebrationPieces(){
  return [
    {x:-26,y:-30,spin:"120deg",colour:INK.blue},
    {x:-9,y:-40,spin:"-90deg",colour:INK.pink},
    {x:10,y:-38,spin:"200deg",colour:INK.yellow},
    {x:26,y:-26,spin:"-140deg",colour:INK.blue},
    {x:-18,y:-16,spin:"70deg",colour:INK.yellow},
    {x:18,y:-14,spin:"-40deg",colour:INK.pink}
  ];
}

// How a cluster of pins is drawn: one circle with a number in it.
//
// THE HOUSING, NOT ONE OF THE THREE STATE INKS. exists/scheduled/offer say what
// state a PLACE is in (MARKER_STATES above). A cluster is not a place -- it is
// "there are nine things here, come closer" -- and borrowing a state colour
// would make the map claim nine businesses share a state they have not got.
//
// It carries its own sentence for the same reason every pin does: colour, and
// here size, is never the only carrier of meaning.
export function clusterAppearance(count){
  const many=Math.max(0,Number(count) || 0);

  return{
    fill:INK.card,
    border:INK.ink,
    ink:INK.ink,
    // 38px to 60px across. Big enough to read a two-digit number, never big
    // enough to be mistaken for the heat wash underneath it.
    size:Math.min(60,38+Math.min(many,40)*0.6),
    label:`${many} places here. Open to zoom in.`
  };
}

// HOW A CLUSTER IS PAINTED WHEN MAPLIBRE IS THE ONE COUNTING IT.
//
// clusterAppearance() above describes one circle the APP drew, at a size the
// app worked out. This describes the same circle as MapLibre style layers, for
// the built-in clustering on a `cluster:true` GeoJSON source -- which computes
// the groups itself, as the camera moves, and so cannot be handed a size per
// circle. The size becomes an expression on `point_count` instead.
//
// It is here, and not in either renderer, for the reason every appearance in
// this file is: a renderer draws, it does not decide what a colour means
// (test/living-map-cross-platform.test.js bans the state inks in both of them).
//
// The count is a symbol layer because there is nothing else to put a number
// into on a style layer. "Noto Sans Bold" is the face the map's own style
// bundles -- see assets/map/riso-paper.json -- so it is the one face that is
// certain to be there; the app's own mono is not on the tile server.
export function clusterPaint(){
  const look=clusterAppearance(0);

  return{
    // The group: one circle, growing with what is in it, and never big enough
    // to be mistaken for the heat wash underneath.
    circle:{
      "circle-color":look.fill,
      "circle-stroke-color":look.border,
      // The artifact's pin edge is 2px (var(--bw2)), and a group of pins is
      // still a pin. This was 1: a hairline read as a halo on the dark build
      // and reads as nothing at all on paper.
      "circle-stroke-width":SHAPE.borderStrong,
      "circle-radius":["interpolate",["linear"],["get","point_count"],2,19,40,30]
    },
    // The number on it. Size is never the only carrier of meaning.
    countLayout:{
      "text-field":["get","point_count_abbreviated"],
      "text-font":["Noto Sans Bold"],
      "text-size":13,
      "text-allow-overlap":true
    },
    countPaint:{"text-color":look.ink},
    // A point the built-in clustering left on its own -- supercluster does not
    // group a lone pin. It keeps its own state ink, carried on the feature, so
    // colour still means what it means at this zoom.
    lone:{
      "circle-color":["get","fill"],
      "circle-stroke-color":["get","border"],
      "circle-stroke-width":SHAPE.borderStrong,
      "circle-radius":9
    },
    // The type letter on a lone pin, so the GL map says the same thing the
    // React pin says. It is carried on the feature (clusterFeature below) for
    // the same reason the ink is: a style layer reads properties, it does not
    // know what a listing type is.
    loneLabel:{
      "text-field":["get","letter"],
      "text-font":["Noto Sans Bold"],
      "text-size":11,
      "text-allow-overlap":true
    },
    loneLabelPaint:{"text-color":["get","glyphInk"]}
  };
}

// A place, as a feature the clustering source can eat. The marker descriptor is
// already worked out by this file; this only flattens the values a style layer
// can read back out of a feature.
export function clusterFeature(place){
  const marker=place?.card?.marker || place?.marker || {};
  return{
    type:"Feature",
    properties:{
      fill:marker.fill || INK.panel,
      border:marker.border || INK.hairlineStrong,
      letter:marker.letter || "L",
      glyphInk:marker.glyphInk || INK.ink
    },
    geometry:{type:"Point",coordinates:[Number(place.longitude),Number(place.latitude)]}
  };
}

export function clusterPoints(places){
  return{
    type:"FeatureCollection",
    features:(places || [])
      .filter((place)=>Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude)))
      .map(clusterFeature)
  };
}

// HOW THE HEAT IS PAINTED.
//
// This replaces heatAppearance(), which described one flat yellow circle per
// ~1km grid square. The owner asked for Snapchat's heatmap and that is a
// different kind of object: a continuous density field, coloured through a
// ramp, with no edges. Both MapLibre GL JS and MapLibre Native draw that as a
// `heatmap` layer, so what is decided here is the PAINT and nothing else --
// neither renderer is allowed to know what a colour means.
//
// The ramp is HEAT_RAMP in utils/tokens.js, and it is a recorded exception to
// the three-ink rule rather than drift. See the note there and in
// docs/design-system.md.
//
// heatmap-density is a MapLibre expression: 0 where nothing is happening, 1 at
// the busiest point on screen. The first stop MUST be transparent or the whole
// map is tinted -- Snapchat's is a wash over the busy parts, not a filter over
// the world.
// ---------------------------------------------------------------------------
// THE HEAT DIAL: NOW -> WEEK
// ---------------------------------------------------------------------------
//
// The locked spec asks for "a real intensity/timeframe dial for the
// Moment-density heat ramp (Now->Week), MapLibre's heatmap-intensity/weight
// paint properties made adjustable". Both of those properties are real and both
// are genuinely driven from here.
//
// WHAT THE TIMEFRAME HONESTLY MEANS, AND WHAT IT DOES NOT
//
// get_moment_heat() (20260814000000) returns a position and one number --
// `attention` -- per live public Moment. It carries NO timestamp, deliberately:
// the less a layer every Explorer can see carries, the less it can leak. So the
// dial cannot filter the source by age, and pretending it does would be a lie
// drawn in colour.
//
// What it can do, and does, is choose WHICH QUESTION the wash answers, because
// attention is itself an accumulation:
//
//   NOW   every live Moment counts the same -- one. The wash is where people
//         are POSTING, and a single very popular post cannot own the map.
//   WEEK  each Moment counts for the attention it has gathered over its life,
//         which is what "this has been busy" means.
//
// The detents in between blend the two, and `heatmap-intensity` rises as the
// dial moves towards NOW because a flat weight puts less energy into the field
// and the busy patches would otherwise wash out.
//
// Neither renderer knows any of this. They pass the timeframe key through and
// get paint back, exactly as they do for a pin's ink.
export const HEAT_TIMEFRAMES=[
  {key:"now",label:"NOW",share:0,intensity:1.7,sentence:"Where Moments are being posted right now."},
  {key:"day",label:"DAY",share:0.35,intensity:1.35,sentence:"Posting, with some weight on what people are looking at."},
  {key:"3d",label:"3 DAYS",share:0.7,intensity:1.05,sentence:"Mostly what has gathered attention."},
  {key:"week",label:"WEEK",share:1,intensity:0.8,sentence:"Everything live, weighted by the attention it has gathered."}
];

export const DEFAULT_HEAT_TIMEFRAME="day";

export function heatTimeframe(key){
  return HEAT_TIMEFRAMES.find((entry)=>entry.key===key)
    || HEAT_TIMEFRAMES.find((entry)=>entry.key===DEFAULT_HEAT_TIMEFRAME);
}

export function heatmapPaint({opacity=0.55,radius=34,intensity,timeframe}={}){
  const colour=["interpolate",["linear"],["heatmap-density"],0,"rgba(0,0,0,0)"];
  for(const stop of HEAT_RAMP) colour.push(stop.at,stop.colour);

  const frame=heatTimeframe(timeframe);
  // The top of the weight range at this setting. At NOW it is 1, so every
  // Moment contributes exactly the same however popular it is; at WEEK it is
  // the full curve utils/heatmap.js computed.
  const top=1+frame.share*(MAX_WEIGHT-BASE_WEIGHT);

  return{
    "heatmap-color":colour,
    // Each Moment's own contribution, from utils/heatmap.js. A public Moment
    // counts for existing; attention adds on a curve -- and the dial decides
    // how much of that curve reaches the map. A real MapLibre expression, so
    // the interpolation happens in the renderer rather than in a re-fetch.
    "heatmap-weight":["interpolate",["linear"],["get","weight"],BASE_WEIGHT,1,MAX_WEIGHT,top],
    "heatmap-intensity":intensity ?? frame.intensity,
    // In pixels, so a blob is the same size on screen at every zoom -- which is
    // what makes zooming out gather the map into hotspots rather than shrink
    // them into specks.
    "heatmap-radius":radius,
    "heatmap-opacity":opacity
  };
}
