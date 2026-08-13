import React,{useMemo,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import DateTimeField from "./DateTimeField";
import AudienceCeiling from "./AudienceCeiling";
import {localInputToIso,toLocalInputValue} from "../utils/linkups";
import {INK} from "../utils/tokens";

const CATEGORIES=["Football","Walking","Running","Coffee","Food","Games","Social","Other"];

function defaultTimes(){
  const start=new Date(Date.now()+2*60*60*1000);
  start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);
  const end=new Date(start.getTime()+2*60*60*1000);
  return {start:toLocalInputValue(start),end:toLocalInputValue(end)};
}

export default function LinkupForm({initial,onSubmit,submitLabel="Create Link-up",working=false,titleOnly=false}){
  const defaults=useMemo(defaultTimes,[]);
  const [title,setTitle]=useState(initial?.title || "");
  const [description,setDescription]=useState(initial?.description || "");
  const [category,setCategory]=useState(initial?.category || "Social");
  const [startsAt,setStartsAt]=useState(initial?.starts_at ? toLocalInputValue(initial.starts_at) : defaults.start);
  const [endsAt,setEndsAt]=useState(initial?.ends_at ? toLocalInputValue(initial.ends_at) : defaults.end);
  const [area,setArea]=useState(initial?.area || "");
  const [locationName,setLocationName]=useState(initial?.location_name || "");
  const [meetingDetails,setMeetingDetails]=useState(initial?.meeting_point_details || "");
  const [latitude,setLatitude]=useState(initial?.latitude ?? null);
  const [longitude,setLongitude]=useState(initial?.longitude ?? null);
  const [maxAttendees,setMaxAttendees]=useState(String(initial?.max_attendees || 8));
  // Friends by default. Presence does not open itself.
  const [visibility,setVisibility]=useState(initial?.visibility || "friends");
  // Choosing Everyone is allowed, but it is not allowed to be a surprise. The
  // organiser has to say out loud that they understand it before the Link-up
  // can be posted, and switching away clears the acknowledgement so it can
  // never be carried over from an earlier choice.
  const [understoodEveryone,setUnderstoodEveryone]=useState(false);
  const [locating,setLocating]=useState(false);
  const [error,setError]=useState("");

  function chooseVisibility(next){
    setVisibility(next);
    setUnderstoodEveryone(false);
    setError("");
  }

  async function useLocation(){
    setError("");
    setLocating(true);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setLatitude(Number(position.coords.latitude.toFixed(3)));
      setLongitude(Number(position.coords.longitude.toFixed(3)));
    }catch(locationError){
      setError(locationError.message || "Approximate location could not be added.");
    }
    setLocating(false);
  }

  async function submit(){
    if(working) return;
    setError("");

    if(visibility==="everyone" && !understoodEveryone){
      return setError("Tick the box to confirm you want every Explorer to see this Link-up, or change it to Friends.");
    }

    const cleanTitle=title.trim();
    const startIso=localInputToIso(startsAt);
    const endIso=localInputToIso(endsAt);
    const limit=Number(maxAttendees);

    if(cleanTitle.length<3 || cleanTitle.length>100){
      return setError("Add a title with between 3 and 100 characters.");
    }

    if(!titleOnly){
      if(description.trim().length<10) return setError("Add a little more detail about the Link-up.");
      if(!startIso || !endIso) return setError("Choose a valid start and end time.");
      if(new Date(endIso)<=new Date(startIso)) return setError("The end time must be after the start time.");
      if(!area.trim() || !locationName.trim()) return setError("Add the area and public meeting place.");
      if(!Number.isInteger(limit) || limit<2 || limit>50) return setError("Attendance must be between 2 and 50 people.");
    }

    const fallbackStart=localInputToIso(defaults.start);
    const safeStart=startIso || fallbackStart;
    const safeEnd=(endIso && new Date(endIso)>new Date(safeStart))
      ? endIso
      : new Date(new Date(safeStart).getTime()+2*60*60*1000).toISOString();
    const safeLimit=Number.isInteger(limit) && limit>=2 && limit<=50 ? limit : 8;

    try{
      await onSubmit({
        p_title:cleanTitle,
        p_description:description.trim(),
        p_category:category,
        p_starts_at:safeStart,
        p_ends_at:safeEnd,
        p_area:area.trim(),
        p_location_name:locationName.trim(),
        p_meeting_point_details:meetingDetails.trim(),
        p_latitude:latitude,
        p_longitude:longitude,
        p_max_attendees:safeLimit,
        p_visibility:visibility
      });
    }catch(submitError){
      setError(submitError.message || "The Link-up could not be saved.");
    }
  }

  return(
    <View>
      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="Five-a-side football" placeholderTextColor={INK.inkSoft} style={styles.input}/>

      <Text style={styles.label}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} maxLength={2000} multiline textAlignVertical="top" placeholder="Tell people what to expect and what to bring." placeholderTextColor={INK.inkSoft} style={[styles.input,styles.textarea]}/>

      <Text style={styles.label}>Category</Text>
      <View style={styles.wrapRow}>
        {CATEGORIES.map(item=><Pressable key={item} style={[styles.chip,category===item&&styles.chipActive]} onPress={()=>setCategory(item)}><Text style={[styles.chipText,category===item&&styles.chipTextActive]}>{item}</Text></Pressable>)}
      </View>

      <Text style={styles.label}>Starts</Text>
      <DateTimeField value={startsAt} onChange={setStartsAt} min={toLocalInputValue(new Date())}/>

      <Text style={styles.label}>Ends</Text>
      <DateTimeField value={endsAt} onChange={setEndsAt} min={startsAt}/>

      <Text style={styles.label}>Area</Text>
      <TextInput value={area} onChangeText={setArea} maxLength={80} placeholder="Hastings" placeholderTextColor={INK.inkSoft} style={styles.input}/>

      <Text style={styles.label}>Public meeting place</Text>
      <TextInput value={locationName} onChangeText={setLocationName} maxLength={120} placeholder="Alexandra Park main entrance" placeholderTextColor={INK.inkSoft} style={styles.input}/>
      <Text style={styles.help}>Use a public place. Never publish a private home address.</Text>

      <Text style={styles.label}>Exact meeting instructions</Text>
      <TextInput value={meetingDetails} onChangeText={setMeetingDetails} maxLength={500} multiline textAlignVertical="top" placeholder="Shown only to joined attendees." placeholderTextColor={INK.inkSoft} style={[styles.input,styles.smallTextarea]}/>

      <Pressable style={styles.locationButton} disabled={locating} onPress={useLocation}>
        {locating?<ActivityIndicator color={INK.ink}/>:<Text style={styles.locationText}>{latitude!=null?"✓ Approximate location added":"Use approximate current location"}</Text>}
      </Pressable>
      {latitude!=null && <Pressable onPress={()=>{setLatitude(null);setLongitude(null);}}><Text style={styles.removeLocation}>Remove location</Text></Pressable>}

      <Text style={styles.label}>Maximum attendees</Text>
      <TextInput value={maxAttendees} onChangeText={setMaxAttendees} keyboardType="number-pad" maxLength={2} style={styles.input}/>
      <Text style={styles.help}>The organiser counts as one attendee.</Text>

      <Text style={styles.label}>Who can see this?</Text>
      <View style={styles.visibilityRow}>
        <Pressable style={[styles.visibilityButton,visibility==="everyone"&&styles.visibilityActive]} onPress={()=>chooseVisibility("everyone")}><Text style={[styles.visibilityText,visibility==="everyone"&&styles.visibilityTextActive]}>Everyone</Text><Text style={styles.visibilityHint}>Any Explorer, if your profile allows it</Text></Pressable>
        <Pressable style={[styles.visibilityButton,visibility==="friends"&&styles.visibilityActive]} onPress={()=>chooseVisibility("friends")}><Text style={[styles.visibilityText,visibility==="friends"&&styles.visibilityTextActive]}>Friends</Text><Text style={styles.visibilityHint}>People you both follow</Text></Pressable>
      </View>

      {visibility==="everyone" && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Everyone means everyone</Text>
          <Text style={styles.warningText}>Every Explorer signed in to Xplorer can see this Link-up: the title, the description, the area, the public meeting place and the time. Not only people you know.</Text>
          <Text style={styles.warningText}>Your exact meeting instructions stay hidden until someone joins.</Text>
          <Pressable style={styles.acknowledgeRow} onPress={()=>{setUnderstoodEveryone(!understoodEveryone);setError("");}} accessibilityRole="checkbox" accessibilityState={{checked:understoodEveryone}}>
            <View style={[styles.acknowledgeBox,understoodEveryone&&styles.acknowledgeBoxOn]}><Text style={styles.acknowledgeTick}>{understoodEveryone?"✓":""}</Text></View>
            <Text style={styles.acknowledgeText}>I understand this Link-up is visible to every Explorer.</Text>
          </Pressable>
        </View>
      )}

      {/*
        The profile ceiling, said out loud and with the actual setting in it.
        Moments (app/moments/create.js) and check-ins (app/checkins/create.js)
        have warned about this since the ceiling existed; Link-ups were the one
        place that stayed silent, so a new Explorer -- whose visibility starts
        at `nobody`, correctly -- could post an invitation, be told "Your
        Link-up is live", and have it be visible to no one.

        It replaces half a sentence that used to sit inside the Everyone card:
        that one only appeared for Everyone, and could not name the setting
        because the form never reads it. This component reads it itself.
      */}
      <AudienceCeiling audience={visibility}/>

      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Safety</Text>
        <Text style={styles.safetyText}>Meet in public, keep private contact details out of the description, and report or block anyone who makes you uncomfortable.</Text>
      </View>

      <Pressable style={[styles.submitButton,working&&styles.disabled]} disabled={working} onPress={submit}>
        {working?<ActivityIndicator color={INK.ink}/>:<Text style={styles.submitText}>{submitLabel}</Text>}
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  label:{color:INK.ink,fontSize:14,fontWeight:"900",marginTop:18,marginBottom:8},
  input:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:12,color:INK.ink,fontSize:15,paddingHorizontal:14,paddingVertical:13},
  textarea:{minHeight:130},smallTextarea:{minHeight:90},help:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:6},
  errorCard:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1,borderRadius:12,padding:12},errorText:{color:INK.card,lineHeight:19},
  wrapRow:{flexDirection:"row",flexWrap:"wrap",gap:7},chip:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:18,paddingHorizontal:12,paddingVertical:8},chipActive:{backgroundColor:INK.blue,borderColor:INK.blue},chipText:{color:INK.inkSoft,fontWeight:"800",fontSize:12},chipTextActive:{color:INK.card},
  locationButton:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:12,padding:13,alignItems:"center",marginTop:12},locationText:{color:INK.card,fontWeight:"900"},removeLocation:{color:INK.inkSoft,fontWeight:"800",textAlign:"center",paddingVertical:9},
  visibilityRow:{flexDirection:"row",gap:9},visibilityButton:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:12,padding:13},visibilityActive:{borderColor:INK.blue,borderWidth:2},visibilityText:{color:INK.inkSoft,fontWeight:"900"},visibilityTextActive:{color:INK.ink},visibilityHint:{color:INK.inkSoft,fontSize:10,marginTop:4},
  // Deliberately no new colour. This is the card that has to be read, not the
  // card that has to be noticed -- so it is the plain card with a heavy border,
  // and the ink stays the same ink as every other body line on the screen.
  warningCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:13,padding:13,marginTop:12},
  warningTitle:{color:INK.ink,fontWeight:"900",fontSize:14},
  warningText:{color:INK.ink,fontSize:12,lineHeight:18,marginTop:6},
  acknowledgeRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:12},
  acknowledgeBox:{width:22,height:22,borderRadius:6,borderColor:INK.ink,borderWidth:2,alignItems:"center",justifyContent:"center"},
  acknowledgeBoxOn:{backgroundColor:INK.blue,borderColor:INK.blue},
  acknowledgeTick:{color:INK.card,fontWeight:"900",fontSize:13},
  acknowledgeText:{flex:1,color:INK.ink,fontSize:12,fontWeight:"800",lineHeight:17},
  safetyCard:{backgroundColor:INK.green,borderColor:INK.green,borderWidth:1,borderRadius:13,padding:13,marginTop:20},safetyTitle:{color:INK.card,fontWeight:"900"},safetyText:{color:INK.card,fontSize:12,lineHeight:18,marginTop:5},
  submitButton:{backgroundColor:INK.blue,borderRadius:14,paddingVertical:16,alignItems:"center",marginTop:22},submitText:{color:INK.card,fontSize:16,fontWeight:"900"},disabled:{opacity:.6}
});
