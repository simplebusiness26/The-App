import React, {useEffect, useState} from "react";
import {
View,
Text,
StyleSheet,
Pressable
} from "react-native";

import {useLocalSearchParams, router} from "expo-router";
import {supabase} from "../../services/supabase";


export default function GuestPage(){

const {id}=useLocalSearchParams();

const [property,setProperty]=useState(null);



useEffect(()=>{

loadProperty();

},[]);



async function loadProperty(){

const {data,error}=await supabase

.from("properties")

.select("*")

.eq("id",id)

.single();


if(error){

console.log(error);

return;

}


setProperty(data);

}



if(!property){

return <Text>Loading...</Text>;

}



return(

<View style={styles.container}>


<Text style={styles.title}>
Welcome 👋
</Text>


<Text style={styles.name}>
{property.name}
</Text>


<Text>
Your local Xplorer
</Text>



<Pressable

style={styles.button}

onPress={()=>
router.push(`/property/${id}`)
}

>

<Text style={styles.text}>
🏠 View Property
</Text>

</Pressable>



<Pressable

style={styles.button}

onPress={()=>
router.push(`/property/review/${id}`)
}

>

<Text style={styles.text}>
⭐ Leave Review
</Text>

</Pressable>



<Pressable

style={styles.button}

onPress={()=>
router.push("/map")
}

>

<Text style={styles.text}>
📍 Explore Local Area
</Text>

</Pressable>



</View>

);

}



const styles=StyleSheet.create({

container:{
padding:30,
alignItems:"center"
},

title:{
fontSize:35,
fontWeight:"bold"
},

name:{
fontSize:25,
marginVertical:20
},

button:{
backgroundColor:"#222",
padding:15,
borderRadius:10,
width:"100%",
marginTop:15
},

text:{
color:"white",
textAlign:"center"
}

});