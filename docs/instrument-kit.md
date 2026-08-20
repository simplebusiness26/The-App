# Building with the instrument kit

`docs/design-system.md` says what the app looks like. This says how to build it.

Read both before touching a screen. They exist because the first attempt at this
redesign failed in a specific, avoidable way, and the failure is worth naming.

## The two failures this document prevents

**The first**: a pass swapped the palette in `utils/tokens.js` and every screen
picked the new values up automatically. The result was the old app, recoloured.
Same rounded cards, same filled pills, same emoji, same borders. Every test
passed and nothing on screen had changed shape.

**A design system is not a palette.** Tick scales, dials with detents, readouts,
reticles, etched rules, machined controls, bracketed frames — that is geometry,
and geometry has to be built. `components/instrument.js` is where it is built.
A screen that imports `INK` and lays out its own Views is a screen that will
drift straight back to the shape it had before.

**The second, which cost more**: having learned that lesson, the build then
*designed*. It invented a near-black "field instrument" housing, an icon set on
a 16-unit grid with its own eight-rule doctrine, and a graduated scale along the
tab bar — all coherent, all carefully argued in comments, and none of it the
design that won the tournament. The winning artifact is a LIGHT riso print
system. Three gates were green the whole time, because each one measured
conformance to the build's own assumptions rather than to the artifact.

> **The winning artifact is the design. This kit is a transcription of it, not
> an interpretation of it.**
>
> `runs/the-app/2026-08-17T02-09-27-650Z/rounds/ui/blend-dewith-mengto-pins/artifact.html`
>
> Where this document, `docs/design-system.md`, a code comment or a memory of
> the design disagrees with that file, **open the file**. It is right and the
> other thing is a bug.

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
| `Chip` | Filters, categories, tags |
| `Toggle` | One claim, on or off, with the sentence that explains it |
| `Choice` | Pick one of several, where each option needs a sentence |
| `Counter` | A thing you can do, and how many people have done it |
| `Lamp` | The one moving thing — a slow pulse, live readings only |
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
| `Glyph` | The icon set. 69 stroked marks on the 16×16 grid, drawn to the construction rules written above `GLYPHS` |
| `MONO` | The mono family, resolved per platform |

### Escape hatches that already exist

Reach for these before composing a one-off:

- `Row`'s `glyph` takes an icon **name or a rendered node** — an avatar, a real
  map marker, a thumbnail all fit its leading well.
- `Row` and `Chip` take an `accessibilityLabel` override, and a `Segmented`
  item may carry one. Use it when the spoken label should be a fuller sentence
  than the visible one ("Tonight" → "Show what is happening tonight"). Do **not**
  wrap a kit control in another `Pressable` to achieve this — that nests two
  buttons and is worse for everybody.
- `KeyValue` takes `wrap`, which puts the value on its own line in the body
  face. Addresses, opening hours and licence lines are genuinely multi-line.
- `Frame` takes `height` for a fixed-height media well, `size` for a square,
  `ratio` otherwise.
- `Field` takes `counter` for a mono figure the app computed about what you are
  typing (`41/300`), opposite the hint.
- `Empty` takes `compact` for when several sit in one column.
- `Action` and `Counter` take `compact`, which narrows the padding and never
  the tap target.
- `Counter` takes `busy` (the spinner replaces the glyph, so the row does not
  reflow) and `inert` (a reading somebody may not add to).
- `Notice` takes a `glyph` and a `style`.
- `Readout` and `ReadoutStrip` take `valueFirst`; strip cells take `onPress`.

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

**4. Radius comes from `SHAPE.radius`.** 9 controls, 14 cards, 20 sheets, 999
pills and pins — the artifact's `--r-ctl`, `--r-card`, `--r-sheet`, `--r-pill`.
A hand-typed `borderRadius:17` is somebody eyeballing it.

**5. Selection fills with ink.** The artifact's `.chip.selected` takes a solid
`--ink` fill with `--paper` text; `Chip` and `Toggle` do exactly that. This is
the opposite of what this document said during the dark build, where selection
was a surface step — a rule that made sense on a housing with surface steps to
take. On paper there is one surface and selection is a printed block.

**6. Which ink takes which text is per-ink, not a rule with one branch.** Blue
is dark enough to carry white; pink and yellow are not and carry `INK.ink`; an
unclaimed dashed face carries `INK.inkSoft`. The table is in
`docs/design-system.md` and `scripts/verify-contrast.cjs` checks it on every
push. Fix the pair, not the gate. ("All filled inks take dark text" is right on
a dark housing and wrong on this one — it shipped once.)

**7. Elevation is a hard offset shadow.** `SHAPE.shadow.hard` (3,3) and
`hardSm` (2,2), zero blur, full opacity, in ink — a printed block sitting off
the page, not a glow. `Panel` and `Action` do it; a pressed `Action` slides into
its own shadow. `SHAPE.shadow.floating` is reserved for the map sheet and the
Create action. Blurred shadows are not in this design at all.

**8. `INK.paper`, `INK.card`, `INK.ink`, `INK.inkSoft`, `INK.hair`, `INK.blue`,
`INK.pink`, `INK.yellow` are the design's real names** — they are the
artifact's own `--paper`, `--card`, `--ink`, `--ink-soft`, `--hair`,
`--ink-blue`, `--ink-pink`, `--ink-yellow`, transcribed. Use them freely. This
document, and `scripts/verify-instrument.cjs`, spent a while calling them
"compatibility aliases" left over from a migration and banning them in new
work — which meant the gate was failing the design for being itself. The
semantic names (`exists`/`scheduled`/`offer`/`readout`/`hairline`) are still
there and still worth using where a value means a *state* rather than a colour.

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
