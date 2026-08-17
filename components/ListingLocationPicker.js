import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import * as Location from "expo-location";
import {supabase} from "../services/supabase";
import {coordinate} from "../utils/coordinates";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";
import ListingPinMap from "./ListingPinMap";
import {INK} from "../utils/tokens";

// The manager-form location control: FINAL_PRODUCT_CONTRACT.md's "device-
// location-prefilled draggable pin instead of typed coordinates", used
// uniformly on every listing-form template (business/property/activity-club/
// event add & edit).
//
// WHY THIS IS NOT JUST LocationPicker WITH A MAP BOLTED ON
//
// components/LocationPicker.js is address-search-only: type an address,
// choose a Nominatim result, done. That is still the fastest way to place a
// business or property that already has a postal address, so its search
// stays here unchanged (same geocode-location Edge Function, same cache). The
// contract's own complaint is what happens next: the coordinates it produces
// were typed-through, not placed. So a real pin sits under the search now --
// draggable on both platforms (components/ListingPinMap.js/.web.js) -- and a
// "Use my location" button drops it at the device's own position on demand,
// the same one-tap-and-see-what-happened pattern components/AddLocation.js
// already uses for Moments (permission asked for on press, never on mount,
// and it says which source is in use before and after).
//
// The address TEXT field stays free-typed. There is no reverse-geocoding
// service in this app -- only geocode-location's forward search -- so a pin
// dropped from device GPS or a drag cannot invent a street address; the
// manager still writes what the address line says, same as before. What
// changed is that the coordinates saved are the ones the pin actually sits
// on, not whatever a search result happened to carry.
export default function ListingLocationPicker({
  initialAddress="",
  initialLocation="",
  initialLatitude=null,
  initialLongitude=null,
  onChange
}){
  const [address,setAddress]=useState(initialAddress || "");
  const [location,setLocation]=useState(initialLocation || "");
  const [pin,setPin]=useState(
    coordinate(initialLatitude)!==null && coordinate(initialLongitude)!==null
      ? {latitude:Number(initialLatitude),longitude:Number(initialLongitude)}
      : null
  );

  const [query,setQuery]=useState(initialAddress || "");
  const [results,setResults]=useState([]);
  const [searching,setSearching]=useState(false);
  const [locating,setLocating]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    setAddress(initialAddress || "");
    setQuery(initialAddress || "");
    setLocation(initialLocation || "");

    if(coordinate(initialLatitude)!==null && coordinate(initialLongitude)!==null){
      setPin({latitude:Number(initialLatitude),longitude:Number(initialLongitude)});
    }
    // Only the first time this listing's own data arrives -- see LocationPicker's
    // identical guard reasoning. A person dragging the pin should not have it
    // reset from underneath them by an unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initialAddress,initialLocation,initialLatitude,initialLongitude]);

  function emit(next){
    if(!address.trim() || !next) return;
    onChange?.({
      address:address.trim(),
      location:location || "",
      latitude:next.latitude,
      longitude:next.longitude
    });
  }

  async function searchAddress(){
    const clean=query.trim();
    if(clean.length<4 || searching) return;

    setSearching(true);
    setError("");
    setResults([]);

    const {data,error:invokeError}=await supabase.functions.invoke("geocode-location",{
      body:{query:clean}
    });

    setSearching(false);

    if(invokeError){
      console.log(invokeError);
      setError("Address search failed. Check the address and try again.");
      return;
    }

    if(data?.error){
      setError(data.error);
      return;
    }

    const rows=data?.results || [];
    setResults(rows);

    if(rows.length===0) setError("No matching UK addresses were found.");
  }

  function chooseResult(item){
    const nextAddress=item.address;
    const nextPin={latitude:Number(item.latitude),longitude:Number(item.longitude)};

    setAddress(nextAddress);
    setLocation(item.town || item.postcode || "");
    setQuery(nextAddress);
    setResults([]);
    setError("");
    setPin(nextPin);

    onChange?.({
      address:nextAddress,
      location:item.town || item.postcode || "",
      latitude:nextPin.latitude,
      longitude:nextPin.longitude
    });
  }

  async function useMyLocation(){
    setLocating(true);
    setError("");

    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission?.status!=="granted"){
        throw new Error("Location permission was not granted.");
      }

      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const nextPin={latitude:position.coords.latitude,longitude:position.coords.longitude};
      setPin(nextPin);
      emit(nextPin);

      if(!address.trim()){
        setError("Pin placed at your current position. Add the street address above.");
      }
    }catch(locationError){
      setError(locationError.message || "Your location could not be read.");
    }

    setLocating(false);
  }

  function dragPin(nextPin){
    setPin(nextPin);
    emit(nextPin);
  }

  const mapCentre=pin || DEFAULT_CENTRE;

  return(
    <View style={styles.container}>
      <Text style={styles.label}>Location</Text>
      <Text style={styles.help}>
        Search for the address, use your current position, or drag the pin to the
        exact spot. The pin is what gets saved.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Address or postcode"
        placeholderTextColor={INK.inkSoft}
        value={query}
        onChangeText={(text)=>{
          setQuery(text);
          setAddress(text);
          setResults([]);
          if(pin) emit(pin);
        }}
        autoCapitalize="words"
      />

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.searchButton,searching && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Find address"
          onPress={searchAddress}
          disabled={searching || query.trim().length<4}
        >
          {searching ? <ActivityIndicator color={INK.card}/> : <Text style={styles.searchButtonText}>Find address</Text>}
        </Pressable>

        <Pressable
          style={[styles.locateButton,locating && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          onPress={useMyLocation}
          disabled={locating}
        >
          {locating ? <ActivityIndicator color={INK.ink}/> : <Text style={styles.locateButtonText}>📍 Use my location</Text>}
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {results.map((item)=>(
        <Pressable key={item.id} style={styles.result} onPress={()=>chooseResult(item)}>
          <Text style={styles.resultTitle}>{item.town || item.postcode || "UK location"}</Text>
          <Text style={styles.resultAddress}>{item.label}</Text>
        </Pressable>
      ))}

      <View style={styles.mapWrap}>
        <ListingPinMap latitude={mapCentre.latitude} longitude={mapCentre.longitude} onDragEnd={dragPin}/>
      </View>

      {pin ? (
        <Text style={styles.selectedText}>
          ✓ Pin set — drag it to fine-tune the exact spot.
        </Text>
      ) : (
        <Text style={styles.selectedText}>
          No pin yet. Search, use your location, or drag the map above once it moves.
        </Text>
      )}

      <Text style={styles.attribution}>Address search data © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{marginBottom:18},
  label:{fontSize:17,fontWeight:"900",color:INK.ink,marginBottom:5},
  help:{color:INK.inkSoft,lineHeight:20,marginBottom:10,fontSize:13},
  input:{backgroundColor:INK.card,borderWidth:1.5,borderColor:INK.hair,borderRadius:11,padding:14,color:INK.ink},
  actionsRow:{flexDirection:"row",gap:8,marginTop:9},
  searchButton:{flex:1,backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:2,padding:13,borderRadius:10,alignItems:"center"},
  locateButton:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,padding:13,borderRadius:10,alignItems:"center"},
  disabled:{opacity:0.55},
  searchButtonText:{color:INK.card,fontWeight:"800"},
  locateButtonText:{color:INK.ink,fontWeight:"800"},
  error:{color:INK.ink,marginTop:9,fontSize:12,lineHeight:18},
  result:{backgroundColor:INK.card,borderWidth:1.5,borderColor:INK.ink,borderRadius:10,padding:13,marginTop:9},
  resultTitle:{fontWeight:"900",marginBottom:4,color:INK.ink},
  resultAddress:{color:INK.ink,lineHeight:19,fontSize:13},
  mapWrap:{marginTop:12},
  selectedText:{marginTop:9,color:INK.inkSoft,fontSize:12,lineHeight:18},
  attribution:{fontSize:11,color:INK.inkSoft,marginTop:8}
});
