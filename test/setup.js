/* eslint-env jest */

// Everything a route needs in order to mount without a network, a device or a
// real Supabase project. Each mock is here because a route import fails
// without it, not on principle -- a smoke test that mocks the screen it is
// testing proves nothing.

// services/supabase.js throws at import time when the EXPO_PUBLIC_* variables
// are absent, so importing any route would fail before rendering. The mock is
// a chainable stub: every PostgREST builder method returns the same object,
// and awaiting it resolves to an empty result. Screens then take their "no
// data" path, which is the path a smoke test wants.
jest.mock("../services/supabase",()=>{
  const emptyResult={data:null,error:null};

  function createQuery(){
    const query={};
    const chainable=[
      "select","insert","update","upsert","delete","eq","neq","gt","gte","lt",
      "lte","like","ilike","is","in","or","and","not","contains","order",
      "limit","range","filter","match"
    ];

    for(const method of chainable){
      query[method]=jest.fn(()=>query);
    }

    query.single=jest.fn(()=>Promise.resolve(emptyResult));
    query.maybeSingle=jest.fn(()=>Promise.resolve(emptyResult));
    query.then=(resolve,reject)=>Promise.resolve({data:[],error:null}).then(resolve,reject);

    return query;
  }

  return{
    supabase:{
      from:jest.fn(()=>createQuery()),
      rpc:jest.fn(()=>Promise.resolve({data:null,error:null})),
      auth:{
        getUser:jest.fn(()=>Promise.resolve({data:{user:null},error:null})),
        getSession:jest.fn(()=>Promise.resolve({data:{session:null},error:null})),
        signUp:jest.fn(()=>Promise.resolve({data:{user:null,session:null},error:null})),
        signInWithPassword:jest.fn(()=>Promise.resolve({data:{user:null},error:null})),
        signOut:jest.fn(()=>Promise.resolve({error:null})),
        updateUser:jest.fn(()=>Promise.resolve({data:{user:null},error:null})),
        resetPasswordForEmail:jest.fn(()=>Promise.resolve({error:null})),
        exchangeCodeForSession:jest.fn(()=>Promise.resolve({data:{session:null},error:null})),
        setSession:jest.fn(()=>Promise.resolve({data:{session:null},error:null})),
        onAuthStateChange:jest.fn(()=>({data:{subscription:{unsubscribe:jest.fn()}}}))
      },
      functions:{
        invoke:jest.fn(()=>Promise.resolve({data:null,error:null}))
      },
      // NotificationContext opens a realtime channel, but only once there is a
      // signed-in user -- so the empty-result smoke tests never reached it and
      // it went unmocked until a test supplied a session (Packet 5a).
      channel:jest.fn(()=>{
        const subscription={};
        subscription.on=jest.fn(()=>subscription);
        subscription.subscribe=jest.fn(()=>subscription);
        subscription.unsubscribe=jest.fn();
        return subscription;
      }),
      removeChannel:jest.fn(),
      storage:{
        from:jest.fn(()=>({
          upload:jest.fn(()=>Promise.resolve({data:null,error:null})),
          remove:jest.fn(()=>Promise.resolve({data:null,error:null})),
          getPublicUrl:jest.fn(()=>({data:{publicUrl:""}}))
        }))
      }
    }
  };
});

// expo-router drives navigation from the file tree. Routes only need the
// imperative API and the param hooks to mount.
jest.mock("expo-router",()=>{
  const React=require("react");

  return{
    router:{
      push:jest.fn(),
      replace:jest.fn(),
      back:jest.fn(),
      canGoBack:jest.fn(()=>false),
      setParams:jest.fn()
    },
    useRouter:()=>({
      push:jest.fn(),
      replace:jest.fn(),
      back:jest.fn(),
      canGoBack:jest.fn(()=>false),
      setParams:jest.fn()
    }),
    useLocalSearchParams:()=>({}),
    useSearchParams:()=>({}),
    useSegments:()=>[],
    usePathname:()=>"/",
    // Route bodies run their loader through useFocusEffect. Treating it as
    // useEffect means the loader actually runs during the test, so a crash in
    // it is caught rather than skipped.
    useFocusEffect:(callback)=>React.useEffect(callback,[callback]),
    Link:({children})=>children,
    Stack:Object.assign(({children})=>children,{Screen:()=>null}),
    Tabs:Object.assign(({children})=>children,{Screen:()=>null}),
    Slot:()=>null,
    Redirect:()=>null
  };
});

jest.mock("expo-location",()=>({
  requestForegroundPermissionsAsync:jest.fn(()=>Promise.resolve({status:"denied"})),
  getCurrentPositionAsync:jest.fn(()=>Promise.resolve({coords:{latitude:0,longitude:0}})),
  reverseGeocodeAsync:jest.fn(()=>Promise.resolve([]))
}));

jest.mock("expo-image-picker",()=>({
  launchImageLibraryAsync:jest.fn(()=>Promise.resolve({canceled:true,assets:[]})),
  requestMediaLibraryPermissionsAsync:jest.fn(()=>Promise.resolve({status:"granted"})),
  MediaTypeOptions:{Images:"Images",Videos:"Videos",All:"All"}
}));

// expo-camera. The default is "not granted yet", because that is what every
// screen sees on a fresh install and the permission path is the one most likely
// to be got wrong.
//
// Props are forwarded and the ref is real, so a test can reach onBarcodeScanned
// and takePictureAsync. Without that, a camera screen can only ever be checked
// for "it rendered", which is how a Camera button that opened the photo library
// went unnoticed.
jest.mock("expo-camera",()=>{
  const React=require("react");

  let permission={granted:false,status:"undetermined"};
  let nextPicture={uri:"file:///tmp/shot.jpg",width:1000,height:1000};

  const CameraView=React.forwardRef(({children,...rest},ref)=>{
    React.useImperativeHandle(ref,()=>({
      takePictureAsync:async()=>nextPicture
    }),[]);
    return React.createElement("CameraView",rest,children);
  });

  return{
    CameraView,
    useCameraPermissions:()=>[permission,jest.fn()],
    // Test controls. Reset them yourself -- module state survives between tests
    // in a file, which is deliberate: several of these tests want a granted
    // camera for the whole file.
    __setCameraPermission:(next)=>{permission=next;},
    __setNextPicture:(next)=>{nextPicture=next;}
  };
});

// MapLibre React Native is a native module: it cannot load under Node, and the
// mock is what lets a test exercise the map screen's behaviour rather than only
// its imports.
//
// Props are passed through and children rendered, so a test can read the pins
// the screen asked for and press one -- exactly the reason the react-native-maps
// mock below does the same. A mock that swallows its children makes a map look
// healthy while it draws nothing.
jest.mock("@maplibre/maplibre-react-native",()=>{
  const React=require("react");
  const pass=(name)=>({children,...rest})=>React.createElement(name,rest,children);

  return{
    __esModule:true,
    Map:pass("MapLibreMap"),
    Camera:pass("MapLibreCamera"),
    Marker:pass("MapLibreMarker"),
    UserLocation:pass("MapLibreUserLocation"),
    ShapeSource:pass("MapLibreShapeSource")
  };
});

// react-native-maps is gone. It was the Google map, it was the only thing in
// this app carrying somebody else's logo, and MapLibre draws both maps now --
// so there is nothing left to mock. Its mock is deliberately NOT left behind
// as a harmless stub: a mock for a package that is not installed is how a
// re-introduced import goes unnoticed, and scripts/verify-my-map.cjs now fails
// on any file that imports it.

jest.mock("react-native-qrcode-svg",()=>{
  const React=require("react");
  return{__esModule:true,default:()=>React.createElement("QRCode")};
});

// Routes call Alert.alert on validation paths. Left unmocked it is a no-op on
// native, but silencing it keeps test output readable.
jest.spyOn(require("react-native").Alert,"alert").mockImplementation(()=>{});

// react-test-renderer warns under React 19. The warning is not a signal about
// the code under test, and drowning real output hides the ones that are.
const originalError=console.error;
console.error=(...args)=>{
  const first=typeof args[0]==="string" ? args[0] : "";
  if(first.includes("react-test-renderer is deprecated")) return;
  originalError(...args);
};
