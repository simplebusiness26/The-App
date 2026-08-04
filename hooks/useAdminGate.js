import {useEffect,useState} from "react";
import {router} from "expo-router";
import {supabase} from "../services/supabase";

// Client-side admin gate for the screens that approve or reject ownership
// claims. The database is the real control -- the "Admins can update claims"
// policy tests profiles.is_admin, and RLS is armed -- so this does not grant
// anything. It stops a non-admin who reaches the route directly from being
// shown a working Approve/Reject form whose buttons would silently change
// nothing.
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

      const {data:profile,error:profileError}=await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id",user.id)
        .maybeSingle();

      if(!active) return;

      if(profileError) setError("Your admin access could not be confirmed.");
      else if(!profile?.is_admin) setError("An admin account is required to open this screen.");
      else setAllowed(true);

      setChecking(false);
    }

    check();

    return()=>{active=false;};
  },[]);

  return{checking,allowed,error};
}
