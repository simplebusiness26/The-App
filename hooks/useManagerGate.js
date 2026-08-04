import {useEffect,useState} from "react";
import {router} from "expo-router";
import {supabase} from "../services/supabase";

// Packet 4: "Check entitlement server-side, not just by hiding the section."
//
// The section is hidden by utils/drawer.js. This is the other half, and the
// half that matters: the answer comes from public.manages_any_listing(), which
// runs in the database as the caller with row level security applied. The
// client cannot talk itself into a true.
//
// Modelled on hooks/useAdminGate.js, and grants nothing for the same reason --
// the listing screens already scope every query by owner. What this stops is a
// person who manages nothing reaching a management screen directly and being
// shown an empty dashboard that looks broken rather than forbidden.
//
// Not used on /manager/dashboard, on purpose. That screen is where an Explorer
// requests the capability to manage something in the first place, so gating it
// on already managing something would close the only door in.
export function useManagerGate(){
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

      const {data,error:rpcError}=await supabase.rpc("manages_any_listing");

      if(!active) return;

      if(rpcError){
        setError("Whether you manage anything could not be confirmed. Try again in a moment.");
      }else if(data!==true){
        setError("This screen is for managing a place, club or event you already manage. Request the tools from the manager dashboard first.");
      }else{
        setAllowed(true);
      }

      setChecking(false);
    }

    check();

    return()=>{active=false;};
  },[]);

  return{checking,allowed,error};
}
