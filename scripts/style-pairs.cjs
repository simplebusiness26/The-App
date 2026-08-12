"use strict";

// What is behind this text.
//
// Both scripts/riso-pass.cjs and scripts/verify-contrast.cjs need the same
// answer to the same question -- for a given <Text>, which style painted the
// ground it sits on -- and they must not answer it differently, or the tool
// will "fix" something the gate then calls broken, for ever.
//
// WHY IT IS NOT A REGEX
//
// It was, and the regex only saw a Text that was its container's FIRST child:
//
//   <View style={styles.emptyCard}>
//     <Text style={styles.emptyIcon}>🧭</Text>
//     <Text style={styles.emptyTitle}>Build your Explorer feed</Text>
//
// emptyIcon was found and emptyTitle was invisible to it. With no evidence for
// emptyTitle, the tool fell back to guessing from names -- and the name
// `emptyTitle` matches `emptyButton` (blue) as readily as `emptyCard` (light),
// so it reported an unresolvable conflict on a screen where nothing was wrong.
//
// So this walks the JSX properly: every element that paints a background opens
// a scope, and a Text belongs to the INNERMOST scope containing it. That is
// what a browser does, and it is the only reading that is right for a card
// inside a card.

// A style attribute is a STACK, and a conditional entry makes a second STATE of
// that stack. Both facts matter, and reading the attribute as a flat list of
// names loses them.
//
//   style={[styles.save, styles.saveReply, working && styles.saveDisabled]}
//   style={[styles.bubble, mine ? styles.mine : styles.theirs]}
//   style={selected ? styles.selectedFilterText : styles.filterText}
//
// The first is a stack whose ground is saveReply, not save -- reading only the
// first name made the walk look outside the button entirely and "fix" its white
// label to ink, which on green is 3.34:1.
//
// The second and third are the same decision written two ways. Flattened, the
// false branch looked like a second ground the true branch's text was drawn on,
// and screens that were perfectly fine got reported as broken.
//
// So each element becomes a list of states, and each state is the stack of
// styles in force when that state applies. State 0 is the base -- everything
// unconditional, plus the false branch of any ternary.
function statesOf(attributes){
  const attribute=attributes.match(/style=\{([\s\S]*)$/);
  if(!attribute) return [];

  // Split the array's top-level entries. Depth keeps `cond && styles.x` and
  // `{...}` and `f(x)` in one piece.
  const body=attribute[1].replace(/^\s*\[/,"");
  const entries=[];
  let depth=0;
  let current="";

  for(const character of body){
    if(character==="[" || character==="(" || character==="{") depth+=1;
    if(character==="]" || character===")" || character==="}") depth-=1;
    if(character==="," && depth<=0){entries.push(current);current="";continue;}
    if(depth<0) break;
    current+=character;
  }
  entries.push(current);

  const base=[];
  const variants=[];

  for(const entry of entries){
    const names=[...entry.matchAll(/styles\.(\w+)/g)].map((match)=>match[1]);
    if(!names.length) continue;

    const ternary=/\?/.test(entry) && names.length>1;
    if(ternary){
      // `cond ? a : b` -- b is what you see by default, a is the state.
      base.push(names[1]);
      variants.push(names[0]);
      continue;
    }

    // `cond && styles.x` is a state; a bare `styles.x` is part of the base.
    if(/&&/.test(entry)) variants.push(names[0]);
    else base.push(...names);
  }

  // The base on its own, then the base with each state laid over it -- which is
  // what React Native does with the array at runtime.
  return [base,...variants.map((variant)=>[...base,variant])].filter((state)=>state.length);
}

// Flat list of every style named, for callers that do not care about state.
function stylesIn(attributes){
  return [...new Set(statesOf(attributes).flat())];
}

// Elements that can contain other elements. Text can too -- a <Text> inside a
// <Text> inherits colour -- but a Text never paints the ground.
const OPEN=/<([A-Z][\w.]*)((?:[^<>]|\{[^{}]*\})*?)(\/?)>/g;

function scopes(source){
  const found=[];

  for(const match of source.matchAll(OPEN)){
    const [whole,tag,attributes,selfClosing]=match;
    const states=statesOf(attributes);
    if(!states.length) continue;
    const styles=[...new Set(states.flat())];

    const start=match.index+whole.length;
    if(selfClosing){
      found.push({tag,states,styles,start,end:start});
      continue;
    }

    // The matching close, by counting this tag's own opens and closes. React
    // Native has no void elements, so every non-self-closing tag has one.
    let depth=1;
    let cursor=start;
    const opener=new RegExp(`<${tag.replace(".","\\.")}[\\s/>]`,"g");
    const closer=new RegExp(`</${tag.replace(".","\\.")}>`,"g");
    let end=source.length;

    while(depth>0 && cursor<source.length){
      opener.lastIndex=cursor;
      closer.lastIndex=cursor;
      const nextOpen=opener.exec(source);
      const nextClose=closer.exec(source);
      if(!nextClose) break;

      if(nextOpen && nextOpen.index<nextClose.index){
        depth+=1;
        cursor=nextOpen.index+1;
      }else{
        depth-=1;
        cursor=nextClose.index+1;
        if(depth===0) end=nextClose.index;
      }
    }

    found.push({tag,states,styles,start,end});
  }

  return found;
}

// Every (text style, ground style) pair in a file.
//
// `paints` says which styles paint a ground; `setsColour` says which set a text
// colour. Both come from the caller so this module never has to know what a
// token is.
//
// THE CONDITIONAL PAIR
//
//   <Pressable style={[styles.chip, active && styles.chipActive]}>
//     <Text style={[styles.chipText, active && styles.chipTextActive]}>
//
// Reading this as "chipText is drawn on chip AND on chipActive" is wrong, and
// wrong in the direction that matters: it calls a screen broken when the app
// already swaps the label colour under the very same condition. So states are
// paired with states -- base with base, first variant with first variant --
// which is the convention this codebase follows everywhere.
//
// When the label has no variant of its own -- one colour, several possible
// grounds -- that colour really does have to work on all of them, and it is
// checked against each. That is not a false alarm: a message body that is ink
// on a white card and ink on a blue one is unreadable on the blue one.
function pairsFor(source,paints,setsColour){
  const all=scopes(source);
  const containers=all.filter((scope)=>scope.styles.some(paints));
  const pairs=[];

  for(const scope of all){
    if(scope.tag!=="Text") continue;

    // The innermost ground containing this Text: the latest-starting one whose
    // scope has not closed before the Text opens. A card inside a card means
    // the inner card is what you see.
    let closest=null;
    for(const container of containers){
      if(container.start>scope.start || container.end<scope.start) continue;
      if(container.start===scope.start) continue;
      if(!closest || container.start>closest.start) closest=container;
    }
    if(!closest) continue;

    // Last one wins, exactly as React Native flattens the array.
    const groundOf=(state)=>[...state].reverse().find(paints);
    const colourOf=(state)=>[...state].reverse().find(setsColour);

    // Only the states that CHANGE the thing in question, in order. A button has
    // states for `compact` and `disabled` too, and they paint nothing -- lining
    // up raw state numbers made the second ground pair with the first label and
    // both readings came out wrong.
    const grounds=[];
    for(const state of closest.states){
      const ground=groundOf(state);
      if(ground && !grounds.includes(ground)) grounds.push(ground);
    }

    const colours=[];
    for(const state of scope.states){
      const colour=colourOf(state);
      if(colour && !colours.includes(colour)) colours.push(colour);
    }

    grounds.forEach((ground,index)=>{
      const text=colours[index] || colours[0];
      if(text) pairs.push({text,ground});
    });
  }

  return pairs;
}

// The same thing keyed by text style, for callers that need to choose one
// colour that works everywhere a style is used.
function groundsFor(source,paints,setsColour){
  const result=new Map();
  for(const {text,ground} of pairsFor(source,paints,setsColour)){
    if(!result.has(text)) result.set(text,new Set());
    result.get(text).add(ground);
  }
  return result;
}

module.exports={pairsFor,groundsFor,scopes};
