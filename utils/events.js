import {coordinate} from "./coordinates";
function pad(value){
  return String(value).padStart(2,"0");
}

export function parseLocalDateTime(dateValue,timeValue){
  const dateMatch=String(dateValue || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch=String(timeValue || "").trim().match(/^(\d{1,2}):(\d{2})$/);

  if(!dateMatch || !timeMatch) return null;

  const year=Number(dateMatch[1]);
  const month=Number(dateMatch[2]);
  const day=Number(dateMatch[3]);
  const hour=Number(timeMatch[1]);
  const minute=Number(timeMatch[2]);

  if(hour<0 || hour>23 || minute<0 || minute>59) return null;

  const value=new Date(year,month-1,day,hour,minute,0,0);
  const valid=value.getFullYear()===year
    && value.getMonth()===month-1
    && value.getDate()===day
    && value.getHours()===hour
    && value.getMinutes()===minute;

  return valid ? value : null;
}

export function toDateInput(value){
  if(!value) return "";
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export function toTimeInput(value){
  if(!value) return "";
  const date=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatEventDate(value){
  if(!value) return "Date to be confirmed";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Date to be confirmed";

  return date.toLocaleString([],{
    weekday:"short",
    day:"numeric",
    month:"short",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

export function formatEventRange(startsAt,endsAt){
  if(!endsAt) return formatEventDate(startsAt);

  const start=new Date(startsAt);
  const end=new Date(endsAt);

  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())){
    return formatEventDate(startsAt);
  }

  const sameDay=start.getFullYear()===end.getFullYear()
    && start.getMonth()===end.getMonth()
    && start.getDate()===end.getDate();

  if(sameDay){
    const day=start.toLocaleDateString([],{
      weekday:"short",
      day:"numeric",
      month:"short",
      year:"numeric"
    });
    const startTime=start.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const endTime=end.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return `${day} · ${startTime}–${endTime}`;
  }

  return `${formatEventDate(startsAt)} – ${formatEventDate(endsAt)}`;
}

export function formatEventPrice(value){
  const amount=Number(value || 0);
  return amount>0 ? `£${amount.toFixed(2)}` : "Free";
}

export function normalizeExternalUrl(value){
  const clean=String(value || "").trim();
  if(!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function isValidHttpUrl(value){
  if(!value) return true;

  try{
    const parsed=new URL(value);
    return parsed.protocol==="http:" || parsed.protocol==="https:";
  }catch{
    return false;
  }
}

export function createDefaultEventForm(){
  const start=new Date(Date.now()+24*60*60*1000);
  start.setHours(10,0,0,0);

  return{
    name:"",
    category:"Community",
    description:"",
    location:"",
    address:"",
    latitude:null,
    longitude:null,
    startDate:toDateInput(start),
    startTime:toTimeInput(start),
    endDate:"",
    endTime:"",
    price:"0",
    capacity:"",
    bookingUrl:"",
    imageUrl:"",
    status:"published"
  };
}

export function eventToForm(event){
  return{
    name:event?.name || "",
    category:event?.category || "Community",
    description:event?.description || "",
    location:event?.location || "",
    address:event?.address || "",
    latitude:event?.latitude ?? null,
    longitude:event?.longitude ?? null,
    startDate:toDateInput(event?.starts_at),
    startTime:toTimeInput(event?.starts_at),
    endDate:toDateInput(event?.ends_at),
    endTime:toTimeInput(event?.ends_at),
    price:String(event?.price ?? 0),
    capacity:event?.capacity ? String(event.capacity) : "",
    bookingUrl:event?.booking_url || "",
    imageUrl:event?.image_url || "",
    status:event?.status || "draft"
  };
}

export function validateEventForm(form){
  const name=String(form.name || "").trim();
  const category=String(form.category || "").trim();

  if(name.length<2){
    return{error:"Enter an event name with at least 2 characters."};
  }

  if(!category){
    return{error:"Enter an event category."};
  }

  if(
    !String(form.address || "").trim()
    // coordinate(), not Number.isFinite(Number(x)): an empty field is
    // Number("")===0, which is finite, so this guard used to accept a missing
    // location and place the Event at 0,0.
    || coordinate(form.latitude)===null
    || coordinate(form.longitude)===null
  ){
    return{error:"Search for the event address and choose the correct result."};
  }

  const startsAt=parseLocalDateTime(form.startDate,form.startTime);
  if(!startsAt){
    return{error:"Enter a valid start date and time using YYYY-MM-DD and HH:MM."};
  }

  const hasEndDate=!!String(form.endDate || "").trim();
  const hasEndTime=!!String(form.endTime || "").trim();
  let endsAt=null;

  if(hasEndDate || hasEndTime){
    if(!hasEndDate || !hasEndTime){
      return{error:"Enter both an end date and end time, or leave both blank."};
    }

    endsAt=parseLocalDateTime(form.endDate,form.endTime);
    if(!endsAt){
      return{error:"Enter a valid end date and time using YYYY-MM-DD and HH:MM."};
    }

    if(endsAt<=startsAt){
      return{error:"The end time must be after the start time."};
    }
  }

  const price=Number(String(form.price || "0").trim() || 0);
  if(!Number.isFinite(price) || price<0){
    return{error:"Enter a valid price, or 0 for a free event."};
  }

  const capacityText=String(form.capacity || "").trim();
  const capacity=capacityText ? Number(capacityText) : null;
  if(capacity!==null && (!Number.isInteger(capacity) || capacity<1)){
    return{error:"Capacity must be a whole number greater than 0, or left blank."};
  }

  const bookingUrl=normalizeExternalUrl(form.bookingUrl);
  const imageUrl=normalizeExternalUrl(form.imageUrl);

  if(!isValidHttpUrl(bookingUrl)){
    return{error:"Enter a valid booking website address."};
  }

  if(!isValidHttpUrl(imageUrl)){
    return{error:"Enter a valid event image website address."};
  }

  return{
    payload:{
      name,
      category,
      description:String(form.description || "").trim(),
      location:String(form.location || "").trim(),
      address:String(form.address || "").trim(),
      latitude:Number(form.latitude),
      longitude:Number(form.longitude),
      starts_at:startsAt.toISOString(),
      ends_at:endsAt ? endsAt.toISOString() : null,
      price,
      capacity,
      booking_url:bookingUrl,
      image_url:imageUrl || null,
      status:form.status
    }
  };
}
