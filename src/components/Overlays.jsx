// ============================================================
// ScratchVerse — event overlays: toasts, win burst, coin rain, the
// phone call, daily stash, onboarding. Everything vector, everything
// closable.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, dispatch as push } from '../store.js';
import { fmt } from '../game/fmt.js';
import { ENDINGS } from '../game/config.js';
import { Coin, Crest, Icon, Modal, cx, metalCss } from '../ui/base.jsx';
import SFX from '../game/sound.js';

const KIND = { good: 'mint', win: 'gold', bad: 'red', level: 'gold', achv: 'gold' };

/* ---------------------------------------------------------------- rain */
function Rain({ n = 18, skin = 'gold' }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        l: Math.random() * 100,
        d: 0.85 + Math.random() * 1.2,
        delay: Math.random() * 0.65,
        s: 14 + Math.random() * 22,
        v: [1, 5, 10, 25, 50][Math.floor(Math.random() * 5)],
        spin: Math.random() < 0.25,
      })),
    [n]
  );
  return (
    <div className="rain" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={{ position: 'absolute', left: `${b.l}%`, top: 0, animation: `coinFall ${b.d}s linear ${b.delay}s forwards` }}>
          {b.spin ? (
            <span
              style={{
                display: 'block',
                width: b.s * 0.5,
                height: b.s,
                background: 'linear-gradient(180deg,var(--gold-hi),var(--gold-lo))',
                clipPath: 'polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%)',
              }}
            />
          ) : (
            <Coin value={b.v} size={b.s} skin={skin} />
          )}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ win burst */
function WinBurst({ win, onClose, skin }) {
  const big = !!win.super || win.ratio >= 40;
  useEffect(() => {
    const t = setTimeout(onClose, big ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [big, onClose]);
  return (
    <>
      <div className={cx('flash', big && 'flash--big')} />
      <Rain n={big ? 30 : Math.min(18, 6 + Math.round(Math.log10(1 + win.pay) * 3))} skin={skin} />
      <Modal
        variant="center"
        onClose={onClose}
        eyebrow={win.super ? 'super jackpot' : 'ticket paid'}
        title={win.ticket}
        icon={win.super ? 'crown' : 'coin'}
        className={big ? 'modal--big' : undefined}
        foot={
          <button type="button" className="btn btn--gold btn--w" onClick={onClose}>
            <Icon name="check" size={15} /> Nice
          </button>
        }>
        <div className="center">
          <motion.div
            className="winamt disp"
            initial={big ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
            +{fmt(win.pay)}
          </motion.div>
          <div className="note" style={{ marginTop: 6 }}>
            {win.ratio >= 10
              ? `${win.ratio.toFixed(1)}× the ticket price — disgusting.`
              : `${win.ratio >= 1 ? `${win.ratio.toFixed(1)}×` : `${Math.round(win.ratio * 100)}%`} of the price back.`}
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------- phone / call */
function PhoneSheet({ open, onClose, endings }) {
  const [wait, setWait] = useState(0);
  const t = useRef(0);
  useEffect(() => () => clearInterval(t.current), []);
  useEffect(() => {
    if (!open) setWait(0);
  }, [open]);
  const choose = kind => {
    clearInterval(t.current);
    setWait(0);
    push({ type: 'ENDING', kind });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} eyebrow="incoming call" title="The Corporation" icon="phone">
      <div className="card card--metal" style={{ marginBottom: 10 }}>
        <div className="note">
          “Congratulations. You won the Final Chance. We have a briefcase and a contract — pick one. Take the money and we keep the
          ticket. Leave it and keep the ticket. Or don't touch anything for 60 seconds… and see who collects it for you.”
        </div>
      </div>
      {wait > 0 ? (
        <div className="card center">
          <div className="disp" style={{ fontSize: 34, fontWeight: 800, color: 'var(--violet)' }}>
            {wait}
          </div>
          <div className="note">Hands off. Something is coming to the door.</div>
        </div>
      ) : (
        <div className="col">
          <button type="button" className="btn btn--gold btn--w" onClick={() => choose('claim')}>
            <Icon name="briefcase" size={16} /> Claim the payout
          </button>
          <button type="button" className="btn btn--w" onClick={() => choose('walk')}>
            <Icon name="door" size={16} /> Hang up & walk away
          </button>
          <button
            type="button"
            className="btn btn--violet btn--w"
            onClick={() => {
              let n = 60;
              setWait(n);
              clearInterval(t.current);
              t.current = setInterval(() => {
                n -= 1;
                setWait(n);
                if (n <= 0) choose('faithful');
              }, 1000);
            }}>
            <Icon name="monolith" size={16} /> Wait it out · 60s secret
          </button>
        </div>
      )}
      {endings?.length ? (
        <div className="row wrap" style={{ marginTop: 10 }}>
          {endings.map(k => (
            <span key={k} className="chip chip--gold">
              <Icon name={ENDINGS[k]?.icon || 'star'} size={12} /> {ENDINGS[k]?.name}
            </span>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------ gift sheet */
function GiftSheet({ open, onClose }) {
  const { s } = useGame();
  const ready = s.daily.day !== todayKeyLocal() || !s.daily.claimed;
  const base = fmt(Math.max(200, Math.round((s.run.peak || 0) * 0.06 + (s.lifetime.earn || 0) * 0.0015)));
  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="center"
      eyebrow="once a day"
      title="Daily stash"
      icon="gift"
      foot={
        <button
          type="button"
          className={cx('btn btn--gold btn--w', !ready && 'btn--ghost')}
          disabled={!ready}
          onClick={() => {
            push({ type: 'DAILY' });
            onClose();
          }}>
          <Icon name={ready ? 'gift' : 'check'} size={15} /> {ready ? 'Claim stash' : 'Already claimed — come back tomorrow'}
        </button>
      }>
      <div className="center">
        <div className="giftbox" style={{ background: metalCss('gold') }} aria-hidden="true">
          <Icon name="gift" size={40} />
        </div>
        <div className="h3" style={{ fontSize: 16, marginTop: 8 }}>
          Day {s.daily.streak + (ready ? 1 : 0)} streak
        </div>
        <div className="note">Base {base} coins, scaled by your run peak. 6 days in a row adds a JP.</div>
      </div>
      <hr className="sep" />
      <div className="note">Also refills your Spellbook charges and marks the day as visited.</div>
    </Modal>
  );
}
const todayKeyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------- host */
export default function Overlays() {
  const { s } = useGame();
  const [toasts, setToasts] = useState([]);
  const [win, setWin] = useState(null);
  const [rain, setRain] = useState(0);
  const [float, setFloat] = useState([]);
  const sheet = s.ui?.sheet;
  const close = () => push({ type: 'UI', patch: { sheet: null } });

  const addToast = (id, text, kind, icon) => {
    setToasts(x => [...x.slice(-3), { id, text, kind, icon }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 2900);
  };

  // an event must be eaten exactly once: the queue array identity changes on every
  // store update, so without this guard each entry re-fires while it waits to pop
  // (double win sounds, duplicate toasts, duplicate float keys).
  const eaten = useRef(new Set());
  useEffect(() => {
    const list = s.queue || [];
    if (!list.length) return;
    for (const ev of list) {
      if (eaten.current.has(ev.id)) continue;
      eaten.current.add(ev.id);
      if (eaten.current.size > 400) eaten.current = new Set([ev.id]);
      switch (ev.t) {
        case 'toast':
          addToast(ev.id, ev.text, ev.kind, ev.kind === 'bad' ? 'skull' : 'sparkle');
          break;
        case 'sound':
          SFX[ev.v]?.();
          break;
        case 'rain':
          setRain(r => Math.max(r, ev.v || 14));
          setTimeout(() => setRain(0), 2200);
          break;
        case 'win':
          setWin(ev);
          if (ev.super || ev.ratio >= 6) SFX.jackpot?.();
          if (ev.super) navigator.vibrate?.([40, 60, 40, 60, 120]);
          break;
        case 'level':
          addToast(`${ev.id}l`, `Level ${ev.v} · +${fmt(ev.bonus)} coins`, 'win', 'star');
          SFX.level();
          break;
        case 'achv':
          addToast(`${ev.id}a`, `${ev.name} · +${ev.tok} tokens`, 'win', ev.e || 'trophy');
          SFX.coin(3);
          break;
        case 'gift':
          addToast(`${ev.id}g`, `Daily stash +${fmt(ev.coins)}${ev.jp ? ` · +${ev.jp} JP` : ''}`, 'good', 'gift');
          break;
        case 'float':
          setFloat(x => [...x, { id: ev.id, text: ev.text, neg: String(ev.text).includes('−') }]);
          setTimeout(() => setFloat(x => x.filter(i => i.id !== ev.id)), 1150);
          break;
        case 'prestige':
          setRain(30);
          addToast(`${ev.id}p`, `Prestige · +${ev.gain} JP`, 'win', 'gem');
          break;
        case 'phone':
          push({ type: 'UI', patch: { sheet: 'phone' } });
          break;
        default:
          break;
      }
      push({ type: 'QUEUE_POP', id: ev.id });
    }
  }, [s.queue]);

  return (
    <>
      {toasts.length ? (
        <div className="toasts">
          <AnimatePresence initial={false}>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                className={cx('toast', t.kind && `toast--${KIND[t.kind] || t.kind}`)}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}>
                <Icon name={t.icon || 'sparkle'} size={14} /> {t.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {float.length ? (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
          {float.map((f, i) => (
            <span key={f.id} className={cx('floaty', f.neg && 'floaty--neg')} style={{ left: `${42 + i * 4}%`, top: '44%' }}>
              {f.text}
            </span>
          ))}
        </div>
      ) : null}

      {rain ? <Rain n={rain} skin={s.skin} /> : null}
      {win ? <WinBurst win={win} skin={s.skin} onClose={() => setWin(null)} /> : null}
      <PhoneSheet open={sheet === 'phone'} endings={s.endings} onClose={close} />
      <GiftSheet open={sheet === 'gift'} onClose={close} />
    </>
  );
}

/* ------------------------------------------------------------- onboarding */
export function Onboard() {
  const [name, setName] = useState('');
  const steps = [
    ['scratch', 'Scratch'],
    ['bot', 'Automate'],
    ['gem', 'Prestige'],
  ];
  return (
    <Modal open variant="center" dismissible={false} title="ScratchVerse" eyebrow="premium scratch arcade">
      <div className="center">
        <div className="onb__crest">
          <Crest size={54} />
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          Scratch cards, build luck, automate with gadgets, then prestige for Jack Points. Saved on this device — offline, no
          account, no real money.
        </div>
      </div>
      <div className="grid3" style={{ margin: '12px 0' }}>
        {steps.map(([ic, label]) => (
          <div key={label} className="card center" style={{ padding: 10 }}>
            <Icon name={ic} size={22} />
            <div className="tiny h3" style={{ marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <input
        className="field"
        placeholder="Your nameplate"
        value={name}
        maxLength={12}
        onChange={e => setName(e.target.value)}
        aria-label="Your nameplate"
      />
      <button
        type="button"
        className="btn btn--gold btn--w"
        style={{ marginTop: 10 }}
        onClick={() => {
          SFX.init();
          push({ type: 'ONBOARD', name: name || 'Maxed', bonus: 35 });
        }}>
        <Icon name="coin" size={15} /> Start with {fmt(15 + 35)} coins
      </button>
    </Modal>
  );
}
