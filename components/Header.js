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
import {INK} from "../utils/tokens";
import {signedIn} from "../utils/permissions";

export default function Header(){
  const pathname=usePathname();
  const {unreadCount}=useNotifications();
  const {openDrawer}=useDrawer();

  // The one always-visible way in for somebody without an account. It sits in
  // the space the product name used to occupy, and disappears the moment there
  // is a session -- a Log In button on a logged-in screen is noise.
  const [showLogIn,setShowLogIn]=React.useState(false);

  React.useEffect(()=>{
    let active=true;
    signedIn().then(({user})=>{
      if(active) setShowLogIn(!user);
    });
    return()=>{active=false;};
  },[pathname]);

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

      {/*
        No product name here. The screen beneath says what it is, and a name
        repeated on all 77 screens is a wordmark, not navigation. The middle
        stays empty on purpose -- it is what keeps the two side areas equal
        and the back arrow where the thumb expects it.
      */}
      <View style={styles.titleArea}>
        {showLogIn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log in"
            style={styles.logIn}
            onPress={()=>router.push("/auth/login")}
          >
            <Text style={styles.logInText}>Log in</Text>
          </Pressable>
        )}
      </View>

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

// Every colour here comes from utils/tokens.js. The design system's rule is
// "never introduce a colour outside this list", and the three inks -- blue,
// pink, yellow -- are excluded on purpose: they mean a state a place is in, and
// nothing in the navigation shell is a place. See the note in utils/tokens.js.
const styles=StyleSheet.create({
  container:{
    height:60,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:12,
    backgroundColor:INK.card,
    // 2px, not 1px: the borders are the print register, not a hairline.
    borderBottomWidth:2,
    borderColor:INK.ink
  },
  sideArea:{
    width:88,
    flexDirection:"row",
    alignItems:"center"
  },
  titleArea:{
    flex:1,
    alignItems:"center",
    justifyContent:"center"
  },
  logIn:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:6,
    backgroundColor:INK.paper
  },
  logInText:{
    color:INK.ink,
    fontWeight:"700",
    fontSize:13
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
    fontWeight:"bold",
    color:INK.ink
  },
  bell:{
    fontSize:22
  },
  // The unread badge was red (#d92d20), which is not a colour in the table. It
  // is also not one of the three inks: a count of unread notifications is not a
  // state a place is in, so borrowing pink for it would be exactly the
  // decorative use the design system forbids. Ink on card, bordered like every
  // other raised shape.
  badge:{
    position:"absolute",
    top:2,
    right:0,
    minWidth:19,
    height:19,
    borderRadius:99,
    paddingHorizontal:4,
    backgroundColor:INK.ink,
    alignItems:"center",
    justifyContent:"center",
    borderWidth:2,
    borderColor:INK.card
  },
  badgeText:{
    color:INK.card,
    fontSize:10,
    fontWeight:"bold"
  }
});
