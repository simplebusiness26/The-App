import React,{useMemo,useRef,useState} from "react";
import {View,Text,Pressable,PanResponder,StyleSheet} from "react-native";
import {INK} from "../utils/tokens";

// The Memories timeline.
//
// Built from PanResponder, which is what components/TabBar.js and
// components/PlaceCards.js already use for their drags. @react-native-community
// /slider is a dependency and adding one needs asking; this is a track, a
// handle and some arithmetic.
//
// IT IS ALSO A SET OF BUTTONS. A drag that somebody does not discover, or
// cannot perform -- on the web, under a screen reader, with a tremor -- would
// make the whole historical map unreachable. The two step buttons do the same
// job as the drag and always work, the same reasoning as the "▲ Discover"
// label under the raised tab button.

const TRACK_HEIGHT=34;

export default function TimeSlider({position=1,label,onChange,onStep}){
  const [width,setWidth]=useState(0);
  const widthRef=useRef(0);
  const positionRef=useRef(position);
  positionRef.current=position;

  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderTerminationRequest:()=>false,

    onPanResponderGrant:(event)=>{
      const x=event.nativeEvent.locationX;
      if(widthRef.current>0) onChange?.(clamp(x/widthRef.current));
    },

    onPanResponderMove:(event,gesture)=>{
      if(widthRef.current<=0) return;
      // From where the handle was when the drag started, not from where the
      // finger happens to be -- grabbing the handle should not teleport it.
      const delta=gesture.dx/widthRef.current;
      onChange?.(clamp(positionRef.current+delta));
    }
  }),[onChange]);

  const handleLeft=Math.max(0,Math.min(width-26,position*width-13));

  return(
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back ten days"
          hitSlop={8}
          style={styles.step}
          onPress={()=>onStep?.(-1)}
        >
          <Text style={styles.stepText}>‹ Earlier</Text>
        </Pressable>

        <Text style={styles.label} accessibilityRole="header">{label}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go forward ten days"
          hitSlop={8}
          style={styles.step}
          onPress={()=>onStep?.(1)}
        >
          <Text style={styles.stepText}>Later ›</Text>
        </Pressable>
      </View>

      <View
        style={styles.track}
        onLayout={(event)=>{
          const next=event.nativeEvent.layout.width;
          widthRef.current=next;
          setWidth(next);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Move through time"
        accessibilityValue={{min:0,max:100,now:Math.round(position*100)}}
        {...responder.panHandlers}
      >
        <View style={styles.line}/>
        <View style={[styles.filled,{width:Math.max(0,position*width)}]}/>
        <View style={[styles.handle,{left:handleLeft}]}/>
      </View>
    </View>
  );
}

function clamp(value){
  return Math.min(1,Math.max(0,value));
}

const styles=StyleSheet.create({
  wrap:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:12},
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:9,gap:8},
  label:{color:INK.ink,fontWeight:"900",fontSize:13,flexShrink:1,textAlign:"center"},
  step:{minHeight:44,justifyContent:"center",paddingHorizontal:10},
  stepText:{color:INK.ink,fontWeight:"800",fontSize:12},
  track:{height:TRACK_HEIGHT,justifyContent:"center"},
  line:{height:4,borderRadius:2,backgroundColor:INK.hair},
  filled:{position:"absolute",height:4,borderRadius:2,backgroundColor:INK.ink},
  handle:{
    position:"absolute",
    width:26,
    height:26,
    borderRadius:13,
    backgroundColor:INK.card,
    borderColor:INK.ink,
    borderWidth:2,
    // Hard offset shadow, never a blur.
    shadowColor:INK.ink,
    shadowOffset:{width:2,height:2},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  }
});
