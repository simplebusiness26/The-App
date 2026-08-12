import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {supabase} from "../services/supabase";
import {coordinate} from "../utils/coordinates";
import {INK} from "../utils/tokens";

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
      <Text style={styles.label}>Location</Text>
      <Text style={styles.help}>
        Enter an address or postcode, then choose the correct result. Coordinates are saved automatically.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Address or postcode"
        value={query}
        onChangeText={text=>{
          setQuery(text);
          setSelected(null);
          setResults([]);
          setError("");
        }}
        autoCapitalize="words"
      />

      <Pressable
        style={[styles.searchButton,searching && styles.disabled]}
        onPress={searchAddress}
        disabled={searching || query.trim().length<4}
      >
        {searching
          ? <ActivityIndicator color="white"/>
          : <Text style={styles.searchButtonText}>Find address</Text>
        }
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {results.map(item=>(
        <Pressable
          key={item.id}
          style={styles.result}
          onPress={()=>chooseLocation(item)}
        >
          <Text style={styles.resultTitle}>{item.town || item.postcode || "UK location"}</Text>
          <Text style={styles.resultAddress}>{item.label}</Text>
        </Pressable>
      ))}

      {!!selected && (
        <View style={styles.selected}>
          <Text style={styles.selectedTitle}>✓ Location selected</Text>
          <Text style={styles.selectedText}>{selected.address}</Text>
        </View>
      )}

      <Text style={styles.attribution}>Address search data © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{marginBottom:18},
  label:{fontSize:17,fontWeight:"bold",marginBottom:5},
  help:{color:"#666",lineHeight:20,marginBottom:10},
  input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:11,padding:14},
  searchButton:{backgroundColor:INK.blue,padding:14,borderRadius:10,marginTop:9},
  disabled:{opacity:0.55},
  searchButtonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  error:{color:INK.red,marginTop:9},
  result:{backgroundColor:"white",borderWidth:1,borderColor:INK.ink,borderRadius:10,padding:13,marginTop:9},
  resultTitle:{fontWeight:"bold",marginBottom:4},
  resultAddress:{color:"#555",lineHeight:19},
  selected:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:10,padding:13,marginTop:10},
  selectedTitle:{fontWeight:"bold",color:INK.green},
  selectedText:{marginTop:5,color:"#333"},
  attribution:{fontSize:11,color:"#777",marginTop:8}
});
