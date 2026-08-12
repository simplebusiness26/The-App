import React,{useCallback,useMemo,useState} from "react";
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
const TYPES={
  activity_clubs:{
    key:"activity_clubs",
    label:"Activity clubs",
    singular:"Activity club",
    targetType:"activity_club",
    columns:"id,name,category,location,status,created_at",
    order:"created_at",
    states:["draft","open","full","closed"]
  },
  events:{
    key:"events",
    label:"Events",
    singular:"Event",
    targetType:"event",
    columns:"id,name,category,location,status,starts_at",
    order:"starts_at",
    states:["draft","published","cancelled"]
  }
};

function pretty(value){
  return String(value || "unknown")
    .replace(/_/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

function transitions(type,state){
  if(type.key==="activity_clubs"){
    if(state==="draft") return[{state:"open",label:"Publish as open"}];
    if(state==="closed") return[
      {state:"open",label:"Reopen"},
      {state:"draft",label:"Hide"}
    ];
    return[
      {state:"closed",label:"Close"},
      {state:"draft",label:"Hide"}
    ];
  }

  if(state==="draft") return[{state:"published",label:"Publish"}];
  if(state==="cancelled") return[{state:"draft",label:"Move to draft"}];
  return[
    {state:"draft",label:"Hide"},
    {state:"cancelled",label:"Cancel event"}
  ];
}

export default function AdminActivities(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const {showFeedback}=useFeedback();
  const [selectedType,setSelectedType]=useState("activity_clubs");
  const [stateFilter,setStateFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [rows,setRows]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [reasons,setReasons]=useState({});
  const [workingId,setWorkingId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const type=TYPES[selectedType];

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setRows([]);

    try{
      const from=page*PAGE_SIZE;
      const {data,count,error:readError}=await supabase
        .from(type.key)
        .select(type.columns,{count:"exact"})
        .order(type.order,{ascending:false})
        .range(from,from+PAGE_SIZE-1);

      if(readError || !Array.isArray(data) || typeof count!=="number"){
        throw new Error(readError?.message || "The activity page was not returned.");
      }

      setRows(data);
      setTotal(count);
    }catch(loadError){
      setError(loadError?.message || "Activities could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed,page,type]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return rows.filter((row)=>{
      const stateMatches=stateFilter==="all" || row.status===stateFilter;
      const haystack=[row.name,row.category,row.location,row.status].filter(Boolean).join(" ").toLowerCase();
      return stateMatches && (!term || haystack.includes(term));
    });
  },[rows,search,stateFilter]);

  const pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));

  function chooseType(key){
    if(key===selectedType) return;
    setSelectedType(key);
    setStateFilter("all");
    setSearch("");
    setPage(0);
  }

  async function setActivityState(row,nextState,reason){
    setWorkingId(row.id);

    try{
      const {data,error:writeError}=await supabase.rpc("admin_set_activity_state",{
        p_target_type:type.targetType,
        p_target_id:row.id,
        p_state:nextState,
        p_reason:reason
      });

      if(writeError) throw writeError;
      if(!data || data.target_id!==row.id || data.state!==nextState){
        throw new Error("The database did not confirm the state change.");
      }

      setReasons((current)=>{
        const next={...current};
        delete next[row.id];
        return next;
      });
      await load();
      showFeedback(
        `${row.name} is now ${pretty(nextState)}. The administrator action was recorded.`,
        "success",
        "Activity state changed"
      );
    }catch(writeError){
      showFeedback(
        writeError?.message || "The activity state was not changed.",
        "error",
        "State change failed"
      );
    }finally{
      setWorkingId(null);
    }
  }

  function confirmState(row,nextState,label){
    const reason=(reasons[row.id] || "").trim();
    if(reason.length<3 || reason.length>500){
      showFeedback(
        "Enter a reason between 3 and 500 characters before changing this state.",
        "error",
        "Decision reason required"
      );
      return;
    }

    const destructive=["draft","closed","cancelled"].includes(nextState);
    Alert.alert(
      `${label} ${row.name}?`,
      `${type.singular} state will change from ${pretty(row.status)} to ${pretty(nextState)}.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:label,
          style:destructive ? "destructive" : "default",
          onPress:()=>setActivityState(row,nextState,reason)
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
      <Text style={styles.eyebrow}>ADMIN ACTIVITIES</Text>
      <Text style={styles.title}>Manage clubs & events</Text>
      <Text style={styles.intro}>
        Hide, publish, close or cancel activity without deleting its history. Every change needs a reason.
      </Text>

      <View style={styles.typeTabs}>
        {Object.values(TYPES).map((item)=>{
          const selected=item.key===selectedType;
          return(
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${item.label}`}
              accessibilityState={{selected}}
              onPress={()=>chooseType(item.key)}
              style={({pressed})=>[
                styles.typeTab,
                selected && styles.typeTabSelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.typeTabText,selected && styles.typeTabTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading {type.label.toLowerCase()}…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Activities could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading admin activities again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search admin activities"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={`Search this page of ${type.label.toLowerCase()}`}
            placeholderTextColor={INK.inkSoft}
            style={styles.searchInput}
            value={search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <FilterChip
              label="All states"
              selected={stateFilter==="all"}
              onPress={()=>setStateFilter("all")}
            />
            {type.states.map((state)=>(
              <FilterChip
                key={state}
                label={pretty(state)}
                selected={stateFilter===state}
                onPress={()=>setStateFilter(state)}
              />
            ))}
          </ScrollView>

          <Text style={styles.resultCount}>
            {`${visible.length} shown · ${total} total · Page ${page+1} of ${pageCount}`}
          </Text>

          {visible.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No activities match</Text>
              <Text style={styles.emptyText}>Try another search, state or page.</Text>
            </View>
          ) : visible.map((row)=>{
            const working=workingId===row.id;
            const anotherWorking=workingId!==null && !working;
            const actions=transitions(type,row.status);

            return(
              <View key={row.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.typeLabel}>{type.singular.toUpperCase()}</Text>
                    <Text style={styles.activityName}>{row.name}</Text>
                    <Text style={styles.detail}>
                      {[row.category,row.location].filter(Boolean).join(" · ") || "No details recorded"}
                    </Text>
                  </View>
                  <Text style={styles.statePill}>State: {pretty(row.status)}</Text>
                </View>

                <Text style={styles.reasonLabel}>CHANGE REASON</Text>
                <TextInput
                  accessibilityLabel={`State-change reason for ${row.name}`}
                  editable={!working && !anotherWorking}
                  maxLength={500}
                  multiline
                  onChangeText={(value)=>setReasons((current)=>({...current,[row.id]:value}))}
                  placeholder="Why is this state changing?"
                  placeholderTextColor={INK.inkSoft}
                  style={styles.reasonInput}
                  textAlignVertical="top"
                  value={reasons[row.id] || ""}
                />
                <Text style={styles.reasonHelp}>
                  Required · 3–500 characters · {(reasons[row.id] || "").length}/500
                </Text>

                <View style={styles.actions}>
                  {actions.map((action,index)=>{
                    const primary=index===0;
                    return(
                      <Pressable
                        key={action.state}
                        accessibilityRole="button"
                        accessibilityLabel={`${action.label} ${row.name}`}
                        disabled={working || anotherWorking}
                        onPress={()=>confirmState(row,action.state,action.label)}
                        style={({pressed})=>[
                          primary ? styles.darkButton : styles.outlineButton,
                          pressed && styles.pressed,
                          (working || anotherWorking) && styles.disabled
                        ]}
                      >
                        {working && primary ? (
                          <ActivityIndicator size="small" color={INK.paper}/>
                        ) : (
                          <Text style={primary ? styles.darkButtonText : styles.outlineButtonText}>
                            {action.label}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous activity page"
              disabled={page===0}
              onPress={()=>setPage((current)=>Math.max(0,current-1))}
              style={({pressed})=>[
                styles.pageButton,
                pressed && styles.pressed,
                page===0 && styles.disabled
              ]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next activity page"
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

function FilterChip({label,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show state ${label}`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed})=>[
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.filterText,selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{paddingHorizontal:20,paddingTop:28},
  fullState:{
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    gap:12,
    padding:32,
    backgroundColor:INK.paper
  },
  stateText:{maxWidth:320,color:INK.inkSoft,fontSize:16,lineHeight:23,textAlign:"center"},
  deniedTitle:{color:INK.ink,fontSize:24,fontWeight:"800"},
  eyebrow:{color:INK.inkSoft,fontSize:12,fontWeight:"800",letterSpacing:1.4,marginBottom:9},
  title:{color:INK.ink,fontSize:34,fontWeight:"900",letterSpacing:-1.2,lineHeight:38},
  intro:{color:INK.inkSoft,fontSize:16,lineHeight:23,marginBottom:20,marginTop:10},
  typeTabs:{flexDirection:"row",gap:8,marginBottom:18},
  typeTab:{
    minHeight:48,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:12
  },
  typeTabSelected:{backgroundColor:INK.ink},
  typeTabText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  typeTabTextSelected:{color:INK.paper},
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
  panelText:{color:INK.inkSoft,fontSize:15},
  errorPanel:{borderColor:INK.ink,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:22},
  errorTitle:{color:INK.ink,fontSize:21,fontWeight:"800"},
  errorText:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:8},
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
  primaryButtonText:{color:INK.ink,fontSize:16,fontWeight:"800"},
  searchInput:{
    minHeight:52,
    borderColor:INK.ink,
    borderRadius:16,
    borderWidth:1,
    backgroundColor:INK.card,
    color:INK.ink,
    fontSize:16,
    paddingHorizontal:16,
    paddingVertical:12
  },
  filters:{gap:8,paddingBottom:4,paddingTop:12},
  filterChip:{
    minHeight:42,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.hair,
    borderRadius:21,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:15
  },
  filterChipSelected:{borderColor:INK.ink,backgroundColor:INK.ink},
  filterText:{color:INK.inkSoft,fontSize:13,fontWeight:"700"},
  filterTextSelected:{color:INK.paper},
  resultCount:{color:INK.inkSoft,fontSize:13,fontWeight:"700",marginBottom:10,marginTop:12},
  emptyPanel:{
    alignItems:"center",
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    padding:30
  },
  emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"800"},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:6,textAlign:"center"},
  card:{
    borderColor:INK.hair,
    borderRadius:20,
    borderWidth:1,
    backgroundColor:INK.card,
    marginBottom:12,
    padding:18
  },
  cardTop:{gap:10},
  cardCopy:{gap:4},
  typeLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1},
  activityName:{color:INK.ink,fontSize:21,fontWeight:"900",lineHeight:26},
  detail:{color:INK.inkSoft,fontSize:14,lineHeight:20},
  statePill:{alignSelf:"flex-start",color:INK.ink,fontSize:12,fontWeight:"800",backgroundColor:INK.water,borderRadius:14,overflow:"hidden",paddingHorizontal:10,paddingVertical:6},
  reasonLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1,marginBottom:5,marginTop:17},
  reasonInput:{
    minHeight:86,
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
  reasonHelp:{color:INK.inkSoft,fontSize:12,marginTop:6},
  actions:{flexDirection:"row",gap:9,marginTop:16},
  darkButton:{
    minHeight:48,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderRadius:13,
    backgroundColor:INK.ink,
    paddingHorizontal:10,
    paddingVertical:11
  },
  darkButtonText:{color:INK.paper,fontSize:14,fontWeight:"800",textAlign:"center"},
  outlineButton:{
    minHeight:48,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.ink,
    borderRadius:13,
    borderWidth:1,
    backgroundColor:INK.card,
    paddingHorizontal:10,
    paddingVertical:11
  },
  outlineButtonText:{color:INK.ink,fontSize:14,fontWeight:"800",textAlign:"center"},
  pagination:{flexDirection:"row",gap:10,marginTop:8},
  pageButton:{
    minHeight:48,
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    borderColor:INK.ink,
    borderRadius:14,
    borderWidth:1,
    paddingHorizontal:14
  },
  pageButtonText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  pressed:{opacity:0.72},
  disabled:{opacity:0.4}
});
