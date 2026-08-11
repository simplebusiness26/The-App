# Running this without getting cut off

Two different things break long builds, and they need different fixes.

## The one you asked about: usage limits

Claude Code meters against a rolling five-hour session window, plus weekly caps — Pro has one weekly cap across all models, Max plans have two. Weekly limits aren't rolling: they reset at a fixed day and time assigned to your account. Usage across claude.ai, Claude Code and Claude Desktop draws from the same pool, so a heavy agent afternoon also empties your chat allowance. On 6 May 2026 Anthropic doubled Claude Code's five-hour limits for Pro, Max, Team and seat-based Enterprise plans, and removed the peak-hours reduction, so if your sense of the ceiling formed earlier it's stale in your favour.

The weekly cap is the one that ends your day; the five-hour wall is merely annoying. Check `/usage` before starting anything large, and watch the weekly bar specifically.

### What actually burns usage

In rough order:

1. **Wandering file reads.** An agent that greps the repo looking for
   where something might be costs more than the edit itself. This is why
   the resume prompt names the files up front and stops for approval.
2. **Re-reading three overlapping instruction files every turn.**
   `AGENTS.md` (248 lines) + `CLAUDE.md` + `RULES.md` load on every
   single message. Collapsing `AGENTS.md` to a pointer is a real saving,
   not housekeeping.
3. **Opus on mechanical work.** Use Opus for planning a packet and for
   Packet 0 and 9a. Use Sonnet for everything mechanical — taxonomy
   backfill, component extraction, marker mapping. Your own agent files
   already do this correctly: `navigator` is Opus, `designer` and
   `scope-warden` are Sonnet. Follow the same logic at session level.
4. **Long tool output pasted back.** Full test-suite output on every run
   fills context fast. Have it report counts and failures only.
5. **Retry loops.** `RULES.md` already says: if a change didn't work, say
   so and stop, don't try four more approaches silently. Enforce that.

### Pacing

- One packet per five-hour window. The packets are sized for this.
- If you have Max, the weekly cap is the constraint, not the session
  one — spread packets across days rather than doing three in a night.
- `/usage` shows session and weekly progress; the status line shows context fill, which is a different number and not your plan percentage. Don't confuse them.
- When you hit the limit, Claude Code stops responding until the window rolls. Support cannot reset or extend a quota, so there's no rescue — only planning.
- Non-interactive use (headless `claude -p`, GitHub Actions, Agent SDK)
  draws from a separate monthly credit rather than your session pool. Worth checking against your plan if you want CI-driven work that doesn't eat interactive capacity.

---

## The one that actually ruins builds: context resets

Hitting a usage limit is a pause. Losing context mid-packet is damage —
that's when you get half-wired features, duplicate components and
confident reports about work that never landed.

The fixes are all in the file structure, not in the prompt:

- **`docs/REDESIGN-STATE.md` is written at the end of every session,
  pass or fail.** Not at the end of the project. If the terminal closes
  and the ledger says `in progress` with an exact next step, you lose
  minutes. If it says nothing, you lose the packet.
- **Every packet ends in a commit.** A packet that can't be committed
  wasn't a packet — split it.
- **`/compact` at packet boundaries, never mid-packet.** Compacting
  halfway through leaves the agent with a summary of its own reasoning
  and no memory of which acceptance criteria it already ran.
- **Never let a session start a second packet.** The temptation is
  strongest when the first one went fast. That's exactly when the
  ledger entry gets skipped.

---

## What to actually type

**Session start:** the resume prompt from `REDESIGN-STATE.md`. Verbatim,
every time, including the first.

**After it reports the plan:**

```
Approved. Work Packet N only. Stop and report when every acceptance
criterion has been run — paste the command and its output for each.
Do not start Packet N+1.
```

**Session end, always:**

```
Write the session entry to docs/REDESIGN-STATE.md now. Include the
exact next step. Then commit.
```

**When something fails:**

```
Stop. Don't try another approach. Tell me what failed, the exact error,
and what you think it means. Then write the ledger entry with status
blocked.
```

---

## One honest warning

Your `PROJECT-LOG.md` says nobody has installed the APK and used a
screen, there is no test suite, RLS has never been audited, and the app
ships live location features on a public repo.

A navigation redesign on that foundation is polish before the core is
known good — which is the exact thing `navigator.md` is written to push
back on. It will happily generate twelve beautiful screens over an app
nobody has confirmed runs.

Packet 0 exists for this reason. Don't skip it because it's the boring
one.
