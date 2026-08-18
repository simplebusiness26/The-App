import React from "react";
import {View,Text,StyleSheet,ScrollView} from "react-native";
import {INK,TYPE} from "../utils/tokens";
import {Action,MONO,Notice,Screen} from "./instrument";

// There was no error boundary anywhere in this app.
//
// React 18 unmounts the entire root when a render throws and nothing catches
// it. That is why a crash on one screen showed as a completely black page --
// no header, no tab bar, no message, nothing to tap, and no way for the person
// looking at it to say anything more useful than "it's blank".
//
// A blank screen is the worst possible failure report. This turns any render
// crash into the one thing that actually identifies it: the error, and where it
// came from.
//
// WHY IT USES ONLY PART OF THE KIT
//
// This must not itself be able to throw, so it stays away from anything that
// draws SVG: no `ScreenTitle` (its ticked rule is a real `TickScale`), no
// `Glyph`, no `Empty`. `Screen`, `Notice` and `Action` are plain Views, Text
// and a Pressable, so they are safe here and give the crash screen the same
// housing, the same dispute edge and the same machined button as everywhere
// else. The head plate below is hand-drawn for that reason alone.
//
// It is not a substitute for handling errors where they happen. It is the floor
// under everything that gets missed.

export default class ErrorBoundary extends React.Component{
  constructor(props){
    super(props);
    this.state={error:null,info:null};
  }

  static getDerivedStateFromError(error){
    return {error};
  }

  componentDidCatch(error,info){
    // Also logged, so a browser console shows it even if the screen is
    // screenshotted rather than read.
    console.log("Unhandled render error",error,info?.componentStack);
    this.setState({info});
  }

  render(){
    const {error,info}=this.state;

    if(!error) return this.props.children;

    const where=(info?.componentStack || "").split("\n").filter(Boolean).slice(0,6).join("\n");

    return(
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>FAULT</Text>
          <Text style={styles.title}>Something broke on this screen</Text>
          <View style={styles.rule}/>
          <Text style={styles.body}>
            The rest of the app is fine. Please send this text — it names the
            exact problem.
          </Text>

          <Notice tone="dispute" label="Error">
            <Text style={styles.mono} selectable>{String(error?.message || error)}</Text>
          </Notice>

          {!!where && (
            <Notice tone="scheduled" label="Where">
              <Text style={styles.mono} selectable>{where}</Text>
            </Notice>
          )}

          <Action
            kind="primary"
            label="Try this screen again"
            accessibilityLabel="Try this screen again"
            onPress={()=>this.setState({error:null,info:null})}
          />
        </ScrollView>
      </Screen>
    );
  }
}

const styles=StyleSheet.create({
  content:{padding:20,paddingTop:60,paddingBottom:60},
  eyebrow:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,marginBottom:5
  },
  title:{color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",letterSpacing:-0.5},
  rule:{height:1,backgroundColor:INK.hairline,marginTop:12,marginBottom:14},
  body:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginBottom:16},
  mono:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,
    lineHeight:TYPE.data.sizes.lg*1.6,letterSpacing:0.4
  }
});
