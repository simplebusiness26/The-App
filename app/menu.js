import React,{useEffect,useState} from "react";
import {Text,StyleSheet,Pressable,ScrollView} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";

export default function Menu(){
  const [userType,setUserType]=useState(null);
  const [loggedIn,setLoggedIn]=useState(false);

  useEffect(()=>{loadUser();},[]);

  async function loadUser(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setLoggedIn(false);
      setUserType(null);
      return;
    }

    setLoggedIn(true);
    const {data}=await supabase
      .from("profiles")
      .select("account_type,is_admin")
      .eq("id",user.id)
      .single();

    if(data) setUserType(data.is_admin ? "admin" : data.account_type);
  }

  async function logout(){
    await supabase.auth.signOut();
    router.replace("/");
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Menu</Text>

      <Pressable style={styles.item} onPress={()=>router.push("/map")}>
        <Text style={styles.text}>🗺 Map</Text>
      </Pressable>

      <Pressable style={styles.activityItem} onPress={()=>router.push("/activity-clubs")}>
        <Text style={styles.text}>🏃 Explore Activity Clubs</Text>
      </Pressable>

      <Pressable style={styles.eventsItem} onPress={()=>router.push("/events")}>
        <Text style={styles.text}>🎉 Explore Events</Text>
      </Pressable>

      {loggedIn && (
        <Pressable style={styles.item} onPress={()=>router.push("/profile")}>
          <Text style={styles.text}>👤 Profile</Text>
        </Pressable>
      )}

      {userType==="explorer" && (
        <>
          <Pressable style={styles.liveItem} onPress={()=>router.push("/live")}>
            <Text style={styles.text}>📡 Live Nearby</Text>
          </Pressable>
          <Pressable style={styles.linkupItem} onPress={()=>router.push("/linkups")}>
            <Text style={styles.text}>🤝 Link-ups</Text>
          </Pressable>
          <Pressable style={styles.checkinItem} onPress={()=>router.push("/checkins/create")}>
            <Text style={styles.text}>📍 Check in</Text>
          </Pressable>
          <Pressable style={styles.feedItem} onPress={()=>router.push("/feed")}>
            <Text style={styles.text}>✨ Explorer Feed</Text>
          </Pressable>
          <Pressable style={styles.discoveryItem} onPress={()=>router.push("/explorers")}>
            <Text style={styles.text}>🧭 Find Explorers</Text>
          </Pressable>
          <Pressable style={styles.scanItem} onPress={()=>router.push("/scan")}>
            <Text style={styles.text}>📷 Scan Verified Review QR</Text>
          </Pressable>
          <Pressable style={styles.leaderboardItem} onPress={()=>router.push("/leaderboards")}>
            <Text style={styles.text}>🏆 Explorer Leaderboards</Text>
          </Pressable>
          <Pressable style={styles.safetyItem} onPress={()=>router.push("/safety/blocked")}>
            <Text style={styles.text}>🛡️ Blocked Explorers</Text>
          </Pressable>
        </>
      )}

      {loggedIn && (
        <Pressable style={styles.managerItem} onPress={()=>router.push("/manager/dashboard")}>
          <Text style={styles.text}>📊 Manager Dashboard</Text>
        </Pressable>
      )}

      {userType==="admin" && (
        <Pressable style={styles.item} onPress={()=>router.push("/admin/claims")}>
          <Text style={styles.text}>⚙️ Admin Dashboard</Text>
        </Pressable>
      )}

      {!loggedIn && (
        <>
          <Pressable style={styles.item} onPress={()=>router.push("/auth/login")}>
            <Text style={styles.text}>Login</Text>
          </Pressable>
          <Pressable style={styles.item} onPress={()=>router.push("/auth/signup")}>
            <Text style={styles.text}>Create Account</Text>
          </Pressable>
        </>
      )}

      {loggedIn && (
        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1},
  content:{padding:30,paddingBottom:50},
  title:{fontSize:32,fontWeight:"bold",marginBottom:30},
  item:{backgroundColor:"#222",padding:16,borderRadius:10,marginBottom:15},
  activityItem:{backgroundColor:"#5633a8",padding:16,borderRadius:10,marginBottom:15},
  eventsItem:{backgroundColor:"#8a3ffc",padding:16,borderRadius:10,marginBottom:15},
  liveItem:{backgroundColor:"#164f6d",padding:16,borderRadius:10,marginBottom:15},
  linkupItem:{backgroundColor:"#3212b6",padding:16,borderRadius:10,marginBottom:15},
  checkinItem:{backgroundColor:"#116246",padding:16,borderRadius:10,marginBottom:15},
  feedItem:{backgroundColor:"#3212b6",padding:16,borderRadius:10,marginBottom:15},
  discoveryItem:{backgroundColor:"#3b2477",padding:16,borderRadius:10,marginBottom:15},
  scanItem:{backgroundColor:"#0c6b45",padding:16,borderRadius:10,marginBottom:15},
  leaderboardItem:{backgroundColor:"#72520d",padding:16,borderRadius:10,marginBottom:15},
  safetyItem:{backgroundColor:"#5c2630",padding:16,borderRadius:10,marginBottom:15},
  managerItem:{backgroundColor:"#275bd6",padding:16,borderRadius:10,marginBottom:15},
  text:{color:"white",fontWeight:"bold",textAlign:"center"},
  logout:{backgroundColor:"#cc0000",padding:16,borderRadius:10,marginTop:20},
  logoutText:{color:"white",fontWeight:"bold",textAlign:"center"}
});
