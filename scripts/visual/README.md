# Rendering the app and looking at it

`docs/instrument-kit.md`, rule 10: **nothing is done until it has been rendered
and looked at.** This is the machinery for the second half of that.

```
npx expo export --platform web --clear
npx serve dist -l 8081 --single
npm run verify:rendered                      # every route in routes.txt
npm run verify:rendered -- /discover /camera # or just these
```

## Why a green test suite is not evidence

A unit test asserting that a control renders passes happily while that control
is ten times its intended height, sits underneath the tab bar, or is painted in
the palette of the app this one replaced. Every one of those has happened in
this repo, and none of them was caught by a test:

- A row of filter pills **402px tall**, because a horizontal `ScrollView` in a
  flex column claims all the leftover vertical space and stretches its children.
- Every pin on the map wearing a **white ring**, because `borderColor:INK.ink`
  was written when `INK.ink` was near-black and the palette moved underneath it.
- The Create action sitting **on top of Send** in every message thread.
- The zoom dial's stops swallowed by an **8px overlap** with the controls row.
- `ScreenTitle`'s lead sentence shipping **truncated with an ellipsis** on seven
  screens.

So this drives the real exported app in a real browser at a real device
viewport (412×915 at 2×), screenshots every route, and then asks the DOM
questions a person cannot answer by staring at a picture.

## What it checks

| Check | What it catches |
|---|---|
| `stretch` | A flex **row** child far taller than its siblings' median — the 402px pill |
| `overlap` | A control with something else on top of it at its own centre point |
| `chrome` | Content under the tab bar **after scrolling to the end**, where the page can no longer move it |
| `offscreen` | A control outside the viewport that no scroller can bring in |
| `contrast` | Every visible run of text, its **real** composited background, and the WCAG ratio |
| `palette` | The screenshot's actual pixels, bucketed against this design **and the one it replaced** |

The palette check decodes the PNG and counts. It is the only check that can
prove the winning design is what rendered rather than what somebody believed
they had built — and it will report a single pixel of the old riso palette.

## Things it does on purpose

- **Stubs the backend.** This app talks to Supabase; with no network every
  data-driven screen sits on a spinner for ever, and photographing that proves
  the loading state is styled and nothing else. Reads return a small fixture,
  anything unrecognised returns `[]` — which is a *designed* state here, since
  every list has an `Empty` with a real instruction.
- **Seeds a session.** supabase-js reads the session from local storage before
  it talks to the server, so a signed-out browser sends every guarded screen to
  `/auth/login`. This harness once reported six different routes as clean when
  all six had rendered the same login form; every result now carries the route
  it actually landed on.
- **Waits out the splash structurally.** `StartupSplash` covers the app for a
  hard 5s. The first version of this waited for the splash's tagline to
  disappear — a rebuild removed the tagline, the wait stopped matching, and four
  routes were silently photographed through it. It now asks whether the tab bar
  is the topmost thing at its own centre, which no copy change can break.

## Things it deliberately does not fail on

- **A floating action passing over scrolling content.** The Create action is
  fixed to a corner of every screen, so on a long page it will sit over
  something at some scroll offset. That is what a floating action is. What
  matters is content the page cannot move out from under it, which the
  scrolled-to-the-end pass checks.
- **A small marker on a large map.** Eight times the area is the line: a chip
  over a chip is a bug, a 26px pin on a 300px map is the widget working.
- **The viewfinder's palette.** `/camera` and `/scan` are mostly live camera
  feed, so an on-system percentage there says nothing. The chrome drawn over it
  is what matters, and the geometry checks cover that.

Each of those exceptions exists because the check fired on something real and
correct. A verification tool that cries wolf gets ignored, which makes it worse
than not having one.
