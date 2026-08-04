import React,{useEffect,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,ActivityIndicator} from "react-native";
import {useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";

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

    const {data:review,error:reviewError}=await supabase
      .from("reviews")
      .select("id,business_id,business_response,challenged,challenge_reason")
      .eq("id",id)
      .maybeSingle();

    if(reviewError || !review){
      setError("This review could not be loaded.");
      setLoading(false);
      return;
    }

    if(!review.business_id){
      setError("This review is not attached to a business listing.");
      setLoading(false);
      return;
    }

    const {data:business}=await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id",review.business_id)
      .maybeSingle();

    // The "Listing owners can respond to reviews" policy is what actually
    // decides this. Checking it here means a non-owner sees why the screen is
    // closed instead of a form whose buttons change nothing.
    if(business?.owner_id!==user.id){
      setError("Only the owner of this listing can respond to its reviews.");
      setLoading(false);
      return;
    }

    setResponse(review.business_response || "");
    setReason(review.challenge_reason || "");
    setLoading(false);
  }

  async function saveResponse(){
    setWorking(true);

    const {data,error:updateError}=await supabase
      .from("reviews")
      .update({business_response:response})
      .eq("id",id)
      .select();

    setWorking(false);

    if(updateError){
      showFeedback(updateError.message,"error");
      return;
    }

    // A write refused by RLS matches no rows and reports no error, so an empty
    // result is a rejection, not a success.
    if(!data || data.length===0){
      showFeedback("Your reply was not saved. Only the listing owner can respond to this review.","error");
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

    const {data,error:updateError}=await supabase
      .from("reviews")
      .update({challenged:true,challenge_reason:reason})
      .eq("id",id)
      .select();

    setWorking(false);

    if(updateError){
      showFeedback(updateError.message,"error");
      return;
    }

    if(!data || data.length===0){
      showFeedback("Your challenge was not saved. Only the listing owner can challenge this review.","error");
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
  errorText:{fontSize:16,textAlign:"center",color:"#b42318"},
  title:{fontSize:30,fontWeight:"bold",marginBottom:20},
  input:{borderWidth:1,padding:15,borderRadius:10,marginBottom:15},
  button:{backgroundColor:"#222",padding:15,borderRadius:10,marginTop:10},
  buttonDisabled:{opacity:0.5},
  text:{color:"white",textAlign:"center"}
});
