import React from "react";
import {StyleSheet,View} from "react-native";
import ExplorerProfileScreen from "../components/ExplorerProfileScreen";
import ProfileSocialBar from "../components/ProfileSocialBar";
import {INK} from "../utils/tokens";

export default function Profile(){
  return(
    <View style={styles.screen}>
      <ExplorerProfileScreen ownProfile belowIdentity={<ProfileSocialBar ownProfile/>}/>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper}
});
