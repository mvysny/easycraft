# Architecture

How the pieces compose — what no single symbol can say and what would be expensive to overturn:
wiring and dependency direction, the lifecycle / threading / data-flow story, the flows a newcomer
needs, where to start reading. **Normative: the code conforms.** Change this file first, then the
code. Not here: why (`decisions.md` — cite the `D_`), what upstream does (`research.md` — cite the
`R_`), one symbol's behaviour (its doc comment), the module map (`AGENTS.md`). Only the sections
with content; the worked example in each is the ruler. Cap 12 KB — over it, research or
doc-comment content has crept in.

---

## Wiring

- One shared world — `blocks`, the chunk meshes, sea, clouds, sun — and one three.js `scene`; players never own world state, they change it through `changeBlock`.
- A `Player` is the component for one person at the screen: it owns its camera, its `Hud` (DOM over its part of the screen), its block outline and its body, and is handed one input source.
- An input source (`KeyboardInput`, `PadInput`) turns raw devices into the same per-frame shape — movement, look deltas, held buttons, one-shot actions — so `Player` never knows which device it has. The DOM handlers feed the single `keyboard`; `Pads` polls the Gamepad API.
- Three.js layers keep per-player objects in the right views: layer 0 is seen by every camera, a player's outline only by their own, their body by everyone else's. The layer numbers are `HIGHLIGHT_LAYER` and `AVATAR_LAYER`.
- `players` is sorted by slot (0–3, which fixes colour and save spot); `addPlayer` / `removePlayer` are the only way in or out, and both re-run `relayout` and `renderMenu`.

## Flows

**A frame** (`frame`, every animation frame):

1. `Pads.poll()` snapshots every controller, so "pressed" means "went down this frame".
2. `handlePadsForMenu` handles join (A), leave (B), play and pause (Start), before any player reads its pad.
3. While playing, each `Player.update` reads its input and moves, breaks and places; changed chunks are queued.
4. Up to four queued chunks are re-meshed.
5. `renderViews` draws the scene once per player into its own viewport and scissor rectangle, setting fog and sun for that player's camera first.

**Joining with a controller:** the menu is open → A on an unclaimed pad → `addPlayer(new PadInput(i))` takes the lowest free slot, restores that slot's saved position or spawns next to home → `relayout` re-splits the screen.

## Where to start reading

`index.html`, from the `Player` class down to the end — the classes, the split-screen layout, the menu and the main loop. Above it are the world, the textures and the mesher, which don't know players exist.
