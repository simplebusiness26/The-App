import React,{useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View} from "react-native";
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
import {INK} from "../../utils/tokens";

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
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const isPrivate=visibility==="private";

  useEffect(()=>{loadUser();},[]);
  useEffect(()=>()=>releaseSocialAsset(asset),[asset]);

  // Opened from the camera with the photo already taken.
  useEffect(()=>{
    if(!cameraPhoto || asset) return;
    const taken=assetFromCameraUri(cameraPhoto);
    if(taken) setAsset(taken);
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
          : `Live for now, then ${archiveVisibility==="private" ? "yours alone" : "kept in your archive"}.`,
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
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Keep a Memory</Text>
      <Text style={styles.subtitle}>
        Somewhere you were, kept because you chose to. A check-in disappears; this does not.
      </Text>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <Text style={styles.label}>TITLE</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="First swim of the year"
        placeholderTextColor={INK.inkSoft}
        style={styles.input}
        maxLength={120}
        accessibilityLabel="Memory title"
      />

      <Text style={styles.label}>NOTE</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What you want to remember about it."
        placeholderTextColor={INK.inkSoft}
        style={[styles.input,styles.textarea]}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        accessibilityLabel="Memory note"
      />

      <Text style={styles.label}>PHOTO</Text>
      {asset ? (
        <View>
          <Image source={{uri:asset.previewUri}} style={styles.preview}/>
          <Pressable
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Remove the photo"
            onPress={()=>{releaseSocialAsset(asset);setAsset(null);}}
          >
            <Text style={styles.secondaryText}>Remove photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.secondary} accessibilityRole="button" accessibilityLabel="Choose a photo" onPress={pickPhoto}>
          <Text style={styles.secondaryText}>Choose a photo</Text>
        </Pressable>
      )}

      <Text style={styles.label}>WHERE <Text style={styles.optional}>(optional)</Text></Text>
      <View style={styles.wrap}>
        <Pressable
          style={[styles.chip,!placeType && styles.chipActive]}
          accessibilityRole="button"
          accessibilityLabel="No place"
          onPress={()=>choosePlaceType(null)}
        >
          <Text style={styles.chipText}>Nowhere in particular</Text>
        </Pressable>
        {Object.entries(PLACE_TYPES).map(([key,config])=>(
          <Pressable
            key={key}
            style={[styles.chip,placeType===key && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={config.label}
            onPress={()=>choosePlaceType(key)}
          >
            <Text style={styles.chipText}>{config.label}</Text>
          </Pressable>
        ))}
      </View>

      {!!placeType && (
        <View style={styles.placeCard}>
          <TextInput
            value={placeQuery}
            onChangeText={setPlaceQuery}
            placeholder="Search places"
            placeholderTextColor={INK.inkSoft}
            style={styles.input}
            accessibilityLabel="Search places"
          />
          {loadingPlaces && <ActivityIndicator color={INK.ink} style={styles.loader}/>}
          {!loadingPlaces && filteredPlaces.slice(0,20).map((place)=>(
            <Pressable
              key={place.id}
              style={[styles.placeRow,selectedPlace?.id===place.id && styles.placeRowActive]}
              accessibilityRole="button"
              accessibilityLabel={place.name}
              onPress={()=>setSelectedPlace(place)}
            >
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeCheck}>{selectedPlace?.id===place.id ? "✓" : ""}</Text>
            </Pressable>
          ))}
          {!loadingPlaces && !filteredPlaces.length && <Text style={styles.muted}>No matching places.</Text>}
        </View>
      )}

      <Text style={styles.label}>WHO CAN SEE IT WHILE IT IS LIVE</Text>
      {MEMORY_VISIBILITY.map((option)=>(
        <Pressable
          key={option.key}
          style={[styles.option,visibility===option.key && styles.optionActive]}
          accessibilityRole="button"
          accessibilityLabel={`${option.label}: ${option.hint}`}
          onPress={()=>setVisibility(option.key)}
        >
          <Text style={styles.optionTitle}>{option.label}</Text>
          <Text style={styles.optionHint}>{option.hint}</Text>
        </Pressable>
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
          <Text style={styles.label}>HOW LONG IT STAYS LIVE</Text>
          <View style={styles.wrap}>
            {LIVE_DURATIONS.map((option)=>(
              <Pressable
                key={option.key}
                style={[styles.chip,duration===option.key && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Live for ${option.label}`}
                onPress={()=>setDuration(option.key)}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.help}>
            After that it leaves the live map and discovery for good. Changing the archive setting later never puts it back.
          </Text>
        </>
      )}

      <Text style={styles.label}>AFTERWARDS</Text>
      {ARCHIVE_VISIBILITY.map((option)=>(
        <Pressable
          key={option.key}
          style={[styles.option,archiveVisibility===option.key && styles.optionActive]}
          accessibilityRole="button"
          accessibilityLabel={`Afterwards, ${option.label}: ${option.hint}`}
          onPress={()=>setArchiveVisibility(option.key)}
        >
          <Text style={styles.optionTitle}>{option.label}</Text>
          <Text style={styles.optionHint}>{option.hint}</Text>
        </Pressable>
      ))}
      <Text style={styles.help}>
        This starts at "Only me" whatever you chose above. It is yours to keep either way — the archive stays available to
        you even when nobody else can see it.
      </Text>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.optionTitle}>Show on my profile</Text>
          <Text style={styles.optionHint}>
            Only to people already allowed to see it. It does not make a private Memory public.
          </Text>
        </View>
        <Switch
          value={showOnProfile}
          onValueChange={setShowOnProfile}
          accessibilityLabel="Show this Memory on my profile"
        />
      </View>

      <Pressable
        style={[styles.primary,saving && styles.disabled]}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Save this Memory"
        onPress={save}
      >
        {saving ? <ActivityIndicator color={INK.card}/> : <Text style={styles.primaryText}>Save Memory</Text>}
      </Pressable>
    </ScrollView>
  );
}

const card={backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:60},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  title:{color:INK.ink,fontSize:28,fontWeight:"800",letterSpacing:-0.6},
  subtitle:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:6},
  errorCard:{...card,padding:14,marginTop:14},
  errorText:{color:INK.ink,fontWeight:"700"},
  label:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1,marginTop:22},
  optional:{color:INK.inkSoft,fontWeight:"600"},
  input:{...card,minHeight:46,paddingHorizontal:12,paddingVertical:10,color:INK.ink,marginTop:7},
  textarea:{minHeight:96},
  preview:{width:"100%",height:200,borderRadius:12,borderWidth:2,borderColor:INK.ink,marginTop:8},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:8},
  chip:{borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:12,paddingVertical:8},
  chipActive:{backgroundColor:INK.hair},
  chipText:{color:INK.ink,fontWeight:"800",fontSize:12},
  placeCard:{...card,padding:11,marginTop:10},
  placeRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,paddingHorizontal:6},
  placeRowActive:{backgroundColor:INK.hair,borderRadius:8},
  placeName:{color:INK.ink,fontWeight:"700",flex:1},
  placeCheck:{color:INK.ink,fontWeight:"800",fontSize:16},
  option:{...card,padding:13,marginTop:8},
  optionActive:{backgroundColor:INK.hair},
  optionTitle:{color:INK.ink,fontWeight:"800"},
  optionHint:{color:INK.ink,fontSize:12,lineHeight:17,marginTop:3},
  help:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:9},
  switchRow:{...card,padding:13,marginTop:20,flexDirection:"row",alignItems:"center",gap:12},
  switchText:{flex:1},
  loader:{marginVertical:14},
  muted:{color:INK.inkSoft,padding:8},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12,marginTop:24},
  primaryText:{color:INK.card,fontWeight:"800"},
  secondary:{...card,minHeight:48,justifyContent:"center",alignItems:"center",marginTop:8},
  secondaryText:{color:INK.ink,fontWeight:"800"},
  disabled:{opacity:0.6}
});
