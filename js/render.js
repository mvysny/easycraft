// The three.js scene: chunk meshes of the world, the sea, clouds and sun.
'use strict';

// ---------------------------------------------------------------------------
// Three.js setup
// ---------------------------------------------------------------------------
const SKY = new THREE.Color('#8fd3ff');
const UNDERWATER = new THREE.Color('#2a6fc0');
const IN_LAVA = new THREE.Color('#e0601c');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
renderer.domElement.id = 'game';
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 45, 130);

// Three.js layers decide which camera sees what. Layer 0 is the shared world. Player `slot`'s
// block outline sits on HIGHLIGHT_LAYER + slot (only their camera sees it), and their body on
// AVATAR_LAYER + slot (every camera but their own sees it).
const HIGHLIGHT_LAYER = 1, AVATAR_LAYER = 5;
function setLayer(obj, layer) { obj.traverse(o => o.layers.set(layer)); }

const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const matSolid = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
const matWater = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
});

// ---------------------------------------------------------------------------
// Meshing: one opaque + one water mesh per 16x16 chunk, hidden faces culled,
// simple per-vertex ambient occlusion for that soft blocky look.
// ---------------------------------------------------------------------------
const FACES = [
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.68, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.68, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
// For each face/corner, precompute the two side offsets used by ambient occlusion.
for (const f of FACES) {
  f.ao = f.corners.map(c => {
    const offs = [];
    for (let a = 0; a < 3; a++) {
      if (f.dir[a] !== 0) continue;
      const o = [0, 0, 0]; o[a] = c[a] === 1 ? 1 : -1; offs.push(o);
    }
    return offs;
  });
}
const AO_LEVEL = [0.5, 0.68, 0.84, 1.0];
const UV_INSET = 0.02;

function faceVisible(id, nid) {
  if (nid === 0) return true;
  const a = BLOCKS[id], b = BLOCKS[nid];
  if (a.liquid) return b.shape !== 'cube';
  if (b.liquid) return true;
  if (b.seeThrough) return id !== nid;
  return false;
}

function cornerAO(x, y, z, f, ci) {
  const [o1, o2] = f.ao[ci];
  const bx = x + f.dir[0], by = y + f.dir[1], bz = z + f.dir[2];
  const s1 = isOccluder(getMesh(bx + o1[0], by + o1[1], bz + o1[2])) ? 1 : 0;
  const s2 = isOccluder(getMesh(bx + o2[0], by + o2[1], bz + o2[2])) ? 1 : 0;
  if (s1 && s2) return 0;
  const c = isOccluder(getMesh(bx + o1[0] + o2[0], by + o1[1] + o2[1], bz + o1[2] + o2[2])) ? 1 : 0;
  return 3 - (s1 + s2 + c);
}

/**
 * Adds one picture of `tile`, seen from both sides, to mesh `o`. `p` holds four corners as
 * [x, y, z]: bottom-left, bottom-right, top-left, top-right of the picture.
 */
function pushPicture(o, p, tile, brightness) {
  const tu = (tile % ATLAS_COLS) * TILE, tv = Math.floor(tile / ATLAS_COLS) * TILE;
  const ndx = o.pos.length / 3;
  const br = Math.pow(brightness, 2.2);
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cu, cv], i) => {
    o.pos.push(...p[i]);
    o.uv.push((tu + UV_INSET + cu * (TILE - 2 * UV_INSET)) / ATLAS_W, 1 - (tv + UV_INSET + (1 - cv) * (TILE - 2 * UV_INSET)) / ATLAS_H);
    o.col.push(br, br, br);
  });
  o.idx.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3, ndx, ndx + 2, ndx + 1, ndx + 2, ndx + 3, ndx + 1);
}
/** A 'cross' block is two pictures crossing corner to corner; a 'flat' one lies just above the floor. */
function pushShape(o, blk, x, y, z) {
  if (blk.shape === 'flat') {
    const h = y + 0.03;
    pushPicture(o, [[x, h, z + 1], [x + 1, h, z + 1], [x, h, z], [x + 1, h, z]], blk.top, 1.0);
    return;
  }
  const a = 0.15, b = 1 - a;
  pushPicture(o, [[x + a, y, z + a], [x + b, y, z + b], [x + a, y + 1, z + a], [x + b, y + 1, z + b]], blk.side, 0.92);
  pushPicture(o, [[x + a, y, z + b], [x + b, y, z + a], [x + a, y + 1, z + b], [x + b, y + 1, z + a]], blk.side, 0.85);
}

function buildChunkGeometry(cx, cz) {
  const out = [{ pos: [], uv: [], col: [], idx: [] }, { pos: [], uv: [], col: [], idx: [] }];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const ao = [0, 0, 0, 0];
  for (let y = 0; y < SY; y++) for (let z = z0; z < z0 + CHUNK; z++) for (let x = x0; x < x0 + CHUNK; x++) {
    const id = blocks[index(x, y, z)];
    if (!id) continue;
    const blk = BLOCKS[id];
    if (blk.shape !== 'cube') { pushShape(out[0], blk, x, y, z); continue; }
    const top = blk.liquid ? liquidHeight(x, y, z) : 1;
    for (const f of FACES) {
      const nid = getMesh(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
      let bottom = 0;   // a side face starts here
      if (blk.liquid && nid === id) {
        // beside more of itself, only the part standing above a lower neighbour shows
        if (f.dir[1] !== 0) continue;
        bottom = liquidHeight(x + f.dir[0], y, z + f.dir[2]);
        if (bottom >= top - 0.01) continue;
      } else if (!faceVisible(id, nid)) continue;
      const o = out[blk.liquid && !blk.opaque ? 1 : 0];
      const tile = f.dir[1] === 1 ? blk.top : f.dir[1] === -1 ? blk.bottom : blk.side;
      const tu = (tile % ATLAS_COLS) * TILE, tv = Math.floor(tile / ATLAS_COLS) * TILE;
      const ndx = o.pos.length / 3;
      for (let ci = 0; ci < 4; ci++) {
        const c = f.corners[ci];
        o.pos.push(x + c[0], y + (c[1] ? top : f.dir[1] ? 0 : bottom), z + c[2]);
        const u = (tu + UV_INSET + c[3] * (TILE - 2 * UV_INSET)) / ATLAS_W;
        const v = 1 - (tv + UV_INSET + (1 - c[4]) * (TILE - 2 * UV_INSET)) / ATLAS_H;
        o.uv.push(u, v);
        ao[ci] = blk.liquid ? 3 : cornerAO(x, y, z, f, ci);
        const br = Math.pow(f.shade * AO_LEVEL[ao[ci]], 2.2);   // brightness in linear space
        o.col.push(br, br, br);
      }
      // flip the quad's diagonal so the AO gradient looks smooth
      if (ao[0] + ao[3] > ao[1] + ao[2]) o.idx.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
      else o.idx.push(ndx, ndx + 1, ndx + 3, ndx, ndx + 3, ndx + 2);
    }
  }
  return out.map(o => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
    g.setIndex(o.idx);
    g.computeBoundingSphere();
    return g;
  });
}

const CX = SX / CHUNK, CZ = SZ / CHUNK;
const chunks = [];
for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) {
  const solid = new THREE.Mesh(new THREE.BufferGeometry(), matSolid);
  const water = new THREE.Mesh(new THREE.BufferGeometry(), matWater);
  water.renderOrder = 1;
  scene.add(solid, water);
  chunks.push({ cx, cz, solid, water });
}
const dirtyChunks = new Set();
function rebuildChunk(i) {
  const c = chunks[i];
  const [gs, gw] = buildChunkGeometry(c.cx, c.cz);
  c.solid.geometry.dispose(); c.water.geometry.dispose();
  c.solid.geometry = gs; c.water.geometry = gw;
}
function rebuildAll() { for (let i = 0; i < chunks.length; i++) rebuildChunk(i); dirtyChunks.clear(); }
function markDirtyAround(x, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= SX || nz >= SZ) continue;
    dirtyChunks.add(Math.floor(nx / CHUNK) + Math.floor(nz / CHUNK) * CX);
  }
}

// ---------------------------------------------------------------------------
// Scenery: sea around the island, clouds, sun
// ---------------------------------------------------------------------------
{
  // Same look as the water blocks: see-through water over a sandy floor.
  const waterTile = document.createElement('canvas');
  waterTile.width = waterTile.height = TILE;
  waterTile.getContext('2d').drawImage(atlasCanvas,
    (T.water % ATLAS_COLS) * TILE, Math.floor(T.water / ATLAS_COLS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  const seaTex = new THREE.CanvasTexture(waterTile);
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
  seaTex.magFilter = seaTex.minFilter = THREE.NearestFilter;
  seaTex.generateMipmaps = false;
  seaTex.colorSpace = THREE.SRGBColorSpace;
  const seaMat = new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, opacity: 0.7, depthWrite: false });
  const floorMat = new THREE.MeshBasicMaterial({ color: BLOCKS[B.sand].color });
  const far = 400;
  const strips = [
    [-far, -far, SX + far, 0], [-far, SZ, SX + far, SZ + far],   // north / south
    [-far, 0, 0, SZ], [SX, 0, SX + far, SZ],                      // west / east
  ];
  for (const [x1, z1, x2, z2] of strips) {
    for (const [mat, y] of [[floorMat, 5], [seaMat, WATER + 0.9]]) {
      const geo = new THREE.PlaneGeometry(x2 - x1, z2 - z1);
      if (mat === seaMat) {  // one texture tile per block
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x2 - x1), uv.getY(i) * (z2 - z1));
      }
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      scene.add(m);
    }
  }
}
const clouds = new THREE.Group();
{
  const rnd = mulberry32(99);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    const parts = 2 + ((rnd() * 3) | 0);
    for (let p = 0; p < parts; p++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6 + rnd() * 10, 2, 4 + rnd() * 7), mat);
      m.position.set((rnd() - 0.5) * 10, 0, (rnd() - 0.5) * 7);
      cloud.add(m);
    }
    cloud.position.set(rnd() * (SX + 240) - 120, SY + 14 + rnd() * 6, rnd() * (SZ + 240) - 120);
    clouds.add(cloud);
  }
  scene.add(clouds);
}
const sunDir = new THREE.Vector3(0.5, 0.75, -0.45).normalize();
const sun = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: '#fff3a0', fog: false }));
const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(56, 56),
  new THREE.MeshBasicMaterial({ color: '#fff8d0', transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
sunGlow.position.z = -0.5;
sun.add(sunGlow);
scene.add(sun);

const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
const highlightMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
