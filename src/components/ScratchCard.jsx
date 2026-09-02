// ============================================================
// ScratchCard — the heart of the game.
// The nine symbols are covered by a *paper seal* painted on a canvas: laid stock,
// fibres, letterpress stamp, deckled edges. One touch tears a whole cell off — ragged
// hole, bright fibre edge, cast shadow and a couple of slivers still hanging on.
// Everything (paper, holes, ticket face, glyphs) is drawn from data: zero bitmaps.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { rng } from '../ui/art.jsx';
import { motion } from 'motion/react';
import { TICKET_BY_ID } from '../game/config.js';
import { cellsForStroke, cellThreshold, revealCells, tearCells } from '../game/logic.js';
import { Bar, Coin, Icon, PAPER_OF, TicketFace, cx } from '../ui/base.jsx';
import SFX from '../game/sound.js';

// symbol grid inside the card — must match .tcard { --gx/--gy/--gw/--gh }
const GX0 = 0.07,
  GY0 = 0.25;
const GW = 0.86,
  GH = 0.6;
const N = 9;

const cellCenter = i => [(i % 3) / 3 + 1 / 6, Math.floor(i / 3) / 3 + 1 / 6];
const fmtPay = p => (p >= 1 ? `${p % 1 ? p.toFixed(2) : p}×` : `${Math.round(p * 100)}%`);

/**
 * @param {{ s?: any, ticket?: any, st?: any, onScratch?: ((r: any) => void) | null, onFinish?: (() => void) | null,
 *   disabled?: boolean, reduceFx?: boolean, skin?: string }} props
 */
export default function ScratchCard({
  s = null,
  ticket = null,
  st = null,
  onScratch = null,
  onFinish = null,
  disabled = false,
  reduceFx = false,
  skin = 'gold',
}) {
  const def = ticket ? TICKET_BY_ID[ticket.ticket] : null;
  const cv = useRef(null),
    holder = useRef(null),
    gloss = useRef(null),
    flakes = useRef(null);
  const draw = useRef({ ctx: null, w: 0, h: 0, dpr: 1, sc: null, done: false });
  const ptr = useRef({ on: false, x: 0, y: 0, t: 0, v: 0, px: null, py: null });
  const synced = useRef(0),
    pending = useRef(null),
    raf = useRef(0);
  const botRef = useRef({ i: 0, next: 0 });
  const ended = useRef(false);
  const live = useRef(0);
  const [started, setStarted] = useState(false);
  const [lift, setLift] = useState(false);
  const [cleared, setCleared] = useState(false);

  const paper = PAPER_OF(skin);
  const strength = st?.strength ?? 10;
  const th = def ? cellThreshold(def, strength) : 0.4;

  /* ---------------- the paper seal (painted from data — no bitmap anywhere) ----------------
     A slip of laid stock glued over the nine cells. One touch tears a whole cell off: ragged
     hole, bright fibre edge, the shadow the lifted paper casts on the print, and a couple of
     slivers still hanging. Deterministic per cell, so a resize repaints the same tears. */
  const EDGE = 0.016;
  const panelRect = D => ({
    x: (GX0 - EDGE) * D.w,
    y: (GY0 - EDGE) * D.h,
    w: GW * D.w + 2 * EDGE * D.w,
    h: GH * D.h + 2 * EDGE * D.h,
  });
  // the cell a touch opens, as a box on the canvas — centred on the symbol, so the
  // torn window always frames the print instead of clipping it
  const cellBox = (D, i, inset = 0.035) => {
    const cw = (GW / 3) * D.w * (1 - inset * 2),
      ch = (GH / 3) * D.h * (1 - inset * 2);
    const [fx, fy] = cellCenter(i);
    return { x: (GX0 + fx * GW) * D.w - cw / 2, y: (GY0 + fy * GH) * D.h - ch / 2, w: cw, h: ch };
  };

  /** a closed path around a box whose edge has been torn, not cut */
  const tearPath = (g, box, seed, amp, points = 46) => {
    const rnd = rng(seed);
    const { x, y, w, h } = box;
    const cx = x + w / 2,
      cy = y + h / 2;
    g.beginPath();
    for (let k = 0; k < points; k++) {
      const t = k / points;
      let px, py;
      if (t < 0.25) {
        px = x + (t / 0.25) * w;
        py = y;
      } else if (t < 0.5) {
        px = x + w;
        py = y + ((t - 0.25) / 0.25) * h;
      } else if (t < 0.75) {
        px = x + w - ((t - 0.5) / 0.25) * w;
        py = y + h;
      } else {
        px = x;
        py = y + h - ((t - 0.75) / 0.25) * h;
      }
      const dx = px - cx,
        dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      const n = (rnd() - 0.5) * 2 * amp;
      const X = px + (dx / len) * n,
        Y = py + (dy / len) * n;
      if (k) g.lineTo(X, Y);
      else g.moveTo(X, Y);
    }
    g.closePath();
  };

  /** rip one cell's paper off: the hole, the fibre edge, its shadow and two hanging slivers */
  const punch = (g, D, i) => {
    const box = cellBox(D, i);
    const amp = Math.max(1.8, Math.min(box.w, box.h) * 0.062); // fibres tear ragged, not straight
    const seed = `${def?.id || 'seal'}#${i}`;
    const dpr = D.dpr;
    g.save();
    // 1. shadow first, so the erase clips it to the paper side of the edge
    g.globalAlpha = 0.4;
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = Math.max(2, dpr * 2.4);
    g.save();
    g.translate(dpr * 0.8, dpr * 2.2);
    tearPath(g, box, seed, amp);
    g.stroke();
    g.restore();
    // 2. the hole
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    tearPath(g, box, seed, amp);
    g.fillStyle = '#000';
    g.fill();
    // 3. torn fibres catch the light
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.9;
    g.strokeStyle = '#fff';
    g.lineWidth = Math.max(0.7, dpr * 0.9);
    tearPath(g, box, seed, amp);
    g.stroke();
    // 4. two or three slivers still attached at the edge
    const rnd = rng(`${seed}-lip`);
    g.fillStyle = paper.stock;
    for (let k = 0; k < 3; k++) {
      const side = Math.floor(rnd() * 4);
      const f = 0.18 + rnd() * 0.64;
      const s = box.w * (0.06 + rnd() * 0.1);
      let ax, ay, bx, by, ox, oy;
      if (side === 0) {
        ax = box.x + f * box.w;
        ay = box.y;
        bx = ax + s;
        by = ay;
        ox = 0;
        oy = s * (0.7 + rnd());
      } else if (side === 1) {
        ax = box.x + box.w;
        ay = box.y + f * box.h;
        bx = ax;
        by = ay + s;
        ox = -s * (0.7 + rnd());
        oy = 0;
      } else if (side === 2) {
        ax = box.x + f * box.w;
        ay = box.y + box.h;
        bx = ax + s;
        by = ay;
        ox = 0;
        oy = -s * (0.7 + rnd());
      } else {
        ax = box.x;
        ay = box.y + f * box.h;
        bx = ax;
        by = ay + s;
        ox = s * (0.7 + rnd());
        oy = 0;
      }
      g.globalAlpha = 0.92;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.lineTo((ax + bx) / 2 + ox, (ay + by) / 2 + oy);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.5;
      g.strokeStyle = paper.shade;
      g.lineWidth = Math.max(0.5, dpr * 0.7);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  };

  const paintBase = useCallback(() => {
    const c = cv.current,
      D = draw.current;
    if (!c || !D.w || !D.ctx) return;
    const g = D.ctx;
    const thr = def ? cellThreshold(def, strength) : 0.4;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, D.w, D.h);
    const P = panelRect(D);
    const amp = Math.max(1.6, D.dpr * 1.9); // the deckled edge of the sheet

    // the seal lies ON the card: give it a shadow and a deckled silhouette
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = D.dpr * 7;
    g.shadowOffsetY = D.dpr * 2.5;
    g.fillStyle = paper.stock;
    tearPath(g, P, `${def?.id || 'seal'}-edge`, amp, 68);
    g.fill();
    g.restore();

    g.save();
    tearPath(g, P, `${def?.id || 'seal'}-edge`, amp, 68);
    g.clip();

    // 1. the stock: a soft warm-to-cool ramp, never a mirror
    const lg = g.createLinearGradient(P.x, P.y, P.x + P.w * 0.35, P.y + P.h);
    lg.addColorStop(0, '#ffffff');
    lg.addColorStop(0.14, paper.stock);
    lg.addColorStop(0.72, paper.stock);
    lg.addColorStop(1, paper.shade);
    g.fillStyle = lg;
    g.fillRect(P.x, P.y, P.w, P.h);

    // 2. laid + chain lines, the watermark grid of real paper
    g.save();
    g.strokeStyle = paper.fibre;
    g.globalAlpha = 0.1;
    g.lineWidth = Math.max(0.4, D.dpr * 0.5);
    const lay = Math.max(2.6, D.h / 170);
    for (let y = P.y; y < P.y + P.h; y += lay) {
      g.beginPath();
      g.moveTo(P.x, y);
      g.lineTo(P.x + P.w, y);
      g.stroke();
    }
    g.globalAlpha = 0.08;
    for (let x = P.x; x < P.x + P.w; x += lay * 9) {
      g.beginPath();
      g.moveTo(x, P.y);
      g.lineTo(x, P.y + P.h);
      g.stroke();
    }
    g.restore();

    // 3. fibres and specks — the fuzz you can feel
    const rnd = rng(`${def?.id || 'seal'}-fibre`);
    for (let k = 0; k < 420; k++) {
      const x = P.x + rnd() * P.w,
        y = P.y + rnd() * P.h;
      const light = rnd() > 0.45;
      g.globalAlpha = 0.03 + rnd() * 0.07;
      g.fillStyle = light ? '#fff' : paper.fibre;
      const s = 0.5 + rnd() * (D.dpr * 1.5);
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * 3.14);
      g.fillRect(-s, -s * 0.28, s * 2, s * 0.56);
      g.restore();
    }
    g.globalAlpha = 1;

    // 4. the sheet curls a little under the light
    const curl = g.createRadialGradient(P.x + P.w * 0.28, P.y + P.h * 0.2, P.w * 0.06, P.x + P.w * 0.5, P.y + P.h * 0.55, P.w);
    curl.addColorStop(0, 'rgba(255,255,255,0.5)');
    curl.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    curl.addColorStop(1, 'rgba(60,48,28,0.16)');
    g.fillStyle = curl;
    g.fillRect(P.x, P.y, P.w, P.h);

    // 5. letterpress stamp — debossed ink, so it belongs to the paper and tears with it
    g.save();
    g.textAlign = 'center';
    const cy0 = P.y + P.h * 0.5;
    const fs = Math.max(9, P.w * 0.082);
    g.font = `800 ${fs}px "Sora", "Manrope", system-ui, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText((def?.name || 'SEALED').toUpperCase(), P.x + P.w / 2 + 0.7, cy0 + 0.8);
    g.fillStyle = paper.ink;
    g.globalAlpha = 0.3;
    g.fillText((def?.name || 'SEALED').toUpperCase(), P.x + P.w / 2, cy0);
    g.globalAlpha = 0.22;
    g.font = `700 ${Math.max(5.5, fs * 0.3)}px "Manrope", system-ui, sans-serif`;
    const stamp = `${(def?.catName || 'SEALED').toUpperCase()} · NO. ${1000 + (def?.cat || 0) * 11 + ((def?.price || 0) % 900)} · ONE TOUCH TEARS`;
    g.fillText(stamp, P.x + P.w / 2, cy0 + fs * 0.92);
    g.strokeStyle = paper.ink;
    g.lineWidth = Math.max(0.6, D.dpr * 0.8);
    g.beginPath();
    g.moveTo(P.x + P.w * 0.2, cy0 - fs * 1.05);
    g.lineTo(P.x + P.w * 0.8, cy0 - fs * 1.05);
    g.moveTo(P.x + P.w * 0.2, cy0 + fs * 1.3);
    g.lineTo(P.x + P.w * 0.8, cy0 + fs * 1.3);
    g.stroke();
    g.restore();

    // 6. the print bumps through the paper: nine soft dimples
    for (let i = 0; i < N; i++) {
      const b = cellBox(D, i);
      g.save();
      g.globalAlpha = 0.07;
      g.fillStyle = paper.shade;
      roundRect(g, b.x + 2, b.y + 2, b.w - 4, b.h - 4, Math.min(b.w, b.h) * 0.13);
      g.fill();
      g.globalAlpha = 0.5;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(0.5, D.dpr * 0.7);
      roundRect(g, b.x + 2, b.y + 1.4, b.w - 4, b.h - 4, Math.min(b.w, b.h) * 0.13);
      g.stroke();
      g.restore();
    }

    // 7. glue shadow all round the seal
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = '#2a2118';
    g.lineWidth = Math.max(2, D.dpr * 4);
    tearPath(g, P, `${def?.id || 'seal'}-edge`, amp, 68);
    g.stroke();
    g.restore();

    // 8. whatever the game already considers open gets ripped off
    const sc = D.sc || [];
    for (let i = 0; i < N; i++) {
      if ((sc[i] || 0) >= thr) punch(g, D, i);
    }
    g.restore();
  }, [def, paper, strength]);

  // the equipped coating tints the stock and the ink, so repaint when it changes
  // the equipped coating tints the stock + ink, so repaint when it changes
  useEffect(() => {
    paintBase();
  }, [skin, paintBase]);

  useEffect(() => {
    const c = cv.current,
      host = holder.current;
    if (!c || !host) return undefined;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      draw.current.w = c.width;
      draw.current.h = c.height;
      draw.current.dpr = dpr;
      draw.current.ctx = c.getContext('2d');
      paintBase();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [paintBase]);

  /* ---------------- ticket switch ---------------- */
  useEffect(() => {
    ended.current = false;
    draw.current.done = false;
    draw.current.sc = ticket ? ticket.scratch.slice() : null;
    setStarted(!!ticket && (ticket.coverage || 0) > 0.001);
    setCleared(false);
    requestAnimationFrame(() => paintBase());
    botRef.current = { i: 0, next: 0 };
  }, [ticket?.id, paintBase]);

  useEffect(() => {
    if (!ticket) return;
    if (draw.current.sc && Math.abs((draw.current.sc[0] || 0) - (ticket.scratch[0] || 0)) > 0.5) return;
    if (!ticket.manual && !ticket.auto) return; // don't fight the local stroke
    draw.current.sc = ticket.scratch.slice();
    paintBase();
  }, [ticket?.scratch?.join(',')]);

  /* ---------------- shavings ---------------- */
  const puff = (clientX, clientY, n = 1) => {
    if (reduceFx || !flakes.current || !holder.current || typeof Element.prototype.animate !== 'function') return;
    if (live.current > 26) return;
    const box = holder.current.getBoundingClientRect();
    const host = flakes.current;
    for (let k = 0; k < n; k++) {
      const el = document.createElement('i');
      el.className = 'flake';
      const w = 6 + Math.random() * 12; // paper tears in chunks, foil in dust
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.62}px`;
      el.style.left = `${clientX - box.left}px`;
      el.style.top = `${clientY - box.top}px`;
      el.style.background = `linear-gradient(160deg, #fff 0%, ${paper.stock} 48%, ${paper.shade} 100%)`;
      el.style.boxShadow = 'inset 0 0 0 0.5px rgba(0,0,0,0.10)';
      host.appendChild(el);
      live.current += 1;
      const dx = (Math.random() - 0.5) * 90;
      const dy = 40 + Math.random() * 90;
      el.animate(
        [
          { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${(Math.random() - 0.5) * 620}deg)`,
            opacity: 0,
          },
        ],
        { duration: 560 + Math.random() * 480, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }
      )
        .finished.then(() => {
          el.remove();
          live.current -= 1;
        })
        .catch(() => {
          el.remove();
          live.current -= 1;
        });
    }
  };

  /* ---------------- brush ---------------- */

  const schedule = res => {
    pending.current = res;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = pending.current;
      if (!r) return;
      const now = performance.now();
      if (now - synced.current > 140) {
        synced.current = now;
        onScratch?.({ scratch: r.scratch, revealed: r.revealed, coverage: r.coverage, newly: r.newly });
      }
      console.log('[dbg-sched] complete', r.complete, 'ended', ended.current, 'rev', r.revealed);
      if (r.complete && !ended.current) {
        ended.current = true;
        draw.current.done = true;
        setCleared(true);
        onFinish?.();
      }
    });
  };

  const moveGloss = (clientX, clientY) => {
    const el = gloss.current,
      host = holder.current;
    if (!el || !host) return;
    const b = host.getBoundingClientRect();
    el.style.setProperty('--mx', `${((clientX - b.left) / b.width) * 100}%`);
    el.style.setProperty('--my', `${((clientY - b.top) / b.height) * 100}%`);
    el.style.opacity = '1';
  };

  /* one touch = one torn cell. `draw.current.sc` is the local truth between store
     commits, so a fast drag never rolls back the cell torn 40ms earlier. */
  const strokeAt = (clientX, clientY) => {
    if (!ticket || ticket.done || disabled || !def) return;
    const c = cv.current,
      D = draw.current;
    if (!c || !D.ctx) return;
    const r = c.getBoundingClientRect();
    const nx = (clientX - r.left - GX0 * r.width) / (GW * r.width);
    const ny = (clientY - r.top - GY0 * r.height) / (GH * r.height);
    const p = ptr.current;
    const now = performance.now();
    const dist = Math.hypot(nx - p.x, ny - p.y);
    const dt = Math.max(8, now - (p.t || now));
    p.v = Math.min(1, p.v * 0.6 + Math.min(2.2, dist / (dt / 16)) * 0.4);
    p.x = nx;
    p.y = ny;
    p.t = now;

    const cur = D.sc || ticket.scratch.slice();
    const reach = 0.09 + Math.min(0.12, (strength - 1) * 0.008); // the Quarter coin widens the tear
    const hit = cellsForStroke(p.px ?? nx, p.py ?? ny, nx, ny, reach).filter(i => (cur[i] || 0) < th);
    p.px = nx;
    p.py = ny;
    if (!hit.length) return;

    const res = tearCells({ ...ticket, scratch: cur }, def, hit, strength);
    D.sc = res.scratch;
    for (const i of hit) punch(D.ctx, D, i);
    if (!started) setStarted(true);
    SFX.tear(hit.length);
    puff(clientX, clientY, reduceFx ? 1 : 2 + hit.length * 2);
    navigator.vibrate?.(reduceFx ? 0 : 9 + 4 * hit.length);
    schedule(res);
  };

  const down = e => {
    if (disabled || !ticket || ticket.done) return;
    e.preventDefault();
    const p = ptr.current;
    p.on = true;
    p.px = null;
    p.py = null;
    p.v = 0;
    setLift(true);
    try {
      cv.current.setPointerCapture(e.pointerId);
    } catch {}
    SFX.init();
    navigator.vibrate?.(reduceFx ? 0 : 10);
    strokeAt(e.clientX, e.clientY);
  };
  const move = e => {
    if (!ptr.current.on) return;
    e.preventDefault();
    moveGloss(e.clientX, e.clientY);
    strokeAt(e.clientX, e.clientY);
  };
  const up = () => {
    if (!ptr.current.on) return;
    ptr.current.on = false;
    setLift(false);
    gloss.current && (gloss.current.style.opacity = '0');
    const r = draw.current.sc || [];
    const revealed = r.filter(v => v >= th).length;
    const coverage = r.reduce((a, b) => a + Math.min(1, b), 0) / N;
    onScratch?.({ scratch: r, revealed, coverage, newly: [] });
  };
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    []
  );

  /* ---------------- scratch bot ---------------- */
  const auto = !!(s?.gadgets?.bot?.on && s?.gadgets?.bot?.lvl > 0 && ticket && !ticket.done && !ticket.claimAt);
  useEffect(() => {
    if (!auto || !def || !ticket) return undefined;
    const iv = setInterval(() => {
      if (draw.current.done || disabled) return;
      const speed = Math.max(0.7, (s.gadgets.bot.lvl || 1) * 1.35 * (s.gadgets.egg?.until > Date.now() ? 1.8 : 1));
      const target = Math.min(N, (ticket.revealed || 0) + speed);
      const n = Math.floor(target);
      if (n <= (ticket.revealed || 0)) return;
      const r = revealCells(ticket, def, n - (ticket.revealed || 0), strength);
      draw.current.sc = r.scratch;
      for (const i of r.newly) {
        punch(draw.current.ctx, draw.current, i);
        const [x, y] = cellCenter(i);
        const c = cv.current?.getBoundingClientRect();
        if (c) puff(c.left + (GX0 + x * GW) * c.width, c.top + (GY0 + y * GH) * c.height, 2);
      }
      SFX.tear(1);
      schedule(r);
    }, 190);
    return () => clearInterval(iv);
  }, [auto, def, ticket?.id, ticket?.revealed, disabled]);

  /* ---------------- empty ---------------- */
  if (!ticket || !def) {
    return (
      <div className="tcard empty" ref={holder}>
        <span className="empty__mark">
          <Icon name="deck" size={54} />
        </span>
        <div className="h3" style={{ fontSize: 16 }}>
          No ticket on the table
        </div>
        <div className="note" style={{ maxWidth: 220 }}>
          Buy one from the Catalogue — or flip on the Scratch Bot and let the machine work while you don't.
        </div>
      </div>
    );
  }

  const done = ticket.done;
  const win = ticket.settled ? ticket.payout > 0 : null;
  const hits = [];
  if (done && ticket.syIdx != null) {
    for (let i = 0; i < N; i++) if (ticket.grid[i] === ticket.syIdx) hits.push(i);
  }
  // the chip counts *cells opened* — with a paper seal a cell is torn or it isn't, and a
  // fractional "46%" while every symbol is visible would just be confusing
  const cov = ((ticket.revealed ?? 0) || (ticket.scratch?.filter?.(v => v >= th).length ?? 0)) / N;

  return (
    <div className="tcard-shell">
      <div
        className={cx('tcard', auto && 'tcard--bot', lift && 'tcard--lift')}
        ref={holder}
        onPointerMove={e => {
          if (reduceFx || e.pointerType !== 'mouse' || ptr.current.on) return;
          const b = holder.current.getBoundingClientRect();
          holder.current.style.setProperty('--ry', `${((e.clientX - b.left) / b.width - 0.5) * 7}deg`);
          holder.current.style.setProperty('--rx', `${(0.5 - (e.clientY - b.top) / b.height) * 7}deg`);
        }}
        onPointerLeave={() => {
          holder.current?.style.setProperty('--rx', '0deg');
          holder.current?.style.setProperty('--ry', '0deg');
          if (gloss.current) gloss.current.style.opacity = '0';
        }}>
        <div className="tcard__face">
          {/* the live card keeps its printed art quiet — the seal sits on top of it */}
          <TicketFace def={def} motif={0.2} field={0.16} />
        </div>

        <div className="tcard__grid">
          {Array.from({ length: N }, (_, i) => {
            const sy = def.syms[ticket.grid[i]];
            const open = (ticket.scratch?.[i] || 0) >= th || done;
            const isHit = open && done && ticket.win && ticket.grid[i] === ticket.syIdx;
            return (
              <div key={i} className={cx('cell', open && 'open', sy?.neg && 'cell--neg', isHit && 'cell--hit')}>
                <span className="sym">
                  <Icon name={sy?.e || 'none'} size={open ? 26 : 24} title={sy?.neg ? 'penalty' : undefined} />
                </span>
                {sy?.pay ? <span className="pay">{sy.pay < 0 ? `${Math.round(-sy.pay * 100)}%` : fmtPay(sy.pay)}</span> : null}
                <i className="cell__line" />
              </div>
            );
          })}
        </div>

        {hits.length > 1 ? (
          <svg
            className="payline"
            viewBox="0 0 3 3"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{
              left: 'var(--gx)',
              top: 'var(--gy)',
              width: 'var(--gw)',
              height: 'var(--gh)',
              position: 'absolute',
              zIndex: 7,
              pointerEvents: 'none',
            }}>
            <motion.polyline
              points={hits.map(i => `${(i % 3) + 0.5},${Math.floor(i / 3) + 0.5}`).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.055"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: reduceFx ? 0 : 0.55, ease: 'easeOut', delay: 0.05 }}
            />
          </svg>
        ) : null}

        <canvas
          id="scratchCv"
          ref={cv}
          className={cx('scratchcv', cleared && 'gone')}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
        />
        <div className="tcard__gloss" ref={gloss} aria-hidden="true" />
        <div className="tcard__edge" />
        <div className="tcard__sheen" />
        <div className="flakes" ref={flakes} aria-hidden="true" />
        <div className="coin-cur" aria-hidden="true">
          <Coin value={st?.coin?.v ?? 1} size={26} skin={skin} />
        </div>

        {!started && !done && !auto ? <div className="hint-scratch">touch the paper</div> : null}

        {done ? (
          <div className={cx('stamp', 'show', win ? 'stamp--win' : 'stamp--lose')}>
            {win ? `won ${ticket.payout?.toLocaleString?.() ?? ''}` : 'no win'}
          </div>
        ) : null}
      </div>

      <div className="prog" title="cells torn open">
        <Bar value={cov} />
        <span>{Math.round(cov * 100)}%</span>
      </div>
    </div>
  );
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) {
    g.roundRect(x, y, w, h, r);
    return;
  }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
