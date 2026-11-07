// The shared world: its blocks, and the generator that shapes a new island.
'use strict';

// World size
const SX = 96, SZ = 96, SY = 32;   // world size in blocks
const CHUNK = 16;                   // chunk size (x/z) for meshing
const WATER = 8;                    // sea level

// ---------------------------------------------------------------------------
// World data + generation
// ---------------------------------------------------------------------------
let blocks = new Uint8Array(SX * SY * SZ);
/**
 * How the liquid in each cell flows, beside `blocks` (liquids.js runs it): 0 for a source — a
 * placed block, a lava pool — and for every cell that is not liquid; 1..15 for liquid running
 * that many blocks from its source; `HEAD + h` for the sea and what has filled from it, a source
 * that fills everything open beside and below it up to height h. Saved with the world.
 */
let fluid = new Uint8Array(SX * SY * SZ);
const HEAD = 32;
const index = (x, y, z) => x + SX * (z + SZ * y);
const inBounds = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;
const getBlock = (x, y, z) => inBounds(x, y, z) ? blocks[index(x, y, z)] : 0;
// Like getBlock, but for drawing: below the world counts as solid, and past the world's edge
// is sea, so neither the world's bottom nor the edge water's sides are drawn.
const getMesh = (x, y, z) => {
  if (y < 0) return B.bedrock;
  if (x < 0 || z < 0 || x >= SX || z >= SZ) return y <= WATER ? B.water : 0;
  return getBlock(x, y, z);
};
/** Sets a block without redrawing or saving; whatever it is, it starts as a source (`fluid` 0). */
function setBlockRaw(x, y, z, id) {
  if (!inBounds(x, y, z)) return;
  const i = index(x, y, z);
  blocks[i] = id; fluid[i] = 0;
}
/** Makes every water at or below sea level the sea, which fills what is dug beside it (an old save has no `fluid`). */
function markSea() {
  for (let y = 0; y <= WATER; y++) for (let i = y * SX * SZ; i < (y + 1) * SX * SZ; i++) {
    if (blocks[i] === B.water) fluid[i] = HEAD + WATER;
  }
}
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const touches = (x, y, z, id) => NEIGHBORS.some(([a, b, c]) => getBlock(x + a, y + b, z + c) === id);

function generateWorld(seed) {
  blocks = new Uint8Array(SX * SY * SZ);
  fluid = new Uint8Array(SX * SY * SZ);
  const rnd = mulberry32(seed);
  // value noise on a lattice
  const G = 64, grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const smooth = t => t * t * (3 - 2 * t);
  const lattice = (x, z) => grid[((x % G + G) % G) + G * ((z % G + G) % G)];
  const noise = (x, z) => {
    const x0 = Math.floor(x), z0 = Math.floor(z), fx = smooth(x - x0), fz = smooth(z - z0);
    const a = lattice(x0, z0), b = lattice(x0 + 1, z0), c = lattice(x0, z0 + 1), d = lattice(x0 + 1, z0 + 1);
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  };
  const fbm = (x, z) => (noise(x, z) * 0.6 + noise(x * 2.1 + 17, z * 2.1 + 5) * 0.28 + noise(x * 4.3 + 3, z * 4.3 + 41) * 0.12);
  const smoothstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  const heights = new Int32Array(SX * SZ);
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const dx = (x - SX / 2) / (SX / 2), dz = (z - SZ / 2) / (SZ / 2);
    const island = 1 - smoothstep(0.55, 0.97, Math.sqrt(dx * dx + dz * dz));
    const n = fbm(x / 22, z / 22);
    const hills = Math.pow(n, 1.6) * 20;
    const h = Math.max(1, Math.min(SY - 9, Math.floor(4 + island * (6 + hills))));
    heights[x + z * SX] = h;
    for (let y = 0; y <= h; y++) {
      let id;
      if (y === 0) id = B.bedrock;
      else if (y < h - 3) id = B.stone;
      else if (h <= WATER + 1) id = B.sand;           // beaches and sea floor
      else if (y < h) id = B.dirt;
      else id = h >= 21 ? B.snow : B.grass;
      setBlockRaw(x, y, z, id);
    }
    for (let y = h + 1; y <= WATER; y++) setBlockRaw(x, y, z, B.water);
  }
  makeDesert(rnd, heights);
  carveCaves(rnd, heights);
  sinkRuins(rnd, heights);

  // trees
  for (let z = 3; z < SZ - 3; z++) for (let x = 3; x < SX - 3; x++) {
    const h = heights[x + z * SX];
    if (getBlock(x, h, z) !== B.grass || rnd() > 0.018) continue;
    if (getBlock(x, h + 1, z) !== 0) continue;
    // keep trees a little apart
    let crowded = false;
    for (let dz = -2; dz <= 2 && !crowded; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (getBlock(x + dx, h + 1, z + dz) === B.log) { crowded = true; break; }
    }
    if (crowded) continue;
    const trunk = 4 + ((rnd() * 2) | 0);
    const top = h + trunk;
    for (let y = top - 2; y <= top + 1; y++) {
      const r = y >= top ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 ? y === top + 1 : rnd() < 0.5)) continue;
        if (getBlock(x + dx, y, z + dz) === 0) setBlockRaw(x + dx, y, z + dz, B.leaves);
      }
    }
    for (let y = h + 1; y <= top; y++) setBlockRaw(x, y, z, B.log);
    setBlockRaw(x, h, z, B.dirt);
  }
  scatterFinds(rnd);
  scatterMinerals(rnd);
  markSea();
}

/** Turns a patch of land away from the middle into desert: sand down to the stone. */
function makeDesert(rnd, heights) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rnd() * Math.PI * 2, d = SX * (0.22 + rnd() * 0.08);
    const cx = Math.round(SX / 2 + Math.cos(a) * d), cz = Math.round(SZ / 2 + Math.sin(a) * d);
    if (heights[cx + cz * SX] <= WATER + 2) continue;
    const r = 10 + rnd() * 4;
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const h = heights[x + z * SX];
      const ragged = Math.sin(x * 0.5) + Math.cos(z * 0.45);
      if (h <= WATER + 1 || Math.hypot(x - cx, z - cz) > r + ragged) continue;
      for (let y = Math.max(1, h - 3); y <= h; y++) setBlockRaw(x, y, z, B.sand);
    }
    return;
  }
}

/**
 * Digs caves. Each starts as a hole in a hillside away from home, winds down into the deep stone
 * and ends in a hall, the first one (and some others) with a pool of lava on its floor. They stay
 * under the land and never open into the sea.
 */
function carveCaves(rnd, heights) {
  const land = (x, z) => x >= 3 && z >= 3 && x < SX - 3 && z < SZ - 3 && heights[(x | 0) + (z | 0) * SX] > WATER + 2;
  const DIGGABLE = new Set([B.stone, B.dirt, B.grass, B.snow]);
  const dig = (cx, cy, cz, r) => {
    for (let y = Math.max(1, Math.floor(cy - r)); y <= cy + r; y++) {
      for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2 > r * r) continue;
        if (DIGGABLE.has(getBlock(x, y, z)) && !touches(x, y, z, B.water)) setBlockRaw(x, y, z, 0);
      }
    }
  };
  const count = 4 + ((rnd() * 2) | 0);
  for (let i = 0, tries = 0; i < count && tries < 500; tries++) {
    const x0 = 3 + rnd() * (SX - 6), z0 = 3 + rnd() * (SZ - 6);
    if (!land(x0, z0) || Math.hypot(x0 - SX / 2, z0 - SZ / 2) < 12) continue;
    i++;
    let x = x0, y = heights[(x0 | 0) + (z0 | 0) * SX] + 0.5, z = z0, yaw = rnd() * Math.PI * 2;
    const floor = 2.5 + rnd() * 2;
    for (let step = 0, len = 70 + rnd() * 40; step < len; step++) {
      dig(x, y, z, step < 4 ? 1.3 : 1.5 + rnd() * 0.6);
      yaw += (rnd() - 0.5) * 0.6;
      const pitch = y > floor + 1 ? -0.6 : (floor - y) * 0.3 + (rnd() - 0.5) * 0.3;   // down, then level
      const nx = x + Math.cos(yaw) * Math.cos(pitch), nz = z + Math.sin(yaw) * Math.cos(pitch);
      if (!land(nx, nz)) { yaw += Math.PI * (0.5 + rnd()); continue; }
      x = nx; z = nz; y = Math.max(1.5, y + Math.sin(pitch));
    }
    dig(x, y + 1, z, 2.8);   // the hall
    if (i > 1 && rnd() < 0.5) continue;
    // a pool of lava on the hall's lowest floor
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    let low = SY;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      for (let yy = Math.max(1, Y - 3); yy <= Y + 3; yy++) if (getBlock(X + dx, yy, Z + dz) === 0) low = Math.min(low, yy);
    }
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (getBlock(X + dx, low, Z + dz) === 0 && getBlock(X + dx, low - 1, Z + dz) !== 0) setBlockRaw(X + dx, low, Z + dz, B.lava);
    }
  }
}

/**
 * Sinks the ruins of a few little brick houses into the sea, each with a treasure chest inside
 * and a water ember ore in its floor. Their tallest corners stick out of the water.
 */
function sinkRuins(rnd, heights) {
  const built = [];
  for (let tries = 0; tries < 600 && built.length < 3; tries++) {
    const cx = 4 + ((rnd() * (SX - 8)) | 0), cz = 4 + ((rnd() * (SZ - 8)) | 0);
    let floor = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) floor = Math.max(floor, heights[cx + dx + (cz + dz) * SX]);
    if (floor > WATER - 2 || built.some(([x, z]) => Math.hypot(x - cx, z - cz) < 16)) continue;
    built.push([cx, cz]);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, z = cz + dz;
      for (let y = heights[x + z * SX] + 1; y < floor; y++) setBlockRaw(x, y, z, B.sand);
      setBlockRaw(x, floor, z, B.stone);
      if (Math.max(Math.abs(dx), Math.abs(dz)) < 2 || (dx === 0 && dz === 2)) continue;   // inside, and the doorway
      const tall = (Math.abs(dx) === 2 && Math.abs(dz) === 2 ? 4 : 1) + ((rnd() * 3) | 0);
      for (let k = 1; k <= tall; k++) setBlockRaw(x, floor + k, z, rnd() < 0.8 ? B.brick : B.stone);
    }
    setBlockRaw(cx, floor + 1, cz, B.chest);
    setBlockRaw(cx + (rnd() < 0.5 ? -1 : 1), floor, cz + ((rnd() * 3) | 0) - 1, B.water_ember_ore);
  }
}

/**
 * Hides things to find in the world as it is now: flowers on grass, shells on the beach and
 * apples in the outside of the trees. Works on any world, so a world saved before there were
 * finds gets them too.
 */
function scatterFinds(rnd) {
  const open = (x, y, z) => getBlock(x, y, z) === 0;
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    let top = SY - 1;
    while (top > 0 && getBlock(x, top, z) === 0) top--;
    const id = getBlock(x, top, z), r = rnd();
    if (id === B.grass && open(x, top + 1, z) && r < 0.035) {
      setBlockRaw(x, top + 1, z, rnd() < 0.5 ? B.flower_red : B.flower_yellow);
    } else if (id === B.sand && top >= WATER && top <= WATER + 1 && open(x, top + 1, z) && r < 0.05) {
      setBlockRaw(x, top + 1, z, B.shell);
    }
    for (let y = 1; y < top; y++) {
      if (getBlock(x, y, z) !== B.leaves) continue;
      const outside = open(x + 1, y, z) || open(x - 1, y, z) || open(x, y, z + 1) || open(x, y, z - 1) || open(x, y - 1, z);
      if (outside && rnd() < 0.12) setBlockRaw(x, y, z, B.apple_leaves);
    }
  }
}

/**
 * Hides the minerals' ores in the world as it is now, each where its drawing says it is found
 * and about as rare: coal and copper anywhere, gold in caves and under the desert, emerald on the
 * mountain tops, the very rare ones on the walls of the deep caves, fire ember beside the lava,
 * celestium just above the bottom rock. A few coal, copper, gold and emerald ores lie in the open,
 * so the first finds are easy. Works on any world: a world saved before there were minerals gets
 * them too, in plain deep stone where it has no caves (but no fire ember without lava).
 * Water ember is not here: it comes with the sunken ruins.
 */
function scatterMinerals(rnd) {
  const GROUND = new Set([B.grass, B.dirt, B.stone, B.sand, B.snow]);
  const ground = new Int32Array(SX * SZ);
  let peak = 0;
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    let y = SY - 1;
    while (y > 0 && !GROUND.has(getBlock(x, y, z))) y--;
    ground[x + z * SX] = y;
    if (y > WATER + 1) peak = Math.max(peak, y);
  }
  const stone = [], wall = [], lavaSide = [], desert = [], peaks = [], grassTops = [], sandTops = [], peakTops = [];
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const g = ground[x + z * SX], top = getBlock(x, g, z), open = getBlock(x, g + 1, z) === 0, dry = g > WATER + 1;
    if (open && top === B.grass) grassTops.push([x, g, z]);
    if (open && dry && top === B.sand) sandTops.push([x, g, z]);
    if (dry && g >= peak - 3) {
      for (let y = g - 3; y <= g; y++) peaks.push([x, y, z]);
      if (open) peakTops.push([x, g, z]);
    }
    for (let y = 1; y < g; y++) {
      if (getBlock(x, y, z) !== B.stone) continue;
      const p = [x, y, z];
      stone.push(p);
      if (touches(x, y, z, 0)) wall.push(p);
      if (touches(x, y, z, B.lava)) lavaSide.push(p);
      if (dry && top === B.sand && y >= g - 8) desert.push(p);
    }
  }
  const below = (list, maxY) => list.filter(p => p[1] <= maxY);
  // Grows `n` veins of ore `key`, each of `lo` to `hi` blocks, from the first of the places this world has.
  const veins = (key, n, [lo, hi], ...places) => {
    const spots = places.find(list => list.length);
    if (!spots) return;
    for (let i = 0; i < n; i++) {
      let [x, y, z] = spots[(rnd() * spots.length) | 0];
      for (let k = lo + ((rnd() * (hi - lo + 1)) | 0); k > 0; k--) {
        if (GROUND.has(getBlock(x, y, z))) setBlockRaw(x, y, z, B[key]);
        const a = (rnd() * 3) | 0, s = rnd() < 0.5 ? -1 : 1;
        if (a === 0) x += s; else if (a === 1) y = Math.max(1, y + s); else z += s;
      }
    }
  };
  veins('coal_ore', 45, [3, 6], stone);
  veins('copper_ore', 40, [3, 6], stone);
  veins('iron_ore', 30, [2, 5], stone);
  veins('lapis_ore', 12, [2, 4], below(stone, 7));
  veins('gold_ore', 8, [2, 3], below(wall, 8), below(stone, 8));
  veins('gold_ore', 8, [2, 4], desert);
  veins('redstone_ore', 12, [2, 4], below(wall, 9), below(stone, 7));
  veins('emerald_ore', 8, [1, 2], peaks);
  veins('diamond_ore', 6, [1, 3], below(wall, 5), below(stone, 5));
  veins('ruby_ore', 5, [1, 3], below(wall, 6), below(stone, 5));
  veins('fire_ember_ore', 6, [1, 2], lavaSide);
  veins('rainbow_ore', 3, [1, 2], below(wall, 5), below(stone, 4));
  veins('celestium_ore', 2, [1, 1], below(wall, 2), below(stone, 2));
  veins('coal_ore', 5, [1, 1], grassTops);
  veins('copper_ore', 4, [1, 1], grassTops);
  veins('gold_ore', 4, [1, 1], sandTops);
  veins('emerald_ore', 2, [1, 1], peakTops);
}

function surfaceY(x, z) {
  for (let y = SY - 1; y >= 0; y--) if (isSolid(getBlock(x, y, z))) return y + 1;
  return SY;
}
