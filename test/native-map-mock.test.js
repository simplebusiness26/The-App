/* eslint-env jest */

// Does the Jest mock know every component the native renderer uses.
//
// WHY THIS EXISTS
//
// components/LivingMap.js imports from @maplibre/maplibre-react-native, and
// test/setup.js mocks that package because a native map cannot render in Jest.
// The mock was written against v10 and still carried `ShapeSource` -- a name
// v11 does not have -- while the renderer had moved to `GeoJSONSource` and
// `Layer`.
//
// React renders an unknown component as `undefined` and throws only when one is
// actually put on screen. The route layer is only drawn when there IS a route,
// and no test had one, so the mock had been wrong for weeks with every test
// green.
//
// scripts/verify-native-map-props.cjs checks the PROPS against the installed
// package. This is the same hole one level down: the component NAMES, against
// the mock.

const fs=require("fs");
const path=require("path");

const PACKAGE="@maplibre/maplibre-react-native";
const root=path.resolve(__dirname,"..");

function imported(file){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const line=source.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*"${PACKAGE}"`));
  if(!line) return [];
  return line[1].split(",").map((name)=>name.trim()).filter(Boolean);
}

test("everything the native map imports is in the mock",()=>{
  const mock=require(PACKAGE);
  const names=imported("components/LivingMap.js");

  expect(names.length).toBeGreaterThan(0);

  for(const name of names){
    expect(typeof mock[name]).toBe("function");
  }
});

test("everything the native map imports exists in the installed package",()=>{
  // The other direction, and the one that catches a rename in an upgrade: a
  // mock is only worth anything if it stands in for something real.
  const types=path.join(root,"node_modules",PACKAGE,"lib/typescript/module");
  const found=new Set();

  (function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){walk(full);continue;}
      if(entry.name.endsWith(".d.ts")) found.add(entry.name.replace(/\.d\.ts$/,""));
    }
  })(types);

  for(const name of imported("components/LivingMap.js")){
    expect(found.has(name)).toBe(true);
  }
});

test("the mock carries no name the package has dropped",()=>{
  // ShapeSource was v10's and lived on in here long after the renderer stopped
  // using it. A stale mock name is a v10 import waiting to look healthy.
  const mock=require(PACKAGE);
  const real=require(path.join(root,"node_modules",PACKAGE,"package.json"));

  expect(real.version.startsWith("11.")).toBe(true);
  expect(mock.ShapeSource).toBeUndefined();
  expect(mock.LineLayer).toBeUndefined();
});
