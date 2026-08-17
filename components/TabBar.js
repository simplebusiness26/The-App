import React from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import Svg,{Circle,Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {TABS,activeTabKey,isTabBarHidden,withNext} from "../utils/navigation";
import {INK} from "../utils/tokens";
import {signedIn} from "../utils/permissions";

// The navigation shell, redesigned. Five flat tabs, none raised -- Map ·
// Happening · Community · Messages · Me, per FINAL_PRODUCT_CONTRACT.md's
// locked architecture. This replaces the old bar, which raised a centre Map
// button that swapped to Camera on the map itself and opened Discover on an
// upward drag.
//
// THAT MACHINERY IS GONE, NOT HIDDEN, AND HERE IS WHY
//
// Create is now a single global floating action (components/CreateHub.js),
// reachable identically from any screen -- "never a tab, never contingent on
// the current route" per the architecture spec. A raised tab-bar button is
// exactly the thing the contract asked to stop being: it only existed on/near
// the map and it changed meaning depending where you stood. The FAB fixes
// both problems by being the same button everywhere.
//
// Discover lost its only entry point (an upward swipe with no visible
// control most people would ever find) and gained a real one: it is the
// Happening tab's destination directly, always one tap away, with its label
// on screen like the other four.
//
// Rendered once, in app/_layout.js, below the Stack rather than around it --
// same reasoning as before: it needs to survive every push, not just five
// roots, and moving 76 route files into an app/(tabs)/ group to get that for
// free would risk exactly the thing the brief protects ("every existing
// route still reachable").

const BAR_HEIGHT=62;

// Navigation icons, on the same 16x16 canvas as the place markers. Deliberately
// a separate set from GLYPHS in utils/markers.js: those say what a place is,
// these say where a tap goes, and collapsing them would tie the map's meaning
// to the shape of the navigation.
const ICONS={
  map:[
    {path:"M2 4.4 6 2.8v8.8L2 13.2z"},
    {path:"M6 2.8l4 1.6v8.8l-4-1.6z"},
    {path:"M10 4.4l4-1.6v8.8l-4 1.6z"}
  ],
  // Happening: a compass. What's on, right now or soon -- the needle points
  // at it rather than naming any one of the five things it now stands for
  // (For You, Live Now, Events, Clubs, Link-ups).
  compass:[
    {circle:[8,8,5.6]},
    {path:"M10.6 5.4 9.2 9.2 5.4 10.6 6.8 6.8z"}
  ],
  // Community: two people, standing for Feed/Explorers/Leaderboard folded
  // into one destination. A separate drawing from markers.js's "people"
  // glyph on purpose -- see the file note above.
  community:[
    {circle:[5.6,6,2.1]},
    {path:"M2.2 13.2c0-2 1.5-3.5 3.4-3.5s3.4 1.5 3.4 3.5"},
    {circle:[11,6.6,1.7]},
    {path:"M9.6 9.9c1.9 0 3.2 1.3 3.2 3.3"}
  ],
  message:[
    {path:"M2.6 4.2h10.8v6.8H7.4l-3 2.4v-2.4H2.6z"}
  ],
  person:[
    {circle:[8,5.5,2.4]},
    {path:"M3.4 13.4c0-2.5 2-4.3 4.6-4.3s4.6 1.8 4.6 4.3"}
  ]
};

function Icon({name,colour,size=22}){
  return(
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {ICONS[name].map((primitive,index)=>primitive.circle
        ? <Circle
            key={index}
            cx={primitive.circle[0]}
            cy={primitive.circle[1]}
            r={primitive.circle[2]}
            fill="none"
            stroke={colour}
            strokeWidth={1.5}
          />
        : <Path
            key={index}
            d={primitive.path}
            fill="none"
            stroke={colour}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
      )}
    </Svg>
  );
}

export default function TabBar(){
  const pathname=usePathname();
  const insets=useSafeAreaInsets();

  // Whether anybody is signed in changes what a tab does, not whether it is
  // drawn. A signed-out visitor sees the whole bar -- the app is a map first
  // and the map needs no account -- and is asked to log in only at the moment
  // they reach for something that needs one.
  const [account,setAccount]=React.useState({known:false,signedIn:false});

  React.useEffect(()=>{
    let active=true;
    signedIn().then(({user})=>{
      if(active) setAccount({known:true,signedIn:!!user});
    });
    return()=>{active=false;};
  },[pathname]);

  if(isTabBarHidden(pathname)) return null;

  const active=activeTabKey(pathname);

  // Until the session has been read, treat a person as signed in. Guessing the
  // other way would send somebody who IS logged in to the log-in screen for the
  // first moment after every navigation, which is worse than a redirect that
  // never fires.
  const locked=(tab)=>!!tab.signedIn && account.known && !account.signedIn;
  const destination=(tab)=>locked(tab) ? withNext(tab.route) : tab.route;

  return(
    <View
      style={[styles.container,{height:BAR_HEIGHT+insets.bottom}]}
      accessibilityRole="tablist"
    >
      <View style={[styles.bar,{height:BAR_HEIGHT+insets.bottom,paddingBottom:insets.bottom}]}>
        {TABS.map((tab)=>{
          const isActive=tab.key===active;
          const isLocked=locked(tab);

          return(
            <Pressable
              key={tab.key}
              style={styles.tab}
              accessibilityRole="tab"
              // The selected state reaches a screen reader through this, not
              // through the colour of the label.
              accessibilityState={{selected:isActive}}
              accessibilityLabel={isLocked ? `${tab.label}. Log in to open this.` : tab.label}
              onPress={()=>router.push(destination(tab))}
            >
              {/* Active is carried by a bar and by weight as well as by colour,
                  because state is never carried by colour alone. */}
              <View style={[styles.marker,isActive && styles.markerActive]}/>
              <Icon name={tab.glyph} colour={isActive ? INK.ink : INK.inkSoft}/>
              <Text style={[styles.label,isActive && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{
    width:"100%",
    backgroundColor:"transparent"
  },
  bar:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    flexDirection:"row",
    alignItems:"flex-start",
    backgroundColor:INK.card,
    // The borders are the print register, and not optional.
    borderTopWidth:2,
    borderTopColor:INK.ink
  },
  // 44px is the tap-target floor even where the visible target is smaller.
  tab:{flex:1,minHeight:52,alignItems:"center",justifyContent:"flex-start",paddingTop:6},
  marker:{height:3,width:26,borderRadius:2,backgroundColor:"transparent",marginBottom:5},
  markerActive:{backgroundColor:INK.ink},
  label:{fontSize:10,marginTop:3,color:INK.inkSoft,textAlign:"center",paddingHorizontal:2},
  labelActive:{color:INK.ink,fontWeight:"700"}
});
