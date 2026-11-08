// Water and lava that flow. A placed block of water moves as one block, falling and rolling
// downhill until it rests; lava runs a few blocks from its pool; the sea fills what is dug beside
// it. Each liquid takes a step every so often; a step looks only at the cells that changed, or sit
// next to a change, since the last one.
'use strict';

/**
 * The flowing liquids. `reach`: how far it runs from a source over flat ground, or for a liquid
 * that `moves`, how far a source block looks for a drop to roll to; `every`: seconds between steps.
 */
const LIQUIDS = [
  { id: B.water, reach: 5, every: 0.15, moves: true },
  { id: B.lava, reach: 2, every: 1.2, moves: false },
].map(l => ({ ...l, pending: new Set(), wait: 0 }));
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
const cellOf = i => [i % SX, Math.floor(i / (SX * SZ)), Math.floor(i / SX) % SZ];
const isAir = (x, y, z) => inBounds(x, y, z) && blocks[index(x, y, z)] === 0;

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

/**
 * One step of liquid `l`: each pending source block of a liquid that `moves` moves one cell, one
 * block after another; then every other pending cell becomes what its neighbours make it, all at once.
 */
function stepLiquid(l) {
  const cells = [...l.pending], changes = [];
  l.pending.clear();
  if (l.moves) {
    const arrived = new Set();   // so a block moves at most one cell a step
    for (const i of cells) {
      if (blocks[i] !== l.id || fluid[i] !== 0 || arrived.has(i)) continue;
      const to = moveBlock(l, i);
      if (to >= 0) arrived.add(to);
    }
  }
  for (const i of cells) {
    const id = blocks[i], f = fluid[i];
    if (id !== 0 && !(id === l.id && f > 0 && f < HEAD)) continue;   // only air and running liquid change
    const [x, y, z] = cellOf(i);
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

/**
 * Moves the source block of liquid `l` in cell `i` one cell downhill: down when it can fall,
 * otherwise toward the nearest drop within `reach` over flat ground. Touching the sea, it becomes
 * sea, or sinks into it from above.
 * @returns {number} the cell it moved to, or -1 when it stayed.
 */
function moveBlock(l, i) {
  const [x, y, z] = cellOf(i);
  const changed = (a, b, c) => { markDirtyAround(a, c); wakeLiquids(a, b, c); worldDirty = true; };
  let head = -1, onSea = false;
  for (const [a, b, c] of NEIGHBORS) {
    if (!inBounds(x + a, y + b, z + c)) continue;
    const j = index(x + a, y + b, z + c);
    if (blocks[j] === l.id && fluid[j] >= HEAD) { head = Math.max(head, fluid[j] - HEAD); onSea = true; }
  }
  if (head >= y) { fluid[i] = HEAD + head; changed(x, y, z); return -1; }
  if (onSea) { setBlockRaw(x, y, z, 0); changed(x, y, z); return -1; }

  const to = isAir(x, y - 1, z) ? [x, y - 1, z] : towardDrop(l, x, y, z);
  if (!to) return -1;
  setBlockRaw(x, y, z, 0);
  setBlockRaw(...to, l.id);
  changed(x, y, z);
  changed(...to);
  return index(...to);
}

/**
 * The cell beside (x, y, z) on the way to the nearest air with air under it, within `l.reach`
 * steps through air at height y; ties go to a random side, so water doesn't always roll one way.
 * @returns {?number[]} the cell as [x, y, z], or null when there is no drop in reach.
 */
function towardDrop(l, x, y, z) {
  const seen = new Set([index(x, y, z)]);
  let front = [];   // [x, z, the first step toward it]
  const turn = Math.floor(Math.random() * SIDES.length);
  for (let k = 0; k < SIDES.length; k++) {
    const [a, , c] = SIDES[(turn + k) % SIDES.length];
    if (!isAir(x + a, y, z + c)) continue;
    seen.add(index(x + a, y, z + c));
    front.push([x + a, z + c, [x + a, y, z + c]]);
  }
  for (let d = 1; d <= l.reach && front.length; d++) {
    const drop = front.find(([px, pz]) => isAir(px, y - 1, pz));
    if (drop) return drop[2];
    const next = [];
    for (const [px, pz, first] of front) for (const [a, , c] of SIDES) {
      if (!isAir(px + a, y, pz + c) || seen.has(index(px + a, y, pz + c))) continue;
      seen.add(index(px + a, y, pz + c));
      next.push([px + a, pz + c, first]);
    }
    front = next;
  }
  return null;
}

/** What the air or running liquid `l` at (x, y, z) should be: its `fluid` value, or -1 for air. */
function wantedFluid(l, x, y, z) {
  // `l`'s fluid value in a cell, or -1 when the cell holds something else; a source block that
  // moves runs nowhere, else a block placed on a hill would wash down every terrace to the sea
  const at = (a, b, c) => {
    if (!inBounds(a, b, c)) return -1;
    const j = index(a, b, c);
    return blocks[j] === l.id && !(l.moves && fluid[j] === 0) ? fluid[j] : -1;
  };
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

  let best = Infinity;
  for (const [a, , c] of SIDES) {
    const n = at(x + a, y, z + c);
    if (n >= 0 && resting(x + a, y, z + c)) best = Math.min(best, n + 1);
  }
  return best <= l.reach ? best : -1;
}
