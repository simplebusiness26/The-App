import React,{useEffect,useState} from "react";
import {Alert,StyleSheet} from "react-native";
import {supabase} from "../services/supabase";
import {Action} from "./instrument";

// "This is mine" — the one control that turns an unclaimed pin into a managed
// place.
//
// RULES.md keeps claim and verified apart on purpose: claiming is the ASSERTION
// that you manage something, and it is not the same act as an on-site QR scan
// confirming it. So this button only ever reports which of the three states the
// claim is in, and never says "verified".
//
// It is one Action. The old version hand-rolled a Pressable with its own card
// background and centred bold text, which is how a button ends up looking like
// a card on one screen and a button on the next.

export default function ClaimButton({businessId,propertyId}){
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState(null);

  useEffect(()=>{
    checkClaim();
  },[]);

  async function checkClaim(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user) return;

    let query=supabase
      .from("claims")
      .select("status")
      .eq("user_id",user.id);

    if(businessId) query=query.eq("business_id",businessId);
    if(propertyId) query=query.eq("property_id",propertyId);

    const {data,error}=await query;

    if(error){
      console.log(error);
      return;
    }

    if(data && data.length){
      const latest=data[data.length-1];
      setStatus(latest.status);
    }
  }

  async function submitClaim(){
    if(loading) return;

    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      Alert.alert("Login required","Please login before claiming.");
      setLoading(false);
      return;
    }

    const {data:existing}=await supabase
      .from("claims")
      .select("id,status")
      .eq("user_id",user.id)
      .eq(businessId ? "business_id" : "property_id",businessId || propertyId);

    if(existing && existing.length){
      Alert.alert("Already Submitted","You already have a claim for this listing.");
      setStatus(existing[0].status);
      setLoading(false);
      return;
    }

    const {error}=await supabase
      .from("claims")
      .insert({
        user_id:user.id,
        business_id:businessId || null,
        property_id:propertyId || null,
        status:"pending"
      });

    if(error){
      Alert.alert("Error",error.message);
      setLoading(false);
      return;
    }

    setStatus("pending");
    setLoading(false);

    Alert.alert("Success","Claim submitted for approval.");
  }

  const label=status==="pending"
    ? "Claim Pending"
    : status==="approved"
      ? "Already Claimed"
      : "Claim this listing";

  return(
    <Action
      // Only an unclaimed listing gets the lit control. Once a claim is in,
      // the button is a readout of where it got to.
      kind={status ? "secondary" : "primary"}
      glyph={status ? "clipboard" : "key"}
      label={label}
      loading={loading}
      disabled={!!status}
      onPress={submitClaim}
      style={styles.button}
    />
  );
}

const styles=StyleSheet.create({button:{marginTop:20}});
