import React from "react";
import {StyleSheet,View} from "react-native";
import {useLocalSearchParams} from "expo-router";
import ExplorerProfileScreen from "../../components/ExplorerProfileScreen";
import ProfileSocialBar from "../../components/ProfileSocialBar";
import ProfileSafetyActions from "../../components/ProfileSafetyActions";
import MessageButton from "../../components/MessageButton";
import {Screen} from "../../components/instrument";

export default function PublicProfile(){
  const {id}=useLocalSearchParams();
  const profileId=Array.isArray(id) ? id[0] : id;

  return(
    <Screen>
      <ExplorerProfileScreen
        profileId={profileId}
        belowIdentity={
          <>
            <ProfileSocialBar profileId={profileId}/>
            {/*
              Only appears once you follow each other. A button that shows for
              everybody and fails for most of them teaches people to distrust
              buttons.
            */}
            <View style={styles.messageRow}>
              <MessageButton profileId={profileId}/>
            </View>
            <ProfileSafetyActions profileId={profileId}/>
          </>
        }
      />
    </Screen>
  );
}

const styles=StyleSheet.create({
  messageRow:{alignItems:"center",marginTop:10}
});
