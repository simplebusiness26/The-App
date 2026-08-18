import React,{useState} from "react";
import {View,StyleSheet} from "react-native";
import CommentThread from "./CommentThread";
import EndorseButton from "./EndorseButton";
import ManagerReply from "./ManagerReply";
import {Action} from "./instrument";

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
//               another comment. Challenging the review is the other half of the
//               same job, so both live in ManagerReply -- also in place, also
//               under the review, for the same reason comments are.
//
// The last one is the rule that was missing. Managing a business does not make
// you a manager everywhere: on somebody else's listing you are an ordinary
// Explorer and you get Useful and Comment like everybody else. `canReply` is
// computed once per page by whoever knows the answer -- never per card, and
// never by asking the client to decide who owns what.
//
// There is no ACTION_ROUTE table any more. Reply used to push
// /business/review-action or /property/review-action -- a screen with the review
// nowhere on it -- and there was no entry at all for an activity club or an
// event, so a club manager had no way to answer a review of their club. Nothing
// is routed now, so nothing can be missing from the table.

export default function ReviewActions({
  review,
  viewerId,
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
  const showManagerTools=canReply && !isAuthor;

  return(
    <View>
      {/*
        The manager's reply and challenge. Above the action row because they are
        part of the review being read, not something you do to it -- and because
        an answer belongs next to the thing it answers.
      */}
      <ManagerReply
        review={review}
        canManage={showManagerTools}
        onChanged={onChanged}
      />

      <View style={styles.row}>
      <EndorseButton
        reviewId={review.id}
        ownerId={review.user_id}
        viewerId={viewerId}
        initialCount={likeCount}
        initialEndorsed={liked}
        onChanged={onChanged}
      />

      {/*
        A machined control, not a 2px pill. `quiet` rather than `secondary`
        because this sits beside Useful and neither of them is the primary act
        on a review -- reading it is.
      */}
      <Action
        kind="quiet"
        glyph="comment"
        label={showComments ? "Hide comments" : "Comment"}
        accessibilityLabel="Comment on this review"
        style={styles.action}
        onPress={(event)=>{
          event?.stopPropagation?.();
          setShowComments((open)=>!open);
        }}
      />

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
  // The kit's Action fills its parent by default; in a wrapping row of small
  // controls it has to size to its own label instead.
  action:{alignSelf:"flex-start",paddingHorizontal:12}
});
