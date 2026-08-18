import React from "react";
import {Pressable,StyleSheet,TextInput,View} from "react-native";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Field,fieldInputStyle,Glyph} from "./instrument";

// A search well, not a rounded box with a hairline round it.
//
// This file was one of the last in the app still entirely off the system: no
// token import at all, a 1px border of whatever colour the platform picked, a
// hand-typed borderRadius and a placeholder doing the job of a label. On the
// instrument an input is a WELL -- one surface step BELOW the panel it sits on
// (components/instrument.js, Field) -- with a mono label naming the field
// rather than a sentence sitting inside it waiting to be typed over.
//
// The glyph and the clear control are both part of that: an instrument says
// what a control is for while it is in use, and gives a way to put it back to
// nothing that is not holding backspace down.

export default function SearchBar({
  value,
  onChange,
  label="Search",
  placeholder="Search places",
  hint
}){
  const typed=typeof value==="string" && value.length>0;

  return(
    <Field label={label} hint={hint}>
      <View style={styles.well}>
        <View style={styles.lead} pointerEvents="none">
          <Glyph name="search" size={15} colour={INK.readoutFaint}/>
        </View>

        <TextInput
          style={[fieldInputStyle,styles.input]}
          placeholder={placeholder}
          placeholderTextColor={INK.readoutFaint}
          value={value}
          onChangeText={onChange}
          accessibilityLabel={label}
          returnKeyType="search"
        />

        {typed && (
          <Pressable
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            hitSlop={8}
            onPress={()=>onChange?.("")}
          >
            <Glyph name="close" size={13} colour={INK.readoutSoft}/>
          </Pressable>
        )}
      </View>
    </Field>
  );
}

const styles=StyleSheet.create({
  well:{flexDirection:"row",alignItems:"center"},
  lead:{paddingLeft:11},
  // Flexed so the field fills the well and the two controls sit at its ends,
  // rather than the input claiming a width of its own and leaving a gap.
  input:{flex:1,minWidth:0,fontSize:TYPE.body.sizes.lg},
  clear:{
    width:30,
    height:30,
    marginRight:7,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline
  }
});
