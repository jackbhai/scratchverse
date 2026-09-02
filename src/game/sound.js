// ScratchVerse — procedural ASMR audio (no downloads, works offline)
let AC = null,
  master = null,
  noiseBuf = null,
  vibrate = true,
  enabled = true;
let lastScratch = 0;

function ctx() {
  if (!AC) {
    if (typeof window === 'undefined') return null;
    const C = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!C) return null;
    AC = new C();
    master = AC.createGain();
    master.gain.value = 0.9;
    master.connect(AC.destination);
    const len = AC.sampleRate * 1.2;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      lp = lp * 0.72 + w * 0.28; // pink-ish
      d[i] = Math.max(-1, Math.min(1, lp * 2.2));
    }
  }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}

function tone({ f = 440, to = f, type = 'sine', dur = 0.14, g = 0.16, delay = 0, q = 0 }) {
  const ac = ctx();
  if (!ac || !enabled) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const gn = ac.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(g, t + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (q) {
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = f;
    flt.Q.value = q;
    node.connect(flt);
    node = flt;
  }
  node.connect(gn).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.09, g = 0.12, f = 2400, q = 0.7, rate = 1, delay = 0 }) {
  const ac = ctx();
  if (!ac || !enabled) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rate;
  const flt = ac.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = f;
  flt.Q.value = q;
  const gn = ac.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(g, t + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(gn).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const buzz = p => {
  if (vibrate && navigator.vibrate) {
    try {
      navigator.vibrate(p);
    } catch {}
  }
};

const safe =
  fn =>
  (...a) => {
    try {
      return fn(...a);
    } catch {}
  };

const _SFX = {
  init() {
    ctx();
  },
  /** @param {{ sound?: boolean, haptics?: boolean, reduceFx?: boolean, autoClaim?: boolean }} [cfg] */
  settings(cfg = {}) {
    const { sound, haptics } = cfg || {};
    if (sound !== undefined) enabled = !!sound;
    if (haptics !== undefined) vibrate = !!haptics;
  },
  click() {
    tone({ f: 520, to: 300, type: 'triangle', dur: 0.07, g: 0.08 });
    buzz(6);
  },
  buy() {
    tone({ f: 700, to: 1100, type: 'square', dur: 0.09, g: 0.05 });
    noise({ dur: 0.12, f: 900, g: 0.06 });
    buzz(8);
  },
  scratch(v = 0.5) {
    const now = performance.now();
    if (now - lastScratch < 34) return;
    lastScratch = now;
    noise({ dur: 0.055, g: 0.05 + 0.06 * v, f: 1200 + 2600 * v, rate: 0.85 + v * 0.7 });
  },
  tear(n = 1) {
    // a paper rip: broadband noise that loses energy fast, plus one fibre snap
    const now = performance.now();
    if (now - lastScratch < 26) return;
    lastScratch = now;
    const k = Math.min(3, Math.max(1, n));
    for (let i = 0; i < k; i++) {
      noise({ dur: 0.05 + 0.03 * i, g: 0.07 - 0.012 * i, f: 2600 - 500 * i, rate: 1.25 - 0.18 * i, delay: i * 0.022 });
    }
    tone({ f: 2100, to: 900, type: 'triangle', dur: 0.035, g: 0.028, delay: 0.018 });
  },
  reveal() {
    tone({ f: 900, to: 1500, type: 'sine', dur: 0.09, g: 0.07 });
    buzz(5);
  },
  coin(n = 1) {
    for (let i = 0; i < Math.min(6, n); i++) {
      tone({ f: 1400 + i * 130, to: 2100, type: 'triangle', dur: 0.11, g: 0.06, delay: i * 0.055 });
    }
  },
  win(_mult = 1) {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      tone({ f, to: f * 1.01, type: 'triangle', dur: 0.2, g: 0.11, delay: i * 0.06 });
    });
    noise({ dur: 0.5, g: 0.05, f: 5200, rate: 1.4, delay: 0.05 });
    buzz([12, 40, 18, 40, 30]);
  },
  lose() {
    tone({ f: 260, to: 120, type: 'sawtooth', dur: 0.24, g: 0.05 });
    buzz(18);
  },
  jackpot() {
    const seq = [523, 659, 784, 1046, 1318, 1568, 2093];
    seq.forEach((f, i) => {
      tone({ f, type: 'square', dur: 0.3, g: 0.075, delay: i * 0.07 });
    });
    tone({ f: 130, to: 65, type: 'sine', dur: 0.9, g: 0.14 });
    for (let i = 0; i < 12; i++) noise({ dur: 0.14, g: 0.035, f: 3000 + i * 400, rate: 1.6, delay: 0.2 + i * 0.06 });
    buzz([20, 40, 20, 40, 20, 90, 40]);
  },
  level() {
    [660, 880, 1170].forEach((f, i) => {
      tone({ f, dur: 0.14, g: 0.08, type: 'triangle', delay: i * 0.07 });
    });
    buzz([10, 30, 10]);
  },
  break_() {
    for (let i = 0; i < 5; i++) noise({ dur: 0.08, g: 0.09, f: 2200 + i * 900, rate: 1.9, delay: i * 0.02 });
    tone({ f: 300, to: 90, type: 'sawtooth', dur: 0.2, g: 0.05 });
    buzz([30, 20, 40]);
  },
  whoosh() {
    noise({ dur: 0.4, g: 0.07, f: 700, rate: 0.5 });
  },
  prestige() {
    [196, 262, 330, 392, 523, 659].forEach((f, i) => {
      tone({ f, dur: 0.5, g: 0.08, type: 'sine', delay: i * 0.1 });
    });
    buzz([40, 60, 40, 60, 120]);
  },
  error() {
    tone({ f: 220, to: 180, type: 'square', dur: 0.12, g: 0.05 });
  },
};
export const SFX = Object.fromEntries(Object.entries(_SFX).map(([k, v]) => [k, typeof v === 'function' ? safe(v) : v]));
export default SFX;
