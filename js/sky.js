// The time of day: the sun and moon crossing the sky, the stars, and how far the night dims the world.
'use strict';

const DAY_SECONDS = 420, NIGHT_SECONDS = 180;   // a day of play: seven minutes of daylight, three of night
const MORNING = 30;                             // a new world starts here, the sun a little way up
let daySeconds = MORNING;   // seconds into today; 0 is sunrise, DAY_SECONDS sunset
let darkNight = false;      // tonight has no moon and is dark; only a survival world gets one

const DAY = { light: new THREE.Color(1, 1, 1), sky: SKY };
const DUSK = { light: new THREE.Color(1, 0.8, 0.66), sky: new THREE.Color('#f29a6c') };
const GENTLE_NIGHT = { light: new THREE.Color(0.2, 0.24, 0.4), sky: new THREE.Color('#1c2c5e') };
const DARK_NIGHT = { light: new THREE.Color(0.035, 0.04, 0.07), sky: new THREE.Color('#04060d') };
const DUSK_AT = 0.35;       // the nightness where the sky is at its most orange

const sunDir = new THREE.Vector3();
const daylight = new THREE.Color(1, 1, 1);   // what every lit colour is multiplied by, now
// what renderViews fills the distance with: `color` in the open air, `water` under water
const skyFog = { color: SKY.clone(), water: UNDERWATER.clone(), near: 45, far: 130 };
let nightness = 0;          // 0 in daylight, 1 once the sun is well down

const sun = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: '#fff3a0', fog: false }));
{
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(56, 56),
    new THREE.MeshBasicMaterial({ color: '#fff8d0', transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  glow.position.z = -0.5;
  sun.add(glow);
  scene.add(sun);
}

const moon = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ fog: false }));
{
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#e8edf6'; g.fillRect(0, 0, 16, 16);
  const rnd = mulberry32(7);
  g.fillStyle = '#c3ccdc';
  for (let i = 0; i < 7; i++) {   // craters
    const s = 1 + ((rnd() * 3) | 0);
    g.fillRect((rnd() * (16 - s)) | 0, (rnd() * (16 - s)) | 0, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  moon.material.map = tex;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(42, 42),
    new THREE.MeshBasicMaterial({ color: '#c8d6ff', transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
  glow.position.z = -0.5;
  moon.add(glow);
  scene.add(moon);
}

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
  color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false,
}));
{
  const rnd = mulberry32(5), pos = [];
  for (let i = 0; i < 500; i++) {   // evenly over a sphere, so the ones turning up from below are as many
    const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    pos.push(450 * r * Math.cos(t), 450 * r * Math.sin(t), 450 * z);
  }
  stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(stars);
}

/** Moves the clock on by `dt` seconds; at each noon a survival world (`mayBeDark`) draws whether the coming night is dark. */
function advanceDay(dt, mayBeDark) {
  const before = daySeconds;
  daySeconds = (daySeconds + dt) % (DAY_SECONDS + NIGHT_SECONDS);
  if (before < DAY_SECONDS / 2 && daySeconds >= DAY_SECONDS / 2) darkNight = mayBeDark && Math.random() < 0.5;
}

/** Sets the sun's way, `daylight`, `skyFog` and the scenery's colours from the clock; once a frame. */
function updateSky() {
  const a = daySeconds < DAY_SECONDS ? Math.PI * daySeconds / DAY_SECONDS
    : Math.PI * (1 + (daySeconds - DAY_SECONDS) / NIGHT_SECONDS);
  sunDir.set(Math.cos(a), Math.sin(a), -0.35).normalize();   // east to west, leaning south
  nightness = THREE.MathUtils.smoothstep(-sunDir.y, -0.2, 0.15);
  // day → dusk → night in two steps: blue and orange blended at once only make grey
  const [from, to, k] = nightness < DUSK_AT ? [DAY, DUSK, nightness / DUSK_AT]
    : [DUSK, darkNight ? DARK_NIGHT : GENTLE_NIGHT, (nightness - DUSK_AT) / (1 - DUSK_AT)];
  daylight.copy(from.light).lerp(to.light, k);
  skyFog.color.copy(from.sky).lerp(to.sky, k);
  skyFog.water.copy(UNDERWATER).multiply(daylight);
  skyFog.near = 45 - nightness * (darkNight ? 37 : 12);
  skyFog.far = 130 - nightness * (darkNight ? 95 : 30);
  for (const m of daylitMats) m.color.copy(m.userData.dayColor).multiply(daylight);
  highlightMat.color.setScalar(nightness * (darkNight ? 0.9 : 0.5));   // a black outline vanishes in the dark
  sun.visible = sunDir.y > -0.1;
  moon.visible = !darkNight && sunDir.y < 0.1;
  stars.visible = nightness > 0;
  stars.material.opacity = nightness * (darkNight ? 1 : 0.7);
  stars.rotation.z = a;
}

/** Puts the sun, moon and stars round `camera`, so they stay put however far it walks. */
function placeSky(camera) {
  sun.position.copy(camera.position).addScaledVector(sunDir, 400);
  sun.lookAt(camera.position);
  moon.position.copy(camera.position).addScaledVector(sunDir, -400);
  moon.lookAt(camera.position);
  stars.position.copy(camera.position);
}
