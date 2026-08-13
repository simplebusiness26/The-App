import React,{useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {DEMO_ENABLED,DEMO_OFF_MESSAGE,demoAccounts} from "../utils/demoLogins";
import {INK} from "../utils/tokens";

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
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Demo logins</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Hide demo logins" onPress={()=>setOpen(false)} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {!DEMO_ENABLED && <Text style={styles.offText}>{DEMO_OFF_MESSAGE}</Text>}

          {accounts.map((account)=>(
            <Pressable
              key={account.key}
              accessibilityRole="button"
              accessibilityLabel={`Log in as ${account.label}`}
              style={[styles.account,disabled&&styles.accountDisabled]}
              disabled={disabled}
              onPress={()=>onPick(account)}
            >
              <Text style={styles.accountLabel}>{account.label}</Text>
              <Text style={styles.accountDetail}>{account.detail}</Text>
            </Pressable>
          ))}

          <Text style={styles.footNote}>
            These are shared demonstration accounts. Anything posted from one is visible to anybody else using it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  panel:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:14,marginTop:14},
  panelHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  panelTitle:{color:INK.ink,fontWeight:"900",fontSize:16},
  close:{color:INK.ink,fontWeight:"900",fontSize:18},
  offText:{color:INK.ink,fontSize:13,lineHeight:19,marginTop:10},
  account:{borderColor:INK.ink,borderWidth:1,borderRadius:11,paddingHorizontal:13,paddingVertical:12,marginTop:10,minHeight:44,justifyContent:"center"},
  accountDisabled:{opacity:0.55},
  accountLabel:{color:INK.ink,fontWeight:"900",fontSize:15},
  accountDetail:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:3},
  footNote:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:12}
});
