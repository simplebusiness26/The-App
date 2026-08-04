import React,{useEffect,useState} from "react";
import {Text,StyleSheet,Pressable,ScrollView} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";

export default function Menu(){
  // Two independent facts. Collapsing them into one scalar with
  // `is_admin ? "admin" : account_type` meant an admin saw no Explorer links at
  // all, which is not a rule anyone wrote down -- being an admin says nothing
  // about whether you explore.
  const [isExplorer,setIsExplorer]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [loggedIn,setLoggedIn]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{loadUser();},[]);

  async function loadUser(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setLoggedIn(false);
      setIsExplorer(false);
      setIsAdmin(false);
      setNotice("");
      return;
    }

    setLoggedIn(true);

    const {data,error}=await supabase
      .from("profiles")
      .select("account_type,is_admin")
      .eq("id",user.id)
      .maybeSingle();

    if(error || !data){
      // Never let a failed profile read empty the menu. This exact path took
      // eight links off the screen with no error shown, and the menu is not a
      // security boundary -- every destination re-checks the session itself and
      // RLS decides the data. Showing a link the caller cannot use costs them an
      // explanatory screen; showing none leaves them stranded with no way to
      // reach anything and nothing to report.
      setIsExplorer(true);
      setIsAdmin(false);
      setNotice(
        error
          ? "Your account details could not be loaded, so this menu may show more than you can open."
          : "No profile was found for this account. Some screens will ask you to finish setting it up."
      );
      return;
    }

    setNotice("");
    setIsExplorer(data.account_type==="explorer");
    setIsAdmin(!!data.is_admin);
  }

  async function logout(){
    await supabase.auth.signOut();
    router.replace("/");
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Menu</Text>

      {!!notice && (
        <Text style={styles.notice}>{notice}</Text>
      )}

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

      {loggedIn && (
        <Pressable style={styles.settingsItem} onPress={()=>router.push("/settings")}>
          <Text style={styles.text}>⚙️ Settings</Text>
        </Pressable>
      )}

      {isExplorer && (
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

      {isAdmin && (
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
  notice:{backgroundColor:"#3d2f14",color:"#f0d39a",borderRadius:10,padding:13,marginBottom:20,lineHeight:19},
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
  settingsItem:{backgroundColor:"#3f3f46",padding:16,borderRadius:10,marginBottom:15},
  text:{color:"white",fontWeight:"bold",textAlign:"center"},
  logout:{backgroundColor:"#cc0000",padding:16,borderRadius:10,marginTop:20},
  logoutText:{color:"white",fontWeight:"bold",textAlign:"center"}
});
