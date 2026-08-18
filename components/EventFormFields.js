import React from "react";
import {View,TextInput,StyleSheet} from "react-native";
import LocationPicker from "./LocationPicker";
import {INK} from "../utils/tokens";
import {Chip,Field,fieldInputStyle,SectionRule,Segmented} from "./instrument";

// The event form's fields, shared by app/events/add.js and app/events/edit/[id].js.
//
// REBUILT ON THE KIT. Every input was a bordered card with a placeholder doing
// the label's job, so the form read as a stack of grey boxes and a screen
// reader got nothing until the box was empty. Each one is a `Field` now: a mono
// label that names it, an inset well it is cut into, `required` where the
// validator actually requires it, and `hint` for the format rules that used to
// float above the group as loose help text.
//
// Category keeps both ways in -- type anything, or take one of the six the app
// already knows -- but they share one well now, separated by a hairline, so it
// reads as one question with two answers rather than a field and a stray row
// of pills underneath it.
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
      <SectionRule label="Event details"/>

      <Field label="Event name" required>
        <TextInput
          style={fieldInputStyle}
          placeholder="Harbour lights switch-on"
          placeholderTextColor={INK.readoutFaint}
          value={form.name}
          onChangeText={value=>update("name",value)}
          maxLength={120}
        />
      </Field>

      <Field label="Category" required hint="Type your own, or take one of these.">
        <TextInput
          style={fieldInputStyle}
          placeholder="Music"
          placeholderTextColor={INK.readoutFaint}
          value={form.category}
          onChangeText={value=>update("category",value)}
          maxLength={60}
        />
        <View style={styles.wellDivider}/>
        <View style={styles.chips}>
          {CATEGORIES.map(category=>(
            <Chip
              key={category}
              label={category}
              selected={form.category===category}
              onPress={()=>update("category",category)}
            />
          ))}
        </View>
      </Field>

      <Field label="Description">
        <TextInput
          style={[fieldInputStyle,styles.multiline]}
          placeholder="What happens, who it is for, what to bring."
          placeholderTextColor={INK.readoutFaint}
          value={form.description}
          onChangeText={value=>update("description",value)}
          multiline
          textAlignVertical="top"
          maxLength={3000}
        />
      </Field>

      <LocationPicker
        initialAddress={form.address}
        initialLocation={form.location}
        initialLatitude={form.latitude}
        initialLongitude={form.longitude}
        onChange={chooseLocation}
      />

      <SectionRule label="Date and time"/>

      <Field label="Starts" required hint="Use YYYY-MM-DD for dates and HH:MM for times.">
        <View style={styles.pair}>
          <TextInput
            style={[fieldInputStyle,styles.half]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={INK.readoutFaint}
            value={form.startDate}
            onChangeText={value=>update("startDate",value)}
            keyboardType="numbers-and-punctuation"
          />
          <View style={styles.pairDivider}/>
          <TextInput
            style={[fieldInputStyle,styles.half]}
            placeholder="HH:MM"
            placeholderTextColor={INK.readoutFaint}
            value={form.startTime}
            onChangeText={value=>update("startTime",value)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </Field>

      <Field label="Ends" hint="Optional.">
        <View style={styles.pair}>
          <TextInput
            style={[fieldInputStyle,styles.half]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={INK.readoutFaint}
            value={form.endDate}
            onChangeText={value=>update("endDate",value)}
            keyboardType="numbers-and-punctuation"
          />
          <View style={styles.pairDivider}/>
          <TextInput
            style={[fieldInputStyle,styles.half]}
            placeholder="HH:MM"
            placeholderTextColor={INK.readoutFaint}
            value={form.endTime}
            onChangeText={value=>update("endTime",value)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </Field>

      <SectionRule label="Attendance"/>

      <View style={styles.row}>
        <Field label="Price" hint="In pounds. 0 is free." style={styles.rowField}>
          <TextInput
            style={fieldInputStyle}
            placeholder="0"
            placeholderTextColor={INK.readoutFaint}
            value={form.price}
            onChangeText={value=>update("price",value)}
            keyboardType="decimal-pad"
          />
        </Field>
        <Field label="Capacity" hint="Optional." style={styles.rowField}>
          <TextInput
            style={fieldInputStyle}
            placeholder="60"
            placeholderTextColor={INK.readoutFaint}
            value={form.capacity}
            onChangeText={value=>update("capacity",value)}
            keyboardType="number-pad"
          />
        </Field>
      </View>

      <Field label="Booking website" hint="Optional.">
        <TextInput
          style={fieldInputStyle}
          placeholder="https://"
          placeholderTextColor={INK.readoutFaint}
          value={form.bookingUrl}
          onChangeText={value=>update("bookingUrl",value)}
          autoCapitalize="none"
          keyboardType="url"
        />
      </Field>

      <Field label="Event image URL" hint="Optional.">
        <TextInput
          style={fieldInputStyle}
          placeholder="https://"
          placeholderTextColor={INK.readoutFaint}
          value={form.imageUrl}
          onChangeText={value=>update("imageUrl",value)}
          autoCapitalize="none"
          keyboardType="url"
        />
      </Field>

      {/* Pick one of N, as a detented selector -- not a row of pills that fill
          with a state ink when chosen. A listing status is not a state a place
          is in (docs/design-system.md). */}
      <Field label="Listing status">
        <Segmented
          items={statusOptions}
          active={form.status}
          onChange={value=>update("status",value)}
        />
      </Field>
    </>
  );
}

const styles=StyleSheet.create({
  multiline:{minHeight:115},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10},
  wellDivider:{height:1,backgroundColor:INK.hairline},
  pair:{flexDirection:"row",alignItems:"stretch"},
  pairDivider:{width:1,backgroundColor:INK.hairline},
  half:{flex:1},
  row:{flexDirection:"row",gap:10},
  rowField:{flex:1}
});
