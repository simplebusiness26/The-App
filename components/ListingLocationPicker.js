import React,{useEffect,useState} from "react";
import {View,Text,TextInput,StyleSheet} from "react-native";
import * as Location from "expo-location";
import {supabase} from "../services/supabase";
import {coordinate} from "../utils/coordinates";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";
import ListingPinMap from "./ListingPinMap";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Action,Field,fieldInputStyle,Glyph,MONO,Notice,Row,SectionRule} from "./instrument";

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
      <Field
        label="Location"
        hint="Search for the address, use your current position, or drag the pin to the exact spot. The pin is what gets saved."
      >
        <TextInput
          style={fieldInputStyle}
          placeholder="Address or postcode"
          placeholderTextColor={INK.readoutFaint}
          value={query}
          accessibilityLabel="Address or postcode"
          onChangeText={(text)=>{
            setQuery(text);
            setAddress(text);
            setResults([]);
            if(pin) emit(pin);
          }}
          autoCapitalize="words"
        />
      </Field>

      <View style={styles.actionsRow}>
        <Action
          kind="primary"
          label="Find address"
          glyph="search"
          accessibilityLabel="Find address"
          style={styles.action}
          loading={searching}
          disabled={searching || query.trim().length<4}
          onPress={searchAddress}
        />

        {/* The emoji pin that opened this button carried its own colour and
            weight onto the housing. It is the drawn glyph every other control
            in the app uses now. */}
        <Action
          kind="secondary"
          label="Use my location"
          glyph="target"
          accessibilityLabel="Use my current location"
          style={styles.action}
          loading={locating}
          disabled={locating}
          onPress={useMyLocation}
        />
      </View>

      {!!error && (
        <View accessibilityRole="alert" style={styles.problem}>
          <Notice tone="scheduled" label="ADDRESS">{error}</Notice>
        </View>
      )}

      {!!results.length && <SectionRule label="Matches" meta={String(results.length)}/>}

      {results.map((item)=>(
        <Row
          key={item.id}
          glyph="pin"
          title={item.town || item.postcode || "UK location"}
          sub={item.label}
          onPress={()=>chooseResult(item)}
        />
      ))}

      {/* The map is a live image, so it sits behind viewfinder brackets like
          every other live image in this app. */}
      <View style={styles.mapWrap}>
        <ListingPinMap latitude={mapCentre.latitude} longitude={mapCentre.longitude} onDragEnd={dragPin}/>
      </View>

      <View style={styles.pinState}>
        {pin ? <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/> : <Glyph name="info" size={13} colour={INK.readoutFaint}/>}
        <Text style={styles.pinStateText}>
          {pin
            ? "Pin set — drag it to fine-tune the exact spot."
            : "No pin yet. Search, use your location, or drag the map above once it moves."}
        </Text>
      </View>

      <Text style={styles.attribution}>Address search data © OpenStreetMap contributors</Text>
    </View>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  container:{marginBottom:18},

  actionsRow:{flexDirection:"row",gap:8},
  action:{flex:1},

  problem:{marginTop:12},

  mapWrap:{
    marginTop:14,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,
    overflow:"hidden",
    backgroundColor:INK.inset
  },

  pinState:{flexDirection:"row",alignItems:"flex-start",gap:7,marginTop:10},
  pinStateText:{
    flex:1,color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5
  },

  attribution:{
    ...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.6,marginTop:12
  }
});
