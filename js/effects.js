// Sounds and the bits that fly when a block breaks.
'use strict';

// ---------------------------------------------------------------------------
// Sounds (tiny synth, no files)
// ---------------------------------------------------------------------------
let audio = null;
function initAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { console.warn('No sound available', e); }
}
function playPlace(pitch) {
  if (!audio) return;
  const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(330 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + 0.18);
}
/** A bright two-note chime for putting something in the bag. */
function playCollect(pitch) {
  if (!audio) return;
  const t = audio.currentTime;
  [[660, 0], [990, 0.07]].forEach(([f, at]) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine';
    o.frequency.value = f * pitch;
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.2, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.22);
    o.connect(g).connect(audio.destination);
    o.start(t + at); o.stop(t + at + 0.24);
  });
}
function playBreak(pitch) {
  if (!audio) return;
  const t = audio.currentTime, len = 0.14;
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * len), audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = audio.createBufferSource(); src.buffer = buf;
  const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 * pitch; f.Q.value = 1.2;
  const g = audio.createGain(); g.gain.value = 0.5;
  src.connect(f).connect(g).connect(audio.destination);
  src.start(t);
  // plus a little "pop"
  const o = audio.createOscillator(), og = audio.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(600 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(180 * pitch, t + 0.1);
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(og).connect(audio.destination);
  o.start(t); o.stop(t + 0.13);
}

// ---------------------------------------------------------------------------
// Particles when a block breaks
// ---------------------------------------------------------------------------
const particles = [];
const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
function burst(x, y, z, id) {
  const mat = new THREE.MeshBasicMaterial({ color: BLOCKS[id].color, transparent: true });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(particleGeo, mat);
    m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4);
    m.userData.life = 0.6 + Math.random() * 0.3;
    scene.add(m);
    particles.push(m);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
      if (!particles.some(q => q.material === p.material)) p.material.dispose();
      continue;
    }
    p.userData.v.y -= 14 * dt;
    p.position.addScaledVector(p.userData.v, dt);
    if (isSolid(getBlock(Math.floor(p.position.x), Math.floor(p.position.y), Math.floor(p.position.z)))) {
      p.position.y = Math.floor(p.position.y) + 1.07; p.userData.v.set(0, 0, 0);
    }
    p.scale.setScalar(Math.min(1, p.userData.life * 2.5));
  }
}
