import React,{useEffect,useState} from "react";
import {StyleSheet,View} from "react-native";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {Action,Chip,Panel,SectionRule} from "./instrument";

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
      <Action
        kind="quiet"
        glyph="shield"
        label="Safety options"
        style={styles.menuButton}
        onPress={()=>setShowMenu(current=>!current)}
      />

      {showMenu && (
        <Panel style={styles.panel}>
          <Action
            kind="danger"
            glyph={blocked?"check":"block"}
            label={blocked?"Unblock Explorer":"Block Explorer"}
            loading={working}
            onPress={toggleBlock}
          />

          {!blocked && (
            <>
              <SectionRule label="Report reason"/>
              {/*
                Chips, and the chosen one steps a surface rather than filling
                with a state ink. exists/scheduled/offer say what a PLACE is; a
                report reason is not a place, and a fill here was what made the
                unselected labels a contrast problem in the first place.
              */}
              <View style={styles.reasons}>
                {REASONS.map(item=>(
                  <Chip
                    key={item}
                    label={item.replace("_"," ")}
                    selected={reason===item}
                    onPress={()=>setReason(item)}
                  />
                ))}
              </View>

              <Action
                kind="danger"
                glyph="flag"
                label="Submit report"
                loading={working}
                onPress={report}
                style={styles.report}
              />
            </>
          )}
        </Panel>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{paddingHorizontal:18,paddingTop:8},
  menuButton:{alignSelf:"flex-end",paddingHorizontal:12},
  panel:{padding:13,marginTop:8,marginBottom:8,gap:2},
  reasons:{flexDirection:"row",flexWrap:"wrap",gap:6,marginBottom:12},
  report:{marginTop:2}
});
