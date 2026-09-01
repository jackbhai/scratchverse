// ScratchVerse — shared UI primitives (no external CSS framework)
import React from 'react';
import { IMG, ASSET } from '../assets.js';

let _webp;
export function supportsWebp() {
  if (_webp === undefined) {
    try {
      const c = document.createElement('canvas');
      _webp = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch { _webp = false; }
  }
  return _webp;
}
/** url for a {src, webp} pair from assets.js */
export const u = (pair) => (pair ? (pair.webp && supportsWebp() ? pair.webp : pair.src) : undefined);
export const imgFor = (key, map = IMG) => u(map[key]);
export const cx = (...a) => a.filter(Boolean).join(' ');

export function Asset({ name, className, style, alt = '', ...rest }) {
  const pair = ASSET[name];
  if (!pair) return null;
  const webp = supportsWebp() && pair.webp;
  return (
    <picture className={className} style={{ display: 'contents', ...style }}>
      {webp ? <source srcSet={pair.webp} type="image/webp" /> : null}
      <img src={pair.src} alt={alt} draggable={false} loading="eager" decoding="async" {...rest} />
    </picture>
  );
}

export const Ic = {
  table: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6.5h18M3 6.5 5 18h14l2-11.5M8.5 10.5h7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  catalog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h4" strokeLinecap="round" /></svg>,
  bot: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="8" width="16" height="11" rx="3.5" /><path d="M12 4v4M8.5 13h.01M15.5 13h.01M9 16.5h6" strokeLinecap="round" /></svg>,
  star: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z" strokeLinejoin="round" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20c1.1-3.6 3.9-5.4 7.2-5.4s6.1 1.8 7.2 5.4" strokeLinecap="round" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M13 3 5.5 13.5H11l-.8 7.5L18.5 10H13z" strokeLinejoin="round" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" strokeLinecap="round" /></svg>,
  sound: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" strokeLinejoin="round" /><path d="M15 9.5a4 4 0 0 1 0 5M17.6 7a7 7 0 0 1 0 10" strokeLinecap="round" /></svg>,
  mute: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 9.5h3l4-3.5v12l-4-3.5H4z" strokeLinejoin="round" /><path d="M15 10l4.5 4M19.5 10 15 14" strokeLinecap="round" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4.5 7h15M9 7V4.8h6V7M6.8 7l.9 12h8.6l.9-12" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2.6 12S6 6.5 12 6.5 21.4 12 21.4 12 18 17.5 12 17.5 2.6 12 2.6 12z" /><circle cx="12" cy="12" r="2.6" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v7M8 10h8l1.6 4.4H6.4z" strokeLinejoin="round" /><path d="M12 14.5V21" strokeLinecap="round" /></svg>,
};

export function Switch({ on, onChange, label }) {
  return (
    <button className={cx('switch', on && 'on')} onClick={onChange} aria-label={label}
      aria-pressed={!!on} role="switch" />
  );
}

export function Sheet({ open, onClose, title, children, foot }) {
  if (!open) return null;
  return (
    <div className="veil" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row spread" style={{ alignItems: 'center', marginBottom: 10 }}>
          <h3 className="d">{title}</h3>
          <button className="icon-btn x" onClick={onClose} aria-label="Close">{Ic.close}</button>
        </div>
        {children}
        {foot ? <div style={{ marginTop: 14 }}>{foot}</div> : null}
      </div>
    </div>
  );
}

export function Bar({ value, cls, style }) {
  return <div className={cx('bar', cls)} style={style}><i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>;
}

export const Stat = ({ v, k }) => <div className="stat"><b className="tabular">{v}</b><span>{k}</span></div>;

export function Lv({ lvl, max }) {
  return (
    <div className="lvdots" aria-label={`level ${lvl} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < lvl ? 'f' : ''} />)}
    </div>
  );
}
