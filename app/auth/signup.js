import React,{useState} from "react";

import {View,Text,TextInput,StyleSheet,ScrollView,Alert} from "react-native";

import {router} from "expo-router";

import {supabase} from "../../services/supabase";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Field,
  fieldInputStyle,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

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

  <Screen>
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle eyebrow="XPLORER" title="Create account"/>
      <Text style={styles.lead}>
        Join Xplorer to review places, check in and see your local world come alive.
      </Text>

      {/*
        Four wells cut into the housing, each with the mono label naming what
        goes in it. The old screen was four identical bordered boxes carrying
        only a placeholder, so the label vanished the moment anybody typed --
        the field stopped saying what it was at exactly the point it mattered.
      */}
      <Field label="Name" required>
        <TextInput
          style={fieldInputStyle}
          placeholder="Your name"
          placeholderTextColor={INK.readoutFaint}
          value={name}
          onChangeText={setName}
        />
      </Field>

      <Field label="Email" required>
        <TextInput
          style={fieldInputStyle}
          placeholder="you@example.com"
          placeholderTextColor={INK.readoutFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </Field>

      <Field label="Phone number" required>
        <TextInput
          style={fieldInputStyle}
          placeholder="Phone number"
          placeholderTextColor={INK.readoutFaint}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </Field>

      <Field label="Password" required hint="At least 6 characters.">
        <TextInput
          style={fieldInputStyle}
          placeholder="Choose a password"
          placeholderTextColor={INK.readoutFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </Field>

      <Action
        kind="primary"
        glyph="person"
        label="Create account"
        loading={loading}
        onPress={signup}
      />

      <Action
        kind="quiet"
        label="Already have an account? Log in"
        accessibilityLabel="Already have an account? Log in"
        style={styles.loginLink}
        onPress={()=>router.push("/auth/login")}
      />

      {/*
        BOTH STORES REQUIRE THESE TO BE REACHABLE BEFORE SOMEBODY SIGNS UP, and
        it is the right place for them anyway: this is the moment a person is
        deciding whether to hand anything over. Both are marked as drafts on
        the screen itself -- see utils/legal.js.
      */}
      <SectionRule label="Before you sign up"/>

      <Text style={styles.legalNote}>
        By creating an account you agree to the terms, and to the privacy policy
        below.
      </Text>

      <View style={styles.legalRow}>
        <Action
          kind="secondary"
          glyph="clipboard"
          label="Terms"
          accessibilityLabel="Read the terms"
          style={styles.legalButton}
          onPress={()=>router.push("/legal/terms")}
        />
        <Action
          kind="secondary"
          glyph="lock"
          label="Privacy policy"
          accessibilityLabel="Read the privacy policy"
          style={styles.legalButton}
          onPress={()=>router.push("/legal/privacy")}
        />
      </View>
    </ScrollView>
  </Screen>

);

}

const styles=StyleSheet.create({
  container:{paddingHorizontal:16,paddingBottom:32+CREATE_HUB_CLEARANCE},
  // ScreenTitle's meta line is clamped to one line -- right for a place's
  // "2.4 KM · OPEN NOW", wrong for a sentence, which it silently truncates with
  // an ellipsis. Anything longer than a readout goes here instead.
  lead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:-2,
    marginBottom:14
  },
  loginLink:{marginTop:12},
  legalNote:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    textAlign:"center"
  },
  legalRow:{flexDirection:"row",gap:9,marginTop:12},
  legalButton:{flex:1}
});
