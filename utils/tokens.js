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
  yellow:"#FFC61A"
};
