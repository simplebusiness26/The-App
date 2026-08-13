import React,{useCallback,useState} from "react";
import {View,Text,Pressable,Modal,StyleSheet,AccessibilityInfo} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK} from "../utils/tokens";

// The one thing a new Explorer is never told.
//
// profiles.visibility starts at 'nobody'. That is right, and it stays right --
// RULES.md says every visibility flag defaults to off and opt-in is never the
// fallback branch of an if-statement. But it means the first Moment, the first
// check-in and the first Link-up somebody posts are seen by no one, and until
// now the app said nothing until they were already on a create screen with the
// thing written.
//
// So this appears once, on the map, after the first sign-in. It explains the
// state they are actually in and offers the way out. It does NOT choose for
// them: both buttons leave visibility exactly as it is, and the only way it
// changes is the Explorer going to Settings and choosing. A prompt that set
// somebody's audience to be helpful would be the precise thing the rule exists
// to prevent.
//
// SHOWN ONCE, AND HOW WE KNOW
// profiles.onboarding_seen_at (20260813020000). Every account that existed when
// that migration ran was backfilled as already-seen, so this is a prompt for new
// Explorers rather than an interruption for everybody at once. The write happens
// on dismissal, whichever button was used, and a failed write is swallowed --
// seeing it twice is a far better failure than a modal that will not close.

export default function VisibilityWelcome(){
  const [show,setShow]=useState(false);
  const [visibility,setVisibility]=useState("nobody");
  const [userId,setUserId]=useState(null);
  const [reduceMotion,setReduceMotion]=useState(false);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setShow(false);return;}

    const {data,error}=await supabase
      .from("profiles")
      .select("visibility,onboarding_seen_at")
      .eq("id",user.id)
      .maybeSingle();

    // A read that fails must not produce a modal. Silence is the safe failure
    // here: the worst case is somebody is not told, which is where we were.
    if(error || !data) return;
    if(data.onboarding_seen_at) return;

    setUserId(user.id);
    setVisibility(data.visibility || "nobody");
    setShow(true);
  },[]);

  useFocusEffect(useCallback(()=>{
    let alive=true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled)=>{if(alive) setReduceMotion(!!enabled);})
      .catch(()=>{});

    load();
    return()=>{alive=false;};
  },[load]));

  async function dismiss(destination){
    setShow(false);

    if(userId){
      await supabase
        .from("profiles")
        .update({onboarding_seen_at:new Date().toISOString()})
        .eq("id",userId)
        .then(()=>{},()=>{});
    }

    if(destination) router.push(destination);
  }

  if(!show) return null;

  // Somebody who has already widened their setting does not need the warning,
  // only the welcome. Both are true statements about where they actually are.
  const isClosed=visibility==="nobody";

  return(
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={()=>dismiss(null)}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.eyebrow}>BEFORE YOU START</Text>
          <Text style={styles.title}>
            {isClosed ? "Nobody can see you yet" : "Who can see what you share"}
          </Text>

          {isClosed ? (
            <>
              <Text style={styles.body}>
                Your account starts completely private. Anything you post — a
                Moment, a check-in, a Link-up — is visible only to you until you
                say otherwise.
              </Text>
              <Text style={styles.body}>
                That is on purpose, and you can leave it that way. But if you are
                expecting other people to see what you post, you need to change
                one setting first.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              One setting decides who can see everything you share, and you can
              change it whenever you like. Yours is set to {visibility.replace("_"," ")}.
            </Text>
          )}

          <Pressable
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Choose who can see what you share"
            onPress={()=>dismiss("/settings")}
          >
            <Text style={styles.primaryText}>Choose who can see me</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Stay private for now"
            onPress={()=>dismiss(null)}
          >
            <Text style={styles.secondaryText}>
              {isClosed ? "Stay private for now" : "Leave it as it is"}
            </Text>
          </Pressable>

          <Text style={styles.footNote}>
            You can change this any time in Settings. Nothing here has changed
            your setting.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:"rgba(22,24,28,0.55)",alignItems:"center",justifyContent:"center",padding:22},
  card:{
    width:"100%",
    maxWidth:420,
    backgroundColor:INK.card,
    borderColor:INK.ink,
    borderWidth:2,
    borderRadius:16,
    padding:20
  },
  eyebrow:{color:INK.blue,fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:INK.ink,fontSize:26,fontWeight:"900",marginTop:6,letterSpacing:-0.4},
  body:{color:INK.ink,fontSize:14,lineHeight:21,marginTop:12},
  primary:{
    backgroundColor:INK.blue,
    borderColor:INK.ink,
    borderWidth:2,
    borderRadius:99,
    paddingVertical:13,
    paddingHorizontal:18,
    alignItems:"center",
    marginTop:20,
    minHeight:44,
    justifyContent:"center"
  },
  primaryText:{color:INK.card,fontWeight:"900",fontSize:15},
  secondary:{
    backgroundColor:INK.paper,
    borderColor:INK.ink,
    borderWidth:2,
    borderRadius:99,
    paddingVertical:13,
    paddingHorizontal:18,
    alignItems:"center",
    marginTop:10,
    minHeight:44,
    justifyContent:"center"
  },
  secondaryText:{color:INK.ink,fontWeight:"900",fontSize:15},
  footNote:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginTop:14,textAlign:"center"}
});
