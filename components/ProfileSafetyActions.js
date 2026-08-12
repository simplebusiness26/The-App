import React,{useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

const REASONS=["spam","harassment","unsafe","inappropriate","false_information","other"];

export default function ProfileSafetyActions({profileId}){
  const {showFeedback}=useFeedback();
  const [viewerId,setViewerId]=useState(null);
  const [blocked,setBlocked]=useState(false);
  const [showMenu,setShowMenu]=useState(false);
  const [reason,setReason]=useState("harassment");
  const [working,setWorking]=useState(false);

  useEffect(()=>{load();},[profileId]);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    setViewerId(user?.id || null);
    if(!user||!profileId||user.id===profileId) return;
    const {data}=await supabase.from("user_blocks").select("id").eq("blocker_id",user.id).eq("blocked_id",profileId).maybeSingle();
    setBlocked(!!data);
  }

  async function toggleBlock(){
    if(working) return;
    setWorking(true);
    const {error}=await supabase.rpc(blocked?"unblock_explorer":"block_explorer",{p_user_id:profileId});
    setWorking(false);
    if(error){showFeedback(error.message,"error",blocked?"Explorer not unblocked":"Explorer not blocked");return;}
    setBlocked(!blocked);
    setShowMenu(false);
    showFeedback(blocked?"You may now see each other's public activity again.":"You will no longer see each other's social and live activity.","success",blocked?"Explorer unblocked":"Explorer blocked");
  }

  async function report(){
    if(working) return;
    setWorking(true);
    const {error}=await supabase.rpc("report_live_safety",{p_target_type:"user",p_target_id:profileId,p_reason:reason,p_details:"Reported from public Explorer profile"});
    setWorking(false);setShowMenu(false);
    if(error) showFeedback(error.message,"error","Report not sent");
    else showFeedback("This Explorer has been sent for review.","success","Report submitted");
  }

  if(!viewerId||!profileId||viewerId===profileId) return null;

  return(
    <View style={styles.wrap}>
      <Pressable style={styles.menuButton} onPress={()=>setShowMenu(current=>!current)}><Text style={styles.menuText}>Safety options</Text></Pressable>
      {showMenu&&<View style={styles.panel}>
        <Pressable style={styles.blockButton} disabled={working} onPress={toggleBlock}>{working?<ActivityIndicator color="white" size="small"/>:<Text style={styles.blockText}>{blocked?"Unblock Explorer":"Block Explorer"}</Text>}</Pressable>
        {!blocked&&<><Text style={styles.label}>Report reason</Text><View style={styles.reasons}>{REASONS.map(item=><Pressable key={item} style={[styles.reason,reason===item&&styles.reasonActive]} onPress={()=>setReason(item)}><Text style={[styles.reasonText,reason===item&&styles.reasonTextActive]}>{item.replace("_"," ")}</Text></Pressable>)}</View><Pressable style={styles.reportButton} disabled={working} onPress={report}><Text style={styles.reportText}>Submit report</Text></Pressable></>}
      </View>}
    </View>
  );
}

const styles=StyleSheet.create({wrap:{paddingHorizontal:18,paddingTop:8},menuButton:{alignSelf:"flex-end",paddingHorizontal:12,paddingVertical:8},menuText:{color:INK.inkSoft,fontWeight:"900",fontSize:11},panel:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:13,padding:12,marginBottom:8},blockButton:{backgroundColor:INK.red,borderRadius:10,padding:11,alignItems:"center"},blockText:{color:INK.ink,fontWeight:"900"},label:{color:"white",fontWeight:"900",fontSize:12,marginTop:13,marginBottom:8},reasons:{flexDirection:"row",flexWrap:"wrap",gap:6},reason:{borderColor:INK.ink,borderWidth:1,borderRadius:17,paddingHorizontal:9,paddingVertical:6},reasonActive:{backgroundColor:INK.blue,borderColor:INK.blue},reasonText:{color:INK.inkSoft,fontSize:9,fontWeight:"800",textTransform:"capitalize"},reasonTextActive:{color:"white"},reportButton:{backgroundColor:INK.red,borderRadius:10,padding:11,alignItems:"center",marginTop:11},reportText:{color:"white",fontWeight:"900"}});
