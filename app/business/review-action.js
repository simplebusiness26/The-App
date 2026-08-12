import React,{useEffect,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,ActivityIndicator} from "react-native";
import {useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

export default function ReviewAction(){
  const {id}=useLocalSearchParams();
  const {showFeedback}=useFeedback();

  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [response,setResponse]=useState("");
  const [reason,setReason]=useState("");

  useEffect(()=>{load();},[id]);

  async function load(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    if(!id){setError("No review was supplied.");setLoading(false);return;}

    // explorer_reviews is the review. `reviews` is a copy written by a trigger
    // (20260802152100:267-342) and was where the reply columns lived -- they
    // were never in a migration, which is how a business review ended up with a
    // column called business_response. They are on the real row now.
    const {data:review,error:reviewError}=await supabase
      .from("explorer_reviews")
      .select("id,target_type,target_id,manager_response,challenged,challenge_reason")
      .eq("id",id)
      .maybeSingle();

    if(reviewError || !review){
      setError("This review could not be loaded.");
      setLoading(false);
      return;
    }

    if(review.target_type!=="business"){
      setError("This review is not attached to a business listing.");
      setLoading(false);
      return;
    }

    const {data:business}=await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id",review.target_id)
      .maybeSingle();

    // The "Listing owners can respond to reviews" policy is what actually
    // decides this. Checking it here means a non-owner sees why the screen is
    // closed instead of a form whose buttons change nothing.
    if(business?.owner_id!==user.id){
      setError("Only the owner of this listing can respond to its reviews.");
      setLoading(false);
      return;
    }

    setResponse(review.manager_response || "");
    setReason(review.challenge_reason || "");
    setLoading(false);
  }

  async function saveResponse(){
    setWorking(true);

    // A function rather than an update. explorer_reviews grants update at table
    // level, so a policy letting a manager write here would let them rewrite
    // the rating and the text of somebody else's review -- a policy cannot say
    // "only these three columns changed". respond_to_review checks who manages
    // the listing and touches nothing else, and refuses out loud rather than
    // matching no rows.
    const {error:updateError}=await supabase
      .rpc("respond_to_review",{p_review_id:id,p_response:response});

    setWorking(false);

    if(updateError){
      showFeedback(updateError.message,"error");
      return;
    }

    showFeedback("Your reply to this review was saved.");
    router.back();
  }

  async function challenge(){
    if(!reason.trim()){
      showFeedback("Add a reason before challenging this review.","error");
      return;
    }

    setWorking(true);

    const {error:updateError}=await supabase
      .rpc("challenge_review",{p_review_id:id,p_reason:reason});

    setWorking(false);

    if(updateError){
      showFeedback(updateError.message,"error");
      return;
    }

    showFeedback("This review was challenged and sent for moderation.");
    router.back();
  }

  if(loading){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if(error){
    return(
      <View style={styles.centre}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <Text style={styles.title}>Manage Review</Text>

      <TextInput
        style={styles.input}
        placeholder="Business response"
        value={response}
        onChangeText={setResponse}
      />

      <Pressable
        style={[styles.button,working && styles.buttonDisabled]}
        disabled={working}
        onPress={saveResponse}
      >
        <Text style={styles.text}>Save Reply</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Reason for challenge"
        value={reason}
        onChangeText={setReason}
      />

      <Pressable
        style={[styles.button,working && styles.buttonDisabled]}
        disabled={working}
        onPress={challenge}
      >
        <Text style={styles.text}>Challenge Review</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{padding:20},
  centre:{flex:1,justifyContent:"center",alignItems:"center",padding:40},
  errorText:{fontSize:16,textAlign:"center",color:INK.red},
  title:{fontSize:30,fontWeight:"bold",marginBottom:20},
  input:{borderWidth:1,padding:15,borderRadius:10,marginBottom:15},
  button:{backgroundColor:"#222",padding:15,borderRadius:10,marginTop:10},
  buttonDisabled:{opacity:0.5},
  text:{color:"white",textAlign:"center"}
});
