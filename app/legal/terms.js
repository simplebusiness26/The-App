import React from "react";
import LegalScreen from "../../components/LegalScreen";
import {TERMS} from "../../utils/legal";

export default function Terms(){
  return(
    <LegalScreen
      title="Terms"
      lead="What Xplorer is, and what is expected of everybody using it."
      sections={TERMS}
    />
  );
}
