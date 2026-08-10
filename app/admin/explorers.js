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
import {INK} from "../../utils/tokens";

const PAGE_SIZE=25;
const PROFILE_COLUMNS="id,full_name,is_admin,account_type";
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
      <Text style={styles.eyebrow}>ADMIN EXPLORERS</Text>
      <Text style={styles.title}>Explorer directory</Text>
      <Text style={styles.intro}>
        Inspect account identity and active Manager capabilities without exposing contact or private-location fields.
      </Text>

      {loading ? (
        <View style={styles.panel}>
          <ActivityIndicator size="small" color={INK.ink}/>
          <Text style={styles.panelText}>Loading Explorers…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorPanel} accessibilityRole="alert">
          <Text style={styles.errorTitle}>Explorers could not be loaded</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading the Explorer directory again"
            onPress={load}
            style={({pressed})=>[styles.primaryButton,pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search Explorer directory"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search names on this page"
            placeholderTextColor={INK.inkSoft}
            style={styles.searchInput}
            value={search}
          />

          <View style={styles.filters}>
            {[
              {key:"all",label:"All"},
              {key:"managers",label:"Managers"},
              {key:"admins",label:"Admins"}
            ].map((item)=>{
              const selected=item.key===filter;
              return(
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${item.label} in Explorer directory`}
                  accessibilityState={{selected}}
                  onPress={()=>setFilter(item.key)}
                  style={({pressed})=>[
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.filterText,selected && styles.filterTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.resultCount}>
            {`${visible.length} shown · ${total} Explorers · Page ${page+1} of ${pageCount}`}
          </Text>

          {visible.length===0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No Explorers match</Text>
              <Text style={styles.emptyText}>Try another name, filter or page.</Text>
            </View>
          ) : visible.map((explorer)=>{
            const name=explorer.full_name || "Unnamed Explorer";
            return(
              <Pressable
                key={explorer.id}
                accessibilityRole="button"
                accessibilityLabel={`Open Explorer profile for ${name}`}
                onPress={()=>router.push(`/profile/${explorer.id}`)}
                style={({pressed})=>[styles.card,pressed && styles.pressed]}
              >
                <View style={styles.cardCopy}>
                  <Text style={styles.typeLabel}>EXPLORER</Text>
                  <Text style={styles.name}>{name}</Text>
                  {explorer.is_admin && <Text style={styles.adminLabel}>Administrator account</Text>}
                  <Text style={styles.capabilityText}>
                    {explorer.capabilities.length
                      ? `Manager capabilities: ${explorer.capabilities.map(pretty).join(", ")}`
                      : "No active Manager capabilities"
                    }
                  </Text>
                </View>
                <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
              </Pressable>
            );
          })}

          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous Explorer page"
              disabled={page===0}
              onPress={()=>setPage((current)=>Math.max(0,current-1))}
              style={({pressed})=>[styles.pageButton,pressed && styles.pressed,page===0 && styles.disabled]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next Explorer page"
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
  primaryButtonText:{color:INK.paper,fontSize:16,fontWeight:"800"},
  searchInput:{minHeight:52,borderColor:INK.ink,borderRadius:16,borderWidth:1,backgroundColor:INK.card,color:INK.ink,fontSize:16,paddingHorizontal:16,paddingVertical:12},
  filters:{flexDirection:"row",gap:8,marginTop:12},
  filterChip:{minHeight:42,alignItems:"center",justifyContent:"center",borderColor:INK.hair,borderRadius:21,borderWidth:1,backgroundColor:INK.card,paddingHorizontal:15},
  filterChipSelected:{borderColor:INK.ink,backgroundColor:INK.ink},
  filterText:{color:INK.inkSoft,fontSize:13,fontWeight:"700"},
  filterTextSelected:{color:INK.paper},
  resultCount:{color:INK.inkSoft,fontSize:13,fontWeight:"700",marginBottom:10,marginTop:13},
  emptyPanel:{alignItems:"center",borderColor:INK.hair,borderRadius:20,borderWidth:1,backgroundColor:INK.card,padding:30},
  emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"800"},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:6,textAlign:"center"},
  card:{minHeight:104,flexDirection:"row",alignItems:"center",borderColor:INK.hair,borderRadius:18,borderWidth:1,backgroundColor:INK.card,marginBottom:10,padding:17},
  cardCopy:{flex:1,paddingRight:10},
  typeLabel:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1},
  name:{color:INK.ink,fontSize:20,fontWeight:"900",marginTop:4},
  adminLabel:{alignSelf:"flex-start",color:INK.ink,fontSize:12,fontWeight:"800",backgroundColor:INK.water,borderRadius:12,overflow:"hidden",marginTop:7,paddingHorizontal:9,paddingVertical:5},
  capabilityText:{color:INK.inkSoft,fontSize:13,lineHeight:19,marginTop:7},
  arrow:{color:INK.ink,fontSize:32,fontWeight:"300"},
  pagination:{flexDirection:"row",gap:10,marginTop:8},
  pageButton:{minHeight:48,flex:1,alignItems:"center",justifyContent:"center",borderColor:INK.ink,borderRadius:14,borderWidth:1,paddingHorizontal:14},
  pageButtonText:{color:INK.ink,fontSize:14,fontWeight:"800"},
  pressed:{opacity:0.72},
  disabled:{opacity:0.4}
});
