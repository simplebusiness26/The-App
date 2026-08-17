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
import {isRootScreen} from "../utils/navigation";
import {INK,SHAPE} from "../utils/tokens";

// The header, for the redesigned shell.
//
// WHAT CHANGED FROM THE OLD ONE
//
// The old header carried three chips: Back, Bell, Hamburger. The hamburger
// opened components/QuickAccessDrawer.js -- a 27-row overflow menu standing
// in for navigation the old 5-tab bar had no room for.
//
// FINAL_PRODUCT_CONTRACT.md's architecture section lists the header's only
// persistent element as the bell ("unchanged persistent notification bell
// (deep-link carrier)") and names no hamburger or overflow menu anywhere in
// the new shell. That is not an oversight to patch here -- it is the direct
// consequence of the new tab set actually having room for what the drawer
// used to hold:
//
//   Explore rows      -> Map tab, Happening tab
//   Community rows     -> Community tab
//   My app rows         -> Create hub (check in, camera, scan), Me tab
//   Manage rows          -> Me -> My Places
//   Account/safety rows   -> Me -> Account & Safety, Me -> Admin Console
//   Log in / Create account -> already own surface: components/FloatingLogin.js
//   Log out               -> already reachable from Settings and Profile
//
// Every row the drawer ever carried maps onto something that already has, or
// per the contract will have, its own tab or hub destination -- see this
// packet's final report for the row-by-row mapping. With nowhere left that
// ONLY the hamburger could reach, the control has no destination to open, so
// it is removed rather than kept as a button to nothing. components/
// QuickAccessDrawer.js, context/DrawerContext.js and utils/drawer.js are
// deleted along with it -- nothing else in the app imports them (checked
// before deleting).
//
// WHAT STAYS
//
// Back      only on a child page. Never on the five tab roots or the splash
//           -- see isRootScreen() in utils/navigation.js for why.
// Bell      always, with its unread count. The one persistent header element
//           the contract names.
//
// AND STILL NOT A LOG IN BUTTON -- that lives in components/FloatingLogin.js,
// unchanged from before.
//
// On the map and the camera it floats OVER the screen (headerFloatsOver()); on
// a page it sits above the content, but as bordered chips rather than a bar,
// so nothing is covered and nothing looks bolted on.

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
      // The gap between the chips belongs to whatever is underneath -- the map
      // pans through it, a page scrolls through it.
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
        and a name repeated on every screen is a wordmark, not navigation.
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
      </View>
    </View>
  );
}

// Every colour here comes from utils/tokens.js. The three state inks --
// exists, scheduled, offer -- are excluded on purpose: they mean a state a
// place is in, and nothing in the navigation shell is a place.
const styles=StyleSheet.create({
  container:{
    flexDirection:"row",
    alignItems:"flex-start",
    justifyContent:"space-between",
    paddingHorizontal:10,
    paddingBottom:6,
    // NO backgroundColor and NO border. Each control carries its own ground
    // instead, which is what lets the header sit over a map without a strip
    // of card across the top of it.
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
    backgroundColor:INK.panel,
    // 1px, and hairlineStrong rather than hairline: this chip has to read over
    // a live map as well as over a page, so it takes the emphasis edge.
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    position:"relative"
  },
  icon:{
    fontSize:22,
    fontWeight:"600",
    color:INK.readout,
    lineHeight:26
  },
  bell:{fontSize:18},
  // The lit readout itself, on the housing -- still not one of the state inks,
  // because a count of unread notifications is not a state a place is in. The
  // ring is the panel behind it, so the badge reads as cut out of the chip.
  badge:{
    position:"absolute",
    top:-4,
    right:-4,
    minWidth:19,
    height:19,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:4,
    backgroundColor:INK.readout,
    alignItems:"center",
    justifyContent:"center",
    borderWidth:SHAPE.border,
    borderColor:INK.panel
  },
  badgeText:{
    color:INK.ground,
    fontSize:10,
    fontWeight:"700"
  }
});
