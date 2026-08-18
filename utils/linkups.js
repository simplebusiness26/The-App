export function toLocalInputValue(value){
  const date=value ? new Date(value) : new Date();
  if(Number.isNaN(date.getTime())) return "";
  const pad=number=>String(number).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localInputToIso(value){
  if(!value) return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatDateTime(value){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB",{
    weekday:"short",
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

export function effectiveLinkupStatus(linkup){
  if(!linkup) return "unavailable";
  if(linkup.status==="cancelled") return "cancelled";
  const now=Date.now();
  if(new Date(linkup.ends_at).getTime()<=now || linkup.status==="completed") return "completed";
  if(new Date(linkup.starts_at).getTime()<=now) return "happening";
  if(linkup.status==="full" || Number(linkup.attendee_count)>=Number(linkup.max_attendees)) return "full";
  return "upcoming";
}

export function statusLabel(status){
  if(status==="happening") return "Happening now";
  if(status==="full") return "Full";
  if(status==="cancelled") return "Cancelled";
  if(status==="completed") return "Completed";
  return "Upcoming";
}

export function timeUntil(value){
  const milliseconds=new Date(value).getTime()-Date.now();
  if(!Number.isFinite(milliseconds)) return "";
  if(milliseconds<=0) return "Now";
  const minutes=Math.ceil(milliseconds/60000);
  if(minutes<60) return `In ${minutes}m`;
  const hours=Math.ceil(minutes/60);
  if(hours<24) return `In ${hours}h`;
  const days=Math.ceil(hours/24);
  return `In ${days}d`;
}

// liveItemIcon() lived here and returned an emoji per item type. Its last
// caller went when app/live.js was rebuilt: an emoji carries a colour and a
// weight the platform chose, which on a dark instrument face reads as a sticker
// stuck to the housing. Item types map to drawn glyphs at the call site now --
// see Glyph and GLYPH_NAMES in components/instrument.js.
