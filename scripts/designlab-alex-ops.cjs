"use strict";

const fs=require("fs");

function replaceOnce(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1) throw new Error(`${label}: expected one frozen pattern, found ${count}`);
  return source.replace(before,after);
}

// Manager: the existing operational content is valuable, but the frozen page
// opens like a generic dashboard. Reframe it as the operating phase of the same
// Explorer identity and make the action centre visually primary.
{
  const path="app/manager/dashboard.js";
  let source=fs.readFileSync(path,"utf8");
  source=replaceOnce(
    source,
    'import QRCodeGenerator from "../../components/QRCodeGenerator";\n',
    'import QRCodeGenerator from "../../components/QRCodeGenerator";\nimport AlexJourneyHeader from "../../components/AlexJourneyHeader";\n',
    "manager import"
  );
  source=replaceOnce(
    source,
    `      <Text style={styles.title}>Manager Dashboard</Text>\n      <Text style={styles.subtitle}>\n        Manage listings, approved members and printable QR codes from one place.\n      </Text>\n\n`,
    `      <AlexJourneyHeader\n        phase="OPERATE"\n        title="Run what you manage"\n        description="Decisions first, listing work second. Manager is capability attached to this same Explorer identity — not another account or inbox."\n        meta={totalPending ? \`${'${totalPending}'} pending\` : "Clear"}\n      />\n\n`,
    "manager header"
  );
  source=source
    .replace('container:{flex:1,backgroundColor:INK.card}', 'container:{flex:1,backgroundColor:INK.paper}')
    .replace('content:{padding:20,paddingBottom:60}', 'content:{padding:16,paddingBottom:70}')
    .replace('actionCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:17,marginBottom:30}', 'actionCard:{backgroundColor:INK.navy,borderWidth:1,borderColor:INK.navy,borderRadius:22,padding:17,marginBottom:26}')
    .replace('actionCardActive:{backgroundColor:INK.card,borderColor:INK.yellow}', 'actionCardActive:{backgroundColor:INK.navy,borderColor:INK.brand}')
    .replace('actionEyebrow:{fontSize:11,fontWeight:"bold",color:INK.red,letterSpacing:0.5}', 'actionEyebrow:{fontSize:10,fontWeight:"900",color:INK.brand,letterSpacing:1}')
    .replace('actionTitle:{fontSize:19,fontWeight:"bold",marginTop:5}', 'actionTitle:{fontSize:20,fontWeight:"900",color:INK.onNavy,marginTop:5}')
    .replace('actionText:{fontSize:14,color:INK.inkSoft,lineHeight:20,marginTop:5}', 'actionText:{fontSize:13,color:INK.onNavySoft,lineHeight:19,marginTop:5}')
    .replace('actionCount:{minWidth:68,backgroundColor:INK.yellow,borderRadius:13,paddingVertical:9,paddingHorizontal:11,alignItems:"center"}', 'actionCount:{minWidth:68,backgroundColor:INK.brand,borderRadius:15,paddingVertical:9,paddingHorizontal:11,alignItems:"center"}')
    .replace('actionCountClear:{backgroundColor:INK.card}', 'actionCountClear:{backgroundColor:INK.navySoft}')
    .replace('actionCountNumber:{fontSize:23,fontWeight:"bold"}', 'actionCountNumber:{fontSize:23,fontWeight:"900",color:INK.navy}')
    .replace('actionCountLabel:{fontSize:10,fontWeight:"bold",textTransform:"uppercase"}', 'actionCountLabel:{fontSize:9,fontWeight:"900",textTransform:"uppercase",color:INK.navy}')
    .replace('actionButton:{backgroundColor:INK.blue,padding:13,borderRadius:10,marginTop:14}', 'actionButton:{backgroundColor:INK.brand,padding:13,borderRadius:14,marginTop:14}')
    .replace('actionButtonText:{color:INK.card,fontWeight:"bold",textAlign:"center"}', 'actionButtonText:{color:INK.navy,fontWeight:"900",textAlign:"center"}')
    .replace('card:{backgroundColor:INK.card,padding:18,borderRadius:14,marginBottom:15,borderWidth:1,borderColor:INK.ink}', 'card:{backgroundColor:INK.card,padding:18,borderRadius:20,marginBottom:15,borderWidth:1,borderColor:INK.hair}')
    .replace('clubCard:{backgroundColor:INK.card,padding:18,borderRadius:18,marginBottom:28,borderWidth:2,borderColor:INK.ink}', 'clubCard:{backgroundColor:INK.card,padding:18,borderRadius:22,marginBottom:28,borderWidth:1,borderColor:INK.hair}')
    .replace('darkButton:{flex:1,backgroundColor:INK.ink,padding:14,borderRadius:10}', 'darkButton:{flex:1,backgroundColor:INK.navy,padding:14,borderRadius:13}')
    .replace('secondaryButton:{flex:1,backgroundColor:INK.card,padding:14,borderRadius:10,borderWidth:1,borderColor:INK.ink}', 'secondaryButton:{flex:1,backgroundColor:INK.paper,padding:14,borderRadius:13,borderWidth:1,borderColor:INK.hair}');
  fs.writeFileSync(path,source,"utf8");
}

// Admin: keep the exact gate, database counts and tool routes. Give the system
// its own high-density operational phase instead of inheriting consumer page
// hierarchy.
{
  const path="app/admin/dashboard.js";
  let source=fs.readFileSync(path,"utf8");
  source=replaceOnce(
    source,
    'import {useAdminGate} from "../../hooks/useAdminGate";\n',
    'import {useAdminGate} from "../../hooks/useAdminGate";\nimport AlexJourneyHeader from "../../components/AlexJourneyHeader";\n',
    "admin import"
  );
  source=replaceOnce(
    source,
    `      <Text style={styles.eyebrow}>ADMIN OVERVIEW</Text>\n      <Text style={styles.title}>What needs attention</Text>\n      <Text style={styles.intro}>\n        Live totals from the database, followed by the admin tools that are ready to use.\n      </Text>\n\n`,
    `      <AlexJourneyHeader\n        phase="CONTROL"\n        title="Operations at a glance"\n        description="Attention signals first, tools second. Counts come from the live database; this surface does not infer permissions the backend has not granted."\n        meta="Admin"\n      />\n\n`,
    "admin header"
  );
  source=source
    .replace('paddingHorizontal:20,\n    paddingTop:28', 'paddingHorizontal:16,\n    paddingTop:12')
    .replace('backgroundColor:INK.ink,\n    marginTop:18', 'backgroundColor:INK.navy,\n    marginTop:18')
    .replace('color:INK.ink,\n    fontSize:16,\n    fontWeight:"800"', 'color:INK.onNavy,\n    fontSize:16,\n    fontWeight:"900"')
    .replace('borderRadius:18,\n    borderWidth:1,\n    backgroundColor:INK.card,\n    padding:17', 'borderRadius:18,\n    borderWidth:1,\n    backgroundColor:INK.navy,\n    padding:17')
    .replace('claimMetric:{\n    backgroundColor:INK.water\n  }', 'claimMetric:{\n    backgroundColor:INK.brand\n  }')
    .replace('color:INK.ink,\n    fontSize:34,\n    fontWeight:"900"', 'color:INK.onNavy,\n    fontSize:34,\n    fontWeight:"900"')
    .replace('color:INK.inkSoft,\n    fontSize:14,\n    fontWeight:"700",\n    lineHeight:18', 'color:INK.onNavySoft,\n    fontSize:14,\n    fontWeight:"700",\n    lineHeight:18')
    .replace('borderRadius:18,\n    borderWidth:1,\n    backgroundColor:INK.card,\n    marginBottom:10', 'borderRadius:18,\n    borderWidth:1,\n    backgroundColor:INK.card,\n    marginBottom:10');
  fs.writeFileSync(path,source,"utf8");
}

console.log("Alex operational surfaces transformed.");
