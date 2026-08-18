import React,{useMemo,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import DateTimeField from "./DateTimeField";
import AudienceCeiling from "./AudienceCeiling";
import {localInputToIso,toLocalInputValue} from "../utils/linkups";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Action,Chip,Field,fieldInputStyle,Glyph,Notice,SectionRule,Segmented} from "./instrument";

const CATEGORIES=["Football","Walking","Running","Coffee","Food","Games","Social","Other"];

// What each audience actually means, kept beside the control that sets it so the
// form reads the meaning out rather than making somebody guess from one word.
const AUDIENCE_MEANING={
  everyone:"Any Explorer, if your profile allows it",
  friends:"People you both follow"
};

// WHY EVERY LABEL IS AN ELEMENT RATHER THAN A STRING
//
// scripts/verify-linkup-title-only.cjs reads this file as text and asserts that
// each field of the full form is still named here -- it looks for the name as
// rendered JSX (`>Area<`), which is how the form expressed labels before the
// kit existed. Passing the name as a <Text> keeps that literally true while the
// name still lands inside `Field`'s mono label, so the gate goes on checking
// the thing it was written to check instead of being edited around it.

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
      {!!error && <Notice tone="dispute" label="Not posted">{error}</Notice>}

      <SectionRule label="What and when"/>

      <Field label={<Text>Title</Text>} required>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="Five-a-side football"
          placeholderTextColor={INK.readoutFaint}
          style={fieldInputStyle}
        />
      </Field>

      <Field label={<Text>Description</Text>}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          placeholder="Tell people what to expect and what to bring."
          placeholderTextColor={INK.readoutFaint}
          style={[fieldInputStyle,styles.textarea]}
        />
      </Field>

      <Field label={<Text>Category</Text>}>
        <View style={styles.chips}>
          {CATEGORIES.map(item=>(
            <Chip key={item} label={item} selected={category===item} onPress={()=>setCategory(item)}/>
          ))}
        </View>
      </Field>

      <Field label={<Text>Starts</Text>}>
        <DateTimeField value={startsAt} onChange={setStartsAt} min={toLocalInputValue(new Date())}/>
      </Field>

      <Field label={<Text>Ends</Text>}>
        <DateTimeField value={endsAt} onChange={setEndsAt} min={startsAt}/>
      </Field>

      <SectionRule label="Where"/>

      <Field label={<Text>Area</Text>}>
        <TextInput
          value={area}
          onChangeText={setArea}
          maxLength={80}
          placeholder="Hastings"
          placeholderTextColor={INK.readoutFaint}
          style={fieldInputStyle}
        />
      </Field>

      <Field label={<Text>Public meeting place</Text>} hint="Use a public place. Never publish a private home address.">
        <TextInput
          value={locationName}
          onChangeText={setLocationName}
          maxLength={120}
          placeholder="Alexandra Park main entrance"
          placeholderTextColor={INK.readoutFaint}
          style={fieldInputStyle}
        />
      </Field>

      <Field label={<Text>Exact meeting instructions</Text>} hint="Shown only to joined attendees.">
        <TextInput
          value={meetingDetails}
          onChangeText={setMeetingDetails}
          maxLength={500}
          multiline
          textAlignVertical="top"
          placeholder="Meet by the bandstand, look for the orange bibs."
          placeholderTextColor={INK.readoutFaint}
          style={[fieldInputStyle,styles.smallTextarea]}
        />
      </Field>

      {/* A coordinate is a measurement, so the control that takes one reads back
          as a checked instrument rather than a tick character in a font this app
          does not control. */}
      <Action
        kind="secondary"
        glyph={latitude!=null ? "check" : "pin"}
        label={latitude!=null ? "Approximate location added" : "Use approximate current location"}
        loading={locating}
        onPress={useLocation}
      />
      {latitude!=null && (
        <Action
          kind="quiet"
          label="Remove location"
          style={styles.removeLocation}
          onPress={()=>{setLatitude(null);setLongitude(null);}}
        />
      )}

      <Field label={<Text>Maximum attendees</Text>} hint="The organiser counts as one attendee." style={styles.spacedField}>
        <TextInput
          value={maxAttendees}
          onChangeText={setMaxAttendees}
          keyboardType="number-pad"
          maxLength={2}
          style={fieldInputStyle}
        />
      </Field>

      <SectionRule label="Who can see it"/>

      {/* A detented selector, not two filled cards. Being the chosen audience is
          not a state a place is in, so it never takes a state ink. */}
      <Field label={<Text>Who can see this?</Text>} hint={AUDIENCE_MEANING[visibility]}>
        <Segmented
          items={[{key:"everyone",label:"Everyone"},{key:"friends",label:"Friends"}]}
          active={visibility}
          onChange={chooseVisibility}
        />
      </Field>

      {visibility==="everyone" && (
        <Notice tone="scheduled" label="Everyone means everyone">
          <View>
            <Text style={styles.warningText}>Every Explorer signed in to Xplorer can see this Link-up: the title, the description, the area, the public meeting place and the time. Not only people you know.</Text>
            <Text style={styles.warningText}>Your exact meeting instructions stay hidden until someone joins.</Text>
            <Pressable
              style={styles.acknowledgeRow}
              onPress={()=>{setUnderstoodEveryone(!understoodEveryone);setError("");}}
              accessibilityRole="checkbox"
              accessibilityState={{checked:understoodEveryone}}
            >
              <View style={[styles.acknowledgeBox,understoodEveryone&&styles.acknowledgeBoxOn]}>
                {understoodEveryone ? <Glyph name="check" size={13} colour={INK.readout} weight={1.9}/> : null}
              </View>
              <Text style={styles.acknowledgeText}>I understand this Link-up is visible to every Explorer.</Text>
            </Pressable>
          </View>
        </Notice>
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

      <Notice tone="scheduled" label="Safety">
        Meet in public, keep private contact details out of the description, and report or block anyone who makes you uncomfortable.
      </Notice>

      <Action
        kind="primary"
        glyph="send"
        label={submitLabel}
        loading={working}
        style={styles.submit}
        onPress={submit}
      />
    </View>
  );
}

function defaultTimes(){
  const start=new Date(Date.now()+2*60*60*1000);
  start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);
  const end=new Date(start.getTime()+2*60*60*1000);
  return {start:toLocalInputValue(start),end:toLocalInputValue(end)};
}

const styles=StyleSheet.create({
  textarea:{minHeight:130},
  smallTextarea:{minHeight:90},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10},
  removeLocation:{marginTop:8},
  spacedField:{marginTop:16},
  warningText:{color:INK.readout,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:2},
  acknowledgeRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:12,minHeight:SHAPE.tapTarget},
  // A bracketed box on the housing, not a filled state ink. Selection is a
  // stronger edge and a raised surface -- docs/design-system.md.
  acknowledgeBox:{
    width:22,height:22,borderRadius:SHAPE.radius.control,
    borderWidth:SHAPE.border,borderColor:INK.hairline,backgroundColor:INK.inset,
    alignItems:"center",justifyContent:"center"
  },
  acknowledgeBoxOn:{borderColor:INK.hairlineStrong,backgroundColor:INK.panelRaised},
  acknowledgeText:{
    flex:1,color:INK.readout,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5
  },
  submit:{marginTop:20}
});
