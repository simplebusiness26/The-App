import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "../../hooks/useColors";

import { useAdminGate } from "../../hooks/useAdminGate";

import { supabase } from "../../services/supabase";



export default function AdminClaimsScreen(){


const {checking,allowed,error:gateError}=useAdminGate();

const [claims,setClaims]=useState([]);

const [loading,setLoading]=useState(true);

const colors=useColors();

const insets=useSafeAreaInsets();




useEffect(()=>{

if(allowed) loadClaims();

},[allowed]);




async function loadClaims(){


setLoading(true);



const {
data,
error
}=await supabase

.from("claims")

.select("*")

.eq("status","pending")

.order("created_at",{ascending:false});



if(error){

Alert.alert(
"Claims error",
error.message
);

setLoading(false);

return;

}



const updatedClaims=[];



for(const claim of data || []){


let listing_name="Unknown listing";



const {
data:profile
}=await supabase

.from("profiles")

.select("full_name,email,phone,account_type")

.eq("id",claim.user_id)

.maybeSingle();




if(claim.business_id){


const {
data:business
}=await supabase

.from("businesses")

.select("name")

.eq("id",claim.business_id)

.maybeSingle();



if(business){

listing_name=business.name;

}


}




if(claim.property_id){


const {
data:property
}=await supabase

.from("properties")

.select("name")

.eq("id",claim.property_id)

.maybeSingle();



if(property){

listing_name=property.name;

}


}




updatedClaims.push({

...claim,

profile:{

full_name:profile?.full_name || "Unknown user",

email:profile?.email || "No email",

phone:profile?.phone || "No phone",

account_type:profile?.account_type || "Unknown"

},

listing_name

});


}



setClaims(updatedClaims);

setLoading(false);


}




async function updateClaim(id,status){


const {
data:claim,
error:claimError
}=await supabase

.from("claims")

.select("*")

.eq("id",id)

.single();



if(claimError || !claim){

Alert.alert(
"Error",
"Claim not found"
);

return;

}




if(status==="approved"){



if(claim.business_id){


const {
data:updatedBusiness,
error:businessError
}=await supabase

.from("businesses")

.update({

owner_id:claim.user_id,

claimed:true

})

.eq("id",claim.business_id)

.select();



if(businessError){

Alert.alert(
"Business update failed",
businessError.message
);

return;

}



if(!updatedBusiness || updatedBusiness.length===0){

Alert.alert(
"Business update failed",
"No business updated"
);

return;

}


}




if(claim.property_id){


const {
data:updatedProperty,
error:propertyError
}=await supabase

.from("properties")

.update({

owner_id:claim.user_id

})

.eq("id",claim.property_id)

.select();



if(propertyError){

Alert.alert(
"Property update failed",
propertyError.message
);

return;

}



if(!updatedProperty || updatedProperty.length===0){

Alert.alert(
"Property update failed",
"No property updated"
);

return;

}


}


}




const {
data:updatedClaim,
error:updateError
}=await supabase

.from("claims")

.update({

status:status

})

.eq("id",id)

.select();



if(updateError){

Alert.alert(
"Claim update failed",
updateError.message
);

return;

}



// RLS refuses a write by matching no rows, not by returning an error, so
// an empty result here means the policy rejected it -- not that it worked.
if(!updatedClaim || updatedClaim.length===0){

Alert.alert(
"Claim update failed",
"This claim was not updated. Admin access is required."
);

return;

}



Alert.alert(
"Success",
`Claim ${status}`
);



loadClaims();


}




if(checking){

return(

<View
style={{
flex:1,
justifyContent:"center",
backgroundColor:colors.background
}}
>

<ActivityIndicator
size="large"
color={colors.primary}
/>

</View>

);

}



if(!allowed){

return(

<View
style={[
styles.empty,
{
flex:1,
justifyContent:"center",
backgroundColor:colors.background
}
]}
>

<Text style={styles.denied}>
{gateError || "An admin account is required to open this screen."}
</Text>

</View>

);

}



return (

<ScrollView

style={{
flex:1,
backgroundColor:colors.background
}}

contentContainerStyle={{
padding:20,
paddingBottom:
(Platform.OS==="web"
?34
:insets.bottom)+24
}}

>


{

loading ?


<ActivityIndicator

style={{
marginTop:40
}}

color={colors.primary}

/>


:


claims.length===0 ?


<View style={styles.empty}>

<Text>
No pending claims
</Text>

</View>



:


claims.map((c)=>(


<View

key={c.id}

style={styles.card}

>


<Text style={styles.title}>

{
c.business_id
?
"🏢 Business Claim"
:
"🏠 Property Claim"
}

</Text>



<Text style={styles.label}>
Listing
</Text>

<Text>
{c.listing_name}
</Text>



<Text style={styles.label}>
Claimed By
</Text>

<Text>
{c.profile.full_name}
</Text>



<Text style={styles.label}>
Email
</Text>

<Text>
{c.profile.email}
</Text>



<Text style={styles.label}>
Phone
</Text>

<Text>
{c.profile.phone}
</Text>



<Text style={styles.label}>
Account Type
</Text>

<Text>
{c.profile.account_type}
</Text>



<Text style={styles.label}>
Note
</Text>

<Text>
{c.note || "No note"}
</Text>



<View style={styles.buttons}>


<Pressable

style={styles.approve}

onPress={()=>updateClaim(c.id,"approved")}

>

<Text style={styles.buttonText}>
Approve
</Text>

</Pressable>



<Pressable

style={styles.reject}

onPress={()=>updateClaim(c.id,"rejected")}

>

<Text style={styles.buttonText}
>
Reject
</Text>

</Pressable>


</View>



</View>


))


}



</ScrollView>

);

}




const styles=StyleSheet.create({

empty:{
padding:40,
alignItems:"center"
},

denied:{
fontSize:16,
textAlign:"center",
color:"#b42318"
},

card:{
padding:18,
borderRadius:14,
borderWidth:1,
marginBottom:15
},

title:{
fontSize:18,
fontWeight:"bold",
marginBottom:15
},

label:{
marginTop:10,
fontSize:12,
color:"#777"
},

buttons:{
flexDirection:"row",
gap:10,
marginTop:20
},

approve:{
flex:1,
backgroundColor:"green",
padding:12,
borderRadius:10
},

reject:{
flex:1,
backgroundColor:"red",
padding:12,
borderRadius:10
},

buttonText:{
color:"white",
textAlign:"center",
fontWeight:"bold"
}

});
