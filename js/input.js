// Input sources: the keyboard and mouse, and the controllers.
'use strict';

// ---------------------------------------------------------------------------
// Input. Each player reads one input source per frame into the same shape:
// movement, look deltas, held buttons, a direction for moving around the bag
// (navX right, navY down, each -1..1) and one-shot actions.
// Actions: a hotbar slot number, 'prev'/'next' (slot), 'left'/'right'/'up'/'down'
// (a d-pad press), 'fly', 'home', 'bag', 'ok', 'back', 'break', 'place'.
// ---------------------------------------------------------------------------
const NO_INPUT = Object.freeze({
  fwd: 0, side: 0, yaw: 0, pitch: 0, jump: false, down: false, breakHeld: false, placeHeld: false,
  navX: 0, navY: 0, actions: [],
});

let playing = false;
let dragLook = false;   // fallback when the browser refuses pointer lock

/** The one keyboard-and-mouse player's input; the DOM handlers further down feed it. */
class KeyboardInput {
  constructor() { this.reset(); }
  get label() { return '⌨️ Keyboard & mouse'; }
  get detail() { return ''; }
  get menuKey() { return 'Esc'; }
  get bagKey() { return 'E'; }
  get bagKeys() { return '←↑↓→ pick · Space = hold it · E = close'; }
  reset() { this.keys = {}; this.buttons = [false, false, false]; this.actions = []; this.mdx = 0; this.mdy = 0; }
  /** A hint for this player's screen, or null. */
  message() {
    return playing && !dragLook && document.pointerLockElement !== canvas ? '🖱️ Click here to look around with the mouse' : null;
  }
  read(dt) {
    const k = this.keys;
    const it = {
      fwd: (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0),
      side: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      yaw: ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * 2.3 * dt - this.mdx * 0.0024,
      pitch: -this.mdy * 0.0024,
      jump: !!k.Space, down: !!(k.ShiftLeft || k.ShiftRight),
      breakHeld: this.buttons[0], placeHeld: this.buttons[2],
      navX: (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
      navY: (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0),
      actions: this.actions,
    };
    this.actions = []; this.mdx = 0; this.mdy = 0;
    return it;
  }
}
const keyboard = new KeyboardInput();

// Gamepad buttons in the browser's "standard" layout (Xbox names; PlayStation: A=✕, B=○, X=□, Y=△).
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
/** Polls every connected gamepad once per frame, so "pressed" means "went down this frame". */
const Pads = {
  now: new Map(), prev: new Map(),
  poll() {
    this.prev = new Map([...this.now].map(([i, s]) => [i, s.down]));
    this.now = new Map();
    let list = [];
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; }
    catch (e) { console.warn('Gamepads are not available', e); }
    for (const pad of list) {
      if (pad && pad.connected) this.now.set(pad.index, { pad, down: pad.buttons.map(b => b.pressed || b.value > 0.5) });
    }
  },
  connected(i) { return this.now.has(i); },
  id(i) { return this.now.get(i)?.pad.id ?? ''; },
  down(i, b) { return !!this.now.get(i)?.down[b]; },
  pressed(i, b) { return this.down(i, b) && !this.prev.get(i)?.[b]; },
  axis(i, a) { return this.now.get(i)?.pad.axes[a] ?? 0; },
  indices() { return [...this.now.keys()]; },
};

/** A controller player's input: one gamepad, by its browser index. */
class PadInput {
  constructor(index) { this.index = index; }
  get label() { return `🎮 Controller ${this.index + 1}`; }
  get detail() { return Pads.id(this.index); }
  get menuKey() { return 'Start'; }
  get bagKey() { return 'X'; }
  get bagKeys() { return 'Stick pick · A = hold it · B = close'; }
  reset() {}
  message() { return Pads.connected(this.index) ? null : '🎮 Controller unplugged! Plug it back in.'; }
  read(dt) {
    const i = this.index;
    if (!Pads.connected(i)) return NO_INPUT;
    const stick = (ax, ay) => {   // round dead zone, then rescale so movement starts from zero
      const x = Pads.axis(i, ax), y = Pads.axis(i, ay), m = Math.hypot(x, y), DEAD = 0.18;
      if (m < DEAD) return [0, 0];
      const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
      return [x * k, y * k];
    };
    const [lx, ly] = stick(0, 1), [rx, ry] = stick(2, 3);
    const curve = v => v * Math.abs(v);   // fine aiming near the centre, fast turns at the edge
    const actions = [];
    if (Pads.pressed(i, PAD.Y)) actions.push('fly');
    if (Pads.pressed(i, PAD.BACK)) actions.push('home');
    if (Pads.pressed(i, PAD.X)) actions.push('bag');
    if (Pads.pressed(i, PAD.A)) actions.push('ok');
    if (Pads.pressed(i, PAD.B)) actions.push('back');
    if (Pads.pressed(i, PAD.LB)) actions.push('prev');
    if (Pads.pressed(i, PAD.RB)) actions.push('next');
    for (const d of ['left', 'right', 'up', 'down']) if (Pads.pressed(i, PAD[d.toUpperCase()])) actions.push(d);
    return {
      fwd: -ly, side: lx,
      yaw: -curve(rx) * 3.0 * dt, pitch: -curve(ry) * 2.2 * dt,
      jump: Pads.down(i, PAD.A), down: Pads.down(i, PAD.B),
      breakHeld: Pads.down(i, PAD.RT), placeHeld: Pads.down(i, PAD.LT),
      navX: lx, navY: ly,
      actions,
    };
  }
}

// ---------------------------------------------------------------------------
// Keyboard and mouse (they drive the keyboard player, if there is one)
// ---------------------------------------------------------------------------
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) dragLook = false;
  else if (playing) pause();
});
addEventListener('keydown', e => {
  if (!playing) return;
  if (e.code === 'Escape') { if (document.pointerLockElement !== canvas) pause(); return; }
  if (!hasKeyboardPlayer()) return;
  keyboard.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (/^Digit\d$/.test(e.code)) { const n = +e.code.slice(5); keyboard.actions.push(n === 0 ? 9 : n - 1); }
  if (e.code === 'KeyF') keyboard.actions.push('fly');
  if (e.code === 'KeyH') keyboard.actions.push('home');
  if (e.code === 'KeyE') keyboard.actions.push('bag');
  if (['Space', 'Enter', 'NumpadEnter'].includes(e.code)) keyboard.actions.push('ok');
});
addEventListener('keyup', e => { keyboard.keys[e.code] = false; });
addEventListener('blur', () => { keyboard.keys = {}; keyboard.buttons = [false, false, false]; });

let dragStart = null;
canvas.addEventListener('mousedown', e => {
  if (!playing || !hasKeyboardPlayer()) return;
  if (document.pointerLockElement === canvas) { keyboard.buttons[e.button] = true; return; }
  if (dragLook) { dragStart = { moved: 0, button: e.button }; return; }
  requestLock();
});
addEventListener('mouseup', e => {
  keyboard.buttons[e.button] = false;
  if (dragLook && dragStart && playing) {
    if (dragStart.moved < 6) keyboard.actions.push(dragStart.button === 0 ? 'break' : 'place');
    dragStart = null;
  }
});
addEventListener('mousemove', e => {
  if (!playing) return;
  if (document.pointerLockElement === canvas) { keyboard.mdx += e.movementX; keyboard.mdy += e.movementY; }
  else if (dragLook && dragStart) {
    keyboard.mdx += e.movementX; keyboard.mdy += e.movementY;
    dragStart.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (playing && hasKeyboardPlayer()) keyboard.actions.push(e.deltaY > 0 ? 'next' : 'prev');
}, { passive: true });
