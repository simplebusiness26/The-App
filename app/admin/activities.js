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

// Publishing, hiding, closing and cancelling clubs and events -- with a reason
// on every change, and no deletions.
//
// A club or an event IS a place-like thing on the map, but this is the admin
// console reading its state out of a table, not the map drawing it. So its
// state is a mono chip on the housing, not `scheduled` amber: the warm ink
// means "something is happening here right now", and "draft" is not that.
//
// The first transition on a row is the affirmative one and takes `exists`;
// everything else is an outline. Cancelling an event is destructive and says so
// in the confirmation, which is where a destructive warning belongs.

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
          eyebrow="Admin activities"
          title="Manage clubs & events"
          meta="Hide, publish, close or cancel activity without deleting its history. Every change needs a reason."
        />

        <View style={styles.body}>
          <View style={styles.typeTabs}>
            {Object.values(TYPES).map((item)=>(
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${item.label}`}
                accessibilityState={{selected:item.key===selectedType}}
                onPress={()=>chooseType(item.key)}
              >
                <Chip label={item.label} selected={item.key===selectedType}/>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading {type.label.toLowerCase()}…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Activities could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading admin activities again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <Field label={`Search this page of ${type.label.toLowerCase()}`}>
                <TextInput
                  accessibilityLabel="Search admin activities"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  placeholder={`Search this page of ${type.label.toLowerCase()}`}
                  placeholderTextColor={INK.readoutFaint}
                  style={fieldInputStyle}
                  value={search}
                />
              </Field>

              {/*
                A horizontal ScrollView in a flex column stretches its children
                to fill the leftover height unless it is pinned -- flexGrow:0,
                flexShrink:0 and a centred content container.
              */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContent}
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

              <SectionRule label={type.label} meta={String(visible.length)}/>

              <Text style={styles.resultCount}>
                {`${visible.length} shown · ${total} total · Page ${page+1} of ${pageCount}`}
              </Text>

              {visible.length===0 ? (
                <Empty
                  glyph="calendar"
                  title="No activities match"
                  instruction="Try another search, state or page."
                />
              ) : visible.map((row)=>{
                const working=workingId===row.id;
                const anotherWorking=workingId!==null && !working;
                const actions=transitions(type,row.status);

                return(
                  <Panel key={row.id} style={styles.card}>
                    <View style={styles.head}>
                      <Text style={styles.headKind}>{type.singular}</Text>
                      <View style={styles.headLine}/>
                      <Text style={styles.headState}>{`State: ${pretty(row.status)}`}</Text>
                    </View>

                    <Text style={styles.activityName} numberOfLines={2}>{row.name}</Text>

                    <KeyValue label="Category" value={row.category || "Unclassified"}/>
                    <KeyValue label="Where" value={row.location || "No location recorded"}/>

                    <Field
                      label="Change reason"
                      hint={`Required · 3–500 characters · ${(reasons[row.id] || "").length}/500`}
                      style={styles.reasonField}
                    >
                      <TextInput
                        accessibilityLabel={`State-change reason for ${row.name}`}
                        editable={!working && !anotherWorking}
                        maxLength={500}
                        multiline
                        onChangeText={(value)=>setReasons((current)=>({...current,[row.id]:value}))}
                        placeholder="Why is this state changing?"
                        placeholderTextColor={INK.readoutFaint}
                        style={[fieldInputStyle,styles.reasonInput]}
                        textAlignVertical="top"
                        value={reasons[row.id] || ""}
                      />
                    </Field>

                    <View style={styles.actions}>
                      {actions.map((action,index)=>(
                        <Action
                          key={action.state}
                          kind={index===0 ? "primary" : "secondary"}
                          glyph={index===0 ? "check" : "eyeOff"}
                          label={action.label}
                          accessibilityLabel={`${action.label} ${row.name}`}
                          loading={working && index===0}
                          disabled={working || anotherWorking}
                          onPress={()=>confirmState(row,action.state,action.label)}
                          style={styles.actionButton}
                        />
                      ))}
                    </View>
                  </Panel>
                );
              })}

              <View style={styles.pagination}>
                <Action
                  kind="secondary"
                  glyph="back"
                  label="Previous"
                  accessibilityLabel="Previous activity page"
                  disabled={page===0}
                  onPress={()=>setPage((current)=>Math.max(0,current-1))}
                  style={styles.pageButton}
                />
                <Action
                  kind="secondary"
                  glyph="forward"
                  label="Next"
                  accessibilityLabel="Next activity page"
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

// Chip carries the look; the Pressable outside carries the label, which Chip
// has no prop for.
function FilterChip({label,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show state ${label}`}
      accessibilityState={{selected}}
      onPress={onPress}
    >
      <Chip label={label} selected={selected}/>
    </Pressable>
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

  typeTabs:{flexDirection:"row",gap:7,marginBottom:8},

  panel:{minHeight:140,alignItems:"center",justifyContent:"center",gap:12,padding:24},
  panelText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md},

  filterScroll:{flexGrow:0,flexShrink:0},
  filterContent:{alignItems:"center",gap:7,paddingVertical:2},

  resultCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  card:{padding:14,marginBottom:11},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headState:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  activityName:{
    color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3
  },

  reasonField:{marginTop:14,marginBottom:2},
  reasonInput:{minHeight:86},

  actions:{flexDirection:"row",gap:9,marginTop:12},
  actionButton:{flex:1},

  pagination:{flexDirection:"row",gap:9,marginTop:6},
  pageButton:{flex:1}
});
