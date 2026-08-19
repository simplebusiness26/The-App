import React,{useEffect,useRef,useState} from "react";
import {AccessibilityInfo,Animated,View,Text,Pressable,StyleSheet} from "react-native";
import Svg,{Circle,Line,Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {TABS,activeTabKey,isTabBarHidden,withNext} from "../utils/navigation";
import {INK,TYPE,SHAPE,MOTION} from "../utils/tokens";
import {MONO} from "./instrument";
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

// THE GRADUATED SCALE ALONG THE BAR'S TOP EDGE.
//
// Drawn here rather than with the kit's TickScale because this rule is not
// texture: its major graduations have to land on the five destinations, and
// TickScale spaces its majors by a fixed interval. A scale whose marks do not
// line up with the things they measure is decoration pretending to be an
// instrument, which is the exact failure this redesign exists to correct.
function NavigationScale({width,count}){
  if(!width || !count) return null;
  const step=width/count;
  const minorsPerStep=4;
  const marks=[];

  for(let position=0;position<count;position++){
    // The major: the centre of a destination, and where the detent settles.
    marks.push({x:position*step+step/2,major:true});
    // The minors: an even run between one destination and the next, so the eye
    // reads a continuous scale rather than five separated markers.
    for(let minor=1;minor<minorsPerStep;minor++){
      marks.push({x:position*step+(step/minorsPerStep)*minor-step/(minorsPerStep*2),major:false});
    }
  }

  return(
    <View style={styles.barRule} pointerEvents="none">
      <Svg width={width} height={8}>
        {marks.map((mark,index)=>(
          <Line
            key={index}
            x1={mark.x} x2={mark.x}
            y1={0} y2={mark.major?8:4}
            stroke={mark.major?INK.hairlineStrong:INK.hairline}
            strokeWidth={1}
          />
        ))}
      </Svg>
    </View>
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

  // The bar's real width, measured rather than assumed: the scale's graduations
  // and the detent's travel are both computed from it, and a hard-coded 320
  // would put the marks in the wrong place on every device but one.
  const [barWidth,setBarWidth]=useState(0);
  const [reducedMotion,setReducedMotion]=useState(false);
  const travel=useRef(new Animated.Value(0)).current;

  React.useEffect(()=>{
    let active=true;
    signedIn().then(({user})=>{
      if(active) setAccount({known:true,signedIn:!!user});
    });
    return()=>{active=false;};
  },[pathname]);

  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on)=>{if(alive) setReducedMotion(!!on);})
      .catch(()=>{});
    return()=>{alive=false;};
  },[]);

  const active=activeTabKey(pathname);
  const activeIndex=TABS.findIndex((tab)=>tab.key===active);
  const hidden=isTabBarHidden(pathname);

  // THE DETENT SETTLES ON ITS GRADUATION.
  //
  // This effect has to sit ABOVE the early return: a hook that runs on some
  // renders and not others is the classic way a screen starts throwing after a
  // route change, and the tab bar unmounts itself on full-screen routes.
  useEffect(()=>{
    if(!barWidth || activeIndex<0) return;
    const to=(barWidth/TABS.length)*activeIndex;
    if(reducedMotion){
      travel.setValue(to);
      return;
    }
    Animated.timing(travel,{
      toValue:to,
      duration:MOTION.standard,
      useNativeDriver:true
    }).start();
  },[barWidth,activeIndex,reducedMotion,travel]);

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
      <View
        style={[styles.bar,{height:BAR_HEIGHT+insets.bottom,paddingBottom:insets.bottom}]}
        onLayout={(event)=>setBarWidth(event.nativeEvent.layout.width)}
      >
        {/* THE SCALE THIS SELECTOR RUNS ALONG.
            It used to be a decorative run of evenly spaced ticks -- texture,
            saying nothing. A graduation that lands nowhere in particular is
            ornament, and this design does not do ornament: a rule on an
            instrument is a SCALE, and its major marks are the positions the
            selector can occupy. So the majors are computed to land exactly on
            the five destinations' centres, with minors between them, and the
            indicator below settles on a major. The navigation now reads as one
            graduated control rather than as five buttons that happen to sit in
            a row. */}
        <NavigationScale width={barWidth} count={TABS.length}/>

        {/* THE TRAVELLING DETENT.
            A selector on an instrument does not blink from one position to the
            next -- it MOVES along its scale, and watching it move is how you
            learn the scale is one thing. 140ms is MOTION.standard from the
            design system, and reduce-motion drops it to an instant jump,
            because liveness is the only thing this app animates by right. */}
        {barWidth>0 && activeIndex>=0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.detent,
              {width:barWidth/TABS.length,transform:[{translateX:travel}]}
            ]}
          >
            <View style={styles.detentMark}/>
          </Animated.View>
        ) : null}
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
              {/* THE DETENT. A selector on an instrument sits IN a notch, so
                  the active tab gets a filled detent block rather than a
                  floating underline -- and it sits at the top edge, against
                  the ruled scale, where a pointer would land. */}
              <Icon name={tab.glyph} colour={isActive ? INK.readout : INK.readoutFaint}/>
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
    // Chrome sits one step above the housing, separated by an etched hairline
    // rather than the old 2px print register.
    backgroundColor:INK.panel,
    borderTopWidth:SHAPE.border,
    borderTopColor:INK.hairline
  },
  barRule:{position:"absolute",top:0,left:0,right:0,opacity:0.9},
  // THE DETENT. A selector on an instrument sits IN a notch cut into its
  // scale, so this is a solid block seated against the rule -- not a floating
  // underline hovering near it. It is the width of one destination and it
  // travels between them.
  detent:{position:"absolute",top:0,left:0,height:9,alignItems:"center",justifyContent:"flex-start"},
  detentMark:{width:34,height:3,backgroundColor:INK.readout},
  // 44px is the tap-target floor even where the visible target is smaller.
  tab:{flex:1,minHeight:52,alignItems:"center",justifyContent:"flex-start",paddingTop:13},
  // WHERE YOU ARE IS NOT A STATE A PLACE IS IN. The active destination is
  // never a state-ink fill: the readout brightens (icon and label to
  // INK.readout) and the detent above seats itself on that graduation. Colour
  // is still not the only carrier -- accessibilityState says it in words, and
  // the detent says it in position.
  // Mono, uppercase, wide-tracked. These name destinations the app defines,
  // not sentences a person wrote, so they take the data face like every other
  // system label in the instrument.
  label:{
    fontFamily:MONO,fontSize:9,marginTop:5,color:INK.readoutFaint,
    textAlign:"center",paddingHorizontal:1,textTransform:"uppercase",letterSpacing:0.7
  },
  labelActive:{color:INK.readout,fontWeight:"600"}
});
