import {Platform} from "react-native";

// Shared by app/auth/forgot-password.js and app/settings.js. Both send the same
// recovery email, and app/auth/update-password.js will only accept a link whose
// session email matches the address stashed here, so the two callers have to
// agree on the storage key and the redirect target exactly.

export const RECOVERY_STORAGE_KEY="guestbook-password-recovery";

export function getResetRedirectUrl(){
  if(Platform.OS!=="web" || typeof window==="undefined"){
    return undefined;
  }

  const configuredUrl=process.env.EXPO_PUBLIC_APP_URL?.trim();
  const baseUrl=configuredUrl || window.location.origin;

  try{
    return new URL("/auth/update-password",baseUrl).toString();
  }catch{
    return `${baseUrl.replace(/\/$/,"")}/auth/update-password`;
  }
}

export function rememberRecoveryRequest(email){
  if(Platform.OS!=="web" || typeof window==="undefined") return;

  try{
    window.localStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({email,requestedAt:Date.now()})
    );
  }catch(error){
    console.log("Could not store password recovery request",error);
  }
}

// A recovery page must never inherit an active session, so every caller signs
// out locally before asking for the email. That is why requesting a reset from
// Settings signs you out -- it is the same requirement, not an oversight.
export async function sendRecoveryEmail(supabase,email){
  const cleanEmail=email.trim();

  await supabase.auth.signOut({scope:"local"});
  rememberRecoveryRequest(cleanEmail);

  const redirectTo=getResetRedirectUrl();
  const {error}=redirectTo
    ? await supabase.auth.resetPasswordForEmail(cleanEmail,{redirectTo})
    : await supabase.auth.resetPasswordForEmail(cleanEmail);

  if(error) throw error;
}
