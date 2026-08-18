# Building with the instrument kit

`docs/design-system.md` says what the app looks like. This says how to build it.

Read both before touching a screen. They exist because the first attempt at this
redesign failed in a specific, avoidable way, and the failure is worth naming.

## The failure this document prevents

The first pass swapped the palette in `utils/tokens.js` from warm paper to a
dark housing, and every screen picked the new values up automatically. The
result was the old app, dark. Same rounded cards, same filled pills, same emoji,
same 2px borders — recoloured. Every test passed. The design system file said
"Field Instrument". Nothing on screen was one.

**A design system is not a palette.** Tick scales, dials with detents, readouts,
reticles, etched rules, machined controls, bracketed frames — that is geometry,
and geometry has to be built. `components/instrument.js` is where it is built.
A screen that imports `INK` and lays out its own Views is a screen that will
drift straight back to the shape it had before.

So the rule is blunt:

> **Assemble screens from the kit. If a screen needs a shape the kit does not
> have, add it to the kit first — never inline a one-off.**

## What is in the kit

`components/instrument.js`, one import.

### Viewfinder parts

| Part | What it is for |
|---|---|
| `Aperture` | Concentric blades behind the shutter |
| `CornerFrame` | Four L brackets — anything that frames a live image |
| `Reticle` | Tap-to-focus target |
| `ProgressRing` | Hold-to-record progress, any timed hold |
| `Dial` | Drag along detents — zoom stops, durations, intensities |
| `TickScale` | The etched ruler. Texture, not data |

### Screen parts

| Part | What it is for |
|---|---|
| `Screen` | The housing every page sits in |
| `ScreenTitle` | Mono eyebrow · display title · ticked rule |
| `Panel` | The layered surface. Replaces every hand-rolled card |
| `SectionRule` | Etched divider with a mono eyebrow and a count |
| `Row` | One line in a list — name, sentence, measured values, chevron |
| `StateEdge` | State as a 2px left edge, never a fill |
| `Chip` | Filters, categories, tags, toggles |
| `Segmented` | Pick one of N, as a detented selector |
| `Action` | The button. `primary` · `secondary` · `quiet` · `danger` |
| `Field` + `fieldInputStyle` | A labelled well for an input |
| `Readout` | One measured value, label above |
| `ReadoutStrip` | Several measurements on one plate |
| `Meter` | A quantity read off a ticked track |
| `KeyValue` | A mono definition line |
| `Frame` | Media well with viewfinder brackets |
| `Empty` | Nothing to read — an instruction, not a mood |
| `Notice` | Errors, gates, warnings — an edge, not a coloured box |
| `Glyph` | The icon set. 30 stroked icons on the 16×16 grid |
| `MONO` | The mono family, resolved per platform |

## The rules, in order of how often they are broken

**1. No emoji. Ever.** 🔔 📍 ⭐ 💬 ▶ ✓ — all of them carry a platform-supplied
colour and weight that a two-colour instrument face cannot absorb, so they read
as stickers stuck to the housing. Use `Glyph`. If the icon you need is missing,
add it to `GLYPHS` in `components/instrument.js` on the same 16×16 canvas.

**2. Mono is for what the app measured; body is for what a person wrote.**
Distances, counts, times, statuses, categories, ranks, coordinates, button
labels → `MONO`, uppercase, tracked. Reviews, descriptions, names, help text,
empty-state instructions → the body face. This split is the single strongest
signal that the app is an instrument, and it is the easiest one to blur.

**3. 1px, never 2px.** `SHAPE.border` is 1. A 2px border is the print system.
The one exception is `StateEdge`'s left edge, which is 2px on purpose.

**4. Radius comes from `SHAPE.radius`.** 6 controls, 10 cards, 14 sheets, 999
pills and pins. A hand-typed `borderRadius:17` or `borderRadius:23` is the old
card shape surviving; there are no other radii.

**5. Selection does not fill with a state ink.** `exists`, `scheduled` and
`offer` mean *what a place is*. Being the selected tab, the chosen filter or the
active segment is not a state a place is in. Selection = step up a surface
(`panel` → `panelRaised`) + `hairlineStrong` edge + brightened label. This also
sidesteps the failure where a fill lands and every label inside becomes
unreadable.

**6. Filled colour takes dark text.** Every state ink is a bright colour on a
dark housing, so text on top of one is `INK.ground`, never `readout`. The table
is in `docs/design-system.md` and `scripts/verify-contrast.cjs` checks it on
every push. Fix the pair, not the gate.

**7. Elevation is a surface step plus a 1px top highlight.** `Panel` does it.
Hard offset shadows belonged to the print system. `SHAPE.shadow.floating` is
reserved for two things: the map sheet and the Create action.

**8. Never use the compatibility aliases in new work.** `INK.paper`, `INK.card`,
`INK.ink`, `INK.inkSoft`, `INK.hair`, `INK.blue`, `INK.pink`, `INK.yellow`,
`INK.green`, `INK.red` exist only so nothing broke mid-migration. `INK.ink` in
particular is now the near-white **readout** colour — `borderColor:INK.ink` put
a white outline around every feed card for a while, which is exactly what
recolouring-instead-of-rebuilding looks like when it goes wrong. Use
`exists`/`scheduled`/`offer`/`readout`/`hairline` and say what you mean.

**9. A horizontal `ScrollView` in a flex column must carry
`flexGrow:0, flexShrink:0`,** and its content container `alignItems:"center"`.
Without both it claims all the leftover vertical space and stretches its
children to fill it. Measured, in this repo: 402px-tall filter pills.
`Segmented` already does this; anything else that scrolls sideways must too.

**10. Nothing is done until it has been rendered and looked at.** A passing test
proves a control exists, not that it is the right height, not underneath the tab
bar, and not the old design. Export, serve, screenshot at 412×915, and run the
geometry and pixel checks. A green suite is not evidence.

## The shape of a screen

```jsx
import {Screen,ScreenTitle,Panel,SectionRule,Row,Action,Empty,Glyph} from "../components/instrument";

<Screen>
  <ScrollView contentContainerStyle={{paddingBottom:CREATE_HUB_CLEARANCE+24}}>
    <ScreenTitle eyebrow="ACTIVITY CLUB" title={club.name} meta={club.summary}/>

    <SectionRule label="Sessions" meta={`${sessions.length}`}/>
    {sessions.length
      ? sessions.map(s=>(
          <Row key={s.id} tone="scheduled" title={s.title} sub={s.where}
               meta={s.timeLabel} metaSub={s.distanceLabel} onPress={()=>open(s)}/>
        ))
      : <Empty title="No sessions yet" instruction="The manager adds sessions from their dashboard."/>}

    <Action kind="primary" label="Join this club" glyph="plus" onPress={join}/>
  </ScrollView>
</Screen>
```

Note what is *not* there: no `StyleSheet.create` full of card styles, no
hex values, no emoji, no hand-drawn heading. That is the point.

## Clearance

`components/CreateHub.js` floats a Create action above everything and exports
`CREATE_HUB_CLEARANCE`. Every scrolling screen must add it to its
`contentContainerStyle` bottom padding, or the last row of every list sits under
the button. The tab bar's own height is already handled by `app/_layout.js`.
