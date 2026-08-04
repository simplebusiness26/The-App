import React,{createContext,useCallback,useContext,useMemo,useState} from "react";

// Packet 4. The drawer replaces a route (/menu) with an overlay, so something
// has to own "is it open" above both the Header that opens it and the layout
// that draws it. That is all this does.

const DrawerContext=createContext(null);

export function DrawerProvider({children}){
  const [open,setOpen]=useState(false);

  const value=useMemo(()=>({
    open,
    openDrawer:()=>setOpen(true),
    closeDrawer:()=>setOpen(false)
  }),[open]);

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(){
  const value=useContext(DrawerContext);

  // The Header calls this on every screen. Returning a no-op rather than
  // throwing means a screen rendered outside the provider -- in a test, or in
  // some future layout -- shows a button that does nothing instead of crashing
  // the whole screen. The drawer is navigation, not a feature worth a crash.
  return value || {open:false,openDrawer:()=>{},closeDrawer:()=>{}};
}

export function useDrawerOptional(){
  return useContext(DrawerContext);
}

// Kept separate so the provider can be used without the hook importing React
// state machinery into modules that only need the shape.
export {DrawerContext};
