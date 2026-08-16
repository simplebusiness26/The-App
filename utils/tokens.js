// Alex Schleifer challenger palette: Night / Signal / Air.
//
// Product Truth still owns the semantic map channels. The candidate is free to
// own the rest of the interface, so the old riso-flyer palette is not the
// starting point for navigation, surfaces or hierarchy.
export const INK={
  // Whole-product identity.
  paper:"#F6F8FC",
  card:"#FFFFFF",
  ink:"#0A1020",
  inkSoft:"#667085",
  hair:"#D9E0EA",
  navy:"#0B132B",
  navySoft:"#18233F",
  onNavy:"#FFFFFF",
  onNavySoft:"#C7D0E1",
  brand:"#39D6A5",
  // Darkened slightly so small green text clears WCAG AA on white/paper.
  brandDeep:"#0B765D",
  // Darkened slightly so small violet labels clear WCAG AA on white/paper.
  lavender:"#6654E8",
  sky:"#DDE8FF",
  coral:"#FF6B5E",

  // Map base. Quiet by design so the semantic layers keep priority.
  water:"#D9E7EA",
  park:"#DCE8D4",

  // Product-state inks. These retain their frozen meaning and are not Alex
  // navigation/brand colours.
  blue:"#2B4BE8",
  pink:"#FF3D6E",
  yellow:"#FFC61A",

  // The existing manager review-response pair remains semantic too.
  green:"#1E7A4C",
  red:"#C2321F"
};

// Heat is data, not brand. Keeping this ramp unchanged protects the existing
// public-Moment density meaning and the map's tested interpretation.
export const HEAT_RAMP=[
  {at:0.0,colour:"#1D3F8F"},
  {at:0.3,colour:"#17A2B8"},
  {at:0.5,colour:"#3FBF5F"},
  {at:0.75,colour:"#F5B324"},
  {at:1.0,colour:"#E8571F"}
];