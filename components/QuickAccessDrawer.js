import React,{useCallback,useEffect,useState} from "react";
import {View,Text,Pressable,StyleSheet,ScrollView,Modal,AccessibilityInfo} from "react-native";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {supabase} from "../services/supabase";
import {useDrawer} from "../context/DrawerContext";
import {visibleSections} from "../utils/drawer";
import {INK} from "../utils/tokens";
import {managesAnyListing} from "../utils/permissions";

// Same tested navigation/entitlement data, completely different presentation:
// this is Alex's product index for the capabilities that do not belong in the
// five primary journey destinations.
export default function QuickAccessDrawer(){
  const {open,closeDrawer}=useDrawer();
  const insets=useSafeAreaInsets();
  const [viewer,setViewer]=useState({signedIn:false,isManager:false,isAdmin:false});
  const [notice,setNotice]=useState("");
  const [reduceMotion,setReduceMotion]=useState(false);

  useEffect(()=>{
    let active=true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled)=>{
      if(active) setReduceMotion(!!enabled);
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setViewer({signedIn:false,isManager:false,isAdmin:false});
      setNotice("");
      return;
    }

    const [profileResult,managesResult]=await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id",user.id).maybeSingle(),
      managesAnyListing()
    ]);

    const messages=[];
    if(profileResult.error || !profileResult.data){
      messages.push(
        profileResult.error
          ? "Your account details could not be loaded, so this index may show more than you can open."
          : "No profile was found for this account. Some screens will ask you to finish setting it up."
      );
    }
    if(managesResult.error) messages.push(managesResult.error);

    setNotice(messages.join(" "));
    setViewer({signedIn:true,isAdmin:!!profileResult.data?.is_admin,isManager:managesResult.allowed});
  },[]);

  useEffect(()=>{if(open) load();},[open,load]);

  async function logout(){
    closeDrawer();
    await supabase.auth.signOut();
    router.replace("/");
  }

  function go(route){
    closeDrawer();
    router.push(route);
  }

  const sections=visibleSections(viewer);

  return(
    <Modal
      visible={open}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={closeDrawer}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} accessibilityRole="button" accessibilityLabel="Close quick access" onPress={closeDrawer}/>

        <View style={[styles.panel,{paddingBottom:insets.bottom+16,paddingTop:insets.top+14}]}>
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.kicker}>PRODUCT INDEX</Text>
              <Text style={styles.title}>Everything in Xplorer</Text>
              <Text style={styles.subtitle}>Primary navigation stays focused. The rest of the real product lives here.</Text>
            </View>
            <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="Close quick access" onPress={closeDrawer}>
              <Text style={styles.closeMark}>×</Text>
            </Pressable>
          </View>

          {!!notice && <Text style={styles.notice}>{notice}</Text>}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {sections.map((section,index)=>(
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionNumber}>{String(index+1).padStart(2,"0")}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>

                <View style={styles.sectionRows}>
                  {section.rows.map((row)=>(
                    <Pressable
                      key={row.route || row.action}
                      style={({pressed})=>[styles.row,pressed && styles.rowPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={row.label}
                      onPress={()=>row.action==="logout" ? logout() : go(row.route)}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowLabel}>{row.label}</Text>
                        {!!row.detail && <Text style={styles.rowDetail}>{row.detail}</Text>}
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  backdrop:{flex:1,flexDirection:"row",backgroundColor:"rgba(10,16,32,0.56)"},
  dismissArea:{flex:1},
  panel:{
    width:"90%",maxWidth:420,backgroundColor:INK.navy,
    paddingHorizontal:16,borderTopLeftRadius:28,borderBottomLeftRadius:28
  },
  head:{flexDirection:"row",alignItems:"flex-start",gap:10,marginBottom:14},
  headCopy:{flex:1},
  kicker:{color:INK.brand,fontSize:10,fontWeight:"900",letterSpacing:1.2},
  title:{color:INK.onNavy,fontSize:27,fontWeight:"900",letterSpacing:-0.7,marginTop:5},
  subtitle:{color:INK.onNavySoft,fontSize:12,lineHeight:18,marginTop:5,maxWidth:310},
  close:{width:44,height:44,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:INK.brand},
  closeMark:{fontSize:27,color:INK.navy,lineHeight:31,fontWeight:"800"},
  notice:{backgroundColor:INK.navySoft,borderRadius:15,padding:12,marginBottom:13,fontSize:12,lineHeight:18,color:INK.onNavy},
  scroll:{flex:1},
  scrollContent:{paddingBottom:24},
  section:{marginBottom:19},
  sectionHead:{flexDirection:"row",alignItems:"center",gap:8,marginBottom:8},
  sectionNumber:{color:INK.brand,fontSize:10,fontWeight:"900"},
  sectionTitle:{fontSize:11,fontWeight:"900",color:INK.onNavySoft,textTransform:"uppercase",letterSpacing:1},
  sectionRows:{backgroundColor:INK.navySoft,borderRadius:18,overflow:"hidden"},
  row:{minHeight:54,flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingVertical:11,borderBottomWidth:1,borderBottomColor:INK.navy},
  rowPressed:{backgroundColor:INK.sky},
  rowCopy:{flex:1},
  rowLabel:{fontSize:15,fontWeight:"800",color:INK.onNavy},
  rowDetail:{fontSize:11,lineHeight:16,color:INK.onNavySoft,marginTop:3},
  arrow:{color:INK.brand,fontSize:24,fontWeight:"400",paddingLeft:10}
});
