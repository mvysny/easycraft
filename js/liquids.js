// Water and lava that flow: they pour down, run a few blocks over flat ground, and the sea fills
// what is dug beside it. Each liquid takes a step every so often; a step looks only at the cells
// that changed, or sit next to a change, since the last one.
'use strict';

/**
 * The flowing liquids. `reach`: how many blocks it runs from a source over flat ground; `every`:
 * seconds between steps; `renew`: a gap between two sources becomes a source too, so a few placed
 * blocks make a pool.
 */
const LIQUIDS = [
  { id: B.water, reach: 5, every: 0.3, renew: true },
  { id: B.lava, reach: 2, every: 1.2, renew: false },
].map(l => ({ ...l, pending: new Set(), wait: 0 }));
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

/** How high the liquid in cell (x, y, z) stands, 0..1: full under more of itself, lower the farther it has run. */
function liquidHeight(x, y, z) {
  if (!inBounds(x, y, z)) return 1;
  const i = index(x, y, z), id = blocks[i];
  if (getBlock(x, y + 1, z) === id) return 1;
  const f = fluid[i], l = LIQUIDS.find(l => l.id === id);
  if (!l || f === 0 || f >= HEAD) return 0.9;
  return 0.9 * (l.reach + 1 - f) / (l.reach + 1);
}

/** Has the liquids look again at cell (x, y, z) and its neighbours on their next step. */
function wakeLiquids(x, y, z) {
  for (const [a, b, c] of [[0, 0, 0], ...NEIGHBORS]) {
    if (!inBounds(x + a, y + b, z + c)) continue;
    const i = index(x + a, y + b, z + c);
    for (const l of LIQUIDS) l.pending.add(i);
  }
}
/** Wakes every liquid that could move, for a world just made or loaded. */
function wakeAllLiquids() {
  for (const l of LIQUIDS) { l.pending.clear(); l.wait = 0; }
  for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const i = index(x, y, z);
    if (BLOCKS[blocks[i]]?.liquid && ((fluid[i] > 0 && fluid[i] < HEAD) || touches(x, y, z, 0))) wakeLiquids(x, y, z);
  }
}

/** Runs the liquids on for `dt` seconds. */
function flowLiquids(dt) {
  for (const l of LIQUIDS) {
    if ((l.wait -= dt) > 0) continue;
    l.wait = l.every;
    if (l.pending.size) stepLiquid(l);
  }
}

/** One step of liquid `l`: every pending cell becomes what its neighbours make it, all at once. */
function stepLiquid(l) {
  const cells = [...l.pending], changes = [];
  l.pending.clear();
  for (const i of cells) {
    const id = blocks[i], f = fluid[i];
    if (id !== 0 && !(id === l.id && f > 0 && f < HEAD)) continue;   // only air and running liquid change
    const x = i % SX, z = Math.floor(i / SX) % SZ, y = Math.floor(i / (SX * SZ));
    const want = wantedFluid(l, x, y, z);
    if (id === 0 ? want >= 0 : want !== f) changes.push([x, y, z, want]);
  }
  for (const [x, y, z, want] of changes) {
    setBlockRaw(x, y, z, want < 0 ? 0 : l.id);
    if (want > 0) fluid[index(x, y, z)] = want;
    markDirtyAround(x, z);
    wakeLiquids(x, y, z);
  }
  if (changes.length) worldDirty = true;
}

/** What the air or running liquid `l` at (x, y, z) should be: its `fluid` value, or -1 for air. */
function wantedFluid(l, x, y, z) {
  // `l`'s fluid value in a cell, or -1 when the cell holds something else
  const at = (a, b, c) => inBounds(a, b, c) && blocks[index(a, b, c)] === l.id ? fluid[index(a, b, c)] : -1;
  // A liquid runs sideways only when it can't fall. Resting on more of itself it stays put, so a
  // waterfall into the sea doesn't spread a skin over it.
  const resting = (a, b, c) => b === 0 || (blocks[index(a, b - 1, c)] !== 0 && blocks[index(a, b - 1, c)] !== l.id);

  let head = -1;   // the sea fills beside and below itself, up to its height
  for (const [a, b, c] of NEIGHBORS) {
    const n = at(x + a, y + b, z + c);
    if (n >= HEAD && n - HEAD >= y) head = Math.max(head, n - HEAD);
  }
  if (head >= 0) return HEAD + head;
  if (at(x, y + 1, z) >= 0) return 1;   // pouring down

  let best = Infinity, sources = 0;
  for (const [a, , c] of SIDES) {
    const n = at(x + a, y, z + c);
    if (n < 0 || !resting(x + a, y, z + c)) continue;
    if (n === 0) sources++;
    best = Math.min(best, n + 1);
  }
  const below = at(x, y - 1, z);
  if (l.renew && sources >= 2 && (resting(x, y, z) || below === 0 || below >= HEAD)) return 0;
  return best <= l.reach ? best : -1;
}
