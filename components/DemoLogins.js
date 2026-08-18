import React,{useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {DEMO_ENABLED,DEMO_OFF_MESSAGE,demoAccounts} from "../utils/demoLogins";
import {INK,TYPE} from "../utils/tokens";
import {Glyph,MONO,Panel,Row} from "./instrument";

// The way into the demo accounts: five taps on the login screen's own heading.
//
// It wraps whatever it is given rather than drawing a logo of its own. The
// first version added an Xplorer wordmark above the title purely to have
// something to tap, which is a piece of branding invented to hide a gesture
// behind -- the heading was already there and already says Login.
//
// Five taps is a deliberately awkward gesture: nobody arrives at it by
// accident, and it is not a control sitting on the screen where a real person
// can see it and press it, which is exactly what the old quick-login panel was.
//
// The taps are not the security. utils/demoLogins.js is: a build without
// EXPO_PUBLIC_DEMO_PASSWORD has no password in it, so the panel that opens has
// nothing to offer and says so. Hiding a real credential behind a gesture would
// be the same mistake in a longer coat.

export const TAPS_TO_OPEN=5;

export default function DemoLogins({onPick,disabled=false,label="Login",children}){
  const [taps,setTaps]=useState(0);
  const [open,setOpen]=useState(false);

  const accounts=demoAccounts();

  function tap(){
    if(open) return;
    const next=taps+1;
    if(next>=TAPS_TO_OPEN){
      setTaps(0);
      setOpen(true);
      return;
    }
    setTaps(next);
  }

  return(
    <View>
      {/* The heading itself is the target. It keeps its own styling -- this
          adds a press handler and nothing visual, so the screen looks exactly
          as it did and there is nothing on it hinting that taps are counted. */}
      <Pressable accessibilityRole="header" accessibilityLabel={label} onPress={tap}>
        {children}
      </Pressable>

      {open && (
        <Panel style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Demo logins</Text>
            <View style={styles.panelLine}/>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide demo logins"
              onPress={()=>setOpen(false)}
              hitSlop={10}
              style={styles.close}
            >
              <Glyph name="close" size={15} colour={INK.readoutSoft}/>
            </Pressable>
          </View>

          {!DEMO_ENABLED && <Text style={styles.offText}>{DEMO_OFF_MESSAGE}</Text>}

          {/*
            The Row draws the line; the Pressable around it carries the spoken
            label. Row derives its own accessibility label from its title and
            subtitle, and "Log in as Manager" is the sentence this control has to
            say -- so the press handler sits outside it rather than being handed
            in, which would have replaced that sentence with the row's text.
          */}
          {accounts.map((account)=>(
            <Pressable
              key={account.key}
              accessibilityRole="button"
              accessibilityLabel={`Log in as ${account.label}`}
              style={disabled&&styles.accountDisabled}
              disabled={disabled}
              onPress={()=>onPick(account)}
            >
              <Row title={account.label} sub={account.detail} glyph="key"/>
            </Pressable>
          ))}

          <Text style={styles.footNote}>
            These are shared demonstration accounts. Anything posted from one is visible to anybody else using it.
          </Text>
        </Panel>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  panel:{padding:13,marginTop:14},
  panelHead:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:11},
  panelTitle:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md
  },
  panelLine:{flex:1,height:1,backgroundColor:INK.hairline},
  close:{minWidth:32,minHeight:32,alignItems:"flex-end",justifyContent:"center"},
  offText:{
    color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,marginBottom:10
  },
  accountDisabled:{opacity:0.55},
  footNote:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,marginTop:6
  }
});
