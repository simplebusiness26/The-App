import React from "react";
import {View,Text,ScrollView,StyleSheet} from "react-native";
import {INK,TYPE} from "../utils/tokens";
import {Dial,KeyValue,MONO,Panel,SectionRule,Segmented,Toggle} from "./instrument";
import {STYLE_CHOICES} from "../utils/mapProvider";
import {HEAT_TIMEFRAMES,heatTimeframe} from "../utils/markers";

// THE LAYERS TRAY -- the map's precision level.
//
// The locked spec's complexity ladder gives every surface four depths: what is
// one tap away, what appears only in context, what an expert can reach, and
// what belongs in preferences. This is the map's THIRD one, and it was the
// missing one: the map had filters (immediate) and a pin sheet (contextual) and
// Settings (configuration), and nothing at all between them.
//
// It is not on the screen at rest. One tap on the layers control in
// components/MapControls.js opens it, a second closes it, and it holds exactly
// the three controls the spec names:
//
//   the Moment-density heat dial, Now -> Week
//   the three-way map-style switch
//   the cluster toggle
//
// IT DECIDES NOTHING. Every value and every setter is passed in, the same rule
// components/MapControls.js is held to by scripts/verify-living-map.cjs -- this
// is a surface for controls, not a second opinion about what a layer means. In
// particular it does not know what the heat COLOURS mean: utils/markers.js owns
// that, and the timeframe key is handed straight through to it.

export default function LayersTray({
  showHeat,
  onShowHeat,
  heatTimeframe:timeframe,
  onHeatTimeframe,
  styleKey,
  onStyleKey,
  clustered,
  onClustered,
  // Where the built-in clustering genuinely cannot follow. Passed in rather
  // than assumed, so the tray tells the truth on whichever platform it is on
  // instead of drawing a switch that quietly does nothing.
  clusterNote
}){
  const frame=heatTimeframe(timeframe);

  return(
    // BOUNDED, AND IT SCROLLS.
    //
    // Measured in a browser at 412x915: unbounded, the tray was 689px tall --
    // three quarters of the screen, sitting on top of the floating Log in and
    // Create controls at the bottom of the map. A panel that covers the map is
    // the furniture this whole control row exists to have removed, and a
    // control underneath another control is the composition bug that no unit
    // test sees. So the tray has a ceiling and scrolls inside it, whatever is
    // added to it later.
    <Panel style={styles.tray} accessibilityLabel="Map layers">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/*
        HEAT. The toggle is the same question the filter row asks -- it is the
        one control that appears at two depths on purpose, because turning the
        wash off is a thing somebody wants one tap away and setting what it
        measures is not.
      */}
      <SectionRule label="Moment heat"/>
      <Toggle
        label="Show the heat"
        sub="A wash over where public Moments are being posted."
        glyph="live"
        value={!!showHeat}
        onChange={(next)=>onShowHeat?.(next)}
        accessibilityLabel={showHeat ? "Hide the Moment heat" : "Show the Moment heat"}
      />

      <View style={styles.dialBlock}>
        {/* The range is named on the head strip -- Now to Week -- so the dial is
            readable before it is touched, and what it is SET to is the reading
            on the right. Both in mono: they are measurements. */}
        <View style={styles.dialHead}>
          <Text style={styles.dialLabel}>TIMEFRAME (NOW TO WEEK)</Text>
          <View style={styles.dialLine}/>
          <Text style={styles.dialValue}>{frame.label}</Text>
        </View>

        {/*
          A REAL DIAL, ON REAL PAINT PROPERTIES.
          Each detent is a different pair of MapLibre heatmap-weight and
          heatmap-intensity values, worked out in utils/markers.js. NOW gives
          every live Moment the same weight, so the wash is where people are
          POSTING; WEEK weights each one by the attention it has gathered.
        */}
        <Dial
          values={HEAT_TIMEFRAMES.map((entry)=>entry.key)}
          active={frame.key}
          onChange={(next)=>onHeatTimeframe?.(next)}
          width={236}
          format={(key)=>heatTimeframe(key).label}
        />

        <Text style={styles.dialSentence}>{frame.sentence}</Text>

        {/* The two MapLibre paint properties the dial is actually driving,
            reported. An instrument shows its own readings. */}
        <KeyValue label="Intensity" value={frame.intensity.toFixed(2)}/>
      </View>

      {/*
        THE MAP UNDER EVERYTHING ELSE. Three real styles, and the instrument is
        first because it is the one this design was drawn for -- the other two
        are there for a bright day and for somebody who wants street detail,
        not because a switch needed a third position.
      */}
      <SectionRule label="Map style"/>
      <Segmented
        items={STYLE_CHOICES.map((choice)=>({
          key:choice.key,
          label:choice.label,
          accessibilityLabel:`${choice.label} map style. ${choice.sentence}`
        }))}
        active={styleKey}
        onChange={(next)=>onStyleKey?.(next)}
      />

      {/*
        CLUSTERING, THE MAP'S OWN.
        MapLibre does this in the source -- cluster:true on the GeoJSON source,
        with the map computing the groups as the camera moves. That is a
        different thing from the app counting overlaps itself, and it is what
        the spec asked for.
      */}
      <SectionRule label="Pins"/>
      {/* The honest note about what the grouping IS rides on the control
          itself rather than in a panel underneath it -- a caveat somebody has
          to scroll to find is a caveat nobody reads, and one more block was
          also what pushed this tray over the map's own floating controls. */}
      <Toggle
        label="Group nearby pins"
        sub={clusterNote || "Pins that would overlap become one numbered circle."}
        glyph="grid"
        value={!!clustered}
        onChange={(next)=>onClustered?.(next)}
        accessibilityLabel={clustered ? "Stop grouping nearby pins" : "Group nearby pins"}
      />
      </ScrollView>
    </Panel>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // 540 measured against a 915-tall device: the tray ends well clear of the
  // floating Create and Log in controls at the bottom of the map, and the map
  // itself is still more than half the screen with the tray open.
  tray:{padding:12,marginTop:8,maxHeight:540},
  scroll:{flexGrow:0},
  body:{paddingBottom:2},

  dialBlock:{marginTop:12},
  dialHead:{flexDirection:"row",alignItems:"center",gap:9},
  dialLabel:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm},
  dialLine:{flex:1,height:1,backgroundColor:INK.hairline},
  dialValue:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},

  // A sentence somebody reads, so it stays in the body face. What the dial is
  // set to is a measurement and stays in mono, above.
  dialSentence:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,
    marginTop:10
  },

});
