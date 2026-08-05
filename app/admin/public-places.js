import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {useAdminGate} from "../../hooks/useAdminGate";
import {useFeedback} from "../../context/FeedbackContext";
import {PUBLIC_PLACE_TYPES,publicPlaceTypeLabel,roundCoordinate} from "../../utils/places";
import {INK} from "../../utils/tokens";

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

  if(checking || !allowed){
    return(
      <View style={styles.centre}>
        {checking
          ? <ActivityIndicator size="large" color={INK.ink}/>
          : <Text style={styles.centreText}>{gateError || "An admin account is required to open this screen."}</Text>}
      </View>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Public places</Text>
      <Text style={styles.subtitle}>
        Parks, beaches and viewpoints, as canonical rows. One row per place means one page, one follow
        and one set of Moments instead of a different spelling every time somebody checks in.
      </Text>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{form.id ? "Edit place" : "Add a place"}</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          value={form.name}
          onChangeText={(value)=>set("name",value)}
          placeholder="Alexandra Park"
          placeholderTextColor={INK.inkSoft}
          style={styles.input}
          maxLength={120}
          accessibilityLabel="Public place name"
        />

        <Text style={styles.label}>TYPE</Text>
        <View style={styles.wrap}>
          {PUBLIC_PLACE_TYPES.map((item)=>(
            <Pressable
              key={item.key}
              style={[styles.chip,form.place_type===item.key && styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={()=>set("place_type",item.key)}
            >
              <Text style={styles.chipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>AREA</Text>
        <View style={styles.wrap}>
          <Pressable
            style={[styles.chip,!form.area_id && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel="No area yet"
            onPress={()=>set("area_id",null)}
          >
            <Text style={styles.chipText}>No area yet</Text>
          </Pressable>
          {areas.map((area)=>(
            <Pressable
              key={area.id}
              style={[styles.chip,form.area_id===area.id && styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={area.name}
              onPress={()=>set("area_id",area.id)}
            >
              <Text style={styles.chipText}>{area.name}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>LATITUDE</Text>
            <TextInput
              value={form.latitude}
              onChangeText={(value)=>set("latitude",value)}
              placeholder="50.855"
              placeholderTextColor={INK.inkSoft}
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Latitude"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>LONGITUDE</Text>
            <TextInput
              value={form.longitude}
              onChangeText={(value)=>set("longitude",value)}
              placeholder="0.573"
              placeholderTextColor={INK.inkSoft}
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Longitude"
            />
          </View>
        </View>
        <Text style={styles.help}>Rounded to three decimal places, the same precision a check-in is stored at.</Text>

        <Text style={styles.label}>WHERE TO FIND IT</Text>
        <TextInput
          value={form.location_description}
          onChangeText={(value)=>set("location_description",value)}
          placeholder="Main gate on St Helens Road"
          placeholderTextColor={INK.inkSoft}
          style={styles.input}
          maxLength={200}
          accessibilityLabel="Where to find it"
        />

        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          value={form.description}
          onChangeText={(value)=>set("description",value)}
          placeholder="What is here, and what people come for."
          placeholderTextColor={INK.inkSoft}
          style={[styles.input,styles.textarea]}
          multiline
          textAlignVertical="top"
          maxLength={1000}
          accessibilityLabel="Description"
        />

        <Text style={styles.label}>IMAGE URL</Text>
        <TextInput
          value={form.image_url}
          onChangeText={(value)=>set("image_url",value)}
          placeholder="https://..."
          placeholderTextColor={INK.inkSoft}
          style={styles.input}
          autoCapitalize="none"
          accessibilityLabel="Image URL"
        />

        <Text style={styles.label}>STATUS</Text>
        <View style={styles.wrap}>
          {STATUSES.map((status)=>(
            <Pressable
              key={status}
              style={[styles.chip,form.status===status && styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Status ${status}`}
              onPress={()=>set("status",status)}
            >
              <Text style={styles.chipText}>{status}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable
            style={[styles.primary,saving && styles.disabled]}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={form.id ? "Save this public place" : "Add this public place"}
            onPress={save}
          >
            {saving
              ? <ActivityIndicator color={INK.card}/>
              : <Text style={styles.primaryText}>{form.id ? "Save place" : "Add place"}</Text>}
          </Pressable>

          {!!form.id && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Stop editing"
              onPress={()=>{setForm(EMPTY);setError("");}}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>{places.length} public place{places.length===1 ? "" : "s"}</Text>

      {loading ? <ActivityIndicator color={INK.ink} style={styles.loader}/> : places.map((place)=>(
        <View key={place.id} style={styles.placeCard}>
          <Text style={styles.placeName}>{place.name}</Text>
          <Text style={styles.placeDetail}>
            {publicPlaceTypeLabel(place.place_type)}
            {place.area_id && areaName[place.area_id] ? ` · ${areaName[place.area_id]}` : " · no area yet"}
            {` · ${place.status}`}
          </Text>

          <View style={styles.row}>
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${place.name}`}
              onPress={()=>edit(place)}
            >
              <Text style={styles.secondaryText}>Edit</Text>
            </Pressable>

            {place.status!=="hidden" && (
              <Pressable
                style={styles.secondary}
                accessibilityRole="button"
                accessibilityLabel={`Hide ${place.name}`}
                onPress={()=>confirmHide(place)}
              >
                <Text style={styles.secondaryText}>Hide</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const card={
  backgroundColor:INK.card,
  borderWidth:2,
  borderColor:INK.ink,
  borderRadius:12
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:60},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  centreText:{color:INK.ink,textAlign:"center",lineHeight:22},
  title:{color:INK.ink,fontSize:28,fontWeight:"800",letterSpacing:-0.6},
  subtitle:{color:INK.inkSoft,fontSize:14,lineHeight:21,marginTop:6},
  errorCard:{...card,padding:14,marginTop:14},
  errorText:{color:INK.ink,fontWeight:"700"},
  formCard:{...card,padding:16,marginTop:18},
  formTitle:{color:INK.ink,fontSize:19,fontWeight:"800"},
  label:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1,marginTop:14},
  input:{...card,minHeight:46,paddingHorizontal:12,paddingVertical:10,color:INK.ink,marginTop:6},
  textarea:{minHeight:92},
  help:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:6},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:7},
  chip:{borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:12,paddingVertical:7},
  chipActive:{backgroundColor:INK.hair},
  chipText:{color:INK.ink,fontWeight:"800",fontSize:12},
  row:{flexDirection:"row",gap:10,marginTop:14,flexWrap:"wrap"},
  half:{flex:1,minWidth:130},
  primary:{minHeight:48,paddingHorizontal:20,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12},
  primaryText:{color:INK.card,fontWeight:"800"},
  secondary:{minHeight:44,paddingHorizontal:16,justifyContent:"center",alignItems:"center",...card},
  secondaryText:{color:INK.ink,fontWeight:"800"},
  disabled:{opacity:0.6},
  sectionTitle:{color:INK.ink,fontSize:19,fontWeight:"800",marginTop:26,marginBottom:10},
  loader:{marginTop:16},
  placeCard:{...card,padding:14,marginBottom:11},
  placeName:{color:INK.ink,fontSize:16,fontWeight:"800"},
  placeDetail:{color:INK.inkSoft,fontSize:12,marginTop:3}
});
