import React from "react";
import {View,Text,StyleSheet,ScrollView,Pressable} from "react-native";

// There was no error boundary anywhere in this app.
//
// React 18 unmounts the entire root when a render throws and nothing catches
// it. That is why a crash on one screen showed as a completely black page --
// no header, no tab bar, no message, nothing to tap, and no way for the person
// looking at it to say anything more useful than "it's blank".
//
// A blank screen is the worst possible failure report. This turns any render
// crash into the one thing that actually identifies it: the error, and where it
// came from. It is deliberately plain text rather than a designed screen --
// this must not itself be able to throw.
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
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Something broke on this screen</Text>
        <Text style={styles.body}>
          The rest of the app is fine. Please send this text — it names the
          exact problem.
        </Text>

        <Text style={styles.heading}>Error</Text>
        <Text style={styles.mono} selectable>{String(error?.message || error)}</Text>

        {!!where && <>
          <Text style={styles.heading}>Where</Text>
          <Text style={styles.mono} selectable>{where}</Text>
        </>}

        <Pressable
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Try this screen again"
          onPress={()=>this.setState({error:null,info:null})}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </ScrollView>
    );
  }
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:22,paddingTop:60},
  title:{color:"white",fontSize:22,fontWeight:"900"},
  body:{color:"#b8b8c0",marginTop:10,lineHeight:20},
  heading:{color:"#a58cff",fontSize:11,fontWeight:"900",letterSpacing:0.6,marginTop:22},
  mono:{color:"#e6e6ea",fontFamily:"monospace",fontSize:12,lineHeight:18,marginTop:6},
  button:{backgroundColor:"#3212b6",borderRadius:12,paddingVertical:15,alignItems:"center",marginTop:28},
  buttonText:{color:"white",fontWeight:"900"}
});
