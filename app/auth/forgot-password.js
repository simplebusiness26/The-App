import React,{useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {sendRecoveryEmail} from "../../utils/passwordRecovery";
import {INK} from "../../utils/tokens";

export default function ForgotPassword(){
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");

  async function sendResetEmail(){
    const cleanEmail=email.trim().toLowerCase();

    if(!cleanEmail || !cleanEmail.includes("@")){
      setError("Enter the email address connected to your account.");
      return;
    }

    setLoading(true);
    setError("");

    try{
      await sendRecoveryEmail(supabase,cleanEmail);
      setSent(true);
    }catch(resetError){
      console.log(resetError);
      setError(resetError.message || "The reset email could not be sent.");
    }finally{
      setLoading(false);
    }
  }

  if(sent){
    return(
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✉️</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.message}>
            If an account exists for {email.trim()}, a password-reset link has been sent. Open the newest link on this device to choose a new password.
          </Text>
        </View>

        <Pressable style={styles.button} onPress={()=>setSent(false)}>
          <Text style={styles.buttonText}>Send another email</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={()=>router.replace("/auth/login")}>
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password?</Text>
      <Text style={styles.message}>
        Enter the email address connected to your Xplorer account. We’ll send you a secure link to set a new password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button,loading&&styles.disabledButton]}
        onPress={sendResetEmail}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={INK.ink}/>
          : <Text style={styles.buttonText}>Send reset link</Text>
        }
      </Pressable>

      <Pressable style={styles.linkButton} onPress={()=>router.replace("/auth/login")}>
        <Text style={styles.linkText}>Back to login</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{padding:30},
  title:{fontSize:32,fontWeight:"bold",marginBottom:12},
  message:{fontSize:16,lineHeight:23,color:INK.ink,marginBottom:22},
  input:{borderWidth:1,borderColor:INK.ink,borderRadius:10,padding:15,marginBottom:15},
  button:{backgroundColor:INK.blue,padding:16,borderRadius:10,alignItems:"center"},
  disabledButton:{opacity:0.55},
  buttonText:{color:INK.card,fontWeight:"bold"},
  linkButton:{marginTop:20,alignItems:"center",padding:8},
  linkText:{fontWeight:"bold",color:INK.blue},
  error:{color:INK.red,marginBottom:15,lineHeight:20},
  successCard:{borderWidth:1,borderColor:INK.ink,backgroundColor:INK.card,borderRadius:14,padding:20,marginBottom:18},
  successIcon:{fontSize:34,marginBottom:10}
});