import React,{useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {router} from "expo-router";
import CommentThread from "./CommentThread";
import EndorseButton from "./EndorseButton";
import {INK} from "../utils/tokens";

// The row of actions under a review. One component, used everywhere a review is
// drawn, so a review cannot be useful-able on one screen and inert on another.
//
// THREE ACTIONS, AND THEY ARE NOT THE SAME KIND OF THING
//
//   Useful   -- anybody except the review's author. An endorsement, not a like:
//               "people found this helpful". EndorseButton owns that word and
//               hides itself for the author, because the database refuses it.
//
//   Comment  -- anybody. What any Explorer says back about a review. It opens
//               IN PLACE, under the review it belongs to. Sending somebody to
//               another screen to say one line, then back again to read the
//               next review, is the thing that made this unusable: the reply
//               and the thing being replied to were never on screen together.
//
//   Reply    -- ONLY whoever manages the reviewed place, and only on reviews of
//               THEIR place. A reply is the business answering its customer, and
//               it renders as its own block above the comments rather than as
//               another comment.
//
// The last one is the rule that was missing. Managing a business does not make
// you a manager everywhere: on somebody else's listing you are an ordinary
// Explorer and you get Useful and Comment like everybody else. `canReply` is
// computed once per page by whoever knows the answer -- never per card, and
// never by asking the client to decide who owns what.

const ACTION_ROUTE={
  business:"/business/review-action",
  property:"/property/review-action"
};

export default function ReviewActions({
  review,
  viewerId,
  targetType,
  canReply=false,
  likeCount=0,
  liked=false,
  onChanged
}){
  // The hook runs before any early return -- React requires the same hooks in
  // the same order on every render, and a `return null` above it would break
  // that the first time a card arrived without an id.
  const [showComments,setShowComments]=useState(false);

  if(!review?.id) return null;

  const isAuthor=!!viewerId && viewerId===review.user_id;

  // A manager cannot reply to their own review of their own place. They are the
  // author there, and a business answering itself is not a reply.
  const replyRoute=ACTION_ROUTE[targetType];
  const showReply=canReply && !isAuthor && !!replyRoute;

  return(
    <View>
      <View style={styles.row}>
      <EndorseButton
        reviewId={review.id}
        ownerId={review.user_id}
        viewerId={viewerId}
        initialCount={likeCount}
        initialEndorsed={liked}
        onChanged={onChanged}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comment on this review"
        style={styles.action}
        onPress={(event)=>{
          event?.stopPropagation?.();
          setShowComments((open)=>!open);
        }}
      >
        <Text style={styles.actionText}>{showComments ? "Hide comments" : "Comment"}</Text>
      </Pressable>

      {showReply && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reply to this review as the manager"
          style={[styles.action,styles.reply]}
          onPress={(event)=>{
            event?.stopPropagation?.();
            router.push(`${replyRoute}?id=${review.id}`);
          }}
        >
          <Text style={[styles.actionText,styles.replyText]}>Reply</Text>
        </Pressable>
      )}
      </View>

      {/*
        The thread itself, under the review rather than on a screen of its own.
        CommentThread is the same component the standalone review screen uses --
        one implementation, so a comment cannot behave differently depending on
        where somebody happened to open it.
      */}
      {showComments && (
        <View style={styles.thread}>
          <CommentThread
            targetType="review"
            targetId={review.id}
            ownerId={review.user_id}
          />
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  row:{flexDirection:"row",alignItems:"center",gap:8,marginTop:12,flexWrap:"wrap"},
  thread:{marginTop:10},
  action:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:6,
    backgroundColor:INK.card
  },
  actionText:{color:INK.ink,fontWeight:"800",fontSize:12},
  // The manager's action is the filled one: it is the rarer, weightier thing to
  // do, and it is the only one on the row that speaks for the place itself.
  reply:{backgroundColor:INK.ink,borderColor:INK.ink},
  replyText:{color:INK.card}
});
