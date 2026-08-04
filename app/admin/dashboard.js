import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
ActivityIndicator,
Alert
} from "react-native";

import {useAdminGate} from "../../hooks/useAdminGate";

import {supabase} from "../../services/supabase";


export default function AdminDashboard(){


const {checking,allowed,error:gateError}=useAdminGate();

const [claims,setClaims]=useState([]);

const [loading,setLoading]=useState(true);



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

.select(`
*,
profiles:user_id(
full_name,
email,
account_type
)
`)

.eq(
"status",
"pending"
)

.order(
"created_at",
{
ascending:false
}
);



if(error){

console.log(error);

Alert.alert(
"Error",
error.message
);

setLoading(false);

return;

}



setClaims(data || []);

setLoading(false);


}




async function updateClaim(id,status){


const {
data:updated,
error
}=await supabase

.from("claims")

.update({
status
})

.eq(
"id",
id
)

.select();



if(error){

Alert.alert(
"Error",
error.message
);

return;

}



// RLS refuses a write by matching no rows, not by returning an error, so
// an empty result here means the policy rejected it -- not that it worked.
if(!updated || updated.length===0){

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

<View style={styles.loading}>

<ActivityIndicator size="large"/>

</View>

);

}



if(!allowed){

return(

<View style={styles.loading}>

<Text style={styles.denied}>
{gateError || "An admin account is required to open this screen."}
</Text>

</View>

);

}



if(loading){

return(

<View style={styles.loading}>

<ActivityIndicator size="large"/>

</View>

);

}



return(

<ScrollView style={styles.container}>


<Text style={styles.title}>
Admin Dashboard
</Text>



<Text>
Pending Claims: {claims.length}
</Text>



{
claims.map(claim=>(


<View

key={claim.id}

style={styles.card}

>


<Text style={styles.name}>
{claim.profiles?.full_name || "Unknown User"}
</Text>


<Text>
Account:
{claim.profiles?.account_type}
</Text>



<Text>
Listing:
{
claim.business_id
?
"Business"
:
"Property"
}
</Text>


<Text>
Claim ID:
{claim.id}
</Text>



<View style={styles.row}>


<Pressable

style={styles.approve}

onPress={()=>updateClaim(
claim.id,
"approved"
)}

>

<Text style={styles.buttonText}>
Approve
</Text>

</Pressable>



<Pressable

style={styles.reject}

onPress={()=>updateClaim(
claim.id,
"rejected"
)}

>

<Text style={styles.buttonText}>
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

loading:{
flex:1,
justifyContent:"center",
alignItems:"center",
padding:40
},

denied:{
fontSize:16,
textAlign:"center",
color:"#b42318"
},

container:{
padding:20
},

title:{
fontSize:32,
fontWeight:"bold",
marginBottom:20
},

card:{
borderWidth:1,
borderRadius:10,
padding:15,
marginTop:15
},

name:{
fontSize:20,
fontWeight:"bold"
},

row:{
flexDirection:"row",
gap:10,
marginTop:15
},

approve:{
backgroundColor:"green",
padding:12,
borderRadius:8,
flex:1
},

reject:{
backgroundColor:"red",
padding:12,
borderRadius:8,
flex:1
},

buttonText:{
color:"white",
textAlign:"center"
}

});