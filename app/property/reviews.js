import React,{useCallback,useState} from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
ActivityIndicator
} from "react-native";

import {useFocusEffect} from "expo-router";

import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import ReviewActions from "../../components/ReviewActions";
import {INK} from "../../utils/tokens";

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

const {
data:{
user
}
}=await supabase.auth.getUser();



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
const {reviews:rows,error}=await loadPlaceReviews("property",claim.property_id);



if(error){

console.log(error);
setError("Reviews could not be loaded.");
setLoading(false);
return;

}



setReviews(rows);
setLoading(false);


}



if(loading){
return(
<View style={styles.centre}>
<ActivityIndicator size="large" color={INK.ink}/>
</View>
);
}

if(error){
return(
<View style={styles.centre}>
<Text style={styles.errorText}>{error}</Text>
</View>
);
}



return(

<ScrollView style={styles.container} contentContainerStyle={styles.content}>


<Text style={styles.title}>
Guest Reviews
</Text>
<Text style={styles.subtitle}>
Reply to a review or dispute it right here, on the review itself.
</Text>



{reviews.length === 0 &&

<View style={styles.emptyCard}>
<Text style={styles.emptyText}>No reviews yet</Text>
</View>

}



{reviews.map(review=>(

<View

key={review.id}

style={styles.card}

>


<Text style={styles.stars}>
{"★".repeat(review.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-review.rating)}</Text>
</Text>



{!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}

<Text style={styles.comment}>
{review.comment}
</Text>



<Text style={styles.reviewer}>
— {review.name || "Guest"}
</Text>

{/*
  The manager's reply and challenge, inline, under the review they are
  about -- the same ReviewActions/ManagerReply pattern every listing
  detail page uses, not a screen of its own.
*/}
<ReviewActions
  review={review}
  viewerId={viewerId}
  canReply
  onChanged={loadReviews}
/>



</View>

))}



</ScrollView>

);

}



const styles=StyleSheet.create({

container:{
flex:1,
backgroundColor:INK.paper
},

content:{
padding:18,
paddingBottom:50
},

centre:{
flex:1,
backgroundColor:INK.paper,
alignItems:"center",
justifyContent:"center",
padding:28
},

errorText:{
color:INK.inkSoft,
textAlign:"center",
lineHeight:20
},

title:{
fontSize:26,
fontWeight:"900",
color:INK.ink
},

subtitle:{
fontSize:13,
color:INK.inkSoft,
marginTop:6,
marginBottom:18,
lineHeight:19
},

emptyCard:{
backgroundColor:INK.card,
borderColor:INK.hair,
borderWidth:1.5,
borderRadius:14,
padding:18
},

emptyText:{
color:INK.inkSoft,
textAlign:"center"
},

card:{
backgroundColor:INK.card,
borderColor:INK.ink,
borderWidth:2,
padding:16,
borderRadius:14,
marginTop:14,
shadowColor:INK.ink,
shadowOffset:{width:3,height:3},
shadowOpacity:1,
shadowRadius:0,
elevation:0
},

stars:{
color:INK.ink,
fontSize:16,
letterSpacing:1
},

emptyStars:{
color:INK.ink
},

reviewTitle:{
color:INK.ink,
fontSize:16,
fontWeight:"900",
marginTop:8
},

comment:{
color:INK.ink,
fontSize:14,
lineHeight:20,
marginTop:6
},

reviewer:{
color:INK.inkSoft,
fontSize:12,
marginTop:8
}

});
