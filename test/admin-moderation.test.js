/* eslint-env jest */

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Alert}=require("react-native");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");
const {textOf}=require("./fixture");

const AdminModeration=require("../app/admin/moderation").default;

const SOCIAL_REPORT={
  report_id:"social-report-1",
  queue:"social",
  reporter_id:"explorer-1",
  reporter_name:"Alex Rivers",
  target_type:"moment",
  target_id:"moment-1",
  target_owner_id:"explorer-2",
  target_owner_name:"Sam Coast",
  reason:"harassment",
  details:"Repeated unwanted replies.",
  report_state:"open",
  target_summary:"A reported moment summary",
  target_state:"published",
  created_at:"2026-08-09T10:00:00Z"
};

const SAFETY_REPORT={
  report_id:"safety-report-1",
  queue:"safety",
  reporter_id:"explorer-3",
  reporter_name:"Robin Fields",
  target_type:"linkup",
  target_id:"linkup-1",
  target_owner_id:"explorer-4",
  target_owner_name:"Taylor Hill",
  reason:"unsafe_behaviour",
  details:"The public description needs review.",
  report_state:"reviewing",
  target_summary:"Sunset walk",
  target_state:"open",
  created_at:"2026-08-09T11:00:00Z"
};

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,element)
  );
}

function installModeration({readError=null,socialTotal=1}={}){
  const decided=new Set();

  supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
  supabase.rpc.mockImplementation((name,payload)=>{
    if(name==="guestbook_is_admin") return Promise.resolve({data:true,error:null});
    if(name==="admin_get_moderation_queue"){
      if(readError) return Promise.resolve({data:null,error:{message:readError}});
      const item=payload.p_queue==="social" ? SOCIAL_REPORT : SAFETY_REPORT;
      return Promise.resolve({
        data:{
          queue:payload.p_queue,
          total:payload.p_queue==="social" ? socialTotal : 1,
          items:decided.has(item.report_id) ? [] : [item]
        },
        error:null
      });
    }
    if(name==="admin_decide_report"){
      decided.add(payload.p_report_id);
      return Promise.resolve({
        data:{
          queue:payload.p_queue,
          report_id:payload.p_report_id,
          decision:payload.p_decision,
          target_changed:payload.p_decision==="actioned"
        },
        error:null
      });
    }
    return Promise.resolve({data:null,error:null});
  });
}

async function renderModeration(){
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(AdminModeration)));});
  return tree;
}

function control(tree,label,handler="onPress"){
  return tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.[handler]==="function",
    {deep:true}
  )[0];
}

function confirmButton(){
  const call=Alert.alert.mock.calls[Alert.alert.mock.calls.length-1];
  return call?.[2]?.find((button)=>button.style!=="cancel");
}

describe("Admin Dashboard Stage 6 moderation",()=>{
  let tree;

  beforeEach(()=>jest.clearAllMocks());
  afterEach(async()=>{
    if(tree){
      await act(async()=>tree.unmount());
      tree=null;
    }
  });

  it("loads a privacy-bounded, paginated social queue",async()=>{
    installModeration({socialTotal:30});
    tree=await renderModeration();
    const text=textOf(tree.toJSON());

    expect(text).toContain("A reported moment summary");
    expect(text).toContain("Alex Rivers");
    expect(text).toContain("Sam Coast");
    expect(text).toContain("30 open · Page 1 of 2");
    expect(supabase.rpc).toHaveBeenCalledWith("admin_get_moderation_queue",{
      p_queue:"social",
      p_limit:25,
      p_offset:0
    });

    await act(async()=>{control(tree,"Next moderation page").props.onPress();});
    expect(supabase.rpc).toHaveBeenCalledWith("admin_get_moderation_queue",{
      p_queue:"social",
      p_limit:25,
      p_offset:25
    });
  });

  it("switches to the existing safety-report system",async()=>{
    installModeration();
    tree=await renderModeration();

    await act(async()=>{control(tree,"Open Safety reports").props.onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("admin_get_moderation_queue",{
      p_queue:"safety",
      p_limit:25,
      p_offset:0
    });
    expect(textOf(tree.toJSON())).toContain("Sunset walk");
    expect(textOf(tree.toJSON())).not.toContain("A reported moment summary");
  });

  it("requires a reason before opening the confirmation",async()=>{
    installModeration();
    tree=await renderModeration();

    await act(async()=>{
      control(tree,"Remove content for report social-report-1").props.onPress();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith("admin_decide_report",expect.anything());
    expect(textOf(tree.toJSON())).toContain("Decision reason required");
  });

  it("confirms a target-changing action through one audited RPC",async()=>{
    installModeration();
    tree=await renderModeration();

    await act(async()=>{
      control(tree,"Moderation reason for report social-report-1","onChangeText")
        .props.onChangeText("The reported moment breaches the community rules.");
    });
    await act(async()=>{
      control(tree,"Remove content for report social-report-1").props.onPress();
    });

    expect(confirmButton().style).toBe("destructive");
    await act(async()=>{await confirmButton().onPress();});

    expect(supabase.rpc).toHaveBeenCalledWith("admin_decide_report",{
      p_queue:"social",
      p_report_id:"social-report-1",
      p_decision:"actioned",
      p_reason:"The reported moment breaches the community rules."
    });
    expect(textOf(tree.toJSON())).toContain("Moderation decision saved");
  });

  it("shows one load error without stale report content",async()=>{
    installModeration({readError:"moderation read failed"});
    tree=await renderModeration();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Moderation reports could not be loaded");
    expect(text).toContain("moderation read failed");
    expect(text).not.toContain("A reported moment summary");
  });
});
