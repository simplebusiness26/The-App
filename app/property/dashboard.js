import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
Pressable
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";

import QRCodeGenerator from "../../components/QRCodeGenerator";
import GateNotice from "../../components/GateNotice";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK} from "../../utils/tokens";


export default function PropertyDashboard(){
  // Packet 4: entitlement is decided by public.manages_any_listing() in the
  // database, not by the drawer having hidden the row that leads here.
  const managerGate=useManagerGate();



const [properties,setProperties]=useState([]);

const [status,setStatus]=useState("Loading...");



useEffect(()=>{

loadDashboard();

},[]);



async function loadDashboard(){


const {
data:{
user
}

}=await supabase.auth.getUser();



if(!user){

setStatus("Please login");

return;

}



// Get approved property claims

const {
data:claims,
error:claimError

}=await supabase

.from("claims")

.select("property_id")

.eq("user_id",user.id)

.eq("status","approved");



if(claimError){

console.log(claimError);

setStatus("Error loading claims");

return;

}



if(!claims || claims.length===0){

setStatus("No property listings yet");

return;

}



const ids=claims.map(item=>item.property_id);



const {
data,
error

}=await supabase

.from("properties")

.select("*")

.in("id",ids);



if(error){

console.log(error);

setStatus("Error loading properties");

return;

}



setProperties(data || []);



if(data.length){

setStatus("Your Properties");

}


}



  if(!managerGate.allowed){
    return <GateNotice checking={managerGate.checking} message={managerGate.error}/>;
  }

return(

<View style={styles.container}>


<Text style={styles.title}>
Property Dashboard
</Text>



<Text>
Status: {status}
</Text>



{properties.map(property=>(


<View

key={property.id}

style={styles.card}

>


<Text style={styles.name}>
{property.name}
</Text>


<Text>
Host: {property.host}
</Text>



<Text style={styles.heading}>
Guest Review QR Code
</Text>



<QRCodeGenerator

propertyId={property.id}

/>



<Pressable

style={styles.button}

onPress={()=>router.push(`/property/${property.id}`)}

>

<Text style={styles.buttonText}>
View Public Profile
</Text>

</Pressable>



<Pressable

style={styles.button}

onPress={()=>router.push("/property/reviews")}

>

<Text style={styles.buttonText}>
Manage Reviews
</Text>

</Pressable>



<Pressable

style={styles.button}

onPress={()=>router.push(`/property/edit/${property.id}`)}

>

<Text style={styles.buttonText}>
Edit Property
</Text>

</Pressable>



</View>


))}



<Pressable

style={styles.addButton}

onPress={()=>router.push("/property/add")}

>

<Text style={styles.addButtonText}>
➕ Add Property Listing
</Text>

</Pressable>



</View>

);

}



const styles=StyleSheet.create({

container:{
padding:30
},

title:{
fontSize:30,
fontWeight:"bold"
},

card:{
borderWidth:1,
borderRadius:10,
padding:15,
marginTop:20
},

name:{
fontSize:25,
fontWeight:"bold",
marginTop:10
},

heading:{
fontSize:20,
fontWeight:"bold",
marginTop:20,
marginBottom:15
},

button:{
backgroundColor:INK.card,
padding:15,
borderRadius:10,
marginTop:15
},

addButton:{
backgroundColor:INK.blue,
padding:15,
borderRadius:10,
marginTop:25
},

addButtonText:{
color:INK.card,
textAlign:"center",
fontWeight:"bold"
},
buttonText:{
color:INK.ink,
textAlign:"center",
fontWeight:"bold"
}

});