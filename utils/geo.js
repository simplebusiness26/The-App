// Ordering places by rough distance.
//
// This was written twice in Packet 5a, once on the business page and once on
// the property page, and left duplicated on purpose: RULES.md says two similar
// things stay duplicated until there are three. Packet 6 is the third caller,
// so it moves here.
//
// Squared degrees, not metres. It is adequate for ranking a dozen places in one
// town and it avoids pretending to a precision the coordinates do not have --
// check-in coordinates are deliberately rounded to about three decimal places
// before storage.

export function distanceRank(origin,row){
  const lat=Number(origin?.latitude);
  const lng=Number(origin?.longitude);
  const rowLat=Number(row?.latitude);
  const rowLng=Number(row?.longitude);

  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.MAX_SAFE_INTEGER;
  // A row with no coordinates sorts last rather than being dropped. A place
  // whose position nobody has recorded is still a place.
  if(!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return Number.MAX_SAFE_INTEGER;

  return (rowLat-lat)**2+(rowLng-lng)**2;
}

export function nearestFirst(origin,rows){
  const lat=Number(origin?.latitude);
  const lng=Number(origin?.longitude);

  // Without an origin there is no "nearest", so the given order is kept rather
  // than invented.
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return [...(rows || [])];

  return [...(rows || [])].sort((a,b)=>distanceRank(origin,a)-distanceRank(origin,b));
}
