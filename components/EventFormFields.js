import React from "react";
import {View,Text,TextInput,Pressable,StyleSheet} from "react-native";
import LocationPicker from "./LocationPicker";
import {INK} from "../utils/tokens";

const CATEGORIES=["Community","Family","Food","Music","Arts","Outdoors"];

export default function EventFormFields({form,setForm,statusOptions}){
  function update(field,value){
    setForm(current=>({...current,[field]:value}));
  }

  function chooseLocation(value){
    setForm(current=>({
      ...current,
      location:value.location || "",
      address:value.address,
      latitude:value.latitude,
      longitude:value.longitude
    }));
  }

  return(
    <>
      <Text style={styles.label}>Event details</Text>
      <TextInput style={styles.input} placeholder="Event name *" value={form.name} onChangeText={value=>update("name",value)} maxLength={120}/>
      <TextInput style={styles.input} placeholder="Category *" value={form.category} onChangeText={value=>update("category",value)} maxLength={60}/>

      <View style={styles.chipRow}>
        {CATEGORIES.map(category=>(
          <Pressable
            key={category}
            style={[styles.chip,form.category===category && styles.selectedChip]}
            onPress={()=>update("category",category)}
          >
            <Text style={[styles.chipText,form.category===category && styles.selectedChipText]}>{category}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={[styles.input,styles.multiline]}
        placeholder="Description"
        value={form.description}
        onChangeText={value=>update("description",value)}
        multiline
        maxLength={3000}
      />

      <LocationPicker
        initialAddress={form.address}
        initialLocation={form.location}
        initialLatitude={form.latitude}
        initialLongitude={form.longitude}
        onChange={chooseLocation}
      />

      <Text style={styles.label}>Date and time</Text>
      <Text style={styles.help}>Use YYYY-MM-DD for dates and HH:MM for times.</Text>

      <Text style={styles.fieldLabel}>Starts *</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input,styles.half]} placeholder="YYYY-MM-DD" value={form.startDate} onChangeText={value=>update("startDate",value)} keyboardType="numbers-and-punctuation"/>
        <TextInput style={[styles.input,styles.half]} placeholder="HH:MM" value={form.startTime} onChangeText={value=>update("startTime",value)} keyboardType="numbers-and-punctuation"/>
      </View>

      <Text style={styles.fieldLabel}>Ends (optional)</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input,styles.half]} placeholder="YYYY-MM-DD" value={form.endDate} onChangeText={value=>update("endDate",value)} keyboardType="numbers-and-punctuation"/>
        <TextInput style={[styles.input,styles.half]} placeholder="HH:MM" value={form.endTime} onChangeText={value=>update("endTime",value)} keyboardType="numbers-and-punctuation"/>
      </View>

      <Text style={styles.label}>Attendance</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input,styles.half]} placeholder="Price (£)" value={form.price} onChangeText={value=>update("price",value)} keyboardType="decimal-pad"/>
        <TextInput style={[styles.input,styles.half]} placeholder="Capacity (optional)" value={form.capacity} onChangeText={value=>update("capacity",value)} keyboardType="number-pad"/>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Booking website (optional)"
        value={form.bookingUrl}
        onChangeText={value=>update("bookingUrl",value)}
        autoCapitalize="none"
        keyboardType="url"
      />
      <TextInput
        style={styles.input}
        placeholder="Event image URL (optional)"
        value={form.imageUrl}
        onChangeText={value=>update("imageUrl",value)}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={styles.label}>Listing status</Text>
      <View style={styles.statusRow}>
        {statusOptions.map(option=>(
          <Pressable
            key={option}
            style={[styles.statusButton,form.status===option && styles.selectedStatus]}
            onPress={()=>update("status",option)}
          >
            <Text style={[styles.statusText,form.status===option && styles.selectedStatusText]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles=StyleSheet.create({
  label:{fontSize:17,fontWeight:"bold",marginBottom:8,marginTop:4},
  fieldLabel:{fontWeight:"600",color:INK.ink,marginBottom:7},
  help:{color:INK.inkSoft,lineHeight:20,marginTop:-3,marginBottom:12},
  input:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:11,padding:14,marginBottom:14},
  multiline:{minHeight:115,textAlignVertical:"top"},
  row:{flexDirection:"row",gap:10},
  half:{flex:1},
  chipRow:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:14,marginTop:-5},
  chip:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,paddingHorizontal:11,paddingVertical:7,borderRadius:18},
  selectedChip:{backgroundColor:INK.card,borderColor:INK.blue},
  chipText:{fontSize:12,fontWeight:"600",color:INK.ink},
  selectedChipText:{color:INK.blue},
  statusRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:22},
  statusButton:{paddingHorizontal:15,paddingVertical:10,borderRadius:20,borderWidth:1,borderColor:INK.hair,backgroundColor:INK.card},
  selectedStatus:{borderColor:INK.blue,borderWidth:2},
  statusText:{textTransform:"capitalize",fontWeight:"600"},
  selectedStatusText:{color:INK.ink}
});
