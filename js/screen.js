// Splitting the screen between the players, and joining and leaving.
'use strict';

// ---------------------------------------------------------------------------
// Split screen
// ---------------------------------------------------------------------------
/** Screen rectangles (CSS px, top-left origin) for n players. */
function splitRects(n, W, H) {
  const r = (x, y, w, h) => ({ x, y, w, h });
  if (n <= 1) return [r(0, 0, W, H)];
  const hw = Math.round(W / 2), hh = Math.round(H / 2);
  if (n >= 4) return [r(0, 0, hw, hh), r(hw, 0, W - hw, hh), r(0, hh, hw, H - hh), r(hw, hh, W - hw, H - hh)];
  // two or three players: split side by side or top/bottom, whichever gives views closer to 3:2
  const off = a => Math.abs(Math.log(a / 1.5));
  if (off(hw / H) < off(W / hh)) {
    return n === 2 ? [r(0, 0, hw, H), r(hw, 0, W - hw, H)]
      : [r(0, 0, hw, H), r(hw, 0, W - hw, hh), r(hw, hh, W - hw, H - hh)];
  }
  return n === 2 ? [r(0, 0, W, hh), r(0, hh, W, H - hh)]
    : [r(0, 0, W, hh), r(0, hh, hw, H - hh), r(hw, hh, W - hw, H - hh)];
}
/** Fits the field of view to a view's shape: wide views keep a 16:9 view across, tall ones at least 74°. */
function fitCamera(cam, aspect) {
  const rad = THREE.MathUtils.degToRad;
  let t = Math.tan(rad(36));
  if (aspect > 16 / 9) t = t * (16 / 9) / aspect;
  else t = Math.max(t, Math.tan(rad(37)) / aspect);
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}
function relayout() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H);
  const rects = splitRects(players.length, W, H);
  players.forEach((p, i) => {
    p.rect = rects[i];
    p.hud.layout(rects[i], players.length > 1);
    fitCamera(p.camera, rects[i].w / rects[i].h);
  });
}
addEventListener('resize', relayout);

function renderViews() {
  const H = innerHeight;
  for (const p of players) {
    const r = p.rect, y = H - r.y - r.h;   // WebGL counts from the bottom
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.setScissor(r.x, y, r.w, r.h);
    const liquid = liquidAt(p.camera.position);
    const [color, near, far] = liquid === B.lava ? [IN_LAVA, 0.5, 6] : liquid ? [UNDERWATER, 1, 22] : [SKY, 45, 130];
    scene.fog.color.copy(color);
    scene.background.copy(color);
    scene.fog.near = near;
    scene.fog.far = far;
    sun.position.copy(p.camera.position).addScaledVector(sunDir, 400);
    sun.lookAt(p.camera.position);
    renderer.render(scene, p.camera);
  }
}

// ---------------------------------------------------------------------------
// Joining and leaving
// ---------------------------------------------------------------------------
const hasKeyboardPlayer = () => players.some(p => p.input === keyboard);
const padPlayer = i => players.find(p => p.input instanceof PadInput && p.input.index === i);

function addPlayer(input) {
  if (players.length >= MAX_PLAYERS) return null;
  let slot = 0;
  while (players.some(p => p.slot === slot)) slot++;
  input.reset();
  const p = new Player(slot, input);
  players.push(p);
  players.sort((a, b) => a.slot - b.slot);
  relayout();
  renderMenu();
  return p;
}
function removePlayer(p) {
  if (players.length <= 1) return;   // somebody has to play
  savedSlots[p.slot] = p.snapshot();
  p.dispose();
  players.splice(players.indexOf(p), 1);
  if (p.input === keyboard && document.pointerLockElement === canvas) document.exitPointerLock();
  relayout();
  renderMenu();
}
