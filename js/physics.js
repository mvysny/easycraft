// Looking at blocks, changing them, and bumping into them.
'use strict';

const REACH = 6;                    // how far you can reach, in blocks

// ---------------------------------------------------------------------------
// Looking at blocks (voxel ray march from a camera)
// ---------------------------------------------------------------------------
const rayDir = new THREE.Vector3();
function pickBlock(camera) {
  camera.getWorldDirection(rayDir);
  const o = camera.position;
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(rayDir.x), sy = Math.sign(rayDir.y), sz = Math.sign(rayDir.z);
  const tdx = sx ? Math.abs(1 / rayDir.x) : Infinity;
  const tdy = sy ? Math.abs(1 / rayDir.y) : Infinity;
  const tdz = sz ? Math.abs(1 / rayDir.z) : Infinity;
  let tx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
  let ty = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
  let tz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
  let n = [0, 0, 0], t = 0, water = null;
  const startInWater = BLOCKS[getBlock(x, y, z)]?.liquid;
  while (t <= REACH) {
    const id = getBlock(x, y, z);
    if (id) {
      if (!BLOCKS[id].liquid) return { x, y, z, n, id };
      if (!water && !startInWater) water = { x, y, z, n, id };
    }
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return water;
}

let worldDirty = false;
function changeBlock(x, y, z, id) {
  setBlockRaw(x, y, z, id);
  markDirtyAround(x, z);
  wakeLiquids(x, y, z);
  worldDirty = true;
}

// ---------------------------------------------------------------------------
// Player physics helpers
// ---------------------------------------------------------------------------
const PW = 0.3, PH = 1.7, EYE = 1.55;
const GRAVITY = 25, JUMP = 8.6, WALK = 4.6, FLY = 10;
let home = new THREE.Vector3();

function collides(px, py, pz) {
  const x0 = Math.floor(px - PW), x1 = Math.floor(px + PW - 1e-6);
  const y0 = Math.floor(py), y1 = Math.floor(py + PH - 1e-6);
  const z0 = Math.floor(pz - PW), z1 = Math.floor(pz + PW - 1e-6);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ || y < 0) return true;   // invisible walls at the world edge
    if (y < SY && isSolid(blocks[index(x, y, z)])) return true;
  }
  return false;
}
/** The liquid (water or lava) at point `v`, or 0; above a shallow run's surface is out of it. */
function liquidAt(v) {
  const x = Math.floor(v.x), y = Math.floor(v.y), z = Math.floor(v.z);
  const id = getBlock(x, y, z);
  return BLOCKS[id]?.liquid && v.y - y < liquidHeight(x, y, z) ? id : 0;
}
function inWater(v) { return liquidAt(v) !== 0; }

function findHome() {
  // look for dry land near the middle
  const cx = SX >> 1, cz = SZ >> 1;
  for (let r = 0; r < SX / 2; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, z = cz + dz, y = surfaceY(x, z);
    if (y > WATER + 1 && !isLeaves(getBlock(x, y - 1, z)) && !collides(x + 0.5, y, z + 0.5)) {
      home.set(x + 0.5, y, z + 0.5); return;
    }
  }
  home.set(cx + 0.5, SY - 2, cz + 0.5);
}
