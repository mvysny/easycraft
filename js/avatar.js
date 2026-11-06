// A player's body, as the other players see it.
'use strict';

// ---------------------------------------------------------------------------
// Player bodies: a blocky figure in the player's colour, with a name tag that
// shows through walls so kids can find each other.
// ---------------------------------------------------------------------------
const avatarMat = new THREE.MeshBasicMaterial({ vertexColors: true });
function shadedBox(w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const c = new THREE.Color(color);
  const shade = [0.8, 0.8, 1, 0.55, 0.68, 0.68];   // BoxGeometry face order: +x -x +y -y +z -z
  const cols = [];
  for (let f = 0; f < 6; f++) {
    const k = Math.pow(shade[f], 2.2);
    for (let v = 0; v < 4; v++) cols.push(c.r * k, c.g * k, c.b * k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(g, avatarMat);
}
function makeAvatar(slot) {
  const color = PLAYER_COLORS[slot];
  const root = new THREE.Group();
  const limb = (w, h, d, col, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = shadedBox(w, h, d, col);
    m.position.y = -h / 2;
    pivot.add(m);
    root.add(pivot);
    return pivot;
  };
  const legL = limb(0.26, 0.75, 0.28, '#2b3f7a', -0.14, 0.75);
  const legR = limb(0.26, 0.75, 0.28, '#2b3f7a', 0.14, 0.75);
  const body = shadedBox(0.6, 0.72, 0.32, color);
  body.position.y = 1.11;
  root.add(body);
  const armL = limb(0.2, 0.7, 0.22, color, -0.41, 1.45);
  const armR = limb(0.2, 0.7, 0.22, color, 0.41, 1.45);
  const head = new THREE.Group();
  head.position.y = 1.47;
  root.add(head);
  const skull = shadedBox(0.5, 0.5, 0.5, '#f2c79b');
  skull.position.y = 0.25;
  const hair = shadedBox(0.54, 0.14, 0.54, '#5a3a22');
  hair.position.y = 0.49;
  head.add(skull, hair);
  for (const x of [-0.11, 0.11]) {   // the face looks along -z, like the camera
    const eye = shadedBox(0.08, 0.08, 0.02, '#1d2b3a');
    eye.position.set(x, 0.27, -0.255);
    head.add(eye);
  }
  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 128; tagCanvas.height = 64;
  const g = tagCanvas.getContext('2d');
  g.fillStyle = color;
  g.beginPath(); g.roundRect(4, 4, 120, 56, 18); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 40px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`P${slot + 1}`, 64, 34);
  const tagTex = new THREE.CanvasTexture(tagCanvas);
  tagTex.colorSpace = THREE.SRGBColorSpace;
  // the same size on screen near or far, so a friend far away is still easy to spot
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, fog: false, sizeAttenuation: false }));
  tag.position.y = 2.3;
  tag.scale.set(0.12, 0.06, 1);
  tag.renderOrder = 10;
  root.add(tag);
  setLayer(root, AVATAR_LAYER + slot);
  return { root, head, legL, legR, armL, armR, tag };
}
