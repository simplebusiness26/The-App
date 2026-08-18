import React,{useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Image,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import MomentMediaPreview from "../../components/MomentMediaPreview";
import {assetFromCameraUri,mediaKindFromUri,prepareSocialAsset,releaseSocialAsset,resolveVideoDuration,uploadSocialAsset} from "../../utils/socialMedia";
import AudienceCeiling from "../../components/AudienceCeiling";
import {DEFAULT_MOMENT_VISIBILITY,MOMENT_VISIBILITY} from "../../utils/places";
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
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Packet 8e added three things to this screen, each with a boundary in the
// database rather than only here:
//
//   Audience. A Moment is now for friends -- mutual follows -- or for everyone,
//   and Friends is what the screen opens on. RULES.md: a visibility flag
//   defaults to the closed setting.
//
//   Location. An attached Moment takes the place's own coordinates. A
//   standalone one takes the device's only after an explicit tap, rounded to
//   three decimal places before it leaves here and rounded again on insert.
//
//   Identity. A manager can post as the listing they manage, which is a
//   different act from an Explorer tagging that listing. The database checks
//   owner_id/manager_id; this screen only offers the choice.

const PLACE_TYPES={
  business:{label:"Business",table:"businesses",select:"id,name,image,photos,owner_id",image:row=>row.image || row.photos?.[0] || null,manager:row=>row.owner_id},
  property:{label:"Stay",table:"properties",select:"id,name,photos,owner_id",image:row=>row.photos?.[0] || null,manager:row=>row.owner_id},
  activity_club:{label:"Club",table:"activity_clubs",select:"id,name,image_url,status,manager_id",image:row=>row.image_url || null,statuses:["open","full"],manager:row=>row.manager_id},
  event:{label:"Event",table:"events",select:"id,name,image_url,status,manager_id",image:row=>row.image_url || null,status:"published",manager:row=>row.manager_id},
  // A public place has no manager and never will until public places have a
  // permission model. Attaching a Moment to a park is fine; speaking as the
  // park is not, so `manager` returns null and the official option cannot
  // appear for one.
  public_place:{label:"Public place",table:"public_places",select:"id,name,image_url,status",image:row=>row.image_url || null,status:"published",manager:()=>null}
};

export default function CreateMoment(){
  const {showFeedback}=useFeedback();
  const params=useLocalSearchParams();
  const presetType=Array.isArray(params.target_type) ? params.target_type[0] : params.target_type;
  const presetId=Array.isArray(params.target_id) ? params.target_id[0] : params.target_id;
  // A photo handed over by app/camera.js. The camera takes the picture; this
  // screen is still the only thing that uploads it or decides who sees it.
  // A photo OR a video: the camera takes both now -- press for one, hold for
  // the other -- and hands the file over the same way.
  const cameraPhoto=Array.isArray(params.photo) ? params.photo[0] : params.photo;

  const [user,setUser]=useState(null);
  const [asset,setAsset]=useState(null);
  const [mediaType,setMediaType]=useState(null);
  const [caption,setCaption]=useState("");
  const [placeType,setPlaceType]=useState(null);
  const [places,setPlaces]=useState([]);
  const [placeQuery,setPlaceQuery]=useState("");
  const [selectedPlace,setSelectedPlace]=useState(null);
  const [visibility,setVisibility]=useState(DEFAULT_MOMENT_VISIBILITY);
  const [postOfficially,setPostOfficially]=useState(false);
  // Save to Memories. The columns for this were added on 11 August and nothing
  // had ever written them -- the intent was recorded, the transition was not
  // built. It is off by default: keeping something for ever should be a choice
  // somebody makes, not one they fail to undo.
  const [keepAsMemory,setKeepAsMemory]=useState(false);
  const [coordinates,setCoordinates]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{loadUser();},[]);

  useEffect(()=>{
    return()=>releaseSocialAsset(asset);
  },[asset]);

  // Opened from the camera with the photo already taken.
  useEffect(()=>{
    if(!cameraPhoto || asset) return;
    const taken=assetFromCameraUri(cameraPhoto);
    if(!taken) return;
    setAsset(taken);
    // Read off the file, not assumed. Marking a recording as an image uploads
    // it with an image mime type, which Storage accepts and no player will play.
    setMediaType(mediaKindFromUri(cameraPhoto));
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

  // Opened from a place page with the place already chosen.
  useEffect(()=>{
    if(user && presetType && presetId && PLACE_TYPES[presetType] && !placeType){
      choosePlaceType(presetType,presetId);
    }
  },[user,presetType,presetId]);

  // Only the Explorer who manages the selected listing may speak as it, and
  // only a listing that has a manager can be spoken as at all.
  const canPostOfficially=!!user
    && !!selectedPlace
    && !!placeType
    && PLACE_TYPES[placeType].manager(selectedPlace)===user.id;

  useEffect(()=>{
    if(!canPostOfficially && postOfficially) setPostOfficially(false);
  },[canPostOfficially,postOfficially]);

  async function loadUser(){
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    setUser(currentUser);
    setLoading(false);
  }

  // The location control is components/AddLocation.js now, shared with
  // app/memories/create.js -- a Memory had no location handling at all, and two
  // screens rounding a coordinate two ways is how one of them ends up sending a
  // doorstep. Nothing here is automatic and nothing is on by default; see the
  // privacy note in that file.

  async function requestPermission(){
    if(Platform.OS==="web") return true;
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(permission.granted) return true;
    setError("Allow access to your media library before selecting a photo or video.");
    return false;
  }

  function preparePickedAsset(chosen,type){
    const prepared=prepareSocialAsset(chosen);
    if(prepared?.previewUri) return prepared;

    releaseSocialAsset(prepared);
    setError(`Xplorer could not read the selected ${type}. Choose it again or open the app preview in a separate browser tab.`);
    return null;
  }

  function clearAsset(){
    setAsset(null);
    setMediaType(null);
    setError("");
  }

  async function pickImage(){
    setError("");
    try{
      if(!(await requestPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],
        allowsEditing:false,
        allowsMultipleSelection:false,
        quality:0.8
      });

      if(result.canceled || !result.assets?.[0]) return;

      const prepared=preparePickedAsset(result.assets[0],"photo");
      if(!prepared) return;

      setAsset(prepared);
      setMediaType("image");
    }catch(pickerError){
      console.error(pickerError);
      setError("The photo picker could not return to Xplorer. Open the preview in a separate browser tab and try again.");
    }
  }

  async function pickVideo(){
    setError("");
    try{
      if(!(await requestPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["videos"],
        allowsEditing:false,
        allowsMultipleSelection:false,
        videoMaxDuration:30,
        quality:0.7
      });
      if(result.canceled || !result.assets?.[0]) return;

      const chosen=result.assets[0];
      if(chosen.fileSize && chosen.fileSize>52_428_800){
        setError("This video is larger than 50 MB. Choose a shorter or lower-quality clip.");
        return;
      }

      const prepared=preparePickedAsset(chosen,"video");
      if(!prepared) return;

      const seconds=await resolveVideoDuration(prepared);
      if(!seconds){
        releaseSocialAsset(prepared);
        setError("Xplorer could not read this video's duration. Choose a different clip.");
        return;
      }
      if(seconds>30.25){
        releaseSocialAsset(prepared);
        setError("Moments videos must be 30 seconds or shorter.");
        return;
      }

      setAsset({...prepared,resolvedDuration:seconds});
      setMediaType("video");
    }catch(pickerError){
      console.error(pickerError);
      setError("The video picker could not return to Xplorer. Open the preview in a separate browser tab and try again.");
    }
  }

  async function choosePlaceType(type,preselectId=null){
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
      console.log(placeError);
      setError("Places could not be loaded.");
      setPlaces([]);
    }else{
      const rows=(data || []).map(row=>({...row,displayImage:config.image(row)}));
      setPlaces(rows);
      if(preselectId) setSelectedPlace(rows.find((row)=>row.id===preselectId) || null);
    }
    setLoadingPlaces(false);
  }

  const filteredPlaces=useMemo(()=>{
    const term=placeQuery.trim().toLowerCase();
    if(!term) return places;
    return places.filter(item=>item.name?.toLowerCase().includes(term));
  },[places,placeQuery]);

  async function publish(){
    if(publishing || !user) return;
    setError("");

    if(!asset || !mediaType){
      setError("Choose a photo or video for your Moment.");
      return;
    }

    if(caption.length>500){
      setError("Moment captions can contain up to 500 characters.");
      return;
    }

    setPublishing(true);
    let uploadedPath=null;

    try{
      const upload=await uploadSocialAsset({asset,userId:user.id,mediaType});
      uploadedPath=upload.path;

      const {error:uploadError}=await supabase.storage
        .from("social-media")
        .upload(upload.path,upload.bytes,{contentType:upload.contentType,upsert:false});
      if(uploadError) throw new Error(uploadError.message);

      const {data:urlData}=supabase.storage.from("social-media").getPublicUrl(upload.path);
      if(!urlData?.publicUrl) throw new Error("The uploaded media URL could not be created.");

      const duration=mediaType==="video"
        ? Number(asset.resolvedDuration || await resolveVideoDuration(asset))
        : null;

      if(mediaType==="video" && (!duration || duration>30.25)){
        throw new Error("The selected video must be 30 seconds or shorter.");
      }

      // An official Moment is public: "friends" is a relationship between
      // people, and a business does not have any. The database refuses the
      // combination too -- this keeps the screen from sending it.
      const official=postOfficially && canPostOfficially;
      const audience=official ? "everyone" : visibility;

      // Coordinates are sent only for a standalone Moment. An attached one is
      // snapshotted from the place itself on insert, so sending the device's
      // position with it would be a second, disagreeing answer.
      // latitude and longitude only. `detail` is how precise the screen chose
      // to be and is not a column -- sending it would fail the insert.
      const deviceLocation=!selectedPlace && coordinates
        ? {latitude:coordinates.latitude,longitude:coordinates.longitude}
        : {};

      const {data:moment,error:insertError}=await supabase
        .from("explorer_moments")
        .insert({
          user_id:user.id,
          caption:caption.trim(),
          media_type:mediaType,
          media_url:urlData.publicUrl,
          thumbnail_url:mediaType==="video" ? selectedPlace?.displayImage || null : null,
          duration_seconds:duration,
          target_type:selectedPlace ? placeType : null,
          target_id:selectedPlace?.id || null,
          target_name:selectedPlace?.name || null,
          target_image_url:selectedPlace?.displayImage || null,
          visibility:audience,
          save_to_memory:keepAsMemory,
          actor_type:official ? placeType : "explorer",
          actor_id:official ? selectedPlace.id : user.id,
          ...deviceLocation,
          status:"published"
        })
        .select("id")
        .single();

      if(insertError) throw new Error(insertError.message);

      showFeedback(
        official
          ? `Posted as ${selectedPlace.name}. It will appear for the Explorers who follow it.`
          : audience==="friends"
            ? "Only Explorers you follow who follow you back can see this Moment."
            : "Any Explorer can see this Moment.",
        "success",
        "Moment published"
      );
      router.replace(`/moments/${moment.id}`);
    }catch(publishError){
      console.error(publishError);
      if(uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
      setError(publishError.message || "The Moment could not be published.");
      setPublishing(false);
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
          eyebrow="SHARE YOUR DAY"
          title="New Moment"
          meta="Post a photo or short video. You choose who can see it before you publish."
        />

        {!!error && <Notice tone="dispute" label="Not published">{error}</Notice>}

        <Panel style={styles.mediaCard}>
          {asset && mediaType ? (
            <View>
              <MomentMediaPreview asset={asset} mediaType={mediaType} onPreviewError={setError}/>
              <Action
                kind="quiet"
                glyph="close"
                label="Remove selected media"
                accessibilityLabel="Remove selected media"
                style={styles.removeMedia}
                onPress={clearAsset}
              />
            </View>
          ) : (
            <Empty
              glyph="camera"
              title="Choose your Moment"
              instruction="Take or choose one photo, or record or select one video up to 30 seconds."
            />
          )}

          <View style={styles.mediaButtons}>
            {/*
              These said "Photo / camera" and "Video / camera" and both opened the
              photo library. A button that names a thing it does not do is worse
              than a button that names less, so they say what they open.
            */}
            <Action kind="secondary" glyph="image" label="Choose a photo" style={styles.mediaButton} onPress={pickImage}/>
            <Action kind="secondary" glyph="video" label="Choose a video" style={styles.mediaButton} onPress={pickVideo}/>
          </View>
        </Panel>

        <SectionRule label="What you want to say"/>

        <Field label="Caption">
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="What made this worth sharing?"
            placeholderTextColor={INK.readoutFaint}
            style={[fieldInputStyle,styles.textarea]}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
        </Field>
        <Text style={styles.counter}>{caption.length}/500</Text>

        <SectionRule label="Attach a place" meta="OPTIONAL"/>

        <Field label="Place type">
          <View style={styles.chips}>
            <Chip label="None" selected={!placeType} onPress={()=>choosePlaceType(null)}/>
            {Object.entries(PLACE_TYPES).map(([key,config])=>(
              <Chip key={key} label={config.label} selected={placeType===key} onPress={()=>choosePlaceType(key)}/>
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
              />
            </Field>

            {loadingPlaces && <ActivityIndicator color={INK.exists} style={styles.loader}/>}

            {!loadingPlaces && filteredPlaces.slice(0,20).map(place=>{
              const selected=selectedPlace?.id===place.id;
              return(
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityState={{selected}}
                  accessibilityLabel={place.name}
                  onPress={()=>setSelectedPlace(place)}
                >
                  {/* A row with a picture in it. The kit's Row takes a Glyph on
                      its left rather than a media well, so this is Panel plus
                      Frame -- the same pair components/FeedCard.js uses for the
                      poster of a post. */}
                  <Panel raised={selected} style={[styles.placeRow,selected&&styles.placeRowSelected]}>
                    <Frame size={44}>
                      {place.displayImage
                        ? <Image source={{uri:place.displayImage}} style={styles.placeImage}/>
                        : <Glyph name="pin" size={17} colour={INK.readoutFaint}/>}
                    </Frame>
                    <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
                    {selected ? <Glyph name="check" size={15} colour={INK.exists} weight={1.9}/> : null}
                  </Panel>
                </Pressable>
              );
            })}

            {!loadingPlaces && filteredPlaces.length===0 && (
              <Empty glyph="search" title="No matching places found" instruction="Try a shorter search, or post without a place."/>
            )}
          </>
        )}

        {canPostOfficially && (
          <>
            <SectionRule label="Post as"/>
            <ChoiceRow
              accessibilityLabel="Post as yourself"
              title="Yourself"
              hint="An Explorer Moment at this place"
              selected={!postOfficially}
              onPress={()=>setPostOfficially(false)}
            />
            <ChoiceRow
              accessibilityLabel={`Post officially as ${selectedPlace.name}`}
              title={selectedPlace.name}
              hint="An official update, seen by its followers"
              selected={postOfficially}
              onPress={()=>setPostOfficially(true)}
            />
          </>
        )}

        <SectionRule label="Who can see this"/>

        {postOfficially ? (
          <Text style={styles.audienceNote}>
            Official Moments are public. Everyone who follows {selectedPlace.name} will see it.
          </Text>
        ) : MOMENT_VISIBILITY.map((option)=>(
          <ChoiceRow
            key={option.key}
            accessibilityLabel={`${option.label}: ${option.hint}`}
            title={option.label}
            hint={option.hint}
            selected={visibility===option.key}
            onPress={()=>setVisibility(option.key)}
          />
        ))}

        {/*
          And then the truth. profiles.visibility is a ceiling and starts at
          Nobody, so a brand new Explorer's first Moment is seen by no one -- the
          setting working exactly as intended, and completely silent about it.
          This says so before the post, not after somebody asks why their friend
          cannot see it.
        */}
        <AudienceCeiling audience={postOfficially ? "everyone" : visibility}/>

        {/*
          A Moment is live for a day and then it goes. This is the one way to keep
          it, and the Memory it becomes inherits this Moment's audience -- keeping
          something must never widen it.
        */}
        <SwitchRow
          accessibilityLabel="Keep this as a Memory after it expires"
          label="Keep this as a Memory"
          hint={keepAsMemory
            ? "When it stops being live it becomes a Memory, shared with exactly the same people."
            : "Off — this disappears in 24 hours and is not kept."}
          value={keepAsMemory}
          onPress={()=>setKeepAsMemory((on)=>!on)}
        />

        {!selectedPlace && <AddLocation value={coordinates} onChange={setCoordinates} thing="Moment"/>}

        <Action
          kind="primary"
          glyph="send"
          label="Publish this Moment"
          accessibilityLabel="Publish this Moment"
          loading={publishing}
          style={styles.submit}
          onPress={publish}
        />
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Two shapes the kit does not have, composed from the parts it does
// ---------------------------------------------------------------------------
// A choice that carries a sentence, and a switch. `Chip` and `Segmented` hold a
// word each and `Row` builds its own accessibility label out of its title and
// sub, which would throw away the exact label these controls are tested on. So
// both are a `Panel` that steps to `panelRaised` when it is chosen, with a
// stronger edge and a tick -- selection as a surface step, never a state ink.

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

function SwitchRow({label,hint,value,onPress,accessibilityLabel}){
  return(
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked:value}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <Panel raised={value} style={styles.switchRow}>
        <View style={[styles.switchBox,value&&styles.switchBoxOn]}>
          {value ? <Glyph name="check" size={13} colour={INK.readout} weight={1.9}/> : null}
        </View>
        <View style={styles.choiceText}>
          <Text style={styles.choiceTitle}>{label}</Text>
          <Text style={styles.choiceHint}>{hint}</Text>
        </View>
      </Panel>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center"},
  loader:{marginVertical:16},

  mediaCard:{padding:12,marginTop:14},
  removeMedia:{marginTop:8},
  mediaButtons:{flexDirection:"row",gap:10,marginTop:11},
  mediaButton:{flex:1},

  textarea:{minHeight:120},
  counter:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,textAlign:"right",marginTop:-10,marginBottom:4
  },

  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10},

  placeRow:{flexDirection:"row",alignItems:"center",gap:11,padding:10,marginBottom:8},
  placeRowSelected:{borderColor:INK.hairlineStrong},
  placeImage:{width:44,height:44},
  placeName:{flex:1,color:INK.readout,fontSize:TYPE.body.sizes.lg,fontWeight:"600"},

  choice:{flexDirection:"row",alignItems:"center",gap:12,padding:13,marginBottom:8},
  choiceSelected:{borderColor:INK.hairlineStrong},
  choiceText:{flex:1,minWidth:0},
  choiceTitle:{color:INK.readout,fontSize:TYPE.body.sizes.lg,fontWeight:"600"},
  choiceHint:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5,marginTop:3},
  audienceNote:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginBottom:8},

  switchRow:{flexDirection:"row",alignItems:"center",gap:12,padding:13,marginTop:4,minHeight:SHAPE.tapTarget},
  switchBox:{
    width:22,height:22,borderRadius:SHAPE.radius.control,
    borderWidth:SHAPE.border,borderColor:INK.hairline,backgroundColor:INK.inset,
    alignItems:"center",justifyContent:"center"
  },
  switchBoxOn:{borderColor:INK.hairlineStrong,backgroundColor:INK.panelRaised},

  submit:{marginTop:16}
});
