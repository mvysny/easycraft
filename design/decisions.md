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
script from there (`R_file_url_scripts`). So the game is classic `<script src>` files under `js/`, on top of
`vendor/three/three.min.js`, which defines a global `THREE`. That build exists only up to
three.js 0.160.1 (`R_three_classic_build`), so 0.160.1 is pinned. Why not three.js from a CDN:
the game would need the network at every start, and a dead link is a blank page. Why not a
current three.js behind a bundler or a local server: either is a build or an install step that
nobody copying the folder to a child's laptop will do. The cost we carry: three.js is frozen at
r160 and logs a deprecation warning on load; moving past it means bundling `three.module.js`
into a classic script ourselves.

## D_endless_blocks — Why are the building blocks endless when the finds are counted?

**Gentle for young kids**: running out of grass halfway through a house is a punishment, and
fetching more is a chore before the fun. So the twenty building blocks stay a free palette, and
only the finds — flowers, shells, apples, minerals — are counted in a player's bag: they are the
treasure hunt, and a gem means something because it ran out. Why not count everything, like a
survival game: gold, glass and the colours would need a way to be made, which is crafting, a
menu-heavy game of its own. Why not a sticker collection you cannot place: building with what you
found is the reward. Reversing this means a starter kit, crafting and a much fuller bag screen.

## D_sea_fills — Why does the sea fill whatever is dug beside it, when placed water runs only five blocks?

A tunnel dug from the sea should fill up, as at a real seaside. But water a child puts on a hill
must not drown the island, so a placed block is a plain source: it runs a few blocks, stops, and
dries up when taken. The sea is a source that knows its height (`fluid` = `HEAD + h`): it fills
everything open beside and below it up to h, and what it fills is sea too — a cave below sea level
floods, a shaft fills to sea level. Lava pools are plain: they lie on hall floors with open floor
beside them, and a pool that knew its height would flood the hall. Why not water that keeps its
volume: the sea would drain into every hole and shuffle forever. The cost: water let into a closed
space can't be taken out block by block, each gap refills; you fill it with blocks instead.
