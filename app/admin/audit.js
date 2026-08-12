import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useAdminGate} from "../../hooks/useAdminGate";
import {supabase} from "../../services/supabase";
import {INK} from "../../utils/tokens";

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
      contentContainerStyle={[styles.content,{paddingBottom:Math.max(insets.bottom,24)+40}]}
    >
      <Text style={styles.eyebrow}>ADMIN AUDIT</Text>
      <Text style={styles.title}>Audit history</Text>
      <Text style={styles.intro}>
        An append-only history of admin decisions. This screen cannot create, edit or delete audit records.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading audit history…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Audit history could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading audit history again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search audit history"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search this page"
            placeholderTextColor={INK.inkSoft}
            style={styles.searchInput}
            value={search}
          />

          <Text style={styles.resultCount}>
            {`${visible.length} shown · ${total} records · Page ${page+1} of ${pageCount}`}
          </Text>

          {visible.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>{entries.length ? "No audit records match" : "No audit records yet"}</Text>
              <Text style={styles.emptyText}>
                {entries.length ? "Try another search on this page." : "Audited admin decisions will appear here."}
              </Text>
            </View>
          ) : visible.map((entry)=>(
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.action}>{pretty(entry.action)}</Text>
                  <Text style={styles.actor}>{entry.actor_name}</Text>
                </View>
                <Text style={styles.date}>{dateLabel(entry.created_at)}</Text>
              </View>
              <Text style={styles.target}>{`${pretty(entry.target_type)} · ${entry.target_id}`}</Text>
              <Text style={styles.label}>RECORDED REASON</Text>
              <Text style={styles.reason}>{entry.reason}</Text>
            </View>
          ))}

          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous audit page"
              disabled={page===0}
              onPress={()=>setPage((current)=>Math.max(0,current-1))}
              style={({pressed})=>[styles.pageButton,pressed && styles.pressed,page===0 && styles.disabled]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next audit page"
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
  panel:{minHeight:150,alignItems:"center",justifyContent:"center",gap:12,borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:24},
  panelText:{color:INK.inkSoft,fontSize:15},
  errorPanel:{borderColor:INK.ink,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:22},
  errorTitle:{color:INK.ink,fontSize:21,fontWeight:"800"},
  errorText:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:8},
  primaryButton:{minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:INK.ink,marginTop:18,paddingHorizontal:18,paddingVertical:12},
  primaryButtonText:{color:INK.ink,fontSize:16,fontWeight:"800"},
  searchInput:{minHeight:52,borderColor:INK.ink,borderRadius:16,borderWidth:1,backgroundColor:INK.card,color:INK.ink,fontSize:16,paddingHorizontal:16,paddingVertical:12},
  resultCount:{color:INK.inkSoft,fontSize:13,fontWeight:"700",marginBottom:10,marginTop:13},
  emptyPanel:{alignItems:"center",borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:30},
  emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"800"},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:6,textAlign:"center"},
  card:{borderColor:INK.hair,borderRadius:18,borderWidth:1,backgroundColor:INK.card,marginBottom:10,padding:17},
  cardTop:{flexDirection:"row",alignItems:"flex-start",gap:10},
  cardCopy:{flex:1},
  action:{color:INK.ink,fontSize:18,fontWeight:"900"},
  actor:{color:INK.inkSoft,fontSize:14,fontWeight:"700",marginTop:4},
  date:{maxWidth:116,color:INK.inkSoft,fontSize:12,lineHeight:17,textAlign:"right"},
  target:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:12},
  label:{color:INK.inkSoft,fontSize:10,fontWeight:"900",letterSpacing:1,marginTop:14},
  reason:{color:INK.ink,fontSize:14,lineHeight:21,marginTop:5},
  pagination:{flexDirection:"row",gap:10,marginTop:8},
  pageButton:{minHeight:48,flex:1,alignItems:"center",justifyContent:"center",borderColor:INK.ink,borderRadius:14,borderWidth:1,paddingHorizontal:14},
  pageButtonText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  pressed:{opacity:0.72},
  disabled:{opacity:0.4}
});
