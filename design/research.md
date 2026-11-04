# Research — the browser platform and three.js

What the things we don't own actually do. About *them*, never us: a sentence starting "we chose"
is a `D_`. `## R_<slug> — <title>`, one claim per bullet, one provenance marker per claim —
**[docs]**, **[src]**, **[verified <date>, <version>]**, **[unverified]** (a hypothesis; a design
built on it says so). A claim is earned by its provenance, or by having cost real work to find
out. Checked against Chromium 156 and three.js 0.159–0.163 on npm; a version-sensitive claim
names the version it was seen on. Cite by slug, `R_<slug>`, never by position;
`grep '^## R_' design/research.md` is the index. The first entry is the ruler: every later one
trims to its length — which is how long this file gets, so keep it short.

---

## R_file_url_scripts — Chrome and scripts on `file://` pages

- A `<script type="module">` that imports a sibling `./m.js` does not run when the page is
  opened from `file://`. **[verified 2026-11-04, Chromium 156 snap, headless]**
- A classic `<script src="c.js">` beside the same page loads and runs. **[verified 2026-11-04,
  Chromium 156 snap, headless]**
- The Playwright MCP refuses to navigate to `file:` URLs at all, so browser checks of the game
  go through a local HTTP server, where modules would work — such a check cannot catch a
  regression to modules. **[verified 2026-11-04]**

## R_three_classic_build — three.js: the non-module `build/three.min.js`

- npm `three` ships `build/three.js` and `build/three.min.js` up to 0.160.1; 0.161.0 onwards
  ships only `three.module.js`, `three.module.min.js` and `three.cjs`. **[verified 2026-11-04,
  npm registry]**
- The classic build defines a global `THREE` and logs a `console.warn` on load saying it is
  deprecated since r150. **[verified 2026-11-04, three 0.160.1]**

## R_gamepad_api — the browser Gamepad API

- `navigator.getGamepads()` lists a controller only after a button on it has been pressed
  while the page is open; until then a plugged-in pad is invisible. **[docs]**
- The only events are `gamepadconnected` / `gamepaddisconnected`; button and stick state exists
  only as a snapshot from `getGamepads()`, so presses are found by polling. **[docs]**
- In the `standard` mapping, buttons 6 and 7 are the triggers with an analogue `value`, 8/9
  Back/Start, 12–15 the d-pad; axes 0/1 the left stick, 2/3 the right, +y pointing down. **[docs]**
- A controller button press does not count as the user gesture that `requestPointerLock()` and
  an `AudioContext` need, so a page started from a controller cannot grab the mouse.
  **[unverified]**
