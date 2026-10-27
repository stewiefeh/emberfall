// Emberfall - rendering
import { WORLD, CAMP, LANDMARKS, roman } from './world.js';

const TAU = Math.PI * 2;

function makeGround() {
  const c = document.createElement('canvas');
  c.width = WORLD.w; c.height = WORLD.h;
  const g = c.getContext('2d');
  // base with a faint center lift
  const grad = g.createRadialGradient(CAMP.x, CAMP.y, 100, CAMP.x, CAMP.y, 1700);
  grad.addColorStop(0, '#10141d');
  grad.addColorStop(0.55, '#0c1018');
  grad.addColorStop(1, '#080b12');
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  // mottled ground
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * WORLD.w, y = Math.random() * WORLD.h, r = 18 + Math.random() * 80;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(22,30,44,0.18)' : 'rgba(4,6,10,0.22)';
    g.beginPath(); g.ellipse(x, y, r, r * (0.4 + Math.random() * 0.5), Math.random() * TAU, 0, TAU); g.fill();
  }
  // worn trails from camp to each landmark
  g.lineCap = 'round';
  for (const l of LANDMARKS) {
    for (let pass = 0; pass < 3; pass++) {
      g.strokeStyle = `rgba(30,39,54,${0.16 - pass * 0.045})`;
      g.lineWidth = 30 - pass * 9;
      g.beginPath();
      g.moveTo(CAMP.x, CAMP.y);
      const wob = 40 - pass * 12;
      const steps = 14;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = CAMP.x + (l.x - CAMP.x) * t + Math.sin(t * 9 + pass * 2) * wob;
        const py = CAMP.y + (l.y - CAMP.y) * t + Math.cos(t * 7 + pass * 3) * wob;
        g.lineTo(px, py);
      }
      g.stroke();
    }
  }
  // camp ring of stones
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2;
    const x = CAMP.x + Math.cos(a) * CAMP.r, y = CAMP.y + Math.sin(a) * CAMP.r;
    g.fillStyle = '#232a38';
    g.beginPath(); g.ellipse(x, y, 9 + (i % 3) * 3, 6 + (i % 2) * 3, a, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,150,70,0.05)';
    g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill();
  }
  drawLandmark(g, LANDMARKS[0].x, LANDMARKS[0].y, 'pine');
  drawLandmark(g, LANDMARKS[1].x, LANDMARKS[1].y, 'tower');
  drawLandmark(g, LANDMARKS[2].x, LANDMARKS[2].y, 'boulder');
  drawLandmark(g, LANDMARKS[3].x, LANDMARKS[3].y, 'arch');
  return c;
}

function drawLandmark(g, x, y, type) {
  g.save();
  g.translate(x, y);
  if (type === 'pine') {
    // lightning-split pine: trunk with a jagged split top
    g.fillStyle = '#151b27';
    g.fillRect(-14, -40, 28, 120);
    g.beginPath();
    g.moveTo(-52, -30); g.lineTo(-8, -215); g.lineTo(2, -90); g.lineTo(14, -235); g.lineTo(52, -20);
    g.lineTo(30, -40); g.lineTo(-30, -40); g.closePath();
    g.fill();
    g.fillStyle = '#1d2534';
    g.beginPath(); g.moveTo(-8, -215); g.lineTo(2, -90); g.lineTo(-20, -60); g.closePath(); g.fill();
  } else if (type === 'tower') {
    // broken water tower silhouette
    g.fillStyle = '#141a26';
    g.fillRect(-16, -170, 32, 210);
    g.beginPath();
    g.moveTo(-46, -170); g.lineTo(-30, -262); g.lineTo(6, -240); g.lineTo(34, -258); g.lineTo(46, -168);
    g.closePath(); g.fill();
    g.strokeStyle = '#1d2534'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-46, -170); g.lineTo(46, -168); g.stroke();
  } else if (type === 'boulder') {
    // leaning-tooth boulder
    g.fillStyle = '#161d2a';
    g.beginPath();
    g.moveTo(-95, 60); g.quadraticCurveTo(-90, -70, 10, -88); g.quadraticCurveTo(95, -66, 100, 60);
    g.closePath(); g.fill();
    g.fillStyle = '#1e2735';
    g.beginPath(); g.ellipse(-6, -60, 42, 26, -0.35, 0, TAU); g.fill();
  } else {
    // fallen stone arch
    g.fillStyle = '#151b27';
    g.beginPath(); g.moveTo(-70, 80); g.lineTo(-58, -140); g.lineTo(-30, -136); g.lineTo(-38, 80); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(30, 60); g.quadraticCurveTo(6, -40, -34, -120); g.lineTo(-10, -130); g.quadraticCurveTo(44, -30, 70, 58); g.closePath(); g.fill();
  }
  g.restore();
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.ground = makeGround();
    this.grain = makeGrain();
    this.grainT = 0;
    this.grainEnabled = true;
  }

  draw(world, cw, ch, dpr, state) {
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawSky(ctx, world, cw, ch);

    const zoom = Math.max(cw / 1300, ch / 860);
    const shx = (Math.random() - 0.5) * world.shake * 26;
    const shy = (Math.random() - 0.5) * world.shake * 26;
    const ox = cw / 2 - world.cam.x * zoom + shx;
    const oy = ch / 2 - world.cam.y * zoom + shy;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);

    ctx.drawImage(this.ground, 0, 0);

    // falling ash
    ctx.fillStyle = 'rgba(190,200,220,0.16)';
    for (const a of world.ash) {
      ctx.beginPath(); ctx.arc(a.x, a.y, a.s, 0, TAU); ctx.fill();
    }

    // embers
    for (const e of world.embers) {
      const bob = Math.sin(world.time * 2 + e.bob) * 4;
      const size = 3 + e.value * 0.35;
      ctx.fillStyle = '#ffb45e';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, size, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,130,0.85)';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, size * 0.45, 0, TAU); ctx.fill();
    }

    // shades
    for (const s of world.shades) {
      const li = world.lightIntensityAt(s.x, s.y);
      const visible = Math.max(li, 0.12);
      ctx.globalAlpha = s.alpha;
      if (visible > 0.13) {
        ctx.fillStyle = '#05070c';
        ctx.beginPath();
        const wob = 0.24;
        for (let a = 0; a <= TAU + 0.01; a += TAU / 22) {
          const r = s.r * (1 + wob * Math.sin(3 * a + world.time * 3 + s.seed));
          const px = s.x + Math.cos(a) * r, py = s.y + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(120,60,90,${0.25 * visible})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
      // eyes always visible
      const ea = Math.atan2(world.player.y - s.y, world.player.x - s.x);
      const ex = Math.cos(ea) * 4, ey = Math.sin(ea) * 4;
      const eg = s.fleeing ? 0.3 : 0.55 + li * 0.45;
      ctx.fillStyle = `rgba(255,225,205,${eg})`;
      ctx.beginPath(); ctx.arc(s.x - 4 + ex, s.y - 3 + ey, 2.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s.x + 4 + ex, s.y - 3 + ey, 2.1, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // campfire
    this.drawCampfire(ctx, world);

    // player
    this.drawPlayer(ctx, world);

    // particles (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of world.particles) {
      const f = pt.life / pt.max;
      if (pt.kind === 'ember') ctx.fillStyle = `rgba(255,${140 + Math.floor(80 * f)},60,${0.75 * f})`;
      else if (pt.kind === 'gold') ctx.fillStyle = `rgba(255,205,120,${0.8 * f})`;
      else ctx.fillStyle = `rgba(200,210,230,${0.5 * f})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + f * 0.7), 0, TAU); ctx.fill();
    }

    // light pass
    this.drawLights(ctx, world);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    this.drawHud(ctx, world, cw, ch, state);

    // film grain
    this.grainT++;
    const showGrain = this.grainEnabled;
    if (this.grainT % 3 === 0) this.goff = (Math.random() * 160) | 0;
    if (!showGrain) { }
    ctx.globalAlpha = showGrain ? 0.05 : 0;
    const goff = this.goff || 0;
    for (let x = -goff; x < cw; x += 160) {
      for (let y = -goff; y < ch; y += 160) ctx.drawImage(this.grain, x, y);
    }
    ctx.globalAlpha = 1;

    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255,120,50,${world.flash * 0.16})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    this.drawToast(ctx, world, cw, ch);
  }

  drawSky(ctx, world, cw, ch) {
    let top, bot;
    if (world.phase === 'dawn') {
      const f = Math.min(1, world.dawnT / 6);
      top = `rgb(${Math.round(14 + 26 * (1 - f))},${Math.round(18 + 22 * (1 - f))},${Math.round(30 + 16 * (1 - f))})`;
      bot = `rgb(${Math.round(7 + 18 * (1 - f))},${Math.round(9 + 14 * (1 - f))},${Math.round(15 + 10 * (1 - f))})`;
    } else {
      const p = world.phase === 'play' ? Math.min(1, world.nightT / world.nightLength) : 0.15;
      top = `rgb(${Math.round(18 - 9 * p)},${Math.round(23 - 12 * p)},${Math.round(36 - 19 * p)})`;
      bot = `rgb(${Math.round(10 - 5 * p)},${Math.round(13 - 7 * p)},${Math.round(21 - 11 * p)})`;
    }
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }

  drawLights(ctx, world) {
    // campfire glow
    const cf = 1 + world.noise(world.time * 7) * 0.06;
    let g = ctx.createRadialGradient(CAMP.x, CAMP.y, 8, CAMP.x, CAMP.y, CAMP.light * cf);
    g.addColorStop(0, 'rgba(255,150,60,0.5)');
    g.addColorStop(0.35, 'rgba(255,110,40,0.22)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CAMP.x, CAMP.y, CAMP.light * cf, 0, TAU); ctx.fill();
    // campfire core
    g = ctx.createRadialGradient(CAMP.x, CAMP.y - 8, 2, CAMP.x, CAMP.y - 8, 34);
    g.addColorStop(0, 'rgba(255,220,150,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CAMP.x, CAMP.y - 8, 34, 0, TAU); ctx.fill();

    if (world.lit) {
      const R = world.torchRadius;
      const p = world.player;
      const flick = 0.94 + world.noise(world.time * 9) * 0.08;
      g = ctx.createRadialGradient(p.x, p.y - 12, 6, p.x, p.y - 12, R * flick);
      g.addColorStop(0, 'rgba(255,190,110,0.5)');
      g.addColorStop(0.3, 'rgba(255,130,50,0.26)');
      g.addColorStop(0.7, 'rgba(255,90,30,0.1)');
      g.addColorStop(1, 'rgba(255,70,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y - 12, R * flick, 0, TAU); ctx.fill();
      // hot core around torch head
      g = ctx.createRadialGradient(p.x, p.y - 12, 1, p.x, p.y - 12, 26);
      g.addColorStop(0, 'rgba(255,230,170,0.85)');
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y - 12, 26, 0, TAU); ctx.fill();
    }
    for (const e of world.embers) {
      const bob = Math.sin(world.time * 2 + e.bob) * 4;
      const rr = 14 + e.value * 1.6;
      const g2 = ctx.createRadialGradient(e.x, e.y + bob, 1, e.x, e.y + bob, rr);
      g2.addColorStop(0, 'rgba(255,190,110,0.55)');
      g2.addColorStop(1, 'rgba(255,130,50,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, rr, 0, TAU); ctx.fill();
    }
  }

  drawCampfire(ctx, world) {
    // log pile
    ctx.save();
    ctx.translate(CAMP.x, CAMP.y);
    ctx.fillStyle = '#2b1d12';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i - 1) * 0.9);
      ctx.fillRect(-22, -5, 44, 9);
      ctx.restore();
    }
    // flames
    for (let i = 0; i < 5; i++) {
      const t = world.time * (5 + i * 1.7) + i * 2.2;
      const fx = Math.sin(t) * 5, fh = 26 + Math.sin(t * 1.3) * 9 + i * 3;
      ctx.fillStyle = i < 2 ? 'rgba(255,120,40,0.85)' : i < 4 ? 'rgba(255,170,70,0.9)' : 'rgba(255,220,150,0.95)';
      ctx.beginPath();
      ctx.moveTo(fx - 8 + i, 0);
      ctx.quadraticCurveTo(fx - 12, -fh * 0.6, fx, -fh);
      ctx.quadraticCurveTo(fx + 12, -fh * 0.6, fx + 8 - i, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawPlayer(ctx, world) {
    const p = world.player;
    const bob = Math.sin(p.walkT * 2) * 1.6;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 12 - bob, 11, 4.5, 0, 0, TAU); ctx.fill();
    // body
    ctx.fillStyle = '#252b38';
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    // warm rim toward torch side
    ctx.strokeStyle = world.lit ? `rgba(255,150,70,${0.35 + (world.fuel / world.fuelMax) * 0.4})` : 'rgba(120,120,140,0.25)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
    // hood highlight
    ctx.fillStyle = '#303748';
    ctx.beginPath(); ctx.arc(0, -4, p.r * 0.62, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
    // torch stick
    const ta = Math.sin(world.time * 2) * 0.08 - 0.5;
    ctx.strokeStyle = '#3a2c1c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(9, 4); ctx.lineTo(9 + Math.cos(ta) * 16, 4 + Math.sin(ta) * 16 - 14); ctx.stroke();
    ctx.restore();

    // fuel arc
    const frac = world.fuel / world.fuelMax;
    ctx.strokeStyle = frac < 0.25
      ? `rgba(255,90,50,${0.5 + world.noise(world.time * 10) * 0.3})`
      : 'rgba(255,170,90,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, p.r + 9, -Math.PI * 0.75, -Math.PI * 0.75 + TAU * 0.75 * frac);
    ctx.stroke();
  }

  drawHud(ctx, world, cw, ch, state) {
    if (state === 'title') return;
    ctx.textBaseline = 'middle';
    // carried (left) with flame glyph
    ctx.save();
    ctx.translate(22, 30);
    ctx.fillStyle = 'rgba(255,150,70,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.quadraticCurveTo(7, -2, 5, 5); ctx.quadraticCurveTo(3, 10, 0, 10);
    ctx.quadraticCurveTo(-3, 10, -5, 5); ctx.quadraticCurveTo(-7, -2, 0, -9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(0, 6, 2.4, 0, TAU); ctx.fill();
    ctx.font = '500 21px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#e8dcc8';
    ctx.textAlign = 'left';
    ctx.fillText(String(world.carried), 16, 1);
    ctx.restore();
    // banked (right)
    ctx.font = '500 21px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(255,205,120,0.9)';
    ctx.textAlign = 'right';
    ctx.fillText(String(world.banked), cw - 22, 30);
    ctx.font = '400 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(154,163,178,0.75)';
    ctx.fillText('BANKED', cw - 22, 48);
    // night numeral
    ctx.font = '600 15px "Cormorant Garamond", serif';
    ctx.fillStyle = 'rgba(154,163,178,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('NIGHT ' + roman(world.night), cw / 2, 26);
  }

  drawToast(ctx, world, cw, ch) {
    if (!world.toast) return;
    const t = world.toast;
    const fadeIn = Math.min(1, t.t / 0.5);
    const fadeOut = Math.min(1, (t.life - t.t) / 0.7);
    const a = Math.min(fadeIn, Math.max(0, fadeOut));
    ctx.globalAlpha = a;
    ctx.font = 'italic 500 26px "Cormorant Garamond", serif';
    ctx.fillStyle = '#e8dcc8';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, cw / 2, ch - 90);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function makeGrain() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.5 ? 26 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}
