import React from "react";
import ExplorerProfileScreen from "../components/ExplorerProfileScreen";
import ProfileSocialBar from "../components/ProfileSocialBar";
import {Screen} from "../components/instrument";

// The Me tab. The housing comes from the kit rather than a local StyleSheet --
// one View with a background colour is exactly the kind of hand-rolled shape
// that drifts, and Screen is the same housing every other page sits in.
export default function Profile(){
  return(
    <Screen>
      <ExplorerProfileScreen ownProfile belowIdentity={<ProfileSocialBar ownProfile/>}/>
    </Screen>
  );
}
