// THE VISUAL VERIFICATION LOOP
//
// CLAUDE.md invariant 15: nothing is done until it has been rendered and looked
// at. This drives the real exported app in a real browser at a real device
// viewport, screenshots every route it is given, and then asserts MECHANICALLY
// on the rendered geometry -- because a unit test asserting a control renders
// passes happily while that control is ten times its intended height.
//
//   npm run verify:rendered                 -- every route in routes.txt
//   npm run verify:rendered -- /discover /settings
//
// It needs the app exported and served first:
//
//   npx expo export --platform web --clear
//   npx serve dist -l 8081 --single
//
// ...and playwright available (NODE_PATH=/path/to/global/node_modules if it is
// installed globally rather than in this repo).
//
// Checks, per route:
//   stretch   -- a child far taller than its siblings' median (the 402px pill bug)
//   overlap   -- an interactive element with something else on top of it at its centre
//   chrome    -- content underneath the tab bar or outside the safe area
//   palette   -- the pixels that actually rendered, sampled and bucketed
//   console   -- any page error at all

const {chromium}=require("playwright");
const fs=require("fs");
const path=require("path");

const OUT=process.env.SHOT_DIR||path.join(__dirname,"shots");
fs.mkdirSync(OUT,{recursive:true});

const BASE=process.env.APP_BASE||"http://127.0.0.1:8081";
// The Supabase project ref, only ever used to name the local-storage key the
// client reads its session from. Overridable so this harness is not welded to
// one project.
const PROJECT_REF=process.env.SUPABASE_REF||"yzpthslwsvesgndzdqai";
const VIEWPORT={width:412,height:915};

// The Field Instrument palette, as the pixels a screenshot should contain.
const PALETTE={
  ground:[0x0F,0x12,0x16], panel:[0x16,0x1B,0x22], panelRaised:[0x1E,0x25,0x2E],
  inset:[0x0B,0x0E,0x12], hairline:[0x26,0x2E,0x38], hairlineStrong:[0x38,0x42,0x4E],
  readout:[0xE8,0xED,0xF2], readoutSoft:[0x97,0xA3,0xB2], readoutFaint:[0x83,0x90,0xA0],
  exists:[0x4C,0xC9,0xE8], scheduled:[0xFF,0xAB,0x2E], offer:[0xA7,0x8B,0xFA]
};
// The incumbent riso palette. A single one of these on screen is a failure:
// it means the old design survived the redesign somewhere.
// risoInk (#1A1A1A) is deliberately NOT in this list. It is a near-black, and a
// shadow over the instrument's own ground blends to within a few points of it --
// so it reports constantly and means nothing. The four that remain are
// unmistakable: a warm paper, a flat blue, a hot pink and a signal yellow. None
// of them can be arrived at by accident on a dark housing.
const INCUMBENT={
  risoPaper:[0xF5,0xF1,0xE8], risoBlue:[0x2F,0x5C,0xE5],
  risoPink:[0xFF,0x48,0x8B], risoYellow:[0xFF,0xD1,0x02]
};

function near(px,ref,tol){return Math.abs(px[0]-ref[0])<=tol&&Math.abs(px[1]-ref[1])<=tol&&Math.abs(px[2]-ref[2])<=tol;}

const GEOMETRY=(atEnd)=>`(() => {
  const ATEND=${atEnd?'true':'false'};
  const out={stretch:[],overlap:[],chrome:[],offscreen:[],floatsOver:[]};
  const vw=window.innerWidth, vh=window.innerHeight;

  // --- STRETCH -------------------------------------------------------------
  // A flex child that claims leftover space and blows out. Compared against the
  // MEDIAN of its siblings, so a legitimately tall hero does not trip it and a
  // row of pills where one is 12x the rest does.
  for(const parent of document.querySelectorAll("div")){
    // THE BUG THIS LOOKS FOR HAS A SHAPE. It is a control blown up by a flex
    // parent laying its children out in a ROW and stretching them to its own
    // height -- the 402px filter pills. In a COLUMN, a child being much taller
    // than its siblings is just a card with a paragraph in it, which is normal
    // and was drowning the real finding in noise.
    const ps=getComputedStyle(parent);
    if(ps.display!=="flex"&&ps.display!=="inline-flex") continue;
    if(!ps.flexDirection.startsWith("row")) continue;
    const kids=[...parent.children].filter(k=>k.getBoundingClientRect().height>0);
    if(kids.length<3) continue;
    const hs=kids.map(k=>k.getBoundingClientRect().height).sort((a,b)=>a-b);
    const median=hs[Math.floor(hs.length/2)];
    if(median<=0||median>200) continue;
    for(const k of kids){
      const h=k.getBoundingClientRect().height;
      // A full-height child of a full-height parent is a screen layer, not a
      // stretched control. The bug this looks for is a small thing blown up by
      // an unconstrained flex parent, so anything near the viewport height is
      // out of scope by definition.
      if(h>=vh*0.85) continue;
      if(getComputedStyle(k).position==="absolute") continue;
      if(h>median*4&&h>160){
        out.stretch.push({tag:k.tagName,text:(k.textContent||"").trim().slice(0,40),height:Math.round(h),median:Math.round(median)});
      }
    }
  }

  // --- OVERLAP -------------------------------------------------------------
  // Anything tappable whose own centre point belongs to something else.
  const tappables=[...document.querySelectorAll('[role="button"],[role="tab"],button,a,input,[tabindex]')];
  for(const el of tappables){
    const r=el.getBoundingClientRect();
    if(r.width<8||r.height<8) continue;
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    if(cx<0||cy<0||cx>vw||cy>vh) continue;
    const stack=document.elementsFromPoint(cx,cy);
    const idx=stack.indexOf(el);
    if(idx<0) continue;
    // A BIG SURFACE WITH SOMETHING ON IT IS NOT AN OCCLUSION.
    // A map fills the screen and its own marker sits on top of it; a photo has
    // a play control over it. That is layering by design. Occlusion matters
    // when a CONTROL is covered, so anything the size of a canvas is out.
    if(r.width*r.height>vw*vh*0.5) continue;
    const covering=stack.slice(0,idx).find(n=>!el.contains(n)&&n!==el);
    if(covering){
      // A SMALL THING ON A BIG SURFACE IS LAYERING, NOT OCCLUSION. A location
      // picker's map carries its own pin; a photo carries its play control.
      // Eight times the area is the line: a chip over a chip is a bug, a 26px
      // marker on a 300px map is the widget working.
      const c=covering.getBoundingClientRect();
      if(c.width*c.height*8<r.width*r.height) continue;
    }
    if(covering){
      const by=(()=>{
        for(let n=covering;n;n=n.parentElement){
          const l=n.getAttribute&&n.getAttribute("aria-label");
          if(l) return l;
        }
        return (covering.className||covering.tagName).toString();
      })().trim().slice(0,40);

      // A FLOATING ACTION PASSING OVER SCROLLING CONTENT IS NOT A BUG.
      // The Create action is fixed to the bottom-right corner of every screen,
      // so on any long page it will sit over SOMETHING at some scroll offset --
      // that is what a floating action is. What would be a bug is content the
      // page cannot move out from under it, and the scrolled-to-the-end pass
      // below is what asks that question. Reported as a note either way, so it
      // is never silently swallowed.
      const scrolls=(()=>{
        for(let n=el;n;n=n.parentElement){
          if(n.scrollHeight>n.clientHeight+40) return true;
        }
        return false;
      })();
      const floating=/^(create|open create)$/i.test(by);
      if(floating&&scrolls&&!ATEND) out.floatsOver.push({el:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,40),by});
      else out.overlap.push({el:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,40),by});
    }
  }

  // --- CHROME COLLISION ----------------------------------------------------
  // The tab bar is fixed to the bottom. Anything tappable sitting under it is
  // unreachable, which no unit test in this repo would ever notice.
  const bars=[...document.querySelectorAll('[role="tablist"]')].filter(b=>{
    const r=b.getBoundingClientRect();
    return r.bottom>vh-8&&r.height>40;
  });
  const bar=bars[0];
  if(bar){
    const br=bar.getBoundingClientRect();
    for(const el of tappables){
      if(bar.contains(el)) continue;
      const r=el.getBoundingClientRect();
      if(r.height<8||r.width<8) continue;
      // Fully below the fold on a page that has not been scrolled yet is not
      // a collision -- the screen's bottom padding is what it will scroll
      // into. The second pass below scrolls to the end and asks again, which
      // is where a missing CREATE_HUB_CLEARANCE actually shows up.
      // Only meaningful once a page is scrolled as far as it goes: before
      // that, anything near the bottom edge is simply content the page will
      // scroll into. The caller runs this twice and keeps the second answer.
      if(r.top>vh) continue;
      if(!ATEND) continue;
      if(r.bottom>br.top+4&&r.top<br.bottom){
        out.chrome.push({el:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,40),bottom:Math.round(r.bottom),barTop:Math.round(br.top)});
      }
    }
  }

  // --- OFF-CANVAS ----------------------------------------------------------
  // Something the page can never bring into view. A control inside a SIDEWAYS
  // SCROLLER is not that -- a filter row is meant to run past the edge, and
  // reporting each chip in it buries the real finding under a dozen false ones.
  const inScroller=(el)=>{
    for(let n=el;n;n=n.parentElement){
      if(n.scrollWidth>n.clientWidth+8) return true;
      const ox=getComputedStyle(n).overflowX;
      if(ox==="auto"||ox==="scroll") return true;
    }
    return false;
  };
  for(const el of tappables){
    const r=el.getBoundingClientRect();
    if(r.width<8||r.height<8) continue;
    if(inScroller(el)) continue;
    if(r.right>vw+2||r.left<-2) out.offscreen.push({el:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,40),left:Math.round(r.left),right:Math.round(r.right)});
  }

  // --- CONTRAST, AS RENDERED -----------------------------------------------
  //
  // scripts/verify-contrast.cjs reads style BLOCKS out of the source, so as
  // screens moved onto the kit its coverage collapsed from 1173 pairs to 134 --
  // not because the app got safer, but because the pairs stopped being written
  // in a place a regex can see. A kit component sets its colour in one file and
  // sits on a surface painted in another.
  //
  // This asks the browser instead. For every visible run of text: what colour
  // is it, what is actually behind it, and what is the ratio. It cannot be
  // fooled by where the declaration lives.
  const lum=(c)=>{
    const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);
  };
  const parse=(str)=>{
    const m=String(str).match(/rgba?\(([^)]+)\)/);
    if(!m) return null;
    const p=m[1].split(",").map(v=>parseFloat(v.trim()));
    return {rgb:[p[0],p[1],p[2]],a:p.length>3?p[3]:1};
  };
  // What is really behind this text: walk up compositing every semi-transparent
  // layer onto the one below, ending at the page ground.
  const groundUnder=(el)=>{
    let acc=null;
    for(let n=el;n;n=n.parentElement){
      const c=parse(getComputedStyle(n).backgroundColor);
      if(!c||c.a===0) continue;
      acc=acc?[0,1,2].map(i=>c.rgb[i]*c.a+acc[i]*(1-c.a)):(c.a<1?[0,1,2].map(i=>c.rgb[i]*c.a):c.rgb);
      if(c.a>=1) return acc;
    }
    return acc||[15,18,22];
  };
  out.contrast=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const judged=new Set();
  let node;
  while((node=walker.nextNode())){
    const txt=(node.textContent||"").trim();
    if(txt.length<2) continue;
    const el=node.parentElement;
    if(!el||judged.has(el)) continue;
    judged.add(el);
    const r=el.getBoundingClientRect();
    if(r.width<4||r.height<4||r.top>vh||r.bottom<0) continue;
    const cs=getComputedStyle(el);
    if(cs.visibility==="hidden"||cs.opacity==="0") continue;
    const fg=parse(cs.color);
    if(!fg||fg.a===0) continue;
    const bg=groundUnder(el);
    const blended=fg.a<1?[0,1,2].map(i=>fg.rgb[i]*fg.a+bg[i]*(1-fg.a)):fg.rgb;
    const L1=lum(blended),L2=lum(bg);
    const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size=parseFloat(cs.fontSize)||14;
    const weight=parseInt(cs.fontWeight,10)||400;
    // WCAG "large text": 18px, or 14px at bold.
    const need=(size>=18||(size>=14&&weight>=700))?3.0:4.5;
    if(ratio+0.01<need){
      out.contrast.push({txt:txt.slice(0,34),ratio:Math.round(ratio*100)/100,need,size:Math.round(size)});
    }
  }

  // --- TAP TARGETS ---------------------------------------------------------
  out.small=tappables.filter(el=>{
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.height<40&&!el.closest('[role="tablist"]');
  }).map(el=>({el:(el.getAttribute("aria-label")||el.textContent||el.tagName).trim().slice(0,30),h:Math.round(el.getBoundingClientRect().height)})).slice(0,8);

  return out;
})()`;

// A believable row for each table the screens read most. Deliberately small:
// this is here so a screen has SHAPE to draw, not so the app can be tested
// against real data.
const FIXTURE={
  user:{id:"explorer-1",email:"explorer@example.com",user_metadata:{name:"Sam Okafor"}},
  tables:{
    businesses:[
      {id:"b1",name:"The Bridge Tavern",type:"pub",address:"14 Mill Lane",latitude:51.5,longitude:-0.1,rating:4.4,review_count:38,claimed:true,distance_m:420},
      {id:"b2",name:"Corner Bakehouse",type:"bakery",address:"3 Fell Road",latitude:51.51,longitude:-0.11,rating:4.8,review_count:112,claimed:false,distance_m:1250}
    ],
    properties:[{id:"p1",name:"Harbour View Rooms",address:"9 Quay Street",rating:4.2,review_count:17,latitude:51.49,longitude:-0.12}],
    activity_clubs:[
      {id:"c1",name:"Thursday Sea Swimmers",kind:"swimming",member_count:34,next_session_at:new Date(0).toISOString()},
      {id:"c2",name:"Fell Runners",kind:"running",member_count:12}
    ],
    events:[{id:"e1",title:"Harbour Night Market",starts_at:new Date(0).toISOString(),venue:"The Quay",going_count:86}],
    linkups:[{id:"l1",title:"Coffee before work",spaces:4,taken:2,starts_at:new Date(0).toISOString()}],
    // onboarding_seen_at is what suppresses components/VisibilityWelcome.js --
    // the first-run privacy gate. It is correct product behaviour and it covers
    // the whole screen, so without this every signed-in route is photographed
    // through the same modal. Verified once on its own; suppressed here so the
    // pass looks at the screens underneath it, which is what a returning
    // Explorer sees.
    profiles:[{id:"explorer-1",name:"Sam Okafor",handle:"sam",points:412,rank:7,followers:63,following:88,
      visibility:"friends",onboarding_seen_at:"2026-01-01T00:00:00.000Z"}],
    notifications:[{id:"n1",kind:"follow",title:"Priya Raman started following you",created_at:new Date(0).toISOString(),read:false}],
    reviews:[{id:"r1",rating:5,comment:"The back room is the quietest place in town to work.",author_name:"Priya Raman",created_at:new Date(0).toISOString(),verified_qr:true}],
    messages:[{id:"m1",body:"See you at seven",sender_id:"explorer-2",created_at:new Date(0).toISOString()}]
  }
};

(async()=>{
  // No arguments means every route in routes.txt -- the set worth looking at on
  // every change, one per product area plus the two signature surfaces.
  let routes=process.argv.slice(2);
  if(!routes.length){
    const list=path.join(__dirname,"routes.txt");
    if(fs.existsSync(list)){
      routes=fs.readFileSync(list,"utf8").split("\n").map(r=>r.trim()).filter(Boolean);
    }
  }
  if(!routes.length){console.error("usage: node verify-rendered.cjs <route>...  (or fill routes.txt)");process.exit(2);}

  const browser=await chromium.launch({args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
  const report=[];

  for(const route of routes){
    const slug=route.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"index";
    const page=await browser.newPage({viewport:VIEWPORT,deviceScaleFactor:2,permissions:["camera","microphone","geolocation"]});
    // ------------------------------------------------------------------
    // A SESSION, SEEDED BEFORE THE APP BOOTS
    // ------------------------------------------------------------------
    //
    // Stubbing the network is not enough on its own. supabase-js reads the
    // session out of local storage first and only then talks to the server, so
    // a signed-out browser sends every guarded screen straight to /auth/login --
    // and the harness happily reported six different routes as "clean" when all
    // six had rendered the same login form. A verification pass that photographs
    // the wrong screen and calls it a pass is worse than no pass at all.
    //
    // So the session is written before any app code runs.
    await page.addInitScript(({ref,user})=>{
      const now=Math.floor(Date.now()/1000);
      const session={
        access_token:"stub",token_type:"bearer",expires_in:3600,
        expires_at:now+3600,refresh_token:"stub",user
      };
      try{
        window.localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));
      }catch(e){/* storage disabled: the run still tells us about signed-out */}
    },{ref:PROJECT_REF,user:FIXTURE.user});

    // ------------------------------------------------------------------
    // THE BACKEND, STUBBED — so the screens actually have something to draw
    // ------------------------------------------------------------------
    //
    // This sandbox has no route to Supabase, so every read hangs and every
    // data-driven screen sits on its spinner for ever. Screenshotting that
    // proves the loading state is styled and nothing else, which is not what
    // "rendered and looked at" is supposed to mean.
    //
    // So the network is answered here. Reads return a small fixture keyed off
    // the table in the URL, RPCs return an empty list, auth returns a session,
    // and anything unrecognised returns [] rather than hanging -- an empty list
    // is a DESIGNED state in this app (every list has an Empty with a real
    // instruction), so even the fallback renders something worth looking at.
    //
    // Nothing here touches the real project. It is a lens on the front end.
    await page.route(/supabase\.co\/(rest|rpc|auth|storage)/i,async(route)=>{
      const url=route.request().url();
      const json=(body)=>route.fulfill({
        status:200,
        contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify(body)
      });
      if(/\/auth\/v1\/(user|session)/.test(url)) return json(FIXTURE.user);
      if(/\/auth\/v1\/token/.test(url)) return json({access_token:"stub",token_type:"bearer",expires_in:3600,refresh_token:"stub",user:FIXTURE.user});
      if(/\/auth\/v1\//.test(url)) return json({});
      const table=(url.match(/\/rest\/v1\/([a-z_]+)/i)||[])[1];
      if(table&&FIXTURE.tables[table]) return json(FIXTURE.tables[table]);
      return json([]);
    });

    const errors=[];
    page.on("pageerror",e=>errors.push("PAGEERROR "+e.message));
    // Backend noise is not a rendering defect. This sandbox has no route to
    // Supabase or the tile host, so every fetch resets; that says nothing about
    // whether the screen is built right. Real JS errors still count.
    const NOISE=/ERR_CONNECTION|ERR_EMPTY_RESPONSE|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource|net::/i;
    page.on("console",m=>{if(m.type()==="error"&&!NOISE.test(m.text())) errors.push("CONSOLE "+m.text().slice(0,160));});

    let geo={},palette={},landed={};
    try{
      await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:30000});
      // networkidle never settles here: the app polls Supabase and the sandbox
      // resets those connections, so the page is "busy" forever. Wait for the
      // app to have painted something instead, which is the real condition.
      await page.waitForFunction(()=>document.querySelectorAll("div").length>12,null,{timeout:20000}).catch(()=>{});
      // components/StartupSplash.js covers the whole app for a hard 5s on every
      // launch (it is the OpenStreetMap attribution, and deliberately cannot be
      // tapped past). Screenshotting through it photographs the splash and
      // reports every control on the screen as "covered".
      //
      // DETECTED STRUCTURALLY, NEVER BY COPY. The first version of this waited
      // for the splash's tagline to disappear. A rebuild removed the tagline,
      // the wait stopped matching, and four routes were silently photographed
      // through the splash and reported as broken. A verification harness that
      // depends on wording breaks every time the wording is improved -- so this
      // asks the only question that actually matters: is the topmost thing at
      // the centre of the screen part of the app, or is something on top of it?
      await page.waitForFunction(()=>{
        const vw=window.innerWidth, vh=window.innerHeight;
        const cover=[...document.querySelectorAll("div")].find(d=>{
          const r=d.getBoundingClientRect();
          return r.height>vh*0.9&&r.width>vw*0.9&&r.top<4
            &&getComputedStyle(d).backgroundColor!=="rgba(0, 0, 0, 0)";
        });
        if(!cover) return true;
        // A full-bleed screen (the map) is not a cover. A cover is the thing
        // that has NO navigation underneath it -- the splash renders above the
        // tab bar, so the bar being reachable means the splash has gone.
        const bar=document.querySelector('[role="tablist"]');
        if(!bar) return false;
        const br=bar.getBoundingClientRect();
        if(br.height<20) return false;
        // elementsFromPoint returns EVERY element at that point, covered ones
        // included, front to back. Asking "is the bar in the list" is therefore
        // always true and answers nothing -- the question is whether the bar is
        // what is on TOP.
        const stack=document.elementsFromPoint(br.left+br.width/2,br.top+br.height/2);
        const top=stack[0];
        return !!top&&(top===bar||bar.contains(top));
      },null,{timeout:14000}).catch(()=>{});
      await page.waitForTimeout(1600);
      // WHAT DID WE ACTUALLY LAND ON. A guarded route that redirects is the
      // single easiest way for this harness to lie to itself, so every result
      // carries the URL and the first heading it ended up looking at.
      landed=await page.evaluate(()=>({
        url:location.pathname,
        heading:(document.body.innerText||"").trim().split("\n").filter(Boolean)[0]||""
      }));

      geo=await page.evaluate(GEOMETRY(false));

      // SECOND PASS, SCROLLED TO THE END. The last row of a list is the one
      // that ends up under the Create action or the tab bar, and it is never
      // on screen when the page first paints.
      await page.evaluate(()=>{
        for(const n of document.querySelectorAll("div")){
          if(n.scrollHeight>n.clientHeight+40) n.scrollTop=n.scrollHeight;
        }
        window.scrollTo(0,document.body.scrollHeight);
      });
      await page.waitForTimeout(700);
      const tail=await page.evaluate(GEOMETRY(true));
      for(const key of ["chrome","overlap","offscreen"]){
        const seen=new Set((geo[key]||[]).map(v=>JSON.stringify(v)));
        for(const v of (tail[key]||[])) if(!seen.has(JSON.stringify(v))) geo[key].push({...v,atEnd:true});
      }
      await page.evaluate(()=>{
        for(const n of document.querySelectorAll("div")) if(n.scrollTop) n.scrollTop=0;
        window.scrollTo(0,0);
      });
      await page.waitForTimeout(500);

      const shot=path.join(OUT,slug+".png");
      await page.screenshot({path:shot});

      // PIXELS, NOT INTENTIONS. Sample the screenshot itself and bucket every
      // pixel against both palettes. This is the only check that can prove the
      // winner's design system is what actually rendered.
      const png=fs.readFileSync(shot);
      palette=samplePng(png);
    }catch(e){
      errors.push("NAV "+e.message);
    }
    report.push({route,slug,errors,geo,palette,landed});
    await page.close();
  }

  await browser.close();

  let bad=0;
  for(const r of report){
    const g=r.geo||{};
    const issues=[
      ...(g.stretch||[]).map(s=>`STRETCH  ${s.height}px vs median ${s.median}px  "${s.text}"`),
      ...(g.overlap||[]).map(o=>`OVERLAP  "${o.el}" covered by "${o.by}"`),
      ...(g.chrome||[]).map(c=>`UNDER-BAR${c.atEnd?" (scrolled to end)":""} "${c.el}" bottom ${c.bottom} > bar top ${c.barTop}`),
      ...(g.offscreen||[]).map(o=>`OFFSCREEN "${o.el}" ${o.left}..${o.right}`),
      ...(g.contrast||[]).map(c=>`CONTRAST ${c.ratio}:1 (needs ${c.need}) at ${c.size}px  "${c.txt}"`),
      ...r.errors
    ];
    if(issues.length) bad++;
    const drifted=r.landed&&r.landed.url&&r.landed.url!==r.route;
    console.log(`\n=== ${r.route} ===${drifted?`   [LANDED ON ${r.landed.url}]`:""}`);
    if(r.landed&&r.landed.heading) console.log(`  showing: ${r.landed.heading.slice(0,60)}`);
    // A LIVE IMAGE CANNOT BE PALETTE-SCORED. The viewfinder is mostly camera
  // feed -- in this harness, Chromium's green test pattern -- so a low
  // on-system figure there says nothing about the design. The chrome drawn over
  // it is what matters, and the geometry checks cover that.
    const liveImage=/\/camera|\/scan/.test(r.route);
    console.log(`  palette: ${r.palette.summary||"n/a"}${liveImage?"   (mostly live camera feed — not a palette reading)":""}`);
    if(r.palette.incumbent) console.log(`  !! INCUMBENT PIXELS: ${r.palette.incumbent}`);
    if(!issues.length) console.log("  clean");
    else issues.slice(0,14).forEach(i=>console.log("  "+i));
    if((g.floatsOver||[]).length){
      console.log("  note: the Create action passes over "+g.floatsOver.map(f=>`"${f.el}"`).join(", ")+" at this scroll offset (scrollable — not a collision)");
    }
    if((g.small||[]).length) console.log("  note: small targets "+g.small.map(s=>`${s.el}(${s.h})`).join(", "));
  }
  fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,2));
  console.log(`\n${report.length-bad}/${report.length} routes clean. Shots in ${OUT}`);
  // Non-zero on a real finding, so this can gate a build rather than just
  // print. It does NOT fail on the notes (small targets, the Create action
  // passing over scrolling content) -- those are observations, not defects.
  process.exit(bad?1:0);
})();

// Minimal PNG decode via zlib -- avoids a dependency for what is a pixel count.
function samplePng(buf){
  const zlib=require("zlib");
  let pos=8,w=0,h=0,bitDepth=8,colourType=6,idat=[];
  while(pos<buf.length){
    const len=buf.readUInt32BE(pos); const type=buf.toString("ascii",pos+4,pos+8);
    if(type==="IHDR"){w=buf.readUInt32BE(pos+8);h=buf.readUInt32BE(pos+12);bitDepth=buf[pos+16];colourType=buf[pos+17];}
    else if(type==="IDAT") idat.push(buf.slice(pos+8,pos+8+len));
    else if(type==="IEND") break;
    pos+=12+len;
  }
  if(!w||bitDepth!==8) return {summary:"unreadable"};
  const channels=colourType===6?4:colourType===2?3:0;
  if(!channels) return {summary:"unsupported colour type "+colourType};
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=w*channels;
  const prev=Buffer.alloc(stride); const line=Buffer.alloc(stride);
  const counts={}; let total=0, incumbent=0, incumbentNames={};
  let off=0;
  for(let y=0;y<h;y++){
    const filter=raw[off++];
    raw.copy(line,0,off,off+stride); off+=stride;
    for(let i=0;i<stride;i++){
      const a=i>=channels?line[i-channels]:0, b=prev[i], c=i>=channels?prev[i-channels]:0;
      let v=line[i];
      if(filter===1) v=(v+a)&255;
      else if(filter===2) v=(v+b)&255;
      else if(filter===3) v=(v+((a+b)>>1))&255;
      else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255;}
      line[i]=v;
    }
    if(y%6===0){
      for(let x=0;x<w;x+=6){
        const px=[line[x*channels],line[x*channels+1],line[x*channels+2]];
        total++;
        for(const [name,ref] of Object.entries(PALETTE)) if(near(px,ref,10)){counts[name]=(counts[name]||0)+1;break;}
        for(const [name,ref] of Object.entries(INCUMBENT)) if(near(px,ref,6)){incumbent++;incumbentNames[name]=(incumbentNames[name]||0)+1;break;}
      }
    }
    line.copy(prev);
  }
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([k,v])=>`${k} ${(v/total*100).toFixed(1)}%`).join(", ");
  const matched=Object.values(counts).reduce((a,b)=>a+b,0);
  return {
    summary:`${(matched/total*100).toFixed(0)}% on-system — ${top}`,
    incumbent:incumbent>total*0.002?`${(incumbent/total*100).toFixed(2)}% (${Object.keys(incumbentNames).join(",")})`:null
  };
}
