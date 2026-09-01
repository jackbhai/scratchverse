// ============================================================
// ScratchVerse — event overlays: toasts, wins, coin rain, phone,
// daily gift, prestige flash, onboarding.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store.js';
import { fmt } from '../game/fmt.js';
import { ENDINGS } from '../game/config.js';
import { Asset, Sheet, cx } from '../ui/base.jsx';
import SFX from '../game/sound.js';

function Rain({ n = 18 }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({
    l: Math.random() * 100, d: 0.9 + Math.random() * 1.15, delay: Math.random() * 0.7,
    s: 18 + Math.random() * 26, r: Math.random() * 360, e: ['🪙', '💰', '✨', '💎'][Math.floor(Math.random() * 4)],
  })), [n]);
  return (
    <div className="rain">
      {bits.map((b, i) => (
        <i key={i} style={{
          left: `${b.l}%`, animationDuration: `${b.d}s`, animationDelay: `${b.delay}s`,
          width: b.s, height: b.s, fontSize: b.s, lineHeight: `${b.s}px`,
          transform: `rotate(${b.r}deg)`, background: 'none',
        }}>{b.e}</i>
      ))}
    </div>
  );
}

function WinBurst({ win, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, win.super ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [win, onClose]);
  return (
    <>
      <div className={cx('flash', 'big')} />
      <Rain n={win.super ? 34 : Math.min(24, 8 + Math.round(Math.log10(1 + win.pay) * 4))} />
      <div className="veil" onClick={onClose} style={{ background: 'radial-gradient(60% 40% at 50% 45%, rgba(255,190,60,0.18), rgba(2,3,7,0.9))' }}>
        <div className="sheet" style={{ textAlign: 'center', background: 'linear-gradient(180deg,#1b1708,#0a0c13)' }} onClick={(e) => e.stopPropagation()}>
          <Asset name={win.super ? 'crown' : 'coins'} alt="" style={{ width: 108, margin: '0 auto 4px' }} />
          <div className="dim tiny" style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}>{win.super ? 'super jackpot' : win.ticket}</div>
          <div className="d" style={{ fontSize: 40, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.04em', lineHeight: 1.05 }}>
            +{fmt(win.pay)}
          </div>
          <div className="note">{win.ratio >= 10 ? `${win.ratio.toFixed(1)}× the ticket price — disgusting.` : `${win.ratio >= 1 ? win.ratio.toFixed(1) : (win.ratio * 100).toFixed(0) + '%'} of the price back.`}</div>
          <button className="btn p w" style={{ marginTop: 12 }} onClick={onClose}>Nice</button>
        </div>
      </div>
    </>
  );
}

function PhoneSheet({ open, onClose, dispatch, endings }) {
  const [wait, setWait] = useState(0);
  const t = useRef(0);
  useEffect(() => () => clearInterval(t.current), []);
  useEffect(() => { if (!open) setWait(0); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="☎️ The Corporation">
      <div className="card flat" style={{ marginBottom: 10 }}>
        <div className="note">
          “Congratulations. You won the Final Chance. We have a briefcase and a contract — pick one.
          Take the money and we keep the ticket. Leave it and keep the ticket. Or don't touch anything
          for 60 seconds… and see who collects it for you.”
        </div>
      </div>
      {wait > 0 ? (
        <div className="card glow" style={{ textAlign: 'center' }}>
          <div className="d" style={{ fontSize: 34, fontWeight: 800, color: 'var(--violet)' }}>{wait}</div>
          <div className="note">Hands off. Something is coming to the door.</div>
        </div>
      ) : (
        <div className="stack">
          <button className="btn p w" onClick={() => { dispatch({ type: 'ENDING', kind: 'claim' }); onClose(); }}>Claim the payout</button>
          <button className="btn w" onClick={() => { dispatch({ type: 'ENDING', kind: 'walk' }); onClose(); }}>Hang up & walk away</button>
          <button className="btn v w" onClick={() => {
            let n = 60; setWait(n);
            clearInterval(t.current);
            t.current = setInterval(() => {
              n -= 1; setWait(n);
              if (n <= 0) { clearInterval(t.current); setWait(0); dispatch({ type: 'ENDING', kind: 'faithful' }); onClose(); }
            }, 1000);
          }}>Wait it out (60s · secret)</button>
        </div>
      )}
      {endings?.length ? (
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 5 }}>
          {endings.map((k) => <span key={k} className="chip good">{ENDINGS[k]?.e} {ENDINGS[k]?.name}</span>)}
        </div>
      ) : null}
    </Sheet>
  );
}

export default function Overlays() {
  const { s, dispatch } = useGame();
  const [toasts, setToasts] = useState([]);
  const [win, setWin] = useState(null);
  const [rain, setRain] = useState(0);
  const [float, setFloat] = useState([]);
  const sheet = s.ui?.sheet;

  const eat = (ev) => dispatch({ type: 'QUEUE_POP', id: ev.id });
  useEffect(() => {
    const list = s.queue || [];
    if (!list.length) return;
    for (const ev of list) {
      switch (ev.t) {
        case 'toast':
          setToasts((x) => [...x.slice(-3), { id: ev.id, text: ev.text, kind: ev.kind }]);
          setTimeout(() => setToasts((x) => x.filter((i) => i.id !== ev.id)), 2600);
          break;
        case 'sound':
          SFX[ev.v]?.();
          break;
        case 'rain':
          setRain((r) => Math.max(r, ev.v || 14));
          setTimeout(() => setRain(0), 2200);
          break;
        case 'win':
          setWin(ev);
          SFX[ev.super || (ev.ratio >= 6 ? 'jackpot' : 'win')]?.();
          if (ev.super) navigator.vibrate?.([40, 60, 40, 60, 120]);
          break;
        case 'level':
          setToasts((x) => [...x, { id: ev.id + 'l', text: `Level ${ev.v}! +${fmt(ev.bonus)} coins`, kind: 'win' }]);
          setTimeout(() => setToasts((x) => x.filter((i) => i.id !== ev.id + 'l')), 3000);
          SFX.level();
          break;
        case 'achv':
          setToasts((x) => [...x, { id: ev.id + 'a', text: `${ev.e} ${ev.name} · +${ev.tok}🎟️`, kind: 'good' }]);
          SFX.coin(3);
          setTimeout(() => setToasts((x) => x.filter((i) => i.id !== ev.id + 'a')), 3400);
          break;
        case 'gift':
          setToasts((x) => [...x, { id: ev.id + 'g', text: `Daily stash +${fmt(ev.coins)}${ev.jp ? ` +${ev.jp}JP` : ''}`, kind: 'good' }]);
          setTimeout(() => setToasts((x) => x.filter((i) => i.id !== ev.id + 'g')), 3200);
          break;
        case 'float':
          setFloat((x) => [...x, { id: ev.id, text: ev.text }]);
          setTimeout(() => setFloat((x) => x.filter((i) => i.id !== ev.id)), 1100);
          break;
        case 'prestige':
          setRain(30);
          setToasts((x) => [...x, { id: ev.id + 'p', text: `Prestige! +${ev.gain} JP`, kind: 'win' }]);
          setTimeout(() => setToasts((x) => x.filter((i) => i.id !== ev.id + 'p')), 3600);
          break;
        case 'phone':
          dispatch({ type: 'UI', patch: { sheet: 'phone' } });
          break;
        default: break;
      }
      eat(ev);
    }
  }, [s.queue]);

  return (
    <>
      {toasts.length ? (
        <div className="toasts">
          {toasts.map((t, i) => <div key={i} className={cx('toast', t.kind)}>{t.text}</div>)}
        </div>
      ) : null}
      {float.length ? (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
          {float.map((f, i) => (
            <span key={i} className="floaty" style={{ left: `${44 + i * 4}%`, top: '44%' }}>{f.text}</span>
          ))}
        </div>
      ) : null}
      {rain ? <Rain n={rain} /> : null}
      {win ? <WinBurst win={win} onClose={() => { setWin(null); }} /> : null}
      <PhoneSheet open={sheet === 'phone'} endings={s.endings} dispatch={dispatch} onClose={() => dispatch({ type: 'UI', patch: { sheet: null } })} />
      <GiftSheet open={sheet === 'gift'} onClose={() => dispatch({ type: 'UI', patch: { sheet: null } })} />
    </>
  );
}

function GiftSheet({ open, onClose }) {
  const { s, dispatch } = useGame();
  if (!open) return null;
  const ready = s.daily.day !== todayKeyLocal() || !s.daily.claimed;
  return (
    <Sheet open onClose={onClose} title="Daily stash"
      foot={<button className={cx('btn p w', !ready && 'd')} disabled={!ready}
        onClick={() => { dispatch({ type: 'DAILY' }); onClose(); }}>{ready ? 'Claim stash' : 'Already claimed — come back tomorrow'}</button>}>
      <div style={{ textAlign: 'center' }}>
        <Asset name="gift" alt="" style={{ width: 128, margin: '0 auto 8px' }} />
        <div className="h3" style={{ fontSize: 16 }}>Day {s.daily.streak + (ready ? 1 : 0)} streak</div>
        <div className="note">Stash scales with your run peak {fmt(Math.max(200, Math.round((s.run.peak || 0) * 0.06 + (s.lifetime.earn || 0) * 0.0015)))} coins base.
          6 days in a row adds a JP.</div>
      </div>
      <hr className="sep" />
      <div className="row tiny dim">Also refills your Spellbook charges and marks the day as visited.</div>
    </Sheet>
  );
}
const todayKeyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Onboard() {
  const { dispatch } = useGame();
  const [name, setName] = useState('');
  return (
    <div className="veil" style={{ zIndex: 95 }}>
      <div className="sheet" style={{ textAlign: 'center' }}>
        <Asset name="logo" alt="" style={{ width: 92, margin: '0 auto 8px', borderRadius: 24 }} />
        <h3 className="d">Welcome to ScratchVerse</h3>
        <div className="note" style={{ marginBottom: 12 }}>
          Scratch cards, build luck, automate with bots, then prestige for Jack Points.
          Everything is saved on this device — offline, no account, no real money.
        </div>
        <div className="grid3" style={{ marginBottom: 12 }}>
          {[['👆', 'Scratch'], ['🤖', 'Automate'], ['🟣', 'Prestige']].map(([e, t]) => (
            <div key={t} className="card flat" style={{ padding: 9 }}>
              <div style={{ fontSize: 22 }}>{e}</div><div className="tiny h3">{t}</div>
            </div>
          ))}
        </div>
        <input
          placeholder="Your nameplate" value={name} maxLength={12} onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 12, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--line)', color: 'var(--txt)', marginBottom: 10, textAlign: 'center' }} />
        <button className="btn p w" onClick={() => { SFX.init(); dispatch({ type: 'ONBOARD', name: name || 'Maxed', bonus: 35 }); }}>
          Start with {fmt(15 + 35)} coins
        </button>
      </div>
    </div>
  );
}
