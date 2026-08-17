import React from "react";
import {useLocalSearchParams} from "expo-router";
import ReviewComposer from "../../../components/ReviewComposer";

// Contextual entry into the Review Composer -- type and id already known, so
// this renders the real form directly with no picker. See
// components/ReviewComposer.js for the generic (Create hub) entry.
export default function EventReview(){
  const {id,qr}=useLocalSearchParams();
  return <ReviewComposer type="event" id={id} qr={qr}/>;
}
