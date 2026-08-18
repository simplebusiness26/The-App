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
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE} from "../../utils/tokens";
import {
  Action,
  Chip,
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

// The moderation queue.
//
// TWO DECISIONS, AND NEITHER IS RED. Actioning a report is the affirmative
// control, so it takes `exists` and the dark text that goes on it; dismissing
// is an outline. `dispute` is the manager's answer to a review and belongs
// nowhere near an administrator -- docs/design-system.md is explicit, and a red
// "Remove content" button next to a person's name is exactly the kind of
// pressure a moderation queue should not apply.
//
// Everything the report carries is a reading: who reported it, what state the
// target is in, when. The only prose on the card is the reporter's own details
// and the reason an administrator types, so those two are the only body text.

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
          eyebrow="Admin moderation"
          title="Review reports"
          meta="Review only the reported item and safe identity context. Private meeting points and attendee lists are never loaded here."
        />

        <View style={styles.body}>
          <View style={styles.queueTabs}>
            {Object.entries(QUEUES).map(([key,item])=>(
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                accessibilityState={{selected:key===queue}}
                onPress={()=>chooseQueue(key)}
              >
                <Chip label={item.label} selected={key===queue}/>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading {QUEUES[queue].label.toLowerCase()}…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Moderation reports could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading moderation reports again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <SectionRule label={QUEUES[queue].label} meta={String(total)}/>

              <Text style={styles.resultCount}>
                {`${total} open · Page ${page+1} of ${pageCount}`}
              </Text>

              {reports.length===0 ? (
                <Empty
                  glyph="shield"
                  title={QUEUES[queue].empty}
                  instruction="New reports will appear here automatically."
                />
              ) : reports.map((report)=>{
                const working=workingId===report.report_id;
                const anotherWorking=workingId!==null && !working;
                const action=actionLabel(report);

                return(
                  <Panel key={report.report_id} style={styles.card}>
                    <View style={styles.head}>
                      <Text style={styles.headKind}>{`${pretty(report.target_type)} report`}</Text>
                      <View style={styles.headLine}/>
                      <Text style={styles.headState}>{pretty(report.report_state)}</Text>
                    </View>

                    <Text style={styles.reasonTitle}>{pretty(report.reason)}</Text>

                    <KeyValue label="Reported" value={dateLabel(report.created_at)}/>
                    <KeyValue label="Target state" value={pretty(report.target_state)}/>

                    <Text style={styles.label}>Reported item</Text>
                    <Text style={styles.summary}>{report.target_summary}</Text>

                    <Text style={styles.label}>People</Text>
                    <Text style={styles.summary}>Reported by {report.reporter_name}</Text>
                    <Text style={styles.summary}>Content owner {report.target_owner_name}</Text>

                    {!!report.details && (
                      <>
                        <Text style={styles.label}>Report details</Text>
                        <Text style={styles.summary}>{report.details}</Text>
                      </>
                    )}

                    <Field
                      label="Decision reason"
                      hint={`Required · 3–500 characters · ${(reasons[report.report_id] || "").length}/500`}
                      style={styles.reasonField}
                    >
                      <TextInput
                        accessibilityLabel={`Moderation reason for report ${report.report_id}`}
                        editable={!working && !anotherWorking}
                        maxLength={500}
                        multiline
                        onChangeText={(value)=>setReasons((current)=>({...current,[report.report_id]:value}))}
                        placeholder="Record the evidence and reason for this decision"
                        placeholderTextColor={INK.readoutFaint}
                        style={[fieldInputStyle,styles.reasonInput]}
                        textAlignVertical="top"
                        value={reasons[report.report_id] || ""}
                      />
                    </Field>

                    <View style={styles.actions}>
                      <Action
                        kind="primary"
                        glyph="check"
                        label={action}
                        accessibilityLabel={`${action} for report ${report.report_id}`}
                        loading={working}
                        disabled={working || anotherWorking}
                        onPress={()=>confirmDecision(report,"actioned")}
                        style={styles.actionButton}
                      />

                      <Action
                        kind="secondary"
                        glyph="close"
                        label="Dismiss"
                        accessibilityLabel={`Dismiss report ${report.report_id}`}
                        disabled={working || anotherWorking}
                        onPress={()=>confirmDecision(report,"dismissed")}
                        style={styles.actionButton}
                      />
                    </View>
                  </Panel>
                );
              })}

              <View style={styles.pagination}>
                <Action
                  kind="secondary"
                  glyph="back"
                  label="Previous"
                  accessibilityLabel="Previous moderation page"
                  disabled={page===0}
                  onPress={()=>setPage((current)=>Math.max(0,current-1))}
                  style={styles.pageButton}
                />
                <Action
                  kind="secondary"
                  glyph="forward"
                  label="Next"
                  accessibilityLabel="Next moderation page"
                  disabled={page+1>=pageCount}
                  onPress={()=>setPage((current)=>current+1)}
                  style={styles.pageButton}
                />
              </View>
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

  queueTabs:{flexDirection:"row",gap:7,marginBottom:6},

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  resultCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  card:{padding:14,marginBottom:11},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headState:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  reasonTitle:{
    color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",
    letterSpacing:-0.3,marginBottom:4
  },

  label:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:13,marginBottom:4},
  summary:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },

  reasonField:{marginTop:14,marginBottom:2},
  reasonInput:{minHeight:86},

  actions:{flexDirection:"row",gap:9,marginTop:12},
  actionButton:{flex:1},

  pagination:{flexDirection:"row",gap:9,marginTop:6},
  pageButton:{flex:1}
});
