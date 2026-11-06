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
function saveWorld() {
  try {
    const rle = [];
    let prev = blocks[0], run = 0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i] === prev && run < 255) run++;
      else { rle.push(prev, run); prev = blocks[i]; run = 1; }
    }
    rle.push(prev, run);
    for (const p of players) savedSlots[p.slot] = p.snapshot();
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      size: [SX, SY, SZ], data: bytesToB64(Uint8Array.from(rle)),
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
    const bin = atob(s.data);
    const out = new Uint8Array(SX * SY * SZ);
    let o = 0;
    for (let i = 0; i < bin.length; i += 2) {
      const id = bin.charCodeAt(i), run = bin.charCodeAt(i + 1);
      if (id >= BLOCKS.length || o + run > out.length) return false;
      out.fill(id, o, o + run); o += run;
    }
    if (o !== out.length) return false;
    blocks = out;
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
