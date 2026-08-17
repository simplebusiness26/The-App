import React,{useEffect,useRef,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {INK} from "../../utils/tokens";

const RECOVERY_STORAGE_KEY="guestbook-password-recovery";
const RECOVERY_MAX_AGE_MS=24*60*60*1000;

function getPendingRecovery(){
  if(Platform.OS!=="web" || typeof window==="undefined") return null;

  try{
    const raw=window.localStorage.getItem(RECOVERY_STORAGE_KEY);
    if(!raw) return null;

    const parsed=JSON.parse(raw);
    const isRecent=Number.isFinite(parsed?.requestedAt)
      && Date.now()-parsed.requestedAt<RECOVERY_MAX_AGE_MS;

    return isRecent && parsed?.email
      ? {email:String(parsed.email).trim().toLowerCase(),requestedAt:parsed.requestedAt}
      : null;
  }catch{
    return null;
  }
}

function clearPendingRecovery(){
  if(Platform.OS!=="web" || typeof window==="undefined") return;

  try{
    window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
  }catch(error){
    console.log("Could not clear password recovery request",error);
  }
}

function readRecoveryUrl(){
  if(Platform.OS!=="web" || typeof window==="undefined"){
    return {hasEvidence:false,errorMessage:""};
  }

  const searchParams=new URLSearchParams(window.location.search || "");
  const hashParams=new URLSearchParams((window.location.hash || "").replace(/^#/,""));
  const errorDescription=searchParams.get("error_description")
    || hashParams.get("error_description")
    || "";

  const type=searchParams.get("type") || hashParams.get("type");
  const hasEvidence=type==="recovery"
    || !!searchParams.get("code")
    || !!searchParams.get("token_hash")
    || !!hashParams.get("access_token")
    || !!hashParams.get("refresh_token");

  return {hasEvidence,errorMessage:errorDescription};
}

export default function UpdatePassword(){
  const [checking,setChecking]=useState(true);
  const [canReset,setCanReset]=useState(false);
  const [recoveryEmail,setRecoveryEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [complete,setComplete]=useState(false);
  const [error,setError]=useState("");
  const resolvedRef=useRef(false);
  const initialRecoveryRef=useRef(readRecoveryUrl());
  const pendingRecoveryRef=useRef(getPendingRecovery());

  useEffect(()=>{
    let mounted=true;

    async function validateSession(session,hasRecoveryProof=false){
      if(!mounted || !session?.user?.email) return false;

      const sessionEmail=session.user.email.trim().toLowerCase();
      const pendingEmail=pendingRecoveryRef.current?.email || "";
      const emailMatches=!pendingEmail || pendingEmail===sessionEmail;
      const validRecovery=hasRecoveryProof || initialRecoveryRef.current.hasEvidence;

      if(!validRecovery || !emailMatches){
        return false;
      }

      resolvedRef.current=true;
      setRecoveryEmail(sessionEmail);
      setCanReset(true);
      setChecking(false);
      setError("");
      return true;
    }

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        validateSession(session,true);
      }
    });

    async function initialiseRecovery(){
      if(initialRecoveryRef.current.errorMessage){
        setChecking(false);
        setError(initialRecoveryRef.current.errorMessage);
        return;
      }

      // Supabase normally processes the recovery tokens automatically. This
      // explicit fallback covers mobile browsers where that initial event can
      // finish before this screen subscribes.
      if(Platform.OS==="web" && typeof window!=="undefined"){
        const searchParams=new URLSearchParams(window.location.search || "");
        const hashParams=new URLSearchParams((window.location.hash || "").replace(/^#/,""));
        const code=searchParams.get("code");
        const accessToken=hashParams.get("access_token");
        const refreshToken=hashParams.get("refresh_token");

        if(code){
          const {error:exchangeError}=await supabase.auth.exchangeCodeForSession(code);
          if(exchangeError){
            console.log("Recovery code exchange failed",exchangeError);
          }
        }else if(accessToken && refreshToken){
          const {error:setSessionError}=await supabase.auth.setSession({
            access_token:accessToken,
            refresh_token:refreshToken
          });
          if(setSessionError){
            console.log("Recovery token session failed",setSessionError);
          }
        }
      }

      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError){
        console.log(sessionError);
      }

      const valid=await validateSession(session,false);
      if(valid || !mounted) return;

      setChecking(false);
      setError(
        "This reset link is invalid, expired, or belongs to a different account. Request a new password-reset email and open the newest link."
      );
    }

    initialiseRecovery();

    const timeout=setTimeout(()=>{
      if(!mounted || resolvedRef.current) return;
      setChecking(false);
      setError(
        "This reset link could not be verified. Request a new password-reset email and open the newest link."
      );
    },10000);

    return()=>{
      mounted=false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  },[]);

  async function savePassword(){
    setError("");

    if(!recoveryEmail){
      setError("The recovery account could not be verified. Request a new reset link.");
      return;
    }

    if(password.length<8){
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if(password!==confirmPassword){
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try{
      const {data:updateData,error:updateError}=await supabase.auth.updateUser({password});
      if(updateError) throw updateError;

      const updatedEmail=updateData?.user?.email?.trim().toLowerCase();
      if(updatedEmail!==recoveryEmail){
        throw new Error("The password update was applied to the wrong account and has been stopped.");
      }

      await supabase.auth.signOut({scope:"local"});

      // Verify the exact new credentials before telling the user the reset worked.
      const {data:verificationData,error:verificationError}=await supabase.auth.signInWithPassword({
        email:recoveryEmail,
        password
      });

      if(verificationError || !verificationData?.user){
        throw new Error(
          verificationError?.message
          || "The password was updated but could not be verified. Please request another reset link."
        );
      }

      await supabase.auth.signOut({scope:"local"});
      clearPendingRecovery();
      setComplete(true);
      setPassword("");
      setConfirmPassword("");
    }catch(updateError){
      console.log(updateError);
      setError(updateError.message || "Your password could not be updated.");
    }finally{
      setLoading(false);
    }
  }

  if(checking){
    return(
      <View style={[styles.screen,styles.center]}>
        <ActivityIndicator size="large" color={INK.ink}/>
        <Text style={styles.checkingText}>Checking your reset link...</Text>
      </View>
    );
  }

  if(complete){
    return(
      <View style={[styles.screen,styles.container]}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Password updated and verified</Text>
          <Text style={styles.message}>
            The new password has been tested successfully for {recoveryEmail}. You can now log in with it.
          </Text>
        </View>

        <Pressable style={[styles.button,styles.buttonShadow]} onPress={()=>router.replace("/auth/login")}>
          <Text style={styles.buttonText}>Return to login</Text>
        </Pressable>
      </View>
    );
  }

  if(!canReset){
    return(
      <View style={[styles.screen,styles.container]}>
        <Text style={styles.title}>Reset link unavailable</Text>
        <Text style={styles.error}>{error}</Text>

        <Pressable style={[styles.button,styles.buttonShadow]} onPress={()=>router.replace("/auth/forgot-password")}>
          <Text style={styles.buttonText}>Request a new link</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <View style={[styles.screen,styles.container]}>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.message}>
        Updating password for {recoveryEmail}. Choose at least 8 characters.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={INK.inkSoft}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        placeholderTextColor={INK.inkSoft}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button,styles.buttonShadow,loading&&styles.disabledButton]}
        onPress={savePassword}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={INK.card}/>
          : <Text style={styles.buttonText}>Update and verify password</Text>
        }
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  container:{padding:30},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  title:{fontSize:32,fontWeight:"900",color:INK.ink,letterSpacing:-0.6,marginBottom:12},
  message:{fontSize:15,lineHeight:22,color:INK.inkSoft,marginBottom:22},
  checkingText:{marginTop:14,color:INK.ink},
  input:{backgroundColor:INK.card,color:INK.ink,borderWidth:2,borderColor:INK.ink,borderRadius:12,padding:15,fontSize:16,marginBottom:15},
  button:{backgroundColor:INK.blue,borderWidth:2,borderColor:INK.ink,padding:16,borderRadius:12,alignItems:"center"},
  // Nested shadowOffset split out -- see app/auth/login.js's note.
  buttonShadow:{shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0},
  disabledButton:{opacity:0.55},
  buttonText:{color:INK.card,fontWeight:"900"},
  error:{color:INK.ink,fontWeight:"700",marginBottom:18,lineHeight:21},
  successCard:{borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card,borderRadius:14,padding:20,marginBottom:18},
  // Blue, not green -- green is reserved for a manager's reply to a review
  // (docs/design-system.md) and this is neither a reply nor a review.
  successIcon:{fontSize:38,fontWeight:"900",color:INK.blue,marginBottom:8}
});