import React from "react";
import LegalScreen from "../../components/LegalScreen";
import {PRIVACY_POLICY} from "../../utils/legal";

// The text is utils/legal.js, so the policy and the terms cannot drift into two
// different voices and so a solicitor can read both in one file.
export default function Privacy(){
  return(
    <LegalScreen
      title="Privacy"
      lead="What Xplorer stores, who can see it, and how to get rid of it."
      sections={PRIVACY_POLICY}
    />
  );
}
