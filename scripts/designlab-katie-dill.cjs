#!/usr/bin/env node
"use strict";

const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"..");

function file(rel){return path.join(root,rel);}
function read(rel){return fs.readFileSync(file(rel),"utf8");}
function write(rel,text){fs.writeFileSync(file(rel),text,"utf8");}
function replace(rel,before,after,label){
  const source=read(rel);
  if(!source.includes(before)){
    throw new Error(`Katie redesign stopped: expected ${label||before.slice(0,60)} in ${rel}`);
  }
  write(rel,source.replace(before,after));
}

// Katie Dill challenger — whole-service reasoning applied to Xplorer.
// Product Truth stays fixed. These changes alter how the same product explains
// itself, builds confidence, and carries somebody from discovery to real-world
// action. No routes, permissions, persistence rules, account models or backend
// behaviours are changed here.

// 1) First impression: explain the service outcome, not a feature inventory.
replace(
  "components/StartupSplash.js",
  '<Text style={styles.tagline}>Discover local places, stays and experiences.</Text>',
  '<Text style={styles.tagline}>See what is around you, understand what to expect, and make a confident plan.</Text>',
  "startup service promise"
);
replace(
  "components/StartupSplash.js",
  'wordmark:{color:INK.ink,fontSize:52,fontWeight:"900",letterSpacing:-1},\n  tagline:{color:INK.inkSoft,fontSize:16,lineHeight:23,textAlign:"center",marginTop:10},',
  'wordmark:{color:INK.ink,fontSize:48,fontWeight:"800",letterSpacing:-1.2},\n  tagline:{color:INK.inkSoft,fontSize:17,lineHeight:25,textAlign:"center",marginTop:14,maxWidth:330},',
  "startup typography"
);

// 2) Header: quieter controls. Navigation is present and dependable without
// competing with the place, person or conversation underneath it.
replace(
  "components/Header.js",
  '    paddingHorizontal:10,\n    paddingBottom:6,',
  '    paddingHorizontal:14,\n    paddingBottom:8,',
  "header breathing room"
);
replace(
  "components/Header.js",
  '    width:40,\n    height:40,\n    borderRadius:20,\n    alignItems:"center",\n    justifyContent:"center",\n    backgroundColor:INK.card,\n    borderWidth:2,\n    borderColor:INK.ink,',
  '    width:42,\n    height:42,\n    borderRadius:14,\n    alignItems:"center",\n    justifyContent:"center",\n    backgroundColor:INK.card,\n    borderWidth:1,\n    borderColor:INK.hair,',
  "header control treatment"
);
replace(
  "components/Header.js",
  '    fontWeight:"bold",\n    color:INK.ink,',
  '    fontWeight:"700",\n    color:INK.ink,',
  "header icon weight"
);

// 3) Map controls: ask human questions instead of exposing filter mechanics.
replace(
  "components/MapControls.js",
  'placeholder="Search businesses, stays or clubs..."',
  'placeholder="What are you looking for nearby?"',
  "map search prompt"
);
replace("components/MapControls.js",'<Text style={styles.heading}>What</Text>','<Text style={styles.heading}>What do you want to find?</Text>',"map what heading");
replace("components/MapControls.js",'<Text style={styles.heading}>When</Text>','<Text style={styles.heading}>When does it matter?</Text>',"map when heading");
replace("components/MapControls.js",'<Text style={styles.heading}>Layers</Text>','<Text style={styles.heading}>What should the map show?</Text>',"map layers heading");
replace(
  "components/MapControls.js",
  '    width:40,\n    height:40,\n    borderRadius:20,\n    alignItems:"center",\n    justifyContent:"center",\n    backgroundColor:INK.card,\n    borderWidth:2,\n    borderColor:INK.ink',
  '    width:42,\n    height:42,\n    borderRadius:14,\n    alignItems:"center",\n    justifyContent:"center",\n    backgroundColor:INK.card,\n    borderWidth:1,\n    borderColor:INK.hair',
  "map control buttons"
);
replace(
  "components/MapControls.js",
  '    marginTop:8,\n    backgroundColor:INK.card,\n    borderWidth:2,\n    borderColor:INK.ink,\n    borderRadius:14,\n    padding:10',
  '    marginTop:10,\n    backgroundColor:INK.card,\n    borderWidth:1,\n    borderColor:INK.hair,\n    borderRadius:20,\n    padding:14',
  "map panel surface"
);
replace(
  "components/MapControls.js",
  '    borderRadius:20,\n    borderWidth:2,\n    borderColor:INK.ink',
  '    borderRadius:14,\n    borderWidth:1,\n    borderColor:INK.hair',
  "map filter chips"
);

// 4) Discover: make the recommendation reason a first-class trust cue.
replace(
  "components/DiscoverCard.js",
  '        {!!item.subtitle && <Text style={styles.type} numberOfLines={1}>{item.subtitle}</Text>}\n        <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>',
  '        {!!item.subtitle && <Text style={styles.type} numberOfLines={1}>{item.subtitle}</Text>}\n        <Text style={styles.reasonLabel}>Why it is here</Text>\n        <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>',
  "discover reason framing"
);
replace(
  "components/DiscoverCard.js",
  'export const CARD_WIDTH=240;\nconst CARD_HEIGHT=190;',
  'export const CARD_WIDTH=260;\nconst CARD_HEIGHT=220;',
  "discover card proportions"
);
replace(
  "components/DiscoverCard.js",
  '    borderRadius:14,\n    borderWidth:2,\n    borderColor:INK.ink,\n    backgroundColor:INK.card,\n    overflow:"hidden",\n    // Hard offset shadow, never a blur -- the same rule the pins and the raised\n    // tab button follow.\n    shadowColor:INK.ink,\n    shadowOffset:{width:3,height:3},\n    shadowOpacity:1,\n    shadowRadius:0,\n    elevation:0',
  '    borderRadius:20,\n    borderWidth:1,\n    borderColor:INK.hair,\n    backgroundColor:INK.card,\n    overflow:"hidden",\n    elevation:0',
  "discover card surface"
);
replace(
  "components/DiscoverCard.js",
  '    padding:10,\n    justifyContent:"flex-start",\n    backgroundColor:INK.card,\n    borderTopWidth:2,\n    borderTopColor:INK.ink',
  '    padding:14,\n    justifyContent:"flex-start",\n    backgroundColor:INK.card,\n    borderTopWidth:1,\n    borderTopColor:INK.hair',
  "discover information panel"
);
replace(
  "components/DiscoverCard.js",
  '  title:{color:INK.ink,fontWeight:"900",fontSize:15},\n  type:{color:INK.inkSoft,fontWeight:"700",fontSize:11,marginTop:2},\n  // The reason. Never optional -- see the note above.\n  reason:{color:INK.ink,fontWeight:"800",fontSize:11,lineHeight:15,marginTop:6},',
  '  title:{color:INK.ink,fontWeight:"800",fontSize:17},\n  type:{color:INK.inkSoft,fontWeight:"600",fontSize:12,marginTop:2},\n  reasonLabel:{color:INK.inkSoft,fontWeight:"800",fontSize:9,letterSpacing:0.8,textTransform:"uppercase",marginTop:8},\n  // The reason. Never optional -- see the note above.\n  reason:{color:INK.ink,fontWeight:"700",fontSize:12,lineHeight:17,marginTop:2},',
  "discover typography"
);
replace(
  "components/DiscoverCard.js",
  '    borderWidth:2,\n    borderColor:INK.ink,\n    borderRadius:99,',
  '    borderWidth:1,\n    borderColor:INK.hair,\n    borderRadius:99,',
  "discover score surface"
);
replace(
  "components/DiscoverCard.js",
  '    backgroundColor:INK.card,\n    borderWidth:2,\n    borderColor:INK.ink\n  },\n  mapIcon',
  '    backgroundColor:INK.card,\n    borderWidth:1,\n    borderColor:INK.hair\n  },\n  mapIcon',
  "discover map action"
);

// 5) Quick access: turn the long route catalogue into calm grouped service
// areas, while leaving its exact role/permission filtering untouched.
replace(
  "components/QuickAccessDrawer.js",
  '            <Text style={styles.title}>Quick access</Text>',
  '            <View style={styles.headingCopy}>\n              <Text style={styles.title}>Quick access</Text>\n              <Text style={styles.subtitle}>Find what you need, then get back to your plan.</Text>\n            </View>',
  "drawer service framing"
);
replace(
  "components/QuickAccessDrawer.js",
  '    borderLeftWidth:2,\n    borderLeftColor:INK.ink,\n    paddingHorizontal:16',
  '    borderLeftWidth:1,\n    borderLeftColor:INK.hair,\n    paddingHorizontal:20',
  "drawer panel"
);
replace(
  "components/QuickAccessDrawer.js",
  '  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},\n  title:{fontSize:24,fontWeight:"800",letterSpacing:-0.4,color:INK.ink},',
  '  head:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14},\n  headingCopy:{flex:1,paddingRight:12},\n  title:{fontSize:27,fontWeight:"800",letterSpacing:-0.6,color:INK.ink},\n  subtitle:{fontSize:13,lineHeight:18,color:INK.inkSoft,marginTop:4,maxWidth:285},',
  "drawer heading"
);
replace(
  "components/QuickAccessDrawer.js",
  '  section:{marginBottom:18},',
  '  section:{marginBottom:12,backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:16,paddingHorizontal:12,paddingTop:12},',
  "drawer grouped sections"
);
replace(
  "components/QuickAccessDrawer.js",
  '    marginBottom:8,',
  '    marginBottom:5,',
  "drawer section rhythm"
);
replace(
  "components/QuickAccessDrawer.js",
  '    minHeight:48,\n    justifyContent:"center",\n    borderBottomWidth:1,\n    borderBottomColor:INK.hair,\n    paddingVertical:11',
  '    minHeight:50,\n    justifyContent:"center",\n    borderBottomWidth:1,\n    borderBottomColor:INK.hair,\n    paddingVertical:12',
  "drawer row rhythm"
);
replace(
  "components/QuickAccessDrawer.js",
  '  rowLabel:{fontSize:16,fontWeight:"600",color:INK.ink},',
  '  rowLabel:{fontSize:15,fontWeight:"700",color:INK.ink},',
  "drawer row hierarchy"
);

// 6) Persistent navigation: soften the print-heavy footer while preserving all
// five destinations, the raised Map/Camera action and the Discover fallback.
replace(
  "components/TabBar.js",
  '    borderTopWidth:2,\n    borderTopColor:INK.ink',
  '    borderTopWidth:1,\n    borderTopColor:INK.hair',
  "tab bar boundary"
);
replace(
  "components/TabBar.js",
  '  tab:{flex:1,minHeight:52,alignItems:"center",justifyContent:"flex-start",paddingTop:6},\n  marker:{height:3,width:26,borderRadius:2,backgroundColor:"transparent",marginBottom:5},',
  '  tab:{flex:1,minHeight:54,alignItems:"center",justifyContent:"flex-start",paddingTop:7},\n  marker:{height:2,width:18,borderRadius:99,backgroundColor:"transparent",marginBottom:5},',
  "tab proportions"
);
replace(
  "components/TabBar.js",
  '  label:{fontSize:10,marginTop:3,color:INK.inkSoft,textAlign:"center",paddingHorizontal:2},\n  labelActive:{color:INK.ink,fontWeight:"700"},',
  '  label:{fontSize:11,marginTop:3,color:INK.inkSoft,textAlign:"center",paddingHorizontal:2},\n  labelActive:{color:INK.ink,fontWeight:"800"},',
  "tab labels"
);
replace(
  "components/TabBar.js",
  '    borderWidth:2,\n    borderColor:INK.ink,\n    alignItems:"center",\n    justifyContent:"center",\n    // Hard offset shadow, never a blur.\n    shadowColor:INK.ink,\n    shadowOffset:{width:3,height:3},\n    shadowOpacity:1,\n    shadowRadius:0,\n    elevation:0',
  '    borderWidth:1,\n    borderColor:INK.ink,\n    alignItems:"center",\n    justifyContent:"center",\n    elevation:0',
  "raised primary action"
);

// 7) Legacy generic theme consumers: make them agree with the real Xplorer
// token system instead of presenting a second blue/grey product.
write("hooks/useColors.js",`import { useColorScheme } from "react-native";\nimport { INK } from "../utils/tokens";\n\nconst light={\n  primary:INK.ink,\n  background:INK.paper,\n  card:INK.card,\n  text:INK.ink,\n  subtext:INK.inkSoft,\n  border:INK.hair,\n  danger:INK.red,\n  success:INK.green,\n};\n\n// Xplorer's mapped, photographed and community content is designed on a light\n// information ground. A separate dark palette would turn the same semantic map\n// inks into different signals, so this challenger keeps one dependable visual\n// language across system appearance settings.\nconst dark=light;\n\nexport function useColors(){\n  useColorScheme();\n  return light;\n}\n`);

// 8) Leave a reviewable design record next to the source. This is not runtime
// functionality; it is the proof of what the challenger changed and refused to
// change.
const record=`# Katie Dill challenger — Xplorer Tournament B\n\n## Frozen basis\n\n- Source commit: 78632b12eeb4e4123b1a767c8b815fe6617681f9\n- Product Truth: DesignLab Tournament B locked package\n- Persona: Katie Dill research-backed runtime persona\n- Candidate inheritance: none\n\n## Experience thesis\n\nXplorer should help somebody understand what is available around them, trust what they are seeing, and move confidently from the screen into a worthwhile real-world experience. The app is therefore treated as one service journey rather than 76 unrelated screens.\n\n## Experience model\n\n1. Before — orient without demanding commitment.\n2. Discover — explain why something is relevant, not merely that it exists.\n3. Consider — make place/person/context legible before asking for an action.\n4. Trust — preserve verification, privacy, audience and recency signals.\n5. Commit — keep actions explicit and reversible where Product Truth permits.\n6. Prepare — keep the map, route, conversation and event context connected.\n7. Arrive / participate — let live state and communication do practical work.\n8. Complete — do not manufacture extra engagement after the real-world task.\n9. Remember / follow up — keep Moments, Memories, reviews and reputation distinct.\n\n## Whole-app design decisions\n\n- The existing semantic map palette remains intact; state colours are never reused as decoration.\n- Persistent navigation remains complete, but is calmer and easier to scan.\n- Map controls ask human questions instead of exposing filter mechanics.\n- Discover makes the existing recommendation reason a first-class trust cue.\n- Quick Access remains permission-correct but reads as grouped service areas rather than a raw route catalogue.\n- Legacy theme consumers are brought back into the canonical Xplorer token system.\n- The startup promise states the outcome of the service instead of listing content types.\n- No route, table, RLS rule, permission check, account model, creation boundary or persistence rule is changed.\n\n## Anti-imitation\n\nThis candidate does not reproduce Airbnb, Lyft, Stripe, or any other known product. Katie Dill's public design reasoning is used as a decision lens; the resulting interface is original to Xplorer and constrained by Xplorer's own Product Truth.\n`;
fs.mkdirSync(file("designlab/katie-dill"),{recursive:true});
write("designlab/katie-dill/DESIGN_CONSTITUTION.md",record);

console.log("Katie Dill challenger redesign applied to shared Xplorer surfaces.");
