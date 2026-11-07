// A player's HUD: crosshair, hotbar, toasts and bag, over their part of the screen.
'use strict';

// ---------------------------------------------------------------------------
// Player HUD: crosshair, hotbar, toasts — laid over the player's part of the screen.
// ---------------------------------------------------------------------------
function blockIcon(id) {
  const specimen = specimenIcon(BLOCKS[id].key);   // a mineral looks like the stone, not a block
  if (specimen) return specimen;
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const b = BLOCKS[id];
  if (b.shape !== 'cube') {   // the picture itself, big
    const t = b.shape === 'flat' ? b.top : b.side;
    g.drawImage(atlasCanvas, (t % ATLAS_COLS) * TILE, Math.floor(t / ATLAS_COLS) * TILE, TILE, TILE, 4, 4, 40, 40);
    return c.toDataURL();
  }
  if (b.liquid) g.globalAlpha = 0.75;
  const face = (tile, a, bb, cc, d, e, f, dark) => {
    const sx = (tile % ATLAS_COLS) * TILE, sy = Math.floor(tile / ATLAS_COLS) * TILE;
    g.setTransform(a, bb, cc, d, e, f);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
    if (dark) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = `rgba(0,0,0,${dark})`;
      g.fillRect(0, 0, TILE, TILE);
    }
  };
  const k = 1 / TILE;
  face(b.side, 20 * k, 10 * k, 0, 22 * k, 4, 13, 0.18);   // left
  face(b.side, 20 * k, -10 * k, 0, 22 * k, 24, 23, 0.32); // right
  face(b.top, 20 * k, -10 * k, 20 * k, 10 * k, 4, 13, 0); // top
  return c.toDataURL();
}
const ICONS = BLOCKS.map(b => b && blockIcon(b.id));

/** An icon in a hotbar slot or bag cell; a find the player has found shows how many they have. */
function fillCell(el, id, bag) {
  el.replaceChildren();
  const img = document.createElement('img');
  img.src = ICONS[id]; img.alt = BLOCKS[id].name;
  el.appendChild(img);
  if (bag.has(id)) {
    const n = document.createElement('b'); n.textContent = bag.get(id) || 0; el.appendChild(n);
  }
}

class Hud {
  constructor(slot, input) {
    this.input = input;
    const el = this.el = document.createElement('div');
    el.className = 'hud';
    el.style.setProperty('--pc', PLAYER_COLORS[slot]);
    el.innerHTML = `<div class="top"><div class="tag">P${slot + 1}</div><div class="badge">✈️ Flying!</div></div>
      <div class="help">${input.bagKey} = bag · ${input.menuKey} = menu</div>
      <div class="crosshair"></div><div class="msg"></div><div class="toast"></div><div class="hotbar"></div>
      <div class="bag"><h3>🎒 Bag</h3>
        <h4>🧱 Build with</h4><div class="grid blocks"></div>
        <h4>✨ Found</h4><div class="grid finds"></div>
        <div class="name"></div><div class="keys">${input.bagKeys}</div></div>`;
    this.bar = el.querySelector('.hotbar');
    this.toastEl = el.querySelector('.toast');
    this.badgeEl = el.querySelector('.badge');
    this.msgEl = el.querySelector('.msg');
    this.bagEl = el.querySelector('.bag');
    this.bagName = el.querySelector('.bag .name');
    const grids = [el.querySelector('.grid.blocks'), el.querySelector('.grid.finds')];
    this.cells = BAG_ITEMS.map((id, i) => {
      const c = document.createElement('div');
      c.className = 'cell';
      grids[i < HOTBAR.length ? 0 : 1].appendChild(c);
      return c;
    });
    this.toastTimer = 0;
    this.shownMessage = null;
    document.body.appendChild(el);
  }
  /** Redraws the hotbar: `hotbar` holds a block id per slot, `bag` counts the finds. */
  showHotbar(hotbar, bag) {
    while (this.bar.children.length < hotbar.length) this.bar.appendChild(document.createElement('div'));
    hotbar.forEach((id, i) => {
      const s = this.bar.children[i];
      fillCell(s, id, bag);
      s.className = 'slot' + (isFind(id) && !bag.get(id) ? ' empty' : '') + (i === this.selected ? ' sel' : '');
      if (this.input === keyboard && i < 10) {
        const n = document.createElement('span'); n.textContent = (i + 1) % 10; s.appendChild(n);
      }
    });
  }
  /** Highlights hotbar slot `i`. */
  showSelected(i) {
    this.selected = i;
    [...this.bar.children].forEach((el, j) => el.classList.toggle('sel', j === i));
  }
  /** Flashes a short line above the hotbar. */
  toast(text, ms = 900) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
  /** Shows the bag with the cursor on `BAG_ITEMS[cursor]`, or hides it when `cursor` is null. */
  showBag(cursor, bag) {
    this.bagEl.classList.toggle('show', cursor !== null);
    if (cursor === null) return;
    BAG_ITEMS.forEach((id, i) => {
      fillCell(this.cells[i], id, bag);
      this.cells[i].className = 'cell' + (isFind(id) && !bag.has(id) ? ' unknown' : '') + (i === cursor ? ' cur' : '');
    });
    const id = BAG_ITEMS[cursor];
    const find = FINDS.find(f => f.id === id);
    this.bagName.textContent = !find ? BLOCKS[id].name
      : (bag.has(id) ? `${BLOCKS[id].name} × ${bag.get(id)}` : `Not found yet — ${find.hint}`)
        + (find.rarity ? ` (${find.rarity})` : '');
  }
  set flying(on) { this.badgeEl.classList.toggle('show', on); }
  set message(text) {
    if (text === this.shownMessage) return;
    this.shownMessage = text;
    this.msgEl.textContent = text || '';
    this.msgEl.classList.toggle('show', !!text);
  }
  layout(r, split) {
    Object.assign(this.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    this.el.classList.toggle('split', split);
  }
  dispose() { clearTimeout(this.toastTimer); this.el.remove(); }
}
