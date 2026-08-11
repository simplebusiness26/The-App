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
- **Check-in** — a public, opt-in presence at a park.
- **Moment** — a photo pinned to where it was taken. **Memory** — the same
  post once it's past. One table, one component, wording changes with age.
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