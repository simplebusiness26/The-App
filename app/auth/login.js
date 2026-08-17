import React,{useState} from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {supabase} from "../../services/supabase";
import {router,useLocalSearchParams} from "expo-router";
import DemoLogins from "../../components/DemoLogins";
import {INK} from "../../utils/tokens";

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
    <ScrollView
      style={styles.screen}
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
        <Text style={styles.title}>Login</Text>
      </DemoLogins>

      {destination!=="/" && (
        <View style={styles.returnNotice}>
          <Text style={styles.returnTitle}>Continue your Xplorer action</Text>
          <Text style={styles.returnText}>After login, you’ll return to the page you opened.</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={INK.inkSoft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={INK.inkSoft}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.forgotPassword} onPress={()=>router.push("/auth/forgot-password")} disabled={loading}>
        <Text style={styles.forgotPasswordText}>Forgot password?</Text>
      </Pressable>

      {error!=="" && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button,styles.buttonShadow,loading && styles.disabledButton]} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color={INK.card}/> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>

      <Pressable style={styles.signup} onPress={()=>router.push("/auth/signup")}>
        <Text style={styles.signupText}>Don’t have an account? Create one</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{flexGrow:1,paddingHorizontal:30,paddingTop:56,paddingBottom:52},
  title:{color:INK.ink,fontSize:46,lineHeight:54,fontWeight:"900",marginBottom:46,letterSpacing:-1},
  // Blue, not green. Green is reserved for exactly one thing in this app -- a
  // manager's reply to a review (docs/design-system.md) -- and this banner is
  // neither a reply nor a review; blue is the ink for "this exists/continues".
  returnNotice:{backgroundColor:INK.blue,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:14,marginTop:-26,marginBottom:18},
  returnTitle:{color:INK.card,fontWeight:"900",fontSize:15},
  returnText:{color:INK.card,fontSize:12,lineHeight:18,marginTop:3},
  input:{color:INK.ink,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:16,paddingHorizontal:22,paddingVertical:20,minHeight:78,fontSize:19,marginBottom:28},
  forgotPassword:{alignSelf:"flex-end",paddingVertical:2,marginTop:-4,marginBottom:34},
  forgotPasswordText:{color:INK.blue,fontSize:19,fontWeight:"800"},
  // Was fill-less: same colour as the screen behind it and no border at all,
  // so the primary action was invisible except by its shape.
  // docs/design-system.md: "every card, chip, pin and button has a 1.5-2px
  // solid ink border" -- not optional, "the borders are the print register".
  button:{backgroundColor:INK.blue,borderWidth:2,borderColor:INK.ink,minHeight:78,paddingHorizontal:20,paddingVertical:20,borderRadius:16,alignItems:"center",justifyContent:"center"},
  // Split from `button` above: a nested shadowOffset object in the same block
  // as backgroundColor defeats scripts/verify-contrast.cjs's single-level
  // brace parser, which then cannot find `button`'s own background and
  // silently checks buttonText against an ancestor instead.
  buttonShadow:{shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0},
  disabledButton:{opacity:0.55},
  buttonText:{color:INK.card,textAlign:"center",fontWeight:"900",fontSize:20},
  error:{color:INK.ink,fontSize:16,marginBottom:20,lineHeight:23,fontWeight:"700"},
  signup:{marginTop:28,alignItems:"center",padding:8},
  signupText:{color:INK.ink,fontSize:17,fontWeight:"600"}
});
