# Rules

CLAUDE.md says what Xplorer is. This says how to work on it.
When the two conflict, CLAUDE.md wins.

## Before writing any code

1. **Read the files you're about to change.** Quote the lines you're
   relying on. Don't infer a file's contents from its name.
2. **One thing at a time.** If the request contains two features, build
   the first and say what's left. Never leave a second one half-wired.

## Vocabulary — use these exact words in code, copy and commits

Inconsistent naming across files is the main way this codebase will rot.

- **Explorer** — every person. Never `user` in UI copy. `user` is fine as
  a database table name; it must not appear on screen.
- **Manager** — an Explorer with unlocked tools for a place, club or
  event. Never "owner", never "business account", never a separate role
  table that forks the identity.
- **Friend** — two Explorers who follow each other. There is no friend
  request. **Close friend** — a friend hand-picked onto a smaller list,
  one-way.
- **Place** — anything with a fixed position. Types: `business`,
  `property`, `park`. A park is a place, not its own concept.
- **Club** — a recurring thing. Has **sessions**. A session is not an event.
- **Event** — a dated thing with a start time. One-off or part of a series.
- **Claim** — the act of asserting you manage something.
  **Verified** — that claim confirmed by QR scan on site. Different words,
  different states, never used interchangeably.
- **Check-in** — an opt-in presence at a public place, seen by whoever your
  location setting allows and nobody else. Not public: that word was accurate
  until the location setting existed, and is not now. Only public places take
  check-ins — never a business, club or event.
- **Moment** — live content. What is happening NOW. It expires, appears in the
  feed and the map's heat layer, and is reached through the ring on an
  Explorer's profile picture. It has **no permanent gallery on a profile**.
- **Memory** — permanent scrapbook content. What happened HERE. It appears in
  the profile Memory gallery, on My Map, and in the feed, always according to
  the audience its owner chose.
- **Moment ≠ Memory.** Two tables, two content types, two lifecycles. A Moment
  with "Save to Memories" on *produces* a Memory; the Memory is its own record.
  An earlier version of this file said they were one table — that was wrong.
- **A Memory leaving the current map is not a Memory being deleted.** A Memory
  has two independent clocks: `visibility` decides who may see it, for as long
  as the owner leaves it alone; `map_until` decides how long it sits on today's
  map. When `map_until` passes, the pin goes and **nothing else changes** — it
  stays in the gallery, on My Map, and in the historical map. Never delete
  Memories because their map window ended.
- **Review** — an opinion about a place. A third content type. It appears in the
  feed and adds to map heat, and it stays on the profile permanently. It is
  never a Moment: no ring, no story viewer, no view tracking, no expiry.
- **Endorsement** — likes and comments on a review, counting towards the
  reviewer.
- **State** — what a pin currently is. Not `status`, not `mode`.

If you need a new noun, ask before inventing it.

## Privacy gates — stop and ask, don't implement

Any change that touches location, presence, visibility or another
Explorer's whereabouts is safety-critical. For these:

- Stop. Describe what you'd build and what it would expose. Wait.
- Default every visibility flag to off/hidden. Opt-in is never the
  fallback branch of an if-statement.
- Who can see anything an Explorer shares is one setting, `profiles.visibility`,
  answered by `guestbook_private.can_see_content(owner, viewer, audience)`.
  Nothing else may work it out. It is a ceiling: a per-post choice can narrow it
  and never widen it.
- One audience vocabulary, narrowest first: `nobody`, `selected`,
  `close_friends`, `friends`, `followers`, `everyone`. Never invent a synonym —
  not `public`, not `private`. Anything unrecognised must fail closed.
- `followers` is wider than `friends`, because following is one-way and needs no
  permission. It is a fine audience for something somebody chose to post. It is
  **not** an acceptable audience for presence — check-ins and Link-ups use
  friends.
- Anything that reveals position must have an expiry. No permanent
  location record without a stated retention period.
- Never add a field that would let one Explorer reconstruct another's
  movement history, even if the current screen doesn't display it.
- Precision is a setting, not a constant. Don't hardcode exact coordinates
  into anything shared.
- Location visibility is enforced on the server. Never rely on the app
  choosing not to draw a pin.

## Verification and honesty

- Don't say "done", "working" or "fixed" unless you ran it. If you
  couldn't run it, say exactly that.
- Report what you actually did, not what the plan said you'd do. If you
  skipped a step, lead with the skip.
- No invented file paths, function names or API responses. If you're not
  sure a thing exists, open it.
- If a change didn't work, say so plainly and stop. Don't try four more
  approaches silently.
- Push back when the request is wrong. Agreement isn't help.

## Scope discipline

- No placeholder UI for things not being built. No greyed-out buttons,
  no coming-soon states. If it isn't buildable now, the screen ends
  without it.
- No mock or seed data left in application code. Fixtures live in test
  files only.
- Ask before adding a dependency. Ask before adding a new top-level
  directory. Ask before changing the build setup.

## Data

- Schema changes get a migration, always. Never edit a migration that has
  already run.
- Every entity above needs one canonical table. If you find yourself
  writing a second table for the same noun, you've misread the model.
- Reviews attach to places, clubs and events — never to Explorers.
- Never delete an Explorer's content as a side effect of another change.

## Git

- Small commits, one concern each. Present tense: "Add QR claim flow".
- Never commit secrets, `.env`, or anything under `.claude/`.
- Don't rebase, force-push, amend published commits or discard uncommitted
  work without asking.
- Don't create branches, tags or PRs unless asked.

## Output

- No summary markdown files after a task. No `IMPLEMENTATION_NOTES.md`,
  no `SUMMARY.md`. Tell me in the chat.
- No new docs unless I ask for them.
- Point to specific files and lines when explaining a change.
- Blunt, short, no preamble. Skip the recap of what I just asked for.