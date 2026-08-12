import React from "react";
import {View,Text,Pressable,StyleSheet,PanResponder} from "react-native";
import Svg,{Circle,Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {TABS,activeTabKey,isTabBarHidden,centreButton,centreSwipeUp,LOGIN_ROUTE} from "../utils/navigation";
import {INK} from "../utils/tokens";
import {signedIn} from "../utils/permissions";

// Packet 3: the navigation shell.
//
// This renders once, in app/_layout.js, below the Stack rather than around it.
// That is a deliberate choice and the main design decision in the packet.
//
// The usual Expo Router approach is an app/(tabs)/ group, which would mean
// moving the five tab routes into it. Two reasons not to:
//
//   1. The brief wants the bar "hidden on the three named surfaces, visible
//      everywhere else" -- everywhere, not only on five roots. Under a tabs
//      group the bar disappears the moment anything is pushed on top of it,
//      which is most of this app.
//   2. "Every existing route still reachable. Nothing deleted, nothing
//      orphaned." Moving sixty route files to satisfy a layout is a large way
//      to risk that, and app/_layout.js already declares every one of them.
//
// Rendered in flow, not floating over the content, so no screen needs to learn
// about it. The Stack simply gets a shorter box.

const BAR_HEIGHT=62;
const RAISE=20;
const RAISED_SIZE=54;

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
  compass:[
    {circle:[8,8,5.6]},
    {path:"M10.6 5.4 9.2 9.2 5.4 10.6 6.8 6.8z"}
  ],
  plus:[
    {path:"M8 3.2v9.6"},
    {path:"M3.2 8h9.6"}
  ],
  camera:[
    {path:"M2.2 5.6h2.6l1-1.6h4.4l1 1.6h2.6v7.2H2.2z"},
    {circle:[8,9.2,2.4]}
  ],
  feed:[
    {path:"M2.6 3.4h10.8"},
    {path:"M2.6 6.6h10.8"},
    {path:"M2.6 9.8h7.2"},
    {path:"M2.6 13h7.2"}
  ],
  message:[
    {path:"M2.6 4.2h10.8v6.8H7.4l-3 2.4v-2.4H2.6z"}
  ],
  qr:[
    {path:"M3 3h3.4v3.4H3z"},
    {path:"M9.6 3H13v3.4H9.6z"},
    {path:"M3 9.6h3.4V13H3z"},
    {path:"M9.6 9.6H13V13H9.6z"}
  ],
  trophy:[
    {path:"M4.6 2.8h6.8v3.6a3.4 3.4 0 0 1-6.8 0z"},
    {path:"M4.6 4H3.1a1.9 1.9 0 0 0 1.9 3.2"},
    {path:"M11.4 4h1.5a1.9 1.9 0 0 1-1.9 3.2"},
    {path:"M8 9.8v2.2"},
    {path:"M5.4 13.2h5.2"}
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
  const centre=centreButton(pathname);
  const swipeUp=centreSwipeUp(pathname);

  // An upward drag on the centre button opens Discover; a tap still opens the
  // camera. onStartShouldSetPanResponder stays false so a plain tap is never
  // swallowed by the gesture -- the responder only takes over once the finger
  // has actually travelled far enough upward to mean it.
  const swipeResponder=React.useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    onMoveShouldSetPanResponder:(_event,gesture)=>
      !!swipeUp && gesture.dy < -12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease:(_event,gesture)=>{
      if(swipeUp && gesture.dy < -12) router.push(destination(swipeUp));
    }
  }),[swipeUp,account.known,account.signedIn]);

  // Until the session has been read, treat a person as signed in. Guessing the
  // other way would send somebody who IS logged in to the log-in screen for the
  // first moment after every navigation, which is worse than a redirect that
  // never fires.
  const locked=(tab)=>!!tab.signedIn && account.known && !account.signedIn;
  const destination=(tab)=>locked(tab) ? LOGIN_ROUTE : tab.route;

  return(
    <View
      style={[styles.container,{height:BAR_HEIGHT+RAISE+insets.bottom}]}
      accessibilityRole="tablist"
    >
      <View style={[styles.bar,{height:BAR_HEIGHT+insets.bottom,paddingBottom:insets.bottom}]}>
        {TABS.map((tab)=>{
          const isActive=tab.key===active;

          // The raised tab keeps a slot in the row so the other four stay
          // evenly spaced, but draws nothing here -- it is rendered outside
          // the bar so it can sit above it without being clipped on Android.
          if(tab.raised) return <View key={tab.key} style={styles.tab}/>;

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

      {/* The centre is the map, except on the map, where it becomes the
          scanner. One button, two jobs, decided by centreButton() rather than
          here. */}
      <View style={styles.raisedWrap} {...swipeResponder.panHandlers}>
        <Pressable
          style={styles.raised}
          accessibilityRole="tab"
          accessibilityState={{selected:centre.key===active}}
          accessibilityLabel={
            swipeUp
              ? `${centre.label}. Swipe up for ${swipeUp.label}.`
              : centre.label
          }
          onPress={()=>router.push(destination(centre))}
        >
          <Icon name={centre.glyph} colour={INK.card} size={26}/>
        </Pressable>

        {/*
          The affordance, and a real control in its own right. The upward swipe
          is the nice version, but a gesture that does not fire -- on web, or
          under a screen reader, or for anybody who simply does not discover it
          -- would leave Discover unreachable, since it has no tab any more.
          Tapping this label always works.
        */}
        {!!swipeUp && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${swipeUp.label}`}
            hitSlop={8}
            onPress={()=>router.push(destination(swipeUp))}
          >
            <Text style={styles.swipeHint}>▲ {swipeUp.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  // Transparent above the bar so the raised button has somewhere to sit that is
  // not outside its parent. Android clips overflowing children; this avoids
  // needing it to overflow at all.
  container:{width:"100%",backgroundColor:"transparent"},
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
  labelActive:{color:INK.ink,fontWeight:"700"},
  raisedWrap:{
    position:"absolute",
    top:0,
    left:0,
    right:0,
    alignItems:"center"
  },
  swipeHint:{
    fontSize:9,
    fontWeight:"800",
    color:INK.inkSoft,
    marginTop:2,
    letterSpacing:0.4
  },
  raised:{
    alignSelf:"center",
    width:RAISED_SIZE,
    height:RAISED_SIZE,
    borderRadius:RAISED_SIZE/2,
    backgroundColor:INK.ink,
    borderWidth:2,
    borderColor:INK.ink,
    alignItems:"center",
    justifyContent:"center",
    // Hard offset shadow, never a blur.
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  }
});
