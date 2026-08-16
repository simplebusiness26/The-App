import React from "react";
import {View,Text,Pressable,StyleSheet,PanResponder} from "react-native";
import Svg,{Circle,Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {TABS,activeTabKey,isTabBarHidden,centreButton,centreSwipeUp,isDragging,dragOpens,LOGIN_ROUTE} from "../utils/navigation";
import {INK} from "../utils/tokens";
import {signedIn} from "../utils/permissions";

// Alex challenger navigation dock. The visual model is Alex's contextual dock,
// while the owner's existing Map upward-swipe behaviour remains intact.

const ICONS={
  compass:[{circle:[8,8,5.5]},{path:"M10.8 5.2 9.3 9.3 5.2 10.8 6.7 6.7z"}],
  pulse:[{path:"M1.8 8h2.7l1.4-3.1 2.2 6.2 1.7-4.2 1.1 1.1h3.3"}],
  map:[{path:"M2 4.4 6 2.8v8.8L2 13.2z"},{path:"M6 2.8l4 1.6v8.8l-4-1.6z"},{path:"M10 4.4l4-1.6v8.8l-4 1.6z"}],
  camera:[{path:"M2.2 5.6h2.6l1-1.6h4.4l1 1.6h2.6v7.2H2.2z"},{circle:[8,9.2,2.4]}],
  message:[{path:"M2.6 4.2h10.8v6.8H7.4l-3 2.4v-2.4H2.6z"}],
  person:[{circle:[8,5.5,2.4]},{path:"M3.4 13.4c0-2.5 2-4.3 4.6-4.3s4.6 1.8 4.6 4.3"}]
};

function Icon({name,colour,size=21}){
  const primitives=ICONS[name] || ICONS.compass;
  return(
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {primitives.map((primitive,index)=>primitive.circle
        ? <Circle key={index} cx={primitive.circle[0]} cy={primitive.circle[1]} r={primitive.circle[2]} fill="none" stroke={colour} strokeWidth={1.55}/>
        : <Path key={index} d={primitive.path} fill="none" stroke={colour} strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </Svg>
  );
}

export default function TabBar(){
  const pathname=usePathname();
  const insets=useSafeAreaInsets();
  const [account,setAccount]=React.useState({known:false,signedIn:false});

  React.useEffect(()=>{
    let active=true;
    signedIn().then(({user})=>{
      if(active) setAccount({known:true,signedIn:!!user});
    });
    return()=>{active=false;};
  },[pathname]);

  const active=activeTabKey(pathname);
  const centre=centreButton(pathname);
  const swipeUp=centreSwipeUp(pathname);
  const locked=(item)=>!!item.signedIn && account.known && !account.signedIn;
  const destination=(item)=>locked(item) ? LOGIN_ROUTE : item.route;

  // The Map centre remains a normal tap-to-Camera control, but once the finger
  // clearly travels upward the responder takes over and opens Discover. This is
  // an existing owner-reported interaction, not a new Alex feature.
  const swipeResponder=React.useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponderCapture:()=>false,
    onMoveShouldSetPanResponderCapture:(_event,gesture)=>!!swipeUp && isDragging(gesture.dx,gesture.dy),
    onMoveShouldSetPanResponder:(_event,gesture)=>!!swipeUp && isDragging(gesture.dx,gesture.dy),
    onPanResponderTerminationRequest:()=>false,
    onPanResponderRelease:(_event,gesture)=>{
      if(swipeUp && dragOpens(gesture.dx,gesture.dy)) router.push(destination(swipeUp));
    }
  }),[swipeUp,account.known,account.signedIn]);

  if(isTabBarHidden(pathname)) return null;

  return(
    <View style={[styles.shell,{height:78+insets.bottom,paddingBottom:Math.max(insets.bottom,6)}]} accessibilityRole="tablist">
      <View style={styles.dock}>
        {TABS.map((tab)=>{
          const item=tab.raised ? centre : tab;
          const onMap=tab.key==="map" && active==="map";
          const isActive=tab.key===active;
          const isCentre=!!tab.raised;
          const isLocked=locked(item);
          const label=isCentre && item.key==="camera" ? "Camera" : tab.label;

          return(
            <Pressable
              key={tab.key}
              style={[styles.tab,isActive && styles.tabActive,isCentre && styles.centreTab]}
              accessibilityRole="tab"
              accessibilityState={{selected:isActive}}
              accessibilityLabel={
                isLocked
                  ? label+". Log in to open this."
                  : onMap && item.key==="camera"
                    ? "Camera. Drag up for Discover."
                    : label
              }
              onPress={()=>router.push(destination(item))}
              {...(isCentre ? swipeResponder.panHandlers : {})}
            >
              <View style={[styles.iconBox,isActive && styles.iconBoxActive,isCentre && styles.centreIconBox]}>
                <Icon name={item.glyph} colour={isCentre ? INK.brand : isActive ? INK.brand : INK.onNavySoft} size={isCentre ? 23 : 20}/>
              </View>
              <Text style={[styles.label,isActive && styles.labelActive,isCentre && styles.centreLabel]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  shell:{marginTop:-10,paddingHorizontal:10,justifyContent:"flex-end",backgroundColor:"transparent"},
  dock:{minHeight:68,flexDirection:"row",alignItems:"stretch",backgroundColor:INK.navy,borderRadius:24,paddingHorizontal:6,paddingVertical:6},
  tab:{flex:1,minWidth:0,minHeight:56,alignItems:"center",justifyContent:"center",borderRadius:18,gap:3},
  tabActive:{backgroundColor:INK.navySoft},
  centreTab:{backgroundColor:INK.navySoft,borderWidth:2,borderColor:INK.brand,marginHorizontal:2},
  iconBox:{height:25,alignItems:"center",justifyContent:"center"},
  iconBoxActive:{},
  centreIconBox:{height:26},
  label:{color:INK.onNavySoft,fontSize:10,fontWeight:"800",letterSpacing:0.1},
  labelActive:{color:INK.onNavy},
  centreLabel:{color:INK.brand,fontWeight:"900"}
});