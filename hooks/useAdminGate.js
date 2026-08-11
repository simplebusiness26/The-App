import {useEffect,useState} from "react";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {isAdministrator} from "../utils/permissions";

// Client-side gate for every /admin screen. The database is the real control:
// this calls the same guestbook_is_admin() helper used by RLS instead of
// implementing a second definition of administrator access in the client.
// The screen gate provides a useful refusal; the policies protect the data.
export function useAdminGate(){
  const [checking,setChecking]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;

    async function check(){
      const {data:{user}}=await supabase.auth.getUser();

      if(!user){
        router.replace("/auth/login");
        return;
      }

      const {allowed:isAdmin,error:adminError,refusal}=await isAdministrator();

      if(!active) return;

      if(adminError) setError(adminError);
      else if(!isAdmin) setError(refusal);
      else setAllowed(true);

      setChecking(false);
    }

    check();

    return()=>{active=false;};
  },[]);

  return{checking,allowed,error};
}
