import React,{useCallback,useState} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Field,
  fieldInputStyle,
  KeyValue,
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Admin Dashboard Stage 4: listing claims and Manager capability requests.
//
// APPROVE IS `exists`, REJECT IS AN OUTLINE. docs/design-system.md reserves
// agree/dispute for a manager answering a review, and says in as many words
// that admin approve/reject does not get them: approving a claim is not the
// same act as a business replying to a customer. So the affirmative control is
// the app's one lit button and the other is a machined outline, on both queues.

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
      <Screen style={styles.fullState}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.stateText}>Checking admin access…</Text>
      </Screen>
    );
  }

  if(!allowed){
    return(
      <Screen>
        <ScreenTitle eyebrow="Admin" title="Admin access required"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Refused">
            {gateError || "An admin account is required to open this screen."}
          </Notice>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom:(Platform.OS==="web" ? 34 : Math.max(insets.bottom,24))+CREATE_HUB_CLEARANCE
        }}
      >
        <ScreenTitle
          eyebrow="Admin access"
          title="Claims & Manager access"
          meta="Verify every request, record why, then approve or reject it. Every decision is audited."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading pending access requests…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Access requests could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading pending access requests again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <SectionRule label="Listing claims" meta={String(claims.length)}/>

              <Text style={styles.sectionIntro}>
                Claims assign one business or property listing to an Explorer.
              </Text>

              <Text style={styles.queueCount}>
                {`${claims.length} ${claims.length===1 ? "claim" : "claims"} waiting`}
              </Text>

              {claims.length===0 ? (
                <Empty
                  glyph="key"
                  title="No pending listing claims"
                  instruction="New business and property claims will appear here."
                />
              ) : claims.map((claim)=>{
                  const key=decisionKey("claim",claim.id);
                  const reason=reasons[key] || "";
                  const working=workingId===key;
                  const anotherWorking=workingId!==null && !working;

                  return(
                    <Panel key={claim.id} style={styles.card}>
                      <View style={styles.head}>
                        <Text style={styles.headKind}>{`${claim.listingType} claim`}</Text>
                        <View style={styles.headLine}/>
                        <Text style={styles.headTime} numberOfLines={1}>{formatSubmitted(claim.created_at)}</Text>
                      </View>

                      <Text style={styles.listingName} numberOfLines={2}>{claim.listingName}</Text>

                      <Text style={styles.label}>Explorer</Text>
                      <Text style={styles.valueStrong}>{claim.profile.fullName}</Text>
                      <KeyValue label="Email" value={claim.profile.email}/>
                      <KeyValue label="Phone" value={claim.profile.phone}/>

                      <Text style={styles.label}>Claim note</Text>
                      <Text style={styles.note}>{claim.note || "No note supplied"}</Text>

                      <Field
                        label="Decision reason"
                        hint={`Required · 3–500 characters · ${reason.length}/500`}
                        style={styles.reasonField}
                      >
                        <TextInput
                          accessibilityLabel={`Decision reason for ${claim.listingName}`}
                          editable={!working && !anotherWorking}
                          maxLength={500}
                          multiline
                          onChangeText={(value)=>updateReason(key,value)}
                          placeholder="Record the evidence or reason for this decision"
                          placeholderTextColor={INK.readoutFaint}
                          style={[fieldInputStyle,styles.reasonInput]}
                          textAlignVertical="top"
                          value={reason}
                        />
                      </Field>

                      <View style={styles.buttons}>
                        <Action
                          kind="primary"
                          glyph="check"
                          label="Approve"
                          accessibilityLabel={`Approve claim for ${claim.listingName}`}
                          loading={working}
                          disabled={working || anotherWorking}
                          onPress={()=>requestDecision(claim,"approved")}
                          style={styles.button}
                        />
                        <Action
                          kind="secondary"
                          glyph="close"
                          label="Reject"
                          accessibilityLabel={`Reject claim for ${claim.listingName}`}
                          disabled={working || anotherWorking}
                          onPress={()=>requestDecision(claim,"rejected")}
                          style={styles.button}
                        />
                      </View>
                    </Panel>
                  );
                })}

              <SectionRule label="Manager capability requests" meta={String(capabilityRequests.length)}/>

              <Text style={styles.sectionIntro}>
                Capabilities unlock the Manager tools for businesses, properties, activity clubs or events.
              </Text>

              <Text style={styles.queueCount}>
                {`${capabilityRequests.length} ${capabilityRequests.length===1 ? "request" : "requests"} waiting`}
              </Text>

              {capabilityRequests.length===0 ? (
                <Empty
                  glyph="key"
                  title="No pending capability requests"
                  instruction="New Manager-access requests will appear here."
                />
              ) : capabilityRequests.map((request)=>{
                  const key=decisionKey("capability",request.id);
                  const reason=reasons[key] || "";
                  const working=workingId===key;
                  const anotherWorking=workingId!==null && !working;

                  return(
                    <Panel key={request.id} style={styles.card}>
                      <View style={styles.head}>
                        <Text style={styles.headKind}>Manager capability</Text>
                        <View style={styles.headLine}/>
                        <Text style={styles.headTime} numberOfLines={1}>{formatSubmitted(request.requested_at)}</Text>
                      </View>

                      <Text style={styles.listingName} numberOfLines={2}>{request.capabilityLabel}</Text>

                      <Text style={styles.label}>Explorer</Text>
                      <Text style={styles.valueStrong}>{request.profile.fullName}</Text>
                      <KeyValue label="Email" value={request.profile.email}/>
                      <KeyValue label="Phone" value={request.profile.phone}/>

                      <Text style={styles.label}>Request note</Text>
                      <Text style={styles.note}>{request.request_note || "No note supplied"}</Text>

                      <Field
                        label="Decision reason"
                        hint={`Required · 3–500 characters · ${reason.length}/500`}
                        style={styles.reasonField}
                      >
                        <TextInput
                          accessibilityLabel={`Decision reason for ${request.capabilityLabel} access requested by ${request.profile.fullName}`}
                          editable={!working && !anotherWorking}
                          maxLength={500}
                          multiline
                          onChangeText={(value)=>updateReason(key,value)}
                          placeholder="Record the evidence or reason for this decision"
                          placeholderTextColor={INK.readoutFaint}
                          style={[fieldInputStyle,styles.reasonInput]}
                          textAlignVertical="top"
                          value={reason}
                        />
                      </Field>

                      <View style={styles.buttons}>
                        <Action
                          kind="primary"
                          glyph="check"
                          label="Approve access"
                          accessibilityLabel={`Approve ${request.capabilityLabel} access for ${request.profile.fullName}`}
                          loading={working}
                          disabled={working || anotherWorking}
                          onPress={()=>requestCapabilityDecision(request,"approved")}
                          style={styles.button}
                        />
                        <Action
                          kind="secondary"
                          glyph="close"
                          label="Reject"
                          accessibilityLabel={`Reject ${request.capabilityLabel} access for ${request.profile.fullName}`}
                          disabled={working || anotherWorking}
                          onPress={()=>requestCapabilityDecision(request,"rejected")}
                          style={styles.button}
                        />
                      </View>
                    </Panel>
                  );
                })}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  body:{paddingHorizontal:16},
  fullState:{alignItems:"center",justifyContent:"center",gap:12,padding:32},
  stateText:{
    maxWidth:320,color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,textAlign:"center"
  },

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  sectionIntro:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,marginBottom:6
  },
  queueCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  card:{padding:14,marginBottom:11},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headTime:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,flexShrink:1,maxWidth:150},

  listingName:{
    color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3
  },

  label:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:13,marginBottom:4},
  valueStrong:{
    color:INK.readout,fontSize:TYPE.body.sizes.lg,fontWeight:"600"
  },
  note:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },

  reasonField:{marginTop:14,marginBottom:2},
  reasonInput:{minHeight:92},

  buttons:{flexDirection:"row",gap:9,marginTop:12},
  button:{flex:1}
});
