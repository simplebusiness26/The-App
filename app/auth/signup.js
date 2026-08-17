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

style={styles.screen}

contentContainerStyle={styles.container}

>


<Text style={styles.title}>
Create Account
</Text>

<Text style={styles.subtitle}>
Join Xplorer to review places, check in and see your local world come alive.
</Text>



<TextInput

style={styles.input}

placeholder="Name"

placeholderTextColor={INK.inkSoft}

value={name}

onChangeText={setName}

/>



<TextInput

style={styles.input}

placeholder="Email"

placeholderTextColor={INK.inkSoft}

autoCapitalize="none"

keyboardType="email-address"

value={email}

onChangeText={setEmail}

/>



<TextInput

style={styles.input}

placeholder="Phone number"

placeholderTextColor={INK.inkSoft}

keyboardType="phone-pad"

value={phone}

onChangeText={setPhone}

/>



<TextInput

style={styles.input}

placeholder="Password"

placeholderTextColor={INK.inkSoft}

secureTextEntry

value={password}

onChangeText={setPassword}

/>



<Pressable

style={[styles.button,styles.buttonShadow,loading && styles.disabled]}

onPress={signup}

disabled={loading}

>

{

loading

?

<View style={styles.loadingContainer}>

<ActivityIndicator color={INK.card}/>

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

<Pressable
style={styles.loginLink}
accessibilityRole="button"
accessibilityLabel="Already have an account? Log in"
onPress={()=>router.push("/auth/login")}
>
<Text style={styles.loginLinkText}>Already have an account? Log in</Text>
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

screen:{
flex:1,
backgroundColor:INK.paper
},

container:{
padding:30,
paddingBottom:50
},

title:{
fontSize:34,
fontWeight:"900",
color:INK.ink,
letterSpacing:-1,
marginBottom:8
},

subtitle:{
fontSize:14,
color:INK.inkSoft,
lineHeight:20,
marginBottom:26
},

input:{
backgroundColor:INK.card,
color:INK.ink,
borderColor:INK.ink,
borderWidth:2,
borderRadius:12,
padding:15,
fontSize:16,
marginBottom:15
},

legalNote:{color:INK.inkSoft,fontSize:13,lineHeight:20,marginTop:26,textAlign:"center"},
legalRow:{flexDirection:"row",justifyContent:"center",gap:22,marginTop:10,paddingBottom:8},
legalLink:{color:INK.blue,fontSize:14,fontWeight:"800",minHeight:44,lineHeight:44},

button:{
backgroundColor:INK.blue,
borderColor:INK.ink,
borderWidth:2,
padding:16,
borderRadius:12,
marginTop:8,
alignItems:"center"
},

// Nested shadowOffset stays out of `button` itself -- see the identical note
// in app/auth/login.js, which is where this pattern was first worked out.
buttonShadow:{shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0},

disabled:{opacity:0.55},

buttonText:{
color:INK.card,
fontWeight:"900",
fontSize:16
},

loginLink:{marginTop:18,alignItems:"center",padding:8},
loginLinkText:{color:INK.ink,fontSize:14,fontWeight:"600"},

loadingContainer:{
flexDirection:"row",
alignItems:"center",
gap:10
}

});