// Which conversations belong in which tab.
//
// THESE ARE VIEWS OVER ONE INBOX. There is no second messaging system here and
// there must never be: direct messages, the Link-up board and the Activity Club
// board already exist, and All / Friends / Managers / Message Boards are four
// ways of looking at them.
//
// The rules live here, out of the screen, because "which of these is a manager
// conversation" is a question worth being able to test without rendering
// anything -- and because getting it wrong is how a parallel Manager identity
// creeps back into an app that deliberately does not have one.
//
// MANAGER IS A CAPABILITY, NOT AN ACCOUNT TYPE.
// `viewer_is_manager` on a row says which side of THAT conversation the viewer
// is on, and nothing about the person. The same Explorer is the manager in a
// thread about their cafe and the customer in a thread about somebody else's,
// and both threads appear in their Managers tab, because both are about running
// or dealing with a place. What the tab must never do is imply two kinds of
// account.

export const MESSAGE_VIEWS=[
  {key:"all",label:"All"},
  {key:"friends",label:"Friends"},
  {key:"managers",label:"Managers"},
  {key:"boards",label:"Message Boards"}
];

export const DEFAULT_MESSAGE_VIEW="all";

// A conversation about a listing is a Manager conversation, whichever end of it
// you are. A friend conversation never is.
export function isManagerConversation(row){
  return row?.kind==="listing";
}

export function isFriendConversation(row){
  return row?.kind==="friend";
}

export function conversationsFor(view,rows){
  const list=Array.isArray(rows) ? rows : [];

  if(view==="friends") return list.filter(isFriendConversation);
  if(view==="managers") return list.filter(isManagerConversation);
  // 'boards' has no conversations at all -- it is the other system.
  if(view==="boards") return [];
  return list;
}

// What a listing row says under the name. The listing's own name when the
// database could find one, and the kind of thing it is when it could not --
// a deleted business should not leave a row saying "About a undefined".
export function listingSubtitle(row,typeLabel){
  if(!isManagerConversation(row)) return "";

  const name=(row?.target_name || "").trim();
  const kind=(typeLabel || "place").toLowerCase();

  // Which side, said plainly. A manager opening their inbox needs to know at a
  // glance which of these is somebody asking them a question.
  const side=row?.viewer_is_manager ? "You manage" : "About";

  return name ? `${side} ${name}` : `${side} a ${kind}`;
}

// The unread total for a tab, so the tab itself can carry it.
export function unreadFor(view,rows){
  return conversationsFor(view,rows)
    .reduce((total,row)=>total+Number(row?.unread_count || 0),0);
}
