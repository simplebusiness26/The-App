import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform
} from "react-native";
import {router,usePathname} from "expo-router";
import {useNotifications} from "../context/NotificationContext";
import {useDrawer} from "../context/DrawerContext";

export default function Header(){
  const pathname=usePathname();
  const {unreadCount}=useNotifications();
  const {openDrawer}=useDrawer();

  function goBack(){
    if(pathname==="/") return;

    if(Platform.OS==="web" && typeof window!=="undefined"){
      if(window.history.length>1){
        window.history.back();
      }else{
        router.replace("/");
      }
      return;
    }

    if(router.canGoBack()){
      router.back();
    }else{
      router.replace("/");
    }
  }

  return(
    <View style={styles.container}>
      <View style={styles.sideArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
          onPress={goBack}
        >
          <Text style={styles.icon}>←</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Guestbook</Text>

      <View style={[styles.sideArea,styles.rightArea]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          style={styles.iconButton}
          onPress={()=>router.push("/notifications")}
        >
          <Text style={styles.bell}>🔔</Text>
          {unreadCount>0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount>99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open quick access"
          style={styles.iconButton}
          onPress={openDrawer}
        >
          <Text style={styles.icon}>☰</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{
    height:60,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:12,
    borderBottomWidth:1,
    borderColor:"#ddd"
  },
  sideArea:{
    width:88,
    flexDirection:"row",
    alignItems:"center"
  },
  rightArea:{
    justifyContent:"flex-end"
  },
  iconButton:{
    width:42,
    height:42,
    alignItems:"center",
    justifyContent:"center",
    position:"relative"
  },
  icon:{
    fontSize:28,
    fontWeight:"bold"
  },
  bell:{
    fontSize:22
  },
  badge:{
    position:"absolute",
    top:2,
    right:0,
    minWidth:19,
    height:19,
    borderRadius:10,
    paddingHorizontal:4,
    backgroundColor:"#d92d20",
    alignItems:"center",
    justifyContent:"center",
    borderWidth:2,
    borderColor:"white"
  },
  badgeText:{
    color:"white",
    fontSize:10,
    fontWeight:"bold"
  },
  title:{
    fontSize:22,
    fontWeight:"bold",
    textAlign:"center"
  }
});
