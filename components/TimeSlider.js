import React,{useMemo,useRef,useState} from "react";
import {View,Text,Pressable,PanResponder,StyleSheet} from "react-native";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO,Panel,TickScale} from "./instrument";

// The Memories timeline.
//
// Built from PanResponder, which is what components/PinSheet.js and the kit's
// own Dial already use for their drags. @react-native-community/slider is not a
// dependency and adding one needs asking; this is a track, a handle and some
// arithmetic.
//
// IT IS ALSO A SET OF BUTTONS. A drag that somebody does not discover, or
// cannot perform -- on the web, under a screen reader, with a tremor -- would
// make the whole historical map unreachable. The two step buttons do the same
// job as the drag and always work.
//
// WHY IT LOOKS LIKE THIS NOW
//
// It was a soft pill handle on a 4px bar in a 2px-bordered box with a hard
// offset shadow: an app slider. The instrument's answer to "move along a
// continuum" is an ETCHED SCALE -- a real tick ruler behind the track, a
// machined knob with a centre line, and the date read out in mono above it,
// because the date is a value this control MEASURES rather than a heading it
// carries. The kit's Dial is the detented cousin of this and is the right
// choice wherever the stops are countable; a timeline's stops are not, so this
// stays continuous and borrows the same ruler.

const TRACK_HEIGHT=34;
const HANDLE=26;

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

  const handleLeft=Math.max(0,Math.min(width-HANDLE,position*width-HANDLE/2));

  return(
    <Panel style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back ten days"
          hitSlop={8}
          style={styles.step}
          onPress={()=>onStep?.(-1)}
        >
          <Glyph name="back" size={13} colour={INK.readoutSoft}/>
          <Text style={styles.stepText}>Earlier</Text>
        </Pressable>

        {/* The reading. What the app worked out the handle is pointing at, so
            it is the data face and not a heading. */}
        <Text style={styles.label} accessibilityRole="header" numberOfLines={1}>{label}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go forward ten days"
          hitSlop={8}
          style={styles.step}
          onPress={()=>onStep?.(1)}
        >
          <Text style={styles.stepText}>Later</Text>
          <Glyph name="forward" size={13} colour={INK.readoutSoft}/>
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
        {/* The etched ruler the handle runs along. Texture, not data -- it says
            "this thing measures things", which a bare bar does not. */}
        {width>0 ? (
          <View style={styles.ruler} pointerEvents="none">
            <TickScale width={width} height={14} count={21} majorEvery={5} colour={INK.hairlineStrong}/>
          </View>
        ) : null}

        <View style={styles.line}/>
        <View style={[styles.filled,{width:Math.max(0,position*width)}]}/>
        <View style={[styles.handle,{left:handleLeft}]}>
          <View style={styles.handleMark}/>
        </View>
      </View>
    </Panel>
  );
}

function clamp(value){
  return Math.min(1,Math.max(0,value));
}

const styles=StyleSheet.create({
  wrap:{padding:12},
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:6,gap:8},
  label:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.lg,
    flexShrink:1,textAlign:"center"
  },
  step:{flexDirection:"row",alignItems:"center",gap:5,minHeight:SHAPE.tapTarget,paddingHorizontal:8},
  stepText:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.8
  },

  track:{height:TRACK_HEIGHT,justifyContent:"center"},
  ruler:{position:"absolute",left:0,right:0,top:0,opacity:0.7},
  line:{height:2,backgroundColor:INK.hairline},
  filled:{position:"absolute",height:2,backgroundColor:INK.readoutSoft},
  // A knob, not a bead: the housing surface a step up, a hairline edge and a
  // centre line you can actually read a position off.
  handle:{
    position:"absolute",
    width:HANDLE,
    height:HANDLE,
    borderRadius:SHAPE.radius.pill,
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    alignItems:"center",
    justifyContent:"center"
  },
  handleMark:{width:1,height:11,backgroundColor:INK.readout}
});
