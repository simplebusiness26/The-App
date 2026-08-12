#!/usr/bin/env node
"use strict";

// Does every screen actually render in a browser?
//
// WHY THIS EXISTS, AND WHY IT IS NOT A JEST TEST.
//
// Twelve packets shipped screens marked "Verified: renders. Unverified:
// behaves", and a crash survived all of them: `components/MyMap.js` imported
// `react-native-maps`, which has no web build, and every profile went to a
// black screen. React 18 unmounts the whole root on an uncaught render error,
// so there was no header, no tab bar and no message.
//
// **Jest could not have caught it, and made it look fine.** `test/setup.js`
// mocks `react-native-maps` -- it has to, because the module cannot load under
// Node -- and that mock is exactly what makes a native-only import look
// healthy. 455 passing tests said nothing about a browser.
//
// So this loads the real production bundle in real Chromium and fails on an
// uncaught exception. It is the missing half of the harness Packet 0 built.
//
// ZERO DEPENDENCIES, ON PURPOSE. Node 22 ships a WebSocket client, so this
// drives Chrome DevTools Protocol directly. Adding puppeteer or playwright to
// package.json needs asking (RULES.md), and a verification tool that itself
// needs a new dependency tends not to get run.
//
// USAGE
//   npx expo export --platform web      # this reads dist/, it does not build
//   node scripts/verify-browser.cjs
//
//   DIST_DIR=dist-ci    point at another export directory (CI uses this)
//
//   REQUIRE_BROWSER=1  fail instead of skip when no Chromium is found
//   CHROMIUM_PATH=...  point at a specific binary
//   ONLY_ROUTES=/a,/b  check just these, instead of all of them. Added for
//                      Packet 21's spike: "does one map screen survive a real
//                      browser" is a question worth being able to ask in
//                      seconds rather than by running forty routes.

const fs=require("fs");
const path=require("path");
const http=require("http");
const {spawn,execSync}=require("child_process");

const root=path.join(__dirname,"..");
const dist=path.join(root,process.env.DIST_DIR || "dist");

// Every route a person can reach. Dynamic segments get a real-looking id so the
// screen loads its data path rather than sitting on a missing param.
const ID="198295b9-47ae-4d5e-982a-b96249ac91ac";
const ROUTES=[
  "/","/map","/discover","/create","/leaderboards","/profile","/feed","/live",
  "/linkups","/linkups/create","/places","/explorers","/notifications","/settings",
  "/memories/create","/moments/create","/checkins/create","/saved","/scan",
  `/profile/${ID}`,`/business/${ID}`,`/property/${ID}`,`/events/${ID}`,
  `/activity-clubs/${ID}`,`/places/${ID}`,`/memories/${ID}`,`/moments/${ID}`,
  "/events","/activity-clubs","/manager/dashboard","/manager/requests",
  "/admin/dashboard","/admin/listings","/admin/claims","/admin/activities",
  "/admin/moderation","/admin/explorers","/admin/areas","/admin/audit",
  "/auth/login","/auth/signup","/auth/forgot-password"
];

// Hosts whose answers must be real. Anything the map fetches -- style, sprites,
// fonts, vector tiles -- is relayed rather than stubbed.
const MAP_HOST=/^https:\/\/[^/]*(openfreemap|openmaptiles|maplibre|basemaps|protomaps)\./;

const ONLY=(process.env.ONLY_ROUTES || "")
  .split(",").map((route)=>route.trim()).filter(Boolean);
const CHECKING=ONLY.length ? ONLY : ROUTES;


// A row shaped loosely enough that any screen's read gets something usable.
// This is a crash smoke test, not a content test -- what matters is that the
// render path executes, not that the data is meaningful.
const ROW={
  id:ID,user_id:ID,name:"Test Place",full_name:"Test Explorer",title:"Test",
  account_type:"explorer",status:"open",area:"Hastings",show_area:true,
  leaderboard_opt_in:true,bio:"bio",latitude:50.8,longitude:0.5,
  category:"food_and_drink",business_type:"pub",claimed:true,
  target_type:"business",target_id:ID,target_name:"Test Place",
  item_type:"linkup",item_id:ID,rating:4,comment:"comment",
  created_at:"2026-08-01T00:00:00Z",starts_at:"2026-08-20T18:00:00Z",
  ends_at:"2026-08-20T21:00:00Z",is_admin:false,visibility:"public"
};

function findChromium(){
  if(process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;

  const browsers=process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if(fs.existsSync(browsers)){
    for(const entry of fs.readdirSync(browsers)){
      const candidate=path.join(browsers,entry,"chrome-linux","chrome");
      if(fs.existsSync(candidate)) return candidate;
    }
  }

  for(const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    try{
      const found=execSync(`command -v ${name}`,{encoding:"utf8"}).trim();
      if(found) return found;
    }catch{ /* not installed */ }
  }

  return null;
}

function serve(port){
  const types={".js":"text/javascript",".html":"text/html",".css":"text/css",
    ".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};

  const server=http.createServer((req,res)=>{
    let file=path.join(dist,decodeURIComponent(req.url.split("?")[0]));
    // Expo Router routes resolve client-side, so anything unknown is the shell.
    if(!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(dist,"index.html");
    res.writeHead(200,{"Content-Type":types[path.extname(file)] || "text/html"});
    fs.createReadStream(file).pipe(res);
  });

  return new Promise(resolve=>server.listen(port,()=>resolve(server)));
}

function get(url){
  return new Promise((resolve,reject)=>{
    http.get(url,res=>{
      let body="";
      res.on("data",chunk=>{body+=chunk;});
      res.on("end",()=>resolve(body));
    }).on("error",reject);
  });
}

async function waitFor(fn,timeoutMs,label){
  const deadline=Date.now()+timeoutMs;
  let lastError=null;

  while(Date.now()<deadline){
    try{
      const value=await fn();
      if(value) return value;
    }catch(error){
      lastError=error;
    }
    await new Promise(r=>setTimeout(r,250));
  }

  throw new Error(`timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

// A very small CDP client. One socket, id-matched replies, event handlers.
class Devtools{
  constructor(socket){
    this.socket=socket;
    this.nextId=1;
    this.pending=new Map();
    this.handlers=[];

    socket.addEventListener("message",event=>{
      const message=JSON.parse(event.data);

      if(message.id && this.pending.has(message.id)){
        const {resolve,reject}=this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }

      for(const handler of this.handlers) handler(message);
    });
  }

  send(method,params={},sessionId){
    const id=this.nextId++;
    const payload={id,method,params};
    if(sessionId) payload.sessionId=sessionId;

    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.socket.send(JSON.stringify(payload));
      setTimeout(()=>{
        if(this.pending.has(id)){
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      },30000);
    });
  }

  on(handler){ this.handlers.push(handler); }
}

async function main(){
  if(!fs.existsSync(path.join(dist,"index.html"))){
    console.error(`${path.relative(root,dist)}/index.html is missing. Run \`npx expo export --platform web\` first.`);
    console.error("This gate loads the built bundle; it does not build one.");
    process.exit(1);
  }

  const chromium=findChromium();
  if(!chromium){
    const message="no Chromium found — set CHROMIUM_PATH, or install one";
    if(process.env.REQUIRE_BROWSER==="1"){
      console.error(`Browser check FAILED: ${message}.`);
      process.exit(1);
    }
    // Loud on purpose. A skipped check that reads like a pass is how a whole
    // class of defect stays invisible.
    console.log(`Browser check SKIPPED — ${message}.`);
    console.log("Set REQUIRE_BROWSER=1 to make this a failure instead.");
    process.exit(0);
  }

  // The auth storage key is keyed by Supabase project ref, and the ref is
  // baked into the bundle by `expo export`. Reading it from the build keeps the
  // gate correct for whatever project the bundle was built against.
  let projectRef="unknown";
  try{
    const webDir=path.join(dist,"_expo","static","js","web");
    for(const name of fs.readdirSync(webDir)){
      const match=fs.readFileSync(path.join(webDir,name),"utf8").match(/https:\/\/([a-z0-9]{16,})\.supabase\.co/);
      if(match){ projectRef=match[1]; break; }
    }
  }catch{ /* left as unknown; the session stub simply will not apply */ }

  if(projectRef==="unknown"){
    console.error("Could not find the Supabase project ref in the bundle.");
    console.error("Without it no session can be stubbed, and every signed-in route would");
    console.error("silently render the login screen and be reported as passing.");
    console.error("");
    console.error("The bundle only carries the ref if EXPO_PUBLIC_SUPABASE_URL was set when");
    console.error("`expo export` ran. In CI that comes from repository secrets:");
    console.error("  Settings > Secrets and variables > Actions");
    console.error("  EXPO_PUBLIC_SUPABASE_URL");
    console.error("  EXPO_PUBLIC_SUPABASE_ANON_KEY");
    console.error("Both are public by design -- they ship in every APK -- but they are");
    console.error("yours to add rather than something to hardcode here.");
    process.exit(1);
  }

  const port=4712;
  const server=await serve(port);
  const userDataDir=fs.mkdtempSync(path.join(require("os").tmpdir(),"xplorer-browser-"));

  const browser=spawn(chromium,[
    "--headless=new","--remote-debugging-port=9333","--no-sandbox",
    // --disable-gpu was here and it made a map untestable: MapLibre draws with
    // WebGL, and without a context it throws before it ever renders. SwiftShader
    // is a software renderer, so the map draws on a machine with no graphics
    // card at all -- which is every CI box and this one. Slower, and the only
    // way this gate can say anything about a map.
    "--use-gl=swiftshader","--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage","--no-first-run","--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,"about:blank"
  ],{stdio:"ignore"});

  const failures=[];
  const results=[];

  try{
    const version=JSON.parse(await waitFor(
      ()=>get("http://127.0.0.1:9333/json/version").catch(()=>null),
      20000,"Chromium devtools"
    ));

    const socket=new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      socket.addEventListener("open",resolve);
      socket.addEventListener("error",()=>reject(new Error("devtools socket failed")));
    });

    const cdp=new Devtools(socket);

    for(const route of CHECKING){
      const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});

      const errors=[];
      const listener=message=>{
        if(message.sessionId!==sessionId) return;

        if(message.method==="Runtime.exceptionThrown"){
          const detail=message.params?.exceptionDetails;
          const text=detail?.exception?.description || detail?.text || "unknown exception";
          errors.push(String(text).split("\n")[0].slice(0,180));
        }

        if(message.method==="Log.entryAdded" && message.params?.entry?.level==="error"){
          const text=message.params.entry.text || "";
          // Blocked requests are this sandbox, not the app.
          if(!/Failed to load resource|net::ERR|favicon/.test(text)){
            errors.push(text.split("\n")[0].slice(0,180));
          }
        }
      };

      cdp.on(listener);

      // WITHOUT A SESSION THIS GATE PROVES ALMOST NOTHING. Every authenticated
      // route redirects to /auth/login, so the first version of this reported
      // "ok" for twenty screens while rendering the login page twenty times --
      // identical 285-character bodies were the giveaway. The Supabase client
      // reads its session from localStorage before it ever hits the network, so
      // it has to be there before the first script runs.
      await cdp.send("Page.addScriptToEvaluateOnNewDocument",{
        source:`localStorage.setItem(${JSON.stringify(`sb-${projectRef}-auth-token`)},${JSON.stringify(JSON.stringify({
          access_token:"stub",token_type:"bearer",expires_in:3600,
          expires_at:Math.floor(Date.now()/1000)+86400,refresh_token:"stub",
          user:{id:ID,aud:"authenticated",role:"authenticated",email:"probe@example.com",
                app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"}
        }))});`
      },sessionId);

      await cdp.send("Runtime.enable",{},sessionId);
      await cdp.send("Log.enable",{},sessionId);
      await cdp.send("Page.enable",{},sessionId);
      await cdp.send("Fetch.enable",{patterns:[{urlPattern:"*"}]},sessionId);

      // Answer the app's data reads locally. Without this every screen shows
      // its error state, which renders too little to be worth asserting on.
      const stub=message=>{
        if(message.sessionId!==sessionId || message.method!=="Fetch.requestPaused") return;
        const {requestId,request}=message.params;

        if(request.url.startsWith(`http://127.0.0.1:${port}`)){
          cdp.send("Fetch.continueRequest",{requestId},sessionId).catch(()=>{});
          return;
        }

        // The stub is a cross-origin server as far as the page is concerned, so
        // it has to answer preflight and echo the allowed headers. Declared up
        // here because the map relay below needs it too.
        const cors=[
          {name:"Access-Control-Allow-Origin",value:"*"},
          {name:"Access-Control-Allow-Methods",value:"GET,POST,PATCH,DELETE,OPTIONS"},
          {name:"Access-Control-Allow-Headers",
           value:request.headers?.["access-control-request-headers"] || request.headers?.["Access-Control-Request-Headers"] || "*"},
          {name:"Access-Control-Expose-Headers",value:"content-range"}
        ];

        // The map provider gets REAL data, fetched by Node and handed over.
        //
        // This cost Packet 21's spike an hour. The stub matched urlPattern "*"
        // and answered EVERY request with `[ROW]`, so MapLibre asked for its
        // style, got a JSON array, and reported "object expected, array found".
        // Metro, the worker and WebGL were all working perfectly; the harness
        // was lying to the map.
        //
        // Node does the fetching rather than the browser because in a sandbox
        // the shell reaches the internet through a proxy and a headless browser
        // does not -- curl succeeds and a page fetch fails. Node has the same
        // access curl has, so it relays.
        //
        // A stubbed map is a map that proves nothing, which is why this is
        // worth the fifteen lines.
        if(MAP_HOST.test(request.url)){
          (async()=>{
            try{
              const upstream=await fetch(request.url);
              const bytes=Buffer.from(await upstream.arrayBuffer());
              await cdp.send("Fetch.fulfillRequest",{
                requestId,
                responseCode:upstream.status,
                responseHeaders:[
                  {name:"Content-Type",value:upstream.headers.get("content-type") || "application/octet-stream"},
                  ...cors
                ],
                body:bytes.toString("base64")
              },sessionId);
            }catch(problem){
              // Offline, or the provider is down. Fail the request rather than
              // faking it: a map that renders because the harness invented a
              // tile is worse than one that visibly did not load.
              cdp.send("Fetch.failRequest",{requestId,errorReason:"ConnectionFailed"},sessionId).catch(()=>{});
            }
          })();
          return;
        }

        // The stub is a cross-origin server as far as the page is concerned, so
        // it has to answer preflight and echo the allowed headers. Getting this
        // wrong made the first run report 13 CORS failures that were entirely
        // the harness's own doing -- a gate that cries wolf is worse than none.
        if(request.method==="OPTIONS"){
          cdp.send("Fetch.fulfillRequest",{
            requestId,responseCode:204,responseHeaders:cors,body:""
          },sessionId).catch(()=>{});
          return;
        }

        const single=/vnd\.pgrst\.object/.test(request.headers?.Accept || request.headers?.accept || "");

        // The admin gate asks the database, not the profile row. Answering it
        // truthfully as "false" left all eight admin screens rendering the same
        // 121-character "Admin access required" notice, so none of their real
        // content was ever exercised.
        let body;
        if(/\/rpc\/guestbook_is_admin/.test(request.url)) body="true";
        else if(/\/auth\/v1\//.test(request.url)) body=JSON.stringify({id:ID,aud:"authenticated",role:"authenticated"});
        else body=single ? JSON.stringify(ROW) : JSON.stringify([ROW]);

        cdp.send("Fetch.fulfillRequest",{
          requestId,responseCode:200,
          responseHeaders:[{name:"Content-Type",value:"application/json"},...cors],
          body:Buffer.from(body).toString("base64")
        },sessionId).catch(()=>{});
      };

      cdp.on(stub);

      await cdp.send("Page.navigate",{url:`http://127.0.0.1:${port}${route}`},sessionId);
      // 2.6s was enough for a screen that reads a table. A map is not: it
      // fetches a style, then sprites, then vector tiles, and Packet 21's
      // spike sat at "constructed" purely because nothing waited for that.
      //
      // 6.2s now, and the extra is not padding. components/StartupSplash.js
      // covers the whole app for a fixed five seconds on every start -- that is
      // where the OpenStreetMap credit lives now that the map carries none --
      // and it covers this browser too. At 2.6s this gate would have read the
      // splash on all 42 routes and called every one of them "ok", which is
      // exactly the blindness the login-redirect check below exists to stop.
      await new Promise(r=>setTimeout(r,Number(process.env.SETTLE_MS || 6200)));

      let text="";
      try{
        const evaluated=await cdp.send("Runtime.evaluate",{
          expression:"document.body ? document.body.innerText : ''",
          returnByValue:true
        },sessionId);
        text=(evaluated?.result?.value || "").trim();
      }catch{ /* the page is already the failure */ }

      await cdp.send("Target.closeTarget",{targetId}).catch(()=>{});

      const crashed=/Something broke on this screen/.test(text);
      const unique=[...new Set(errors)];

      // The trap this gate fell into once already: with no session every
      // signed-in route redirects to /auth/login, and the run reports "ok" for
      // twenty screens while rendering the login page twenty times. A route
      // that lands on login is not a rendered route.
      if(!route.startsWith("/auth/") && /Quick test login|Don.t have an account/.test(text)){
        unique.push("redirected to the login screen — the stubbed session did not apply");
      }

      // Same trap, different cover. If the splash is still up, what was
      // measured is the splash and not the route.
      if(/Map data from OpenStreetMap/.test(text)){
        unique.push("still showing the startup splash — raise SETTLE_MS above the splash duration");
      }

      if(process.env.DUMP_ROUTE===route){
        console.log("--- DUMP "+route+" ---");
        console.log(text);
        console.log("--- END ---");
      }
      results.push({route,length:text.length,crashed,errors:unique});

      if(crashed || unique.length){
        failures.push({route,text:text.slice(0,400),errors:unique});
      }
    }

    socket.close();
  }finally{
    browser.kill();
    server.close();
    // Chromium is still flushing its profile when it is killed, so a plain
    // rmSync races it and throws ENOTEMPTY -- which would fail the run for a
    // reason that has nothing to do with the app.
    try{
      fs.rmSync(userDataDir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    }catch{ /* a temp directory left behind is not worth failing over */ }
  }

  for(const result of results){
    const flag=result.crashed ? "CRASH" : (result.errors.length ? "ERROR" : "ok   ");
    const said=process.env.SHOW_TEXT ? ` :: ${(result.text || "").replace(/\s+/g," ").slice(0,160)}` : "";
    console.log(`  ${flag} ${result.route.padEnd(46)} ${String(result.length).padStart(5)} chars ${result.errors[0] || ""}${said}`);
  }

  if(failures.length){
    console.error(`\nBrowser check FAILED: ${failures.length} of ${CHECKING.length} routes threw.`);
    for(const failure of failures){
      console.error(`  ${failure.route}`);
      for(const error of failure.errors) console.error(`      ${error}`);
      // What the page actually said. A crash caught by the error boundary
      // produces no console error at all, so without this the report is a
      // route name and nothing to act on -- which is what it was during
      // Packet 21's spike.
      if(!failure.errors.length && failure.text){
        console.error(`      page said: ${failure.text}`);
      }
    }
    process.exit(1);
  }

  console.log(`\nBrowser check passed (${CHECKING.length} routes rendered without an uncaught error).`);
}

main().catch(error=>{
  console.error("Browser check could not run:",error.message);
  process.exit(1);
});
