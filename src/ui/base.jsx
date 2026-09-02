// ============================================================
// ScratchVerse — shared UI primitives.
// One <Modal> owns every overlay in the game, which is why the close
// control works everywhere: Esc, backdrop tap, swipe-down and a real
// 44px X button are wired once, here.
// ============================================================
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Icon } from './icons.jsx';
import { metalCss } from './art.jsx';

export { Icon };
export { hasIcon, iconNames } from './icons.jsx';
export {
  Coin,
  Crest,
  Engraving,
  MATS_CSS,
  PAPER,
  PAPER_OF,
  PaperSwatch,
  SKIN_METAL,
  TicketFace,
  guilloche,
  metalCss,
  paperCss,
  rng,
} from './art.jsx';

export const cx = (...a) => a.filter(Boolean).join(' ');
const REDUCED =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

/** a fling past 96px or 640px/s (or a fast flick) dismisses a sheet */
export const swipeCloses = (info, { offset = 96, velocity = 640 } = {}) =>
  !!info && ((info.offset?.y ?? 0) > offset || (info.velocity?.y ?? 0) > velocity);

/* ------------------------------------------------------------------ modal */
let openStack = [];

/** Registers the topmost open modal so Esc only closes that one. */
function useModalStack(id, close, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    openStack.push(id);
    return () => {
      openStack = openStack.filter(x => x !== id);
    };
  }, [id, enabled]);
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = e => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === id) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [id, enabled, close]);
}

/**
 * @param {{ open?: boolean, onClose?: () => void, title?: React.ReactNode, eyebrow?: string,
 *   icon?: string, children?: React.ReactNode, foot?: React.ReactNode, variant?: 'sheet'|'center',
 *   dismissible?: boolean, className?: string }} props
 */
export function Modal({
  open = true,
  onClose,
  title,
  eyebrow,
  icon,
  children,
  foot,
  variant = 'sheet',
  dismissible = true,
  className,
}) {
  const id = useId();
  const panel = useRef(null);
  const restore = useRef(null);
  const y = useMotionValue(0);
  const dragBg = useTransform(y, [0, 180], [1, 0.55]);
  const close = useCallback(() => onClose?.(), [onClose]);

  useModalStack(id, close, open && dismissible);

  // lock background scrolling, focus the panel, give focus back on close
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    restore.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panel.current?.focus?.(), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      try {
        restore.current?.focus?.();
      } catch {}
    };
  }, [open]);

  const swipeClose = (_e, info) => {
    if (!dismissible) return;
    if (swipeCloses(info)) close();
  };

  if (!open) return null;
  return (
    <AnimatePresence initial={false}>
      <motion.div
        className="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: REDUCED ? 0 : 0.18 }}
        onClick={dismissible ? close : undefined}
        role="presentation">
        <motion.div
          ref={panel}
          className={cx('modal', `modal--${variant}`, className)}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          tabIndex={-1}
          style={{ y, background: 'var(--modal-bg)' }}
          initial={
            REDUCED
              ? { opacity: 0 }
              : variant === 'sheet'
                ? { y: 38, opacity: 0, scale: 0.985 }
                : { y: 14, opacity: 0, scale: 0.97 }
          }
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={REDUCED ? { opacity: 0 } : variant === 'sheet' ? { y: 30, opacity: 0 } : { y: 8, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
          drag={variant === 'sheet' && !REDUCED ? 'y' : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.02, bottom: 0.6 }}
          onDragEnd={swipeClose}
          onClick={e => e.stopPropagation()}
          whileTap={variant === 'sheet' ? { scale: 1 } : undefined}>
          <motion.div className="scrim__inner" style={{ opacity: dragBg }} aria-hidden="true" />
          {variant === 'sheet' ? <div className="grab" /> : null}
          <header className="modal__head">
            <div className="modal__title">
              {icon ? (
                <span className="modal__mark">
                  <Icon name={icon} size={18} />
                </span>
              ) : null}
              <div>
                {eyebrow ? <small>{eyebrow}</small> : null}
                <h3>{title}</h3>
              </div>
            </div>
            {dismissible ? (
              <button type="button" className="xbtn" onClick={close} aria-label="Close" title="Close (Esc)">
                <Icon name="close" size={18} />
              </button>
            ) : null}
          </header>
          <div className="modal__body">{children}</div>
          {foot ? <footer className="modal__foot">{foot}</footer> : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Small square icon button used in the top bar and tool rows. */
export function IconBtn({ name, label, onClick = null, active = false, size = 18, badge = null, className = null }) {
  return (
    <button
      type="button"
      className={cx('iconbtn', active && 'on', className)}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : !!active}>
      <Icon name={name} size={size} />
      {badge ? <span className="iconbtn__badge">{badge}</span> : null}
    </button>
  );
}

export function Chip({ children, tone = null, icon = null }) {
  return (
    <span className={cx('chip', tone && `chip--${tone}`)}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={cx('switch', on && 'on')}
      onClick={onChange}>
      <i />
    </button>
  );
}

export function Bar({ value = 0, tone = null, style = null }) {
  return (
    <div className={cx('bar', tone && `bar--${tone}`)} style={style}>
      <i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export const Stat = ({ v, k, tone = null }) => (
  <div className={cx('stat', tone && `stat--${tone}`)}>
    <b className="tabular">{v}</b>
    <span>{k}</span>
  </div>
);

export function Lv({ lvl = 0, max = 1 }) {
  return (
    <div className="lvdots" aria-label={`level ${lvl} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < lvl ? 'f' : ''} />
      ))}
    </div>
  );
}

/** A metal swatch drawn from CSS gradients — no bitmap anywhere in the app. */
export function Swatch({ metal = 'gold', css = null, h = 44, radius = 12 }) {
  return (
    <div
      className="swatch"
      style={{
        height: h,
        borderRadius: radius,
        background: css || metalCss(metal),
      }}
    />
  );
}

/* ------------------------------------------------------------- toast host */
export function useToasts() {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = '') => {
    const id = Math.random().toString(36).slice(2);
    setItems(x => [...x.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 2600);
  }, []);
  return { items, push };
}
