// The Memories map, moving through time.
//
// A Memory answers "what happened here?" -- past tense, permanent. Filtering
// the map to Memories switches it into a historical mode with a slider, and
// moving that slider backwards changes which Memories are PROMINENT.
//
// PROMINENT. Not which exist. This whole file is presentation and nothing else:
// a Memory that has faded off the map is still in the scrapbook, still on the
// profile, still openable by its link, and still exactly as visible to whoever
// its audience allows. Nothing here expires, hides or deletes anything, and
// nothing here is consulted by any access decision.
//
// The rule is a rolling ten-day window around wherever the slider is:
//
//   |------ fading in ------|===== full =====|------ fading out ------|
//   -5 days              -3 days          +3 days                 +5 days
//
// Ten days wide, with the outer two days at each edge used for the fade. So a
// Memory arrives gradually as the slider approaches its date, sits at full
// strength while the slider is near it, and leaves gradually -- rather than
// snapping in and out, which on a dense map reads as flicker.

export const WINDOW_DAYS=10;
export const DAY_MS=24*60*60*1000;

// Half the window either side of the slider.
export const WINDOW_HALF_MS=(WINDOW_DAYS/2)*DAY_MS;

// How much of each half is spent fading rather than at full strength.
export const FADE_MS=2*DAY_MS;

// A faded Memory is never invisible while it is inside the window -- it dims to
// this and no further, so a dense area still reads as dense.
export const MIN_VISIBLE_OPACITY=0.15;

function timeOf(memory){
  // The date the Memory is ABOUT is when it was made. map_until is when it
  // stops being drawn on the live map and has nothing to do with history.
  const value=memory?.created_at ?? memory?.createdAt;
  const at=new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

// How prominent this Memory is with the slider at `at`. 0 means "outside the
// window", which means not drawn -- not deleted, not expired, not hidden from
// anybody. Just not on this particular view of the map.
export function memoryProminence(memory,at){
  const made=timeOf(memory);
  if(made===null) return 0;

  const when=Number(at);
  if(!Number.isFinite(when)) return 0;

  const distance=Math.abs(when-made);
  if(distance>WINDOW_HALF_MS) return 0;

  const fullUntil=WINDOW_HALF_MS-FADE_MS;
  if(distance<=fullUntil) return 1;

  // Linear across the fade band, floored so it dims rather than vanishes.
  const throughFade=(distance-fullUntil)/FADE_MS;
  return Math.max(MIN_VISIBLE_OPACITY,1-throughFade);
}

export function isWithinWindow(memory,at){
  return memoryProminence(memory,at)>0;
}

// The Memories the slider is currently over, each carrying its prominence.
// Sorted newest first so that when two sit on the same spot the more recent one
// draws on top.
export function memoriesAt(memories,at){
  return (memories || [])
    .map((memory)=>({memory,prominence:memoryProminence(memory,at)}))
    .filter((entry)=>entry.prominence>0)
    .sort((a,b)=>(timeOf(b.memory) || 0)-(timeOf(a.memory) || 0));
}

// ---------------------------------------------------------------------------
// The slider's own range
// ---------------------------------------------------------------------------

// From the oldest Memory to now. A slider whose range is a fixed number of days
// would run off the end of somebody's history in either direction: an Explorer
// with one Memory from last year needs the handle to reach it.
export function timelineRange(memories,now=Date.now()){
  const times=(memories || []).map(timeOf).filter((value)=>value!==null);

  if(!times.length) return {from:now,to:now,empty:true};

  const oldest=Math.min(...times);
  const newest=Math.max(...times,now);

  // Half a window of headroom at the old end, so the oldest Memory can reach
  // full strength rather than sitting permanently half-faded at the very edge.
  return {from:oldest-WINDOW_HALF_MS,to:newest,empty:false};
}

// Where on the slider a given moment sits, 0 to 1.
export function positionOf(at,range){
  if(!range || range.empty) return 1;
  const span=range.to-range.from;
  if(span<=0) return 1;
  return Math.min(1,Math.max(0,(Number(at)-range.from)/span));
}

export function timeAtPosition(position,range){
  if(!range || range.empty) return range?.to ?? Date.now();
  const span=range.to-range.from;
  const clamped=Math.min(1,Math.max(0,Number(position) || 0));
  return range.from+span*clamped;
}

export function timelineLabel(at){
  const date=new Date(Number(at));
  if(!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
}
