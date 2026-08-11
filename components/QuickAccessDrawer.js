import React,{useCallback,useEffect,useState} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  AccessibilityInfo
} from "react-native";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {supabase} from "../services/supabase";
import {useDrawer} from "../context/DrawerContext";
import {visibleSections} from "../utils/drawer";
import {INK} from "../utils/tokens";
import {managesAnyListing} from "../utils/permissions";

// Packet 4: the Quick Access drawer. Replaces the /menu page.
//
// It fails open. If the profile read or the entitlement call fails, the drawer
// shows what it can and says the rest may be wrong -- it never renders empty
// and silent. That rule is not a preference: a build once selected a profiles
// column that did not exist, every role flag stayed false, and ten links
// vanished from the menu with no error shown. The menu is not a security
// boundary, so showing a link the caller cannot use costs them one explanatory
// screen, while showing none strands them with nothing to report.

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
          ? "Your account details could not be loaded, so this menu may show more than you can open."
          : "No profile was found for this account. Some screens will ask you to finish setting it up."
      );
    }
    if(managesResult.error) messages.push(managesResult.error);

    setNotice(messages.join(" "));
    setViewer({
      signedIn:true,
      isAdmin:!!profileResult.data?.is_admin,
      isManager:managesResult.allowed
    });
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
      // "Sheets slide. prefers-reduced-motion: reduce disables all of it."
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={closeDrawer}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismissArea}
          accessibilityRole="button"
          accessibilityLabel="Close quick access"
          onPress={closeDrawer}
        />

        <View style={[styles.panel,{paddingBottom:insets.bottom+16,paddingTop:insets.top+14}]}>
          <View style={styles.head}>
            <Text style={styles.title}>Quick access</Text>
            <Pressable
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close quick access"
              onPress={closeDrawer}
            >
              <Text style={styles.closeMark}>×</Text>
            </Pressable>
          </View>

          {!!notice && <Text style={styles.notice}>{notice}</Text>}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {sections.map((section)=>(
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>

                {section.rows.map((row)=>(
                  <Pressable
                    key={row.route || row.action}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                    onPress={()=>row.action==="logout" ? logout() : go(row.route)}
                  >
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    {!!row.detail && <Text style={styles.rowDetail}>{row.detail}</Text>}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  backdrop:{flex:1,flexDirection:"row",backgroundColor:"rgba(22,24,28,0.4)"},
  dismissArea:{flex:1},
  panel:{
    width:"86%",
    maxWidth:380,
    backgroundColor:INK.paper,
    borderLeftWidth:2,
    borderLeftColor:INK.ink,
    paddingHorizontal:16
  },
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},
  title:{fontSize:24,fontWeight:"800",letterSpacing:-0.4,color:INK.ink},
  // 44px tap target even though the mark is smaller.
  close:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  closeMark:{fontSize:30,color:INK.ink,lineHeight:34},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:12,
    marginBottom:12,
    fontSize:13,
    lineHeight:19,
    color:INK.ink
  },
  scroll:{flex:1},
  scrollContent:{paddingBottom:20},
  section:{marginBottom:18},
  sectionTitle:{
    fontSize:12,
    fontWeight:"800",
    color:INK.inkSoft,
    marginBottom:8,
    textTransform:"uppercase",
    letterSpacing:1
  },
  row:{
    minHeight:48,
    justifyContent:"center",
    borderBottomWidth:1,
    borderBottomColor:INK.hair,
    paddingVertical:11
  },
  rowLabel:{fontSize:16,fontWeight:"600",color:INK.ink},
  rowDetail:{fontSize:12,lineHeight:17,color:INK.inkSoft,marginTop:3}
});
