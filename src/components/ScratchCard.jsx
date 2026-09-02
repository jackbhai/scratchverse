// ============================================================
// ScratchCard — the heart of the game.
// Coating is painted procedurally on a canvas from the equipped metal
// (SKIN_METAL → CSS/SVG gradients only: there is no bitmap in this app),
// coverage drives the reveal, matched cells get a drawn pay-line,
// shavings are real DOM flakes animated with WAAPI.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { TICKET_BY_ID } from '../game/config.js';
import { applyDab, revealCells, cellThreshold } from '../game/logic.js';
import { Bar, Coin, Icon, SKIN_METAL, TicketFace, cx } from '../ui/base.jsx';
import SFX from '../game/sound.js';

// symbol grid inside the card — must match .tcard { --gx/--gy/--gw/--gh }
const GX0 = 0.07,
  GY0 = 0.25;
const GW = 0.86,
  GH = 0.6;
const N = 9;

const cellCenter = i => [(i % 3) / 3 + 1 / 6, Math.floor(i / 3) / 3 + 1 / 6];
const normOf = i => [(i % 3) / 2, Math.floor(i / 3) / 2];
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
  const draw = useRef({ ctx: null, w: 0, h: 0, dpr: 1, img: null, sc: null, done: false, metal: 'gold' });
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

  const metal = SKIN_METAL[skin] || SKIN_METAL.gold;
  const strength = st?.strength ?? 10;
  const th = def ? cellThreshold(def, strength) : 0.4;

  /* ---------------- foil painting (procedural metal panel, no image assets) ----------------
     Only the play panel is coated: the frame, top rail, motif and name plate stay visible like a
     printed card. Everything is painted in one pass, so there are no bitmap tile seams. */
  const panelRect = (D, pad = 0.012) => ({
    x: (GX0 - pad) * D.w,
    y: (GY0 - pad) * D.h,
    w: GW * D.w + pad * 2 * D.w,
    h: GH * D.h + pad * 2 * D.h,
  });

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

    g.save();
    roundRect(g, P.x, P.y, P.w, P.h, Math.min(P.w, P.h) * 0.09);
    g.clip();

    // 1. the metal: one wide gradient, so nothing repeats
    const lg = g.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h);
    lg.addColorStop(0, metal.hi);
    lg.addColorStop(0.22, metal.mid);
    lg.addColorStop(0.46, metal.low);
    lg.addColorStop(0.6, metal.mid);
    lg.addColorStop(0.78, metal.hi);
    lg.addColorStop(1, metal.mid);
    g.fillStyle = lg;
    g.fillRect(P.x, P.y, P.w, P.h);

    // 2. brushed hairlines — the security texture of a real coating
    g.save();
    g.globalAlpha = 0.1;
    g.strokeStyle = '#000';
    g.lineWidth = Math.max(0.5, D.dpr * 0.55);
    const step = Math.max(3.2, D.h / 120);
    for (let y = P.y - P.w; y < P.y + P.h + P.w; y += step) {
      g.beginPath();
      g.moveTo(P.x, y);
      g.lineTo(P.x + P.w, y + P.w * 0.06);
      g.stroke();
    }
    g.restore();

    // 3. catalogue tint, so each ticket's coating reads a little differently
    if (def?.tint) {
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.22;
      g.fillStyle = def.tint;
      g.fillRect(P.x, P.y, P.w, P.h);
      g.restore();
    }

    // 4. one smooth specular sweep from the top-left light
    const sp = g.createRadialGradient(P.x + P.w * 0.3, P.y + P.h * 0.16, P.w * 0.05, P.x + P.w * 0.5, P.y + P.h * 0.5, P.w * 0.95);
    sp.addColorStop(0, 'rgba(255,255,255,0.30)');
    sp.addColorStop(0.42, 'rgba(255,255,255,0.05)');
    sp.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = sp;
    g.fillRect(P.x, P.y, P.w, P.h);

    // 5. microprint, two whisper-quiet lines like real card printing
    g.save();
    g.globalAlpha = 0.1;
    g.fillStyle = '#000';
    g.font = `700 ${Math.max(5.5, D.dpr * 4.6)}px "Manrope", system-ui, sans-serif`;
    const word = `${(def?.name || 'SCRATCH').toUpperCase()} · SECURE · `;
    for (let i = 0; i < 2; i++) g.fillText(word.repeat(10), P.x + 2, P.y + P.h * (0.035 + i * 0.012));
    g.restore();

    // 6. the nine cell wells under the foil — you can read the layout through it
    for (let i = 0; i < N; i++) {
      const [fx, fy] = normOf(i);
      const x = (GX0 + fx * GW) * D.w,
        y = (GY0 + fy * GH) * D.h;
      const cw = (GW / 3) * D.w,
        ch = (GH / 3) * D.h,
        r = Math.min(cw, ch) * 0.13;
      g.fillStyle = 'rgba(0,0,0,0.13)';
      roundRect(g, x - cw / 2 + 2, y - ch / 2 + 2, cw - 4, ch - 4, r);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = Math.max(0.5, D.dpr * 0.8);
      roundRect(g, x - cw / 2 + 2.5, y - ch / 2 + 2.5, cw - 5, ch - 5, r);
      g.stroke();
    }

    // 7. re-erase whatever the store already considers scratched
    const sc = D.sc || [];
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < N; i++) {
      if (!sc[i] || sc[i] < thr) continue;
      const [fx, fy] = cellCenter(i);
      const x = (GX0 + fx * GW) * D.w,
        y = (GY0 + fy * GH) * D.h;
      g.beginPath();
      g.arc(x, y, Math.max(D.w * 0.24, D.h * 0.17), 0, 7);
      g.fill();
    }
    g.restore();
    g.globalCompositeOperation = 'source-over';

    // 8. the panel rim, drawn outside the clip so it stays crisp
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = Math.max(0.7, D.dpr);
    roundRect(g, P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1, Math.min(P.w, P.h) * 0.09);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    roundRect(g, P.x + 1.6, P.y + 1.6, P.w - 3.2, P.h - 3.2, Math.min(P.w, P.h) * 0.085);
    g.stroke();
  }, [def, metal, strength]);

  // the equipped metal decides the paint; re-forecast whenever the skin changes
  useEffect(() => {
    draw.current.metal = skin;
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
    if (reduceFx || !flakes.current || !holder.current) return;
    if (live.current > 26) return;
    const box = holder.current.getBoundingClientRect();
    const host = flakes.current;
    for (let k = 0; k < n; k++) {
      const el = document.createElement('i');
      el.className = 'flake';
      const w = 5 + Math.random() * 9;
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.62}px`;
      el.style.left = `${clientX - box.left}px`;
      el.style.top = `${clientY - box.top}px`;
      el.style.background = `linear-gradient(160deg, ${metal.hi}, ${metal.mid} 45%, ${metal.low})`;
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
  const erase = (nx, ny, r, v = 0.55) => {
    const D = draw.current;
    if (!D.ctx || !D.w) return;
    const g = D.ctx;
    const x = (GX0 + nx * GW) * D.w,
      y = (GY0 + ny * GH) * D.h;
    const radX = D.w * r,
      radY = (radX * (D.h / D.w)) / (GH / GW);
    g.save();
    g.translate(x, y);
    g.scale(1, radY / radX);
    g.translate(-x, -y);
    // torn-foil lip: a bright curl left *behind* the cleared area
    g.globalCompositeOperation = 'source-over';
    const lip = g.createRadialGradient(x, y, radX * 0.72, x, y, radX * 1.16);
    lip.addColorStop(0, 'rgba(0,0,0,0)');
    lip.addColorStop(0.55, `rgba(255,255,255,${0.1 + v * 0.16})`);
    lip.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = lip;
    g.beginPath();
    g.arc(x, y, radX * 1.16, 0, 7);
    g.fill();
    // the actual clear
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(x, y, radX * 0.42, x, y, radX);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.74, 'rgba(0,0,0,0.96)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, radX, 0, 7);
    g.fill();
    g.restore();
    g.globalCompositeOperation = 'source-over';
  };

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

  const strokeAt = (clientX, clientY) => {
    if (!ticket || ticket.done || disabled || !def) return;
    const c = cv.current;
    if (!c) return;
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

    const br = st?.brush ?? 0.13;
    const steps = Math.max(1, Math.min(9, Math.floor((dist * GW * r.width) / Math.max(6, r.width * br * 0.45)) + 1));
    let res = null;
    for (let i = 0; i < steps; i++) {
      const f = (i + 1) / steps;
      const x = nx - (nx - (p.px ?? nx)) * (1 - f),
        y = ny - (ny - (p.py ?? ny)) * (1 - f);
      res = applyDab(ticket, def, x, y, br, strength);
      draw.current.sc = res.scratch;
      erase(x, y, br, p.v);
    }
    p.px = nx;
    p.py = ny;
    if (res) {
      if (!started) setStarted(true);
      SFX.scratch(p.v);
      if (p.v > 0.25) puff(clientX, clientY, p.v > 0.8 ? 2 : 1);
      navigator.vibrate?.(reduceFx ? 0 : 6);
      schedule(res);
    }
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
        const [x, y] = cellCenter(i);
        erase(x, y, (st?.brush ?? 0.13) * 1.05, 0.4);
        const c = cv.current?.getBoundingClientRect();
        if (c) puff(c.left + (GX0 + x * GW) * c.width, c.top + (GY0 + y * GH) * c.height, 1);
      }
      SFX.scratch(0.75);
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
  const cov = ticket.scratch?.reduce?.((a, b) => a + Math.min(1, b), 0) / N || 0;

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
          {/* the live card keeps its printed art quiet — the foil panel owns the middle */}
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

        {!started && !done && !auto ? <div className="hint-scratch">scratch to reveal</div> : null}

        {done ? (
          <div className={cx('stamp', 'show', win ? 'stamp--win' : 'stamp--lose')}>
            {win ? `won ${ticket.payout?.toLocaleString?.() ?? ''}` : 'no win'}
          </div>
        ) : null}
      </div>

      <div className="prog" title="foil cleared">
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
