// ============================================================
// ScratchCard — the heart of the game.
// Real foil texture + coverage-driven reveal, finger or bot.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TICKET_BY_ID } from '../game/config.js';
import { applyDab, revealCells, cellThreshold } from '../game/logic.js';
import { imgFor, cx, Asset } from '../ui/base.jsx';
import SFX from '../game/sound.js';

// the symbol grid inside the card (must match .tgrid CSS: left/right 7%, top 25%, bottom 15%)
const GX0 = 0.07, GY0 = 0.25;
const GW = 0.86, GH = 0.60;

const cellCenter = (i) => [(i % 3) / 3 + 1 / 6, Math.floor(i / 3) / 3 + 1 / 6];
const normOf = (i) => [(i % 3) / 2, Math.floor(i / 3) / 2];

export default function ScratchCard({
  s, ticket, st, foil, onScratch, onFinish, disabled, reduceFx,
}) {
  const def = ticket ? TICKET_BY_ID[ticket.ticket] : null;
  const cv = useRef(null), holder = useRef(null);
  const draw = useRef({ sc: null, ctx: null, w: 0, h: 0, dpr: 1, img: null, done: false });
  const ptr = useRef({ on: false, x: 0, y: 0, t: 0, v: 0 });
  const synced = useRef(0), pending = useRef(null), raf = useRef(0);
  const botRef = useRef({ i: 0, next: 0 });
  const ended = useRef(false);
  const [started, setStarted] = useState(false);

  /* ---------- canvas sizing + foil pattern ---------- */
  const paintBase = useCallback(() => {
    const c = cv.current, D = draw.current;
    if (!c || !D.w) return;
    const g = D.ctx;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, D.w, D.h);
    if (D.img) {
      const tile = Math.max(150, Math.round(Math.min(D.w, D.h) * 0.55));
      const pat = g.createPattern(D.img, 'repeat');
      if (pat && pat.setTransform && window.DOMMatrix) {
        pat.setTransform(new DOMMatrix([tile / D.img.width, 0, 0, tile / D.img.height, 0, 0]));
      }
      if (pat) { g.fillStyle = pat; g.fillRect(0, 0, D.w, D.h); }
      else { g.fillStyle = '#c9a227'; g.fillRect(0, 0, D.w, D.h); }
    } else {
      g.fillStyle = '#c9a227'; g.fillRect(0, 0, D.w, D.h);
    }
    // engraved grid + vignette so the foil reads as a real security layer
    const sc = D.sc || [];
    const th = def ? cellThreshold(def, st?.strength ?? 10) : 0.4;
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const [fx, fy] = normOf(i);
      const x = (GX0 + fx * GW) * D.w, y = (GY0 + fy * GH) * D.h;
      const cw = (GW / 3) * D.w, ch = (GH / 3) * D.h;
      const r = Math.min(cw, ch) * 0.1;
      g.fillStyle = 'rgba(0,0,0,0.10)';
      roundRect(g, x - cw / 2 + 2, y - ch / 2 + 2, cw - 4, ch - 4, r);
      g.fill();
      if (sc[i] < th) continue;
    }
    const vg = g.createRadialGradient(D.w / 2, D.h / 2, Math.min(D.w, D.h) * 0.25, D.w / 2, D.h / 2, Math.max(D.w, D.h) * 0.72);
    vg.addColorStop(0, 'rgba(255,255,255,0.10)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    g.fillStyle = vg; g.fillRect(0, 0, D.w, D.h);
    // re-erase what the state already considers scratched (resize / remount safety)
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      if (!sc[i] || sc[i] < th) continue;
      const [fx, fy] = cellCenter(i);
      const x = (GX0 + fx * GW) * D.w, y = (GY0 + fy * GH) * D.h;
      g.beginPath(); g.arc(x, y, Math.max(D.w * 0.22, D.h * 0.16), 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }, [def, st?.strength]);

  useEffect(() => {
    const c = cv.current, host = holder.current;
    if (!c || !host) return;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      draw.current.w = c.width; draw.current.h = c.height; draw.current.dpr = dpr;
      draw.current.ctx = c.getContext('2d', { willReadFrequently: false });
      paintBase();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [paintBase]);

  /* ---------- foil image ---------- */
  useEffect(() => {
    const src = imgFor(foil || 'foil-gold');
    if (!src) return;
    let alive = true;
    const im = new Image();
    im.onload = () => { if (alive) { draw.current.img = im; paintBase(); } };
    im.src = src;
    return () => { alive = false; };
  }, [foil, paintBase]);

  /* ---------- ticket switch ---------- */
  useEffect(() => {
    ended.current = false;
    draw.current.done = false;
    draw.current.sc = ticket ? ticket.scratch.slice() : null;
    setStarted(!!ticket && (ticket.coverage || 0) > 0.001);
    if (cv.current) cv.current.classList.remove('gone');
    requestAnimationFrame(() => { paintBase(); });
    botRef.current = { i: 0, next: 0 };
  }, [ticket?.id, paintBase]);

  /* ---------- live scratch data from the store ---------- */
  useEffect(() => {
    if (!ticket) return;
    if (draw.current.sc && Math.abs((draw.current.sc[0] || 0) - (ticket.scratch[0] || 0)) > 0.5) return;
    if (!ticket.manual && !ticket.auto) return;         // don't fight the local stroke
    draw.current.sc = ticket.scratch.slice();
    paintBase();
  }, [ticket?.scratch?.join(',')]);

  /* ---------- brush ---------- */
  const erase = (nx, ny, r, strength = 0.55) => {
    const D = draw.current;
    if (!D.ctx || !D.w) return;
    const g = D.ctx;
    const x = (GX0 + nx * GW) * D.w, y = (GY0 + ny * GH) * D.h;
    const radX = D.w * r, radY = radX * (D.h / D.w) / (GH / GW);   // keep the brush round on screen
    g.globalCompositeOperation = 'destination-out';
    g.save();
    g.translate(x, y); g.scale(1, radY / radX); g.translate(-x, -y);
    const gr = g.createRadialGradient(x, y, radX * 0.5, x, y, radX);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.72, 'rgba(0,0,0,0.95)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, radX, 0, 7); g.fill();
    // torn-foil glint on the leading edge
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = `rgba(255,248,214,${0.12 + strength * 0.22})`;
    g.lineWidth = Math.max(1, radX * 0.13);
    g.beginPath(); g.arc(x, y, radX * 0.78, -1.15, 1.55); g.stroke();
    g.restore();
    g.globalCompositeOperation = 'source-over';
  };

  const schedule = (res) => {
    pending.current = res;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = pending.current; if (!r) return;
      const now = performance.now();
      if (now - synced.current > 140) {
        synced.current = now;
        onScratch?.({ scratch: r.scratch, revealed: r.revealed, coverage: r.coverage, newly: r.newly });
      }
      if (r.complete && !ended.current) {
        ended.current = true;
        draw.current.done = true;
        cv.current?.classList.add('gone');
        onFinish?.();
      }
    });
  };

  const strokeAt = (clientX, clientY) => {
    if (!ticket || ticket.done || disabled || !def) return;
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const nx = (clientX - r.left - GX0 * r.width) / (GW * r.width);
    const ny = (clientY - r.top - GY0 * r.height) / (GH * r.height);
    const p = ptr.current;
    const now = performance.now();
    const dist = Math.hypot(nx - p.x, ny - p.y);
    const dt = Math.max(8, now - (p.t || now));
    p.v = Math.min(1, p.v * 0.6 + Math.min(2.2, dist / (dt / 16)) * 0.4);
    p.x = nx; p.y = ny; p.t = now;

    const br = st?.brush ?? 0.13;
    const steps = Math.max(1, Math.min(9, Math.floor((dist * GW * r.width) / Math.max(6, r.width * br * 0.45)) + 1));
    let res = null;
    for (let i = 0; i < steps; i++) {
      const f = (i + 1) / steps;
      const x = nx - (nx - (p.px ?? nx)) * (1 - f), y = ny - (ny - (p.py ?? ny)) * (1 - f);
      res = applyDab(ticket, def, x, y, br, st?.strength ?? 10);
      draw.current.sc = res.scratch;
      erase(x, y, br, p.v);
      if (i === 0) draw.current.sc = res.scratch;
    }
    p.px = nx; p.py = ny;
    if (res) {
      if (!started) setStarted(true);
      SFX.scratch(p.v);
      navigator.vibrate?.(6);
      schedule(res);
    }
  };

  const down = (e) => {
    if (disabled || !ticket || ticket.done) return;
    e.preventDefault();
    const p = ptr.current;
    p.on = true; p.px = null; p.py = null; p.v = 0;
    try { cv.current.setPointerCapture(e.pointerId); } catch {}
    const c = (cv.current || e.currentTarget).getBoundingClientRect();
    const W = Math.max(1, c.width), H = Math.max(1, c.height);
    p.x = (e.clientX - c.left - GX0 * W) / (GW * W);
    p.y = (e.clientY - c.top - GY0 * H) / (GH * H);
    p.px = p.x; p.py = p.y; p.t = performance.now();
    SFX.init();
    navigator.vibrate?.(8);
    strokeAt(e.clientX, e.clientY);
  };
  const move = (e) => {
    const p = ptr.current; if (!p.on) return;
    e.preventDefault();
    strokeAt(e.clientX, e.clientY);
  };
  const up = () => {
    const p = ptr.current; if (!p.on) return;
    p.on = false;
    const r = draw.current.sc || [];
    const th = def ? cellThreshold(def, st?.strength ?? 10) : 0.4;
    const revealed = r.filter((v) => v >= th).length;
    const coverage = r.reduce((a, b) => a + Math.min(1, b), 0) / 9;
    onScratch?.({ scratch: r, revealed, coverage, newly: [] });
  };

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  /* ---------- Scratch Bot / auto path ---------- */
  const auto = !!(s?.gadgets?.bot?.on && s?.gadgets?.bot?.lvl > 0 && ticket && !ticket.done && !ticket.claimAt);
  useEffect(() => {
    if (!auto || !def || !ticket) return;
    const iv = setInterval(() => {
      if (draw.current.done || disabled) return;
      const speed = Math.max(0.7, (s.gadgets.bot.lvl || 1) * 1.35 * (s.gadgets.egg?.until > Date.now() ? 1.8 : 1));
      const target = Math.min(9, (ticket.revealed || 0) + speed);
      const n = Math.floor(target);
      if (n <= (ticket.revealed || 0)) return;
      const r = revealCells(ticket, def, n - (ticket.revealed || 0), st?.strength ?? 10);
      draw.current.sc = r.scratch;
      for (const i of r.newly) { const [x, y] = cellCenter(i); erase(x, y, (st?.brush ?? 0.13) * 1.05, 0.4); }
      SFX.scratch(0.75);
      schedule(r);
    }, 190);
    return () => clearInterval(iv);
  }, [auto, def, ticket?.id, ticket?.revealed, disabled]);

  if (!ticket || !def) {
    return (
      <div className="tcard empty" ref={holder}>
        <div style={{ textAlign: 'center', padding: 18 }}>
          <Asset name="ticket" alt="" style={{ width: 148, margin: '0 auto 6px', opacity: 0.9 }} />
          <div className="d" style={{ fontSize: 15, fontWeight: 800 }}>No ticket on the table</div>
          <div className="note" style={{ marginTop: 4 }}>Buy one from the Catalogue — or flip on the Scratch Bot and let it work.</div>
        </div>
      </div>
    );
  }

  const done = ticket.done;
  const win = ticket.settled ? ticket.payout > 0 : null;

  return (
    <div className={cx('tcard', auto && 'botmode')} ref={holder}>
      <div className="tcard__art" style={{ backgroundImage: `url(${imgFor(def.art)})` }} />
      <div className="tcard__scrim" />
      <div className="tcard__head">
        <div className="tcard__name">{def.name}</div>
        <div className="tcard__rule">{def.win === 'instant' ? 'every cell pays' : def.win === 'final' ? 'win everything' : `match ${def.need || (def.win === 'match3' ? 3 : 2)} to win`}</div>
      </div>
      <div className="tcard__price">🪙 {def.price.toLocaleString()}</div>

      <div className="tgrid">
        {Array.from({ length: 9 }, (_, i) => {
          const sy = def.syms[ticket.grid[i]];
          const th = cellThreshold(def, st?.strength ?? 10);
          const open = (ticket.scratch?.[i] || 0) >= th || done;
          const isHit = open && done && ticket.win && ticket.grid[i] === ticket.syIdx;
          return (
            <div key={i} className={cx('cell', sy?.neg && 'neg', isHit && 'hit', open && 'open', !open && 'pen')}>
              <span className="sym" style={{ opacity: open ? 1 : 0 }}>{sy?.e}</span>
              {sy?.pay && <span className="pay" style={{ opacity: open ? 0.95 : 0 }}>{sy.pay >= 1 ? `${sy.pay}×` : `${Math.round(sy.pay * 100)}%`}</span>}
            </div>
          );
        })}
      </div>

      <canvas
        id="scratchCv" ref={cv}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      />

      {!started && !done && !auto && (
        <div className="stamp show" style={{ top: '62%', fontSize: 13, color: 'rgba(255,255,255,0.82)', letterSpacing: '0.22em', fontFamily: 'var(--font-d)' }}>
          SCRATCH HERE
        </div>
      )}
      {done && (
        <div className={cx('stamp show', win ? 'win' : 'lose')}>
          {win ? `+${(ticket.payout || 0).toLocaleString()}` : ticket.payoutMeta?.penalty ? 'HAZARD!' : 'NO WIN'}
        </div>
      )}
      {!done && (
        <div className="prog">
          <Bar value={ticket.coverage || 0} />
          <span>{Math.round((ticket.coverage || 0) * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function Bar({ value }) {
  return <div className="bar"><i style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}
