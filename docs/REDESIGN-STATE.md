# Redesign state

Save to `docs/REDESIGN-STATE.md`.

**This file is the only thing that survives a context reset, a usage
lockout, or a closed terminal.** Claude Code loses everything else. If
this file is stale, a resumed session will re-do finished work or build
on something that never landed.

Read it first, write it last, every session.

---

## Resume prompt

Paste this verbatim at the start of any session, including the first:

```
Read docs/REDESIGN-STATE.md, then docs/REDESIGN-BRIEF.md, then CLAUDE.md
and RULES.md. Do not read anything else yet.

Run: git status && git log --oneline -5 && git branch --show-current

Then tell me:
1. Which packet is next according to the ledger
2. Whether the repo agrees with what the ledger claims — if it doesn't,
   the repo wins and that disagreement is your first report
3. The files you intend to read, and the files you intend to change

Then stop. Wait for my approval before editing anything.
```

The "stop and wait" is not politeness. Unapproved wandering file reads
are the single largest source of wasted usage.

---

## Current position

**Packet in progress:** none
**Last completed packet:** none
**Branch:** _fill in_
**Blocked on:** the two decisions in DOC-AMENDMENTS.md — stage model and
palette. Neither is a coding task. Both are yours.

## Packet status

| # | Packet | Status | Commit | Verified how |
|---|---|---|---|---|
| 0 | Verification harness | not started | | |
| 1 | Business taxonomy | not started | | |
| 2 | Marker assignment | not started | | |
| 3 | Navigation shell | not started | | |
| 4 | Quick Access drawer | not started | | |
| 5 | Place page layout | not started | | |
| 6 | Map bottom cards | not started | | |
| 7 | Discover screen | not started | | |
| 8 | Profile and reputation | not started | | |
| 9a | Scoring engine | not started | | |
| 9b | Leaderboard UI | not started | | |
| 10 | Manager Hub | not started | | |
| 11 | Design system pass | not started | | |

Status values: `not started` / `in progress` / `blocked` / `done`.
There is no `mostly done`. A packet with a failing acceptance criterion
is `in progress`, however close it looks.

---

## Session log

Newest first. One entry per session, written even if the session
achieved nothing. Especially then.

Template:

```markdown
### YYYY-MM-DD — Packet N — outcome

**Did:** what actually happened, not what was planned
**Files changed:** paths, with line ranges for anything non-obvious
**Acceptance criteria:** each one, passed or failed, with the command
  that was run and its output
**Stopped because:** finished / usage limit / blocked / broke something
**Exact next step:** the first thing the next session should do
**Unverified:** what is being assumed
```

The **Exact next step** line is the one that matters. Write it as if
the person reading it has no memory of this session, because they don't.

---

## Verification vocabulary

Borrowed from `navigator.md` because the distinction is what stops the
crashing-map-behind-a-green-build failure repeating:

- Owner opened the screen and used it → `Verified: used`
- A mount test passed → `Verified: renders. Unverified: behaves`
- CI went green → `Verified: builds. Unverified: anything else`
- A `verify:*` script passed → `Unverified: greps source, proves nothing`
- Agent read the code and believes it works → `Unverified`

**Never write "working" without naming who checked and how.**
