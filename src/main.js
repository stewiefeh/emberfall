// Emberfall - boot, loop, input, menu wiring
import { World, roman } from './world.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resize);
resize();

const world = new World();
const renderer = new Renderer(ctx);
const sound = new Sound();

// settings
const SETTINGS_KEY = 'emberfall_settings';
let settings = Object.assign(
  { sound: true, shake: true, grain: true, toasts: true },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
);
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function applySettings() {
  sound.setMuted(!settings.sound);
  document.getElementById('mute').classList.toggle('muted', !settings.sound);
  world.shakeEnabled = settings.shake;
  world.toastsEnabled = settings.toasts;
  renderer.grainEnabled = settings.grain;
}
applySettings();

const ui = {};
for (const id of ['menu', 'howto', 'settings', 'pause', 'upgrade', 'over', 'over-stats',
  'up-cards', 'best', 'mute', 'pausebtn', 'btn-begin', 'btn-howto', 'btn-settings',
  'btn-howto-back', 'btn-settings-back', 'btn-resume', 'btn-pause-settings',
  'btn-quit', 'btn-again', 'btn-over-menu']) {
  ui[id] = document.getElementById(id);
}

let state = 'menu';          // menu | howto | settings | play | paused | dawn | over
let settingsReturn = 'menu'; // where the settings panel goes back to
let pendingChoices = [];

function showBest() {
  const best = JSON.parse(localStorage.getItem('emberfall_best') || '{}');
  ui.best.textContent = best.banked
    ? `best: ${best.banked} banked, night ${roman(best.nights || 1)}`
    : '';
}
showBest();

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function toMenu() {
  state = 'menu';
  hide(ui.howto); hide(ui.settings); hide(ui.pause); hide(ui.upgrade); hide(ui.over);
  show(ui.menu);
  document.body.classList.add('letterboxed');
  document.body.classList.remove('playing');
  world.phase = 'title';
  showBest();
}

function beginGame() {
  sound.ensure();
  world.reset();
  world.phase = 'play';
  state = 'play';
  hide(ui.menu); hide(ui.over); hide(ui.pause); hide(ui.upgrade); hide(ui.howto); hide(ui.settings);
  document.body.classList.remove('letterboxed');
  document.body.classList.add('playing');
  world.toastMsg('the light is your life. it burns.', 3.5);
  setTimeout(() => {
    if (world.phase === 'play' && state === 'play') {
      world.toastMsg('embers bank at the fire. the far ones pay more.', 4);
    }
  }, 4200);
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'paused';
  show(ui.pause);
  document.body.classList.add('letterboxed');
}

function resumeGame() {
  state = 'play';
  hide(ui.pause);
  document.body.classList.remove('letterboxed');
}

function gameOver() {
  state = 'over';
  sound.boom();
  const best = world.saveBest();
  const lost = world.carried;
  ui.overStats.innerHTML = `
    <div class="line">SURVIVED TO NIGHT <b>${roman(world.night)}</b></div>
    <div class="line">EMBERS BANKED <b>${world.banked}</b></div>
    <div class="line">EMBERS LOST TO THE DARK <b>${lost}</b></div>
    ${best.newBest ? '<div class="newbest">a new best. the fire remembers.</div>' : ''}
  `;
  show(ui.over);
  document.body.classList.add('letterboxed');
  document.body.classList.remove('playing');
  showBest();
}

function openSettings(from) {
  settingsReturn = from;
  state = 'settings';
  hide(ui.menu); hide(ui.pause);
  show(ui.settings);
}

function closeSettings() {
  hide(ui.settings);
  if (settingsReturn === 'pause') { state = 'paused'; show(ui.pause); }
  else { state = 'menu'; show(ui.menu); }
}

function openHowto() {
  state = 'howto';
  hide(ui.menu);
  show(ui.howto);
}

function closeHowto() {
  hide(ui.howto);
  state = 'menu';
  show(ui.menu);
}

function showDawn() {
  state = 'dawn';
  pendingChoices = world.dawnChoices();
  ui.upCards.innerHTML = '';
  pendingChoices.forEach((u, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = `<span class="key">${i + 1}</span><h3>${u.name}</h3><p>${u.desc}</p>`;
    b.addEventListener('click', () => pick(i));
    ui.upCards.appendChild(b);
  });
  show(ui.upgrade);
  document.body.classList.add('letterboxed');
  sound.chime();
}

function pick(i) {
  const u = pendingChoices[i];
  if (!u) return;
  world.pickUpgrade(u.id);
  hide(ui.upgrade);
  document.body.classList.remove('letterboxed');
  state = 'play';
}

// buttons
ui.btnBegin.addEventListener('click', () => beginGame());
ui.btnHowto.addEventListener('click', () => openHowto());
ui.btnHowtoBack.addEventListener('click', () => closeHowto());
ui.btnSettings.addEventListener('click', () => openSettings('menu'));
ui.btnSettingsBack.addEventListener('click', () => closeSettings());
ui.btnResume.addEventListener('click', () => resumeGame());
ui.btnPauseSettings.addEventListener('click', () => openSettings('pause'));
ui.btnQuit.addEventListener('click', () => toMenu());
ui.btnAgain.addEventListener('click', () => beginGame());
ui.btnOverMenu.addEventListener('click', () => toMenu());
ui.pausebtn.addEventListener('click', () => { sound.ensure(); pauseGame(); });

// settings toggles
for (const el of document.querySelectorAll('.toggle')) {
  const key = el.dataset.setting;
  el.classList.toggle('on', !!settings[key]);
  el.parentElement.addEventListener('click', () => {
    settings[key] = !settings[key];
    el.classList.toggle('on', settings[key]);
    saveSettings();
    applySettings();
    sound.ensure();
    sound.blip(settings[key] ? 523 : 392, 0.12, 0.08);
  });
}

function toggleSound() {
  settings.sound = !settings.sound;
  saveSettings();
  applySettings();
  for (const el of document.querySelectorAll('.toggle')) {
    if (el.dataset.setting === 'sound') el.classList.toggle('on', settings.sound);
  }
  sound.ensure();
}
ui.mute.addEventListener('click', (e) => { e.stopPropagation(); sound.ensure(); toggleSound(); });

// input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.ensure();
  const k = e.key.toLowerCase();
  if (k === 'm' && state !== 'dawn') { toggleSound(); return; }
  if (k === 'escape') {
    if (state === 'play') pauseGame();
    else if (state === 'paused') resumeGame();
    else if (state === 'howto') closeHowto();
    else if (state === 'settings') closeSettings();
    return;
  }
  if (state === 'menu' && (k === 'enter' || k === ' ')) { beginGame(); return; }
  if (state === 'over' && k === 'enter') { beginGame(); return; }
  if (state === 'paused' && (k === 'enter' || k === ' ')) { resumeGame(); return; }
  if (state === 'dawn') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 3) pick(n - 1);
    return;
  }
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function readKeys() {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (touch.active) { x += touch.dx; y += touch.dy; }
  world.inX = x; world.inY = y;
}

const touch = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
canvas.addEventListener('pointerdown', (e) => {
  sound.ensure();
  if (state !== 'play') return;
  touch.active = true; touch.id = e.pointerId;
  touch.ox = e.clientX; touch.oy = e.clientY;
  touch.dx = 0; touch.dy = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (!touch.active || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.ox, dy = e.clientY - touch.oy;
  const m = Math.hypot(dx, dy);
  const dead = 14, max = 60;
  if (m < dead) { touch.dx = 0; touch.dy = 0; }
  else {
    const f = Math.min(1, (m - dead) / max) / m;
    touch.dx = dx * f; touch.dy = dy * f;
  }
});
const endTouch = () => { touch.active = false; touch.dx = 0; touch.dy = 0; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// world events -> sound
world.onEvent = (name, data) => {
  if (name === 'pickup') sound.pickup(data);
  else if (name === 'bank') sound.bank();
  else if (name === 'thud') sound.thud();
  else if (name === 'relight') sound.relight();
  else if (name === 'gutterout') sound.thud();
};

// main loop: fixed timestep
const STEP = 1 / 60;
let acc = 0, last = performance.now();
function frame(t) {
  let dt = (t - last) / 1000;
  last = t;
  dt = Math.min(dt, 0.25);
  acc += dt;
  readKeys();
  const frozen = state === 'over' || state === 'paused' || state === 'settings' || state === 'howto';
  if (frozen) acc = 0;
  while (acc >= STEP) {
    world.update(STEP);
    acc -= STEP;
    if (world.dead) { world.dead = false; gameOver(); break; }
  }
  if (state === 'play' && world.phase === 'dawn') showDawn();
  const campProx = Math.max(0, 1 - Math.hypot(world.player.x - 1300, world.player.y - 900) / 600);
  let burning = 0;
  for (const s of world.shades) {
    const li = world.lightIntensityAt(s.x, s.y);
    if (li > 0.12) burning = Math.max(burning, li);
  }
  sound.ambience(state === 'play' || state === 'dawn' ? campProx : 1, state === 'play' ? burning : 0);

  renderer.draw(world, cw, ch, dpr, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.body.classList.add('letterboxed');
world.phase = 'title';
