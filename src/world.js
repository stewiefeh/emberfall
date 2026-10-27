// Emberfall - world simulation
export const WORLD = { w: 2600, h: 1800 };
export const CAMP = { x: WORLD.w / 2, y: WORLD.h / 2, r: 115, light: 250 };

export const LANDMARKS = [
  { x: CAMP.x - 960, y: CAMP.y - 620, type: 'pine' },
  { x: CAMP.x + 980, y: CAMP.y - 520, type: 'tower' },
  { x: CAMP.x + 920, y: CAMP.y + 640, type: 'boulder' },
  { x: CAMP.x - 900, y: CAMP.y + 610, type: 'arch' },
];

// ward braziers: light them once, they hold the dark for the rest of the run
export const BRAZIERS = [
  { x: CAMP.x - 640, y: CAMP.y - 460 },
  { x: CAMP.x + 680, y: CAMP.y - 380 },
  { x: CAMP.x + 560, y: CAMP.y + 520 },
  { x: CAMP.x - 520, y: CAMP.y + 480 },
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

// dawn boons: one free, chosen each night
export const UPGRADES = [
  { id: 'wicks', name: 'Deep Wicks', desc: 'The torch holds more. Twenty-five more fuel.' },
  { id: 'wide', name: 'Wide Flame', desc: 'Light reaches further. Eighteen percent more radius.' },
  { id: 'blood', name: 'Hot Blood', desc: 'Shades burn faster in your light.' },
  { id: 'swift', name: 'Swift Stride', desc: 'You move quicker through the dark.' },
  { id: 'sense', name: 'Ember Sense', desc: 'Embers drift toward you from further off.' },
  { id: 'kindle', name: 'Kindling', desc: 'Shades that burn down leave more fuel behind.' },
];

// the fire's offerings: banked embers spent on lasting upgrades, each night at dawn
export const SHOP = [
  { id: 'radius', name: 'Kindled Torch', desc: 'Seven percent more torch radius.', base: 12, max: 5 },
  { id: 'speed', name: 'Walker\'s Pace', desc: 'Six percent faster, always.', base: 10, max: 5 },
  { id: 'fuel', name: 'Deep Reserves', desc: 'Fifteen more maximum fuel.', base: 14, max: 5 },
  { id: 'armor', name: 'Ashen Skin', desc: 'Shade touch costs two less fuel.', base: 16, max: 3 },
  { id: 'magnet', name: 'Ember Call', desc: 'Embers reach for you from further off.', base: 12, max: 3 },
  { id: 'dashcd', name: 'Springheel', desc: 'Dash recovers almost half a second sooner.', base: 15, max: 3 },
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
    this.shopLv = { radius: 0, speed: 0, fuel: 0, armor: 0, magnet: 0, dashcd: 0 };
    this.lit = true; this.torchOut = false; this.graceT = 0;
    this.carried = 0; this.banked = 0; this.totalEarned = 0;
    this.night = 1; this.nightT = 0; this.nightLength = 55;
    this.spawnT = 5; this.dawnT = 0;
    this.shades = []; this.stalkers = []; this.embers = []; this.sticks = []; this.particles = []; this.ash = [];
    this.braziers = BRAZIERS.map(b => ({ ...b, lit: false, r: 235, flick: rand(TAU) }));
    this.dashT = 0; this.dashCd = 0; this.invT = 0;
    this.nightBanked = 0; this.quota = 8; this.quotaMet = false;
    this.cam = { x: CAMP.x, y: CAMP.y };
    this.shake = 0; this.toast = null; this.flash = 0;
    this.dead = false; this.deathCause = '';
    this.shakeEnabled = true; this.toastsEnabled = true;
    for (let i = 0; i < 110; i++) {
      this.ash.push({ x: rand(WORLD.w), y: rand(WORLD.h), s: rand(0.7, 2.4), v: rand(9, 26), p: rand(TAU) });
    }
    for (let i = 0; i < 16; i++) this.spawnEmber(true);
    for (let i = 0; i < 6; i++) this.spawnStick(true);
    this.stickT = 9;
    this.emit('stats');
  }

  get torchRadius() {
    if (!this.lit) return 0;
    const base = 70 + this.fuel * 1.5;
    const flick = 1 + this.noise(this.time * 6) * 0.045;
    const low = this.fuel < this.fuelMax * 0.22 ? 1 - this.noise(this.time * 11) * 0.12 : 1;
    const shopWide = 1 + this.shopLv.radius * 0.07;
    return clamp(base * this.wideMult * shopWide * flick * low, 40, 420);
  }

  lightIntensityAt(x, y) {
    let v = 0;
    if (this.lit) {
      const d = dist(x, y, this.player.x, this.player.y);
      v = Math.pow(Math.max(0, 1 - d / this.torchRadius), 1.6);
    }
    for (const b of this.braziers) {
      if (!b.lit) continue;
      const d = dist(x, y, b.x, b.y);
      v = Math.max(v, Math.pow(Math.max(0, 1 - d / b.r), 1.6) * 0.92);
    }
    const dc = dist(x, y, CAMP.x, CAMP.y);
    v = Math.max(v, Math.pow(Math.max(0, 1 - dc / CAMP.light), 1.8) * 1.1);
    return v;
  }

  toastMsg(text, life = 3.2) { if (!this.toastsEnabled) return; this.toast = { text, t: 0, life }; }

  dash() {
    if (this.phase !== 'play') return false;
    if (this.dashCd > 0 || !this.lit || this.fuel < 6) return false;
    this.dashT = 0.34;
    this.dashCd = 3 - this.shopLv.dashcd * 0.4;
    this.invT = 0.5;
    this.fuel = Math.max(0, this.fuel - 3);
    const a = Math.atan2(this.inY, this.inX);
    for (let i = 0; i < 10; i++) {
      this.addParticle(this.player.x, this.player.y, Math.cos(a + rand(-0.7, 0.7)) * rand(40, 130), Math.sin(a + rand(-0.7, 0.7)) * rand(40, 130), rand(0.25, 0.5), 'ember', rand(1, 2));
    }
    this.emit('dash');
    return true;
  }

  spawnEmber(initial = false) {
    let x, y, tries = 0;
    const nearLit = this.braziers.filter(b => b.lit);
    do {
      if (!initial && nearLit.length && Math.random() < 0.45) {
        const b = nearLit[Math.floor(rand(nearLit.length))];
        const a = rand(TAU), d = rand(70, b.r - 30);
        x = clamp(b.x + Math.cos(a) * d, 90, WORLD.w - 90);
        y = clamp(b.y + Math.sin(a) * d, 90, WORLD.h - 90);
      } else {
        const a = rand(TAU), d = 300 + Math.pow(Math.random(), 0.8) * 1150;
        x = clamp(CAMP.x + Math.cos(a) * d, 90, WORLD.w - 90);
        y = clamp(CAMP.y + Math.sin(a) * d, 90, WORLD.h - 90);
      }
      tries++;
    } while (tries < 8 && (this.embers.some(e => dist(e.x, e.y, x, y) < 140) || this.braziers.some(b => b.lit && dist(b.x, b.y, x, y) < 55)));
    const d = dist(x, y, CAMP.x, CAMP.y);
    const value = Math.round(3 + clamp((d - 300) / 1050, 0, 1) * 13);
    this.embers.push({ x, y, value, bob: rand(TAU), born: initial ? -1 : this.time });
  }

  spawnStick(initial = false) {
    let x, y, tries = 0;
    do {
      const a = rand(TAU), d = 200 + Math.pow(Math.random(), 0.9) * 900;
      x = clamp(CAMP.x + Math.cos(a) * d, 90, WORLD.w - 90);
      y = clamp(CAMP.y + Math.sin(a) * d, 90, WORLD.h - 90);
      tries++;
    } while (tries < 8 && (this.embers.some(e => dist(e.x, e.y, x, y) < 110) || this.braziers.some(b => dist(b.x, b.y, x, y) < 120)));
    this.sticks.push({ x, y, bob: rand(TAU), fresh: initial ? 0 : this.time });
  }

  spawnShade() {
    const cap = Math.min(12, 4 + this.night);
    if (this.shades.length >= cap) return;
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

  spawnStalker() {
    const target = this.night >= 6 ? 2 : 1;
    if (this.stalkers.length >= target) return;
    const edge = Math.floor(rand(4));
    let x, y;
    if (edge === 0) { x = rand(WORLD.w); y = 30; }
    else if (edge === 1) { x = WORLD.w - 30; y = rand(WORLD.h); }
    else if (edge === 2) { x = rand(WORLD.w); y = WORLD.h - 30; }
    else { x = 30; y = rand(WORLD.h); }
    this.stalkers.push({
      x, y, r: 17, hp: 70 + this.night * 10, seed: rand(TAU), alpha: 1, fleeing: false,
      state: 'orbit', ang: Math.atan2(y - this.player.y, x - this.player.x), t: 0,
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
    this.updateStalkers(dt);
    this.updateEmbers(dt);
    this.updateSticks(dt);
    this.updateCamera(dt);

    if (this.phase === 'play') {
      this.nightT += dt;
      this.spawnT -= dt;
      const interval = clamp(6.5 - this.night * 0.45, 2.8, 6.5);
      if (this.spawnT <= 0) {
        this.spawnT = interval * rand(0.75, 1.25);
        this.spawnShade();
        if (this.night >= 4 && Math.random() < 0.2) this.spawnShade();
      }
      if (this.night >= 3) {
        this.stalkerT = (this.stalkerT || 20) - dt;
        if (this.stalkerT <= 0) { this.spawnStalker(); this.stalkerT = rand(18, 30); }
      }
      // braziers: walk into one with a live torch to light it
      for (const b of this.braziers) {
        if (!b.lit && this.lit && this.fuel >= 12 && dist(this.player.x, this.player.y, b.x, b.y) < 62) {
          this.fuel -= 12;
          b.lit = true;
          this.flash = 0.8;
          const n = this.braziers.filter(x => x.lit).length;
          this.emit('brazier');
          this.toastMsg(n === this.braziers.length
            ? 'all four wards burn. the dark keeps its distance.'
            : `a ward takes the flame. ${n} of ${this.braziers.length} lit.`, 4);
          for (let i = 0; i < 22; i++) {
            this.addParticle(b.x, b.y, rand(-90, 90), rand(-140, -30), rand(0.4, 1), 'ember', rand(1.4, 3));
          }
        }
      }
      if (this.nightT >= this.nightLength) this.enterDawn();
    } else if (this.phase === 'dawn') {
      this.dawnT += dt;
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    this.dashT = Math.max(0, this.dashT - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invT = Math.max(0, this.invT - dt);
    let mx = this.inX, my = this.inY;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    let sp = p.speed * this.speedMult * (1 + this.shopLv.speed * 0.06);
    if (this.dashT > 0) sp *= 2.6;
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
    // a lit ward shelters you: the torch burns slower inside its light
    let sheltered = false;
    if (this.lit) {
      for (const b of this.braziers) {
        if (b.lit && dist(this.player.x, this.player.y, b.x, b.y) < b.r * 0.7) { sheltered = true; break; }
      }
    }
    if (this.lit) {
      this.fuel -= 3.3 * (sheltered ? 0.55 : 1) * dt;
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
        this.totalEarned += this.carried;
        this.nightBanked += this.carried;
        this.emit('bank', this.carried);
        if (!this.quotaMet && this.nightBanked >= this.quota) {
          this.quotaMet = true;
          this.fuel = Math.min(this.fuelMax, this.fuel + 12);
          this.toastMsg('the night\'s quota is met. the fire is pleased.', 3.4);
        } else {
          this.toastMsg(`banked ${this.carried} embers`, 2.4);
        }
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
        // lit braziers hold them off harder
        for (const b of this.braziers) {
          if (!b.lit) continue;
          const db = dist(s.x, s.y, b.x, b.y);
          if (db < b.r + 40 && db > 0.01) {
            const push = Math.pow(1 - db / (b.r + 40), 1.3) * 150;
            fx -= (b.x - s.x) / db * push / Math.max(spd, 1);
            fy -= (b.y - s.y) / db * push / Math.max(spd, 1);
          }
        }
        const fm = Math.hypot(fx, fy) || 1;
        fx /= fm; fy /= fm;
      }

      fx += Math.sin(this.time * 1.3 + s.seed) * 0.22;
      fy += Math.cos(this.time * 1.1 + s.seed * 2) * 0.22;

      s.x = clamp(s.x + fx * spd * dt, 10, WORLD.w - 10);
      s.y = clamp(s.y + fy * spd * dt, 10, WORLD.h - 10);

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

      const dp = dist(s.x, s.y, p.x, p.y);
      if (dp < s.r + p.r && this.invT <= 0) {
        if (this.lit) {
          for (let k = 0; k < 10; k++) {
            this.addParticle(s.x, s.y, rand(-80, 80), rand(-100, -10), rand(0.4, 0.8), 'ember', rand(1.4, 2.6));
          }
          const hit = Math.max(2, 7 - this.shopLv.armor * 2);
          this.fuel = Math.max(0, this.fuel - hit);
          this.shake = Math.max(this.shake, 0.5);
          this.flash = 0.5;
          this.emit('thud');
          this.shades.splice(i, 1);
          continue;
        }
      }
    }
  }

  updateStalkers(dt) {
    const p = this.player;
    for (let i = this.stalkers.length - 1; i >= 0; i--) {
      const s = this.stalkers[i];
      const li = this.lightIntensityAt(s.x, s.y);

      if (s.fleeing) {
        s.alpha -= dt * 0.35;
        s.x += Math.cos(s.dir) * 160 * dt;
        s.y += Math.sin(s.dir) * 160 * dt;
        if (s.alpha <= 0) this.stalkers.splice(i, 1);
        continue;
      }

      s.t += dt;
      if (s.state === 'orbit') {
        // circle at the edge of your light, waiting for your back
        const want = Math.max(this.torchRadius + 80, 240);
        s.ang += dt * 0.9 * (s.seed > Math.PI ? 1 : -1);
        const tx = p.x + Math.cos(s.ang) * want, ty = p.y + Math.sin(s.ang) * want;
        s.x = lerp(s.x, tx, 1 - Math.exp(-dt * 2.2));
        s.y = lerp(s.y, ty, 1 - Math.exp(-dt * 2.2));
        // dash when you are walking away from it
        const away = (p.vx * Math.cos(s.ang) + p.vy * Math.sin(s.ang)) > 40;
        const moving = Math.hypot(p.vx, p.vy) > 60;
        if (moving && away && s.t > 2.5 && Math.random() < dt * 0.8 && this.lit) {
          s.state = 'dash'; s.t = 0;
          const d = Math.hypot(p.x - s.x, p.y - s.y) || 1;
          s.dx = (p.x - s.x) / d; s.dy = (p.y - s.y) / d;
          this.toastMsg('something is behind you.', 2);
        }
      } else if (s.state === 'dash') {
        s.x += s.dx * 430 * dt;
        s.y += s.dy * 430 * dt;
        if (s.t > 0.75) { s.state = 'recover'; s.t = 0; }
      } else {
        s.x += Math.cos(s.ang) * 120 * dt;
        s.y += Math.sin(s.ang) * 120 * dt;
        if (s.t > 1.6) { s.state = 'orbit'; s.t = 0; }
      }

      // burning: it endures the light longer than a shade
      if (li > 0.12) {
        s.hp -= li * 18 * this.burnMult * dt;
        if (Math.random() < dt * 6) {
          this.addParticle(s.x + rand(-6, 6), s.y + rand(-6, 6), rand(-20, 20), rand(-70, -20), rand(0.3, 0.7), 'ember', rand(1, 2.4));
        }
        if (s.hp <= 0) {
          for (let k = 0; k < 20; k++) {
            this.addParticle(s.x, s.y, rand(-110, 110), rand(-150, -20), rand(0.5, 1), 'ember', rand(1.4, 3.2));
          }
          this.fuel = Math.min(this.fuelMax, this.fuel + 6 + this.kindle * 1.5);
          this.toastMsg('the stalker breaks apart.', 2.2);
          this.stalkers.splice(i, 1);
          continue;
        }
      }

      const dp = dist(s.x, s.y, p.x, p.y);
      if (dp < s.r + p.r && this.invT <= 0) {
        if (this.lit) {
          const hit = Math.max(3, 9 - this.shopLv.armor * 2);
          this.fuel = Math.max(0, this.fuel - hit);
          this.shake = Math.max(this.shake, 0.8);
          this.flash = 0.7;
          this.emit('thud');
          s.state = 'recover'; s.t = 0;
          s.x += Math.cos(s.ang) * 60; s.y += Math.sin(s.ang) * 60;
          this.invT = 0.8;
        }
      }
    }
  }

  updateEmbers(dt) {
    const p = this.player;
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      const d = dist(e.x, e.y, p.x, p.y);
      const pullR = 30 + this.sense * 42 + this.shopLv.magnet * 45;
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

  updateSticks(dt) {
    const p = this.player;
    for (let i = this.sticks.length - 1; i >= 0; i--) {
      const st = this.sticks[i];
      if (dist(st.x, st.y, p.x, p.y) < 30 && this.fuel < this.fuelMax) {
        this.fuel = Math.min(this.fuelMax, this.fuel + 18);
        this.emit('stick');
        for (let k = 0; k < 8; k++) {
          this.addParticle(st.x, st.y, rand(-50, 50), rand(-90, -20), rand(0.4, 0.8), 'ember', rand(1, 2.2));
        }
        this.sticks.splice(i, 1);
      }
    }
    this.stickT -= dt;
    if (this.stickT <= 0 && this.sticks.length < 6) {
      this.spawnStick();
      this.stickT = rand(8, 14);
    }
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
    for (const s of this.shades) { s.fleeing = true; s.dir = Math.atan2(s.y - CAMP.y, s.x - CAMP.x); }
    for (const s of this.stalkers) { s.fleeing = true; s.dir = Math.atan2(s.y - CAMP.y, s.x - CAMP.x); }
    this.emit('dawn');
  }

  applyBoon(id) {
    const u = UPGRADES.find(u => u.id === id);
    if (!u) return;
    if (u.id === 'wicks') { this.fuelMax += 25; this.fuel += 25; }
    else if (u.id === 'wide') this.wideMult *= 1.18;
    else if (u.id === 'blood') this.burnMult *= 1.35;
    else if (u.id === 'swift') this.speedMult *= 1.12;
    else if (u.id === 'sense') this.sense += 1;
    else if (u.id === 'kindle') this.kindle += 1;
  }

  shopItems() {
    return SHOP.map(it => {
      const lv = this.shopLv[it.id];
      const maxed = lv >= it.max;
      return {
        id: it.id, name: it.name, desc: it.desc, level: lv, max: it.max, maxed,
        cost: maxed ? 0 : Math.round(it.base * Math.pow(1.6, lv)),
      };
    });
  }

  shopBuy(id) {
    const it = SHOP.find(s => s.id === id);
    if (!it) return false;
    const lv = this.shopLv[id];
    if (lv >= it.max) return false;
    const cost = Math.round(it.base * Math.pow(1.6, lv));
    if (this.banked < cost) return false;
    this.banked -= cost;
    this.shopLv[id] = lv + 1;
    if (id === 'fuel') { this.fuelMax += 15; this.fuel += 15; }
    this.emit('buy', id);
    return true;
  }

  beginNight() {
    this.night++;
    this.nightT = 0;
    this.nightLength = Math.min(90, 55 + this.night * 6);
    this.spawnT = 4.5;
    this.nightBanked = 0;
    this.quota = 8 + this.night * 3;
    this.quotaMet = false;
    while (this.sticks.length < 6) this.spawnStick();
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
    const newBest = this.totalEarned > (best.banked || 0) || this.night > (best.nights || 0);
    const out = {
      banked: Math.max(this.totalEarned, best.banked || 0),
      nights: Math.max(this.night, best.nights || 0),
    };
    localStorage.setItem('emberfall_best', JSON.stringify(out));
    return { newBest, ...out };
  }
}
