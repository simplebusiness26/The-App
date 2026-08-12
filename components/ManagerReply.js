import React,{useState} from "react";
import {View,Text,TextInput,Pressable,ActivityIndicator,StyleSheet} from "react-native";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

// The manager's two answers to a review, and the only place either is drawn.
//
// WHY THIS EXISTS AT ALL
//
// Replying used to mean leaving the page. Tapping Reply pushed
// /business/review-action, a screen with the review nowhere on it, two unlabelled
// text boxes and two black buttons -- so you answered a review you could no
// longer read, and then had to find your way back to read the next one. The
// owner's words were "janky", and they were right.
//
// Challenging was worse than janky: it worked and then vanished. The RPC set
// explorer_reviews.challenged, utils/reviews.js read it back, and not one screen
// in the app ever drew it. Pressing Challenge did exactly what it said and
// looked identical to pressing nothing.
//
// So both live here, inline, under the review they are about, and both are
// VISIBLE afterwards.
//
// GREEN AND RED
//
// A reply is the business agreeing to talk. A challenge is the business saying
// this review is wrong. They are opposites and they sit next to each other, so
// they are the one place in this app that spends a green and a red -- see the
// note in docs/design-system.md, which this is the only exception to.
//
// WHO SEES WHAT
//
// Everybody sees the reply and the challenge once they exist -- a reply nobody
// can read is not a reply, and a review the business disputes should say so on
// the page people read it.
//
// Only whoever manages the reviewed listing sees the boxes. `canManage` is
// worked out once per page by whoever actually knows, and the database refuses
// it independently: respond_to_review and challenge_review both check
// listing_is_managed_by_user and raise rather than matching no rows.

export default function ManagerReply({review,canManage=false,onChanged}){
  const {showFeedback}=useFeedback();

  // What is on screen right now. Held locally so a saved reply appears the
  // instant it saves, rather than after a reload the owner has to know to do.
  const [reply,setReply]=useState(review?.manager_response || "");
  const [challenged,setChallenged]=useState(!!review?.challenged);
  const [challengeReason,setChallengeReason]=useState(review?.challenge_reason || "");

  const [open,setOpen]=useState(null);   // null | 'reply' | 'challenge'
  const [replyDraft,setReplyDraft]=useState(review?.manager_response || "");
  const [reasonDraft,setReasonDraft]=useState(review?.challenge_reason || "");
  const [working,setWorking]=useState(false);

  if(!review?.id) return null;

  async function saveReply(){
    setWorking(true);
    const {error}=await supabase.rpc("respond_to_review",{
      p_review_id:review.id,
      p_response:replyDraft
    });
    setWorking(false);

    if(error){showFeedback(error.message,"error");return;}

    setReply(replyDraft.trim());
    setOpen(null);
    showFeedback(replyDraft.trim() ? "Your reply is now on this review." : "Your reply was removed.");
    onChanged?.();
  }

  async function saveChallenge(){
    if(!reasonDraft.trim()){
      showFeedback("Say what is wrong with this review before challenging it.","error");
      return;
    }

    setWorking(true);
    const {error}=await supabase.rpc("challenge_review",{
      p_review_id:review.id,
      p_reason:reasonDraft
    });
    setWorking(false);

    if(error){showFeedback(error.message,"error");return;}

    setChallenged(true);
    setChallengeReason(reasonDraft.trim());
    setOpen(null);
    showFeedback("This review is marked as challenged and has gone to moderation.");
    onChanged?.();
  }

  return(
    <View>
      {/* ------------------------------------------------------------------ */}
      {/* What is already there, for everybody                                */}
      {/* ------------------------------------------------------------------ */}

      {!!reply && (
        <View style={[styles.block,styles.replyBlock]}>
          <Text style={[styles.blockLabel,styles.replyLabel]}>REPLY FROM THE MANAGER</Text>
          <Text style={styles.blockText}>{reply}</Text>
        </View>
      )}

      {challenged && (
        <View style={[styles.block,styles.challengeBlock]}>
          <Text style={[styles.blockLabel,styles.challengeLabel]}>THE MANAGER DISPUTES THIS REVIEW</Text>
          {!!challengeReason && <Text style={styles.blockText}>{challengeReason}</Text>}
          <Text style={styles.blockMeta}>Sent to moderation. The review stays up until a moderator decides.</Text>
        </View>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* The two boxes, for the manager of this listing only                 */}
      {/* ------------------------------------------------------------------ */}

      {canManage && (
        <View style={styles.tools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reply ? "Edit your reply to this review" : "Reply to this review as the manager"}
            style={[styles.tool,styles.replyTool,open==="reply" && styles.toolOpen]}
            onPress={(event)=>{
              event?.stopPropagation?.();
              setReplyDraft(reply);
              setOpen((current)=>current==="reply" ? null : "reply");
            }}
          >
            <Text style={[styles.toolText,styles.replyToolText]}>
              {open==="reply" ? "Cancel" : (reply ? "Edit reply" : "Reply")}
            </Text>
          </Pressable>

          {!challenged && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Challenge this review"
              style={[styles.tool,styles.challengeTool,open==="challenge" && styles.toolOpen]}
              onPress={(event)=>{
                event?.stopPropagation?.();
                setReasonDraft(challengeReason);
                setOpen((current)=>current==="challenge" ? null : "challenge");
              }}
            >
              <Text style={[styles.toolText,styles.challengeToolText]}>
                {open==="challenge" ? "Cancel" : "Challenge"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {canManage && open==="reply" && (
        <View style={[styles.editor,styles.replyEditor]}>
          <Text style={styles.editorHint}>
            This is the business answering, in public, under the review. Everybody
            who reads the review reads this.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Thanks for coming in — we've…"
            placeholderTextColor={INK.inkSoft}
            value={replyDraft}
            onChangeText={setReplyDraft}
            multiline
            accessibilityLabel="Your reply to this review"
          />
          <Pressable
            accessibilityRole="button"
            style={[styles.save,styles.saveReply,working && styles.saveDisabled]}
            disabled={working}
            onPress={saveReply}
          >
            {working
              ? <ActivityIndicator color={INK.card}/>
              : <Text style={styles.saveText}>{reply ? "Save changes" : "Post reply"}</Text>}
          </Pressable>
        </View>
      )}

      {canManage && open==="challenge" && (
        <View style={[styles.editor,styles.challengeEditor]}>
          <Text style={styles.editorHint}>
            A challenge is for a review that is untrue or not about your place. It
            goes to a moderator, and the review stays up while they look at it.
            Disagreeing with somebody is a reply, not a challenge.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What is wrong with this review?"
            placeholderTextColor={INK.inkSoft}
            value={reasonDraft}
            onChangeText={setReasonDraft}
            multiline
            accessibilityLabel="Why you are challenging this review"
          />
          <Pressable
            accessibilityRole="button"
            style={[styles.save,styles.saveChallenge,working && styles.saveDisabled]}
            disabled={working}
            onPress={saveChallenge}
          >
            {working
              ? <ActivityIndicator color={INK.card}/>
              : <Text style={styles.saveText}>Send to moderation</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  block:{marginTop:11,borderLeftWidth:3,paddingLeft:11},
  replyBlock:{borderLeftColor:INK.green},
  challengeBlock:{borderLeftColor:INK.red},
  blockLabel:{fontSize:10,fontWeight:"800",letterSpacing:0.8},
  replyLabel:{color:INK.green},
  challengeLabel:{color:INK.red},
  blockText:{color:INK.ink,fontSize:14,lineHeight:20,marginTop:3},
  blockMeta:{color:INK.inkSoft,fontSize:11,marginTop:5},

  tools:{flexDirection:"row",gap:8,marginTop:10,flexWrap:"wrap"},
  tool:{borderWidth:2,borderRadius:99,paddingHorizontal:14,paddingVertical:6,backgroundColor:INK.card},
  replyTool:{borderColor:INK.green},
  challengeTool:{borderColor:INK.red},
  toolOpen:{backgroundColor:INK.paper},
  toolText:{fontWeight:"800",fontSize:12},
  replyToolText:{color:INK.ink},
  challengeToolText:{color:INK.red},

  editor:{marginTop:10,borderWidth:2,borderRadius:12,padding:11,backgroundColor:INK.card},
  replyEditor:{borderColor:INK.green},
  challengeEditor:{borderColor:INK.red},
  editorHint:{color:INK.inkSoft,fontSize:11,lineHeight:16,marginBottom:8},
  input:{
    borderWidth:2,
    borderColor:INK.hair,
    borderRadius:10,
    padding:10,
    minHeight:70,
    color:INK.ink,
    fontSize:14,
    textAlignVertical:"top",
    backgroundColor:INK.paper
  },
  save:{marginTop:9,borderRadius:99,paddingVertical:10,alignItems:"center"},
  saveReply:{backgroundColor:INK.green},
  saveChallenge:{backgroundColor:INK.red},
  saveDisabled:{opacity:0.5},
  saveText:{color:INK.card,fontWeight:"800",fontSize:13}
});
