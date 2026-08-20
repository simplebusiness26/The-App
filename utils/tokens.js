// XPLORER — THE RISO INSTRUMENT
//
// Every value in this file is transcribed from the artifact the product owner
// chose at the end of the UI tournament:
//
//   runs/the-app/2026-08-17T02-09-27-650Z/rounds/ui/blend-dewith-mengto-pins
//
// That entry's own thesis, in its own words: "The current riso-print system,
// EVOLVED into an instrument: the calm three-ink print language stays the floor
// everywhere, while the camera and map -- the app's two genuinely technical
// surfaces -- gain tick-mark dials, focus reticles and layer trays drawn in the
// same disciplined ink, so expert control reads as mechanically trustworthy
// rather than bolted on."
//
// READ THAT AGAIN BEFORE CHANGING ANYTHING HERE.
//
// The print language is the FLOOR, not the thing being replaced. Warm paper,
// flat inks, a real ink border and a hard offset shadow are the design. The
// instrument is what the camera and the map GAIN on top of it -- dials with
// tick marks, focus reticles, layer trays -- drawn in the same ink.
//
// A previous pass threw the print system away and built a near-black app with
// cyan and violet, on the reasoning that a redesign must not keep the
// incumbent's visual language. That reasoning was right in general and wrong
// here, because the winning entry IS the incumbent's language evolved -- it is
// what was chosen. Three passes were rejected before anyone opened the artifact
// and compared. So: the artifact is the specification. Where this file and a
// memory of the design disagree, open the artifact.
//
// THE ONE RULE ABOUT COLOUR
// Saturated ink means something. blue/pink/yellow say what state a PLACE is in
// and appear on the map. green/red are a manager's two answers to a review and
// appear nowhere near it. The heat ramp says how many PEOPLE are posting and
// lives on exactly one layer. Never spend an ink decoratively.

export const INK = {
  // ---- The print surface -------------------------------------------------
  // Newsprint, not white, and deliberately unconditional on the viewer's
  // theme: the artifact commits to one look.
  paper: "#E7E8E1",        // app background, map ground
  card: "#F3F3ED",         // cards, sheets, rows, the tab bar
  ink: "#16181C",          // text, and EVERY border
  inkSoft: "#63686F",      // secondary text, inactive controls
  hair: "#C9CBC2",         // the one lighter rule, for dividers inside a card

  // ---- The three state inks: what a place IS -----------------------------
  blue: "#2B4BE8",         // a place exists — business, property, park
  pink: "#FF3D6E",         // something is happening here — session, event, live
  yellow: "#FFC61A",       // a time-bound offer, expires itself

  // ---- The manager's two answers -----------------------------------------
  green: "#1E7A4C",        // a manager agreeing with a review
  red: "#C2321F",          // a manager disputing one

  // ---- Map terrain --------------------------------------------------------
  water: "#BFD1CF",
  park: "#C2CFAF",

  // ---- Semantic aliases ---------------------------------------------------
  // Added while the app was briefly built on a dark palette; kept because they
  // say what a colour MEANS rather than what it looks like, which is the better
  // name. They resolve to the artifact's inks.
  ground: "#E7E8E1",       // -> paper
  panel: "#F3F3ED",        // -> card
  panelRaised: "#FFFFFF",  // a card lifted off the page
  inset: "#E7E8E1",        // a well cut into a card reads as the paper below it
  hairline: "#16181C",     // an edge is INK in this system, not a grey line
  hairlineStrong: "#16181C",
  readout: "#16181C",      // -> ink
  readoutSoft: "#63686F",  // -> inkSoft
  readoutFaint: "#63686F",
  exists: "#2B4BE8",       // -> blue
  scheduled: "#FF3D6E",    // -> pink
  offer: "#FFC61A",        // -> yellow
  agree: "#1E7A4C",        // -> green
  dispute: "#C2321F",      // -> red
  land: "#E7E8E1",
  road: "#D8D9D2"
};

// THE HEAT RAMP. A continuous wash for public Moment density, cool to hot.
// One layer only: never a pin, a border, text or a background. The state inks
// say what a PLACE is; this says how many PEOPLE are posting.
export const HEAT_RAMP = [
  { at: 0.0, colour: "#1D3F8F" },
  { at: 0.3, colour: "#17A2B8" },
  { at: 0.5, colour: "#3FBF5F" },
  { at: 0.75, colour: "#F5B324" },
  { at: 1.0, colour: "#E8571F" }
];

// TYPE — the artifact's three faces.
//
// Archivo for display, Instrument Sans for body, Martian Mono for data. The
// mono/sans split is the tell that makes the app read as an instrument: if a
// person wrote it, Instrument Sans. If the app measured it, Martian Mono.
export const FONT = {
  display: "Archivo-Bold",
  displaySoft: "Archivo-SemiBold",
  body: "InstrumentSans-Regular",
  bodyMedium: "InstrumentSans-Medium",
  bodyStrong: "InstrumentSans-SemiBold",
  mono: "MartianMono-Regular",
  monoMedium: "MartianMono-Medium"
};

export const FONT_FILES = {
  "Archivo-Bold": require("../assets/fonts/Archivo-Bold.ttf"),
  "Archivo-SemiBold": require("../assets/fonts/Archivo-SemiBold.ttf"),
  "InstrumentSans-Regular": require("../assets/fonts/InstrumentSans-Regular.ttf"),
  "InstrumentSans-Medium": require("../assets/fonts/InstrumentSans-Medium.ttf"),
  "InstrumentSans-SemiBold": require("../assets/fonts/InstrumentSans-SemiBold.ttf"),
  "MartianMono-Regular": require("../assets/fonts/MartianMono-Regular.ttf"),
  "MartianMono-Medium": require("../assets/fonts/MartianMono-Medium.ttf")
};

export const TYPE = {
  display: { family: FONT.display, tracking: -0.01, sizes: { xl: 30, lg: 26, md: 18, sm: 15 } },
  body: { family: FONT.body, sizes: { lg: 14.5, md: 13.5, sm: 12.5 }, lineHeight: 1.5 },
  // The artifact sets mono at 10.5px with .06em tracking, uppercase.
  data: { family: FONT.mono, tracking: 0.06, sizes: { lg: 11.5, md: 10.5, sm: 9 } }
};

// SHAPE — printed, not machined.
//
// The border is INK and it is thick: 1.5px on most things, 2px on the ones that
// carry weight (a pin, a button, the tab bar's top edge, a sheet). Elevation is
// a HARD OFFSET SHADOW in ink -- the print register -- never a soft blur.
export const SHAPE = {
  radius: { control: 9, card: 14, sheet: 20, pill: 999, pin: 999 },
  border: 1.5,
  borderStrong: 2,
  shadow: {
    // 3px 3px 0 ink, and its smaller sibling. Written as React Native shadow
    // props AND kept as the raw offset, because a hard shadow needs
    // shadowRadius:0 and full opacity to stay a print register rather than
    // becoming a blur.
    hard: { shadowColor: "#16181C", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 3 }, elevation: 0 },
    hardSm: { shadowColor: "#16181C", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 2, height: 2 }, elevation: 0 },
    // The one genuinely floating thing: the map sheet over the map.
    floating: { shadowColor: "#16181C", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: -2 }, elevation: 0 }
  },
  // Kept for the kit's bevel highlight; on paper there is no bevel, so it is
  // transparent rather than a white line nobody asked for.
  edgeHighlight: "transparent",
  focusRing: { width: 2, color: "#2B4BE8", offset: 2 },
  tapTarget: 44,
  // The pin, transcribed exactly: 34px, 2px ink border, the state ink at 82%
  // over a real blur so the map reads through it.
  pin: { size: 34, border: 2, fillOpacity: 0.82, blur: 7 }
};

// MOTION — the artifact's own timings.
export const MOTION = {
  instant: 90,
  standard: 180,   // .18s, the pin's press transition
  sheet: 320,      // .32s, the sheet's snap
  easing: "cubic-bezier(.2,.9,.3,1)"
};
