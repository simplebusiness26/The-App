import React,{useCallback,useState} from "react";
import {View,Text,Pressable,StyleSheet,ScrollView,ActivityIndicator} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK} from "../utils/tokens";

// The centre tab. Every row goes to a screen that already exists -- this is a
// launcher, not a feature, and deliberately builds nothing new. The brief gives
// Create a raised button but does not say what it opens; the honest answer is
// "the things this app can actually make today".
//
// Ordered by the core loop. Adding to the map comes after joining what is on
// it, because the app is a live map before it is a directory.

const SHARE=[
  {
    route:"/checkins/create",
    title:"Check in somewhere",
    detail:"Say you are out. It expires by itself, and you choose who can see it."
  },
  {
    route:"/linkups/create",
    title:"Start a link-up",
    detail:"Open an invitation. Explorers who join get the board and the chat."
  },
  {
    route:"/moments/create",
    title:"Post a moment",
    detail:"A photo or a note from somewhere you have been."
  },
  {
    route:"/scan",
    title:"Leave a verified review",
    detail:"Scan the code inside a place to prove you were there, then write it up."
  }
];

const ADD=[
  {
    route:"/business/add",
    title:"Add a business",
    detail:"Put a local business on the map and manage it."
  },
  {
    route:"/property/add",
    title:"Add a property",
    detail:"List a stay you manage."
  },
  {
    route:"/activity-clubs/add",
    title:"Start an activity club",
    detail:"Something that meets again and again, with sessions people can join."
  },
  {
    route:"/events/add",
    title:"Add an event",
    detail:"A dated thing, one-off or part of a series."
  }
];

function Row({item}){
  return(
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={()=>router.push(item.route)}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDetail}>{item.detail}</Text>
    </Pressable>
  );
}

export default function Create(){
  const [loggedIn,setLoggedIn]=useState(false);
  const [loading,setLoading]=useState(true);

  useFocusEffect(useCallback(()=>{
    let active=true;

    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active) return;
      setLoggedIn(!!user);
      setLoading(false);
    })();

    return()=>{active=false;};
  },[]));

  if(loading){
    return(
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  // Not a gate -- every screen below re-checks the session itself and RLS
  // decides the data. It is an explanation, so nobody taps four rows to find
  // out the same thing four times.
  if(!loggedIn){
    return(
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create</Text>
        <Text style={styles.lead}>
          Checking in, link-ups, moments and reviews all attach to an Explorer, so
          they need an account. Log in and this screen fills up.
        </Text>

        <Pressable
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={()=>router.push("/auth/login")}
        >
          <Text style={styles.cardTitle}>Log in</Text>
        </Pressable>

        <Pressable
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          onPress={()=>router.push("/auth/signup")}
        >
          <Text style={styles.cardTitle}>Create an account</Text>
          <Text style={styles.cardDetail}>Everyone starts as an Explorer.</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create</Text>

      <Text style={styles.section}>Share where you are</Text>
      {SHARE.map((item)=><Row key={item.route} item={item}/>)}

      <Text style={styles.section}>Add something to the map</Text>
      {ADD.map((item)=><Row key={item.route} item={item}/>)}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:40},
  title:{fontSize:30,fontWeight:"800",letterSpacing:-0.5,color:INK.ink},
  lead:{fontSize:14,lineHeight:21,color:INK.ink,marginTop:8,marginBottom:20},
  section:{fontSize:13,fontWeight:"800",color:INK.inkSoft,marginTop:18,marginBottom:10},
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    marginBottom:12,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  cardTitle:{fontSize:17,fontWeight:"800",color:INK.ink},
  cardDetail:{fontSize:13,lineHeight:19,color:INK.ink,marginTop:4}
});
