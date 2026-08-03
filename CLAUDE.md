# Xplorer

## What this app is

A live, interactive map of local life. Not a static map of where places
are — a map of what is *happening* right now and what a person could
actually go and do.

**Mission:** make local life visible, connected and accessible.

**Core promise:** open the map and see your local world come alive.

The app should answer, in order:
1. What is around me?
2. What is happening now?
3. Who else is going?
4. How do I join?
5. How do I get there?

## What it is not

Not a review app, business directory, event listings site, social feed,
taxi app or delivery app. Those are layers inside the product. The
product is the living local map.

If a feature makes sense as a standalone listing page but adds nothing
to the map, it's probably drifting off-concept. Say so.

## Core loop

See → Decide → Join → Get There → Experience → Share

Every completed experience should feed information back into the map.
When reviewing or building a feature, ask which step of this loop it
serves. If it serves none, flag it.

## Current stage: Stage One — build the local world

In scope right now:

- Explorer profiles
- Businesses and properties
- Reviews and photos
- Claims, ownership and QR-code verification
- Manager tools
- Parks and locations
- Activity club pages
- Event pages
- Map discovery

Question this stage answers: **what exists around me?**

## Later stages (do not build yet)

- **Two:** opt-in check-ins, "happening now" states, public link-ups,
  attendance counts, Now/Tonight/Weekend filters
- **Three:** event registration, club membership, link-up chats,
  bookings, reminders
- **Four:** directions, public transport, taxi partner links
- **Five:** ordering, ticketing, payments
- **Six:** the full local operating system

If asked to build something from Stage Two or later, say it's out of
scope for now and explain what Stage One groundwork it needs first.

## Account model

Everyone is an Explorer. There is no separate business account.

Managers of businesses, properties, clubs or events unlock extra tools
on top of their normal Explorer profile, keeping their social identity
and reviews. Their profile can optionally surface what they manage.

Do not build parallel user types. One identity, unlocked capabilities.

## Privacy principle

The map must be alive without being invasive.

Users always control whether location is shared, who sees it, how
precise it is, how long a check-in lasts, and whether they appear on
the public map at all. Location sharing is opt-in, temporary and
plainly explained.

Visibility states: at this venue / in this general area / attending
this event / available for a link-up / hidden.

Default to hidden. Never make a person a permanent trackable marker.
Treat anything touching live location as a safety-critical surface and
raise concerns rather than quietly implementing.

## Map feel

Places and pins should carry state, not just position — open, busy,
hosting something, promoting an offer, taking bookings. Clubs signal an
approaching session. Events move through upcoming, starting soon, live,
busy, finished.

Playful and readable. Not childish, not cluttered.

## Success metric

Completed local experiences, not downloads or map views. A visit, a
club session joined, an event attended, a booking finished, a verified
review left afterwards.

Prefer changes that increase completed experiences over changes that
increase browsing.

## Working with me

- Read the codebase before proposing changes
- Be blunt; I want real criticism, not encouragement
- Point to specific files and lines
- Ask before adding a new dependency
- One feature at a time — no broad half-built sweeps

## Project specifics

<!-- Fill these in — Claude Code will use them every session -->

- **Stack:**
- **Run locally:**
- **Run tests:**
- **Key directories:**
- **Data sources for places/events:**
- **Known constraints or gotchas:**

@RULES.md