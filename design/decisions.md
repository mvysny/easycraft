# Decisions

Why this project is the way it is and not otherwise — FAQ-shaped: each entry is a question and
its current answer. Rewrite the answer when it changes; delete the entry when nobody asks any
more. An entry is earned by what it would cost to reverse — half the code base — or by research
the next person would otherwise redo (cited as its `R_`). Not an entry: windows → panels
"because that's the trend", this red over that red, `get_foo` over `is_foo?`, the testing library,
the CI host, a version bump — a comment at the site of the choice, or nothing; nothing about
`design/` itself. Cite by slug, `D_<slug>`, never by position; `grep '^## D_' design/decisions.md`
is the index. The first entry is the ruler: every later one trims to its length — which is how
long this file gets, so keep it short. When you have written an entry, re-read it against the one
above, open the doc comments it touches and cut what they already say, then cut the fat.

---

## D_double_click — Why a classic-script page with vendored three.js r160 rather than ES modules?

**Double-click to play** means the page runs from `file://`, and Chrome will not load a module
script from there (`R_file_url_scripts`). So `index.html` is one classic `<script>` on top of
`vendor/three/three.min.js`, which defines a global `THREE`. That build exists only up to
three.js 0.160.1 (`R_three_classic_build`), so 0.160.1 is pinned. Why not three.js from a CDN:
the game would need the network at every start, and a dead link is a blank page. Why not a
current three.js behind a bundler or a local server: either is a build or an install step that
nobody copying the folder to a child's laptop will do. The cost we carry: three.js is frozen at
r160 and logs a deprecation warning on load; moving past it means bundling `three.module.js`
into a classic script ourselves.
