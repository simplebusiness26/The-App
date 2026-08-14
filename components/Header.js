import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform
} from "react-native";
import {router,usePathname} from "expo-router";
import {SafeAreaInsetsContext} from "react-native-safe-area-context";
import {useNotifications} from "../context/NotificationContext";
import {useDrawer} from "../context/DrawerContext";
import {isRootScreen} from "../utils/navigation";
import {INK} from "../utils/tokens";

// The header, rebuilt.
//
// WHAT WAS WRONG WITH IT
//
// The owner: "the header is the ugliest part of the app... I dislike how it
// drops the whole page down, very old school."
//
// It was a 60px card-coloured bar with a 2px border, in the layout flow, on
// every screen -- including the map, where it pushed the search box off the map
// and left a strip of nothing above it. And it carried a back arrow on all 77
// screens, including the five you cannot go back from.
//
// WHAT IT IS NOW
//
// No bar. Three floating controls on a transparent ground, each in its own
// bordered chip so it stays readable over a map, a photograph or a page.
//
//   Back      only on a child page. Never on the five tab roots or the splash
//             -- see isRootScreen() in utils/navigation.js for why.
//   Bell      always, with its unread count.
//   Hamburger always. The owner asked for it in as many words.
//
// AND NOT A LOG IN BUTTON. There was one here as well as the pair in
// components/FloatingLogin.js, so a signed-out visitor saw "Log in" twice at
// once -- the owner's "look at the logins and the buttons in the way".
//
// The pair won because it carries CREATE ACCOUNT too, and this could not: a
// header has room for one word, and of the two, signing up is the one a first
// visitor needs. It also sits where a thumb reaches.
//
// On the map and the camera it floats OVER the screen (headerFloatsOver()); on
// a page it sits above the content, but as three chips rather than a bar, so
// nothing is covered and nothing looks bolted on.

// What app/_layout.js reserves on a screen the header does not float over.
export const HEADER_HEIGHT=56;

// How far down a screen has to start to clear the floating header.
//
// useSafeAreaInsets() THROWS when there is no SafeAreaProvider above it, and a
// screen has no business crashing over a missing provider -- three test files
// render the map screen on its own and all three went down at once. The context
// is read directly so a missing provider means "no inset", which is the honest
// answer rather than an exception.
export function useHeaderClearance(){
  const insets=React.useContext(SafeAreaInsetsContext);
  return HEADER_HEIGHT+(insets?.top || 0);
}

export default function Header(){
  const pathname=usePathname();
  const {unreadCount}=useNotifications();
  const {openDrawer}=useDrawer();
  const insets=React.useContext(SafeAreaInsetsContext);

  // A tab root is somewhere you live, not somewhere you leave. The tab bar
  // moves you between the five; an arrow pointing at whatever you happened to
  // look at before is not "back" in any sense somebody means it.
  const canGoBack=!isRootScreen(pathname);

  function goBack(){
    if(!canGoBack) return;

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
    <View
      style={[styles.container,{paddingTop:insets?.top || 0}]}
      // The gaps between the chips belong to whatever is underneath -- the map
      // pans through them, a page scrolls through them.
      pointerEvents="box-none"
    >
      <View style={styles.side} pointerEvents="box-none">
        {canGoBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.chip}
            hitSlop={8}
            onPress={goBack}
          >
            <Text style={styles.icon}>←</Text>
          </Pressable>
        )}
      </View>

      {/*
        Empty on purpose. No product name -- the screen beneath says what it is,
        and a name repeated on all 77 screens is a wordmark, not navigation --
        and no Log in, which lives with Create account in
        components/FloatingLogin.js. This keeps the two side areas apart so the
        back arrow stays where a thumb expects it.
      */}
      <View style={styles.middle} pointerEvents="none"/>

      <View style={[styles.side,styles.right]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          style={styles.chip}
          hitSlop={8}
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
          style={styles.chip}
          hitSlop={8}
          onPress={openDrawer}
        >
          <Text style={styles.icon}>☰</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Every colour here comes from utils/tokens.js. The three inks -- blue, pink,
// yellow -- are excluded on purpose: they mean a state a place is in, and
// nothing in the navigation shell is a place.
const styles=StyleSheet.create({
  container:{
    flexDirection:"row",
    alignItems:"flex-start",
    justifyContent:"space-between",
    paddingHorizontal:10,
    paddingBottom:6,
    // NO backgroundColor and NO border. That bar was the complaint. Each
    // control carries its own ground instead, which is what lets the header sit
    // over a map without a strip of card across the top of it.
    minHeight:HEADER_HEIGHT
  },
  side:{
    minWidth:44,
    flexDirection:"row",
    alignItems:"center",
    gap:8
  },
  right:{justifyContent:"flex-end"},
  middle:{flex:1,alignItems:"center",justifyContent:"center",paddingTop:2},
  // A chip, not a bare glyph. An arrow drawn straight onto a photograph or a
  // dark map tile is unreadable, and the design system's answer to "readable
  // over anything" is a bordered shape on card -- the same shape a pin uses.
  chip:{
    width:40,
    height:40,
    borderRadius:20,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    position:"relative"
  },
  icon:{
    fontSize:22,
    fontWeight:"bold",
    color:INK.ink,
    lineHeight:26
  },
  bell:{fontSize:18},
  // Ink on card, bordered like every other raised shape. Not one of the three
  // inks: a count of unread notifications is not a state a place is in.
  badge:{
    position:"absolute",
    top:-4,
    right:-4,
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
