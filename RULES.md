# Rules

CLAUDE.md says what Xplorer is. This says how to work on it.
When the two conflict, CLAUDE.md wins.

## Before writing any code

1. **Name the stage.** Say out loud which stage the request belongs to.
   If it's Stage Two or later, stop and say so before writing anything.
2. **Name the loop step.** See / Decide / Join / Get There / Experience /
   Share. If a change serves none of them, say that instead of building it.
3. **Read the files you're about to change.** Quote the lines you're
   relying on. Don't infer a file's contents from its name.
4. **One feature at a time.** If the request contains two features, build
   the first and say what's left. Never leave a second one half-wired.

## Vocabulary — use these exact words in code, copy and commits

Inconsistent naming across files is the main way this codebase will rot.

- **Explorer** — every person. Never `user` in UI copy. `user` is fine as
  a database table name; it must not appear on screen.
- **Manager** — an Explorer with unlocked tools for a place, club or
  event. Never "owner", never "business account", never a separate role
  table that forks the identity.
- **Place** — anything with a fixed position. Types: `business`,
  `property`, `park`. A park is a place, not its own concept.
- **Club** — a recurring thing. Has **sessions**. A session is not an event.
- **Event** — a dated thing with a start time. One-off or part of a series.
- **Claim** — the act of asserting you manage something.
  **Verified** — that claim confirmed by QR scan on site. Different words,
  different states, never used interchangeably.
- **Visit** — a private, verified presence at a place (Stage One, via QR).
  **Check-in** — a public, opt-in, expiring presence (Stage Two).
  These are different features. Do not let visit code grow into check-in code.
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

- No placeholder UI for later stages. No greyed-out "Book" buttons, no
  disabled RSVP, no coming-soon states. If it isn't buildable now, the
  screen ends without it.
- No mock or seed data left in application code. Fixtures live in test
  files only.
- No speculative abstraction. Two similar things stay duplicated until
  there are three.
- Ask before adding a dependency. Ask before adding a new top-level
  directory. Ask before changing the build setup.

## Data

- Schema changes get a migration, always. Never edit a migration that has
  already run.
- Every entity above needs one canonical table. If you find yourself
  writing a second table for the same noun, you've misread the model.
- Reviews attach to places, clubs and events — not to Explorers.
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

  Exception: `docs/REDESIGN-STATE.md` is a required ledger for the
  redesign. Update it at the end of every packet. It is the only new
  doc permitted without asking.
- Point to specific files and lines when explaining a change.
- Blunt, short, no preamble. Skip the recap of what I just asked for.
