// Emberfall - world simulation
export const WORLD = { w: 2600, h: 1800 };
export const CAMP = { x: WORLD.w / 2, y: WORLD.h / 2, r: 115, light: 250 };

export const LANDMARKS = [
  { x: CAMP.x - 960, y: CAMP.y - 620, type: 'pine' },
  { x: CAMP.x + 980, y: CAMP.y - 520, type: 'tower' },
  { x: CAMP.x + 920, y: CAMP.y + 640, type: 'boulder' },
  { x: CAMP.x - 900, y: CAMP.y + 610, type: 'arch' },
];

const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const lerp = (a, b, t) => a + (b - a) * t;

export function roman(n) {
  const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '', v = n;
  for (const [val, sym] of map) { while (v >= val) { out += sym; v -= val; } }
  return out || 'I';
}

export const UPGRADES = [
  { id: 'wicks', name: 'Deep Wicks', desc: 'The torch holds more. Twenty-five more fuel.' },
  { id: 'wide', name: 'Wide Flame', desc: 'Light reaches further. Eighteen percent more radius.' },
  { id: 'blood', name: 'Hot Blood', desc: 'Shades burn faster in your light.' },
  { id: 'swift', name: 'Swift Stride', desc: 'You move quicker through the dark.' },
  { id: 'sense', name: 'Ember Sense', desc: 'Embers drift toward you from further off.' },
  { id: 'kindle', name: 'Kindling', desc: 'Shades that burn down leave more fuel behind.' },
];

// noise helper (smooth 1d)
function makeNoise() {
  const t = rand(1000);
  return (x) => (Math.sin(x * 1.7 + t) * 0.5 + Math.sin(x * 3.1 + t * 1.3) * 0.3 + Math.sin(x * 5.3 + t * 2.1) * 0.2);
}

export class World {
  constructor() {
    this.inX = 0; this.inY = 0;
    this.onEvent = () => {};
    this.reset();
  }

  emit(name, data) { this.onEvent(name, data); }

  reset() {
    this.phase = 'title';
    this.time = 0;
    this.noise = makeNoise();
    this.player = { x: CAMP.x, y: CAMP.y + 60, vx: 0, vy: 0, r: 14, speed: 250, walkT: 0 };
    this.fuel = 100; this.fuelMax = 100; this.wideMult = 1; this.burnMult = 1;
    this.speedMult = 1; this.sense = 0; this.kindle = 0;
    this.lit = true; this.torchOut = false; this.graceT = 0;
    this.carried = 0; this.banked = 0;
    this.night = 1; this.nightT = 0; this.nightLength = 55;
    this.spawnT = 2.5; this.dawnT = 0;
    this.shades = []; this.embers = []; this.particles = []; this.ash = [];
    this.cam = { x: CAMP.x, y: CAMP.y };
    this.shake = 0; this.toast = null; this.flash = 0;
    this.dead = false; this.deathCause = '';
    this.shakeEnabled = true; this.toastsEnabled = true;
    for (let i = 0; i < 110; i++) {
      this.ash.push({ x: rand(WORLD.w), y: rand(WORLD.h), s: rand(0.7, 2.4), v: rand(9, 26), p: rand(TAU) });
    }
    for (let i = 0; i < 16; i++) this.spawnEmber(true);
    this.emit('stats');
  }

  get torchRadius() {
    if (!this.lit) return 0;
    const base = 70 + this.fuel * 1.5;
    const flick = 1 + this.noise(this.time * 6) * 0.045;
    const low = this.fuel < this.fuelMax * 0.22 ? 1 - this.noise(this.time * 11) * 0.12 : 1;
    return clamp(base * this.wideMult * flick * low, 40, 360);
  }

  lightIntensityAt(x, y) {
    let v = 0;
    if (this.lit) {
      const d = dist(x, y, this.player.x, this.player.y);
      v = Math.pow(Math.max(0, 1 - d / this.torchRadius), 1.6);
    }
    const dc = dist(x, y, CAMP.x, CAMP.y);
    v = Math.max(v, Math.pow(Math.max(0, 1 - dc / CAMP.light), 1.8) * 1.1);
    return v;
  }

  toastMsg(text, life = 3.2) { if (!this.toastsEnabled) return; this.toast = { text, t: 0, life }; }

  spawnEmber(initial = false) {
    let x, y, tries = 0;
    do {
      const a = rand(TAU), d = 300 + Math.pow(Math.random(), 0.8) * 1150;
      x = clamp(CAMP.x + Math.cos(a) * d, 90, WORLD.w - 90);
      y = clamp(CAMP.y + Math.sin(a) * d, 90, WORLD.h - 90);
      tries++;
    } while (tries < 8 && this.embers.some(e => dist(e.x, e.y, x, y) < 140));
    const d = dist(x, y, CAMP.x, CAMP.y);
    const value = Math.round(3 + clamp((d - 300) / 1050, 0, 1) * 13);
    this.embers.push({ x, y, value, bob: rand(TAU), born: initial ? -1 : this.time });
  }

  spawnShade() {
    const edge = Math.floor(rand(4));
    let x, y;
    if (edge === 0) { x = rand(WORLD.w); y = 30; }
    else if (edge === 1) { x = WORLD.w - 30; y = rand(WORLD.h); }
    else if (edge === 2) { x = rand(WORLD.w); y = WORLD.h - 30; }
    else { x = 30; y = rand(WORLD.h); }
    this.shades.push({
      x, y, r: rand(15, 19), hp: 18 + this.night * 5, speed: Math.min(95, 42 + this.night * 3.5),
      seed: rand(TAU), lungeT: rand(2.5, 6), lunge: 0, alpha: 1, fleeing: false, dir: rand(TAU),
    });
  }

  update(dt) {
    this.time += dt;
    for (const a of this.ash) {
      a.y += a.v * dt; a.x += Math.sin(this.time * 0.4 + a.p) * 8 * dt;
      if (a.y > WORLD.h + 10) { a.y = -10; a.x = rand(WORLD.w); }
    }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > this.toast.life) this.toast = null; }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (!this.shakeEnabled) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.updateParticles(dt);
    this.updateCampfireFx(dt);

    if (this.phase === 'title') { this.idleCamera(dt); return; }
    this.updatePlayer(dt);
    this.updateTorch(dt);
    this.updateShades(dt);
    this.updateEmbers(dt);
    this.updateCamera(dt);

    if (this.phase === 'play') {
      this.nightT += dt;
      this.spawnT -= dt;
      const interval = clamp(4.2 - this.night * 0.28, 1.15, 4.2);
      if (this.spawnT <= 0) {
        this.spawnT = interval * rand(0.75, 1.25);
        this.spawnShade();
        if (this.night > 3 && Math.random() < 0.35) this.spawnShade();
      }
      if (this.nightT >= this.nightLength) this.enterDawn();
    } else if (this.phase === 'dawn') {
      this.dawnT -= dt;
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    let mx = this.inX, my = this.inY;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    const sp = p.speed * this.speedMult;
    p.vx = lerp(p.vx, mx * sp, 1 - Math.exp(-dt * 10));
    p.vy = lerp(p.vy, my * sp, 1 - Math.exp(-dt * 10));
    p.x = clamp(p.x + p.vx * dt, 40, WORLD.w - 40);
    p.y = clamp(p.y + p.vy * dt, 40, WORLD.h - 40);
    p.walkT += Math.hypot(p.vx, p.vy) * dt * 0.05;
    if (Math.hypot(p.vx, p.vy) > 60 && this.lit && Math.random() < dt * 14) {
      this.addParticle(p.x - p.vx * 0.02, p.y - p.vy * 0.02, rand(-12, 12), rand(-30, -8), rand(0.4, 0.9), 'ember', rand(1.2, 2.2));
    }
  }

  updateTorch(dt) {
    if (this.lit) {
      this.fuel -= 3.3 * dt;
      if (this.fuel <= 0) {
        this.fuel = 0; this.lit = false; this.torchOut = true; this.graceT = 8;
        this.emit('gutterout');
        this.toastMsg('the torch is out. run for the fire.', 4);
      }
    } else {
      this.graceT -= dt;
      if (dist(this.player.x, this.player.y, CAMP.x, CAMP.y) < CAMP.light * 0.8) {
        this.lit = true; this.torchOut = false; this.fuel = this.fuelMax * 0.25;
        this.emit('relight');
        this.toastMsg('the campfire takes you back', 2.6);
      } else if (this.graceT <= 0) {
        this.dead = true; this.deathCause = 'dark';
      }
    }
    if (dist(this.player.x, this.player.y, CAMP.x, CAMP.y) < CAMP.r - 14 && this.lit) {
      if (this.fuel < this.fuelMax) this.fuel = Math.min(this.fuelMax, this.fuel + 13 * dt);
      if (this.carried > 0) {
        this.banked += this.carried;
        this.emit('bank', this.carried);
        this.toastMsg(`banked ${this.carried} embers`, 2.4);
        for (let i = 0; i < 14; i++) {
          this.addParticle(this.player.x, this.player.y, rand(-70, 70), rand(-120, -30), rand(0.5, 1.1), 'gold', rand(1.5, 3));
        }
        this.carried = 0;
      }
    }
  }

  updateShades(dt) {
    const p = this.player;
    for (let i = this.shades.length - 1; i >= 0; i--) {
      const s = this.shades[i];
      const li = this.lightIntensityAt(s.x, s.y);

      if (s.fleeing) {
        s.alpha -= dt * 0.35;
        const dc = dist(s.x, s.y, CAMP.x, CAMP.y);
        s.x += Math.cos(s.dir) * s.speed * 1.4 * dt;
        s.y += Math.sin(s.dir) * s.speed * 1.4 * dt;
        if (s.alpha <= 0 || s.x < -40 || s.x > WORLD.w + 40 || s.y < -40 || s.y > WORLD.h + 40) this.shades.splice(i, 1);
        continue;
      }

      s.lungeT -= dt;
      if (s.lungeT <= 0 && this.lit) {
        const d = dist(s.x, s.y, p.x, p.y);
        if (d < 260) { s.lunge = 0.55; s.lungeT = Math.max(2, rand(3.5, 7) - this.night * 0.12); this.emit('lunge'); }
      }
      const lunging = s.lunge > 0;
      if (lunging) s.lunge -= dt;

      let fx = (p.x - s.x), fy = (p.y - s.y);
      let d = Math.hypot(fx, fy) || 1;
      fx /= d; fy /= d;
      let spd = s.speed * (lunging ? 3 : 1) * (this.torchOut ? 1.5 : 1);

      // repulsion from light sources (not while lunging)
      if (!lunging) {
        if (this.lit) {
          const dl = dist(s.x, s.y, p.x, p.y);
          const R = this.torchRadius;
          if (dl < R && dl > 0.01) {
            const push = Math.pow(1 - dl / R, 1.2) * 105;
            fx -= (p.x - s.x) / dl * push / Math.max(spd, 1);
            fy -= (p.y - s.y) / dl * push / Math.max(spd, 1);
          }
        }
        const dc = dist(s.x, s.y, CAMP.x, CAMP.y);
        const dcamp = CAMP.light + CAMP.r;
        if (dc < dcamp && dc > 0.01) {
          const push = Math.pow(1 - dc / dcamp, 1.4) * 130;
          fx -= (CAMP.x - s.x) / dc * push / Math.max(spd, 1);
          fy -= (CAMP.y - s.y) / dc * push / Math.max(spd, 1);
        }
        const fm = Math.hypot(fx, fy) || 1;
        fx /= fm; fy /= fm;
      }

      // wander so the ring breathes
      fx += Math.sin(this.time * 1.3 + s.seed) * 0.22;
      fy += Math.cos(this.time * 1.1 + s.seed * 2) * 0.22;

      s.x = clamp(s.x + fx * spd * dt, 10, WORLD.w - 10);
      s.y = clamp(s.y + fy * spd * dt, 10, WORLD.h - 10);

      // burning
      if (li > 0.12) {
        const dps = li * 30 * this.burnMult;
        s.hp -= dps * dt;
        if (Math.random() < dt * (4 + li * 22)) {
          this.addParticle(s.x + rand(-6, 6), s.y + rand(-6, 6), rand(-20, 20), rand(-70, -20), rand(0.3, 0.7), 'ember', rand(1, 2.4));
        }
        this.emit('burning', li);
        if (s.hp <= 0) {
          for (let k = 0; k < 12; k++) {
            this.addParticle(s.x, s.y, rand(-90, 90), rand(-130, -20), rand(0.4, 0.9), 'ember', rand(1.4, 3));
          }
          this.fuel = Math.min(this.fuelMax, this.fuel + (2 + this.kindle * 1.5));
          this.emit('shadeburned');
          this.shades.splice(i, 1);
          continue;
        }
      }

      // contact
      const dp = dist(s.x, s.y, p.x, p.y);
      if (dp < s.r + p.r) {
        if (this.lit) {
          for (let k = 0; k < 10; k++) {
            this.addParticle(s.x, s.y, rand(-80, 80), rand(-100, -10), rand(0.4, 0.8), 'ember', rand(1.4, 2.6));
          }
          this.fuel = Math.max(0, this.fuel - 7);
          this.shake = Math.max(this.shake, 0.5);
          this.flash = 0.5;
          this.emit('thud');
          this.shades.splice(i, 1);
          continue;
        }
      }
    }
  }

  updateEmbers(dt) {
    const p = this.player;
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      const d = dist(e.x, e.y, p.x, p.y);
      const pullR = 30 + this.sense * 42;
      if (d < pullR && d > 0.01 && this.lit) {
        const pull = (1 - d / pullR) * 340;
        e.x += (p.x - e.x) / d * pull * dt;
        e.y += (p.y - e.y) / d * pull * dt;
      }
      if (d < 26) {
        this.carried += e.value;
        this.emit('pickup', e.value);
        for (let k = 0; k < 5; k++) {
          this.addParticle(e.x, e.y, rand(-40, 40), rand(-60, -10), rand(0.3, 0.6), 'gold', rand(1, 2));
        }
        this.embers.splice(i, 1);
      }
    }
    const target = 15 + this.night;
    if (this.embers.length < target && Math.random() < dt * 0.8) this.spawnEmber();
  }

  addParticle(x, y, vx, vy, life, kind, size) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push({ x, y, vx, vy, life, max: life, kind, size });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += (pt.kind === 'ember' ? -26 : pt.kind === 'gold' ? -40 : 0) * dt;
      pt.vx *= 1 - dt * 1.2;
    }
  }

  updateCampfireFx(dt) {
    if (Math.random() < dt * 26) {
      this.addParticle(CAMP.x + rand(-8, 8), CAMP.y - 6, rand(-14, 14), rand(-85, -40), rand(0.5, 1.2), 'ember', rand(1.2, 2.6));
    }
  }

  enterDawn() {
    this.phase = 'dawn';
    this.dawnT = 0;
    for (const s of this.shades) {
      s.fleeing = true;
      s.dir = Math.atan2(s.y - CAMP.y, s.x - CAMP.x);
    }
    this.emit('dawn');
  }

  pickUpgrade(id) {
    const u = UPGRADES.find(u => u.id === id);
    if (u) {
      if (u.id === 'wicks') { this.fuelMax += 25; this.fuel += 25; }
      else if (u.id === 'wide') this.wideMult *= 1.18;
      else if (u.id === 'blood') this.burnMult *= 1.35;
      else if (u.id === 'swift') this.speedMult *= 1.12;
      else if (u.id === 'sense') this.sense += 1;
      else if (u.id === 'kindle') this.kindle += 1;
    }
    this.night++;
    this.nightT = 0;
    this.nightLength = Math.min(90, 55 + this.night * 6);
    this.spawnT = 3;
    this.phase = 'play';
    this.emit('nightbegin', this.night);
    this.toastMsg(`night ${roman(this.night)}`, 3);
  }

  dawnChoices() {
    const pool = [...UPGRADES];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picks;
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x + p.vx * 0.32, ty = p.y + p.vy * 0.32;
    const k = 1 - Math.exp(-dt * 4);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
  }

  idleCamera(dt) {
    const t = this.time * 0.08;
    this.cam.x = CAMP.x + Math.cos(t) * 220;
    this.cam.y = CAMP.y + Math.sin(t * 0.8) * 150;
  }

  saveBest() {
    const best = JSON.parse(localStorage.getItem('emberfall_best') || '{}');
    const newBest = this.banked > (best.banked || 0) || this.night > (best.nights || 0);
    const out = {
      banked: Math.max(this.banked, best.banked || 0),
      nights: Math.max(this.night, best.nights || 0),
    };
    localStorage.setItem('emberfall_best', JSON.stringify(out));
    return { newBest, ...out };
  }
}
