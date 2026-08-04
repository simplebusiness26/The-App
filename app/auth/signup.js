import React,{useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet,
ScrollView,
Alert,
ActivityIndicator
} from "react-native";

import {router} from "expo-router";

import {supabase} from "../../services/supabase";

export default function Signup(){


const [name,setName]=useState("");

const [email,setEmail]=useState("");

const [phone,setPhone]=useState("");

const [password,setPassword]=useState("");

const [loading,setLoading]=useState(false);



function validEmail(email){

return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}



async function signup(){


if(
!name.trim() ||
!email.trim() ||
!phone.trim() ||
!password
){

Alert.alert(
"Missing information",
"Please complete all fields"
);

return;

}



if(!validEmail(email.trim())){

Alert.alert(
"Invalid email",
"Please enter a valid email address"
);

return;

}



if(password.length < 6){

Alert.alert(
"Password too short",
"Password must be at least 6 characters"
);

return;

}



try{


setLoading(true);



const {
data,
error
}=await supabase.auth.signUp({

email:email.trim(),

password

});



if(error){

throw error;

}



if(data.user && !data.session){

setLoading(false);


Alert.alert(
"Verify email",
"Your account has been created. Please verify your email before logging in."
);


router.replace("/auth/login");

return;

}



const {
error:profileError
}=await supabase

.from("profiles")

.upsert({

id:data.user.id,

full_name:name.trim(),

email:email.trim(),

phone:phone.trim()

},{
onConflict:"id"
});



if(profileError){

throw profileError;

}



setLoading(false);



Alert.alert(
"Account created",
"Welcome to xplorer"
);



router.replace("/");



}

catch(error){


console.log(error);



setLoading(false);



let message="Something went wrong";



if(error.message?.toLowerCase().includes("already")){

message="This email already has an account";

}

else if(error.message?.toLowerCase().includes("invalid email")){

message="Please enter a valid email address";

}

else{

message=error.message;

}



Alert.alert(
"Signup failed",
message
);


}


}



return(

<ScrollView

contentContainerStyle={styles.container}

>


<Text style={styles.title}>
Create Account
</Text>



<TextInput

style={styles.input}

placeholder="Name"

value={name}

onChangeText={setName}

/>



<TextInput

style={styles.input}

placeholder="Email"

autoCapitalize="none"

keyboardType="email-address"

value={email}

onChangeText={setEmail}

/>



<TextInput

style={styles.input}

placeholder="Phone number"

keyboardType="phone-pad"

value={phone}

onChangeText={setPhone}

/>



<TextInput

style={styles.input}

placeholder="Password"

secureTextEntry

value={password}

onChangeText={setPassword}

/>



<Text style={styles.note}>
Everyone starts as an Explorer. If you manage a business, property,
activity club or event, you can switch on a manager account at any time
from Settings -- it is added to this profile rather than replacing it.
</Text>



<Pressable

style={styles.button}

onPress={signup}

disabled={loading}

>

{

loading

?

<View style={styles.loadingContainer}>

<ActivityIndicator color="white"/>

<Text style={styles.buttonText}>
Creating...
</Text>

</View>

:

<Text style={styles.buttonText}>
Create Account
</Text>

}

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
fontWeight:"bold",
marginBottom:30
},

input:{
borderWidth:1,
borderRadius:10,
padding:15,
marginBottom:15
},

note:{
fontSize:14,
lineHeight:20,
color:"#555",
marginTop:5,
marginBottom:5
},

button:{
backgroundColor:"#222",
padding:16,
borderRadius:10,
marginTop:20,
alignItems:"center"
},

buttonText:{
color:"white",
fontWeight:"bold"
},

loadingContainer:{
flexDirection:"row",
alignItems:"center",
gap:10
}

});