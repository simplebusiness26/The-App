import React from "react";
import {useLocalSearchParams} from "expo-router";
import ReviewComposer from "../../../components/ReviewComposer";

// Reviewing a park. Same composer as every other place type -- there is no
// public_place_reviews table and there should not be one: a park is a place,
// not its own concept, so it writes to explorer_reviews like the rest.
// Contextual entry: type and id already known, so this renders the real form
// directly with no picker. See components/ReviewComposer.js for the generic
// (Create hub) entry.
export default function PublicPlaceReview(){
  const {id,qr}=useLocalSearchParams();
  return <ReviewComposer type="public_place" id={id} qr={qr}/>;
}
