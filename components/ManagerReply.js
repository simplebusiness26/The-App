import React,{useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet} from "react-native";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {INK,TYPE} from "../utils/tokens";
import {Action,Chip,Field,fieldInputStyle,Notice} from "./instrument";

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
// THE TWO ANSWERS, AND WHY THIS FILE OWNS THEM
//
// A reply is the business agreeing to talk. A challenge is the business saying
// this review is wrong. They are opposites, they sit next to each other, and
// they are the ONLY two saturated colours in this app that are not about what a
// place is: INK.agree and INK.dispute. (They were called INK.green and INK.red
// under the print system; the aliases still resolve to the same two hexes, but
// a colour named after its own hue tells you nothing about when to spend it.)
//
// They are spent here and nowhere else. Not on an admin approve/reject -- an
// administrator deciding a claim is not a manager answering a customer, and
// docs/design-system.md says so explicitly -- and never on the map.
//
// And they are spent as an EDGE and a dot, not a fill. A green box and a red
// box side by side under every review was the loudest thing on a listing page;
// a 2px lit edge on the manager's answer says the same thing once.
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

// A control that carries one of the two answers. Chip draws the state dot; the
// Pressable around it carries the real accessibility label, which Chip has no
// way to take. Selection steps the surface -- it never fills with the ink.
function AnswerControl({tone,label,accessibilityLabel,selected,onPress}){
  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected:!!selected}}
      onPress={onPress}
    >
      <Chip tone={tone} label={label} selected={selected}/>
    </Pressable>
  );
}

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
        <Notice tone="agree" label="REPLY FROM THE MANAGER">{reply}</Notice>
      )}

      {challenged && (
        <Notice tone="dispute" label="THE MANAGER DISPUTES THIS REVIEW">
          <View>
            {!!challengeReason && <Text style={styles.blockText}>{challengeReason}</Text>}
            <Text style={styles.blockMeta}>
              Sent to moderation. The review stays up until a moderator decides.
            </Text>
          </View>
        </Notice>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* The two boxes, for the manager of this listing only                 */}
      {/* ------------------------------------------------------------------ */}

      {canManage && (
        <View style={styles.tools}>
          <AnswerControl
            tone="agree"
            selected={open==="reply"}
            label={open==="reply" ? "Cancel" : (reply ? "Edit reply" : "Reply")}
            accessibilityLabel={reply ? "Edit your reply to this review" : "Reply to this review as the manager"}
            onPress={(event)=>{
              event?.stopPropagation?.();
              setReplyDraft(reply);
              setOpen((current)=>current==="reply" ? null : "reply");
            }}
          />

          {!challenged && (
            <AnswerControl
              tone="dispute"
              selected={open==="challenge"}
              label={open==="challenge" ? "Cancel" : "Challenge"}
              accessibilityLabel="Challenge this review"
              onPress={(event)=>{
                event?.stopPropagation?.();
                setReasonDraft(challengeReason);
                setOpen((current)=>current==="challenge" ? null : "challenge");
              }}
            />
          )}
        </View>
      )}

      {canManage && open==="reply" && (
        <Field
          label="YOUR REPLY"
          hint="This is the business answering, in public, under the review. Everybody who reads the review reads this."
          style={styles.editor}
        >
          <TextInput
            style={[fieldInputStyle,styles.input]}
            placeholder="Thanks for coming in — we've…"
            placeholderTextColor={INK.readoutFaint}
            value={replyDraft}
            onChangeText={setReplyDraft}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Your reply to this review"
          />
        </Field>
      )}

      {canManage && open==="reply" && (
        <Action
          kind="primary"
          glyph="send"
          label={reply ? "Save changes" : "Post reply"}
          loading={working}
          onPress={saveReply}
        />
      )}

      {canManage && open==="challenge" && (
        <Field
          label="WHAT IS WRONG WITH IT"
          hint="A dispute is for a review that is untrue or not about your place. It goes to a moderator, and the review stays up while they look at it. Disagreeing with somebody is a reply."
          style={styles.editor}
        >
          <TextInput
            style={[fieldInputStyle,styles.input]}
            placeholder="What is wrong with this review?"
            placeholderTextColor={INK.readoutFaint}
            value={reasonDraft}
            onChangeText={setReasonDraft}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Why you are challenging this review"
          />
        </Field>
      )}

      {canManage && open==="challenge" && (
        <Action
          kind="danger"
          glyph="flag"
          label="Send to moderation"
          loading={working}
          onPress={saveChallenge}
        />
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  blockText:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },
  blockMeta:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,
    marginTop:5
  },
  tools:{flexDirection:"row",gap:8,marginTop:10,flexWrap:"wrap"},
  editor:{marginTop:12,marginBottom:10},
  input:{minHeight:78}
});
