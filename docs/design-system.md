# Design system — The riso instrument

> **This document is a transcription, not an interpretation.** Every value below
> is read out of the artifact the product owner chose at the end of the UI
> tournament:
> `runs/the-app/2026-08-17T02-09-27-650Z/rounds/ui/blend-dewith-mengto-pins/artifact.html`
> Where this file and a memory of the design disagree, **open the artifact.**

The winning entry's own thesis, in its own words:

> The current riso-print system, **evolved** into an instrument: the calm
> three-ink print language **stays the floor everywhere**, while the camera and
> the map — the app's two genuinely technical surfaces — gain tick-mark dials,
> focus reticles and layer trays drawn in the same disciplined ink, so expert
> control reads as mechanically trustworthy rather than bolted on.

Read that twice before changing anything here.

**The print language is the floor, not the thing being replaced.** Warm paper,
flat inks, a real ink border and a hard offset shadow *are* the design. The
instrument is what the camera and the map **gain on top of it** — dials with
tick marks, focus reticles, layer trays — drawn in the same ink.

## Why this document says that so loudly

An earlier pass threw the print system away and built a near-black app with
cyan, amber and violet, reasoning that a redesign must not preserve the
incumbent's visual language. That reasoning is right in general and was wrong
here, because **the winning entry is the incumbent's language evolved** — that
is what was chosen and why it won.

It then became self-reinforcing: this document was rewritten to declare riso
"superseded", a dark component kit was built, and a verification gate was
written that counted riso colours as *incumbent pixels* and failed on them. For
three passes the tooling policed the wrong design and reported "zero incumbent
pixels" as proof of success. Nobody opened the artifact and compared until the
product owner had rejected the work three times.

So: the artifact is the specification. Not a summary of it, not this file.

## Colour

Fixed, and deliberately unconditional on the viewer's theme — the artifact
commits to one look: newsprint.

### The print surface

| Token | Hex | Used for |
|---|---|---|
| `paper` | `#E7E8E1` | App background, map ground |
| `card` | `#F3F3ED` | Cards, sheets, rows, the tab bar |
| `ink` | `#16181C` | Text, and **every border** |
| `inkSoft` | `#63686F` | Secondary text, inactive controls |
| `hair` | `#C9CBC2` | The one lighter rule, for dividers *inside* a card |

An edge in this system is **ink**, not a grey line. That is the single biggest
difference from a conventional dark UI and the reason the app reads as printed.

### The three state inks — what a place IS

| Token | Hex | Meaning |
|---|---|---|
| `blue` | `#2B4BE8` | A place exists — business, property, park |
| `pink` | `#FF3D6E` | Something is happening here — session, event, live |
| `yellow` | `#FFC61A` | A time-bound offer. Always expires itself |

These three are the only saturated colours on the map, and they are never
decorative — not for a heading, not for a hover tint, not for a brand flourish.

### The manager's two answers

| Token | Hex | Meaning |
|---|---|---|
| `green` | `#1E7A4C` | A manager replying to a review |
| `red` | `#C2321F` | A manager disputing one |

Exactly two jobs. Never on the map, never as a generic success/error colour, and
never for admin approve/reject — an admin decision uses `blue` and an outline,
because approving a claim is not the same act as a manager answering a customer.

### Map terrain

| Token | Hex |
|---|---|
| `water` | `#BFD1CF` |
| `park` | `#C2CFAF` |
| `road` | `#D8D9D2` |

Soft washes on paper, so the inked pins stay the sharpest thing on the map. The
road tone is the artifact's own page border — the lightest mark that still reads
as a drawn line on newsprint.

### The heat ramp

| Token | Hex | Density |
|---|---|---|
| `heat-1` | `#1D3F8F` | Barely anything |
| `heat-2` | `#17A2B8` | Some |
| `heat-3` | `#3FBF5F` | Busy |
| `heat-4` | `#F5B324` | Very busy |
| `heat-5` | `#E8571F` | The hottest thing on screen |

One layer, never a pin, a border, text or a background. The state inks say what
a **place** is; this says how many **people** are posting.

## Type

| Face | Job |
|---|---|
| **Archivo** | Display — screen titles, place names, stat numerals |
| **Instrument Sans** | Body — everything a person wrote |
| **Martian Mono** | Data — everything the app measured. Uppercase, `0.06em`, 10.5px |

**If a human typed it, Instrument Sans. If the app computed it, Martian Mono.**
That split is what makes the app read as an instrument rather than a page.

## Shape — printed, not machined

- **Borders are ink and they are thick.** `1.5px` on most things; `2px` on the
  ones that carry weight — a pin, a button, the tab bar's top edge, a sheet.
- **Radius:** 9px controls, 14px cards, 20px sheets, 999px pills, 50% pins.
- **Elevation is a hard offset shadow in ink** — `3px 3px 0` and its `2px 2px 0`
  sibling. Never a blur. A blurred shadow is the thing this system is not.
- **A pressed control slides into its own shadow** (`translate(1.5px, 1.5px)`,
  shadow removed). That is what a printed block does when you push it.

## Pins — the signature

- 34px circle, **2px ink border**, **a mono capital centred** — not a picture.
  `B` business · `P` property · `C` club · `E` event · `L` public place, plus
  `K` link-up, `H` an explorer here now and `M` a Memory for the things the
  artifact's demo never had to draw. 12px at a 34px pin, tracking 0.
  The category drawing (a cup, a leaf, a bag) still exists on the marker and is
  still drawn by cards and rows at sizes where it reads; it is only the pin face
  that is typographic.
- Fill is the state ink at **82% over a real blur** (`blur(7px) saturate(170%)`),
  so the map reads *through* the pin. This is the Meng To graft, and it is the
  one place the hard-edged register deliberately softens — the map is where you
  look through the interface at the world.
- **Which glyph ink is per-ink, not a rule with one branch.** Blue is dark
  enough to take white; pink and yellow are not and take ink:

  | Fill | Letter |
  |---|---|
  | `blue` | `#FFFFFF` |
  | `pink` | `ink` |
  | `yellow` | `ink` |
  | unclaimed (`card` at 70%, dashed border) | `inkSoft` |

- **Overprint** — a place hosting something gets a second `pink` disc offset
  behind it. `react-native-svg` has no blend mode, so native falls back to an
  opacity approximation; the intent is two facts about one point.

## Navigation

The tab bar is `card`, 64px tall, with a **2px ink top border**. Five equal
destinations, each a 19px icon over a mono uppercase label at 8.5px / `0.08em`.
**The active destination's icon is `blue`**, with its label in `ink` and a
medium weight.

Nothing else. There is no scale along the top edge and no travelling indicator —
both were built, and neither is in the artifact.

### Icons

The icon set is transcribed from the artifact's own `ic()` table: a 20-unit box,
`fill:none`, `stroke:currentColor`, **1.6** weight, round caps and joins. The
five navigation marks are a ringed aperture (Map), an eight-ray burst
(Happening), two figures (Community), a speech bubble (Messages) and one figure
(Me). `components/instrument.js` holds them and nothing draws its own.

## Motion

- 90ms press, 180ms standard, 320ms for the sheet's snap between Peek/Half/Full.
- No parallax, no ambient animation, no staggered reveals.
- One exception: a slow pulse on a genuinely live reading. Liveness is the app's
  whole point, so it gets the only moving thing on screen.
- `prefers-reduced-motion` disables all of it.

## Copy

- Explorers, not users. Managers, not owners. Sessions for clubs, events for
  dated things. The full lexicon is in `RULES.md` and binds UI copy too.
- Sentence case everywhere except mono data labels.
- Buttons say what happens: "Save this club", not "Submit".
- Empty states are instructions, not moods.
- Privacy controls read as sentences about people: "Nobody can see where you
  are." Never "Location sharing: disabled."
- No exclamation marks. No "Oops".

## Accessibility floor

- Visible focus ring: 2px `blue`, 2px offset.
- **Which text on which ground:**

  | Ground | `ink` text | `paper`/white text |
  | --- | --- | --- |
  | `paper` `#E7E8E1` | ✅ | ❌ |
  | `card` `#F3F3ED` | ✅ | ❌ |
  | `blue` `#2B4BE8` | ❌ | ✅ |
  | `pink` `#FF3D6E` | ✅ | ❌ |
  | `yellow` `#FFC61A` | ✅ | ❌ |
  | `green` `#1E7A4C` | ❌ | ✅ |
  | `red` `#C2321F` | ❌ | ✅ |

- `scripts/verify-contrast.cjs` checks this on every push against the real hex
  values in `utils/tokens.js`. Fix the pair, not the gate.
- Every pin needs a text label available to screen readers; colour is never the
  only carrier of state.
- Minimum tap target 44px even where the visible pin is 34px.
