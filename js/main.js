// Starts the game and runs the frame loop. Loaded last.
'use strict';

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
if (!loadWorld()) { generateWorld((Math.random() * 1e9) | 0); findHome(); }
rebuildAll();
addPlayer(keyboard);
saveWorld();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  Pads.poll();
  handlePadsForMenu();
  if (playing) for (const p of players) p.update(dt);

  // rebuild a few changed chunks per frame
  let n = 0;
  for (const i of dirtyChunks) { rebuildChunk(i); dirtyChunks.delete(i); if (++n >= 4) break; }

  for (const p of players) p.updateHighlight();
  for (const c of clouds.children) {
    c.position.x += dt * 1.2;
    if (c.position.x > SX + 130) c.position.x -= SX + 260;
  }
  updateParticles(dt);
  renderViews();
  requestAnimationFrame(frame);
}
frame();

// debug/test hook
window.easycraft = {
  players, keyboard, Pads, PadInput, addPlayer, removePlayer, startPlaying, pause, newWorld, getBlock, changeBlock, B, BLOCKS,
  ICONS, FINDS, SX, SY, SZ,
};
