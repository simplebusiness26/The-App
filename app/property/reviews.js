import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ScrollView,ActivityIndicator} from "react-native";
import {useFocusEffect} from "expo-router";

import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import ReviewActions from "../../components/ReviewActions";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Empty,
  Meter,
  MONO,
  Notice,
  Panel,
  ReadoutStrip,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Guest reviews, from the manager's side of a property they run.
//
// This used to push to /property/review-action to reply or dispute -- a
// screen retired per fc-03 (FINAL_PRODUCT_CONTRACT.md), because it duplicated
// the inline ManagerReply pattern every listing detail page already draws on
// its own review cards. That screen is gone from app/_layout.js; this file
// was its one remaining live caller and was left pointing at a dead route
// until now.
//
// Reaching this screen at all requires an approved claim on the property (see
// loadReviews below), so every review on it is already one this Explorer
// manages -- canReply is unconditionally true for the same reason the button
// used to be on every card.
//
// A RATING IS A MEASUREMENT. Five repeated star characters were a count you had
// to do yourself, in a glyph belonging to the system font. It is read off a
// ticked meter now, the same one FeedCard uses, with the number beside it --
// while the review itself stays in the body face, because a person wrote it.
export default function PropertyReviews(){
  const [reviews,setReviews]=useState([]);
  const [viewerId,setViewerId]=useState(null);
  const [propertyId,setPropertyId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadReviews();
  },[]));

  async function loadReviews(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setError("Please log in to manage your property's reviews.");
      setLoading(false);
      return;
    }

    setViewerId(user.id);

    const {data:claim,error:claimError}=await supabase
      .from("claims")
      .select("*")
      .eq("user_id",user.id)
      .eq("status","approved")
      .single();

    if(claimError){
      console.log(claimError);
      setError("You do not manage an approved property.");
      setLoading(false);
      return;
    }

    setPropertyId(claim.property_id);

    // One review table. utils/reviews.js returns the flattened shape this list
    // was written against, so the rename of business_response to
    // manager_response is the only field change here.
    const {reviews:rows,error:loadError}=await loadPlaceReviews("property",claim.property_id);

    if(loadError){
      console.log(loadError);
      setError("Reviews could not be loaded.");
      setLoading(false);
      return;
    }

    setReviews(rows);
    setLoading(false);
  }

  if(loading){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
      </Screen>
    );
  }

  if(error){
    return(
      <Screen>
        <ScreenTitle eyebrow="Manager" title="Guest reviews"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Not loaded">{error}</Notice>
        </View>
      </Screen>
    );
  }

  const rated=reviews.filter((review)=>Number(review.rating)>0);
  const average=rated.length
    ? (rated.reduce((sum,review)=>sum+Number(review.rating),0)/rated.length)
    : 0;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="Manager"
          title="Guest reviews"
          meta="Reply to a review or dispute it right here, on the review itself."
        />

        <View style={styles.body}>
          <ReadoutStrip
            items={[
              {label:"Reviews",value:String(reviews.length)},
              {label:"Mean",value:rated.length ? average.toFixed(1) : "—",unit:rated.length ? "/5" : undefined}
            ]}
          />

          <SectionRule label="Every review" meta={String(reviews.length)}/>

          {reviews.length===0 ? (
            <Empty
              glyph="comment"
              title="No reviews yet"
              instruction="Print the guest review QR code from your property dashboard and put it where guests will see it."
            />
          ) : reviews.map((review)=>(
            <Panel key={review.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.headKind}>Review</Text>
                <View style={styles.headLine}/>
              </View>

              {!!review.rating && (
                <View style={styles.ratingRow} accessibilityLabel={`Rated ${review.rating} out of 5`}>
                  <Meter value={review.rating} max={5} width={92} tone="exists" label="Rated"/>
                  <Text style={styles.ratingValue}>{review.rating}/5</Text>
                </View>
              )}

              {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}

              <Text style={styles.comment}>{review.comment}</Text>

              {/* A person's name is something a person wrote, so it stays in
                  the body face -- mono is for what the app measured. */}
              <Text style={styles.reviewer}>— {review.name || "Guest"}</Text>

              {/*
                The manager's reply and challenge, inline, under the review they
                are about -- the same ReviewActions/ManagerReply pattern every
                listing detail page uses, not a screen of its own.
              */}
              <ReviewActions
                review={review}
                viewerId={viewerId}
                canReply
                onChanged={loadReviews}
              />
            </Panel>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center"},

  card:{padding:14,marginBottom:10},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:10},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},

  ratingRow:{flexDirection:"row",alignItems:"center",gap:10},
  ratingValue:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.lg},

  reviewTitle:{
    color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",
    letterSpacing:-0.2,marginTop:11
  },
  comment:{
    color:INK.readout,fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*1.5,marginTop:7
  },
  reviewer:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:8}
});
