import React,{useCallback,useMemo,useState} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
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
  Glyph,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// The Explorer directory: who exists, and what they are allowed to run.
//
// It carries no contact or private-location fields on purpose, so the only
// things on a row are an identity and a set of capabilities the app worked out
// -- one sentence a person owns, one reading the app took.

const PAGE_SIZE=25;
const PROFILE_COLUMNS="id,full_name,is_admin";
const CAPABILITY_COLUMNS="user_id,businesses_status,properties_status,activity_clubs_status,events_status";
const CAPABILITIES=["businesses","properties","activity_clubs","events"];

function activeCapabilities(row){
  if(!row) return[];
  return CAPABILITIES.filter((capability)=>
    ["active","trial"].includes(row[`${capability}_status`])
  );
}

function pretty(value){
  return String(value || "")
    .replace(/_/g," ")
    .replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

// Chip carries the look; the Pressable outside carries the label the console
// was built with, which Chip has no prop for.
function Filter({label,accessibilityLabel,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected}}
      onPress={onPress}
    >
      <Chip label={label} selected={selected}/>
    </Pressable>
  );
}

export default function AdminExplorers(){
  const insets=useSafeAreaInsets();
  const {checking,allowed,error:gateError}=useAdminGate();
  const [explorers,setExplorers]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!allowed) return;

    setLoading(true);
    setError("");
    setExplorers([]);

    try{
      const from=page*PAGE_SIZE;
      const {data:profiles,count,error:profileError}=await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS,{count:"exact"})
        .order("full_name",{ascending:true})
        .range(from,from+PAGE_SIZE-1);

      if(profileError || !Array.isArray(profiles) || typeof count!=="number"){
        throw new Error(profileError?.message || "The Explorer page was not returned.");
      }

      const ids=profiles.map((profile)=>profile.id);
      const capabilityResult=ids.length
        ? await supabase
          .from("manager_capabilities")
          .select(CAPABILITY_COLUMNS)
          .in("user_id",ids)
        : {data:[],error:null};

      if(capabilityResult.error || !Array.isArray(capabilityResult.data)){
        throw new Error(capabilityResult.error?.message || "Manager capabilities were not returned.");
      }

      const capabilities=new Map(capabilityResult.data.map((row)=>[row.user_id,row]));
      setExplorers(profiles.map((profile)=>({
        ...profile,
        capabilities:activeCapabilities(capabilities.get(profile.id))
      })));
      setTotal(count);
    }catch(loadError){
      setError(loadError?.message || "Explorers could not be loaded.");
    }finally{
      setLoading(false);
    }
  },[allowed,page]);

  useFocusEffect(useCallback(()=>{
    load();
  },[load]));

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return explorers.filter((explorer)=>{
      const searchMatches=!term || String(explorer.full_name || "").toLowerCase().includes(term);
      const filterMatches=filter==="all"
        || (filter==="admins" && explorer.is_admin)
        || (filter==="managers" && explorer.capabilities.length>0);
      return searchMatches && filterMatches;
    });
  },[explorers,filter,search]);

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
          eyebrow="Admin explorers"
          title="Explorer directory"
          meta="Inspect account identity and active Manager capabilities without exposing contact or private-location fields."
        />

        <View style={styles.body}>
          {loading ? (
            <Panel style={styles.panel}>
              <ActivityIndicator size="small" color={INK.readout}/>
              <Text style={styles.panelText}>Loading Explorers…</Text>
            </Panel>
          ) : error ? (
            <View accessibilityRole="alert">
              <Notice
                tone="exists"
                label="Explorers could not be loaded"
                action={
                  <Action
                    kind="secondary"
                    glyph="refresh"
                    label="Try again"
                    accessibilityLabel="Try loading the Explorer directory again"
                    onPress={load}
                  />
                }
              >
                {error}
              </Notice>
            </View>
          ) : (
            <>
              <Field label="Search names on this page">
                <TextInput
                  accessibilityLabel="Search Explorer directory"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  placeholder="Search names on this page"
                  placeholderTextColor={INK.readoutFaint}
                  style={fieldInputStyle}
                  value={search}
                />
              </Field>

              <View style={styles.filters}>
                {[
                  {key:"all",label:"All"},
                  {key:"managers",label:"Managers"},
                  {key:"admins",label:"Admins"}
                ].map((item)=>(
                  <Filter
                    key={item.key}
                    label={item.label}
                    accessibilityLabel={`Show ${item.label} in Explorer directory`}
                    selected={item.key===filter}
                    onPress={()=>setFilter(item.key)}
                  />
                ))}
              </View>

              <SectionRule label="Explorers" meta={String(visible.length)}/>

              <Text style={styles.resultCount}>
                {`${visible.length} shown · ${total} Explorers · Page ${page+1} of ${pageCount}`}
              </Text>

              {visible.length===0 ? (
                <Empty
                  glyph="people"
                  title="No Explorers match"
                  instruction="Try another name, filter or page."
                />
              ) : visible.map((explorer)=>{
                const name=explorer.full_name || "Unnamed Explorer";
                return(
                  <Pressable
                    key={explorer.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open Explorer profile for ${name}`}
                    onPress={()=>router.push(`/profile/${explorer.id}`)}
                    style={({pressed})=>pressed ? styles.pressed : null}
                  >
                    <Row
                      glyph="person"
                      title={name}
                      sub={explorer.capabilities.length
                        ? `Manager capabilities: ${explorer.capabilities.map(pretty).join(", ")}`
                        : "No active Manager capabilities"}
                      meta={explorer.is_admin ? "Admin" : undefined}
                      right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
                    >
                      {explorer.is_admin && (
                        <Text style={styles.adminLabel}>Administrator account</Text>
                      )}
                    </Row>
                  </Pressable>
                );
              })}

              <View style={styles.pagination}>
                <Action
                  kind="secondary"
                  glyph="back"
                  label="Previous"
                  accessibilityLabel="Previous Explorer page"
                  disabled={page===0}
                  onPress={()=>setPage((current)=>Math.max(0,current-1))}
                  style={styles.pageButton}
                />
                <Action
                  kind="secondary"
                  glyph="forward"
                  label="Next"
                  accessibilityLabel="Next Explorer page"
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

  filters:{flexDirection:"row",flexWrap:"wrap",gap:7},
  resultCount:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginBottom:10},

  adminLabel:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm,marginTop:5},

  pagination:{flexDirection:"row",gap:9,marginTop:6},
  pageButton:{flex:1},
  pressed:{opacity:0.78}
});
