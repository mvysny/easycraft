// Player: one person at the screen.
'use strict';

const MAX_PLAYERS = 4;
const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];

// ---------------------------------------------------------------------------
// Player: one person at the screen — body, camera, HUD, and one input source.
// ---------------------------------------------------------------------------
const players = [];     // sorted by slot, so Player 1 is always top-left
// slot -> [x, y, z, yaw, pitch, flying, selected, bag {id: count}, hotbar [id…]]; survives leaving and saving
const savedSlots = {};

class Player {
  constructor(slot, input) {
    this.slot = slot;
    this.input = input;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI * 0.25; this.pitch = -0.15;
    this.onGround = false; this.flying = false;
    this.selected = 0;
    this.hotbar = HOTBAR.slice();
    this.bag = new Map();          // find id -> how many; an id is in here once it has been found
    this.bagCursor = null;         // index into BAG_ITEMS while the bag is open, else null
    this.navDir = ''; this.navTimer = 0;
    this.holdOff = false;          // ignore held buttons until they are let go (after closing the bag)
    this.walkPhase = 0; this.swing = 0;
    this.breakTimer = 0; this.placeTimer = 0; this.wasBreak = false; this.wasPlace = false;
    this.rect = { x: 0, y: 0, w: 1, h: 1 };

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.enable(HIGHLIGHT_LAYER + slot);
    for (let s = 0; s < MAX_PLAYERS; s++) if (s !== slot) this.camera.layers.enable(AVATAR_LAYER + s);
    this.highlight = new THREE.LineSegments(highlightGeo, highlightMat);
    this.highlight.visible = false;
    setLayer(this.highlight, HIGHLIGHT_LAYER + slot);
    this.avatar = makeAvatar(slot);
    scene.add(this.highlight, this.avatar.root);
    this.hud = new Hud(slot, input);

    if (savedSlots[slot]) this.restore(savedSlots[slot]); else this.goHome();
    this.hud.showHotbar(this.hotbar, this.bag);
    this.select(this.selected, true);
    this.syncCamera();
    this.updateAvatar(0);
  }

  restore(s) {
    this.pos.set(s[0], s[1], s[2]);
    this.yaw = s[3]; this.pitch = s[4];
    this.setFlying(!!s[5]);
    this.selected = s[6] || 0;
    for (const [id, n] of Object.entries(s[7] || {})) if (isFind(+id)) this.bag.set(+id, Math.max(0, n | 0));
    const known = id => BAG_ITEMS.includes(id);
    if (Array.isArray(s[8]) && s[8].length === HOTBAR.length && s[8].every(known)) this.hotbar = s[8].slice();
  }
  snapshot() {
    const p = this.pos;
    return [p.x, p.y, p.z, this.yaw, this.pitch, this.flying ? 1 : 0, this.selected,
      Object.fromEntries(this.bag), this.hotbar.slice()];
  }
  dispose() {
    scene.remove(this.highlight, this.avatar.root);
    this.avatar.tag.material.map.dispose();
    this.avatar.tag.material.dispose();
    this.hud.dispose();
  }

  goHome() {
    // each player gets their own spot next to home, so nobody spawns inside someone else
    const x = Math.min(SX - 1, Math.floor(home.x) + (this.slot % 2));
    const z = Math.min(SZ - 1, Math.floor(home.z) + (this.slot >> 1));
    this.pos.set(x + 0.5, surfaceY(x, z), z + 0.5);
    this.vel.set(0, 0, 0);
  }
  setFlying(on) { this.flying = on; this.vel.y = 0; this.hud.flying = on; }
  select(i, quiet) {
    const n = this.hotbar.length;
    this.selected = (i % n + n) % n;
    this.hud.showSelected(this.selected);
    if (!quiet) this.hud.toast(this.itemName(this.hotbar[this.selected]));
  }
  /** A block's name; a find also says how many are in the bag. */
  itemName(id) {
    return isFind(id) ? `${BLOCKS[id].name} × ${this.bag.get(id) || 0}` : BLOCKS[id].name;
  }
  /** Does this player's body overlap block (x, y, z)? */
  overlaps(x, y, z) {
    const p = this.pos;
    return x < p.x + PW && x + 1 > p.x - PW && y < p.y + PH && y + 1 > p.y && z < p.z + PW && z + 1 > p.z - PW;
  }

  breakBlock() {
    const hit = pickBlock(this.camera);
    if (!hit) return;
    const b = BLOCKS[hit.id];
    if (b.unbreakable) { playPlace(0.4); return; }
    changeBlock(hit.x, hit.y, hit.z, b.becomes ? B[b.becomes] : 0);
    burst(hit.x, hit.y, hit.z, b.drop ? B[b.drop] : hit.id);
    playBreak(b.pitch);
    if (b.drop) this.collect(B[b.drop]);
    // a flower or shell standing on the block comes along into the bag
    const above = getBlock(hit.x, hit.y + 1, hit.z);
    if (above && !BLOCKS[above].solid && !BLOCKS[above].liquid && !isSolid(getBlock(hit.x, hit.y, hit.z))) {
      changeBlock(hit.x, hit.y + 1, hit.z, 0);
      if (BLOCKS[above].drop) this.collect(B[BLOCKS[above].drop]);
    }
  }
  /** Puts one `id` into the bag. */
  collect(id) {
    this.bag.set(id, (this.bag.get(id) || 0) + 1);
    playCollect(BLOCKS[id].pitch / 1.6);
    const onHotbar = this.hotbar.includes(id);
    this.hud.toast(`+1 ${BLOCKS[id].name}` + (onHotbar ? '' : ` · ${this.input.bagKey} = bag`), 1400);
    this.hud.showHotbar(this.hotbar, this.bag);
    this.showBag();
  }
  placeBlock() {
    const hit = pickBlock(this.camera);
    if (!hit) return;
    const id = this.hotbar[this.selected];
    const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
    if (!inBounds(x, y, z)) return;
    const cur = getBlock(x, y, z);
    if (cur && !BLOCKS[cur].liquid) return;
    if (isSolid(id) && players.some(p => p.overlaps(x, y, z))) return;
    // flowers, shells and apples stand on solid ground, in the air
    if (BLOCKS[id].shape !== 'cube' && (cur || !isSolid(getBlock(x, y - 1, z)))) { playPlace(0.4); return; }
    if (isFind(id)) {
      const have = this.bag.get(id) || 0;
      if (!have) { playPlace(0.4); this.hud.toast(`No ${BLOCKS[id].name} left — find more!`, 1400); return; }
      this.bag.set(id, have - 1);
      this.hud.showHotbar(this.hotbar, this.bag);
    }
    changeBlock(x, y, z, id);
    playPlace(BLOCKS[id].pitch);
  }

  // ---- the bag ----
  openBag() {
    const i = BAG_ITEMS.indexOf(this.hotbar[this.selected]);
    this.bagCursor = i < 0 ? 0 : i;
    this.navDir = 'held';   // a stick already tilted doesn't move the cursor until it's let go
    this.showBag();
    playPlace(1.3);
  }
  closeBag() {
    this.bagCursor = null;
    this.holdOff = true;
    this.showBag();
  }
  showBag() { this.hud.showBag(this.bagCursor, this.bag); }
  /** Moves the bag cursor; the cells sit in rows of ten, blocks first, then finds. */
  moveCursor(dx, dy) {
    const n = BAG_ITEMS.length, c = this.bagCursor;
    const next = dy ? c + dy * 10 : c + dx;
    this.bagCursor = Math.max(0, Math.min(n - 1, next));
    if (this.bagCursor !== c) { this.showBag(); playPlace(1.6); }
  }
  /** Puts the item under the cursor into the selected hotbar slot, and closes the bag. */
  takeFromBag() {
    const id = BAG_ITEMS[this.bagCursor];
    if (isFind(id) && !this.bag.has(id)) { playPlace(0.4); return; }
    const was = this.hotbar.indexOf(id);
    if (was >= 0) this.hotbar[was] = this.hotbar[this.selected];   // swap, so nothing gets lost
    this.hotbar[this.selected] = id;
    this.hud.showHotbar(this.hotbar, this.bag);
    this.closeBag();
    this.select(this.selected);
    playPlace(BLOCKS[id].pitch);
  }
  /** Steers the bag cursor with a stick or keys: one step, then repeating while held. */
  steerBag(it, dt) {
    const dx = Math.abs(it.navX) > 0.5 ? Math.sign(it.navX) : 0;
    const dy = Math.abs(it.navY) > 0.5 ? Math.sign(it.navY) : 0;
    const dir = dx || dy ? `${dx},${dy}` : '';
    if (this.navDir === 'held') { if (!dir) this.navDir = ''; return; }
    if (dir !== this.navDir) {
      this.navDir = dir; this.navTimer = 0.4;
      if (dir) this.moveCursor(dy ? 0 : dx, dy);
    } else if (dir && (this.navTimer -= dt) <= 0) {
      this.navTimer = 0.13;
      this.moveCursor(dy ? 0 : dx, dy);
    }
  }

  act(a) {
    if (typeof a === 'number') { this.select(a); if (this.bagCursor !== null) this.takeFromBag(); }
    else if (a === 'bag') { if (this.bagCursor === null) this.openBag(); else this.closeBag(); }
    else if (a === 'next') this.select(this.selected + 1);
    else if (a === 'prev') this.select(this.selected - 1);
    else if (this.bagCursor !== null) {
      if (a === 'ok' || a === 'break' || a === 'place') this.takeFromBag();
      else if (a === 'back') this.closeBag();
      else if (a === 'left') this.moveCursor(-1, 0);
      else if (a === 'right') this.moveCursor(1, 0);
      else if (a === 'up') this.moveCursor(0, -1);
      else if (a === 'down') this.moveCursor(0, 1);
    }
    else if (a === 'fly') this.setFlying(!this.flying);
    else if (a === 'home') this.goHome();
    else if (a === 'left') this.select(this.selected - 1);
    else if (a === 'right') this.select(this.selected + 1);
    else if (a === 'break') this.breakBlock();
    else if (a === 'place') this.placeBlock();
  }

  update(dt) {
    let it = this.input.read(dt);
    if (this.bagCursor !== null) {
      // a click opens nothing in the world while the bag is open: it takes the item
      if ((it.breakHeld && !this.wasBreak) || (it.placeHeld && !this.wasPlace)) it.actions.push('ok');
      this.wasBreak = it.breakHeld; this.wasPlace = it.placeHeld;
      for (const a of it.actions) this.act(a);
      if (this.bagCursor !== null) this.steerBag(it, dt);
      it = NO_INPUT;   // stand still while looking in the bag
    } else {
      if (this.holdOff) {
        if (!it.breakHeld && !it.placeHeld && !it.jump) this.holdOff = false;
        else it = { ...it, breakHeld: false, placeHeld: false, jump: false };
      }
      this.yaw += it.yaw;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch + it.pitch));
      for (const a of it.actions) this.act(a);
    }

    // walking direction on the ground; a half-tilted stick walks at half speed
    const mag = Math.min(1, Math.hypot(it.fwd, it.side));
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let ux = -sin * it.fwd + cos * it.side, uz = -cos * it.fwd - sin * it.side;
    const len = Math.hypot(ux, uz);
    if (len > 0) { ux /= len; uz /= len; }

    const p = this.pos, v = this.vel;
    const swim = !this.flying && inWater({ x: p.x, y: p.y + 0.4, z: p.z });
    const speed = (this.flying ? FLY : swim ? 3.2 : WALK) * mag;
    v.x = ux * speed; v.z = uz * speed;
    if (this.flying) {
      v.y = (it.jump ? 8 : 0) - (it.down ? 8 : 0);
    } else if (swim) {
      v.y = Math.max(v.y - 12 * dt, -2.5);
      if (it.jump) v.y = 4.2;
    } else {
      v.y = Math.max(v.y - GRAVITY * dt, -30);
      if (it.jump && this.onGround) v.y = JUMP;
    }

    // move in small steps, one axis at a time
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      let bumped = false;
      p.x += v.x * h;
      if (collides(p.x, p.y, p.z)) {
        p.x = v.x > 0 ? Math.floor(p.x + PW) - PW - 0.001 : Math.floor(p.x - PW) + 1 + PW + 0.001;
        bumped = true;
      }
      p.z += v.z * h;
      if (collides(p.x, p.y, p.z)) {
        p.z = v.z > 0 ? Math.floor(p.z + PW) - PW - 0.001 : Math.floor(p.z - PW) + 1 + PW + 0.001;
        bumped = true;
      }
      p.y += v.y * h;
      const wasOnGround = this.onGround;
      if (collides(p.x, p.y, p.z)) {
        if (v.y < 0) p.y = Math.floor(p.y) + 1;
        else p.y = Math.floor(p.y + PH) - PH - 0.001;
        v.y = 0;
      }
      this.onGround = v.y <= 0 && collides(p.x, p.y - 0.02, p.z);
      // auto-jump up single steps, so little ones don't get stuck
      if (bumped && !this.flying && (wasOnGround || swim) && mag > 0.2
          && !collides(p.x + ux * 0.45, p.y + 1.05, p.z + uz * 0.45)) {
        v.y = swim ? 6.5 : JUMP;
      }
    }
    if (p.y < -5) this.goHome();
    this.syncCamera();

    // holding a button keeps breaking / placing
    if (it !== NO_INPUT) {
      this.breakTimer = this.repeat(it.breakHeld, this.wasBreak, this.breakTimer, dt, () => this.breakBlock());
      this.placeTimer = this.repeat(it.placeHeld, this.wasPlace, this.placeTimer, dt, () => this.placeBlock());
      this.wasBreak = it.breakHeld; this.wasPlace = it.placeHeld;
    }

    this.updateAvatar(dt);
  }
  repeat(held, was, timer, dt, fn) {
    if (!held) return 0;
    if (!was) { fn(); return 0.3; }
    timer -= dt;
    if (timer <= 0) { fn(); return 0.22; }
    return timer;
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  updateAvatar(dt) {
    const a = this.avatar;
    a.root.position.copy(this.pos);
    a.root.rotation.y = this.yaw;
    a.head.rotation.x = this.pitch * 0.8;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const walking = speed > 0.3 && !this.flying;
    this.swing += ((walking ? 1 : 0) - this.swing) * Math.min(1, dt * 10);
    if (walking) this.walkPhase += dt * speed * 2.2;
    const sw = Math.sin(this.walkPhase) * 0.7 * this.swing;
    a.legL.rotation.x = sw; a.legR.rotation.x = -sw;
    a.armL.rotation.x = -sw; a.armR.rotation.x = sw;
  }
  updateHighlight() {
    const hit = playing && this.bagCursor === null ? pickBlock(this.camera) : null;
    this.highlight.visible = !!hit;
    if (hit) {
      const [w, h] = { cube: [1, 1], cross: [0.72, 0.85], flat: [0.8, 0.12] }[BLOCKS[hit.id].shape];
      this.highlight.scale.set(w, h, w);
      this.highlight.position.set(hit.x + 0.5, hit.y + h / 2, hit.z + 0.5);
    }
    this.hud.message = this.bagCursor === null ? this.input.message() : null;
  }
}
