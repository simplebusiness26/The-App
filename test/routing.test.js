/* eslint-env jest */

// Routing, and the four ways it is allowed to fail.
//
// The rule that matters most is that NOTHING HERE THROWS. A refused location, a
// place with no coordinates, a dead provider and a route that does not exist
// are four different answers, each a value with a status. The map has to keep
// working through all of them -- a routing provider falling over must not take
// the map down, and that is only true if failure is a value rather than an
// exception.
//
// The second rule is that Valhalla stays in one file. Nothing outside
// utils/routing/valhalla.js may know its URL, its costing names or its
// response shape, or replacing the provider becomes a rewrite.

const {
  requestRoute,
  setRouteProvider,
  ROUTE_STATUS,
  decodePolyline,
  distanceLabel,
  durationLabel,
  isUsablePoint,
  TRAVEL_MODES
}=require("../utils/routing");

const valhalla=require("../utils/routing/valhalla");

const HERE={latitude:50.8552,longitude:0.5729};
const THERE={latitude:50.8686,longitude:0.5747};

afterEach(()=>{
  setRouteProvider(null);
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The polyline, and the six
// ---------------------------------------------------------------------------

test("decodes an encoded polyline at the precision it is told, not a guessed one",()=>{
  // A known Google-algorithm sample, encoded at precision 5.
  const sample="_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  const five=decodePolyline(sample,5);
  expect(five.length).toBe(3);
  expect(five[0].latitude).toBeCloseTo(38.5,4);
  expect(five[0].longitude).toBeCloseTo(-120.2,4);

  // THE TRAP THIS EXISTS FOR. Valhalla encodes at SIX. Reading a six at five --
  // or a five at six -- puts the route ten times too far away, which on this
  // sample is the difference between California and the equator.
  const six=decodePolyline(sample,6);
  expect(six[0].latitude).toBeCloseTo(3.85,4);
  expect(Math.abs(six[0].latitude-five[0].latitude)).toBeGreaterThan(30);
});

test("an empty or missing shape decodes to no points rather than throwing",()=>{
  expect(decodePolyline("")).toEqual([]);
  expect(decodePolyline(null)).toEqual([]);
  expect(decodePolyline(undefined)).toEqual([]);
});

// ---------------------------------------------------------------------------
// What a route needs before anybody is asked for one
// ---------------------------------------------------------------------------

test("no location means no request is made at all",async()=>{
  const fetchRoute=jest.fn();
  setRouteProvider({name:"stub",fetchRoute});

  const route=await requestRoute({origin:null,destination:THERE,mode:"walking"});

  expect(route.status).toBe(ROUTE_STATUS.NO_LOCATION);
  // A missing GPS fix must never become a network call.
  expect(fetchRoute).not.toHaveBeenCalled();
});

test("a destination with no coordinates is refused before the provider is asked",async()=>{
  const fetchRoute=jest.fn();
  setRouteProvider({name:"stub",fetchRoute});

  const route=await requestRoute({origin:HERE,destination:{latitude:null,longitude:null},mode:"walking"});

  expect(route.status).toBe(ROUTE_STATUS.NO_DESTINATION);
  expect(fetchRoute).not.toHaveBeenCalled();
});

test("coordinates off the Earth are not usable",()=>{
  expect(isUsablePoint({latitude:50.8,longitude:0.5})).toBe(true);
  expect(isUsablePoint({latitude:200,longitude:0.5})).toBe(false);
  expect(isUsablePoint({latitude:50.8,longitude:900})).toBe(false);
  expect(isUsablePoint({latitude:"nonsense",longitude:0.5})).toBe(false);
  expect(isUsablePoint(null)).toBe(false);
});

test("an unknown travel mode is refused rather than guessed at",async()=>{
  const fetchRoute=jest.fn();
  setRouteProvider({name:"stub",fetchRoute});

  const route=await requestRoute({origin:HERE,destination:THERE,mode:"teleport"});
  expect(route.status).toBe(ROUTE_STATUS.UNAVAILABLE);
  expect(fetchRoute).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Provider failure
// ---------------------------------------------------------------------------

test("a provider that throws becomes an unavailable route, not an exception",async()=>{
  setRouteProvider({name:"stub",fetchRoute:()=>{throw new Error("boom");}});

  const route=await requestRoute({origin:HERE,destination:THERE,mode:"walking"});
  expect(route.status).toBe(ROUTE_STATUS.UNAVAILABLE);
  expect(route.geometry).toEqual([]);
});

test("a provider that returns rubbish becomes an unavailable route",async()=>{
  setRouteProvider({name:"stub",fetchRoute:async()=>undefined});
  expect((await requestRoute({origin:HERE,destination:THERE,mode:"walking"})).status)
    .toBe(ROUTE_STATUS.UNAVAILABLE);

  setRouteProvider({name:"stub",fetchRoute:async()=>({nonsense:true})});
  expect((await requestRoute({origin:HERE,destination:THERE,mode:"walking"})).status)
    .toBe(ROUTE_STATUS.UNAVAILABLE);
});

// ---------------------------------------------------------------------------
// Valhalla, through a fake fetch
// ---------------------------------------------------------------------------

function valhallaResponse(shape){
  return {
    ok:true,
    json:async()=>({
      trip:{
        summary:{length:2.4,time:1800},
        legs:[{
          shape,
          maneuvers:[
            {instruction:"Walk north on Queens Road.",type:2,street_names:["Queens Road"],
             length:0.4,time:300,begin_shape_index:0,end_shape_index:4}
          ]
        }]
      }
    })
  };
}

test("builds a route from a Valhalla answer, decoding the shape at six",async()=>{
  // Encoded at six, which is what Valhalla sends.
  const {encodeAtSix}=require("./helpers/polyline");
  const shape=encodeAtSix([[50.8552,0.5729],[50.8600,0.5735],[50.8686,0.5747]]);

  const fetchImpl=jest.fn(async()=>valhallaResponse(shape));
  const route=await valhalla.fetchRoute({origin:HERE,destination:THERE,mode:"walking",fetchImpl});

  expect(route.status).toBe(ROUTE_STATUS.OK);
  expect(route.geometry.length).toBe(3);
  // Decoded where it belongs -- Hastings, not the sea.
  expect(route.geometry[0].latitude).toBeCloseTo(50.8552,4);
  expect(route.geometry[2].longitude).toBeCloseTo(0.5747,4);

  // summary.length is in km because the request asked for kilometers.
  expect(route.distanceMetres).toBeCloseTo(2400,0);
  expect(route.durationSeconds).toBe(1800);

  // Kept for the turn-by-turn this is not yet.
  expect(route.manoeuvres.length).toBe(1);
  expect(route.manoeuvres[0].instruction).toContain("Queens Road");
});

test("asks for the right costing model for each travel mode",async()=>{
  const seen=[];
  const fetchImpl=jest.fn(async(url)=>{
    seen.push(decodeURIComponent(url));
    return valhallaResponse("");
  });

  for(const entry of TRAVEL_MODES){
    await valhalla.fetchRoute({origin:HERE,destination:THERE,mode:entry.key,fetchImpl});
  }

  expect(seen[0]).toContain('"costing":"pedestrian"');
  expect(seen[1]).toContain('"costing":"bicycle"');
  expect(seen[2]).toContain('"costing":"auto"');
});

test("identifies the app to the public server, as its terms ask",async()=>{
  const fetchImpl=jest.fn(async()=>valhallaResponse(""));
  await valhalla.fetchRoute({origin:HERE,destination:THERE,mode:"walking",fetchImpl});

  const options=fetchImpl.mock.calls[0][1];
  expect(options.headers["X-Client-Id"]).toBeTruthy();
});

test("an HTTP failure, a network failure and an unreadable body are all unavailable",async()=>{
  const failures=[
    async()=>({ok:false,status:503}),
    async()=>{throw new Error("network down");},
    async()=>({ok:true,json:async()=>{throw new Error("not json");}})
  ];

  for(const fetchImpl of failures){
    const route=await valhalla.fetchRoute({origin:HERE,destination:THERE,mode:"walking",fetchImpl});
    expect(route.status).toBe(ROUTE_STATUS.UNAVAILABLE);
  }
});

test("a trip with no legs is 'no route', which is an answer rather than a fault",async()=>{
  const fetchImpl=async()=>({ok:true,json:async()=>({trip:{legs:[]}})});
  const route=await valhalla.fetchRoute({origin:HERE,destination:THERE,mode:"driving",fetchImpl});
  expect(route.status).toBe(ROUTE_STATUS.NO_ROUTE);
});

// ---------------------------------------------------------------------------
// The boundary
// ---------------------------------------------------------------------------

test("nothing outside utils/routing/valhalla.js knows what Valhalla is",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  const walk=(dir)=>{
    const out=[];
    if(!fs.existsSync(dir)) return out;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){out.push(...walk(full));continue;}
      if(entry.name.endsWith(".js")) out.push(full);
    }
    return out;
  };

  const offenders=[];

  for(const dir of ["app","components","hooks","utils"]){
    for(const file of walk(path.join(root,dir))){
      const relative=path.relative(root,file);
      if(relative===path.join("utils","routing","valhalla.js")) continue;

      const code=fs.readFileSync(file,"utf8")
        .split("\n")
        .filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");

      if(/valhalla|openstreetmap\.de|costing/i.test(code)) offenders.push(relative);
    }
  }

  // utils/routing/index.js imports the module by name, which is the one
  // legitimate mention -- it is the file whose job is choosing a provider.
  expect(offenders.filter((f)=>f!==path.join("utils","routing","index.js"))).toEqual([]);
});

test("neither map renderer decides what a route looks like",()=>{
  const fs=require("fs");
  const path=require("path");
  const root=path.resolve(__dirname,"..");

  for(const file of ["components/LivingMap.js","components/LivingMap.web.js"]){
    const source=fs.readFileSync(path.join(root,file),"utf8");
    // Same rule the rest of the map follows: a renderer draws, it does not
    // decide what a colour means.
    expect(source).not.toMatch(/INK\.(blue|pink|yellow)/);
    expect(source).not.toMatch(/requestRoute|valhalla/i);
  }
});

// ---------------------------------------------------------------------------
// What a person reads
// ---------------------------------------------------------------------------

test("distance and time are said the way a person says them",()=>{
  expect(distanceLabel(240)).toBe("240 m");
  expect(distanceLabel(2400)).toBe("2.4 km");
  expect(distanceLabel(24000)).toBe("24 km");

  expect(durationLabel(30)).toBe("under a minute");
  expect(durationLabel(1800)).toBe("30 min");
  expect(durationLabel(5400)).toBe("1 h 30 min");
  expect(durationLabel(7200)).toBe("2 h");
});
