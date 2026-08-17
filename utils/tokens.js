// XPLORER — FIELD INSTRUMENT
//
// The design system chosen by the DesignLab tournament (de With's "instrument"
// concept, with Meng To's frosted-glass map pins grafted on). It SUPERSEDES the
// riso-print system that used to live here and in docs/design-system.md.
//
// THE IDEA, IN ONE SENTENCE
// Xplorer is a precision field instrument for reading your local area: a calm
// dark housing so the map and its readings are the only lit things on screen,
// hairline etched rules instead of printed borders, and measured data set in
// mono because an instrument is read, not just looked at.
//
// WHAT CHANGED FROM THE OLD SYSTEM, AND WHY
// The riso system was warm paper, flat inks, 2px black borders on everything and
// hard 3px offset shadows -- a printed flyer. It was coherent, but it made every
// surface shout equally and left no room for "this reading is live". The
// instrument inverts that: the housing recedes to near-black, borders drop to a
// 1px etched hairline, elevation comes from layered surface tones rather than
// print offset, and saturated colour is spent only on state -- what a place IS,
// and whether something is happening there right now.
//
// COMPATIBILITY
// The INK export keeps every key the old palette had, so no import breaks while
// screens migrate. Those old keys now carry instrument values (paper is dark,
// ink is the light readout). New, semantically honest names sit alongside them
// -- prefer INK.exists over INK.blue, INK.hairline over INK.hair in new code.
//
// THE ONE RULE WORTH KEEPING FROM BEFORE
// Saturated colour means something. exists/scheduled/offer say what state a
// PLACE is in and appear on the map. agree/dispute are a manager's two answers
// to a review and appear nowhere near the map. The heat ramp says how many
// PEOPLE are posting, and lives on exactly one layer. Never spend these
// decoratively -- a nice heading is not a state.

export const INK = {
  // ---- Surfaces: the housing -------------------------------------------
  // Cool graphite, not warm paper. Four steps so depth reads without shadows.
  ground: "#0F1216",        // app background, map housing
  panel: "#161B22",         // cards, sheets, rows
  panelRaised: "#1E252E",   // nested cards, raised chrome, pressed states
  inset: "#0B0E12",         // inputs, wells, the viewfinder ground

  // ---- Lines: the etched rule ------------------------------------------
  // 1px hairlines replace the old 2px ink border. This is the single biggest
  // visual difference from the print system and the reason the UI reads as
  // machined rather than stamped.
  hairline: "#262E38",
  hairlineStrong: "#38424E",

  // ---- Text: the backlit readout ---------------------------------------
  readout: "#E8EDF2",       // primary text
  readoutSoft: "#97A3B2",   // secondary text, metadata
  readoutFaint: "#616E7D",  // tertiary, mono captions, disabled

  // ---- State inks: what a place IS -------------------------------------
  // Cool = static fact, warm = live and temporal. Only these three appear on
  // the map as pin colour, and never for decoration.
  exists: "#4CC9E8",        // a place exists — business, property, park
  scheduled: "#FFAB2E",     // something is happening here — session, event, live
  offer: "#A78BFA",         // a time-bound offer, expires itself

  // ---- Map terrain ------------------------------------------------------
  // Desaturated near to the housing so the state inks stay the brightest thing
  // on the map. The dark map style in utils/mapProvider.js is built from these.
  water: "#10202C",
  park: "#142218",
  land: "#12161C",
  road: "#1C2430",

  // ---- The manager's two answers ---------------------------------------
  // Exactly two jobs: a manager agreeing with a review, and disputing one. They
  // appear together or not at all, never on the map, never as generic
  // success/error. Admin approve/reject uses `exists`, not these.
  agree: "#3FBF7F",
  dispute: "#F2555A",

  // ---- Compatibility aliases -------------------------------------------
  // Old keys, instrument values. Kept so nothing breaks mid-migration.
  paper: "#0F1216",         // was warm paper; now the housing
  card: "#161B22",
  ink: "#E8EDF2",           // was near-black on light; now light on dark
  inkSoft: "#97A3B2",
  hair: "#262E38",
  blue: "#4CC9E8",          // -> exists
  pink: "#FFAB2E",          // -> scheduled
  yellow: "#A78BFA",        // -> offer
  green: "#3FBF7F",         // -> agree
  red: "#F2555A"            // -> dispute
};

// THE HEAT RAMP, AND WHY IT IS STILL NOT ONE OF THE STATE INKS.
//
// The owner asked for a continuous wash running cool to hot as more public
// Moments are posted in an area. That still needs a ramp: flat steps read as
// categories, and one colour at five opacities cannot show quiet vs packed at a
// glance. Re-keyed for the dark housing -- the old ramp's mid greens and yellows
// glowed against dark and pulled attention off the pins.
//
// It exists for exactly one layer. Never a pin, a border, text or a background.
// The state inks say what a PLACE is; this says how many PEOPLE are posting.
// Different questions, so they never share a colour.
export const HEAT_RAMP = [
  { at: 0.0, colour: "#22346E" },  // barely anything
  { at: 0.3, colour: "#16717F" },  // some
  { at: 0.5, colour: "#2A9457" },  // busy
  { at: 0.75, colour: "#C89A22" }, // very busy
  { at: 1.0, colour: "#E0543A" }   // the hottest thing on screen
];

// TYPE — three faces, three jobs, same discipline as before, new voices.
//
// The mono/sans split is the tell that makes the app feel like an instrument:
// if a human wrote it, it is Body. If the app measured it, it is Data. That
// rule survived the redesign because it was the old system's best idea.
export const TYPE = {
  display: {
    family: 'InterTight-Bold, "Inter Tight", SF Pro Display, Roboto Condensed, system-ui, sans-serif',
    tracking: -0.02,
    sizes: { xl: 30, lg: 22, md: 17, sm: 15 }
  },
  body: {
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sizes: { lg: 15, md: 13.5, sm: 12.5 },
    lineHeight: 1.5
  },
  // Everything the system measured: distance, time, counts, status, category,
  // coordinates. Uppercase, wide tracking, small.
  data: {
    family: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Roboto Mono, monospace',
    tracking: 0.08,
    sizes: { lg: 12, md: 10.5, sm: 9.5 }
  }
};

// SHAPE — machined, not printed.
export const SHAPE = {
  radius: { control: 6, card: 10, sheet: 14, pill: 999, pin: 999 },
  // One hairline, everywhere. The old system's 2px ink border is gone.
  border: 1,
  // Elevation is layering plus a 1px top highlight, like a bevelled panel edge.
  // No hard offset shadow -- that belonged to the print system.
  edgeHighlight: "rgba(255,255,255,0.06)",
  shadow: {
    // Reserved for genuinely floating things (sheets, the Create action).
    floating: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }
  },
  focusRing: { width: 2, color: "#4CC9E8", offset: 2 },
  tapTarget: 44
};

// MOTION — precise and damped. An instrument responds; it does not perform.
export const MOTION = {
  instant: 90,    // press feedback, toggles
  standard: 140,  // most transitions
  sheet: 320,     // the map sheet's snap, spring-eased
  easing: "cubic-bezier(.2,.8,.2,1)"
};
