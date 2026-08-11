# Doc amendments — do these before starting the redesign

Your existing `.md` files will actively fight this redesign. Four
conflicts, three of them blocking. Fix the docs first or every session
burns tokens arguing with your own agents.

---

## Blocker 1 — the redesign is mostly Stage Two to Five

`CLAUDE.md` scopes the project to Stage One: *"what exists around me"*.
It explicitly defers to later stages: check-ins, "happening now" states,
attendance counts, Now/Tonight/Weekend filters, registration, bookings,
directions, ordering.

The redesign brief specifies all of them:

| Brief says | CLAUDE.md stage |
|---|---|
| Floating filter "Happening now" | Two — named explicitly |
| "Busy now · 7 Explorers nearby" on map cards | Two |
| "23 people attending", "Link-up forming here at 7pm" | Two |
| Pulsing active markers, "8 Explorers checked in" | Two |
| Check-in as a primary create action | Two |
| "Join club", "Join link-up", "I'm going" | Three |
| Directions button on every map card | Four |
| "Book a table", "Get tickets" | Five |
| Explorer Leaderboards | Not in the stage plan at all |

`scope-warden.md` will return **out of scope for now** on most of these.
That is the agent working correctly.

Separately, `PROJECT-LOG.md` (2026-08-03) already records that the
codebase is past what CLAUDE.md describes — check-in creation, a live
discovery feed with radius filters, a People tab and `linkups_live_*`
migrations are built and shipping.

**So CLAUDE.md is already wrong, and has been for a while.**

### Do this

Rewrite the stage section of `CLAUDE.md` to match reality and intent.
Suggested replacement:

```markdown
## Current stage: Stage Two — make the map live

Stage One (what exists around me) is built but unverified. Stage Two
work is in progress and approved.

In scope now:
- Everything from Stage One
- Opt-in check-ins and expiring presence
- Scheduled and live state on pins
- Public link-ups
- Now / Tonight / Weekend filters
- Explorer Score, rankings and achievements

Still out of scope — say so and stop if asked:
- Bookings, ticketing, registration, payments (Stage Five)
- Directions, transport, taxi (Stage Four)
- Ordering and delivery (Stage Five)
```

Then add an explicit approval line so `AGENTS.md` §13 stops blocking:

```markdown
## Approved exceptions

Navigation replacement and UI redesign are APPROVED as of 2026-08-04,
scoped to docs/REDESIGN-BRIEF.md. AGENTS.md §13 does not apply to
packets listed in that brief.
```

**Directions and booking buttons stay out.** The brief lists them on
every card and page. Cut them from the packets — they are a Stage Four
and Stage Five promise the app cannot keep, and a dead button is worse
than no button. `RULES.md` already bans placeholder UI for later stages.

---

## Blocker 2 — the two design systems are irreconcilable

`docs/design-system.md` describes a riso-printed flyer. The brief
describes a modern soft-shadow product. These are not adjustable — they
are opposites:

| | design-system.md | Redesign brief |
|---|---|---|
| Palette | paper/ink/three inks | Green, Coral, Yellow, Blue, Midnight |
| Card radius | 9–14px | 20–24px |
| Elevation | hard offset shadow, no blur | "soft shadows instead of borders" |
| Borders | 1.5–2px ink, "not optional" | replaced by shadows |
| Colour meaning | blue=exists, pink=scheduled, yellow=offer | green=explore, coral=live, yellow=score |
| Signature | pin overprint, one flourish only | pulse/glow on active markers |

`designer.md` fails any work using a hex outside its token table, and
fails any blurred `box-shadow`. Under the current docs, **every screen
in this redesign is a defect.**

### RESOLVED 2026-08-10 — riso stays

The owner deferred the call. **Riso is kept**, which is what this document
already recommended, and the reasoning has only got stronger since it was
written: twelve packets are now built on that token table, and
`utils/tokens.js`, `scripts/verify-marker-assignment.cjs` and every tokenised
screen encode it. Switching would invalidate all of them to gain a palette this
document itself calls "like every other local app".

The brief's *structural* ideas were already ported — marker taxonomy, bottom map
cards, drawer, tab bar. Its colours were not, and now will not be.

**The one live consequence, and how it is paid.** The product names more states
than the palette has inks: an Event moves through upcoming, starting soon, live,
busy and finished, and there are three inks with one reserved for offers. Until
now the map could not show "happening right now" apart from "on Saturday" at
all.

That is now carried by the **overprint** — which `docs/design-system.md` had
specified from the start and nothing had ever implemented:

> "a place hosting something. A second pink disc sits behind, offset
> `translate(4px, -4px)` ... Deliberate misregistration."

Same ink, second channel. The brief wanted "pulse/glow on active markers"; a
glow is banned outright (no blurred shadows), and the overprint is the
riso-native form of that idea — so the brief's intent survives in the design
system's own vocabulary rather than against it.

**To overturn this,** change `MARKER_STATE_INK` in `utils/markers.js` and the
table in `docs/design-system.md` together; the marker gate fails if they drift.

### The original decision, kept as the record

Pick one. Then rewrite `docs/design-system.md` to match. Do not run both.

- **Keep riso** — cheaper, already documented, genuinely distinctive,
  and the pin colour semantics are better thought through than the
  brief's. You lose the green brand colour.
- **Switch to the brief's palette** — more conventional, more
  screenshot-friendly, but you are throwing away a finished design
  system and the overprint signature for something that looks like
  every other local app.

My read: keep riso, port only the *structural* ideas from the brief
(marker taxonomy, bottom map cards, drawer, tab bar). The brief's
strong parts are information architecture, not colour.

Either way, `docs/reference/xplorer-stage-one-design.html` — referenced
by `designer-1.md` — needs regenerating or the reference removed.

---

## Blocker 3 — you have two agents named `designer`

`designer.md` and `designer-1.md` both declare `name: designer` in
frontmatter. One silently shadows the other. `designer-1.md` is the
newer one (it adds check 8, the mockup comparison).

### Do this

Delete `designer.md`. Rename `designer-1.md` to `designer.md`. Confirm
the mockup path it references actually exists before keeping check 8 —
an agent told to open a missing file will either hallucinate its
contents or stall.

---

## Blocker 4 — "test itself and fix itself" has nothing to test with

From your own `PROJECT-LOG.md`:

- No test suite exists.
- The five `verify:*` scripts grep source files for strings. They prove
  code was written, not that it runs. 331 passing checks prove nothing.
- Nobody has installed the APK and used a screen.
- The web build path has still not validated `app.config.js`.
- RLS has never been audited.
- Three migration files insert test data and will run against production.

An autonomous agent with no failing signal does not self-correct. It
writes code, greps its own strings, and reports success. That is exactly
how the crashing map sat behind a green build for days.

### Do this

Packet 0 in the brief builds the harness. Do not skip it and do not let
the agent skip it. It is the difference between "self-testing" and
"self-congratulating".

---

## Small edits

**`RULES.md` — Output section** currently bans progress files:

> No summary markdown files after a task. No `IMPLEMENTATION_NOTES.md`,
> no `SUMMARY.md`.

A long multi-session run needs a durable ledger or every context
compaction loses the thread. Add one carve-out:

```markdown
Exception: `docs/REDESIGN-STATE.md` is a required ledger for the
redesign. Update it at the end of every packet. It is the only new
doc permitted without asking.
```

**`AGENTS.md`** is 248 lines and overlaps heavily with `CLAUDE.md` and
`RULES.md` — three standing instruction sets, all loaded every session,
partly contradicting each other. That is a token tax on every single
turn and a source of confusion. Consider collapsing `AGENTS.md` into a
pointer file:

```markdown
# AGENTS.md
See CLAUDE.md (what this is), RULES.md (how to work), and
docs/REDESIGN-BRIEF.md (what we're building now).
Repo/branch rules and the security section below still apply.
```

Keep §7 (branch workflow), §9 (Supabase security) and §15 (definition
of done). Delete the rest — it is restated elsewhere.
