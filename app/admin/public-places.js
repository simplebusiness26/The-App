import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {useAdminGate} from "../../hooks/useAdminGate";
import {useFeedback} from "../../context/FeedbackContext";
import {PUBLIC_PLACE_TYPES,publicPlaceTypeLabel,roundCoordinate} from "../../utils/places";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Field,
  fieldInputStyle,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Packet 8e: where canonical public places come from.
//
// Administrators only, in the screen and in the database -- the policies on
// public_places test public.guestbook_is_admin(), so this gate stops a
// non-admin being shown a form whose Save button would silently change nothing
// rather than being the thing that protects the table.
//
// There is no claim flow and no manager here on purpose. Deciding that a park
// exists is not the same as deciding who speaks for it, and only the first of
// those is built.
//
// The form is a bank of labelled wells rather than a stack of bordered boxes:
// what you type into an instrument is cut INTO the housing, one surface step
// below the panel it sits on, which is what Field draws. A place is a place, so
// its type and its state are still chips -- but a chip is selected by stepping
// a surface, never by filling with a state ink.

const STATUSES=["published","draft","hidden"];

const EMPTY={
  id:null,
  name:"",
  place_type:"park",
  area_id:null,
  latitude:"",
  longitude:"",
  location_description:"",
  description:"",
  image_url:"",
  status:"published"
};

// Chip with a real accessibility label on the control around it.
function Choice({label,accessibilityLabel,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected}}
      onPress={onPress}
    >
      <Chip label={label} selected={selected}/>
    </Pressable>
  );
}

export default function AdminPublicPlaces(){
  const {checking,allowed,error:gateError}=useAdminGate();
  const {showFeedback}=useFeedback();

  const [places,setPlaces]=useState([]);
  const [areas,setAreas]=useState([]);
  const [form,setForm]=useState(EMPTY);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);

    const [placeResult,areaResult]=await Promise.all([
      supabase.from("public_places")
        .select("id,name,place_type,area_id,latitude,longitude,location_description,description,image_url,status")
        .order("name",{ascending:true}),
      supabase.from("geo_areas").select("id,name,area_type").eq("status","active").order("name",{ascending:true})
    ]);

    if(placeResult.error) setError("Public places could not be loaded.");
    setPlaces(placeResult.data || []);
    setAreas(areaResult.data || []);
    setLoading(false);
  },[allowed]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const areaName=useMemo(()=>{
    const lookup={};
    for(const area of areas) lookup[area.id]=area.name;
    return lookup;
  },[areas]);

  function set(field,value){
    setForm((current)=>({...current,[field]:value}));
  }

  function edit(place){
    setError("");
    setForm({
      id:place.id,
      name:place.name || "",
      place_type:place.place_type || "park",
      area_id:place.area_id || null,
      latitude:place.latitude===null || place.latitude===undefined ? "" : String(place.latitude),
      longitude:place.longitude===null || place.longitude===undefined ? "" : String(place.longitude),
      location_description:place.location_description || "",
      description:place.description || "",
      image_url:place.image_url || "",
      status:place.status || "published"
    });
  }

  async function save(){
    if(saving) return;
    setError("");

    if(form.name.trim().length<2){
      setError("Give the place a name of at least two characters.");
      return;
    }

    const latitude=form.latitude.trim() ? roundCoordinate(form.latitude.trim()) : null;
    const longitude=form.longitude.trim() ? roundCoordinate(form.longitude.trim()) : null;

    if((form.latitude.trim() && latitude===null) || (form.longitude.trim() && longitude===null)){
      setError("Coordinates must be numbers, or left empty.");
      return;
    }

    if((latitude===null)!==(longitude===null)){
      setError("Give both a latitude and a longitude, or neither.");
      return;
    }

    setSaving(true);

    const payload={
      name:form.name.trim(),
      place_type:form.place_type,
      area_id:form.area_id,
      latitude,
      longitude,
      location_description:form.location_description.trim(),
      description:form.description.trim(),
      image_url:form.image_url.trim() || null,
      status:form.status
    };

    // A policy refusal returns no error and no rows, so the write is asked to
    // return what it changed and zero rows is treated as the refusal it is.
    const {data,error:saveError}=form.id
      ? await supabase.from("public_places").update(payload).eq("id",form.id).select("id")
      : await supabase.from("public_places").insert(payload).select("id");

    setSaving(false);

    if(saveError){
      showFeedback(saveError.message,"error",form.id ? "Could not save the place" : "Could not add the place");
      return;
    }

    if(!data || !data.length){
      showFeedback("The database refused the change. Confirm this account is an administrator.","error","Nothing was saved");
      return;
    }

    showFeedback(
      form.id ? `${payload.name} has been updated.` : `${payload.name} can now be followed and checked into.`,
      "success",
      form.id ? "Place saved" : "Place added"
    );

    setForm(EMPTY);
    await load();
  }

  function confirmHide(place){
    Alert.alert(
      "Hide this public place?",
      `${place.name} will disappear from search, place pages and check-in pickers. Moments and check-ins already attached to it are kept.`,
      [
        {text:"Cancel",style:"cancel"},
        {text:"Hide place",style:"destructive",onPress:()=>hide(place)}
      ]
    );
  }

  async function hide(place){
    const {data,error:hideError}=await supabase
      .from("public_places").update({status:"hidden"}).eq("id",place.id).select("id");

    if(hideError){
      showFeedback(hideError.message,"error","Could not hide the place");
      return;
    }

    if(!data || !data.length){
      showFeedback("The database refused the change.","error","Nothing was hidden");
      return;
    }

    showFeedback(`${place.name} is now hidden.`,"success","Place hidden");
    await load();
  }

  if(checking){
    return(
      <Screen style={styles.fullState}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.stateText}>Checking admin access…</Text>
      </Screen>
    );
  }

  if(!allowed){
    return(
      <Screen>
        <ScreenTitle eyebrow="Admin" title="Admin access required"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Refused">
            {gateError || "An admin account is required to open this screen."}
          </Notice>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <ScreenTitle
          eyebrow="Admin places"
          title="Public places"
          meta="Parks, beaches and viewpoints, as canonical rows. One row per place means one page, one follow and one set of Moments instead of a different spelling every time somebody checks in."
        />

        <View style={styles.body}>
          {!!error && <Notice tone="exists" label="Not saved">{error}</Notice>}

          <SectionRule label={form.id ? "Edit place" : "Add a place"}/>

          <Panel style={styles.form}>
            <Field label="Name" required>
              <TextInput
                value={form.name}
                onChangeText={(value)=>set("name",value)}
                placeholder="Alexandra Park"
                placeholderTextColor={INK.readoutFaint}
                style={fieldInputStyle}
                maxLength={120}
                accessibilityLabel="Public place name"
              />
            </Field>

            <Text style={styles.label}>Type</Text>
            <View style={styles.wrap}>
              {PUBLIC_PLACE_TYPES.map((item)=>(
                <Choice
                  key={item.key}
                  label={item.label}
                  accessibilityLabel={item.label}
                  selected={form.place_type===item.key}
                  onPress={()=>set("place_type",item.key)}
                />
              ))}
            </View>

            <Text style={styles.label}>Area</Text>
            <View style={styles.wrap}>
              <Choice
                label="No area yet"
                accessibilityLabel="No area yet"
                selected={!form.area_id}
                onPress={()=>set("area_id",null)}
              />
              {areas.map((area)=>(
                <Choice
                  key={area.id}
                  label={area.name}
                  accessibilityLabel={area.name}
                  selected={form.area_id===area.id}
                  onPress={()=>set("area_id",area.id)}
                />
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Field label="Latitude">
                  <TextInput
                    value={form.latitude}
                    onChangeText={(value)=>set("latitude",value)}
                    placeholder="50.855"
                    placeholderTextColor={INK.readoutFaint}
                    style={fieldInputStyle}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Latitude"
                  />
                </Field>
              </View>
              <View style={styles.half}>
                <Field label="Longitude">
                  <TextInput
                    value={form.longitude}
                    onChangeText={(value)=>set("longitude",value)}
                    placeholder="0.573"
                    placeholderTextColor={INK.readoutFaint}
                    style={fieldInputStyle}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Longitude"
                  />
                </Field>
              </View>
            </View>

            <Text style={styles.help}>
              Rounded to three decimal places, the same precision a check-in is stored at.
            </Text>

            <Field label="Where to find it" style={styles.spaced}>
              <TextInput
                value={form.location_description}
                onChangeText={(value)=>set("location_description",value)}
                placeholder="Main gate on St Helens Road"
                placeholderTextColor={INK.readoutFaint}
                style={fieldInputStyle}
                maxLength={200}
                accessibilityLabel="Where to find it"
              />
            </Field>

            <Field label="Description">
              <TextInput
                value={form.description}
                onChangeText={(value)=>set("description",value)}
                placeholder="What is here, and what people come for."
                placeholderTextColor={INK.readoutFaint}
                style={[fieldInputStyle,styles.textarea]}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                accessibilityLabel="Description"
              />
            </Field>

            <Field label="Image URL">
              <TextInput
                value={form.image_url}
                onChangeText={(value)=>set("image_url",value)}
                placeholder="https://..."
                placeholderTextColor={INK.readoutFaint}
                style={fieldInputStyle}
                autoCapitalize="none"
                accessibilityLabel="Image URL"
              />
            </Field>

            <Text style={styles.label}>Status</Text>
            <View style={styles.wrap}>
              {STATUSES.map((status)=>(
                <Choice
                  key={status}
                  label={status}
                  accessibilityLabel={`Status ${status}`}
                  selected={form.status===status}
                  onPress={()=>set("status",status)}
                />
              ))}
            </View>

            <View style={styles.row}>
              <Action
                kind="primary"
                glyph={form.id ? "check" : "plus"}
                label={form.id ? "Save place" : "Add place"}
                accessibilityLabel={form.id ? "Save this public place" : "Add this public place"}
                loading={saving}
                disabled={saving}
                onPress={save}
                style={styles.button}
              />

              {!!form.id && (
                <Action
                  kind="secondary"
                  glyph="close"
                  label="Cancel"
                  accessibilityLabel="Stop editing"
                  onPress={()=>{setForm(EMPTY);setError("");}}
                  style={styles.button}
                />
              )}
            </View>
          </Panel>

          <SectionRule label="Public places" meta={String(places.length)}/>

          {loading ? (
            <ActivityIndicator color={INK.readout} style={styles.loader}/>
          ) : places.length===0 ? (
            <Empty
              glyph="pin"
              title="No public places yet"
              instruction="Add a park, beach or viewpoint above and Explorers can follow it and check in."
            />
          ) : places.map((place)=>(
            <View key={place.id} style={styles.placeBlock}>
              <Row
                glyph="pin"
                title={place.name}
                sub={`${publicPlaceTypeLabel(place.place_type)}${
                  place.area_id && areaName[place.area_id] ? ` · ${areaName[place.area_id]}` : " · no area yet"
                }`}
                meta={place.status}
              />

              <View style={styles.placeButtons}>
                <Action
                  kind="secondary"
                  glyph="edit"
                  label="Edit"
                  accessibilityLabel={`Edit ${place.name}`}
                  onPress={()=>edit(place)}
                  style={styles.button}
                />

                {place.status!=="hidden" && (
                  <Action
                    kind="secondary"
                    glyph="eyeOff"
                    label="Hide"
                    accessibilityLabel={`Hide ${place.name}`}
                    onPress={()=>confirmHide(place)}
                    style={styles.button}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  fullState:{alignItems:"center",justifyContent:"center",gap:12,padding:32},
  stateText:{
    maxWidth:320,color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,textAlign:"center"
  },

  form:{padding:14},
  label:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md,marginBottom:7},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:16},
  help:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:-8,marginBottom:12
  },
  spaced:{marginTop:2},
  textarea:{minHeight:92},

  row:{flexDirection:"row",gap:9,flexWrap:"wrap"},
  half:{flex:1,minWidth:130},
  button:{flex:1,minWidth:110},

  loader:{marginTop:16},
  placeBlock:{marginBottom:14},
  placeButtons:{flexDirection:"row",gap:9,marginTop:2}
});
