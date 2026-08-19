import * as Location from "expo-location";
import {supabase} from "../services/supabase";

// The one place that answers "may this person do this".
//
// WHY THIS EXISTS
//
// Four unrelated ideas used to answer overlapping questions, and none of them
// was the truth:
//
//   profiles.account_type      -- retired. See below.
//   profiles.is_admin          -- via guestbook_is_admin(), still correct
//   manages_any_listing()      -- "do you already run something", which is NOT
//                                 the same question as "is Manager unlocked"
//   manager_capabilities       -- the actual unlock, added later and never
//                                 wired into the client
//
// Anything asking a permission question now asks it here. Two rules keep it
// that way: no screen re-implements one of these, and no screen reads
// profiles.account_type at all.
//
// WHY "IS THIS PERSON AN EXPLORER" IS NOT A QUESTION
//
// It used to be. Thirty-five places across sixteen files ran some version of
//
//   if(profile?.account_type!=="explorer"){ setError("Only Explorer accounts
//   can check in."); return; }
//
// That test cannot fail any more, and has not been able to since
// 20260803120000_unify_account_model.sql:10 ran
//
//   update public.profiles set account_type = 'explorer'
//     where account_type = 'manager';
//
// and app/auth/signup.js stopped offering the choice. Every account is an
// Explorer. A Manager is an Explorer with tools unlocked, not a second kind of
// person -- CLAUDE.md's account model, and RULES.md's "never a separate role
// table that forks the identity".
//
// Leaving the checks in was not harmless. Each one was a live switch that would
// have hidden a real person the moment any row's account_type drifted, and
// together they were the parallel-user-type model the rules forbid, still
// running. So the question collapses into `signedIn` below, which is what those
// checks were really testing.
//
// NONE OF THIS IS A SECURITY BOUNDARY
//
// Row level security decides what data comes back. These functions decide what
// is worth showing and produce a refusal a person can understand. Every answer
// that matters is computed in the database -- guestbook_is_admin(),
// manages_any_listing() and has_manager_capability() are all SQL, so the client
// cannot talk itself into a true.

// What a screen says when the answer is no. Kept here so the wording is the
// same everywhere and reads as a sentence about a person, per the copy rules in
// docs/design-system.md. Each question gets its own pair of messages rather
// than sharing one "that could not be confirmed", which would tell a person
// nothing about which check failed or what to try next.
export const REFUSALS={
  SIGNED_OUT:"Log in to do this.",
  NOT_ADMIN:"An admin account is required to open this screen.",
  ADMIN_UNKNOWN:"Your admin access could not be confirmed.",
  MANAGES_NOTHING:"This screen is for managing a place, club or event you already manage. Request the tools from the manager dashboard first.",
  MANAGES_UNKNOWN:"Whether you manage anything could not be confirmed. Try again in a moment.",
  CAPABILITY_UNKNOWN:"Whether you have these tools could not be confirmed. Try again in a moment.",
  NO_LOCATION:"Xplorer needs your location to do that. Turn it on for Xplorer in your phone or browser settings."
};

// Every answer below has the same three fields, and the split between the last
// two matters:
//
//   allowed  -- the answer
//   error    -- set ONLY when the question could not be asked (the call failed)
//   refusal  -- what to tell somebody when the answer is simply no
//
// Collapsing error and refusal into one string is a real bug rather than an
// untidiness: a caller showing `error` whenever it is non-empty would tell
// every ordinary Explorer that their manager tools "could not be checked".

// Is anybody signed in, and who. This is also the answer to the question the
// old account_type checks were really asking.
export async function signedIn(){
  const {data,error}=await supabase.auth.getUser();
  if(error || !data?.user) return{user:null,error:"",refusal:REFUSALS.SIGNED_OUT};
  return{user:data.user,error:"",refusal:""};
}

// Administrator. Same helper the RLS policies use, so there is one definition.
export async function isAdministrator(){
  const {data,error}=await supabase.rpc("guestbook_is_admin");
  if(error) return{allowed:false,error:REFUSALS.ADMIN_UNKNOWN,refusal:""};
  return{allowed:data===true,error:"",refusal:data===true ? "" : REFUSALS.NOT_ADMIN};
}

// Do they already run at least one listing. Use this to decide whether a
// management screen has anything to show -- NOT to decide whether Manager is
// unlocked. Somebody who has just been granted the capability and has not
// created anything yet answers false here, and that is correct.
export async function managesAnyListing(){
  const {data,error}=await supabase.rpc("manages_any_listing");
  if(error) return{allowed:false,error:REFUSALS.MANAGES_UNKNOWN,refusal:""};
  return{allowed:data===true,error:"",refusal:data===true ? "" : REFUSALS.MANAGES_NOTHING};
}

// Is a specific capability unlocked right now. This is the "may I create one of
// these" question, and it is the same predicate the insert policies enforce --
// public.has_manager_capability(text), added by
// 20260811120000_gate_business_and_property_creation.sql. Asking it here and
// enforcing it there means the button and the database cannot disagree.
export const CAPABILITIES=["businesses","properties","activity_clubs","events"];

export async function hasManagerCapability(capability){
  if(!CAPABILITIES.includes(capability)){
    throw new Error(`Unknown capability: ${capability}`);
  }

  const {data,error}=await supabase
    .rpc("has_manager_capability",{p_capability:capability});

  if(error) return{allowed:false,error:REFUSALS.CAPABILITY_UNKNOWN,refusal:""};
  return{allowed:data===true,error:"",refusal:""};
}

// ---------------------------------------------------------------------------
// The device's own permission: where you are
// ---------------------------------------------------------------------------
//
// The questions above are about a PERSON'S standing in the product and are all
// answered in the database. This one is answered by the phone or the browser,
// and it is here for the same reason they are: so there is one place that asks,
// one wording when the answer is no, and no screen inventing its own.
//
// It is only ever called from inside an explicit action -- a button somebody
// pressed that says what it does. Never on mount, never on render, never in a
// useEffect that runs because a screen opened. A permission prompt nobody asked
// for is the thing people press "no" to for ever.
//
// It returns a POSITION or a refusal, never an exception. A denied permission,
// a device with the radio off and a fix that never arrives are the same event
// as far as any caller is concerned: there is no position, and here is the
// sentence to show.
//
// Nothing is stored. The coordinate is handed back to the caller and this
// module keeps no copy.
//
// Three older surfaces still ask expo-location directly, each inside its own
// action: components/AddLocation.js (attaching a place to a post),
// components/Directions.js (the origin of a route) and app/checkins/create.js.
// They predate this function and are pinned in place by their own gates --
// scripts/verify-place-follows.cjs names AddLocation as the one asker for
// posts. New callers come here.
export async function askForLocation(){
  try{
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission?.status!=="granted"){
      return{granted:false,position:null,error:"",refusal:REFUSALS.NO_LOCATION};
    }

    const fix=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    const latitude=Number(fix?.coords?.latitude);
    const longitude=Number(fix?.coords?.longitude);

    if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
      return{granted:true,position:null,error:"",refusal:REFUSALS.NO_LOCATION};
    }

    return{granted:true,position:{latitude,longitude},error:"",refusal:""};
  }catch{
    return{granted:false,position:null,error:"",refusal:REFUSALS.NO_LOCATION};
  }
}
