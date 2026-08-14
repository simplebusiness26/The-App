/* eslint-env jest */

// The failure mode that has now cost this project twice.
//
// A Jest run can print "754 passed" and exit 1. It happens when something keeps
// running after a test finishes -- an interval, a VirtualizedList's own timer,
// a promise nobody awaited -- and touches the environment after Jest has torn
// it down. No test fails. The summary line looks perfect. The job goes red.
//
// The first time, the cause was the React Native preset's frame shim and CI had
// been red for twenty-two runs while every local check "passed", because the
// check was reading the summary through a pipe and the pipe swallowed the exit
// code. The second time it was a FlatList in a test that never unmounted, plus
// a four-second bubble rotation still ticking on a screen the test had walked
// away from.
//
// So this asserts the two habits that catch it:
//
//   1. a component that starts a timer must stop it, and must not start one
//      when there is nothing to do
//   2. a test that mounts a virtualised list must unmount it
//
// It cannot assert the exit code itself -- a test cannot observe the run it is
// part of. What it can do is refuse the two shapes that produce it.

const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");

function read(relative){
  return fs.readFileSync(path.join(root,relative),"utf8");
}

function code(source){
  return source.split("\n").filter((line)=>!/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
}

test("every setInterval in the app is cleared by the effect that started it",()=>{
  const offenders=[];

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

  for(const dir of ["app","components","hooks","context"]){
    for(const file of walk(path.join(root,dir))){
      const source=code(fs.readFileSync(file,"utf8"));
      if(!/setInterval\(/.test(source)) continue;
      if(!/clearInterval\(/.test(source)) offenders.push(path.relative(root,file));
    }
  }

  expect(offenders).toEqual([]);
});

test("the bubble rotation does not run when there is nothing to rotate",()=>{
  const screen=code(read("components/LivingMapScreen.js"));

  // Both Manager switches default to off, so most maps have no eligible bubble
  // at all. Waking up every four seconds to re-render for nothing is waste --
  // and a timer still firing on an unmounted screen is what turned the whole
  // suite red while every test passed.
  expect(screen).toMatch(/if\(!candidateCount\) return undefined;/);
  // The interval is in the list too now: it follows the zoom, so a change of
  // zoom must restart the timer rather than leave the old rate running.
  expect(screen).toMatch(/\},\[candidateCount,interval\]\);/);
});

test("tests that mount a virtualised list unmount it again",()=>{
  const feedTest=read("test/feed-pagination.test.js");

  // A VirtualizedList schedules its own timer to decide which rows stay
  // mounted. Left up, it fires after the environment is gone.
  expect(feedTest).toMatch(/afterEach/);
  expect(feedTest).toMatch(/tree\.unmount\(\)/);
});
