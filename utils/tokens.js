// The colour table from docs/design-system.md, in code.
//
// "Never introduce a colour outside this list. If something needs a new colour,
// the design is wrong." These values are copied from that file and must not
// drift from it -- scripts/verify-marker-assignment.cjs checks every hex in the
// design-system files against the table in the document itself.
//
// Packet 11 is the full design system pass and owns rolling the rest of the app
// onto these. This module exists now because Packet 3 became the second
// consumer: one file needing the palette is a local constant, two is a table.

export const INK={
  paper:"#E7E8E1",
  card:"#F3F3ED",
  ink:"#16181C",
  inkSoft:"#63686F",
  hair:"#C9CBC2",
  water:"#BFD1CF",
  park:"#C2CFAF",

  // The three inks. These mean something -- see MARKER_STATES in utils/markers.js.
  // They are never decoration, which is why nothing in the navigation shell uses
  // one: an active tab is a place you are, not a state a place is in.
  blue:"#2B4BE8",
  pink:"#FF3D6E",
  yellow:"#FFC61A",

  // Not map inks, and not decoration either -- see design-system.md. These are
  // the manager's two answers to a review: green agrees, red disputes. They
  // appear together or not at all, and nowhere else in the app.
  green:"#1E7A4C",
  red:"#C2321F"
};

// THE HEAT RAMP, AND WHY IT IS NOT ONE OF THE INKS.
//
// The owner asked for a heatmap "exactly like Snapchat's": a continuous wash
// running cool to hot as more public Moments are posted in an area. That needs
// a ramp -- five flat inks would read as steps nobody can interpret, and one
// ink at five opacities cannot show the difference between quiet and packed at
// a glance.
//
// So these are five colours that exist for exactly one layer. They are never a
// pin, a border, text or a background, and they must never be swapped for
// INK.blue/pink/yellow: those say what state a PLACE is in, and this says how
// many PEOPLE are posting. Different questions.
//
// Recorded as a deliberate exception in docs/design-system.md, alongside the
// green/red manager pair -- not left to be discovered.
export const HEAT_RAMP=[
  {at:0.0,colour:"#1D3F8F"},   // barely anything
  {at:0.3,colour:"#17A2B8"},   // some
  {at:0.5,colour:"#3FBF5F"},   // busy
  {at:0.75,colour:"#F5B324"},  // very busy
  {at:1.0,colour:"#E8571F"}    // the hottest thing on screen
];
