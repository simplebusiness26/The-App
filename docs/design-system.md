# Design system — Field Instrument

> **Superseded the riso-print system on 2026-08-17.** This document is the
> output of the DesignLab tournament: the "instrument" concept (de With) with
> frosted-glass map pins (Meng To), chosen by the product owner. The previous
> riso system — warm paper, flat inks, 2px black borders, hard offset shadows —
> is prior art. It is not a fallback, and nothing in this app should be styled
> back toward it. If you find older guidance that disagrees with this file,
> this file wins.

The look is a **precision field instrument**: a calm dark housing, so the map
and its readings are the only lit things on screen. Hairline etched rules
instead of printed borders. Measured data set in mono, because an instrument is
read, not just looked at.

One sentence to hold onto: **the housing recedes, the readings glow.**

## Why this replaced the print system

The riso system was coherent, and its best idea survives here (see Type). But it
made every surface shout equally — a 2px black border and a hard offset shadow
on every card, chip and pin — which left no visual room for *this reading is
live right now*. That is the one thing a local-discovery app most needs to say.

The instrument inverts it. The housing drops to near-black and holds no
decoration. Borders become a 1px hairline. Elevation comes from layered surface
tones, not print offset. Saturated colour is spent only on state.

## Colour

Never introduce a colour outside this list. If something needs a new colour, the
design is wrong. (That rule was right in the old system; only its subject
changed.)

### Surfaces — the housing

| Token | Hex | Used for |
|---|---|---|
| `ground` | `#0F1216` | App background, map housing |
| `panel` | `#161B22` | Cards, sheets, rows |
| `panelRaised` | `#1E252E` | Nested cards, raised chrome, pressed states |
| `inset` | `#0B0E12` | Inputs, wells, the camera viewfinder ground |

Four steps, so depth reads without a single shadow.

### Lines — the etched rule

| Token | Hex | Used for |
|---|---|---|
| `hairline` | `#262E38` | Every card, chip, row, control edge — at **1px** |
| `hairlineStrong` | `#38424E` | Emphasis, active control edge, dial tracks |

**1px, not 2px.** This is the single biggest visual difference from the print
system, and the reason the UI reads as machined rather than stamped. A 2px
border anywhere is a bug.

### Text — the backlit readout

| Token | Hex | Used for |
|---|---|---|
| `readout` | `#E8EDF2` | Primary text |
| `readoutSoft` | `#97A3B2` | Secondary text, metadata |
| `readoutFaint` | `#616E7D` | Tertiary, mono captions, disabled |

Slightly cool white, never pure `#FFF` — an instrument's readout is lit, not
blown out.

### State inks — what a place IS

| Token | Hex | Meaning |
|---|---|---|
| `exists` | `#4CC9E8` | A place exists — business, property, park |
| `scheduled` | `#FFAB2E` | Something is happening here — club session, event, live check-in |
| `offer` | `#A78BFA` | A time-bound offer. Always expires itself |

**Cool means a static fact, warm means live and temporal.** That is the whole
logic, and it is why `scheduled` is the warmest thing on the map.

These three are the only saturated colours that appear on the map, and they are
never decorative — not for a nice heading, not for a hover tint, not for a brand
flourish. An active tab is a place you are, not a state a place is in, so the
navigation uses none of them as fill.

### Map terrain

| Token | Hex | Used for |
|---|---|---|
| `land` | `#12161C` | Map land |
| `water` | `#10202C` | Water |
| `park` | `#142218` | Green space |
| `road` | `#1C2430` | Roads |

Desaturated and close to the housing, so the state inks stay the brightest thing
on the map. The dark map style is built from these in `utils/mapProvider.js`.

### The manager's two answers

| Token | Hex | Meaning |
|---|---|---|
| `agree` | `#3FBF7F` | A manager replying to a review |
| `dispute` | `#F2555A` | A manager disputing one |

Exactly two jobs. They appear together or not at all. **Never on the map, never
as a generic success/error colour, and never for admin approve/reject** — admin
decisions use `exists` and an outline, because approving a claim is not the same
act as a manager answering a customer.

### The heat ramp

| Token | Hex | Density |
|---|---|---|
| `heat-1` | `#22346E` | Barely anything |
| `heat-2` | `#16717F` | Some |
| `heat-3` | `#2A9457` | Busy |
| `heat-4` | `#C89A22` | Very busy |
| `heat-5` | `#E0543A` | The hottest thing on screen |

A continuous wash for public Moment density. It exists for exactly one layer:
never a pin, a border, text or a background. Re-keyed for the dark housing — the
old ramp's mid greens glowed against dark and pulled attention off the pins.

Capped at 55% opacity and faded out as you zoom in, so pins keep their contrast.
The state inks say what a **place** is; this says how many **people** are
posting. Different questions, so they never share a colour.

## Type

Three faces, three jobs. Never use one for another's job.

**Inter Tight** — display. Screen titles, place names, buttons, stat numerals.
`letter-spacing: -0.02em`. Tight and neutral; the instrument's engraved labels.

**Inter** — body. Everything a person wrote: reviews, descriptions, control
labels, help text. 12.5–15px, 1.5 line height.

**JetBrains Mono** — data. Everything the system measured: distance, times,
counts, status, category, coordinates. Uppercase, `letter-spacing: 0.08em`,
9.5–12px.

**The mono/sans split is the old system's best idea and it survives unchanged:**
if a human typed it, it is Inter. If the app computed it, it is JetBrains Mono.
Do not blur that line — it is what makes the app feel like an instrument rather
than a page.

## Surfaces and elevation

- Every card, chip, row and control has a **1px `hairline` border**.
- Radius: 6px controls, 10px cards, 14px sheets, 99px pills, 50% pins.
- **Elevation is layering, not shadow.** Move up a surface step
  (`panel` → `panelRaised`) and add a 1px top highlight
  (`rgba(255,255,255,.06)`) for a bevelled panel edge.
- A soft ambient shadow is reserved for genuinely floating things — the map
  sheet, the Create action. **No hard offset shadows.** Those belonged to the
  print system.

## Pins — the signature

A pin is a state, and now also a lens.

- 34px circle, 1px hairline border, glyph centred.
- Fill is the state ink at **~82% opacity over a real blur** (`expo-blur`
  `BlurView` on native), so the map reads *through* the pin instead of being
  covered by it. This is the Meng To graft, and it is the one place the
  instrument's hard-edged discipline deliberately softens — the map is where
  you look *through* the interface at the world.
- **Cyan** — a place that exists. **Amber** — something scheduled here.
  **Violet** — an offer running.
- **Dashed hairline, `panel` fill** — unclaimed. An invitation, not an error.
- **Overprint** — a place hosting something: a second `scheduled` disc offset
  `translate(4px, -4px)` behind. `react-native-svg` has no blend mode, so this
  is an opacity approximation on native; the intent is a doubled reading, two
  facts about one point.

The glass pin is the memorable thing in this design. Everything else stays quiet
so it lands. Don't add a second signature.

## Motion

Precise and damped. An instrument responds; it does not perform.

- 90ms press feedback. 140ms standard transition. 320ms spring for the map
  sheet's snap between Peek/Half/Full.
- No parallax, no ambient animation, no staggered reveals.
- The one exception: a slow pulse on a genuinely live reading (an active
  check-in, a session happening now). Liveness is the app's whole point, so it
  gets the only moving thing on screen.
- `prefers-reduced-motion` / reduce-motion disables all of it.

## Copy

- Explorers, not users. Managers, not owners. Sessions for clubs, events for
  dated things. Full lexicon is in RULES.md — binding on UI copy too.
- Sentence case everywhere except mono data labels.
- Buttons say what happens: "Save this club", not "Submit". The button name
  survives into the confirmation.
- Empty states are instructions, not moods. "Nobody manages this yet. Scan the
  QR inside to claim it." — not "Nothing here."
- Privacy controls read as sentences about people: "Nobody can see where you
  are." Never "Location sharing: disabled."
- No exclamation marks. No "Oops". Errors say what happened and what to do next.

## Accessibility floor

- Visible focus ring: 2px `exists`, 2px offset.
- **Which text on which ground.** The state inks are bright colours on a dark
  housing, which inverts the old system's rule: they take **dark** text, never
  white.

  | ground | light `readout` text | dark `ground` text |
  | --- | --- | --- |
  | `ground` `#0F1216` | ✅ | ❌ |
  | `panel` `#161B22` | ✅ | ❌ |
  | `panelRaised` `#1E252E` | ✅ | ❌ |
  | `exists` `#4CC9E8` | ❌ | ✅ |
  | `scheduled` `#FFAB2E` | ❌ | ✅ |
  | `offer` `#A78BFA` | ❌ | ✅ |
  | `agree` `#3FBF7F` | ❌ | ✅ |
  | `dispute` `#F2555A` | ❌ | ✅ |

  So: `readout` on every housing surface; dark `ground` text on every filled
  state colour.
- A filled state colour is not the only way to show selection. A selected chip
  may mark itself with a `hairlineStrong` edge and a `panelRaised` fill, which
  avoids restyling every label inside it — the failure mode where a fill lands
  and the labels inside it become unreadable.
- `scripts/verify-contrast.cjs` checks this on every push. It reads the real hex
  values out of `utils/tokens.js` and does the sums. Fix the pair, not the gate.
- Every pin needs a text label available to screen readers; colour is never the
  only carrier of state.
- Minimum tap target 44px even where the visible pin is 34px.
