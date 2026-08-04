import React,{useState,useCallback} from "react";

import {
View,
Text,
StyleSheet,
Pressable,
ScrollView
} from "react-native";

import {supabase} from "../../services/supabase";
import {classificationLabel} from "../../utils/taxonomy";

import {router} from "expo-router";

import {useFocusEffect} from "expo-router";

import QRCodeGenerator from "../../components/QRCodeGenerator";



export default function BusinessDashboard(){


const [businesses,setBusinesses]=useState([]);

const [status,setStatus]=useState("Loading...");



useFocusEffect(

useCallback(()=>{

loadDashboard();

},[])

);



async function loadDashboard(){


setStatus("Loading...");


const {
data:{
user
}

}=await supabase.auth.getUser();



if(!user){

setStatus("Please login");

return;

}



const {
data,
error

}=await supabase

.from("businesses")

.select("*")

.eq("owner_id",user.id);



if(error){

console.log(error);

setStatus("Error loading businesses");

return;

}



setBusinesses(data || []);



if(data.length){

setStatus("Your Businesses");

}else{

setStatus("No business listings yet");

}


}




return(

<ScrollView

style={styles.container}

contentContainerStyle={{
paddingBottom:40
}}

>


<Text style={styles.title}>
Business Dashboard
</Text>


<Text>
{status}
</Text>



{
businesses.map((business)=>(


<View

key={business.id}

style={styles.card}

>


<Text style={styles.name}>
{business.name}
</Text>


<Text>
{classificationLabel(business)}
</Text>


<Text style={styles.heading}>
Customer QR Code
</Text>



<QRCodeGenerator

businessId={business.id}

/>



<Pressable

style={styles.button}

onPress={()=>router.push(`/business/${business.id}`)}

>

<Text style={styles.buttonText}>
View Public Profile
</Text>

</Pressable>



<Pressable

style={styles.button}

onPress={()=>router.push(`/business/edit/${business.id}`)}

>

<Text style={styles.buttonText}>
Edit Business
</Text>

</Pressable>



</View>


))

}



<Pressable

style={styles.addButton}

onPress={()=>router.push("/business/add")}

>


<Text style={styles.buttonText}>
➕ Add Business Listing
</Text>


</Pressable>



</ScrollView>

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
fontWeight:"bold"
},


heading:{
fontSize:18,
fontWeight:"bold",
marginTop:15
},


button:{
backgroundColor:"#222",
padding:15,
borderRadius:10,
marginTop:15
},


addButton:{
backgroundColor:"#0066ff",
padding:15,
borderRadius:10,
marginTop:25
},


buttonText:{
color:"white",
textAlign:"center",
fontWeight:"bold"
}

});