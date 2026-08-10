import React,{useCallback,useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFeedback} from "../../context/FeedbackContext";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {INK} from "../../utils/tokens";

const CLAIM_COLUMNS="id,user_id,business_id,property_id,note,created_at,status";
const CAPABILITY_REQUEST_COLUMNS="id,user_id,capability,status,request_note,requested_at";
const PROFILE_COLUMNS="id,full_name,email,phone";
const CAPABILITY_LABELS={
  businesses:"Businesses",
  properties:"Properties",
  activity_clubs:"Activity clubs",
  events:"Events"
};

function unique(values){
  return [...new Set(values.filter(Boolean))];
}

function rowsById(rows){
  return new Map((rows || []).map((row)=>[row.id,row]));
}

function formatSubmitted(value){
  if(!value) return "Submission time unavailable";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Submission time unavailable";

  return `Submitted ${date.toLocaleDateString(undefined,{
    day:"numeric",
    month:"short",
    year:"numeric"
  })}`;
}

function profileSummary(profile){
  return{
    fullName:profile?.full_name || "Unknown Explorer",
    email:profile?.email || "No email recorded",
    phone:profile?.phone || "No phone recorded"
  };
}

function decisionKey(kind,id){
  return `${kind}:${id}`;
}

// Admin Dashboard Stage 4: listing claims and Manager capability requests.
// Reads are batched across both queues. Each decision uses its database RPC so
// the capability/listing change, request state and audit record commit as one
// PostgreSQL transaction.
export default function AdminClaimsScreen(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const {showFeedback}=useFeedback();
  const [claims,setClaims]=useState([]);
  const [capabilityRequests,setCapabilityRequests]=useState([]);
  const [reasons,setReasons]=useState({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [workingId,setWorkingId]=useState(null);

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setClaims([]);
    setCapabilityRequests([]);

    try{
      const [claimsResult,capabilityResult]=await Promise.all([
        supabase
          .from("claims")
          .select(CLAIM_COLUMNS)
          .eq("status","pending")
          .order("created_at",{ascending:false}),
        supabase
          .from("manager_capability_requests")
          .select(CAPABILITY_REQUEST_COLUMNS)
          .eq("status","pending")
          .order("requested_at",{ascending:false})
      ]);

      if(
        claimsResult.error
        || capabilityResult.error
        || !Array.isArray(claimsResult.data)
        || !Array.isArray(capabilityResult.data)
      ){
        throw new Error(
          claimsResult.error?.message
          || capabilityResult.error?.message
          || "Pending access requests were not returned."
        );
      }

      const claimRows=claimsResult.data;
      const capabilityRows=capabilityResult.data;
      const profileIds=unique([
        ...claimRows.map((claim)=>claim.user_id),
        ...capabilityRows.map((request)=>request.user_id)
      ]);
      const businessIds=unique(claimRows.map((claim)=>claim.business_id));
      const propertyIds=unique(claimRows.map((claim)=>claim.property_id));

      const [profilesResult,businessesResult,propertiesResult]=await Promise.all([
        profileIds.length
          ? supabase.from("profiles").select(PROFILE_COLUMNS).in("id",profileIds)
          : Promise.resolve({data:[],error:null}),
        businessIds.length
          ? supabase.from("businesses").select("id,name").in("id",businessIds)
          : Promise.resolve({data:[],error:null}),
        propertyIds.length
          ? supabase.from("properties").select("id,name").in("id",propertyIds)
          : Promise.resolve({data:[],error:null})
      ]);

      const related=[profilesResult,businessesResult,propertiesResult];
      if(related.some((result)=>result.error || !Array.isArray(result.data))){
        const relatedError=related.find((result)=>result.error)?.error;
        throw new Error(relatedError?.message || "Access-request details were not returned.");
      }

      const profiles=rowsById(profilesResult.data);
      const businesses=rowsById(businessesResult.data);
      const properties=rowsById(propertiesResult.data);

      setClaims(claimRows.map((claim)=>{
        const profile=profiles.get(claim.user_id);
        const listing=claim.business_id
          ? businesses.get(claim.business_id)
          : properties.get(claim.property_id);

        return{
          ...claim,
          listingType:claim.business_id ? "Business" : "Property",
          listingName:listing?.name || "Listing unavailable",
          profile:profileSummary(profile)
        };
      }));

      setCapabilityRequests(capabilityRows.map((request)=>({
        ...request,
        capabilityLabel:CAPABILITY_LABELS[request.capability] || "Unknown capability",
        profile:profileSummary(profiles.get(request.user_id))
      })));
    }catch(loadError){
      setError(loadError?.message || "Pending access requests could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  function updateReason(key,value){
    setReasons((current)=>({...current,[key]:value}));
  }

  async function decideClaim(claim,decision,reason){
    const key=decisionKey("claim",claim.id);
    setWorkingId(key);

    try{
      const {data,error:decisionError}=await supabase.rpc("admin_decide_claim",{
        p_claim_id:claim.id,
        p_decision:decision,
        p_reason:reason
      });

      if(decisionError) throw decisionError;
      if(!data || data.claim_id!==claim.id || data.decision!==decision){
        throw new Error("The database did not confirm the claim decision.");
      }

      setReasons((current)=>{
        const next={...current};
        delete next[key];
        return next;
      });

      await load();
      showFeedback(
        `${claim.listingName} was ${decision}. The reason and administrator action were recorded.`,
        "success",
        "Claim decision saved"
      );
    }catch(decisionError){
      showFeedback(
        decisionError?.message || "The claim was not changed.",
        "error",
        "Claim decision failed"
      );
    }finally{
      setWorkingId(null);
    }
  }

  function requestDecision(claim,decision){
    const key=decisionKey("claim",claim.id);
    const reason=(reasons[key] || "").trim();

    if(reason.length<3 || reason.length>500){
      showFeedback(
        "Enter a decision reason between 3 and 500 characters before continuing.",
        "error",
        "Decision reason required"
      );
      return;
    }

    const approving=decision==="approved";
    Alert.alert(
      approving ? "Approve this listing claim?" : "Reject this listing claim?",
      approving
        ? `${claim.profile.fullName} will become the Manager for ${claim.listingName}.`
        : `${claim.profile.fullName}'s claim for ${claim.listingName} will be rejected.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:approving ? "Approve claim" : "Reject claim",
          style:approving ? "default" : "destructive",
          onPress:()=>decideClaim(claim,decision,reason)
        }
      ]
    );
  }

  async function decideCapability(request,decision,reason){
    const key=decisionKey("capability",request.id);
    setWorkingId(key);

    try{
      const {data,error:decisionError}=await supabase.rpc("admin_decide_capability_request",{
        p_request_id:request.id,
        p_decision:decision,
        p_reason:reason
      });

      if(decisionError) throw decisionError;
      if(!data || data.request_id!==request.id || data.decision!==decision){
        throw new Error("The database did not confirm the capability decision.");
      }

      setReasons((current)=>{
        const next={...current};
        delete next[key];
        return next;
      });

      await load();
      showFeedback(
        `${request.capabilityLabel} access for ${request.profile.fullName} was ${decision}.`,
        "success",
        "Capability decision saved"
      );
    }catch(decisionError){
      showFeedback(
        decisionError?.message || "The capability request was not changed.",
        "error",
        "Capability decision failed"
      );
    }finally{
      setWorkingId(null);
    }
  }

  function requestCapabilityDecision(request,decision){
    const key=decisionKey("capability",request.id);
    const reason=(reasons[key] || "").trim();

    if(reason.length<3 || reason.length>500){
      showFeedback(
        "Enter a decision reason between 3 and 500 characters before continuing.",
        "error",
        "Decision reason required"
      );
      return;
    }

    const approving=decision==="approved";
    Alert.alert(
      approving ? "Approve this capability request?" : "Reject this capability request?",
      approving
        ? `${request.profile.fullName} will receive ${request.capabilityLabel} Manager access.`
        : `${request.profile.fullName}'s request for ${request.capabilityLabel} Manager access will be rejected.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:approving ? "Approve access" : "Reject request",
          style:approving ? "default" : "destructive",
          onPress:()=>decideCapability(request,decision,reason)
        }
      ]
    );
  }

  if(checking){
    return(
      <View style={styles.fullState}>
        <ActivityIndicator size="large" color={INK.ink}/>
        <Text style={styles.stateText}>Checking admin access…</Text>
      </View>
    );
  }

  if(!allowed){
    return(
      <View style={styles.fullState}>
        <Text style={styles.deniedTitle}>Admin access required</Text>
        <Text style={styles.stateText}>
          {gateError || "An admin account is required to open this screen."}
        </Text>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {paddingBottom:(Platform.OS==="web" ? 34 : Math.max(insets.bottom,24))+40}
      ]}
    >
      <Text style={styles.eyebrow}>ADMIN ACCESS</Text>
      <Text style={styles.screenTitle}>Claims & Manager access</Text>
      <Text style={styles.intro}>
        Verify every request, record why, then approve or reject it. Every decision is audited.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading pending access requests…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Access requests could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading pending access requests again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sectionHeading}>Listing claims</Text>
          <Text style={styles.sectionIntro}>
            Claims assign one business or property listing to an Explorer.
          </Text>

          <Text style={styles.queueCount}>
            {`${claims.length} ${claims.length===1 ? "claim" : "claims"} waiting`}
          </Text>

          {claims.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No pending listing claims</Text>
              <Text style={styles.emptyText}>New business and property claims will appear here.</Text>
            </View>
          ) : claims.map((claim)=>{
              const key=decisionKey("claim",claim.id);
              const reason=reasons[key] || "";
              const working=workingId===key;
              const anotherWorking=workingId!==null && !working;

              return(
                <View key={claim.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.typeLabel}>{claim.listingType.toUpperCase()} CLAIM</Text>
                      <Text style={styles.listingName}>{claim.listingName}</Text>
                    </View>
                    <Text style={styles.submitted}>{formatSubmitted(claim.created_at)}</Text>
                  </View>

                  <View style={styles.divider}/>

                  <Text style={styles.label}>EXPLORER</Text>
                  <Text style={styles.valueStrong}>{claim.profile.fullName}</Text>
                  <Text style={styles.value}>{claim.profile.email}</Text>
                  <Text style={styles.value}>{claim.profile.phone}</Text>

                  <Text style={styles.label}>CLAIM NOTE</Text>
                  <Text style={styles.note}>{claim.note || "No note supplied"}</Text>

                  <Text style={styles.label}>DECISION REASON</Text>
                  <TextInput
                    accessibilityLabel={`Decision reason for ${claim.listingName}`}
                    editable={!working && !anotherWorking}
                    maxLength={500}
                    multiline
                    onChangeText={(value)=>updateReason(key,value)}
                    placeholder="Record the evidence or reason for this decision"
                    placeholderTextColor={INK.inkSoft}
                    style={styles.reasonInput}
                    textAlignVertical="top"
                    value={reason}
                  />
                  <Text style={styles.reasonHelp}>Required · 3–500 characters · {reason.length}/500</Text>

                  <View style={styles.buttons}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Approve claim for ${claim.listingName}`}
                      disabled={working || anotherWorking}
                      onPress={()=>requestDecision(claim,"approved")}
                      style={({pressed})=>[
                        styles.approveButton,
                        pressed && styles.pressed,
                        (working || anotherWorking) && styles.disabled
                      ]}
                    >
                      {working ? (
                        <ActivityIndicator size="small" color={INK.paper}/>
                      ) : (
                        <Text style={styles.approveText}>Approve</Text>
                      )}
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Reject claim for ${claim.listingName}`}
                      disabled={working || anotherWorking}
                      onPress={()=>requestDecision(claim,"rejected")}
                      style={({pressed})=>[
                        styles.rejectButton,
                        pressed && styles.pressed,
                        (working || anotherWorking) && styles.disabled
                      ]}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

          <Text style={styles.sectionHeading}>Manager capability requests</Text>
          <Text style={styles.sectionIntro}>
            Capabilities unlock the Manager tools for businesses, properties, activity clubs or events.
          </Text>
          <Text style={styles.queueCount}>
            {`${capabilityRequests.length} ${capabilityRequests.length===1 ? "request" : "requests"} waiting`}
          </Text>

          {capabilityRequests.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No pending capability requests</Text>
              <Text style={styles.emptyText}>New Manager-access requests will appear here.</Text>
            </View>
          ) : capabilityRequests.map((request)=>{
              const key=decisionKey("capability",request.id);
              const reason=reasons[key] || "";
              const working=workingId===key;
              const anotherWorking=workingId!==null && !working;

              return(
                <View key={request.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.typeLabel}>MANAGER CAPABILITY</Text>
                      <Text style={styles.listingName}>{request.capabilityLabel}</Text>
                    </View>
                    <Text style={styles.submitted}>{formatSubmitted(request.requested_at)}</Text>
                  </View>

                  <View style={styles.divider}/>

                  <Text style={styles.label}>EXPLORER</Text>
                  <Text style={styles.valueStrong}>{request.profile.fullName}</Text>
                  <Text style={styles.value}>{request.profile.email}</Text>
                  <Text style={styles.value}>{request.profile.phone}</Text>

                  <Text style={styles.label}>REQUEST NOTE</Text>
                  <Text style={styles.note}>{request.request_note || "No note supplied"}</Text>

                  <Text style={styles.label}>DECISION REASON</Text>
                  <TextInput
                    accessibilityLabel={`Decision reason for ${request.capabilityLabel} access requested by ${request.profile.fullName}`}
                    editable={!working && !anotherWorking}
                    maxLength={500}
                    multiline
                    onChangeText={(value)=>updateReason(key,value)}
                    placeholder="Record the evidence or reason for this decision"
                    placeholderTextColor={INK.inkSoft}
                    style={styles.reasonInput}
                    textAlignVertical="top"
                    value={reason}
                  />
                  <Text style={styles.reasonHelp}>Required · 3–500 characters · {reason.length}/500</Text>

                  <View style={styles.buttons}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${request.capabilityLabel} access for ${request.profile.fullName}`}
                      disabled={working || anotherWorking}
                      onPress={()=>requestCapabilityDecision(request,"approved")}
                      style={({pressed})=>[
                        styles.approveButton,
                        pressed && styles.pressed,
                        (working || anotherWorking) && styles.disabled
                      ]}
                    >
                      {working ? (
                        <ActivityIndicator size="small" color={INK.paper}/>
                      ) : (
                        <Text style={styles.approveText}>Approve access</Text>
                      )}
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Reject ${request.capabilityLabel} access for ${request.profile.fullName}`}
                      disabled={working || anotherWorking}
                      onPress={()=>requestCapabilityDecision(request,"rejected")}
                      style={({pressed})=>[
                        styles.rejectButton,
                        pressed && styles.pressed,
                        (working || anotherWorking) && styles.disabled
                      ]}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{
    flex:1,
    backgroundColor:INK.paper
  },
  content:{
    paddingHorizontal:20,
    paddingTop:28
  },
  fullState:{
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    gap:12,
    padding:32,
    backgroundColor:INK.paper
  },
  stateText:{
    maxWidth:320,
    color:INK.inkSoft,
    fontSize:16,
    lineHeight:23,
    textAlign:"center"
  },
  deniedTitle:{
    color:INK.ink,
    fontSize:24,
    fontWeight:"800"
  },
  eyebrow:{
    color:INK.inkSoft,
    fontSize:12,
    fontWeight:"800",
    letterSpacing:1.4,
    marginBottom:9
  },
  screenTitle:{
    color:INK.ink,
    fontSize:34,
    fontWeight:"900",
    letterSpacing:-1.2,
    lineHeight:38
  },
  intro:{
    color:INK.inkSoft,
    fontSize:16,
    lineHeight:23,
    marginBottom:24,
    marginTop:10
  },
  sectionHeading:{
    color:INK.ink,
    fontSize:24,
    fontWeight:"900",
    letterSpacing:-0.4,
    marginTop:8
  },
  sectionIntro:{
    color:INK.inkSoft,
    fontSize:14,
    lineHeight:20,
    marginBottom:9,
    marginTop:5
  },
  panel:{
    minHeight:150,
    alignItems:"center",
    justifyContent:"center",
    gap:12,
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:24
  },
  panelText:{
    color:INK.inkSoft,
    fontSize:15
  },
  errorPanel:{
    borderColor:INK.ink,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:22
  },
  errorTitle:{
    color:INK.ink,
    fontSize:21,
    fontWeight:"800"
  },
  errorText:{
    color:INK.inkSoft,
    fontSize:15,
    lineHeight:22,
    marginTop:8
  },
  primaryButton:{
    minHeight:48,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:14,
    backgroundColor:INK.ink,
    marginTop:18,
    paddingHorizontal:18,
    paddingVertical:12
  },
  primaryButtonText:{
    color:INK.paper,
    fontSize:16,
    fontWeight:"800"
  },
  emptyPanel:{
    alignItems:"center",
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:32
  },
  emptyTitle:{
    color:INK.ink,
    fontSize:21,
    fontWeight:"800"
  },
  emptyText:{
    color:INK.inkSoft,
    fontSize:15,
    lineHeight:21,
    marginTop:7,
    textAlign:"center"
  },
  queueCount:{
    color:INK.inkSoft,
    fontSize:14,
    fontWeight:"700",
    marginBottom:10
  },
  card:{
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    marginBottom:14,
    padding:18
  },
  cardHeader:{
    gap:8
  },
  cardHeaderCopy:{
    gap:5
  },
  typeLabel:{
    color:INK.inkSoft,
    fontSize:11,
    fontWeight:"900",
    letterSpacing:1.1
  },
  listingName:{
    color:INK.ink,
    fontSize:22,
    fontWeight:"900",
    lineHeight:27
  },
  submitted:{
    color:INK.inkSoft,
    fontSize:13
  },
  divider:{
    height:1,
    backgroundColor:INK.hair,
    marginVertical:17
  },
  label:{
    color:INK.inkSoft,
    fontSize:11,
    fontWeight:"900",
    letterSpacing:1,
    marginBottom:5,
    marginTop:16
  },
  valueStrong:{
    color:INK.ink,
    fontSize:17,
    fontWeight:"800"
  },
  value:{
    color:INK.inkSoft,
    fontSize:14,
    lineHeight:20,
    marginTop:2
  },
  note:{
    color:INK.ink,
    fontSize:15,
    lineHeight:22
  },
  reasonInput:{
    minHeight:96,
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    backgroundColor:INK.paper,
    color:INK.ink,
    fontSize:15,
    lineHeight:21,
    paddingHorizontal:14,
    paddingVertical:12
  },
  reasonHelp:{
    color:INK.inkSoft,
    fontSize:12,
    marginTop:6
  },
  buttons:{
    flexDirection:"row",
    gap:10,
    marginTop:18
  },
  approveButton:{
    minHeight:50,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:14,
    backgroundColor:INK.ink,
    paddingHorizontal:14,
    paddingVertical:12
  },
  approveText:{
    color:INK.paper,
    fontSize:15,
    fontWeight:"800"
  },
  rejectButton:{
    minHeight:50,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:14,
    paddingVertical:12
  },
  rejectText:{
    color:INK.ink,
    fontSize:15,
    fontWeight:"800"
  },
  pressed:{
    opacity:0.72
  },
  disabled:{
    opacity:0.45
  }
});
