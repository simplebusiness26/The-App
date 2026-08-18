# The instrument's three faces

`docs/design-system.md` names three typefaces and gives each one a job:

- **Inter Tight** — display. Screen titles, place names, stat numerals.
- **Inter** — body. Everything a person wrote.
- **JetBrains Mono** — data. Everything the app measured.

Until these were bundled, `utils/tokens.js` named them in a CSS font stack and
every platform quietly fell back: system-ui on web, Menlo or the Android
monospace default for the data face. The mono/sans split is the single strongest
signal that this app is an instrument rather than a page, so shipping it as
"whatever the device has" was shipping the design at a discount.

Both families are SIL Open Font Licence 1.1, which permits bundling in an
application. Files are the Latin subsets served by the Google Fonts CSS API.

Weights are deliberately few — three for Inter, two for Inter Tight, two for
JetBrains Mono. Every extra weight is a megabyte of APK for a distinction
nothing in the design actually draws.

Loaded once in `app/_layout.js`.
