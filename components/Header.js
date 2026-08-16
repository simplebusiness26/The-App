import React from "react";
import {View,Text,Pressable,StyleSheet,Platform} from "react-native";
import {router,usePathname} from "expo-router";
import {SafeAreaInsetsContext} from "react-native-safe-area-context";
import {useNotifications} from "../context/NotificationContext";
import {useDrawer} from "../context/DrawerContext";
import {activeTabKey,isRootScreen} from "../utils/navigation";
import {INK} from "../utils/tokens";

// Alex challenger: contextual floating controls rather than a screen-wide bar.
// The hierarchy is Alex's, while preserving the owner's explicit requirement
// that the header must not push a coloured strip across every page.
export const HEADER_HEIGHT=60;

export function useHeaderClearance(){
  const insets=React.useContext(SafeAreaInsetsContext);
  return HEADER_HEIGHT+(insets?.top || 0);
}

const CONTEXT={
  explore:{label:"Explore",hint:"Choose what fits"},
  now:{label:"Now",hint:"What you can join"},
  map:{label:"Map",hint:"Move into the world"},
  inbox:{label:"Inbox",hint:"Keep plans connected"},
  you:{label:"You",hint:"Identity & reflection"}
};

export default function Header(){
  const pathname=usePathname();
  const {unreadCount}=useNotifications();
  const {openDrawer}=useDrawer();
  const insets=React.useContext(SafeAreaInsetsContext);
  const canGoBack=!isRootScreen(pathname);
  const context=CONTEXT[activeTabKey(pathname)] || {label:"Xplorer",hint:"Local life, in context"};

  function goBack(){
    if(!canGoBack) return;
    if(Platform.OS==="web" && typeof window!=="undefined"){
      if(window.history.length>1) window.history.back();
      else router.replace("/");
      return;
    }
    if(router.canGoBack()) router.back();
    else router.replace("/");
  }

  return(
    <View style={[styles.container,{paddingTop:insets?.top || 0}]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canGoBack ? "Go back" : "Xplorer"}
          style={[styles.leading,canGoBack && styles.leadingBack]}
          onPress={canGoBack ? goBack : undefined}
        >
          <Text style={[styles.leadingText,canGoBack && styles.backText]}>{canGoBack ? "←" : "X"}</Text>
        </Pressable>

        <View style={styles.context} pointerEvents="none">
          <Text style={styles.contextLabel}>{context.label}</Text>
          <Text style={styles.contextHint} numberOfLines={1}>{context.hint}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            style={[styles.chip,styles.action]}
            onPress={()=>router.push("/notifications")}
          >
            <Text style={styles.actionGlyph}>●</Text>
            {unreadCount>0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount>99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open quick access"
            style={[styles.chip,styles.menuAction]}
            onPress={openDrawer}
          >
            <Text style={styles.menuText}>Menu</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{minHeight:HEADER_HEIGHT,paddingHorizontal:10,paddingBottom:6},
  row:{minHeight:54,flexDirection:"row",alignItems:"center",gap:8},
  leading:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:INK.brand},
  leadingBack:{backgroundColor:INK.navy},
  leadingText:{color:INK.navy,fontSize:17,fontWeight:"900"},
  backText:{color:INK.onNavy,fontSize:23,lineHeight:26},
  context:{flex:1,minWidth:0,minHeight:46,justifyContent:"center",paddingHorizontal:13,borderRadius:16,backgroundColor:INK.navy},
  contextLabel:{color:INK.onNavy,fontSize:14,fontWeight:"900",letterSpacing:-0.2},
  contextHint:{color:INK.onNavySoft,fontSize:9,fontWeight:"700",marginTop:1},
  actions:{flexDirection:"row",alignItems:"center",gap:6},
  chip:{backgroundColor:INK.card,borderRadius:14},
  action:{width:42,height:42,alignItems:"center",justifyContent:"center",position:"relative"},
  actionGlyph:{color:INK.brandDeep,fontSize:15,fontWeight:"900"},
  badge:{position:"absolute",top:-3,right:-3,minWidth:19,height:19,borderRadius:10,paddingHorizontal:4,alignItems:"center",justifyContent:"center",backgroundColor:INK.brand,borderWidth:2,borderColor:INK.card},
  badgeText:{color:INK.navy,fontSize:9,fontWeight:"900"},
  menuAction:{minHeight:42,justifyContent:"center",paddingHorizontal:12},
  menuText:{color:INK.navy,fontSize:12,fontWeight:"900"}
});