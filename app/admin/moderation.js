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

const PAGE_SIZE=25;
const QUEUES={
  social:{label:"Social reports",empty:"No open social reports"},
  safety:{label:"Safety reports",empty:"No open safety reports"}
};

function pretty(value){
  return String(value || "unknown")
    .replace(/_/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

function actionLabel(report){
  if(report.target_type==="user") return "Resolve report";
  if(report.target_type==="linkup") return "Cancel Link-up";
  if(report.target_type==="checkin") return "End check-in";
  return "Remove content";
}

function dateLabel(value){
  if(!value) return "Report time unavailable";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Report time unavailable";
  return date.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
}

export default function AdminModeration(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const {showFeedback}=useFeedback();
  const [queue,setQueue]=useState("social");
  const [reports,setReports]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [reasons,setReasons]=useState({});
  const [workingId,setWorkingId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setReports([]);

    try{
      const {data,error:readError}=await supabase.rpc("admin_get_moderation_queue",{
        p_queue:queue,
        p_limit:PAGE_SIZE,
        p_offset:page*PAGE_SIZE
      });

      if(
        readError
        || !data
        || !Array.isArray(data.items)
        || typeof data.total!=="number"
      ){
        throw new Error(readError?.message || "The moderation queue was not returned.");
      }

      setReports(data.items);
      setTotal(data.total);
    }catch(loadError){
      setError(loadError?.message || "Moderation reports could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed,page,queue]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));

  function chooseQueue(nextQueue){
    if(nextQueue===queue) return;
    setQueue(nextQueue);
    setPage(0);
  }

  async function decideReport(report,decision,reason){
    setWorkingId(report.report_id);

    try{
      const {data,error:writeError}=await supabase.rpc("admin_decide_report",{
        p_queue:queue,
        p_report_id:report.report_id,
        p_decision:decision,
        p_reason:reason
      });

      if(writeError) throw writeError;
      if(!data || data.report_id!==report.report_id || data.decision!==decision){
        throw new Error("The database did not confirm the report decision.");
      }

      setReasons((current)=>{
        const next={...current};
        delete next[report.report_id];
        return next;
      });
      await load();
      showFeedback(
        decision==="dismissed"
          ? "The report was dismissed and the reason was recorded."
          : "The report was resolved and the administrator action was recorded.",
        "success",
        "Moderation decision saved"
      );
    }catch(writeError){
      showFeedback(
        writeError?.message || "The moderation report was not changed.",
        "error",
        "Moderation decision failed"
      );
    }finally{
      setWorkingId(null);
    }
  }

  function confirmDecision(report,decision){
    const reason=(reasons[report.report_id] || "").trim();
    if(reason.length<3 || reason.length>500){
      showFeedback(
        "Enter a decision reason between 3 and 500 characters before continuing.",
        "error",
        "Decision reason required"
      );
      return;
    }

    const action=decision==="dismissed" ? "Dismiss report" : actionLabel(report);
    const changesTarget=decision==="actioned" && report.target_type!=="user";
    Alert.alert(
      `${action}?`,
      changesTarget
        ? `The reported ${pretty(report.target_type).toLowerCase()} will be hidden or ended and the report will be resolved.`
        : `The report will be ${decision==="dismissed" ? "dismissed" : "resolved"} without changing an Explorer account.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:action,
          style:changesTarget ? "destructive" : "default",
          onPress:()=>decideReport(report,decision,reason)
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
      <Text style={styles.eyebrow}>ADMIN MODERATION</Text>
      <Text style={styles.title}>Review reports</Text>
      <Text style={styles.intro}>
        Review only the reported item and safe identity context. Private meeting points and attendee lists are never loaded here.
      </Text>

      <View style={styles.queueTabs}>
        {Object.entries(QUEUES).map(([key,item])=>{
          const selected=key===queue;
          return(
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.label}`}
              accessibilityState={{selected}}
              onPress={()=>chooseQueue(key)}
              style={({pressed})=>[
                styles.queueTab,
                selected && styles.queueTabSelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.queueTabText,selected && styles.queueTabTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading {QUEUES[queue].label.toLowerCase()}…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Moderation reports could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading moderation reports again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {`${total} open · Page ${page+1} of ${pageCount}`}
          </Text>

          {reports.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>{QUEUES[queue].empty}</Text>
              <Text style={styles.emptyText}>New reports will appear here automatically.</Text>
            </View>
          ) : reports.map((report)=>{
            const working=workingId===report.report_id;
            const anotherWorking=workingId!==null && !working;
            const action=actionLabel(report);

            return(
              <View key={report.report_id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.typeLabel}>{pretty(report.target_type).toUpperCase()} REPORT</Text>
                    <Text style={styles.reasonTitle}>{pretty(report.reason)}</Text>
                    <Text style={styles.reportDate}>Reported {dateLabel(report.created_at)}</Text>
                  </View>
                  <Text style={styles.statePill}>{pretty(report.report_state)}</Text>
                </View>

                <Text style={styles.label}>REPORTED ITEM</Text>
                <Text style={styles.summary}>{report.target_summary}</Text>
                <Text style={styles.meta}>Current state: {pretty(report.target_state)}</Text>

                <Text style={styles.label}>PEOPLE</Text>
                <Text style={styles.meta}>Reported by {report.reporter_name}</Text>
                <Text style={styles.meta}>Content owner {report.target_owner_name}</Text>

                {!!report.details && (
                  <>
                    <Text style={styles.label}>REPORT DETAILS</Text>
                    <Text style={styles.summary}>{report.details}</Text>
                  </>
                )}

                <Text style={styles.label}>DECISION REASON</Text>
                <TextInput
                  accessibilityLabel={`Moderation reason for report ${report.report_id}`}
                  editable={!working && !anotherWorking}
                  maxLength={500}
                  multiline
                  onChangeText={(value)=>setReasons((current)=>({...current,[report.report_id]:value}))}
                  placeholder="Record the evidence and reason for this decision"
                  placeholderTextColor={INK.inkSoft}
                  style={styles.reasonInput}
                  textAlignVertical="top"
                  value={reasons[report.report_id] || ""}
                />
                <Text style={styles.reasonHelp}>
                  Required · 3–500 characters · {(reasons[report.report_id] || "").length}/500
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${action} for report ${report.report_id}`}
                    disabled={working || anotherWorking}
                    onPress={()=>confirmDecision(report,"actioned")}
                    style={({pressed})=>[
                      styles.darkButton,
                      pressed && styles.pressed,
                      (working || anotherWorking) && styles.disabled
                    ]}
                  >
                    {working ? (
                      <ActivityIndicator size="small" color={INK.paper}/>
                    ) : (
                      <Text style={styles.darkButtonText}>{action}</Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss report ${report.report_id}`}
                    disabled={working || anotherWorking}
                    onPress={()=>confirmDecision(report,"dismissed")}
                    style={({pressed})=>[
                      styles.outlineButton,
                      pressed && styles.pressed,
                      (working || anotherWorking) && styles.disabled
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous moderation page"
              disabled={page===0}
              onPress={()=>setPage((current)=>Math.max(0,current-1))}
              style={({pressed})=>[styles.pageButton,pressed && styles.pressed,page===0 && styles.disabled]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next moderation page"
              disabled={page+1>=pageCount}
              onPress={()=>setPage((current)=>current+1)}
              style={({pressed})=>[
                styles.pageButton,
                pressed && styles.pressed,
                page+1>=pageCount && styles.disabled
              ]}
            >
              <Text style={styles.pageButtonText}>Next</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{paddingHorizontal:20,paddingTop:28},
  fullState:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:32,backgroundColor:INK.paper},
  stateText:{maxWidth:320,color:INK.inkSoft,fontSize:16,lineHeight:23,textAlign:"center"},
  deniedTitle:{color:INK.ink,fontSize:24,fontWeight:"800"},
  eyebrow:{color:INK.inkSoft,fontSize:12,fontWeight:"800",letterSpacing:1.4,marginBottom:9},
  title:{color:INK.ink,fontSize:34,fontWeight:"900",letterSpacing:-1.2,lineHeight:38},
  intro:{color:INK.inkSoft,fontSize:16,lineHeight:23,marginBottom:20,marginTop:10},
  queueTabs:{flexDirection:"row",gap:8,marginBottom:18},
  queueTab:{
    minHeight:48,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:10
  },
  queueTabSelected:{backgroundColor:INK.ink},
  queueTabText:{color:INK.ink,fontSize:14,fontWeight:"800",textAlign:"center"},
  queueTabTextSelected:{color:INK.paper},
  panel:{minHeight:150,alignItems:"center",justifyContent:"center",gap:12,borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:24},
  panelText:{color:INK.inkSoft,fontSize:15},
  errorPanel:{borderColor:INK.ink,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:22},
  errorTitle:{color:INK.ink,fontSize:21,fontWeight:"800"},
  errorText:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:8},
  primaryButton:{minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:INK.ink,marginTop:18,paddingHorizontal:18,paddingVertical:12},
  primaryButtonText:{color:INK.paper,fontSize:16,fontWeight:"800"},
  resultCount:{color:INK.inkSoft,fontSize:13,fontWeight:"700",marginBottom:10},
  emptyPanel:{alignItems:"center",borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:30},
  emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"800",textAlign:"center"},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:6,textAlign:"center"},
  card:{borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,marginBottom:12,padding:18},
  cardTop:{gap:10},
  cardCopy:{gap:4},
  typeLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1},
  reasonTitle:{color:INK.ink,fontSize:21,fontWeight:"900"},
  reportDate:{color:INK.inkSoft,fontSize:13},
  statePill:{alignSelf:"flex-start",color:INK.ink,fontSize:12,fontWeight:"800",backgroundColor:INK.water,borderRadius:14,overflow:"hidden",paddingHorizontal:10,paddingVertical:6},
  label:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1,marginBottom:5,marginTop:16},
  summary:{color:INK.ink,fontSize:15,lineHeight:22},
  meta:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:2},
  reasonInput:{minHeight:90,borderColor:INK.ink,borderRadius:14,borderWidth:1,backgroundColor:INK.paper,color:INK.ink,fontSize:15,lineHeight:21,paddingHorizontal:14,paddingVertical:12},
  reasonHelp:{color:INK.inkSoft,fontSize:12,marginTop:6},
  actions:{flexDirection:"row",gap:9,marginTop:16},
  darkButton:{minHeight:50,flex:1,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:INK.ink,paddingHorizontal:10,paddingVertical:11},
  darkButtonText:{color:INK.paper,fontSize:14,fontWeight:"800",textAlign:"center"},
  outlineButton:{minHeight:50,flex:1,alignItems:"center",justifyContent:"center",borderColor:INK.ink,borderRadius:13,borderWidth:1,backgroundColor:INK.card,paddingHorizontal:10,paddingVertical:11},
  outlineButtonText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  pagination:{flexDirection:"row",gap:10,marginTop:8},
  pageButton:{minHeight:48,flex:1,alignItems:"center",justifyContent:"center",borderColor:INK.ink,borderRadius:14,borderWidth:1,paddingHorizontal:14},
  pageButtonText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  pressed:{opacity:0.72},
  disabled:{opacity:0.4}
});
