import React,{useCallback,useState} from "react";
import {View,Text,Modal,StyleSheet,AccessibilityInfo} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {INK,TYPE} from "../utils/tokens";
import {Action,Panel,ScreenTitle} from "./instrument";

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
        <Panel raised style={styles.card} accessibilityRole="alert">
          {/*
            The same engraved plate every screen in the app opens with -- a mono
            eyebrow, the display title, and a ticked rule. A modal that arrives
            with its own heading style is a modal that reads as somebody else's
            dialog box dropped on top of the instrument.
          */}
          <ScreenTitle
            eyebrow="BEFORE YOU START"
            title={isClosed ? "Nobody can see you yet" : "Who can see what you share"}
          />

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

          <View style={styles.actions}>
            <Action
              kind="primary"
              glyph="eye"
              label="Choose who can see me"
              accessibilityLabel="Choose who can see what you share"
              onPress={()=>dismiss("/settings")}
            />

            <Action
              kind="secondary"
              label={isClosed ? "Stay private for now" : "Leave it as it is"}
              accessibilityLabel="Stay private for now"
              onPress={()=>dismiss(null)}
            />
          </View>

          <Text style={styles.footNote}>
            You can change this any time in Settings. Nothing here has changed
            your setting.
          </Text>
        </Panel>
      </View>
    </Modal>
  );
}

const styles=StyleSheet.create({
  // The housing, dimmed. Not a grey wash invented here -- INK.ground at 78%, so
  // whatever is behind the modal recedes into the same dark case the app lives
  // in rather than into somebody else's neutral.
  backdrop:{flex:1,backgroundColor:"rgba(15,18,22,0.78)",alignItems:"center",justifyContent:"center",padding:22},
  card:{width:"100%",maxWidth:420,paddingBottom:16},
  body:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:12,
    paddingHorizontal:16
  },
  actions:{gap:9,marginTop:20,paddingHorizontal:16},
  footNote:{
    color:INK.readoutFaint,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    marginTop:14,
    paddingHorizontal:16,
    textAlign:"center"
  }
});
