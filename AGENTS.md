# EasyCraft

## What this is

EasyCraft is a block-building game for young kids that runs in a web browser: walk around a
small island, take blocks away and build with twenty kinds of block, and find flowers, shells,
apples and thirteen minerals, in caves, a desert and sunken ruins, to keep in your bag. There
are no monsters, no damage and nothing to install — double-click `index.html` and play.

## Promises

- **Gentle for young kids.** Nothing scares or punishes: no monsters, damage, hunger or night, and no way to get stuck or lost.
- **Double-click to play.** Opens from `file://` with no install, server, build step or network.
- **Original, not a clone.** Its own name and its own procedurally painted art; nothing copied from an existing game.

## Design docs

| File | Owns | Loaded |
|---|---|---|
| `README.md` | the pitch, how to play, how to copy it | — |
| `AGENTS.md` (this) | promises, invariants, the module map, conventions, commands | every turn |
| `design/architecture.md` | how the pieces compose — shared world, players, input sources, the frame; normative | lazy |
| `design/decisions.md` | why this and not that — `D_` entries, FAQ-shaped | lazy |
| `design/research.md` | what the browser and three.js actually do — `R_` entries, each claim with provenance | lazy |
| doc comments | what one symbol does and why it is shaped so | at the symbol |

Every fact lives in exactly one of these; the others link to it.

## Invariants

- **No ES modules, no `import`.** Chrome won't run them from `file://`, and the browser checks can't catch it. See `D_double_click`.
- **Block ids are append-only.** Saved worlds store them; reordering or removing a `defBlock` line scrambles every saved world.
- **A per-player scene object goes on that player's layer.** On layer 0 it shows in every split view; the layering is in architecture.md.
- **Players read devices only through their input source.** A `Player` touching `keyboard` or `Pads` directly breaks the other device kind.

## Module map

- `index.html` — the whole game: page, styles, textures, world, mesher, player, bag, saving.
- `vendor/three/` — three.js 0.160.1 `three.min.js`, the classic global-`THREE` build, and its MIT licence.
- `design/` — the lazy design docs and the doc-layer tripwire.

## Conventions

- **Plain browser JavaScript, no build step.** One classic `'use strict'` `<script>` in `index.html`, over the global `THREE`.
- **Third-party code is vendored and pinned** under `vendor/<name>/` with its licence, never loaded from a CDN; the Google Fonts stylesheet is the one fetch, optional (falls back to `system-ui`).
- **Art is procedural.** Textures are painted into the atlas by code; a new block adds a painter, not an image file.
- **Verify in a real browser.** Playwright MCP over a local HTTP server; `window.easycraft` exposes hooks for scripted checks, and controllers are faked by replacing `navigator.getGamepads`.

## Commands

- Play: open `index.html` in a browser.
- `python3 -m http.server 8765 --bind 127.0.0.1` — serve the game for Playwright, which refuses `file://` URLs.
- `design/verify_design_tripwires.sh` — checks the doc layer; no CI yet.

## Maintenance of this file

Loaded every turn; cap 34 KB, a module's own `AGENTS.md` 10 KB. Over it, in this order:
delete what has no home — status, history, class lists, what the code already says; trim
each line to its fact plus one clause and send the explanation home — why →
`design/decisions.md`, how across symbols → `design/architecture.md`, how in one symbol →
its doc comment, what upstream does → `design/research.md`; only then a module's own
`AGENTS.md`, peripheral modules first, never the core. Never paraphrase a lazy entry into a
line here. `design/verify_design_tripwires.sh` checks the caps and the cites.
