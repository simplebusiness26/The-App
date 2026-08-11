import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
Pressable
} from "react-native";

import {router} from "expo-router";

import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";


export default function PropertyReviews(){


const [reviews,setReviews]=useState([]);



useEffect(()=>{

loadReviews();

},[]);



async function loadReviews(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



const {data:claim,error:claimError}=await supabase

.from("claims")

.select("*")

.eq("user_id",user.id)

.eq("status","approved")

.single();



if(claimError){

console.log(claimError);

return;

}



// One review table. utils/reviews.js returns the flattened shape this list
// was written against, so the rename of business_response to
// manager_response is the only field change here.
const {reviews:rows,error}=await loadPlaceReviews("property",claim.property_id);



if(error){

console.log(error);

return;

}



setReviews(rows);


}



return(

<ScrollView style={styles.container}>


<Text style={styles.title}>
Guest Reviews
</Text>



{reviews.length === 0 &&

<Text>
No reviews yet
</Text>

}



{reviews.map(review=>(

<View

key={review.id}

style={styles.card}

>


<Text>
⭐ {review.rating}/5
</Text>



<Text>
{review.comment}
</Text>



<Text>
- {review.name || "Guest"}
</Text>



{review.manager_response &&

<Text>
Response:
{review.manager_response}
</Text>

}



{review.challenged &&

<Text>
Review challenged
</Text>

}



<Pressable

style={styles.button}

onPress={()=>
router.push(
`/property/review-action?id=${review.id}`
)
}

>

<Text style={styles.buttonText}>
Manage Review
</Text>

</Pressable>



</View>

))}



</ScrollView>

);

}



const styles=StyleSheet.create({

container:{
padding:20
},

title:{
fontSize:30,
fontWeight:"bold"
},

card:{
borderWidth:1,
padding:15,
borderRadius:10,
marginTop:15
},

button:{
backgroundColor:"#222",
padding:15,
marginTop:15,
borderRadius:10
},

buttonText:{
color:"white",
textAlign:"center"
}

});