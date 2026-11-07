// The bag's pictures of the minerals: a crystal, a cut stone or a lump of rock for each.
//
//     img.src = specimenIcon('ruby') ?? cubeIcon;   // null for a block that is no mineral
//
// Each picture is its mineral's own block texture stretched onto the stone, then only lightened
// or darkened: the stone in the bag and the block placed in the world share their colours.
'use strict';

const SPECIMEN_PX = 96;   // twice a bag cell, so it stays sharp on a high-density screen
const LIGHT = Math.atan2(-0.8, -0.6);   // the light comes from the top left

/** The picture of mineral block `key` as a data URL, or null for a block without one. */
function specimenIcon(key) {
  const paint = SPECIMENS[key];
  if (!paint) return null;
  const c = document.createElement('canvas');
  c.width = c.height = SPECIMEN_PX;
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.translate(48, 50); g.scale(1.12, 1.12); g.translate(-48, -50);   // fill the cell like a block icon does
  paint(g, key);
  return c.toDataURL();
}

const pathOf = (g, pts) => {
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
  g.closePath();
};
/** A closed smooth curve through the middles of `pts`' sides, bending at each point. */
const smoothPathOf = (g, pts) => {
  const n = pts.length, mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  g.beginPath(); g.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) g.quadraticCurveTo(...pts[i], ...mid(i));
  g.closePath();
};
/** Fills the current path with tile `tile`, stretched smoothly over the box x, y, w, h. */
function fillWithTile(g, tile, x, y, w, h) {
  const t = T[tile];
  g.save(); g.clip();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(atlasCanvas, (t % ATLAS_COLS) * TILE, Math.floor(t / ATLAS_COLS) * TILE, TILE, TILE, x, y, w, h);
  g.restore();
}
/** Lightens (k > 0) or darkens (k < 0) the current path. */
const tint = (g, k) => { g.fillStyle = k < 0 ? `rgba(0,0,0,${-k})` : `rgba(255,255,255,${k})`; g.fill(); };
const edges = (g, a, w = 1) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.stroke(); };
const outline = g => { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke(); };
/** A soft shadow on the ground under a stone. */
function groundShadow(g, cx, cy, rx) {
  g.save(); g.translate(cx, cy); g.scale(1, 0.22);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** A four-pointed glint of light. */
function sparkle(g, x, y, r) {
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [a, b] of [[r, r * 0.16], [r * 0.16, r]]) pathOf(g, [[x - a, y], [x, y - b], [x + a, y], [x, y + b]]), g.fill();
}
/** The average colour of tile `tile` as 'r,g,b', for a glow round a stone that gives off light. */
function tileRgb(tile) {
  const c = BLOCKS[B[tile]].color.clone().convertLinearToSRGB();
  return [c.r, c.g, c.b].map(v => Math.round(v * 255)).join(',');
}
function glow(g, cx, cy, r, tile, a = 0.55) {
  const gr = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  gr.addColorStop(0, `rgba(${tileRgb(tile)},${a})`); gr.addColorStop(1, `rgba(${tileRgb(tile)},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, SPECIMEN_PX, SPECIMEN_PX);
}

/**
 * A broken lump of rock: a top face ringed by flat facets, each shaded by which way it faces.
 * `contrast` deepens the shading; `gloss` adds the bright edges of a shiny stone.
 */
function rockLump(g, tile, { seed, cx = 48, cy = 52, rx = 34, ry = 27, n = 8, contrast = 1, gloss = 0 }) {
  const rnd = mulberry32(seed);
  const floor = cy + ry * 0.72;
  const ang = [], outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const a = (i + (rnd() - 0.5) * 0.6) / n * Math.PI * 2, r = 0.82 + rnd() * 0.18, ri = 0.42 + rnd() * 0.2;
    ang.push(a);
    outer.push([cx + Math.cos(a) * rx * r, Math.min(floor, cy + Math.sin(a) * ry * r)]);
    inner.push([cx - rx * 0.1 + Math.cos(a) * rx * ri, cy - ry * 0.18 + Math.sin(a) * ry * ri * 0.8]);
  }
  groundShadow(g, cx, floor + 2, rx * 1.1);
  pathOf(g, outer); fillWithTile(g, tile, cx - rx, cy - ry, rx * 2, ry * 2);
  const facets = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, k = Math.cos((ang[i] + ang[j] + (j ? 0 : Math.PI * 2)) / 2 - LIGHT);
    facets.push([[inner[i], outer[i], outer[j]], k + (rnd() - 0.5) * 0.5]);
    facets.push([[inner[i], outer[j], inner[j]], k * 0.7 + 0.15 + (rnd() - 0.5) * 0.5]);
  }
  const top = [cx - rx * 0.1 + (rnd() - 0.5) * 8, cy - ry * 0.18 + (rnd() - 0.5) * 6];
  for (let i = 0; i < n; i++) facets.push([[top, inner[i], inner[(i + 1) % n]], 0.3 + (rnd() - 0.5) * 0.4]);
  for (const [pts, k] of facets) {
    pathOf(g, pts); tint(g, (k > 0 ? 0.22 : 0.42) * k * contrast);
    if (gloss && k > 0.6) tint(g, gloss * 0.25 * (k - 0.6));
    edges(g, 0.08 + gloss * 0.35 * Math.max(0, k));
  }
  pathOf(g, outer); outline(g);
}

/**
 * A smooth stone, shaded like a dome; `path` draws its outline inside the box x, y, w, h.
 * `bumps` knobs (or, with `dents`, hollows) dimple its skin; `shine` is how glossy it is.
 */
function domeStone(g, tile, path, [x, y, w, h], { shine = 0.5, bumps = 0, dents = false, seed = 1 } = {}) {
  const rnd = mulberry32(seed), cx = x + w / 2, cy = y + h / 2, r = Math.max(w, h) / 2;
  groundShadow(g, cx, y + h + 1, w * 0.55);
  path(); fillWithTile(g, tile, x, y, w, h);
  g.save(); path(); g.clip();
  for (let i = 0; i < bumps; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.75, br = r * (0.18 + rnd() * 0.14);
    const bx = cx + Math.cos(a) * d * w / 2, by = cy + Math.sin(a) * d * h / 2;
    const gr = g.createLinearGradient(bx - br * 0.7, by - br * 0.7, bx + br * 0.7, by + br * 0.7);
    const lit = `rgba(255,255,255,${0.35 * (0.4 + shine)})`, dark = 'rgba(0,0,0,0.35)';
    gr.addColorStop(0, dents ? dark : lit); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, dents ? lit : dark);
    g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  }
  const gr = g.createRadialGradient(cx - w * 0.2, cy - h * 0.24, 0, cx - w * 0.1, cy - h * 0.1, r * 1.25);
  gr.addColorStop(0, `rgba(255,255,255,${shine * 0.55})`); gr.addColorStop(0.3, 'rgba(255,255,255,0)');
  gr.addColorStop(0.65, 'rgba(0,0,0,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.restore();
  // the bright window the light makes on a polished surface
  g.save(); g.translate(cx - w * 0.2, cy - h * 0.27); g.rotate(-0.6); g.scale(1, 0.5);
  const hl = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.18);
  hl.addColorStop(0, `rgba(255,255,255,${shine})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.beginPath(); g.arc(0, 0, w * 0.18, 0, Math.PI * 2); g.fill();
  g.restore();
  path(); outline(g);
}
/** A rounded, lumpy stone or nugget round cx, cy; `rough` is how far its outline wobbles. */
function roundStone(g, tile, { seed, cx = 48, cy = 50, rx = 33, ry = 28, n = 9, rough = 0.15, ...opts }) {
  const rnd = mulberry32(seed + 1000);
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i + (rnd() - 0.5) * 0.5) / n * Math.PI * 2, r = 1 + (rnd() * 2 - 1) * rough;
    return [cx + Math.cos(a) * rx * r, Math.min(cy + ry * 0.85, cy + Math.sin(a) * ry * r)];
  });
  domeStone(g, tile, () => smoothPathOf(g, pts), [cx - rx, cy - ry, rx * 2, ry * 2], { seed, ...opts });
}
/** A polished stone with a smooth, rounded top, its texture lying across it like the drawing. */
const ellipseStone = (g, tile, cx, cy, rx, ry, opts) => domeStone(g, tile,
  () => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }, [cx - rx, cy - ry, rx * 2, ry * 2], opts);
const cushionStone = (g, tile, cx, cy, s, round, opts) => domeStone(g, tile,
  () => { g.beginPath(); g.roundRect(cx - s, cy - s, s * 2, s * 2, round); }, [cx - s, cy - s, s * 2, s * 2], opts);

/**
 * A six-sided crystal growing up from its foot x, y, `s` its half width and `h` its height,
 * leaning by `lean` radians; flat-topped, or ending in a point `tip` high.
 */
function crystal(g, tile, { x, y, s, h, lean = 0, tip = 0 }) {
  const e = s * 0.3, a = [s * 0.1, -h - tip];
  g.save(); g.translate(x, y); g.rotate(lean);
  const faces = [
    [[[-s, 0], [-s / 2, e], [-s / 2, -h + e], [-s, -h]], 0.16],
    [[[-s / 2, e], [s / 2, e], [s / 2, -h + e], [-s / 2, -h + e]], 0],
    [[[s / 2, e], [s, 0], [s, -h], [s / 2, -h + e]], -0.36],
    ...(tip ? [
      [[[-s, -h], [-s / 2, -h + e], a], 0.34],
      [[[-s / 2, -h + e], [s / 2, -h + e], a], 0.12],
      [[[s / 2, -h + e], [s, -h], a], -0.18],
    ] : [[[[-s, -h], [-s / 2, -h - e], [s / 2, -h - e], [s, -h], [s / 2, -h + e], [-s / 2, -h + e]], 0.38]]),
  ];
  const shape = [[-s, 0], [-s / 2, e], [s / 2, e], [s, 0], [s, -h], ...(tip ? [a] : [[s / 2, -h - e], [-s / 2, -h - e]]), [-s, -h]];
  pathOf(g, shape); fillWithTile(g, tile, -s, -h - Math.max(tip, e), s * 2, h + Math.max(tip, e) + e);
  for (const [pts, k] of faces) { pathOf(g, pts); tint(g, k); edges(g, 0.35); }
  // light caught inside the glassy crystal: a bright streak down the front faces
  pathOf(g, [[-s * 0.38, e * 0.9], [-s * 0.18, e * 0.95], [-s * 0.18, -h + e * 1.4], [-s * 0.38, -h + e * 1.3]]);
  tint(g, 0.28);
  pathOf(g, [[-s * 0.9, -h * 0.15], [-s * 0.75, -h * 0.1], [-s * 0.75, -h * 0.8], [-s * 0.9, -h * 0.85]]);
  tint(g, 0.2);
  pathOf(g, shape); outline(g);
  g.restore();
}

/** A cut gem seen from the side: a flat table on top, a crown of facets, and a point below. */
function cutGem(g, tile) {
  const top = [[32, 24], [43, 24], [53, 24], [64, 24]].map(([x, y]) => [x, y]);
  const gird = [[14, 40], [30, 42], [48, 43], [66, 42], [82, 40]], culet = [48, 84];
  groundShadow(g, 48, 88, 26);
  const shape = [gird[0], ...top, gird[4], culet];
  pathOf(g, shape); fillWithTile(g, tile, 14, 24, 68, 60);
  const side = x => (x - 14) / 68;   // 0 on the left, lit; 1 on the right, in shade
  const crown = [];
  for (let i = 0; i < 4; i++) {
    crown.push([gird[i], top[i], gird[i + 1]]);
    if (i < 3) crown.push([gird[i + 1], top[i], top[i + 1]]);
  }
  crown.forEach((pts, i) => { pathOf(g, pts); tint(g, 0.4 - side(pts[1][0]) * 0.5 + (i % 2 ? 0.14 : -0.04)); edges(g, 0.5); });
  for (let i = 0; i < 4; i++) {
    const q = [(gird[i][0] + gird[i + 1][0]) / 2, (gird[i][1] + gird[i + 1][1]) / 2 + 9];
    for (const [pts, alt] of [[[gird[i], q, culet], 0.12], [[q, gird[i + 1], culet], -0.12]]) {
      pathOf(g, pts); tint(g, 0.12 - side(q[0]) * 0.55 + alt); edges(g, 0.4);
    }
    pathOf(g, [gird[i], q, gird[i + 1]]); tint(g, 0.25 - side(q[0]) * 0.3); edges(g, 0.4);
  }
  g.beginPath(); g.moveTo(...top[0]); g.lineTo(...top[3]); edges(g, 0.9, 2);   // the table, edge-on
  pathOf(g, shape); outline(g);
}

/** Painters of the minerals' pictures, by block key; each follows the young player's drawing. */
const SPECIMENS = {
  coal(g, t) { rockLump(g, t, { seed: 3, contrast: 1.3, gloss: 1 }); sparkle(g, 36, 36, 6); },
  copper(g, t) { rockLump(g, t, { seed: 11, n: 9, contrast: 1.3, gloss: 0.7 }); sparkle(g, 38, 38, 6); },
  iron(g, t) { rockLump(g, t, { seed: 21, rx: 32, ry: 26, contrast: 1.4, gloss: 0.5 }); },
  lapis(g, t) { roundStone(g, t, { seed: 5, rough: 0.12, shine: 0.55 }); },
  nugget(g, t) { roundStone(g, t, { seed: 8, n: 7, rx: 32, ry: 26, rough: 0.28, shine: 0.95, bumps: 8 }); sparkle(g, 34, 34, 8); },
  redstone(g, t) { glow(g, 48, 50, 46, t, 0.45); rockLump(g, t, { seed: 31, rx: 31, ry: 25, contrast: 1, gloss: 0.6 }); sparkle(g, 40, 36, 5); },
  emerald(g, t) {
    crystal(g, t, { x: 34, y: 72, s: 11, h: 40, lean: -0.38 });
    crystal(g, t, { x: 62, y: 72, s: 10, h: 34, lean: 0.42 });
    crystal(g, t, { x: 48, y: 74, s: 13, h: 52, lean: 0.04 });
    rockLump(g, 'stone', { seed: 41, cy: 76, rx: 30, ry: 11, n: 7 });
  },
  ruby(g, t) {
    crystal(g, t, { x: 36, y: 72, s: 10, h: 26, lean: -0.5, tip: 12 });
    crystal(g, t, { x: 60, y: 72, s: 11, h: 32, lean: 0.36, tip: 13 });
    crystal(g, t, { x: 46, y: 75, s: 12, h: 38, lean: -0.06, tip: 15 });
    rockLump(g, 'stone', { seed: 47, cy: 77, rx: 29, ry: 11, n: 7 });
    sparkle(g, 40, 30, 6);
  },
  diamond(g, t) { cutGem(g, t); sparkle(g, 28, 34, 9); sparkle(g, 60, 56, 5); },
  water_ember(g, t) { ellipseStone(g, t, 48, 46, 25, 35, { shine: 0.9 }); sparkle(g, 38, 28, 6); },
  fire_ember(g, t) { glow(g, 48, 48, 47, t, 0.6); ellipseStone(g, t, 48, 46, 33, 33, { shine: 0.8 }); sparkle(g, 36, 32, 6); },
  rainbow(g, t) { cushionStone(g, t, 48, 47, 31, 15, { shine: 0.85 }); sparkle(g, 36, 32, 7); sparkle(g, 62, 62, 4); },
  celestium(g, t) {
    roundStone(g, t, { seed: 13, rx: 34, ry: 27, rough: 0.2, shine: 0.6, bumps: 7, dents: true });
    sparkle(g, 34, 36, 7); sparkle(g, 64, 58, 4);
  },
};
