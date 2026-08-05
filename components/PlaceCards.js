import React,{useEffect,useRef,useState} from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  AccessibilityInfo,
  Dimensions
} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import {INK} from "../utils/tokens";

// Packet 6: the bottom card.
//
// Three things the brief asks for, and how each is done with what is already
// installed -- no new dependency was added, because RULES.md says to ask first
// and none turned out to be needed:
//
//   Draggable      PanResponder + Animated, both from react-native. Dragging
//                  down past a threshold dismisses; anything less springs back.
//   Swipe between  A horizontal ScrollView with pagingEnabled. Real swiping,
//                  not prev/next buttons pretending to be one.
//   Reduced motion AccessibilityInfo.isReduceMotionEnabled. When it is on, the
//                  sheet does not slide and the spring-back is instant.
//
// It renders in a Modal, which is what keeps the promise underneath it: a modal
// is not part of the map's view tree, so opening, swiping and dismissing a card
// cannot cause the map to re-render, let alone move.

const DISMISS_AFTER=110;

export default function PlaceCards({cards=[],startKey=null,onClose}){
  const width=Dimensions.get("window").width;
  const scroller=useRef(null);
  const [reduceMotion,setReduceMotion]=useState(false);
  const translateY=useRef(new Animated.Value(0)).current;

  const startIndex=Math.max(0,cards.findIndex((card)=>card.key===startKey));
  const [index,setIndex]=useState(startIndex);

  useEffect(()=>{
    let active=true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled)=>{if(active) setReduceMotion(!!enabled);})
      .catch(()=>{});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{setIndex(startIndex);},[startIndex]);

  const pan=useRef(PanResponder.create({
    // Only claim the gesture once it is clearly a downward drag, so a sideways
    // swipe still reaches the ScrollView and moves between places.
    onMoveShouldSetPanResponder:(_event,gesture)=>gesture.dy>6 && Math.abs(gesture.dy)>Math.abs(gesture.dx),
    onPanResponderMove:(_event,gesture)=>{
      if(gesture.dy>0) translateY.setValue(gesture.dy);
    },
    onPanResponderRelease:(_event,gesture)=>{
      if(gesture.dy>DISMISS_AFTER){
        onClose?.();
        translateY.setValue(0);
        return;
      }
      Animated.spring(translateY,{toValue:0,useNativeDriver:true,bounciness:0}).start();
    }
  })).current;

  if(!cards.length) return null;

  const current=cards[Math.min(index,cards.length-1)];

  return(
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dismissArea}
          accessibilityRole="button"
          accessibilityLabel="Close place card"
          onPress={onClose}
        />

        <Animated.View style={[styles.sheet,{transform:[{translateY}]}]} {...pan.panHandlers}>
          <View style={styles.grabber}/>

          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{x:startIndex*width,y:0}}
            onMomentumScrollEnd={(event)=>{
              const next=Math.round(event.nativeEvent.contentOffset.x/width);
              setIndex(Math.max(0,Math.min(next,cards.length-1)));
            }}
          >
            {cards.map((card)=>(
              <View key={card.key} style={[styles.page,{width}]}>
                <View style={styles.card}>
                  <View style={styles.head}>
                    <PlaceMarker marker={card.marker} size={30}/>
                    <View style={styles.headText}>
                      <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
                      <Text style={styles.type}>{card.typeLabel}</Text>
                    </View>
                  </View>

                  {!!card.detail && <Text style={styles.detail} numberOfLines={2}>{card.detail}</Text>}

                  <Pressable
                    style={styles.open}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${card.name}`}
                    onPress={()=>{onClose?.();router.push(card.route);}}
                  >
                    <Text style={styles.openText}>Open {card.typeLabel.toLowerCase()}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          {/*
            Position in the set, in words as well as dots. The dots alone would
            carry it by shape only, and somebody using a screen reader would get
            nothing at all.
          */}
          <Text style={styles.position} accessibilityLabel={`Place ${index+1} of ${cards.length}. ${current.name}.`}>
            {index+1} of {cards.length} nearby
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:"flex-end"},
  dismissArea:{flex:1},
  sheet:{
    backgroundColor:INK.paper,
    borderTopWidth:2,
    borderTopColor:INK.ink,
    paddingBottom:26,
    paddingTop:8
  },
  grabber:{alignSelf:"center",width:44,height:4,borderRadius:2,backgroundColor:INK.hair,marginBottom:10},
  page:{paddingHorizontal:16},
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  head:{flexDirection:"row",alignItems:"center",gap:11},
  headText:{flex:1},
  name:{color:INK.ink,fontSize:18,fontWeight:"800"},
  type:{color:INK.inkSoft,fontSize:11,fontWeight:"800",textTransform:"uppercase",letterSpacing:1,marginTop:2},
  detail:{color:INK.ink,fontSize:13,lineHeight:19,marginTop:10},
  open:{minHeight:48,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:10,marginTop:13},
  openText:{color:INK.card,fontWeight:"800"},
  position:{textAlign:"center",color:INK.inkSoft,fontSize:11,fontWeight:"700",marginTop:11}
});
