/* eslint-env jest */

// Packet 9: direct messages.
//
// Friends, and anybody to a manager about a listing they run. The second half
// is the one that opens an inbox a stranger can write to, so the rules around
// it are what most of this file checks.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const expoRouter=require("expo-router");

const ME="me-1";
const THEM="them-1";

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

afterEach(()=>{restoreRouterParams();});

describe("the button onto a profile",()=>{
  async function render(follows){
    installFixture({
      user:{id:ME},
      tables:{explorer_follows:follows},
      rpc:{start_friend_conversation:"conv-1"}
    });

    const MessageButton=require("../components/MessageButton").default;
    let tree;
    await act(async()=>{
      tree=create(wrap(React.createElement(MessageButton,{profileId:THEM})));
    });
    await act(async()=>{});
    return tree;
  }

  it("is absent when you are not friends",async()=>{
    const tree=await render([{follower_id:ME,following_id:THEM}]);
    // One-way is not a friendship. A button that shows for everybody and fails
    // for most of them teaches people to distrust buttons.
    expect(labelsOf(tree.toJSON())).toEqual([]);
    await act(async()=>{tree.unmount();});
  });

  it("is absent when only they follow you",async()=>{
    const tree=await render([{follower_id:THEM,following_id:ME}]);
    expect(labelsOf(tree.toJSON())).toEqual([]);
    await act(async()=>{tree.unmount();});
  });

  it("appears once you both follow each other",async()=>{
    const tree=await render([
      {follower_id:ME,following_id:THEM},
      {follower_id:THEM,following_id:ME}
    ]);
    const labels=labelsOf(tree.toJSON());
    console.log("FRIENDS >>>",labels.join(" | "));
    expect(labels).toContain("Message this Explorer");
    await act(async()=>{tree.unmount();});
  });

  it("opens the conversation through the database, not by inserting a row",async()=>{
    const tree=await render([
      {follower_id:ME,following_id:THEM},
      {follower_id:THEM,following_id:ME}
    ]);

    const button=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Message this Explorer"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    await act(async()=>{await button.props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("start_friend_conversation",{p_friend:THEM});
    // The friendship test lives in the function too. A screen may not create a
    // conversation by writing to the table.
    expect(supabase.from).not.toHaveBeenCalledWith("conversations");
    expect(expoRouter.router.push).toHaveBeenCalledWith("/messages/conv-1");

    await act(async()=>{tree.unmount();});
  });
});

describe("the button onto a place",()=>{
  it("is offered to anybody, because that is the rule for a manager",async()=>{
    installFixture({
      user:{id:ME},
      tables:{explorer_follows:[]},
      rpc:{start_listing_conversation:"conv-2"}
    });

    const MessageButton=require("../components/MessageButton").default;
    let tree;
    await act(async()=>{
      tree=create(wrap(React.createElement(MessageButton,{
        targetType:"business",targetId:"biz-1"
      })));
    });
    await act(async()=>{});

    // No friendship needed and none checked.
    expect(labelsOf(tree.toJSON())).toContain("Message whoever manages this place");
    expect(supabase.from).not.toHaveBeenCalledWith("explorer_follows");

    const button=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Message whoever manages this place"
        && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{await button.props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("start_listing_conversation",{
      p_target_type:"business",p_target_id:"biz-1"
    });

    await act(async()=>{tree.unmount();});
  });
});

describe("the inbox",()=>{
  async function renderInbox(rows){
    installFixture({user:{id:ME},tables:{},rpc:{get_conversations:rows}});
    const Messages=require("../app/messages/index").default;
    let tree;
    await act(async()=>{tree=create(wrap(React.createElement(Messages)));});
    await act(async()=>{});
    return tree;
  }

  it("says how to start one when there is nothing, naming both ways in",async()=>{
    const tree=await renderInbox([]);
    const text=textOf(tree.toJSON());
    console.log("EMPTY INBOX >>>",text);

    // An instruction, not a mood.
    expect(text).toContain("follow each other");
    expect(text).toContain("manages a place");

    await act(async()=>{tree.unmount();});
  });

  it("marks a listing thread as being about a place, so a manager can tell them apart",async()=>{
    const tree=await renderInbox([
      {conversation_id:"c1",kind:"listing",target_type:"business",target_id:"b1",
       other_id:"x",other_name:"Priya Raman",other_photo:null,
       last_message:"Are you open Sunday?",last_message_at:"2026-08-12T00:00:00Z",unread_count:2},
      {conversation_id:"c2",kind:"friend",target_type:null,target_id:null,
       other_id:"y",other_name:"Sam Okoro",other_photo:null,
       last_message:"see you there",last_message_at:"2026-08-11T00:00:00Z",unread_count:0}
    ]);

    const text=textOf(tree.toJSON());
    console.log("INBOX >>>",text);

    expect(text).toContain("Priya Raman");
    expect(text).toContain("About a");
    expect(text).toContain("Sam Okoro");
    // The unread count is the caller's own. Nobody is told whether their own
    // message has been read -- that is a presence signal nobody asked for.
    expect(text).toContain("2");

    await act(async()=>{tree.unmount();});
  });
});

describe("the rules live in the database",()=>{
  const migration=require("fs").readFileSync(
    require("path").join(
      __dirname,"..","supabase","migrations","20260812200000_direct_messages.sql"
    ),"utf8"
  ).replace(/^\s*--.*$/gm,"");

  it("grants no write on any of the three tables",()=>{
    expect(migration).toContain(
      "revoke all on public.conversations,public.conversation_members,public.direct_messages from anon,authenticated"
    );
    expect(migration).toContain(
      "grant select on public.conversations,public.conversation_members,public.direct_messages to authenticated"
    );
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)[^;]*direct_messages/i);
  });

  it("re-checks the relationship on every message, not only at the start",()=>{
    const send=migration.slice(migration.indexOf("function public.send_message"));
    expect(send).toContain("guestbook_private.are_friends(v_me,v_other)");
    expect(send).toContain("guestbook_private.either_blocked(v_me,v_other)");
    expect(send).toContain("guestbook_private.listing_manager(v_type,v_target)");
  });

  it("does not delete history when a friendship ends",()=>{
    const send=migration.slice(migration.indexOf("function public.send_message"));
    // It refuses the send. It does not touch what is already there.
    expect(send).toContain("this conversation is closed");
    expect(send).not.toMatch(/delete from public\.direct_messages/);
  });

  it("lets a message be reported into the queue that already exists",()=>{
    // The manager inbox is the one a stranger can write to, so it does not
    // ship without this -- and it goes to social_reports so there is one
    // moderation screen and not two.
    expect(migration).toContain("check (target_type in ('moment','comment','review','message'))");
  });
});
