# Design system — Alex challenger

This challenger uses **Night / Signal / Air**: a calm city-operating system rather than the frozen app's printed-flyer language. The interface should help an Explorer decide, commit, move into the real world and return for continuity or reflection.

One sentence to hold onto: **context is dark, decisions are light, action is a clear signal, and map-state colour keeps its existing meaning.**

## Colour

Every six-digit colour used by this design system is declared here and in `utils/tokens.js`. Semantic map colours stay separate from Alex's brand/navigation language.

| Token | Hex | Used for |
|---|---|---|
| `paper` | `#F6F8FC` | Whole-app canvas / Air |
| `card` | `#FFFFFF` | Decision surfaces |
| `ink` | `#0A1020` | Primary text |
| `ink-soft` | `#667085` | Secondary text and metadata |
| `hair` | `#D9E0EA` | Quiet dividers and outlines |
| `navy` | `#0B132B` | Context, navigation and operational focus |
| `navy-soft` | `#18233F` | Secondary dark surface |
| `on-navy` | `#FFFFFF` | Strong text on Night |
| `on-navy-soft` | `#C7D0E1` | Supporting text on Night |
| `signal-mint` | `#39D6A5` | Primary action, focus and active navigation |
| `signal-deep` | `#0B765D` | Accessible small-text signal emphasis on Air/Surface |
| `lavender` | `#6654E8` | Accessible identity / reputation support on Air/Surface |
| `sky` | `#DDE8FF` | Quiet contextual highlight |
| `coral` | `#FF6B5E` | Human/live emphasis away from map-state channels |
| `water` | `#D9E7EA` | Water on the map |
| `park` | `#DCE8D4` | Green space on the map |
| `ink-blue` | `#2B4BE8` | Existing map state: it exists |
| `ink-pink` | `#FF3D6E` | Existing map state: something is scheduled |
| `ink-yellow` | `#FFC61A` | Existing map state: an offer is running |
| `ink-green` | `#1E7A4C` | Existing manager review-response semantic |
| `ink-red` | `#C2321F` | Existing manager review-dispute semantic |
| `heat-1` | `#1D3F8F` | Heat ramp: barely anything |
| `heat-2` | `#17A2B8` | Heat ramp: some |
| `heat-3` | `#3FBF5F` | Heat ramp: busy |
| `heat-4` | `#F5B324` | Heat ramp: very busy |
| `heat-5` | `#E8571F` | Heat ramp: hottest |

### Colour ownership

**Mint is product action, not geography.** It belongs to primary actions, focus and current navigation. It never replaces the existing blue/pink/yellow state system on the map.

**Blue, pink and yellow remain map semantics.** They say what state a place is in and must not become decorative headings, navigation or general buttons.

**Green/red remain the manager review-response pair.** They are not general success/error brand colours.

**Heat remains a data layer.** The ramp describes density of public Moments and stays beneath pins. It is not a brand gradient.

## Product rhythm

Alex's system is organised by service phase, not by making every screen look identical.

- **Intent / orientation:** a Night context surface names what this part of Xplorer is for.
- **Evaluation:** white decision surfaces prioritise time, place, people, capacity, reputation and privacy.
- **Commitment:** a single clear Signal action gets priority; secondary actions stay quiet.
- **Transition / live experience:** the interface recedes. Map and Inbox become more important than browsing furniture.
- **Reflection:** Feed, Memories, Reviews and Profile feel calmer and more editorial.

## Type

System fonts are used so the candidate remains technically realistic on Android and web.

- Context label: 11–12px, bold, short, optionally uppercase.
- Page title: 30–38px, heavy, compact tracking.
- Decision title: 18–22px, strong sentence case.
- Body: 15–16px with generous line height.
- Metadata: 12–14px, grouped by decision relevance rather than scattered as decoration.

## Surfaces

- Air is the canvas; Surface is content.
- Context/operational heroes use Night with a 22–28px radius.
- Decision cards use a quiet 1px hairline and 16–22px radius.
- The navigation dock is a continuous Night surface. The Map/Camera action can carry Signal inside the dock, but it is not a floating copy of the frozen footer.
- Avoid ornamental borders. A border must separate layers, group controls or communicate focus/state.
- No blurred shadows. Layering is expressed by ground, spacing and hard geometry.
- No decorative gradients. The existing heat ramp is data, not decoration.

## Map

A pin is still a state, not a decoration.

- Existing marker assignment and liveness derivation remain owned by `utils/markers.js`.
- Blue, pink and yellow keep their exact state meaning.
- Overprint/liveness stays derived rather than caller-controlled.
- Heat stays capped/faded by the existing map implementation.
- Alex changes the **decision controls and handoff around the map**, not the privacy or state mathematics underneath it.

## Navigation

Primary navigation expresses the whole-service loop:

1. **Explore** — intent and evaluation (`/discover`).
2. **Now** — live / near-term participation (`/live`).
3. **Map** — spatial handoff (`/map`); on Map the centre action becomes Camera.
4. **Inbox** — continuity around people, listings and boards (`/messages`).
5. **You** — identity, reputation and reflection (`/profile`).

Feed and Leaderboard remain real, reachable product capabilities. They are contextual/reflection surfaces rather than the five destinations that define the product.

Discover is visible in the primary dock **and** the frozen Map-to-Discover upward shortcut remains available. The visible destination is the discoverable path; the gesture is retained as an existing convenience, not made the only route.

## Motion

Motion explains cause and continuity only: a drawer/sheet entering, context changing, or a map-to-detail handoff. No ambient motion is required for the design to read. Reduced-motion disables nonessential movement.

## Copy

- Explorer, Manager, Link-up, Club, Event, Moment, Memory and Review retain their canonical Product Truth meanings.
- Buttons say what happens.
- Empty/error states explain the next useful action.
- Privacy copy describes who can see what, not abstract settings jargon.
- No design copy may imply a UI control can bypass database/RLS rules.

## Accessibility floor

- Minimum tap target: 44px.
- Selected navigation exposes `accessibilityState`, not colour alone.
- Signal focus/active treatment must also have shape/weight/context.
- Text on Night uses `on-navy` or `on-navy-soft` as appropriate.
- Text on Signal uses Night/Ink where needed for contrast.
- `signal-deep` and `lavender` are explicitly tuned to clear WCAG AA for small text on Air/Surface.
- Every map state keeps a non-colour label for assistive technology.
- Non-map routes remain available for map-dependent tasks.
- `scripts/verify-contrast.cjs` remains a hard gate. Fix the pair, not the gate.