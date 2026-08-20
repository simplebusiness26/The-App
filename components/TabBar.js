import React,{useEffect} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {TABS,activeTabKey,isTabBarHidden,withNext} from "../utils/navigation";
import {INK,SHAPE} from "../utils/tokens";
import {Glyph,MONO,MONO_MEDIUM} from "./instrument";
import {signedIn} from "../utils/permissions";

// The navigation shell. Five flat tabs, none raised -- Map · Happening ·
// Community · Messages · Me, per FINAL_PRODUCT_CONTRACT.md's locked
// architecture. This replaces the old bar, which raised a centre Map button
// that swapped to Camera on the map itself and opened Discover on an upward
// drag.
//
// THAT MACHINERY IS GONE, NOT HIDDEN, AND HERE IS WHY
//
// Create is now a single global floating action (components/CreateHub.js),
// reachable identically from any screen -- "never a tab, never contingent on
// the current route" per the architecture spec. A raised tab-bar button is
// exactly the thing the contract asked to stop being: it only existed on/near
// the map and it changed meaning depending where you stood. The FAB fixes both
// problems by being the same button everywhere.
//
// Discover lost its only entry point (an upward swipe with no visible control
// most people would ever find) and gained a real one: it is the Happening
// tab's destination directly, always one tap away, with its label on screen
// like the other four.
//
// Rendered once, in app/_layout.js, below the Stack rather than around it --
// it needs to survive every push, not just five roots, and moving 76 route
// files into an app/(tabs)/ group to get that for free would risk exactly the
// thing the brief protects ("every existing route still reachable").

// HOW THIS BAR IS DRAWN IS NOT AN OPEN QUESTION.
//
// The winning artifact draws it in nine lines of CSS:
//
//   .tabbar { height:64px; background:var(--card);
//             border-top:var(--bw2) solid var(--ink); }
//   .tab    { flex:1; column of icon+label, centred, gap:3px;
//             color:var(--ink-soft); }
//   .tab .ic{ 19px }
//   .tab .lb{ mono, 8.5px, .08em tracking, uppercase }
//   .tab.active    { color:var(--ink-blue); }
//   .tab.active .lb{ color:var(--ink); }
//
// -- runs/.../rounds/ui/blend-dewith-mengto-pins/artifact.html
//
// There was a graduated SVG scale along the top edge here, and a blue detent
// that travelled between destinations on a 180ms curve. It was carefully made:
// its majors were computed from TABS.length so they landed on destination
// centres rather than being decorative ticks. It was also not in the artifact,
// and the tab bar is on every screen in the product -- so a bar carrying
// chrome the chosen design does not have is the whole app reading as a
// different design, however well the colours match. It is gone. If this bar
// and the artifact ever disagree again, the artifact is right.
//
// State is still not carried by colour alone: the label goes from INK.inkSoft
// to INK.ink AND from MONO to MONO_MEDIUM, and accessibilityState says
// "selected" in words for anybody who cannot see either.

// EXPORTED, because the bar floats OVER the routes rather than sitting under
// them: app/_layout.js draws it as a later sibling of the Stack. A screen with
// something pinned to its own bottom edge -- the camera console is the one --
// has to reserve this much or its shutter renders underneath the bar. The
// artifact's .tabbar is 64px, so that is what this is.
export const TAB_BAR_HEIGHT=64;

const BAR_HEIGHT=TAB_BAR_HEIGHT;

// The five navigation marks come from the kit, by name, from
// utils/navigation.js. There used to be a second icon table in this file, and
// it was the reason the bar still looked like every other app's tab bar after
// the glyph set was redrawn -- the redraw landed in components/instrument.js
// and the five icons on every single screen never saw it.

export default function TabBar(){
  const pathname=usePathname();
  const insets=useSafeAreaInsets();

  // Whether anybody is signed in changes what a tab does, not whether it is
  // drawn. A signed-out visitor sees the whole bar -- the app is a map first
  // and the map needs no account -- and is asked to log in only at the moment
  // they reach for something that needs one.
  const [account,setAccount]=React.useState({known:false,signedIn:false});

  useEffect(()=>{
    let alive=true;
    signedIn().then(({user})=>{
      if(alive) setAccount({known:true,signedIn:!!user});
    });
    return()=>{alive=false;};
  },[pathname]);

  const active=activeTabKey(pathname);
  const hidden=isTabBarHidden(pathname);
  if(hidden) return null;

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
              <Glyph name={tab.glyph} size={19} colour={isActive ? INK.blue : INK.inkSoft}/>
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
  // .tabbar -- card stock with a 2px INK top border. Not a hairline: the bar
  // is a printed edge across the bottom of the page.
  bar:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    flexDirection:"row",
    alignItems:"stretch",
    backgroundColor:INK.card,
    borderTopWidth:SHAPE.borderStrong,
    borderTopColor:INK.ink
  },
  // .tab -- flex:1, a centred column, gap 3. 44px is the tap-target floor and
  // the bar is 64 tall, so every one of these clears it.
  tab:{flex:1,alignItems:"center",justifyContent:"center",gap:3},
  // .tab .lb -- mono, 8.5px, .08em tracking (8.5 x .08 = 0.68), uppercase.
  label:{
    fontFamily:MONO,fontSize:8.5,color:INK.inkSoft,
    textAlign:"center",paddingHorizontal:1,textTransform:"uppercase",letterSpacing:0.68
  },
  // .tab.active .lb {color:var(--ink)} -- the icon goes blue, the label goes
  // back to full ink. Weight carries it too, for colour-blind readers.
  labelActive:{color:INK.ink,fontFamily:MONO_MEDIUM}
});
