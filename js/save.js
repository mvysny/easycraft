// Saving the world and the players in the browser, and loading them back.
'use strict';

const SAVE_KEY = 'easycraft-world-v1';

// ---------------------------------------------------------------------------
// Saving / loading (browser storage)
// ---------------------------------------------------------------------------
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
/** Packs `bytes` as base64 of (value, run length) pairs. */
function packRuns(bytes) {
  const rle = [];
  let prev = bytes[0], run = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === prev && run < 255) run++;
    else { rle.push(prev, run); prev = bytes[i]; run = 1; }
  }
  rle.push(prev, run);
  return bytesToB64(Uint8Array.from(rle));
}
/** Unpacks what `packRuns` made into one world's worth of cells, or null if it doesn't fit or holds a value ≥ `limit`. */
function unpackRuns(b64, limit) {
  const bin = atob(b64);
  const out = new Uint8Array(SX * SY * SZ);
  let o = 0;
  for (let i = 0; i < bin.length; i += 2) {
    const v = bin.charCodeAt(i), run = bin.charCodeAt(i + 1);
    if (v >= limit || o + run > out.length) return null;
    out.fill(v, o, o + run); o += run;
  }
  return o === out.length ? out : null;
}
function saveWorld() {
  try {
    for (const p of players) savedSlots[p.slot] = p.snapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      size: [SX, SY, SZ], data: packRuns(blocks), fluid: packRuns(fluid),
      players: savedSlots, home: [home.x, home.y, home.z], finds: 1, minerals: 1,
    }));
    worldDirty = false;
  } catch (e) {
    console.warn('Could not save the world', e);
  }
}
function loadWorld() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (s.size.join() !== [SX, SY, SZ].join()) return false;
    const out = unpackRuns(s.data, BLOCKS.length);
    if (!out) return false;
    blocks = out;
    const flow = s.fluid && unpackRuns(s.fluid, HEAD + SY);
    if (flow) fluid = flow;
    else { fluid = new Uint8Array(SX * SY * SZ); markSea(); }   // saved before liquids flowed
    const rnd = mulberry32((Math.random() * 1e9) | 0);
    if (!s.finds) scatterFinds(rnd);         // saved before there were finds
    if (!s.minerals) scatterMinerals(rnd);   // or before there were minerals
    home.set(...s.home);
    if (s.players) Object.assign(savedSlots, s.players);
    else if (s.player) savedSlots[0] = [...s.player.slice(0, 6), s.selected || 0];   // a single-player save
    return true;
  } catch (e) {
    console.warn('Could not load the saved world, making a new one', e);
    return false;
  }
}
function newWorld() {
  generateWorld((Math.random() * 1e9) | 0);
  findHome();
  wakeAllLiquids();
  for (const k in savedSlots) delete savedSlots[k];
  for (const p of players) {
    p.yaw = Math.PI * 0.25; p.pitch = -0.15;
    p.setFlying(false);
    p.goHome();
    p.syncCamera();
    p.updateAvatar(0);
  }
  rebuildAll();
  saveWorld();
}
setInterval(() => { if (worldDirty) saveWorld(); }, 4000);
addEventListener('beforeunload', saveWorld);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveWorld(); });
