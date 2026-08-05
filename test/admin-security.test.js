/* eslint-env jest */

const React=require("react");
const {Text}=require("react-native");
const {act,create}=require("react-test-renderer");
const {router}=require("expo-router");
const {supabase}=require("../services/supabase");
const {useAdminGate}=require("../hooks/useAdminGate");

function GateProbe(){
  const gate=useAdminGate();
  return React.createElement(
    Text,
    null,
    `${gate.checking}|${gate.allowed}|${gate.error}`
  );
}

async function renderGate(){
  let tree;
  await act(async()=>{tree=create(React.createElement(GateProbe));});
  return tree;
}

describe("admin access gate",()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
  });

  it("redirects a signed-out visitor without calling the admin RPC",async()=>{
    supabase.auth.getUser.mockResolvedValue({data:{user:null},error:null});

    const tree=await renderGate();

    expect(router.replace).toHaveBeenCalledWith("/auth/login");
    expect(supabase.rpc).not.toHaveBeenCalled();
    await act(async()=>{tree.unmount();});
  });

  it("allows an authenticated administrator using the database helper",async()=>{
    supabase.auth.getUser.mockResolvedValue({data:{user:{id:"admin-id"}},error:null});
    supabase.rpc.mockResolvedValue({data:true,error:null});

    const tree=await renderGate();

    expect(supabase.rpc).toHaveBeenCalledWith("guestbook_is_admin");
    expect(tree.root.findByType(Text).props.children).toBe("false|true|");
    await act(async()=>{tree.unmount();});
  });

  it("refuses an authenticated non-admin",async()=>{
    supabase.auth.getUser.mockResolvedValue({data:{user:{id:"explorer-id"}},error:null});
    supabase.rpc.mockResolvedValue({data:false,error:null});

    const tree=await renderGate();

    expect(tree.root.findByType(Text).props.children)
      .toBe("false|false|An admin account is required to open this screen.");
    await act(async()=>{tree.unmount();});
  });

  it("fails closed when administrator access cannot be confirmed",async()=>{
    supabase.auth.getUser.mockResolvedValue({data:{user:{id:"unknown-id"}},error:null});
    supabase.rpc.mockResolvedValue({data:null,error:{message:"network unavailable"}});

    const tree=await renderGate();

    expect(tree.root.findByType(Text).props.children)
      .toBe("false|false|Your admin access could not be confirmed.");
    await act(async()=>{tree.unmount();});
  });
});
