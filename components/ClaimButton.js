import React,{useEffect,useState} from "react";

import {
Pressable,
Text,
StyleSheet,
Alert,
ActivityIndicator
} from "react-native";

import {supabase} from "../services/supabase";
import {INK} from "../utils/tokens";


export default function ClaimButton({
businessId,
propertyId
}){


const [loading,setLoading]=useState(false);

const [status,setStatus]=useState(null);



useEffect(()=>{

checkClaim();

},[]);



async function checkClaim(){


const {
data:{
user
}

}=await supabase.auth.getUser();



if(!user){

return;

}



let query=supabase

.from("claims")

.select("status")

.eq("user_id",user.id);



if(businessId){

query=query.eq(
"business_id",
businessId
);

}



if(propertyId){

query=query.eq(
"property_id",
propertyId
);

}



const {
data,
error
}=await query;



if(error){

console.log(error);

return;

}



if(data && data.length){


const latest=data[data.length-1];


setStatus(latest.status);


}



}




async function submitClaim(){


if(loading){

return;

}



setLoading(true);



const {
data:{
user
}

}=await supabase.auth.getUser();



if(!user){

Alert.alert(
"Login required",
"Please login before claiming."
);

setLoading(false);

return;

}



const {
data:existing
}=await supabase

.from("claims")

.select("id,status")

.eq("user_id",user.id)

.eq(
businessId ? "business_id":"property_id",
businessId || propertyId
);



if(existing && existing.length){


Alert.alert(
"Already Submitted",
"You already have a claim for this listing."
);


setStatus(existing[0].status);

setLoading(false);

return;

}




const {
error
}=await supabase

.from("claims")

.insert({

user_id:user.id,

business_id:businessId || null,

property_id:propertyId || null,

status:"pending"

});



if(error){

Alert.alert(
"Error",
error.message
);

setLoading(false);

return;

}



setStatus("pending");

setLoading(false);


Alert.alert(
"Success",
"Claim submitted for approval."
);


}




return(

<Pressable

style={styles.button}

onPress={submitClaim}

disabled={loading || status}

>


{

loading ?

<ActivityIndicator color={INK.ink}/>

:

<Text style={styles.text}>

{

status==="pending"

?

"Claim Pending"

:

status==="approved"

?

"Already Claimed"

:

"Claim this listing"

}

</Text>

}


</Pressable>

);

}



const styles=StyleSheet.create({

button:{
backgroundColor:INK.card,
padding:15,
borderRadius:10,
marginTop:20
},

text:{
color:INK.ink,
textAlign:"center",
fontWeight:"bold"
}

});