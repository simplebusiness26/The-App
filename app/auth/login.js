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
import {INK} from "../../utils/tokens";

const TEST_PASSWORD="password123";
const TEST_SETUP_TOKEN="P0h11qYVK3Ev_wuTUfQxfLjXxj6rtK4vZf4Evq99xaE";

const TEST_ACCOUNTS={
  m:{label:"Manager",email:"manager@test.com"},
  e:{label:"Explorer",email:"explorer@test.com"},
  events:{label:"Explorer",email:"explorer@test.com"},
  e2:{label:"Explorer 2",email:"explorer2@test.com"}
};

function normaliseAlias(value){
  return value.trim().toLowerCase();
}

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
  const [quickAccount,setQuickAccount]=useState("");

  async function prepareTestAccount(alias){
    const {data,error:setupError}=await supabase.functions.invoke(
      "guestbook-test-account-setup",
      {body:{token:TEST_SETUP_TOKEN,alias}}
    );

    if(setupError) throw new Error(setupError.message || "Test account setup failed");
    if(!data?.ok) throw new Error(data?.error || "Test account setup failed");
  }

  async function signIn(loginEmail,loginPassword,accountLabel="",testAlias=""){
    setError("");
    setLoading(true);
    setQuickAccount(accountLabel);

    try{
      if(testAlias) await prepareTestAccount(testAlias);

      const {error:loginError}=await supabase.auth.signInWithPassword({
        email:loginEmail.trim(),
        password:loginPassword
      });
      if(loginError) throw loginError;

      router.replace(destination);
    }catch(loginError){
      console.log(loginError);
      if(accountLabel){
        setError(`${accountLabel} quick login failed. Please tap the button again.`);
      }else if(loginError.message?.includes("Invalid login")){
        setError("Incorrect email or password");
      }else{
        setError(loginError.message || "Login failed");
      }
    }finally{
      setLoading(false);
      setQuickAccount("");
    }
  }

  async function login(){
    const alias=normaliseAlias(email);
    const testAccount=TEST_ACCOUNTS[alias];

    if(testAccount && !password){
      await signIn(testAccount.email,TEST_PASSWORD,testAccount.label,alias);
      return;
    }

    if(!email || !password){
      setError("Enter your email and password, or use a quick test login.");
      return;
    }

    await signIn(email,password);
  }

  async function quickLogin(alias){
    const account=TEST_ACCOUNTS[alias];
    if(!account || loading) return;

    setEmail(alias);
    setPassword("");
    await signIn(account.email,TEST_PASSWORD,account.label,alias);
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Login</Text>

      {destination!=="/" && (
        <View style={styles.returnNotice}>
          <Text style={styles.returnTitle}>Continue your Xplorer action</Text>
          <Text style={styles.returnText}>After login, you’ll return to the page you opened.</Text>
        </View>
      )}

      <View style={styles.quickPanel}>
        <Text style={styles.quickTitle}>Quick test login</Text>
        <Text style={styles.quickHelp}>Tap an account below. No password typing is needed.</Text>

        <View style={styles.quickRow}>
          <Pressable style={[styles.quickButton,loading && styles.disabledButton]} onPress={()=>quickLogin("m")} disabled={loading}>
            {loading && quickAccount==="Manager" ? <ActivityIndicator color={INK.ink}/> : <><Text style={styles.quickCode}>M</Text><Text style={styles.quickLabel}>Manager</Text></>}
          </Pressable>

          <Pressable style={[styles.quickButton,loading && styles.disabledButton]} onPress={()=>quickLogin("e")} disabled={loading}>
            {loading && quickAccount==="Explorer" ? <ActivityIndicator color={INK.ink}/> : <><Text style={styles.quickCode}>E</Text><Text style={styles.quickLabel}>Explorer</Text></>}
          </Pressable>

          <Pressable style={[styles.quickButton,loading && styles.disabledButton]} onPress={()=>quickLogin("e2")} disabled={loading}>
            {loading && quickAccount==="Explorer 2" ? <ActivityIndicator color={INK.ink}/> : <><Text style={styles.quickCode}>E2</Text><Text style={styles.quickLabel}>Explorer 2</Text></>}
          </Pressable>
        </View>

        <Text style={styles.aliasHelp}>You can also type m, e, events or e2 in the email box and tap Login.</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email or test alias"
        placeholderTextColor={INK.ink}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={INK.ink}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.forgotPassword} onPress={()=>router.push("/auth/forgot-password")} disabled={loading}>
        <Text style={styles.forgotPasswordText}>Forgot password?</Text>
      </Pressable>

      {error!=="" && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button,loading && styles.disabledButton]} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color={INK.ink}/> : <Text style={styles.buttonText}>Login</Text>}
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
  title:{color:INK.ink,fontSize:46,lineHeight:54,fontWeight:"bold",marginBottom:46},
  returnNotice:{backgroundColor:INK.green,borderColor:INK.green,borderWidth:1,borderRadius:14,padding:14,marginTop:-26,marginBottom:18},
  returnTitle:{color:INK.ink,fontWeight:"900",fontSize:15},
  returnText:{color:INK.card,fontSize:12,lineHeight:18,marginTop:3},
  quickPanel:{backgroundColor:INK.blue,borderWidth:1,borderColor:INK.blue,borderRadius:18,padding:18,marginBottom:44},
  quickTitle:{fontSize:25,lineHeight:32,fontWeight:"bold",color:INK.card},
  quickHelp:{color:INK.card,fontSize:17,lineHeight:25,marginTop:7},
  quickRow:{flexDirection:"row",gap:14,marginTop:20},
  quickButton:{flex:1,minHeight:116,backgroundColor:INK.blue,borderRadius:16,alignItems:"center",justifyContent:"center",paddingHorizontal:5},
  quickCode:{color:INK.card,fontSize:34,fontWeight:"bold"},
  quickLabel:{color:INK.card,fontSize:16,marginTop:8,textAlign:"center"},
  aliasHelp:{color:INK.card,fontSize:15,lineHeight:23,marginTop:18},
  input:{color:INK.ink,backgroundColor:INK.paper,borderWidth:1,borderColor:INK.ink,borderRadius:16,paddingHorizontal:22,paddingVertical:20,minHeight:78,fontSize:19,marginBottom:28},
  forgotPassword:{alignSelf:"flex-end",paddingVertical:2,marginTop:-4,marginBottom:34},
  forgotPasswordText:{color:INK.blue,fontSize:19,fontWeight:"bold"},
  button:{backgroundColor:INK.paper,minHeight:78,paddingHorizontal:20,paddingVertical:20,borderRadius:16,alignItems:"center",justifyContent:"center"},
  disabledButton:{opacity:0.55},
  buttonText:{color:INK.ink,textAlign:"center",fontWeight:"bold",fontSize:20},
  error:{color:INK.ink,fontSize:16,marginBottom:20,lineHeight:23},
  signup:{marginTop:28,alignItems:"center",padding:8},
  signupText:{color:INK.ink,fontSize:17}
});
