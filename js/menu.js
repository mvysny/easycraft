// The menu: playing, pausing, players, a new world.
'use strict';

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
const overlay = document.getElementById('overlay');
const $ = id => document.getElementById(id);

function showPage(name) {
  $('page-main').classList.toggle('hidden', name !== 'main');
  $('page-players').classList.toggle('hidden', name !== 'players');
}
function renderMenu() {
  $('chips').innerHTML = '';
  for (const p of players) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.style.setProperty('--pc', PLAYER_COLORS[p.slot]);
    c.textContent = p.input === keyboard ? '⌨️' : '🎮';
    $('chips').appendChild(c);
  }
  const slots = $('slots');
  slots.innerHTML = '';
  for (let s = 0; s < MAX_PLAYERS; s++) {
    const p = players.find(q => q.slot === s);
    const card = document.createElement('div');
    card.className = 'pcard' + (p ? '' : ' empty');
    card.style.setProperty('--pc', PLAYER_COLORS[s]);
    const line = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; card.appendChild(d); };
    line('pname', `Player ${s + 1}`);
    if (p) {
      line('pinput', p.input.label);
      if (p.input.detail) line('pid', p.input.detail);
      if (players.length > 1) {
        const x = document.createElement('button');
        x.className = 'btn small'; x.textContent = '✕ Leave';
        x.addEventListener('click', () => removePlayer(p));
        card.appendChild(x);
      }
    } else {
      line('pinput', '🎮 Press A / ✕ on a controller to join');
      if (!hasKeyboardPlayer()) {
        const k = document.createElement('button');
        k.className = 'btn small'; k.textContent = '⌨️ Use keyboard & mouse';
        k.addEventListener('click', () => addPlayer(keyboard));
        card.appendChild(k);
      }
    }
    slots.appendChild(card);
  }
  const n = Pads.indices().length;
  $('padinfo').textContent = n
    ? `🎮 ${n} controller${n > 1 ? 's' : ''} found. Press Start to play!`
    : 'No controllers found yet. Plug one in with USB and press any button on it.';
}

function startPlaying(userGesture) {
  initAudio();
  playing = true;
  overlay.classList.add('hidden');
  document.activeElement?.blur();
  // Pointer lock needs a click; started from a controller, the keyboard player clicks the screen instead.
  if (hasKeyboardPlayer() && userGesture) requestLock();
}
function requestLock() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(e => { console.info('Pointer lock refused, drag the mouse to look around', e); dragLook = true; });
  } catch (e) {
    console.info('Pointer lock not available, drag the mouse to look around', e);
    dragLook = true;
  }
}
function pause() {
  playing = false;
  keyboard.reset();
  for (const p of players) if (p.bagCursor !== null) p.closeBag();
  $('play').textContent = 'Keep playing!';
  $('tagline').textContent = 'Taking a break 😊';
  showPage('main');
  renderMenu();
  overlay.classList.remove('hidden');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  saveWorld();
}
$('play').addEventListener('click', () => startPlaying(true));
$('players-btn').addEventListener('click', () => { renderMenu(); showPage('players'); });
$('players-done').addEventListener('click', () => showPage('main'));
$('newworld').addEventListener('click', e => {
  e.currentTarget.blur();
  if (confirm('Make a brand new world? Your current world will be gone.')) newWorld();
});

/** Controllers in the menu: A joins, B leaves, Start plays. While playing, Start opens the menu. */
let padSignature = '';
function handlePadsForMenu() {
  for (const i of Pads.indices()) {
    const owner = padPlayer(i);
    if (playing) {
      if (Pads.pressed(i, PAD.START)) pause();
      continue;
    }
    if (!owner && (Pads.pressed(i, PAD.A) || Pads.pressed(i, PAD.START))) {
      if (addPlayer(new PadInput(i))) { initAudio(); playPlace(1.5); }
    } else if (owner && Pads.pressed(i, PAD.START)) {
      startPlaying(false);
    } else if (owner && Pads.pressed(i, PAD.B)) {
      removePlayer(owner);
    }
  }
  const sig = Pads.indices().join();
  if (sig !== padSignature) { padSignature = sig; renderMenu(); }
}
