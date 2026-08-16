# Alex Schleifer Challenger — Contextual City Companion

Frozen source: `78632b12eeb4e4123b1a767c8b815fe6617681f9`

This is a research-backed challenger lens, not an impersonation and not a copy of any product Alex Schleifer worked on.

## Governing sentence

**Xplorer should help a person move from “what could I do?” to a confident real-world commitment with as little interface friction as possible, then preserve the social continuity and reflection that make the experience matter.**

The current Xplorer interface is evidence, not a template. Product Truth is locked. The visual and structural answer is not.

## Product Model

Xplorer is a city decision-and-continuity system with seven phases:

1. **Intent** — I want to do something, meet someone, find somewhere or understand what is around me.
2. **Orientation** — show the few meaningful ways into the city: Explore, Now and Map.
3. **Evaluation** — surface time, place, people, capacity, reputation and privacy before decorative detail.
4. **Commitment** — joining, following, messaging, checking in or choosing a place must feel explicit and reversible where the product allows it.
5. **Transition** — the interface gets out of the way as the user moves into the real world; Map and Inbox become more important than browsing.
6. **Live experience** — presence, Link-ups, boards, direct messages and camera capture support what is happening without turning the phone into the experience.
7. **Reflection** — Memories, Reviews, Feed, reputation and Profile carry the value forward.

### Primary product objects
- **Explore**: discovery and evaluation across real Xplorer entities.
- **Now**: live/near-term participation — Live, Link-ups, current context.
- **Map**: spatial orientation and handoff into a real place or activity.
- **Inbox**: people, listings and boards as continuity around a plan.
- **You**: identity, reputation, scrapbook and management capability.

Feed and Leaderboard remain full capabilities but are no longer treated as the five most important top-level destinations. They move into contextual access because reflection/reputation follows activity rather than preceding it.

## Journey Model

### Intent → Orientation
A signed-out or signed-in Explorer should understand within seconds that the product answers three questions: **what fits, what is happening, where is it?** Explore, Now and Map are visible destinations rather than hidden gestures.

### Orientation → Evaluation
Discovery surfaces lead with the decision facts already in the database. Events foreground date/time/place. Link-ups foreground status/time/place/people/capacity. Clubs foreground recurrence/location/membership/reputation. Map controls are a compact decision dock, not generic UI furniture.

### Evaluation → Commitment
Calls to action use explicit verbs — join, request, follow, message, review, manage — and preserve all existing permission/audience rules. The design never suggests that a UI control can override RLS or privacy.

### Commitment → Transition
Once a choice is made, Map and Inbox carry the journey. The interface reduces competing navigation emphasis rather than trying to hold attention.

### Live experience → Reflection
Camera remains the only first-stage Moment/Memory creation path. Feed becomes a reflection surface: “what your circle discovered,” not the conceptual home of the product. Profile becomes a personal local passport combining reputation, memories and capability.

## Design System Definition — “Night / Signal / Air”

The visual identity deliberately leaves frozen Xplorer’s grey riso-flyer language behind.

### Core palette
- Night: `#0B132B` — navigation, hero/context surfaces, operational focus.
- Night soft: `#18233F` — secondary dark surface.
- Air: `#F6F8FC` — app canvas.
- Surface: `#FFFFFF` — content ground.
- Ink: `#0A1020` — primary text.
- Slate: `#667085` — secondary text.
- Hairline: `#D9E0EA` — quiet separation.
- Signal mint: `#39D6A5` — primary action/focus/active navigation, never map-state semantics.
- Signal deep: `#0F8F70` — accessible emphasis.
- Lavender: `#7567F8` — supporting identity/reputation accent.
- Sky: `#DDE8FF` — contextual light surface.
- Coral: `#FF6B5E` — human/live emphasis when it is not a map-state channel.

Existing blue/pink/yellow map-state semantics remain reserved for the map classification system. They are not used as Alex’s brand/navigation palette.

### Type hierarchy
- Context label: 11–12px, bold, uppercase only when it communicates phase/system.
- Page title: 30–38px, heavy but compact.
- Decision title: 18–22px, strong sentence case.
- Body: 15–16px with generous line height.
- Metadata: 12–14px, grouped by decision relevance rather than scattered chips.

### Surface language
- No old thick black outlines as the default container grammar.
- Dark contextual hero bands establish phase and intent.
- White decision surfaces use quiet 1px hairlines and large 20–28px radii.
- Primary actions are mint-on-night or night-on-mint depending context.
- State colours are semantic; decorative colour never borrows map-state blue/pink/yellow.

### Motion
Motion establishes cause and continuity only: drawer/sheet entrance, context change and map-to-detail handoff. Reduced-motion continues to disable nonessential movement.

## Structural Plan

### 1. Navigation — major
Primary dock becomes **Explore / Now / Map / Inbox / You**. It is a floating dark dock rather than the old light footer with a raised circular Map button. Map occupies the centre but lives inside the dock. On Map that centre action becomes Camera. Discover is no longer hidden behind an upward drag.

### 2. Map — major
Map controls become a dark contextual decision dock with Search and Layers modes. Active narrowing is visible. Map-state colours remain semantically untouched. The map-to-detail handoff retains existing backend/audience rules.

### 3. Discover — major
Discover becomes Explore: a strong intent/orientation surface, then search and reason-backed recommendations. Real entity routes for Events, Clubs and Link-ups are visible as ways to choose the kind of commitment; no new product capability is invented.

### 4. Feed — major
Feed is reframed as reflection: what the Explorer’s circle discovered and retained. Capture and people discovery remain real routes, but the page stops presenting itself as the conceptual home screen.

### 5. Messages — major
Messages becomes Inbox/continuity. Existing All / Friends / Managers / Message Boards semantics remain exact, while visual grouping makes person/listing conversations distinct from boards without creating a second Manager identity.

### 6. Profile — major
Profile becomes a local passport: identity/reputation first, then the scrapbook and Manager capability already present. Existing tabs and data stay available but sit inside a stronger identity hierarchy.

### 7. Link-ups / Live — major
Live intent and commitment facts come first: when, where, who, capacity, audience/status. Creating and browsing remain existing capabilities.

### 8. Activity Clubs — major
Clubs communicate recurring commitment rather than generic listing cards: location, recurrence/membership/reputation are treated as decision evidence.

### 9. Events — major
Events are dated commitments: time and place receive hierarchy before descriptive copy.

### 10. Manager — major
Manager becomes an operational command surface: decisions first, capability/listing work second, public-profile/QR actions contextualised. No account-type split is introduced.

### 11. Admin — major
Admin becomes a high-density operational console: attention counts and tools are visually separate from consumer discovery while all existing gate/security behaviour remains unchanged.

## Non-negotiable Product Truth

- All 76 real routes remain represented and reachable.
- Explorer remains the universal identity; Manager is capability.
- RLS/database logic remains the security boundary.
- Audience order and profile ceiling remain intact.
- Camera remains first-stage Moment/Memory creation.
- Map never decides audience.
- One Messages hub remains one hub.
- Claim is not Verified.
- Club/Event/Link-up/Check-in/Moment/Memory/Review distinctions remain intact.
- The Alex branch must not inherit Katie source or design.

## Pre-APK test

If frozen Xplorer and this candidate are shown side-by-side with branding removed, a normal user must immediately see two different product-design systems. If the answer is “same app, cleaner,” this challenger fails before Android compilation.
