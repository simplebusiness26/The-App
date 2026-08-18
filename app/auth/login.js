import React,{useState} from "react";
import {ScrollView,TextInput,StyleSheet} from "react-native";
import {supabase} from "../../services/supabase";
import {router,useLocalSearchParams} from "expo-router";
import DemoLogins from "../../components/DemoLogins";
import {INK} from "../../utils/tokens";
import {
  Action,
  Field,
  fieldInputStyle,
  Notice,
  Screen,
  ScreenTitle
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// THE OLD QUICK TEST LOGIN IS GONE, AND IT SHOULD NEVER HAVE SHIPPED.
//
// This file used to hold three things that went into every published build:
// a shared password in plain text, a setup token for an Edge Function that
// could reset it, and the email addresses of three accounts holding real
// content. The screen offered them as buttons to anyone who opened the app.
// The token and the password were both confirmed present in the production web
// bundle, so they were public to anybody who looked. That password has since
// been rotated, so the shipped builds carrying it no longer open anything.
//
// The demo logins are back, because this is still a prototype that has to be
// demonstrated -- but built the way that note said they should be: behind a
// build-time flag, with no credential anywhere in this repository. See
// components/DemoLogins.js and utils/demoLogins.js. The five taps are the
// discretion; the missing environment variable is the security.

function safeDestination(value){
  const destination=Array.isArray(value) ? value[0] : value;
  if(typeof destination!=="string") return "/";
  if(!destination.startsWith("/") || destination.startsWith("//")) return "/";
  return destination;
}

export default function Login(){
  const {next}=useLocalSearchParams();
  const destination=safeDestination(next);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function signIn(loginEmail,loginPassword){
    setError("");
    setLoading(true);

    try{
      const {error:loginError}=await supabase.auth.signInWithPassword({
        email:loginEmail.trim(),
        password:loginPassword
      });
      if(loginError) throw loginError;

      router.replace(destination);
    }catch(loginError){
      console.log(loginError);
      if(loginError.message?.includes("Invalid login")){
        setError("Incorrect email or password");
      }else{
        setError(loginError.message || "Login failed");
      }
    }finally{
      setLoading(false);
    }
  }

  async function login(){
    if(!email || !password){
      setError("Enter your email and password.");
      return;
    }

    await signIn(email,password);
  }

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* The Login heading is also the way into the demo accounts: five taps.
            See components/DemoLogins.js. It is wrapped rather than replaced, so
            the screen looks exactly the same to anybody who is not counting. */}
        <DemoLogins
          disabled={loading}
          onPick={(account)=>{
            setEmail(account.email);
            setPassword(account.password);
            signIn(account.email,account.password);
          }}
        >
          <ScreenTitle eyebrow="XPLORER" title="Login"/>
        </DemoLogins>

        {/*
          Where you were going, kept. It is a fact the app is holding for you, so
          it reads as an instrument notice with a cyan edge -- `exists` is the
          ink for "this is still here" -- rather than a filled banner with light
          text fighting the fill.
        */}
        {destination!=="/" && (
          <Notice tone="exists" label="Continue your Xplorer action">
            After login, you’ll return to the page you opened.
          </Notice>
        )}

        <Field label="Email">
          <TextInput
            style={fieldInputStyle}
            placeholder="you@example.com"
            placeholderTextColor={INK.readoutFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </Field>

        <Field label="Password">
          <TextInput
            style={fieldInputStyle}
            placeholder="Your password"
            placeholderTextColor={INK.readoutFaint}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
        </Field>

        <Action
          kind="quiet"
          label="Forgot password?"
          style={styles.forgot}
          disabled={loading}
          onPress={()=>router.push("/auth/forgot-password")}
        />

        {/* An error is a reading the instrument took, not red text under a box. */}
        {error!=="" && <Notice tone="dispute" label="Not signed in">{error}</Notice>}

        <Action
          kind="primary"
          glyph="key"
          label="Login"
          loading={loading}
          onPress={login}
        />

        <Action
          kind="quiet"
          label="Don’t have an account? Create one"
          style={styles.signup}
          onPress={()=>router.push("/auth/signup")}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  // A smaller sheet than it was: everything that used to be a hand-rolled
  // 78px-tall bordered box is a Field or an Action now, so the only geometry
  // left here is the page gutter and two bits of spacing.
  container:{flexGrow:1,paddingHorizontal:16,paddingBottom:32+CREATE_HUB_CLEARANCE},
  forgot:{alignSelf:"flex-end",marginTop:-6,marginBottom:18,paddingHorizontal:10},
  signup:{marginTop:14}
});
