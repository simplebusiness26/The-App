import React,{useEffect,useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";


export default function EditBusiness(){


const [business,setBusiness]=useState(null);

const [name,setName]=useState("");
const [description,setDescription]=useState("");
const [phone,setPhone]=useState("");
const [website,setWebsite]=useState("");



useEffect(()=>{

loadBusiness();

},[]);



async function loadBusiness(){


const {
data:{
user
}
}=await supabase.auth.getUser();



// Without this the next line read user.id on null and threw, so a
// signed-out visitor to /business/edit got a crashed screen rather than
// a login prompt. Caught by the Packet 0 mount tests.
if(!user){

router.replace("/auth/login");

return;

}



const {data:claim}=await supabase

.from("claims")

.select("*")

.eq("user_id",user.id)

.eq("status","approved")

.single();



if(!claim){

return;

}



const {data}=await supabase

.from("businesses")

.select("*")

.eq("id",claim.business_id)

.single();



setBusiness(data);

setName(data.name || "");
setDescription(data.description || "");
setPhone(data.phone || "");
setWebsite(data.website || "");


}



async function save(){


await supabase

.from("businesses")

.update({

name,
description,
phone,
website

})

.eq("id",business.id);



router.back();


}



return(

<View style={styles.container}>


<Text style={styles.title}>
Edit Business
</Text>



<TextInput

style={styles.input}

value={name}

onChangeText={setName}

placeholder="Business name"

/>



<TextInput

style={styles.input}

value={description}

onChangeText={setDescription}

placeholder="Description"

/>



<TextInput

style={styles.input}

value={phone}

onChangeText={setPhone}

placeholder="Phone"

/>



<TextInput

style={styles.input}

value={website}

onChangeText={setWebsite}

placeholder="Website"

/>



<Pressable

style={styles.button}

onPress={save}

>

<Text style={styles.text}>
Save Changes
</Text>

</Pressable>



</View>

);

}



const styles=StyleSheet.create({

container:{
padding:20
},

title:{
fontSize:30,
fontWeight:"bold",
marginBottom:20
},

input:{
borderWidth:1,
padding:15,
marginBottom:15,
borderRadius:10
},

button:{
backgroundColor:"#222",
padding:15,
borderRadius:10
},

text:{
color:"white",
textAlign:"center"
}

});