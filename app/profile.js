import React from "react";
import {StyleSheet,View} from "react-native";
import ExplorerProfileScreen from "../components/ExplorerProfileScreen";
import ProfileSocialBar from "../components/ProfileSocialBar";
import AlexJourneyHeader from "../components/AlexJourneyHeader";
import {INK} from "../utils/tokens";

export default function Profile(){
  return(
    <View style={styles.screen}>
      <View style={styles.context}>
        <AlexJourneyHeader
          compact
          phase="IDENTITY"
          title="Your local passport"
          description="Reputation, relationships, Memories and the places or activities you can manage — one Explorer identity."
          meta="You"
        />
      </View>
      <View style={styles.profile}>
        <ExplorerProfileScreen ownProfile belowIdentity={<ProfileSocialBar ownProfile/>}/>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  context:{paddingHorizontal:14,paddingTop:8},
  profile:{flex:1,minHeight:0}
});
