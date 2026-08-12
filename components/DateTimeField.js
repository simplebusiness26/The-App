import React from "react";
import {Platform,StyleSheet,TextInput,View} from "react-native";
import {INK} from "../utils/tokens";

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
        backgroundColor:INK.card,
        border:`1px solid ${INK.ink}`,
        borderRadius:12,
        color:INK.ink,
        fontSize:16,
        padding:"13px 14px",
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
        placeholderTextColor={INK.inkSoft}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  input:{
    backgroundColor:INK.card,
    borderColor:INK.ink,
    borderWidth:1,
    borderRadius:12,
    color:INK.ink,
    fontSize:16,
    paddingHorizontal:14,
    paddingVertical:13
  }
});
