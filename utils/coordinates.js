// Is this row somewhere?
//
// `Number(null)` is 0 and `Number.isFinite(0)` is true, so the obvious version
// of this check --
//
//   Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))
//
// -- accepts a row with no location and plots it at 0,0, in the Gulf of Guinea.
// The same applies to `""`, which `Number` also turns into 0. Packet 8b hit this
// on Memories, where a missing location is the common case rather than the edge
// one, and `app/map.js` carried the same shape for businesses, properties and
// clubs.
//
// Extracted because there were three copies (RULES.md: "Two similar things stay
// duplicated until there are three"), and because a subtlety like this is worth
// getting right in exactly one place.
//
// 0,0 is a real place, so a row that genuinely holds zeroes is kept. What is
// rejected is the absence of a value, not the value zero.

export function coordinate(value){
  if(value===null || value===undefined || value==="") return null;
  const parsed=Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasCoordinates(row){
  return coordinate(row?.latitude)!==null && coordinate(row?.longitude)!==null;
}
