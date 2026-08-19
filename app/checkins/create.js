import React,{useEffect,useMemo,useRef,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Location from "expo-location";
import {router,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  CHECKIN_ACTIVITIES,
  DEFAULT_CHECKIN_MINUTES,
  REQUESTED_CHECKIN_AUDIENCE,
  activityForCategory,
  categoryLabel,
  checkinDefaults,
  nearestPlace,
  normalisePosition,
  presenceAudience
} from "../../utils/checkinSuggestions";
import {
  Action,
  Chip,
  Empty,
  Field,
  fieldInputStyle,
  Glyph,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented
} from "../../components/instrument";

// Public places only. A check-in used to accept businesses, clubs and events
// as well, which is a different act wearing the same word: it broadcasts your
// position at a private address, and the business has no say in whether it
// happens. Both public types stay, because public_places holds eight kinds --
// beaches, viewpoints, greens -- and allowing a park but not a beach would be
// an arbitrary line through one table.
const TYPES=[
  {key:"park",label:"Park"},
  {key:"public_place",label:"Other public place"}
];
// The activities, and the table that picks one from a place's category, both
// live in utils/checkinSuggestions.js -- a suggestion is a rule, and a rule
// written inside a component can only be checked by rendering the component.

// What the check-in screen tells you about who will see it. Read from your one
// visibility setting rather than chosen here -- there is a single audience
// control, on Settings, and it covers the whole app.
// The locked UX spec asks a check-in to default to Followers. It does not,
// and this is the sentence that says so rather than showing one audience and
// sending another. RULES.md: following is one-way and needs no permission, so
// `followers` is not an acceptable audience for presence -- check-ins use
// friends. utils/checkinSuggestions.js does the narrowing; this explains it.
const PRESENCE_NARROWING="Followers is the wider audience a check-in would otherwise default to. Presence never uses it: anybody can follow you without asking, so a check-in reaches friends -- Explorers you follow who follow you back -- and goes no further.";

const AUDIENCE_SENTENCE={
  nobody:"Your visibility is set to nobody, so this check-in will be visible only to you. Change it in Settings if you want other people to see it.",
  close_friends:"Only the people on your close friends list will see this.",
  friends:"People you and they both follow will see this.",
  everyone:"Any Explorer nearby will see this."
};

export default function CreateCheckin(){
  const {showFeedback}=useFeedback();

  // "From any place detail page 'Check in here' opens the Create hub pre-filled
  // with that place." app/places/[id].js sends the place's id; the global
  // Create button sends nothing, which is the other half of the spec.
  const params=useLocalSearchParams();
  const requestedPlaceId=Array.isArray(params.place) ? params.place[0] : params.place;
  const [user,setUser]=useState(null);
  const [placeType,setPlaceType]=useState("park");
  const [targetId,setTargetId]=useState(null);
  const [publicPlaceId,setPublicPlaceId]=useState(null);
  const [placeName,setPlaceName]=useState("");
  const [area,setArea]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [activity,setActivity]=useState(activityForCategory(null));
  const [customActivity,setCustomActivity]=useState("");
  const [message,setMessage]=useState("");
  const [visibility,setVisibility]=useState("nobody");
  const [minutes,setMinutes]=useState(DEFAULT_CHECKIN_MINUTES);
  const [places,setPlaces]=useState([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [locating,setLocating]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  // What was filled in for somebody, and why -- so the screen can say it out
  // loud. A default nobody can see is a default nobody knows they can change.
  const [suggestion,setSuggestion]=useState(null);
  // Suggest once. Switching the place type afterwards is a deliberate act, and
  // re-suggesting on top of it would take the choice back.
  const suggested=useRef(false);

  useEffect(()=>{loadUser();},[]);
  useEffect(()=>{loadPlaces(placeType);},[placeType]);

  async function loadUser(){
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    const {data:profile}=await supabase.from("profiles").select("area,visibility").eq("id",currentUser.id).maybeSingle();
    setUser(currentUser);
    // Never clobber an area the place suggestion already filled: the place
    // somebody is standing in is a better answer than their home town, and
    // these two loads race.
    setArea((current)=>current.trim() ? current : (profile?.area || ""));
    setVisibility(
      Object.keys(AUDIENCE_SENTENCE).includes(profile?.visibility)
        ? profile.visibility
        : "nobody"
    );
    setLoading(false);
  }

  // Packet 8e: a park is a row now, not a spelling. Choosing one from this list
  // attaches the canonical id, so twelve check-ins at one park stop arriving as
  // twelve different places. Typing a name still works exactly as before -- the
  // free-text fields are untouched and the reference stays null.
  async function loadPlaces(type){
    setTargetId(null);setPublicPlaceId(null);setQuery("");setPlaces([]);
    setLoadingPlaces(true);
    let request;
    if(type==="park"||type==="public_place") request=supabase.from("public_places").select("id,name,place_type,area_id,location_description,latitude,longitude,status").eq("status","published").order("name").limit(80);
    if(type==="business") request=supabase.from("businesses").select("id,name,address,latitude,longitude").order("name").limit(80);
    if(type==="activity_club") request=supabase.from("activity_clubs").select("id,name,location,latitude,longitude,status").in("status",["open","full"]).order("name").limit(80);
    if(type==="event") request=supabase.from("events").select("id,name,location,latitude,longitude,status").eq("status","published").order("starts_at").limit(80);
    const {data,error:placesError}=await request;
    if(placesError){setError("Places could not be loaded.");setPlaces([]);} else setPlaces(data || []);
    setLoadingPlaces(false);
    if(!placesError) suggestPlace(data || []);
  }

  // ---------------------------------------------------------------------------
  // What the screen fills in for you
  // ---------------------------------------------------------------------------
  //
  // Two routes in, and the spec asks for a different answer on each:
  //
  //   from a place page      that place, named in the link
  //   from the Create button no context, so the nearest place
  //
  // Neither is a lock. Everything applied here is still a row you can tap, a
  // chip you can change and a name you can type over, and the screen works
  // when location is refused, when nothing is nearby and when the place in the
  // link is not in the catalogue.
  async function suggestPlace(rows){
    if(suggested.current) return;
    suggested.current=true;

    if(requestedPlaceId){
      const asked=rows.find((row)=>row.id===requestedPlaceId);
      if(asked){applySuggestion(asked,"page");return;}
      // A link to a place this list does not hold is not an error worth showing
      // -- fall through and suggest the nearest one instead.
    }

    // getForegroundPermissions, not requestForegroundPermissions. Opening a
    // screen is not asking for your position: this reads a permission somebody
    // has already given, and if they have not, the "Add approximate location"
    // control below is still the one place that asks.
    let permission=null;
    try{
      permission=await Location.getForegroundPermissionsAsync();
    }catch(permissionError){
      return;
    }
    if(!permission?.granted) return;

    try{
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      // Only for ranking. The device position is deliberately NOT attached to
      // the check-in here -- sending a coordinate is opt-in, and it stays
      // behind the button that says so.
      const nearest=nearestPlace(rows,normalisePosition(position));
      if(nearest) applySuggestion(nearest,"nearest");
    }catch(locationError){
      // No fix available. Nothing is suggested and the screen is unchanged.
    }
  }

  function applySuggestion(place,source){
    selectPlace(place);
    const defaults=checkinDefaults(place);
    setActivity(defaults.activity);
    setMinutes(defaults.minutes);
    setSuggestion({
      placeId:place.id,
      source,
      activity:defaults.activity,
      category:categoryLabel(place.place_type)
    });
    if(place.area_id) fillAreaFrom(place.area_id);
  }

  // "Confirming is a single tap" only holds if the broad area -- a required
  // field -- is already filled. Somebody who has never set one on their profile
  // would otherwise land on a pre-filled screen and still be made to type.
  async function fillAreaFrom(areaId){
    const {data}=await supabase.from("geo_areas").select("name").eq("id",areaId).maybeSingle();
    if(data?.name) setArea((current)=>current.trim() ? current : data.name);
  }

  const isPublicPlace=["park","public_place"].includes(placeType);

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    if(!term) return places;
    return places.filter(item=>`${item.name} ${item.address||item.location||item.location_description||""}`.toLowerCase().includes(term));
  },[places,query]);

  function selectPlace(place){
    // A canonical public place carries public_place_id; a listing carries
    // target_id. The RPC refuses the wrong one for the place type.
    if(isPublicPlace){
      setPublicPlaceId(place.id);
      setTargetId(null);
    }else{
      setTargetId(place.id);
      setPublicPlaceId(null);
    }
    setPlaceName(place.name);
    if(place.latitude!=null&&place.longitude!=null){
      setLatitude(Number(Number(place.latitude).toFixed(2)));
      setLongitude(Number(Number(place.longitude).toFixed(2)));
    }
  }

  async function useLocation(){
    setLocating(true);setError("");
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted.");
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setLatitude(Number(position.coords.latitude.toFixed(2)));setLongitude(Number(position.coords.longitude.toFixed(2)));
    }catch(locationError){setError(locationError.message || "Location could not be added.");}
    setLocating(false);
  }

  async function publish(){
    if(working||!user) return;
    setError("");
    const selectedActivity=activity==="Other"?customActivity.trim():activity.trim();
    if(!publicPlaceId) return setError("Choose the public place you are at from the list.");
    if(area.trim().length<2) return setError("Add the broad area, such as a town or neighbourhood.");
    if(selectedActivity.length<2) return setError("Choose what you are doing or enter a custom activity.");
    setWorking(true);
    const {error:checkinError}=await supabase.rpc("start_live_checkin",{
      p_place_type:placeType,p_target_id:targetId,p_place_name:placeName.trim(),p_area:area.trim(),
      p_latitude:latitude,p_longitude:longitude,p_activity:selectedActivity,p_message:message.trim(),
      // presenceAudience(REQUESTED_CHECKIN_AUDIENCE) is this word. It is
      // written out rather than computed because the release gate pins the
      // literal, and test/checkin-suggestions.test.js asserts the two agree so
      // they cannot drift into disagreeing about who can see a position.
      p_visibility:"friends",p_minutes:minutes,p_public_place_id:publicPlaceId
    });
    setWorking(false);
    if(checkinError){setError(checkinError.message);return;}
    showFeedback("Your check-in will expire automatically.","success","You are checked in");
    router.replace("/live");
  }

  const audienceSentence=AUDIENCE_SENTENCE[visibility] || AUDIENCE_SENTENCE.nobody;

  if(loading) return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow="OPTIONAL LIVE STATUS"
          title="Check in"
          meta="Show that you are at a public place for a limited time. Your coordinates are rounded before storage."
        />

        {!!error && <Notice tone="dispute" label="Not started">{error}</Notice>}

        <SectionRule label="Where you are"/>

        <Field label="Place type">
          <Segmented items={TYPES} active={placeType} onChange={setPlaceType}/>
        </Field>

        <Field label="Find it in the catalogue" hint="Choosing a listed place keeps twelve check-ins at one park on one place.">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isPublicPlace?"Search parks and public places":"Search public places"}
            placeholderTextColor={INK.readoutFaint}
            style={fieldInputStyle}
          />
        </Field>

        {loadingPlaces && <ActivityIndicator color={INK.exists} style={styles.loader}/>}

        {!loadingPlaces && filtered.slice(0,25).map(place=>{
          const selected=isPublicPlace?publicPlaceId===place.id:targetId===place.id;
          const wasSuggested=suggestion?.placeId===place.id;
          return(
            <Row
              key={place.id}
              glyph="pin"
              title={place.name}
              sub={place.address||place.location||place.location_description||"Public location"}
              // A suggestion that does not say it is one is indistinguishable
              // from a choice somebody made and forgot making.
              meta={wasSuggested ? (suggestion.source==="nearest" ? "NEAREST" : "SUGGESTED") : undefined}
              onPress={()=>selectPlace(place)}
              right={selected ? <Glyph name="check" size={15} colour={INK.exists} weight={1.9}/> : null}
              style={selected?styles.placeRowSelected:null}
            />
          );
        })}

        {!loadingPlaces && isPublicPlace && !filtered.length && (
          <Empty
            glyph="pin"
            title="No matching place yet"
            instruction="Type the name below and check in anyway."
          />
        )}

        <Field label="Public place name" required>
          <TextInput
            value={placeName}
            onChangeText={value=>{setPlaceName(value);setTargetId(null);setPublicPlaceId(null);}}
            maxLength={120}
            placeholder="Alexandra Park"
            placeholderTextColor={INK.readoutFaint}
            style={fieldInputStyle}
          />
        </Field>

        <Field label="Broad area" required hint="Use a town or neighbourhood, not a street or private address.">
          <TextInput
            value={area}
            onChangeText={setArea}
            maxLength={80}
            placeholder="Hastings or Central Hastings"
            placeholderTextColor={INK.readoutFaint}
            style={fieldInputStyle}
          />
        </Field>

        {/* A coordinate is a reading, so the control that takes one reads back as
            a checked instrument rather than a tick character in somebody else's
            font. */}
        <Action
          kind="secondary"
          glyph={latitude!=null ? "check" : "target"}
          label={latitude!=null ? "Approximate location added" : "Add approximate location"}
          loading={locating}
          onPress={useLocation}
        />
        {latitude!=null && (
          <Action
            kind="quiet"
            label="Remove location"
            style={styles.spacedAction}
            onPress={()=>{setLatitude(null);setLongitude(null);}}
          />
        )}

        <SectionRule label="What you are doing"/>

        <Field
          label="Activity"
          required
          hint={
            suggestion
              ? `Suggested from ${suggestion.category.toLowerCase()}. Tap another to change it.`
              : "Pick what you are doing."
          }
        >
          <View style={styles.chips}>
            {CHECKIN_ACTIVITIES.map(item=>(
              <Chip key={item} label={item} selected={activity===item} onPress={()=>setActivity(item)}/>
            ))}
          </View>
        </Field>

        {activity==="Other" && (
          <Field label="Your activity" required>
            <TextInput
              value={customActivity}
              onChangeText={setCustomActivity}
              maxLength={80}
              placeholder="Sea swimming"
              placeholderTextColor={INK.readoutFaint}
              style={fieldInputStyle}
            />
          </Field>
        )}

        <Field label="Short message" hint="Optional.">
          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={240}
            multiline
            textAlignVertical="top"
            placeholder="What should nearby Explorers know?"
            placeholderTextColor={INK.readoutFaint}
            style={[fieldInputStyle,styles.textarea]}
          />
        </Field>
        <Text style={styles.counter}>{message.length}/240</Text>

        <Field label="Visible for" hint="An hour is pre-selected. Pick another and it stays picked.">
          {/* The four durations stay one list with one formatting rule, the
              way they were -- the selector is what changed, not the data. The
              PRE-SELECTED one is 60, from utils/checkinSuggestions.js, which is
              the spec's "duration defaults to a pre-selected chip (1h)". The
              list itself stays written out here because
              scripts/verify-linkups-live.cjs pins it. */}
          <Segmented
            items={[30,60,120,240].map(value=>({key:value,label:value<60?`${value}m`:`${value/60}h`}))}
            active={minutes}
            onChange={setMinutes}
          />
        </Field>

        {/*
          No Public option, and no visibility choice here at all. Who can see a
          check-in is one setting on your profile -- Settings, "Who can see where
          you are" -- and it is a ceiling: a check-in can never reach further than
          it. With no setting value above Friends, a Public button here would be a
          control that changes nothing, which is worse than no button.
        */}
        <Notice
          tone="scheduled"
          label="Who will see this"
          action={
            <Action
              kind="quiet"
              glyph="settings"
              label="Change your visibility"
              accessibilityLabel="Change your visibility"
              onPress={()=>router.push("/settings")}
            />
          }
        >
          {`${audienceSentence} ${PRESENCE_NARROWING}`}
        </Notice>

        <Notice tone="scheduled" label="Location safety">
          Only use public places. Xplorer rounds coordinates to roughly
          neighbourhood-level accuracy and removes this status automatically.
        </Notice>

        {/* ONE TAP. Landing here from a place page, everything this needs is
            already answered -- the place, its area, the activity, an hour, and
            an audience presence caps for you -- so confirming is this button
            and nothing else. The spec's own words for it are "Check in". */}
        <Action
          kind="primary"
          glyph="live"
          label="Check in"
          accessibilityLabel={placeName ? `Check in at ${placeName}` : "Check in"}
          loading={working}
          style={styles.submit}
          onPress={publish}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  loader:{marginVertical:16},

  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10},
  textarea:{minHeight:90},
  counter:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,textAlign:"right",marginTop:-10,marginBottom:8
  },

  // Selection steps the surface and strengthens the edge. It never fills with a
  // state ink -- being the place you picked is not a state the place is in.
  placeRowSelected:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},

  spacedAction:{marginTop:8},
  submit:{marginTop:6}
});
