import React,{useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Image,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import MomentMediaPreview from "../../components/MomentMediaPreview";
import {assetFromCameraUri,prepareSocialAsset,releaseSocialAsset,resolveVideoDuration,uploadSocialAsset} from "../../utils/socialMedia";
import AudienceCeiling from "../../components/AudienceCeiling";
import {DEFAULT_MOMENT_VISIBILITY,MOMENT_VISIBILITY,roundCoordinate} from "../../utils/places";

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
  const [locating,setLocating]=useState(false);
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
    setMediaType("image");
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

  // Never automatic. A Moment carries a location because somebody pressed a
  // button that says so, and a refusal is a refusal -- the Explorer's own area
  // is used instead by the database, with no coordinates at all.
  async function addLocation(){
    setLocating(true);
    setError("");

    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=="granted") throw new Error("Location permission was not granted, so this Moment will carry your area only.");

      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setCoordinates({
        latitude:roundCoordinate(position.coords.latitude),
        longitude:roundCoordinate(position.coords.longitude)
      });
    }catch(locationError){
      setCoordinates(null);
      setError(locationError.message || "Your location could not be added.");
    }

    setLocating(false);
  }

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
      const deviceLocation=!selectedPlace && coordinates ? coordinates : {};

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
    return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>SHARE YOUR DAY</Text>
      <Text style={styles.title}>New Moment</Text>
      <Text style={styles.subtitle}>Post a photo or short video. You choose who can see it before you publish.</Text>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.mediaCard}>
        {asset && mediaType ? (
          <View>
            <MomentMediaPreview asset={asset} mediaType={mediaType} onPreviewError={setError}/>
            <Pressable style={styles.removeMediaButton} onPress={clearAsset}>
              <Text style={styles.removeMediaText}>Remove selected media</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.mediaEmpty}>
            <Text style={styles.mediaEmptyIcon}>✨</Text>
            <Text style={styles.mediaEmptyTitle}>Choose your Moment</Text>
            <Text style={styles.mediaEmptyText}>Take or choose one photo, or record/select one video up to 30 seconds.</Text>
          </View>
        )}

        <View style={styles.mediaButtons}>
          {/*
            These said "Photo / camera" and "Video / camera" and both opened the
            photo library. launchCameraAsync appears nowhere in this app --
            app/scan.js is the only expo-camera consumer and it reads QR codes.
            A button that names a thing it does not do is worse than a button
            that names less, so they say what they open. Real capture is its own
            packet; when it lands, these become two buttons rather than a label
            change.
          */}
          <Pressable style={styles.mediaButton} onPress={pickImage}><Text style={styles.mediaButtonText}>Choose a photo</Text></Pressable>
          <Pressable style={styles.mediaButton} onPress={pickVideo}><Text style={styles.mediaButtonText}>Choose a video</Text></Pressable>
        </View>
      </View>

      <Text style={styles.label}>Caption</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="What made this worth sharing?"
        placeholderTextColor="#74747d"
        style={styles.captionInput}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>{caption.length}/500</Text>

      <Text style={styles.label}>Attach a place <Text style={styles.optional}>(optional)</Text></Text>
      <View style={styles.typeRow}>
        <Pressable style={[styles.typeButton,!placeType && styles.typeButtonActive]} onPress={()=>choosePlaceType(null)}><Text style={[styles.typeText,!placeType && styles.typeTextActive]}>None</Text></Pressable>
        {Object.entries(PLACE_TYPES).map(([key,config])=>(
          <Pressable key={key} style={[styles.typeButton,placeType===key && styles.typeButtonActive]} onPress={()=>choosePlaceType(key)}>
            <Text style={[styles.typeText,placeType===key && styles.typeTextActive]}>{config.label}</Text>
          </Pressable>
        ))}
      </View>

      {!!placeType && (
        <View style={styles.placesCard}>
          <TextInput value={placeQuery} onChangeText={setPlaceQuery} placeholder="Search places" placeholderTextColor="#74747d" style={styles.placeSearch}/>
          {loadingPlaces && <ActivityIndicator color="#bca8ff" style={{marginVertical:18}}/>}
          {!loadingPlaces && filteredPlaces.slice(0,20).map(place=>(
            <Pressable key={place.id} style={[styles.placeRow,selectedPlace?.id===place.id && styles.placeRowSelected]} onPress={()=>setSelectedPlace(place)}>
              {place.displayImage ? <Image source={{uri:place.displayImage}} style={styles.placeImage}/> : <View style={styles.placeFallback}><Text>📍</Text></View>}
              <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
              <Text style={styles.placeCheck}>{selectedPlace?.id===place.id ? "✓" : ""}</Text>
            </Pressable>
          ))}
          {!loadingPlaces && filteredPlaces.length===0 && <Text style={styles.noPlaces}>No matching places found.</Text>}
        </View>
      )}

      {canPostOfficially && (
        <>
          <Text style={styles.label}>Post as</Text>
          <View style={styles.audienceRow}>
            <Pressable
              style={[styles.audience,!postOfficially && styles.audienceActive]}
              accessibilityRole="button"
              accessibilityLabel="Post as yourself"
              onPress={()=>setPostOfficially(false)}
            >
              <Text style={styles.audienceTitle}>Yourself</Text>
              <Text style={styles.audienceHint}>An Explorer Moment at this place</Text>
            </Pressable>
            <Pressable
              style={[styles.audience,postOfficially && styles.audienceActive]}
              accessibilityRole="button"
              accessibilityLabel={`Post officially as ${selectedPlace.name}`}
              onPress={()=>setPostOfficially(true)}
            >
              <Text style={styles.audienceTitle}>{selectedPlace.name}</Text>
              <Text style={styles.audienceHint}>An official update, seen by its followers</Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.label}>Who can see this</Text>
      {postOfficially ? (
        <Text style={styles.audienceNote}>
          Official Moments are public. Everyone who follows {selectedPlace.name} will see it.
        </Text>
      ) : (
        <View style={styles.audienceRow}>
          {MOMENT_VISIBILITY.map((option)=>(
            <Pressable
              key={option.key}
              style={[styles.audience,visibility===option.key && styles.audienceActive]}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}: ${option.hint}`}
              onPress={()=>setVisibility(option.key)}
            >
              <Text style={styles.audienceTitle}>{option.label}</Text>
              <Text style={styles.audienceHint}>{option.hint}</Text>
            </Pressable>
          ))}
        </View>
      )}

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
      <Pressable
        style={[styles.keep,keepAsMemory && styles.keepOn]}
        accessibilityRole="switch"
        accessibilityState={{checked:keepAsMemory}}
        accessibilityLabel="Keep this as a Memory after it expires"
        onPress={()=>setKeepAsMemory((on)=>!on)}
      >
        <Text style={styles.keepTitle}>{keepAsMemory ? "✓ Keep this as a Memory" : "Keep this as a Memory"}</Text>
        <Text style={styles.keepHint}>
          {keepAsMemory
            ? "When it stops being live it becomes a Memory, shared with exactly the same people."
            : "Off — this disappears in 24 hours and is not kept."}
        </Text>
      </Pressable>

      {!selectedPlace && (
        <>
          <Text style={styles.label}>Location <Text style={styles.optional}>(optional)</Text></Text>
          <Pressable
            style={styles.locationButton}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={coordinates ? "Remove the location from this Moment" : "Add your approximate location"}
            onPress={coordinates ? ()=>setCoordinates(null) : addLocation}
          >
            {locating
              ? <ActivityIndicator color="#d9ceff"/>
              : <Text style={styles.locationText}>
                  {coordinates ? "✓ Approximate location added — tap to remove" : "Add my approximate location"}
                </Text>}
          </Pressable>
          <Text style={styles.locationHint}>
            Rounded to roughly 100 metres before it is sent. Skip it and this Moment carries your area only.
          </Text>
        </>
      )}

      <Pressable style={[styles.publishButton,publishing && styles.disabled]} disabled={publishing} onPress={publish}>
        {publishing ? <ActivityIndicator color="white"/> : <Text style={styles.publishText}>Publish Moment</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  keep:{borderWidth:2,borderColor:"#45454c",borderRadius:12,padding:14,marginTop:12,backgroundColor:"#222226"},
  keepOn:{borderColor:"#7fe0ab",backgroundColor:"#12291d"},
  keepTitle:{color:"white",fontWeight:"900",fontSize:14},
  keepHint:{color:"#a5a5b0",fontSize:12,lineHeight:17,marginTop:4},
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:"white",fontSize:31,fontWeight:"900",marginTop:4},
  subtitle:{color:"#a9a9b2",fontSize:14,lineHeight:21,marginTop:7,marginBottom:17},
  errorCard:{backgroundColor:"#441f25",borderColor:"#7f3541",borderWidth:1,borderRadius:13,padding:13,marginBottom:14},
  errorText:{color:"#ffbdc7",lineHeight:19},
  mediaCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:17,padding:12},
  mediaEmpty:{height:220,borderRadius:13,backgroundColor:"#29292e",alignItems:"center",justifyContent:"center",padding:22},
  mediaEmptyIcon:{fontSize:36},
  mediaEmptyTitle:{color:"white",fontSize:19,fontWeight:"900",marginTop:9},
  mediaEmptyText:{color:"#9d9da6",textAlign:"center",marginTop:6,lineHeight:19},
  removeMediaButton:{alignSelf:"center",paddingHorizontal:12,paddingVertical:9,marginTop:5},
  removeMediaText:{color:"#c7b9ef",fontSize:12,fontWeight:"900"},
  mediaButtons:{flexDirection:"row",gap:10,marginTop:11},
  mediaButton:{flex:1,backgroundColor:"#302655",borderColor:"#5d4b91",borderWidth:1,borderRadius:11,paddingVertical:12,alignItems:"center"},
  mediaButtonText:{color:"#e2d9ff",fontWeight:"900"},
  audienceRow:{flexDirection:"row",gap:9},
  audience:{flex:1,backgroundColor:"#25252a",borderColor:"#44444c",borderWidth:1,borderRadius:12,padding:13},
  audienceActive:{backgroundColor:"#2d2152",borderColor:"#644be0"},
  audienceTitle:{color:"white",fontWeight:"900"},
  audienceHint:{color:"#85858e",fontSize:10,lineHeight:15,marginTop:3},
  audienceNote:{color:"#a9a9b2",fontSize:12,lineHeight:18},
  locationButton:{backgroundColor:"#29233d",borderColor:"#554777",borderWidth:1,borderRadius:12,padding:13,alignItems:"center"},
  locationText:{color:"#d9ceff",fontWeight:"900"},
  locationHint:{color:"#85858e",fontSize:11,lineHeight:16,marginTop:6},
  label:{color:"white",fontSize:15,fontWeight:"900",marginTop:20,marginBottom:8},
  optional:{color:"#85858e",fontWeight:"700"},
  captionInput:{minHeight:120,backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,color:"white",fontSize:15,lineHeight:22,padding:14},
  counter:{color:"#777780",fontSize:11,textAlign:"right",marginTop:5},
  typeRow:{flexDirection:"row",flexWrap:"wrap",gap:7},
  typeButton:{backgroundColor:"#252529",borderColor:"#414147",borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:8},
  typeButtonActive:{backgroundColor:"#3212b6",borderColor:"#6245e8"},
  typeText:{color:"#a3a3ac",fontSize:12,fontWeight:"900"},
  typeTextActive:{color:"white"},
  placesCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:11,marginTop:11},
  placeSearch:{backgroundColor:"#2b2b30",borderColor:"#47474f",borderWidth:1,borderRadius:11,color:"white",paddingHorizontal:12,paddingVertical:11,marginBottom:8},
  placeRow:{flexDirection:"row",alignItems:"center",borderRadius:11,padding:8,marginTop:5},
  placeRowSelected:{backgroundColor:"#302655",borderColor:"#5d4b91",borderWidth:1},
  placeImage:{width:46,height:46,borderRadius:9,backgroundColor:"#303036"},
  placeFallback:{width:46,height:46,borderRadius:9,backgroundColor:"#303036",alignItems:"center",justifyContent:"center"},
  placeName:{color:"white",fontWeight:"800",flex:1,marginLeft:10},
  placeCheck:{color:"#c8b6ff",fontSize:18,fontWeight:"900",width:24,textAlign:"center"},
  noPlaces:{color:"#92929b",textAlign:"center",paddingVertical:18},
  publishButton:{backgroundColor:"#3212b6",borderRadius:14,paddingVertical:16,alignItems:"center",marginTop:22},
  publishText:{color:"white",fontSize:16,fontWeight:"900"},
  disabled:{opacity:0.65}
});
