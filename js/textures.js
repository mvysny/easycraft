// The block art: every texture is painted by code into one atlas; no image files.
'use strict';

// ---------------------------------------------------------------------------
// Tiny seeded random
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Procedural textures (16x16 pixel art, painted into one atlas)
// ---------------------------------------------------------------------------
const TILE = 16, ATLAS_COLS = 8;
const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'planks', 'log_side', 'log_top', 'leaves',
  'sand', 'glass', 'brick', 'water', 'snow', 'bedrock', 'gold',
  'red', 'orange', 'yellow', 'lime', 'blue', 'purple', 'pink', 'white',
  'flower_red', 'flower_yellow', 'shell', 'apple', 'diamond', 'diamond_ore', 'apple_leaves',
  'coal', 'coal_ore', 'copper', 'copper_ore', 'iron', 'iron_ore', 'lapis', 'lapis_ore',
  'nugget', 'gold_ore', 'redstone', 'redstone_ore', 'emerald', 'emerald_ore', 'ruby', 'ruby_ore',
  'water_ember', 'water_ember_ore', 'fire_ember', 'fire_ember_ore', 'rainbow', 'rainbow_ore',
  'celestium', 'celestium_ore', 'lava', 'chest_side', 'chest_top', 'chest_open_top',
];
const T = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));
const ATLAS_W = ATLAS_COLS * TILE;
const ATLAS_H = Math.ceil(TILE_NAMES.length / ATLAS_COLS) * TILE;

const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_W; atlasCanvas.height = ATLAS_H;
const atlasImg = new ImageData(ATLAS_W, ATLAS_H);
{
  const rnd = mulberry32(1234);
  let tile = 0;
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const set = (x, y, c, a = 255) => {
    const tx = (tile % ATLAS_COLS) * TILE + x, ty = Math.floor(tile / ATLAS_COLS) * TILE + y;
    const i = (ty * ATLAS_W + tx) * 4;
    atlasImg.data[i] = clamp(c[0]); atlasImg.data[i + 1] = clamp(c[1]);
    atlasImg.data[i + 2] = clamp(c[2]); atlasImg.data[i + 3] = a;
  };
  const vary = (c, amt) => { const k = 1 + (rnd() * 2 - 1) * amt; return [c[0] * k, c[1] * k, c[2] * k]; };
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const fill = (c, amt) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, vary(c, amt)); };
  const sprinkle = (c, n, amt = 0.08) => { for (let i = 0; i < n; i++) set((rnd() * TILE) | 0, (rnd() * TILE) | 0, vary(c, amt)); };
  const border = (c, amt = 0.05) => {
    for (let i = 0; i < TILE; i++) { set(i, 0, vary(c, amt)); set(i, TILE - 1, vary(c, amt)); set(0, i, vary(c, amt)); set(TILE - 1, i, vary(c, amt)); }
  };
  const clear = () => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, [0, 0, 0], 0); };
  const disc = (cx, cy, r, c, amt = 0.04) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) set(x, y, vary(c, amt));
    }
  };
  const flower = (petal, middle) => {
    clear();
    const STEM = [58, 150, 46];
    for (let y = 7; y < TILE; y++) set(7, y, vary(STEM, 0.05));
    for (const [x, y] of [[8, 11], [9, 10], [10, 10], [6, 13], [5, 12], [4, 12]]) set(x, y, vary(STEM, 0.08));
    for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0], [2, -2], [2, 2], [-2, 2], [-2, -2]]) disc(7.5 + dx, 5 + dy, 1.7, petal);
    disc(7.5, 5, 1.5, middle);
  };
  const line = (x0, y0, x1, y1, c, amt = 0.06) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), vary(c, amt));
  };
  // A rough lump of mineral lit from the top left; `cols` is [shadow, body, shine].
  const lump = (cx, cy, r, cols, amt = 0.05) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) + (rnd() - 0.5) * 0.7;
      if (d > r) continue;
      const lit = -(dx + dy) / r;   // about 1 toward the top left, -1 toward the bottom right
      set(x, y, vary(lit < -0.6 ? cols[0] : lit > 0.5 && d < r - 0.3 ? cols[2] : cols[1], amt));
    }
  };
  // The flat faces of a broken mineral: each pixel takes the shade of the nearest of `n` faces.
  const facets = (c, n, spread, amt = 0.03) => {
    const seeds = Array.from({ length: n }, () => [rnd() * TILE, rnd() * TILE, 1 + (rnd() * 2 - 1) * spread]);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let best = Infinity, k = 1;
      for (const [sx, sy, sk] of seeds) {
        const d = (x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2;
        if (d < best) { best = d; k = sk; }
      }
      set(x, y, vary(mul(c, k), amt));
    }
  };
  const ORE_SPOTS = [[4, 4, 1.9], [11.5, 3.5, 1.6], [7.5, 9, 2.1], [3, 12.5, 1.6], [12.5, 12, 1.8]];
  // Stone with lumps of a mineral in it.
  const ore = (cols, spots = ORE_SPOTS) => { paint.stone(); for (const [x, y, r] of spots) lump(x, y, r, cols); };
  const for16 = fn => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y, x + 0.5 - 8, y + 0.5 - 8); };
  const GREEN = [96, 190, 62], DIRT = [134, 96, 67], BARK = [112, 82, 52];
  const paint = {
    grass_top() { fill(GREEN, 0.14); sprinkle([135, 222, 84], 22); sprinkle([70, 150, 45], 14); },
    dirt() { fill(DIRT, 0.12); sprinkle([100, 70, 48], 20); sprinkle([160, 120, 88], 10); },
    grass_side() {
      paint.dirt();
      for (let x = 0; x < TILE; x++) {
        const d = 3 + ((rnd() * 3) | 0);
        for (let y = 0; y < d; y++) set(x, y, vary(GREEN, 0.14));
      }
    },
    stone() {
      fill([130, 130, 132], 0.08);
      for (let i = 0; i < 9; i++) {
        const x = (rnd() * 14) | 0, y = (rnd() * 15) | 0;
        set(x, y, vary([104, 104, 108], 0.05)); set(x + 1, y, vary([104, 104, 108], 0.05));
      }
      sprinkle([158, 158, 160], 10, 0.04);
    },
    planks() {
      const base = [184, 142, 86];
      for (let y = 0; y < TILE; y++) {
        const row = y >> 2;
        const seam = row % 2 ? 4 : 11;
        const rowTint = 1 + ((row * 7919) % 5 - 2) * 0.025;
        for (let x = 0; x < TILE; x++) {
          if (y % 4 === 3 || x === seam) set(x, y, vary([124, 90, 52], 0.05));
          else set(x, y, vary(mul(base, rowTint), 0.06));
        }
      }
    },
    log_side() {
      for (let x = 0; x < TILE; x++) {
        const stripe = x % 4 === 0 ? 0.78 : x % 4 === 2 ? 0.92 : 1;
        for (let y = 0; y < TILE; y++) set(x, y, vary(mul(BARK, stripe), 0.08));
      }
    },
    log_top() {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (d > 6.5) set(x, y, vary(BARK, 0.08));
        else set(x, y, vary(Math.floor(d) % 2 ? [198, 162, 102] : [172, 134, 82], 0.04));
      }
    },
    leaves() { fill([62, 152, 48], 0.18); sprinkle([36, 104, 30], 34); sprinkle([104, 196, 70], 16); },
    sand() { fill([232, 216, 152], 0.06); sprinkle([206, 188, 126], 18); },
    glass() {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, [0, 0, 0], 0);
      border([214, 238, 255], 0.03);
      for (const [x, y] of [[3, 5], [4, 4], [5, 3], [3, 7], [7, 3], [10, 12], [11, 11], [12, 10]]) set(x, y, [255, 255, 255]);
    },
    brick() {
      for (let y = 0; y < TILE; y++) {
        const row = y >> 2, off = row % 2 ? 4 : 0;
        for (let x = 0; x < TILE; x++) {
          if (y % 4 === 3 || (x + off) % 8 === 7) set(x, y, vary([206, 200, 190], 0.04));
          else set(x, y, vary([184, 72, 52], 0.08));
        }
      }
    },
    water() {
      fill([64, 156, 236], 0.05);
      for (let i = 0; i < 9; i++) {
        const x = (rnd() * 12) | 0, y = (rnd() * TILE) | 0, len = 2 + ((rnd() * 3) | 0);
        for (let k = 0; k < len; k++) set(x + k, y, vary([150, 206, 250], 0.03));
      }
    },
    snow() { fill([246, 249, 255], 0.025); sprinkle([216, 228, 246], 14, 0.02); },
    bedrock() { fill([72, 72, 78], 0.38); },
    gold() {
      fill([250, 204, 52], 0.07); border([206, 150, 22]);
      for (const [x, y] of [[3, 3], [4, 3], [3, 4], [5, 3], [3, 5], [10, 11], [11, 10]]) set(x, y, [255, 244, 160]);
    },
    flower_red() { flower([236, 58, 74], [255, 214, 64]); },
    flower_yellow() { flower([255, 216, 48], [196, 110, 30]); },
    shell() {   // seen from above: a fan of ridges
      clear();
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const dx = x + 0.5 - 8, dy = 13 - (y + 0.5), r = Math.hypot(dx, dy);
        if (dy < -1.5 || r > 7.5 || (dy < 0 && Math.abs(dx) > 2)) continue;
        const ridge = Math.floor((Math.atan2(dx, dy) + 2) * 3) % 2;
        set(x, y, vary(ridge ? [238, 184, 168] : [252, 226, 210], 0.04));
      }
    },
    apple() {
      clear();
      disc(7.5, 9.5, 5.5, [214, 40, 48], 0.05);
      disc(5.5, 7.5, 1.4, [252, 120, 120], 0.02);
      for (let y = 1; y < 5; y++) set(8, y, vary([110, 72, 40], 0.05));
      for (const [x, y] of [[9, 2], [10, 2], [11, 1], [10, 3], [11, 2], [12, 1]]) set(x, y, vary([76, 170, 52], 0.06));
    },
    diamond() {   // a cut stone seen from above: facets fanning out from a flat middle
      for16((x, y, dx, dy) => {
        const sector = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4)) % 2;
        set(x, y, vary(mul([150, 214, 248], (sector ? 1 : 0.8) * (Math.hypot(dx, dy) < 3.3 ? 1.08 : 1)), 0.03));
      });
      border([70, 150, 214], 0.03);
      for (const [x, y] of [[4, 4], [5, 4], [4, 5], [7, 7], [8, 8], [11, 10], [10, 11]]) set(x, y, [240, 252, 255]);
    },
    diamond_ore() { ore([[40, 140, 210], [110, 208, 246], [235, 252, 255]]); },
    // The minerals below follow a young player's drawings, painted the way the real stones look.
    coal() { facets([46, 46, 52], 8, 0.35, 0.05); sprinkle([22, 22, 24], 24, 0.1); sprinkle([132, 140, 158], 7, 0.05); },
    coal_ore() { ore([[18, 18, 20], [42, 42, 48], [110, 116, 130]]); },
    copper() {
      facets([196, 112, 60], 7, 0.18, 0.05);
      // the green streak of the drawing: patina, where copper has got wet
      for (let x = 1; x < 15; x++) {
        const y = Math.round(9 - x * 0.3 + Math.sin(x) * 0.8);
        set(x, y, vary([46, 128, 100], 0.08)); set(x, y + 1, vary([70, 160, 124], 0.08));
      }
      sprinkle([64, 150, 118], 6); sprinkle([246, 186, 136], 8, 0.04);
    },
    copper_ore() {
      ore([[128, 66, 32], [204, 120, 64], [246, 184, 134]]);
      for (const [x, y] of ORE_SPOTS) set(Math.round(x) + 1, Math.round(y), vary([58, 146, 112], 0.06));
    },
    iron() {
      facets([92, 94, 102], 7, 0.15, 0.04);
      for (const [x0, y0, x1, y1] of [[2, 3, 6, 13], [6, 1, 11, 11], [10, 4, 13, 14]]) line(x0, y0, x1, y1, [132, 80, 46], 0.1);   // rust
      sprinkle([170, 174, 184], 6, 0.03);
    },
    iron_ore() {
      ore([[44, 44, 50], [86, 88, 98], [176, 180, 192]]);
      for (const [x, y] of ORE_SPOTS) set(Math.round(x), Math.round(y) + 1, vary([150, 86, 46], 0.06));   // rust
    },
    lapis() {
      fill([40, 66, 180], 0.1); sprinkle([24, 40, 132], 34, 0.08); sprinkle([82, 112, 222], 18, 0.06);
      for (let x = 0; x < TILE; x++) set(x, Math.round(4 + Math.sin(x * 0.7) * 1.5), vary([214, 220, 236], 0.04));   // white calcite
      for (const [x, y] of [[3, 10], [9, 8], [12, 13], [6, 14], [13, 2]]) set(x, y, vary([236, 196, 84], 0.05));    // golden pyrite
    },
    lapis_ore() { ore([[22, 38, 124], [42, 70, 186], [96, 128, 232]]); set(8, 9, [236, 196, 84]); set(4, 4, [236, 196, 84]); },
    nugget() {   // rounded lumps of gold pressed together
      fill([150, 104, 18], 0.06);
      for (const [x, y, r] of [[4, 4, 4], [11.5, 4.5, 3.8], [4.5, 11.5, 3.8], [11.5, 11.5, 4.2], [8, 8, 3]]) {
        lump(x, y, r, [[184, 130, 26], [236, 186, 48], [255, 236, 140]], 0.04);
      }
    },
    gold_ore() { ore([[172, 118, 20], [240, 192, 52], [255, 242, 160]]); },
    redstone() { fill([196, 28, 24], 0.12); sprinkle([118, 10, 10], 30, 0.1); sprinkle([250, 84, 64], 18, 0.06); sprinkle([255, 200, 186], 5, 0.02); },
    redstone_ore() {
      ore([[120, 12, 10], [214, 34, 28], [255, 140, 120]],
        [[3, 3, 1.3], [8, 2.5, 1.2], [13, 4, 1.4], [5, 8, 1.3], [10.5, 8.5, 1.5], [2.5, 13, 1.3], [7.5, 13, 1.2], [13, 12.5, 1.4]]);
    },
    emerald() {   // the side of a six-sided crystal: long faces, lighter where they catch the light
      const SHADE = [0.72, 0.86, 1.06, 1.12, 0.94, 0.8];
      for16((x, y) => set(x, y, vary(mul([64, 186, 100], SHADE[Math.min(5, Math.floor(x / 2.7))]), 0.04)));
      for (const [x0, y0, x1, y1] of [[3, 2, 5, 9], [9, 6, 12, 14], [6, 11, 7, 15]]) line(x0, y0, x1, y1, [30, 112, 62]);   // darker cracks
      for (const [x, y] of [[6, 3], [7, 4], [6, 5]]) set(x, y, [196, 250, 206]);
    },
    emerald_ore() { ore([[26, 112, 58], [64, 186, 100], [170, 244, 180]], [[4, 4, 1.6], [11.5, 4, 1.4], [7.5, 9.5, 1.8], [3.5, 12.5, 1.4], [12.5, 12, 1.6]]); },
    ruby() {
      facets([200, 24, 46], 9, 0.25, 0.04); border([118, 10, 28], 0.04);
      for (const [x, y] of [[4, 3], [5, 3], [4, 4], [10, 9], [11, 8]]) set(x, y, [255, 176, 190]);
      for (const [x, y] of [[12, 4], [3, 11], [7, 12], [8, 12]]) set(x, y, [255, 150, 64]);   // the orange glints of the drawing
    },
    ruby_ore() { ore([[112, 10, 28], [204, 26, 50], [255, 158, 170]]); },
    water_ember() {   // pale blue round the edge, deeper blue, and a dark glowing eye in the middle
      for16((x, y, dx, dy) => set(x, y, vary((dx / 2.6) ** 2 + (dy / 6.2) ** 2 <= 1 ? [26, 34, 156]
        : (dx / 5) ** 2 + (dy / 7.6) ** 2 <= 1 ? [34, 98, 200] : [92, 160, 232], 0.05)));
      for (let y = 4; y < 12; y++) set(7, y, vary([90, 120, 250], 0.05));
      set(7, 6, [200, 220, 255]);
    },
    water_ember_ore() { ore([[24, 34, 150], [46, 110, 212], [150, 196, 255]]); },
    fire_ember() {   // rings of red, orange and yellow round a red heart
      for16((x, y, dx, dy) => {
        const ax = Math.abs(dx), ay = Math.abs(dy), d = (ax + ay) * 0.45 + Math.max(ax, ay) * 0.55;
        set(x, y, vary(d < 1.3 ? [214, 34, 22] : d < 3.6 ? [255, 228, 76] : d < 5.2 ? [255, 172, 44]
          : d < 6.7 ? [240, 108, 26] : [196, 32, 24], 0.05));
      });
    },
    fire_ember_ore() { ore([[196, 34, 22], [250, 144, 34], [255, 234, 110]]); },
    rainbow() {   // rings of every colour round a dark, sparkling middle
      const RINGS = [[26, 22, 80], [26, 22, 80], [52, 60, 190], [40, 160, 84], [248, 218, 52], [250, 146, 36], [228, 46, 38], [196, 30, 34]];
      for16((x, y, dx, dy) => set(x, y, vary(RINGS[Math.min(7, Math.floor(Math.max(Math.abs(dx), Math.abs(dy))))], 0.05)));
      for (const [x, y, c] of [[6, 7, [255, 255, 255]], [8, 6, [255, 240, 120]], [9, 9, [120, 255, 160]], [7, 9, [255, 140, 200]]]) set(x, y, c);
    },
    rainbow_ore() {
      paint.stone();
      const C = [[226, 46, 38], [250, 150, 40], [248, 218, 52], [40, 170, 90], [70, 90, 230]];
      ORE_SPOTS.forEach(([x, y, r], i) => lump(x, y, r, [mul(C[i], 0.6), C[i], C[i].map(v => v + (255 - v) * 0.6)]));
    },
    celestium() {   // silvery metal from the sky, criss-crossed like a real meteorite, with a dark eye
      for16((x, y) => set(x, y, vary(mul([168, 172, 186], (x + y) % 5 === 0 ? 1.14 : (x - y + 20) % 5 === 0 ? 0.84 : 1), 0.04)));
      disc(9, 7.5, 1.5, [44, 44, 56]);
      for (const [x, y] of [[3, 3], [12, 12], [4, 12], [12, 3]]) set(x, y, [255, 255, 255]);
      for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]]) set(x, y, [210, 224, 255]);
    },
    celestium_ore() {
      ore([[70, 80, 120], [196, 206, 236], [255, 255, 255]], [[5, 5, 2.2], [11, 10.5, 2.4], [4, 12.5, 1.4]]);
      for (const [x, y] of [[5, 5], [11, 11]]) set(x, y, [36, 36, 50]);   // the dark eye
      for (const [x, y] of [[2, 1], [13, 3], [8, 14], [14, 7]]) set(x, y, [235, 240, 255]);   // star sparkles in the rock
    },
    lava() {
      fill([220, 78, 20], 0.08);
      for (let i = 0; i < 7; i++) {   // bright cracks
        let x = (rnd() * TILE) | 0, y = (rnd() * TILE) | 0;
        for (let k = 0; k < 6; k++) {
          set(x, y, vary([255, 200, 70], 0.05));
          x = Math.max(0, Math.min(TILE - 1, x + ((rnd() * 3) | 0) - 1));
          y = Math.max(0, Math.min(TILE - 1, y + ((rnd() * 3) | 0) - 1));
        }
      }
      sprinkle([150, 36, 14], 20, 0.08); sprinkle([255, 240, 160], 6, 0.03);
    },
    chest_side() {
      for16((x, y) => set(x, y, vary(y === 0 || y === 15 || y === 5 || x === 0 || x === 15 ? [96, 60, 30]
        : mul([158, 102, 50], x % 5 === 2 ? 0.88 : 1), 0.06)));
      for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) set(x, y, vary([240, 198, 64], 0.04));   // the golden latch
      set(7, 6, [60, 40, 20]);
    },
    chest_top() {
      for16((x, y) => set(x, y, vary(x === 0 || y === 0 || x === 15 || y === 15 ? [96, 60, 30]
        : mul([168, 110, 56], y % 4 === 3 ? 0.82 : 1), 0.06)));
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) set(x, y, [240, 198, 64]);
    },
    chest_open_top() {   // looking into an empty chest
      for16((x, y) => {
        const e = Math.min(x, y, 15 - x, 15 - y);
        set(x, y, vary(e === 0 ? [96, 60, 30] : e === 1 ? [140, 90, 44] : mul([62, 40, 22], 0.8 + e * 0.05), 0.05));
      });
    },
    apple_leaves() {
      paint.leaves();
      for (const [x, y] of [[3, 4], [10, 2], [12, 10], [5, 11]]) {
        set(x, y, [226, 46, 52]); set(x + 1, y, [206, 36, 44]);
        set(x, y + 1, [190, 30, 40]); set(x + 1, y + 1, [170, 24, 34]);
      }
    },
  };
  const COLORS = {
    red: [228, 62, 62], orange: [246, 146, 42], yellow: [250, 226, 62], lime: [122, 216, 62],
    blue: [62, 122, 236], purple: [152, 84, 216], pink: [246, 132, 192], white: [242, 242, 242],
  };
  for (const [name, c] of Object.entries(COLORS)) paint[name] = () => { fill(c, 0.05); border(mul(c, 0.8)); };
  for (const name of TILE_NAMES) { tile = T[name]; paint[name](); }
  atlasCanvas.getContext('2d').putImageData(atlasImg, 0, 0);
}

function tileAverageColor(t) {
  let r = 0, g = 0, b = 0, n = 0;
  const ox = (t % ATLAS_COLS) * TILE, oy = Math.floor(t / ATLAS_COLS) * TILE;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const i = ((oy + y) * ATLAS_W + ox + x) * 4;
    if (atlasImg.data[i + 3] < 128) continue;
    r += atlasImg.data[i]; g += atlasImg.data[i + 1]; b += atlasImg.data[i + 2]; n++;
  }
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}
