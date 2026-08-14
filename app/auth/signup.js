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
import {INK} from "../../utils/tokens";

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

password,

// The name and phone travel WITH the account, so the database can build the
// profile itself. Without this the on_auth_user_created trigger has an email
// and nothing else, and an account created while email confirmation is on --
// where this screen returns early, below, with no session to insert with --
// would end up with a profile carrying no name at all.
options:{
data:{
full_name:name.trim(),
phone:phone.trim()
}
}

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



<Pressable

style={styles.button}

onPress={signup}

disabled={loading}

>

{

loading

?

<View style={styles.loadingContainer}>

<ActivityIndicator color={INK.ink}/>

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

{/*
  BOTH STORES REQUIRE THESE TO BE REACHABLE BEFORE SOMEBODY SIGNS UP, and
  it is the right place for them anyway: this is the moment a person is
  deciding whether to hand anything over. Both are marked as drafts on
  the screen itself -- see utils/legal.js.
*/}
<Text style={styles.legalNote}>
By creating an account you agree to the terms, and to the privacy policy
below.
</Text>

<View style={styles.legalRow}>
<Pressable
accessibilityRole="button"
accessibilityLabel="Read the terms"
onPress={()=>router.push("/legal/terms")}
>
<Text style={styles.legalLink}>Terms</Text>
</Pressable>
<Pressable
accessibilityRole="button"
accessibilityLabel="Read the privacy policy"
onPress={()=>router.push("/legal/privacy")}
>
<Text style={styles.legalLink}>Privacy policy</Text>
</Pressable>
</View>

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

legalNote:{color:INK.ink,fontSize:13,lineHeight:20,marginTop:26,textAlign:"center"},
legalRow:{flexDirection:"row",justifyContent:"center",gap:22,marginTop:10,paddingBottom:8},
legalLink:{color:INK.blue,fontSize:14,fontWeight:"800",minHeight:44,lineHeight:44},

button:{
backgroundColor:INK.card,
padding:16,
borderRadius:10,
marginTop:20,
alignItems:"center"
},

buttonText:{
color:INK.ink,
fontWeight:"bold"
},

loadingContainer:{
flexDirection:"row",
alignItems:"center",
gap:10
}

});