import {Platform} from "react-native";
import {supabase} from "../services/supabase";
import {PUSH_CATEGORY_KEYS} from "./pushCategories";

// Registering a device, and remembering what somebody agreed to.
//
// NOTHING HERE HAPPENS ON ITS OWN.
//
// The permission is asked for when somebody turns a switch on in Settings, and
// never on launch. A push permission prompt on first open, before anybody knows
// what the app is, is how an app gets its notifications turned off for ever --
// and RULES.md is explicit that opt-in is never the fallback branch.
//
// The token is registered only once there is something to send. Registering a
// device for somebody with every category off would be collecting a way to
// light up their phone that we have no reason to use.

// expo-notifications is not available on web, and asking would throw.
export function pushIsSupported(){
  return Platform.OS==="ios" || Platform.OS==="android";
}

function notifications(){
  // Required lazily so a web bundle never pulls in a native-only module, and so
  // the tests can mock it without the import running first.
  // eslint-disable-next-line global-require
  return require("expo-notifications");
}

// The blank slate: every category off, master switch off. Used when nobody has
// a row yet, which is the same thing the database defaults say.
export function noPushes(){
  const off={enabled:false};
  for(const key of PUSH_CATEGORY_KEYS) off[key]=false;
  return off;
}

export async function loadPushPreferences(userId){
  if(!userId) return noPushes();

  const {data,error}=await supabase
    .from("push_preferences")
    .select("*")
    .eq("user_id",userId)
    .maybeSingle();

  // A missing row means everything is off. So does an error -- guessing "on"
  // because a read failed would be the app turning notifications on for
  // somebody who never asked.
  if(error || !data) return noPushes();
  return data;
}

export async function savePushPreferences(userId,preferences){
  if(!userId) return {error:"Not signed in."};

  const row={user_id:userId,updated_at:new Date().toISOString(),enabled:!!preferences.enabled};
  for(const key of PUSH_CATEGORY_KEYS) row[key]=!!preferences[key];

  const {error}=await supabase.from("push_preferences").upsert(row,{onConflict:"user_id"});
  return {error:error ? error.message : null};
}

// Ask, and register the device if the answer is yes.
//
// Returns {granted, error}. A refusal is not an error and is not retried: it is
// an answer, and the switch goes back to off so the screen tells the truth
// about what will happen.
export async function enablePushOnThisDevice(userId){
  if(!pushIsSupported()) return {granted:false,error:"Push notifications only work on a phone."};
  if(!userId) return {granted:false,error:"Not signed in."};

  try{
    const Notifications=notifications();

    const existing=await Notifications.getPermissionsAsync();
    let status=existing?.status;

    if(status!=="granted"){
      const asked=await Notifications.requestPermissionsAsync();
      status=asked?.status;
    }

    if(status!=="granted") return {granted:false,error:""};

    const token=await Notifications.getExpoPushTokenAsync();
    const value=token?.data;
    if(!value) return {granted:false,error:"This device did not return a push token."};

    const {error}=await supabase.from("push_tokens").upsert({
      user_id:userId,
      token:value,
      platform:Platform.OS,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id,token"});

    if(error) return {granted:false,error:error.message};
    return {granted:true,error:""};
  }catch(problem){
    return {granted:false,error:problem?.message || "Push notifications could not be set up."};
  }
}

// Signing out takes the device off the list.
//
// Not doing this is how somebody's old phone -- or a shared one -- keeps
// buzzing with somebody else's messages after they have signed out of it.
export async function forgetThisDevice(userId){
  if(!pushIsSupported() || !userId) return;

  try{
    const token=await notifications().getExpoPushTokenAsync();
    const value=token?.data;
    if(!value) return;

    await supabase.from("push_tokens").delete().eq("user_id",userId).eq("token",value);
  }catch{
    // A device that cannot report its own token cannot be un-registered from
    // here, and failing a sign-out over it would be worse than the stale row.
  }
}
