import React,{useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {
  ARCHIVE_VISIBILITY,
  DEFAULT_ARCHIVE_VISIBILITY,
  DEFAULT_LIVE_DURATION,
  DEFAULT_MEMORY_VISIBILITY,
  LIVE_DURATIONS,
  MEMORY_VISIBILITY,
  liveUntilFrom
} from "../../utils/memories";
import {PUBLIC_PLACE_TYPES} from "../../utils/places";
import {assetFromCameraUri,prepareSocialAsset,releaseSocialAsset,uploadSocialAsset} from "../../utils/socialMedia";
import AudienceCeiling from "../../components/AudienceCeiling";
import AddLocation from "../../components/AddLocation";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,SHAPE,TYPE} from "../../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Field,
  fieldInputStyle,
  Frame,
  Glyph,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Toggle
} from "../../components/instrument";

// Packet 8d: keeping something on purpose.
//
// The screen makes both decisions explicit, because they are different
// decisions. "Who can see this while it is live" is one; "what happens to it
// afterwards" is the other, and the second starts closed however the first is
// answered. A person who shares where they are today has not agreed to a
// permanent public record of it, and the database refuses to infer one.

const PLACE_TYPES={
  business:{label:"Business",table:"businesses",select:"id,name,image,photos",image:(row)=>row.image || row.photos?.[0] || null},
  property:{label:"Stay",table:"properties",select:"id,name,photos",image:(row)=>row.photos?.[0] || null},
  activity_club:{label:"Club",table:"activity_clubs",select:"id,name,image_url,status",image:(row)=>row.image_url || null,statuses:["open","full"]},
  event:{label:"Event",table:"events",select:"id,name,image_url,status",image:(row)=>row.image_url || null,status:"published"},
  public_place:{label:"Public place",table:"public_places",select:"id,name,image_url,status",image:(row)=>row.image_url || null,status:"published"}
};

export default function CreateMemory(){
  const {showFeedback}=useFeedback();
  const params=useLocalSearchParams();
  const presetType=Array.isArray(params.target_type) ? params.target_type[0] : params.target_type;
  const presetId=Array.isArray(params.target_id) ? params.target_id[0] : params.target_id;
  // A photo handed over by app/camera.js. See the note in app/moments/create.js.
  // A photo OR a video: the camera takes both now -- press for one, hold for
  // the other -- and hands the file over the same way.
  const cameraPhoto=Array.isArray(params.photo) ? params.photo[0] : params.photo;

  const [user,setUser]=useState(null);
  const [title,setTitle]=useState("");
  const [note,setNote]=useState("");
  const [asset,setAsset]=useState(null);
  const [placeType,setPlaceType]=useState(null);
  const [places,setPlaces]=useState([]);
  const [placeQuery,setPlaceQuery]=useState("");
  const [selectedPlace,setSelectedPlace]=useState(null);
  const [visibility,setVisibility]=useState(DEFAULT_MEMORY_VISIBILITY);
  const [archiveVisibility,setArchiveVisibility]=useState(DEFAULT_ARCHIVE_VISIBILITY);
  const [duration,setDuration]=useState(DEFAULT_LIVE_DURATION);
  const [showOnProfile,setShowOnProfile]=useState(false);
  // WHERE THIS MEMORY HAPPENED, AND IT HAD NOWHERE TO GO BEFORE.
  //
  // This screen never asked for a location and never sent one, so a Memory that
  // was not attached to a listing carried no coordinates and never appeared on
  // the map at all -- the trigger in 20260805120300 only fills them in from an
  // attached place. Nothing is on by default; see components/AddLocation.js.
  const [coordinates,setCoordinates]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  // "nobody", not "private". The old word is refused by the database -- see
  // the note at the top of utils/memories.js. This one also decides whether the
  // Memory gets a live period at all, so a stale word here would have given an
  // only-me Memory an expiry it should never have had.
  const isPrivate=visibility==="nobody";

  useEffect(()=>{loadUser();},[]);
  useEffect(()=>()=>releaseSocialAsset(asset),[asset]);

  // Opened from the camera with the photo already taken.
  useEffect(()=>{
    if(!cameraPhoto || asset) return;
    const taken=assetFromCameraUri(cameraPhoto);
    if(taken) setAsset(taken);
  },[cameraPhoto,asset]);

  // CAMERA ONLY.
  //
  // This screen is the second half of the camera flow -- caption, place,
  // audience -- not a standalone uploader. Reached with no photo it used to
  // open the photo LIBRARY, which made it a second way to create that never
  // went near a camera. Three routes did exactly that.
  //
  // Arriving with nothing sends you to the camera rather than showing an empty
  // form. The in-screen picker stays for what the camera cannot capture (video)
  // and for replacing a shot you have already taken; both of those are still
  // inside the flow, which is the thing the rule is about.
  useEffect(()=>{
    if(!cameraPhoto && !asset) router.replace("/camera");
  },[cameraPhoto,asset]);

  const choosePlaceType=useCallback(async(type,preselectId=null)=>{
    setPlaceType(type);
    setSelectedPlace(null);
    setPlaceQuery("");

    if(!type){
      setPlaces([]);
      return;
    }

    setLoadingPlaces(true);
    const config=PLACE_TYPES[type];
    let request=supabase.from(config.table).select(config.select).order("name",{ascending:true}).limit(50);
    if(config.statuses) request=request.in("status",config.statuses);
    else if(config.status) request=request.eq("status",config.status);

    const {data,error:placeError}=await request;

    if(placeError){
      setError("Places could not be loaded.");
      setPlaces([]);
    }else{
      const rows=(data || []).map((row)=>({...row,displayImage:config.image(row)}));
      setPlaces(rows);
      if(preselectId) setSelectedPlace(rows.find((row)=>row.id===preselectId) || null);
    }
    setLoadingPlaces(false);
  },[]);

  useEffect(()=>{
    if(user && presetType && presetId && PLACE_TYPES[presetType] && !placeType){
      choosePlaceType(presetType,presetId);
    }
  },[user,presetType,presetId,placeType,choosePlaceType]);

  async function loadUser(){
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){
      router.replace("/auth/login");
      return;
    }
    setUser(currentUser);
    setLoading(false);
  }

  const filteredPlaces=useMemo(()=>{
    const term=placeQuery.trim().toLowerCase();
    if(!term) return places;
    return places.filter((item)=>item.name?.toLowerCase().includes(term));
  },[places,placeQuery]);

  async function pickPhoto(){
    setError("");
    try{
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(permission.status!=="granted" && permission.granted!==true){
        setError("Allow access to your photos before choosing one.");
        return;
      }

      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:0.8});
      if(result.canceled || !result.assets?.[0]) return;

      const prepared=prepareSocialAsset(result.assets[0]);
      if(!prepared?.previewUri){
        releaseSocialAsset(prepared);
        setError("That photo could not be read. Choose it again.");
        return;
      }
      setAsset(prepared);
    }catch(pickerError){
      console.error(pickerError);
      setError("The photo picker could not return to Xplorer. Try again.");
    }
  }

  async function save(){
    if(saving || !user) return;
    setError("");

    if(!title.trim() && !note.trim() && !asset){
      setError("Give this Memory a title, a note or a photo.");
      return;
    }

    setSaving(true);
    let uploadedPath=null;

    try{
      let mediaType=null;
      let mediaUrl=null;

      if(asset){
        const upload=await uploadSocialAsset({asset,userId:user.id,mediaType:"image"});
        uploadedPath=upload.path;

        const {error:uploadError}=await supabase.storage
          .from("social-media")
          .upload(upload.path,upload.bytes,{contentType:upload.contentType,upsert:false});
        if(uploadError) throw new Error(uploadError.message);

        const {data:urlData}=supabase.storage.from("social-media").getPublicUrl(upload.path);
        if(!urlData?.publicUrl) throw new Error("The uploaded photo URL could not be created.");

        mediaType="image";
        mediaUrl=urlData.publicUrl;
      }

      // A private Memory has no live period to end. Everything else must have
      // one -- the database refuses the row otherwise, and this is the screen
      // saying the same thing first.
      const {data,error:insertError}=await supabase
        .from("explorer_memories")
        .insert({
          user_id:user.id,
          title:title.trim(),
          note:note.trim(),
          media_type:mediaType,
          media_url:mediaUrl,
          target_type:selectedPlace ? placeType : null,
          target_id:selectedPlace?.id || null,
          // Standalone only. An attached Memory is snapshotted from the place
          // itself on insert, so sending the device's position with it would be
          // a second, disagreeing answer.
          ...(!selectedPlace && coordinates
            ? {latitude:coordinates.latitude,longitude:coordinates.longitude}
            : {}),
          visibility,
          live_until:isPrivate ? null : liveUntilFrom(duration),
          archive_visibility:archiveVisibility,
          show_on_profile:showOnProfile,
          status:"published"
        })
        .select("id")
        .single();

      if(insertError) throw new Error(insertError.message);

      showFeedback(
        isPrivate
          ? "Kept on your own map. Nobody else can see it."
          : `Live for now, then ${archiveVisibility==="nobody" ? "yours alone" : "kept in your archive"}.`,
        "success",
        "Memory saved"
      );
      router.replace(`/memories/${data.id}`);
    }catch(saveError){
      console.error(saveError);
      if(uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
      setError(saveError.message || "The Memory could not be saved.");
      setSaving(false);
    }
  }

  if(loading){
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow="NEW MEMORY"
          title="Keep a Memory"
          meta="Somewhere you were, kept because you chose to. A check-in disappears; this does not."
        />

        {!!error && <Notice tone="dispute" label="Not saved">{error}</Notice>}

        <Field label="TITLE">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="First swim of the year"
            placeholderTextColor={INK.readoutFaint}
            style={fieldInputStyle}
            maxLength={120}
            accessibilityLabel="Memory title"
          />
        </Field>

        <Field label="NOTE">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What you want to remember about it."
            placeholderTextColor={INK.readoutFaint}
            style={[fieldInputStyle,styles.textarea]}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            accessibilityLabel="Memory note"
          />
        </Field>

        <SectionRule label="PHOTO"/>
        {asset ? (
          <View>
            <Frame ratio={1.6} style={styles.preview}>
              <Image source={{uri:asset.previewUri}} style={styles.previewImage}/>
            </Frame>
            <Action
              kind="quiet"
              glyph="close"
              label="Remove photo"
              accessibilityLabel="Remove the photo"
              style={styles.spacedAction}
              onPress={()=>{releaseSocialAsset(asset);setAsset(null);}}
            />
          </View>
        ) : (
          <Action
            kind="secondary"
            glyph="image"
            label="Choose a photo"
            accessibilityLabel="Choose a photo"
            onPress={pickPhoto}
          />
        )}

        <SectionRule label="WHERE" meta="OPTIONAL"/>
        <Field label="Kind of place">
          <View style={styles.chips}>
            <Chip
              label="Nowhere in particular"
              selected={!placeType}
              accessibilityLabel="No place"
              onPress={()=>choosePlaceType(null)}
            />
            {Object.entries(PLACE_TYPES).map(([key,config])=>(
              <Chip
                key={key}
                label={config.label}
                selected={placeType===key}
                onPress={()=>choosePlaceType(key)}
              />
            ))}
          </View>
        </Field>

        {!!placeType && (
          <>
            <Field label="Search places">
              <TextInput
                value={placeQuery}
                onChangeText={setPlaceQuery}
                placeholder="Search places"
                placeholderTextColor={INK.readoutFaint}
                style={fieldInputStyle}
                accessibilityLabel="Search places"
              />
            </Field>

            {loadingPlaces && <ActivityIndicator color={INK.exists} style={styles.loader}/>}

            {!loadingPlaces && filteredPlaces.slice(0,20).map((place)=>{
              const selected=selectedPlace?.id===place.id;
              return(
                <Row
                  key={place.id}
                  glyph="pin"
                  title={place.name}
                  onPress={()=>setSelectedPlace(place)}
                  right={selected ? <Glyph name="check" size={15} colour={INK.exists} weight={1.9}/> : null}
                  style={selected?styles.placeRowSelected:null}
                />
              );
            })}

            {!loadingPlaces && !filteredPlaces.length && (
              <Empty glyph="search" title="No matching places" instruction="Try a shorter search, or keep it without a place."/>
            )}
          </>
        )}

        {/*
          Only when it is not attached to a place. An attached Memory takes that
          place's coordinates on insert, so offering a second answer here would
          let the screen and the database disagree about where it happened.
        */}
        {!selectedPlace && <AddLocation value={coordinates} onChange={setCoordinates} thing="Memory"/>}

        <SectionRule label="WHO CAN SEE IT WHILE IT IS LIVE"/>
        {MEMORY_VISIBILITY.map((option)=>(
          <ChoiceRow
            key={option.key}
            accessibilityLabel={`${option.label}: ${option.hint}`}
            title={option.label}
            hint={option.hint}
            selected={visibility===option.key}
            onPress={()=>setVisibility(option.key)}
          />
        ))}

        {visibility==="selected" && (
          <Text style={styles.help}>
            Save it first, then choose the Explorers on the Memory itself.
          </Text>
        )}

        {/*
          profiles.visibility is a ceiling over this choice, and it starts at
          Nobody. Without this the screen offers four audiences and silently
          delivers none of them.
        */}
        <AudienceCeiling audience={visibility}/>

        {!isPrivate && (
          <>
            <SectionRule label="HOW LONG IT STAYS LIVE"/>
            <View style={styles.chips}>
              {LIVE_DURATIONS.map((option)=>(
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={duration===option.key}
                  accessibilityLabel={`Live for ${option.label}`}
                  onPress={()=>setDuration(option.key)}
                />
              ))}
            </View>
            <Text style={styles.help}>
              After that it leaves the live map and discovery for good. Changing the archive setting later never puts it back.
            </Text>
          </>
        )}

        <SectionRule label="AFTERWARDS"/>
        {ARCHIVE_VISIBILITY.map((option)=>(
          <ChoiceRow
            key={option.key}
            accessibilityLabel={`Afterwards, ${option.label}: ${option.hint}`}
            title={option.label}
            hint={option.hint}
            selected={archiveVisibility===option.key}
            onPress={()=>setArchiveVisibility(option.key)}
          />
        ))}
        <Text style={styles.help}>
          This starts at &quot;Only me&quot; whatever you chose above. It is yours to keep either way — the archive stays available to
          you even when nobody else can see it.
        </Text>

        <Toggle
          accessibilityLabel="Show this Memory on my profile"
          label="Show on my profile"
          hint="Only to people already allowed to see it. It does not make a private Memory public."
          value={showOnProfile}
          onPress={()=>setShowOnProfile((on)=>!on)}
        />

        <Action
          kind="primary"
          glyph="bookmark"
          label="Save this Memory"
          accessibilityLabel="Save this Memory"
          loading={saving}
          style={styles.submit}
          onPress={save}
        />
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Two shapes the kit does not have, composed from the parts it does
// ---------------------------------------------------------------------------
// A choice that carries a sentence, and a switch. `Chip` and `Segmented` hold a
// word each, and `Row` builds its own accessibility label from its title and
// sub, which would throw away the exact label these two are announced by. Both
// are a `Panel` that steps to `panelRaised` when it is chosen -- selection as a
// surface step and a stronger edge, never a state ink.

function ChoiceRow({title,hint,selected,onPress,accessibilityLabel}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <Panel raised={selected} style={[styles.choice,selected&&styles.choiceSelected]}>
        <View style={styles.choiceText}>
          <Text style={styles.choiceTitle}>{title}</Text>
          <Text style={styles.choiceHint}>{hint}</Text>
        </View>
        {selected ? <Glyph name="check" size={15} colour={INK.exists} weight={1.9}/> : null}
      </Panel>
    </Pressable>
  );
}
// The switch rows are the kit's Toggle now -- "one claim, on or off, with the
// sentence that explains it". This file, three other form screens and one
// detail screen had each grown their own copy of it.

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  loader:{marginVertical:16},

  textarea:{minHeight:96},
  preview:{width:"100%"},
  previewImage:{width:"100%",height:"100%"},
  spacedAction:{marginTop:8},

  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10},
  placeRowSelected:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},

  choice:{flexDirection:"row",alignItems:"center",gap:12,padding:13,marginBottom:8},
  choiceSelected:{borderColor:INK.hairlineStrong},
  choiceText:{flex:1,minWidth:0},
  choiceTitle:{color:INK.readout,fontSize:TYPE.body.sizes.lg,fontWeight:"600"},
  choiceHint:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:3},

  help:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:8},


  submit:{marginTop:20}
});
