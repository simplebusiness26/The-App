import React from "react";
import {StyleSheet,View} from "react-native";
import {useLocalSearchParams} from "expo-router";
import ExplorerProfileScreen from "../../components/ExplorerProfileScreen";
import ProfileSocialBar from "../../components/ProfileSocialBar";
import ProfileSafetyActions from "../../components/ProfileSafetyActions";

export default function PublicProfile(){
  const {id}=useLocalSearchParams();
  const profileId=Array.isArray(id) ? id[0] : id;

  return(
    <View style={styles.screen}>
      <ExplorerProfileScreen
        profileId={profileId}
        belowIdentity={
          <>
            <ProfileSocialBar profileId={profileId}/>
            <ProfileSafetyActions profileId={profileId}/>
          </>
        }
      />
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"}
});
