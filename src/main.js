// Emberfall - boot, loop, input, UI wiring
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
}
window.addEventListener('resize', resize);
resize();

const world = new World();
const renderer = new Renderer(ctx);
const sound = new Sound();

const ui = {
  title: document.getElementById('title'),
  over: document.getElementById('over'),
  upgrade: document.getElementById('upgrade'),
  overStats: document.getElementById('over-stats'),
  upCards: document.getElementById('up-cards'),
  best: document.getElementById('best'),
  mute: document.getElementById('mute'),
};

let state = 'title';
let pendingChoices = [];

function showBest() {
  const best = JSON.parse(localStorage.getItem('emberfall_best') || '{}');
  ui.best.textContent = best.banked
    ? `best: ${best.banked} banked, night ${roman(best.nights || 1)}`
    : '';
}
showBest();

function beginGame() {
  sound.ensure();
  world.reset();
  world.phase = 'play';
  state = 'play';
  ui.title.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.upgrade.classList.add('hidden');
  document.body.classList.remove('letterboxed');
  world.toastMsg('the light is your life. it burns.', 3.5);
  setTimeout(() => { if (world.phase === 'play') world.toastMsg('embers bank at the fire. the far ones pay more.', 4); }, 4200);
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
  ui.over.classList.remove('hidden');
  document.body.classList.add('letterboxed');
  showBest();
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
  ui.upgrade.classList.remove('hidden');
  document.body.classList.add('letterboxed');
  sound.chime();
}

function pick(i) {
  const u = pendingChoices[i];
  if (!u) return;
  world.pickUpgrade(u.id);
  ui.upgrade.classList.add('hidden');
  document.body.classList.remove('letterboxed');
  state = 'play';
}

// input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.ensure();
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
  if (state === 'title' || state === 'over') { beginGame(); return; }
  if (state === 'dawn') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 3) pick(n - 1);
    return;
  }
  keys.add(e.key.toLowerCase());
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
  if (state === 'title' || state === 'over') { beginGame(); return; }
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

ui.title.addEventListener('pointerdown', () => beginGame());
ui.over.addEventListener('pointerdown', () => beginGame());

function toggleMute() {
  const m = !sound.muted;
  sound.setMuted(m);
  ui.mute.classList.toggle('muted', m);
}
ui.mute.addEventListener('click', (e) => { e.stopPropagation(); sound.ensure(); toggleMute(); });

// world events -> sound
world.onEvent = (name, data) => {
  if (name === 'pickup') sound.pickup(data);
  else if (name === 'bank') sound.bank();
  else if (name === 'thud') sound.thud();
  else if (name === 'relight') sound.relight();
  else if (name === 'gutterout') sound.thud();
  else if (name === 'dawn') { /* overlay handles chime */ }
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
  if (state === 'over') acc = 0;
  while (acc >= STEP) {
    world.update(STEP);
    acc -= STEP;
    if (world.dead) { world.dead = false; gameOver(); break; }
  }
  if (state === 'play' && world.phase === 'dawn') showDawn();
  // ambience levels
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
