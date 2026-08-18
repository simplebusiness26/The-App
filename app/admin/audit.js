import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
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

// The append-only history of admin decisions.
//
// Every field on this screen is something the app recorded -- who, what, to
// what, when -- except the reason, which a person typed. So everything is mono
// except the reason, and that split is the whole layout: the head strip reads
// like a log line and the reason reads like a sentence.

const PAGE_SIZE=25;
const AUDIT_COLUMNS="id,actor_id,action,target_type,target_id,reason,created_at";

function pretty(value){
  return String(value || "unknown")
    .replace(/[._]/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

function dateLabel(value){
  if(!value) return "Time unavailable";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
}

export default function AdminAudit(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const [entries,setEntries]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setEntries([]);

    try{
      const from=page*PAGE_SIZE;
      const {data:auditRows,count,error:auditError}=await supabase
        .from("admin_audit_log")
        .select(AUDIT_COLUMNS,{count:"exact"})
        .order("created_at",{ascending:false})
        .range(from,from+PAGE_SIZE-1);

      if(auditError || !Array.isArray(auditRows) || typeof count!=="number"){
        throw new Error(auditError?.message || "The audit page was not returned.");
      }

      const actorIds=[...new Set(auditRows.map((entry)=>entry.actor_id).filter(Boolean))];
      const actorResult=actorIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id",actorIds)
        : {data:[],error:null};

      if(actorResult.error || !Array.isArray(actorResult.data)){
        throw new Error(actorResult.error?.message || "Audit actor names were not returned.");
      }

      const actorNames=new Map(actorResult.data.map((actor)=>[actor.id,actor.full_name]));
      setEntries(auditRows.map((entry)=>({
        ...entry,
        actor_name:actorNames.get(entry.actor_id) || "Unknown administrator"
      })));
      setTotal(count);
    }catch(loadError){
      setError(loadError?.message || "The audit log could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed,page]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    if(!term) return entries;
    return entries.filter((entry)=>[
      entry.actor_name,entry.action,entry.target_type,entry.target_id,entry.reason
    ].some((value)=>String(value || "").toLowerCase().includes(term)));
  },[entries,search]);

  const pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));

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
        contentContainerStyle={{paddingBottom:Math.max(insets.bottom,24)+CREATE_HUB_CLEARANCE}}
      >
        <ScreenTitle
          eyebrow="Admin audit"
          title="Audit history"
          meta="An append-only history of admin decisions. This screen cannot create, edit or delete audit records."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading audit history…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Audit history could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading audit history again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <Field label="Search this page">
                <TextInput
                  accessibilityLabel="Search audit history"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  placeholder="Search this page"
                  placeholderTextColor={INK.readoutFaint}
                  style={fieldInputStyle}
                  value={search}
                />
              </Field>

              <SectionRule label="Records" meta={String(visible.length)}/>

              <Text style={styles.resultCount}>
                {`${visible.length} shown · ${total} records · Page ${page+1} of ${pageCount}`}
              </Text>

              {visible.length===0 ? (
                <Empty
                  glyph="clipboard"
                  title={entries.length ? "No audit records match" : "No audit records yet"}
                  instruction={entries.length
                    ? "Try another search on this page."
                    : "Audited admin decisions will appear here."}
                />
              ) : visible.map((entry)=>(
                <Panel key={entry.id} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={styles.headKind}>Audit</Text>
                    <View style={styles.headLine}/>
                    <Text style={styles.headTime} numberOfLines={1}>{dateLabel(entry.created_at)}</Text>
                  </View>

                  <Text style={styles.action}>{pretty(entry.action)}</Text>
                  <Text style={styles.actor}>{entry.actor_name}</Text>

                  <KeyValue label={pretty(entry.target_type)} value={String(entry.target_id)}/>

                  <Text style={styles.label}>Recorded reason</Text>
                  <Text style={styles.reason}>{entry.reason}</Text>
                </Panel>
              ))}

              <View style={styles.pagination}>
                <Action
                  kind="secondary"
                  glyph="back"
                  label="Previous"
                  accessibilityLabel="Previous audit page"
                  disabled={page===0}
                  onPress={()=>setPage((current)=>Math.max(0,current-1))}
                  style={styles.pageButton}
                />
                <Action
                  kind="secondary"
                  glyph="forward"
                  label="Next"
                  accessibilityLabel="Next audit page"
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

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  resultCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  card:{padding:14,marginBottom:9},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headTime:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,flexShrink:1,maxWidth:140},

  action:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},
  actor:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,marginTop:3},

  label:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:11},
  reason:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,marginTop:5
  },

  pagination:{flexDirection:"row",gap:9,marginTop:6},
  pageButton:{flex:1}
});
