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
- An input source (`KeyboardInput`, `PadInput`) turns raw devices into the same per-frame shape — movement, look deltas, held buttons, a bag-cursor direction, one-shot actions — so `Player` never knows which device it has. The DOM handlers feed the single `keyboard`; `Pads` polls the Gamepad API. What an action means is the `Player`'s call: with its bag open, the same input steers the bag's cursor and the player stands still.
- A block says what taking it yields (`drop`) and what stays behind (`becomes`); a `Player` keeps its own bag (find → count) and hotbar, and both travel in its slot's save. Building blocks are never counted (`D_endless_blocks`).
- `generateWorld` shapes the island, then adds the desert, caves (with lava), sunken ruins (with chests) and trees; those come only with a new world. The finds come from `scatterFinds` and the minerals' ores from `scatterMinerals`, which work on any world: a save from before either existed (no `finds` / `minerals` flag) gets them on load.
- Three.js layers keep per-player objects in the right views: layer 0 is seen by every camera, a player's outline only by their own, their body by everyone else's. The layer numbers are `HIGHLIGHT_LAYER` and `AVATAR_LAYER`.
- `players` is sorted by slot (0–3, which fixes colour and save spot); `addPlayer` / `removePlayer` are the only way in or out, and both re-run `relayout` and `renderMenu`.

## Flows

**A frame** (`frame`, every animation frame):

1. `Pads.poll()` snapshots every controller, so "pressed" means "went down this frame".
2. `handlePadsForMenu` handles join (A), leave (B), play and pause (Start), before any player reads its pad.
3. While playing, each `Player.update` reads its input and moves, breaks and places; changed chunks are queued.
4. Up to four queued chunks are re-meshed.
5. `renderViews` draws the scene once per player into its own viewport and scissor rectangle, setting fog and sun for that player's camera first.

**Taking a block** (`Player.breakBlock`): the block turns into its `becomes` (or air) → its `drop` goes into the bag (`collect`: count, chime, toast, hotbar redraw) → a flower, shell or apple standing on a block that is now gone comes along into the bag too.

**Joining with a controller:** the menu is open → A on an unclaimed pad → `addPlayer(new PadInput(i))` takes the lowest free slot, restores that slot's saved position or spawns next to home → `relayout` re-splits the screen.

## Where to start reading

`js/main.js`, then `js/player.js` and the files after it — the split-screen layout, saving and the menu. The files before `js/player.js` — textures, blocks, world, rendering — don't know players exist.
