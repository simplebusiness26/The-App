import React from "react";
import {useLocalSearchParams} from "expo-router";
import ExplorerReviewForm from "../../../components/ExplorerReviewForm";

// Reviewing a park. Same form as every other place type -- there is no
// public_place_reviews table and there should not be one: a park is a place,
// not its own concept, so it writes to explorer_reviews like the rest.
export default function PublicPlaceReview(){
  const {id,qr}=useLocalSearchParams();
  return <ExplorerReviewForm targetType="public_place" targetId={id} qrCode={qr}/>;
}
