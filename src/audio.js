// Emberfall - procedural audio (WebAudio, no assets)
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastBurn = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  startAmbient() {
    const ctx = this.ctx;
    // low drone
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.045;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180;
    for (const f of [52, 52.6, 104.3]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = f > 100 ? 0.3 : 1;
      o.connect(og); og.connect(lp); o.start();
    }
    lp.connect(this.droneGain);
    this.droneGain.connect(this.master);

    // campfire crackle: sparse impulse noise loop
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() < 0.0035 ? (Math.random() * 2 - 1) * Math.pow(Math.random(), 2) : 0;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0;
    src.connect(bp); bp.connect(this.crackleGain); this.crackleGain.connect(this.master);
    src.start();

    // wind
    const wlen = ctx.sampleRate * 4;
    const wbuf = ctx.createBuffer(1, wlen, ctx.sampleRate);
    const wd = wbuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < wlen; i++) {
      last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
      wd[i] = last * 3;
    }
    const wsrc = ctx.createBufferSource();
    wsrc.buffer = wbuf; wsrc.loop = true;
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass'; wlp.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.03;
    wsrc.connect(wlp); wlp.connect(this.windGain); this.windGain.connect(this.master);
    wsrc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // called each frame from the game
  ambience(campProx, burning) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.crackleGain.gain.setTargetAtTime(0.16 * campProx, t, 0.4);
    this.droneGain.gain.setTargetAtTime(0.035 + campProx * 0.015, t, 0.8);
    if (burning > 0 && t - this.lastBurn > 0.12) {
      this.lastBurn = t;
      this.hiss(Math.min(0.12, burning * 0.08));
    }
  }

  blip(freq, dur = 0.18, vol = 0.16, type = 'triangle') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  pickup(value) {
    this.blip(420 * (1 + value / 34), 0.16, 0.14);
    this.blip(630 * (1 + value / 34), 0.12, 0.07);
  }

  bank() {
    this.blip(392, 0.5, 0.14, 'sine');
    setTimeout(() => this.blip(523.25, 0.6, 0.12, 'sine'), 110);
  }

  hiss(vol) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = ctx.sampleRate * 0.1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(hp); hp.connect(g); g.connect(this.master);
    src.start(t);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.35);
  }

  boom() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(64, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.5);
    this.hiss(0.2);
  }

  relight() {
    this.blip(196, 0.5, 0.16, 'sine');
    setTimeout(() => this.blip(294, 0.6, 0.12, 'sine'), 90);
    setTimeout(() => this.blip(392, 0.7, 0.1, 'sine'), 180);
  }

  chime() {
    this.blip(523.25, 0.35, 0.1);
    setTimeout(() => this.blip(659.25, 0.35, 0.09), 90);
    setTimeout(() => this.blip(784, 0.5, 0.09), 180);
  }
}
