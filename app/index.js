import React,{useEffect,useState} from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import {useNotifications} from "../context/NotificationContext";
import {useDrawer} from "../context/DrawerContext";

const HOME_LAYOUT_VERSION="compact-v2";

export default function Home(){
  const {unreadCount}=useNotifications();
  const {openDrawer}=useDrawer();
  const [loggedIn,setLoggedIn]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    checkUser();

    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
      checkUser();
    });

    return()=>subscription.unsubscribe();
  },[]);

  async function checkUser(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setLoggedIn(false);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoggedIn(true);

    const {data:profile,error}=await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id",user.id)
      .single();

    setIsAdmin(!error && !!profile?.is_admin);
    setLoading(false);
  }

  if(loading){
    return(
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white"/>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={styles.content}
        testID={`home-${HOME_LAYOUT_VERSION}`}
      >
        <View style={styles.brand}>
          <Text style={styles.title}>Xplorer</Text>
          <Text style={styles.subtitle}>
            Discover local places, stays and experiences.
          </Text>
        </View>

        {loggedIn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount
              ? `${unreadCount} unread notifications`
              : "Notifications"
            }
            style={styles.notificationsButton}
            onPress={()=>router.push("/notifications")}
          >
            <View style={styles.buttonLabelRow}>
              <Text style={styles.buttonIcon}>🔔</Text>
              <Text style={styles.secondaryButtonText}>Notifications</Text>
            </View>

            {unreadCount>0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount>99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.actionButton,styles.eventsButton]}
          onPress={()=>router.push("/events")}
        >
          <Text style={styles.buttonIcon}>🎉</Text>
          <Text style={styles.primaryButtonText}>Explore Events</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton,styles.mapButton]}
          onPress={()=>router.push("/map")}
        >
          <Text style={styles.buttonIcon}>🗺️</Text>
          <Text style={styles.primaryButtonText}>Explore Map</Text>
        </Pressable>

        {loggedIn ? (
          <Pressable
            style={[styles.actionButton,styles.menuButton]}
            onPress={openDrawer}
          >
            <Text style={styles.buttonIcon}>☰</Text>
            <Text style={styles.primaryButtonText}>Quick access</Text>
          </Pressable>
        ) : (
          <View style={styles.authRow}>
            <Pressable
              style={[styles.authButton,styles.loginButton]}
              onPress={()=>router.push("/auth/login")}
            >
              <Text style={styles.authButtonText}>Log in</Text>
            </Pressable>

            <Pressable
              style={[styles.authButton,styles.signupButton]}
              onPress={()=>router.push("/auth/signup")}
            >
              <Text style={styles.authButtonText}>Create account</Text>
            </Pressable>
          </View>
        )}

        {isAdmin && (
          <Pressable
            style={[styles.actionButton,styles.adminButton]}
            onPress={()=>router.push("/admin/dashboard")}
          >
            <Text style={styles.buttonIcon}>⚙️</Text>
            <Text style={styles.primaryButtonText}>Admin Dashboard</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{
    flex:1,
    backgroundColor:"#19191b"
  },
  loadingContainer:{
    flex:1,
    backgroundColor:"#19191b",
    alignItems:"center",
    justifyContent:"center"
  },
  container:{
    flexGrow:1,
    alignItems:"center",
    justifyContent:"center",
    paddingHorizontal:22,
    paddingTop:34,
    paddingBottom:40
  },
  content:{
    width:"100%",
    maxWidth:480
  },
  brand:{
    alignItems:"center",
    marginBottom:36
  },
  title:{
    color:"white",
    fontSize:44,
    lineHeight:52,
    fontWeight:"800",
    letterSpacing:-1,
    textAlign:"center"
  },
  subtitle:{
    color:"#c5c5ca",
    fontSize:17,
    lineHeight:24,
    marginTop:10,
    maxWidth:330,
    textAlign:"center"
  },
  notificationsButton:{
    width:"100%",
    minHeight:60,
    paddingHorizontal:18,
    paddingVertical:14,
    borderRadius:14,
    marginBottom:14,
    backgroundColor:"#262629",
    borderWidth:1,
    borderColor:"#45454a",
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between"
  },
  buttonLabelRow:{
    flexDirection:"row",
    alignItems:"center"
  },
  notificationBadge:{
    minWidth:30,
    height:30,
    paddingHorizontal:8,
    borderRadius:15,
    backgroundColor:"#b00000",
    alignItems:"center",
    justifyContent:"center"
  },
  notificationBadgeText:{
    color:"white",
    fontSize:14,
    fontWeight:"bold"
  },
  actionButton:{
    width:"100%",
    minHeight:64,
    paddingHorizontal:18,
    paddingVertical:15,
    borderRadius:14,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    marginBottom:14
  },
  eventsButton:{
    backgroundColor:"#2410a5"
  },
  mapButton:{
    backgroundColor:"#0d2fc5"
  },
  menuButton:{
    backgroundColor:"#080809",
    borderWidth:1,
    borderColor:"#303034"
  },
  adminButton:{
    backgroundColor:"#5c18a8",
    marginTop:2
  },
  buttonIcon:{
    fontSize:20,
    marginRight:10
  },
  primaryButtonText:{
    color:"white",
    fontSize:18,
    fontWeight:"700",
    textAlign:"center"
  },
  secondaryButtonText:{
    color:"white",
    fontSize:17,
    fontWeight:"700"
  },
  authRow:{
    width:"100%",
    flexDirection:"row",
    marginTop:2
  },
  authButton:{
    flex:1,
    minHeight:58,
    borderRadius:14,
    alignItems:"center",
    justifyContent:"center",
    paddingHorizontal:10
  },
  loginButton:{
    backgroundColor:"#080809",
    borderWidth:1,
    borderColor:"#303034",
    marginRight:7
  },
  signupButton:{
    backgroundColor:"#29292d",
    borderWidth:1,
    borderColor:"#48484e",
    marginLeft:7
  },
  authButtonText:{
    color:"white",
    fontSize:16,
    fontWeight:"700",
    textAlign:"center"
  }
});