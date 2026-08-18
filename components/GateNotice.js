import React from "react";
import {View,StyleSheet,ActivityIndicator} from "react-native";
import {router} from "expo-router";
import {INK} from "../utils/tokens";
import {Screen,Empty,Action} from "./instrument";

// What a screen shows instead of itself when the person opening it is not
// entitled to. Shared by the three listing management screens because the
// wording and the shape are the same on all of them, and three copies of a
// refusal is how three different refusals eventually appear.
//
// Never a dead end: a refusal that does not say what to do next is the "Nothing
// here" the design system bans, with extra steps. That is exactly what the
// kit's Empty is for -- it takes an instruction and an action, and it draws the
// dial-face plate rather than a shrug.
export default function GateNotice({checking,message}){
  if(checking){
    return(
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={INK.readout}/>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <View style={styles.centre}>
        <Empty
          glyph="lock"
          title="Not your screen yet"
          instruction={message}
          action={
            <Action
              kind="secondary"
              glyph="forward"
              label="Open the manager dashboard"
              accessibilityLabel="Open the manager dashboard"
              onPress={()=>router.replace("/manager/dashboard")}
            />
          }
        />
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  centre:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:8}
});
