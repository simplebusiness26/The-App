import React from "react";
import {Platform,StyleSheet,TextInput,View} from "react-native";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {MONO} from "./instrument";

// A date and a time are things the app MEASURES, so the control that holds one
// is set in the data face, not the body face -- docs/design-system.md's
// mono/sans split, applied to an input rather than only to a label.
//
// It draws no surface of its own any more. It is always mounted inside a
// `Field`, and Field already owns the inset well, the hairline and the mono
// label; a second bordered card inside that well was the old shape surviving
// one level down. So this renders the bare control and lets the well frame it.

export default function DateTimeField({value,onChange,min}){
  if(Platform.OS==="web"){
    return React.createElement("input",{
      type:"datetime-local",
      value:value || "",
      min:min || undefined,
      onChange:event=>onChange(event.target.value),
      style:{
        width:"100%",
        boxSizing:"border-box",
        backgroundColor:"transparent",
        border:"none",
        borderRadius:SHAPE.radius.control,
        color:INK.readout,
        fontFamily:TYPE.data.family,
        fontSize:TYPE.body.sizes.lg,
        letterSpacing:"0.06em",
        padding:"11px 12px",
        minHeight:SHAPE.tapTarget,
        colorScheme:"dark",
        outline:"none"
      }
    });
  }

  return(
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DDTHH:MM"
        placeholderTextColor={INK.readoutFaint}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  input:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.body.sizes.lg,
    letterSpacing:0.6,
    paddingHorizontal:12,
    paddingVertical:11,
    minHeight:SHAPE.tapTarget
  }
});
