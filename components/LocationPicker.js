import React,{useEffect,useState} from "react";
import {View,Text,TextInput,StyleSheet} from "react-native";
import {supabase} from "../services/supabase";
import {coordinate} from "../utils/coordinates";
import {INK,TYPE} from "../utils/tokens";
import {Action,Field,fieldInputStyle,Glyph,MONO,Notice,Row,SectionRule} from "./instrument";

// The address-search location control.
//
// REBUILT ON THE KIT, NOT RECOLOURED. It was a bold 17px heading, a bordered
// input, a filled blue button, a stack of hand-drawn result cards and a green
// "location selected" line -- `agree` green, which docs/design-system.md
// reserves for a manager answering a review and forbids as a generic success
// colour. The input is a Field well now, the button is an Action, each result
// is a Row, and the confirmation is a readout of what was actually saved.

export default function LocationPicker({
  initialAddress="",
  initialLocation="",
  initialLatitude=null,
  initialLongitude=null,
  onChange
}){
  const [query,setQuery]=useState(initialAddress || "");
  const [results,setResults]=useState([]);
  const [searching,setSearching]=useState(false);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(null);

  useEffect(()=>{
    setQuery(initialAddress || "");

    if(
      initialAddress &&
      // Number("")===0 is finite, so the old check treated a listing with no
      // coordinates as one sitting at 0,0 and centred the picker there.
      coordinate(initialLatitude)!==null &&
      coordinate(initialLongitude)!==null
    ){
      setSelected({
        address:initialAddress,
        town:initialLocation || "",
        latitude:Number(initialLatitude),
        longitude:Number(initialLongitude)
      });
    }
  },[initialAddress,initialLocation,initialLatitude,initialLongitude]);

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

    if(rows.length===0){
      setError("No matching UK addresses were found.");
    }
  }

  function chooseLocation(item){
    const value={
      address:item.address,
      location:item.town || item.postcode || "",
      latitude:Number(item.latitude),
      longitude:Number(item.longitude)
    };

    setSelected(value);
    setQuery(item.address);
    setResults([]);
    setError("");
    onChange?.(value);
  }

  return(
    <View style={styles.container}>
      <Field
        label="Location"
        hint="Enter an address or postcode, then choose the correct result. Coordinates are saved automatically."
      >
        <TextInput
          style={fieldInputStyle}
          placeholder="Address or postcode"
          placeholderTextColor={INK.readoutFaint}
          value={query}
          accessibilityLabel="Address or postcode"
          onChangeText={text=>{
            setQuery(text);
            setSelected(null);
            setResults([]);
            setError("");
          }}
          autoCapitalize="words"
        />
      </Field>

      <Action
        kind="primary"
        label="Find address"
        glyph="search"
        accessibilityLabel="Find address"
        loading={searching}
        disabled={searching || query.trim().length<4}
        onPress={searchAddress}
      />

      {!!error && (
        <View accessibilityRole="alert" style={styles.problem}>
          <Notice tone="scheduled" label="NO MATCH">{error}</Notice>
        </View>
      )}

      {!!results.length && <SectionRule label="Matches" meta={String(results.length)}/>}

      {results.map(item=>(
        <Row
          key={item.id}
          glyph="pin"
          title={item.town || item.postcode || "UK location"}
          sub={item.label}
          onPress={()=>chooseLocation(item)}
        />
      ))}

      {/* What was actually saved, read back. A tick and the word "selected"
          said the act happened; this says what the act recorded. */}
      {!!selected && (
        <View style={styles.selected}>
          <View style={styles.selectedHead}>
            <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/>
            <Text style={styles.selectedLabel}>LOCATION SET</Text>
          </View>
          <Text style={styles.selectedText}>{selected.address}</Text>
        </View>
      )}

      <Text style={styles.attribution}>Address search data © OpenStreetMap contributors</Text>
    </View>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  container:{marginBottom:18},
  problem:{marginTop:12},
  selected:{marginTop:12,gap:5},
  selectedHead:{flexDirection:"row",alignItems:"center",gap:6},
  selectedLabel:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  selectedText:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },
  attribution:{
    ...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.6,marginTop:12
  }
});
