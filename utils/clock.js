// WHAT THE APP MEASURED ABOUT *WHEN*.
//
// The instrument sets everything the app computed in the data face, and a time
// in the mono meta column of a Row has about twelve characters to say something
// useful. "18/08/2026, 21:41:06" is not it, and neither is "in about 2 hours".
//
// So: relative while relative is the more useful answer, absolute once it is
// not. "NOW" / "IN 40M" / "IN 2H" / "TONIGHT 19:30" / "20 AUG 19:30".
//
// WHY THIS FILE EXISTS
//
// It was written twice -- once in app/events/index.js as eventClock and once in
// app/activity-clubs/[id].js as sessionClock -- because two parallel rebuilds
// each needed it and neither owned utils/. They had already drifted: one
// printed a weekday and the other did not, so the same instant rendered as
// "THU 20 AUG 19:30" on a club and "20 AUG 19:30" on an event. Two copies of a
// formatter is two answers to "what time is it", which is exactly the kind of
// thing a design system is supposed to stop.
//
// The weekday is out. The meta column is narrow, and "THU, 20 AUG 03:37" pushed
// the whole row's text across; the weekday survives in the full date line under
// the row, where there is space for it.

// Past this, a countdown stops being the more useful answer and a clock time
// starts being one. Six hours is roughly "later today" -- near enough that
// "IN 5H" means something, far enough that "IN 320M" does not.
export const RELATIVE_WINDOW_MS=6*60*60*1000;

export function shortClock(value,now=Date.now()){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";

  const ms=date.getTime()-now;
  const time=date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});

  if(ms<=0) return "NOW";
  if(ms<60*60*1000) return `IN ${Math.max(1,Math.round(ms/60000))}M`;
  if(ms<RELATIVE_WINDOW_MS) return `IN ${Math.round(ms/3600000)}H`;

  const today=new Date(now);
  if(date.toDateString()===today.toDateString()){
    // "Tonight" is a real word people use and "today 21:00" is not, so the
    // label follows the hour rather than the calendar.
    return `${date.getHours()>=17?"TONIGHT":"TODAY"} ${time}`;
  }

  const day=date.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  return `${day.toUpperCase()} ${time}`;
}

// True while shortClock() is still counting down, which is exactly when a full
// date under the row is telling you something the meta column has not. Once the
// meta IS a date, printing the date again underneath it is noise.
export function needsFullDate(value,now=Date.now()){
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return false;
  return date.getTime()-now<RELATIVE_WINDOW_MS;
}
