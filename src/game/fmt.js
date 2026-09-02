// ScratchVerse — number formatting (lottery-scale, 1e15 cap → scientific)
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

export function fmt(n, dp = 0) {
  n = Number(n) || 0;
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return neg + (n % 1 === 0 ? String(n) : n.toFixed(n < 10 ? Math.min(dp, 2) : 1));
  const t = Math.floor(Math.log10(n) / 3);
  if (t < UNITS.length) {
    const v = n / Math.pow(10, t * 3);
    return neg + v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1') + UNITS[t];
  }
  const e = Math.floor(Math.log10(n));
  return neg + (n / Math.pow(10, e)).toFixed(2).replace(/\.?0+$/, '') + 'e' + e;
}

export const fmtFull = n => {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e15) return fmt(n);
  return n.toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
};

export function pct(x, d = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (x < 0.05) return (x * 100).toFixed(3) + '%';
  return (x * 100).toFixed(d) + '%';
}

export const signed = n => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));

export function mmss(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function untilNextMidnight(now = Date.now()) {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}
