// ============================================================
// ScratchVerse — procedural vector art.
// Ticket faces, foil metal, mat themes and the crest are generated as
// SVG paths from the ticket data itself: no bitmap assets in the app.
// ============================================================
import React from 'react';
import { Icon } from './icons.jsx';
import { fmt } from '../game/fmt.js';

/* deterministic PRNG so a card looks identical every time it renders */
export function rng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
}

/** An epitrochoid rose curve — the same family of maths real security printing uses. */
export function guilloche(seed, { cx = 0, cy = 0, r = 1, R = 0.62, k = 7, turns = 1, steps = 220 } = {}) {
  const rand = rng(seed);
  const k2 = k + Math.floor(rand() * 3);
  const rr = R * (0.86 + rand() * 0.3);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = cx + (r * (1 - rr) * Math.cos(t) + r * rr * Math.cos(k2 * t)) / 1.6;
    const y = cy + (r * (1 - rr) * Math.sin(t) - r * rr * Math.sin(k2 * t)) / 1.6;
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

/** Concentric engraved rings + a radial hatch: the "printed" field of the card. */
export function Engraving({ seed, rings = 5, opacity = 1, className = null, style = null }) {
  const paths = [];
  for (let i = 0; i < rings; i++) {
    paths.push(guilloche(`${seed}:${i}`, { r: 46 - i * 6.4, R: 0.5 + i * 0.05, k: 6 + i }));
  }
  return (
    <g opacity={opacity} className={className} style={style}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.32} opacity={0.28 + i * 0.06} />
      ))}
      <g opacity="0.18">
        {Array.from({ length: 44 }, (_, i) => {
          const a = (i / 44) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={(Math.cos(a) * 30).toFixed(2)}
              y1={(Math.sin(a) * 30).toFixed(2)}
              x2={(Math.cos(a) * 52).toFixed(2)}
              y2={(Math.sin(a) * 52).toFixed(2)}
              stroke="currentColor"
              strokeWidth="0.22"
            />
          );
        })}
      </g>
    </g>
  );
}

export const SKIN_METAL = {
  gold: { hi: '#fff3c9', mid: '#e8c88a', low: '#8a6a2e', deep: '#3a2c11' },
  rose: { hi: '#ffe6ef', mid: '#e7b3c6', low: '#8e4a63', deep: '#331622' },
  neon: { hi: '#e6fbff', mid: '#9fdcea', low: '#356a7c', deep: '#10262e' },
  platinum: { hi: '#ffffff', mid: '#d5dae4', low: '#6c7688', deep: '#1b202a' },
};

/**
 * The foil as a standalone SVG document, used two ways:
 *  - as a CSS `background-image` data URI for chips/swatches
 *  - as a canvas `createPattern` source, so the scratchable panel is real metal
 */
export function foilSvg(skin = 'gold', size = 240) {
  const m = SKIN_METAL[skin] || SKIN_METAL.gold;
  const lines = Array.from({ length: 34 }, (_, i) => i * (size / 34))
    .map(
      y =>
        `<path d="M0 ${y.toFixed(1)} L${size} ${(y + size * 0.045).toFixed(1)}" stroke="#000" stroke-opacity=".10" stroke-width=".7"/>`
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${m.hi}"/><stop offset=".18" stop-color="${m.mid}"/>` +
    `<stop offset=".34" stop-color="${m.deep}"/><stop offset=".5" stop-color="${m.mid}"/>` +
    `<stop offset=".66" stop-color="${m.hi}"/><stop offset=".82" stop-color="${m.low}"/>` +
    `<stop offset="1" stop-color="${m.mid}"/></linearGradient>` +
    `<radialGradient id="r" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></radialGradient>` +
    `</defs>` +
    `<rect width="${size}" height="${size}" fill="url(#g)"/>` +
    `<g opacity=".55">${lines}</g>` +
    `<rect width="${size}" height="${size}" fill="url(#r)"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Same metal, expressed as pure CSS layers (used for chips, swatches, the coin cursor). */
export function metalCss(skin = 'gold') {
  const m = SKIN_METAL[skin] || SKIN_METAL.gold;
  return [
    `repeating-linear-gradient(115deg, rgba(255,255,255,.16) 0 1px, rgba(0,0,0,.10) 1px 3px)`,
    `linear-gradient(135deg, ${m.hi} 0%, ${m.mid} 26%, ${m.deep} 46%, ${m.mid} 62%, ${m.hi} 76%, ${m.low} 100%)`,
  ].join(', ');
}

/* ---------- table themes: AMOLED-safe, no photographs ---------- */
export const MATS_CSS = {
  noir: 'radial-gradient(120% 80% at 50% -10%, #14161b 0%, #05050a 55%, #000 100%)',
  graphite:
    'repeating-linear-gradient(90deg, rgba(255,255,255,.028) 0 2px, transparent 2px 6px), radial-gradient(120% 80% at 50% -10%, #191b21 0%, #07080c 55%, #000 100%)',
  oxblood:
    'repeating-linear-gradient(115deg, rgba(255,255,255,.02) 0 1px, transparent 1px 7px), radial-gradient(120% 78% at 50% -12%, #2a1013 0%, #12060a 52%, #000 100%)',
  emerald:
    'repeating-linear-gradient(115deg, rgba(255,255,255,.018) 0 1px, transparent 1px 8px), radial-gradient(120% 78% at 50% -12%, #0c2a24 0%, #05130f 52%, #000 100%)',
  platinum:
    'repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 5px), radial-gradient(120% 78% at 50% -10%, #1c1f26 0%, #0a0b10 50%, #000 100%)',
};

/**
 * The card face. Composition is fixed (frame → engraved field → motif → name plate)
 * and the *data* drives the variation: catalogue colour, hardness engraving
 * density, motif glyph, and a per-ticket rose-curve seed.
 *
 * @param {{ def?: object | null,
 *   motif?: boolean | number, // false hides it, true uses the default, a number is the opacity
 *   field?: number | null, // guilloché opacity (null = chosen from `dense`)
 *   dense?: boolean, className?: string | null, style?: object | null }} props
 */
export function TicketFace({
  def = null,
  motif = true, // false = hidden, true = default, number = that opacity
  field = null, // guilloché opacity (defaults to a little weaker on big cards)
  dense = false,
  className = null,
  style = null,
}) {
  const uid = React.useId();
  if (!def) return null;
  const tint = def.tint || '#e8c88a';
  // ids are per-instance (not per-ticket) so two faces of the same ticket can
  // sit in one document — tray and table — without clashing gradient ids.
  const seed = `${def.id}${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  const rings = 3 + (def.hardness || 1);
  // the rail must never let the catalogue name run into the price: size it to fit
  const priceLabel = def.priceLabel || `${fmt(def.price)} · ${def.syms.length} SYMS`;
  const catLabel = (def.catName || `CATALOGUE ${def.cat}`).toUpperCase();
  const priceW = priceLabel.length * 6 * 0.62;
  const catSize = Math.max(4.1, Math.min(6.2, (96 - priceW) / (catLabel.length * 0.8 + 1.1)));
  const motifA = motif === false ? 0 : motif === true ? 0.7 : Number(motif);
  const fieldA = field == null ? (dense ? 0.5 : 0.3) : Number(field);
  return (
    <svg viewBox="0 0 120 176" className={className} style={style} role="img" aria-label={`${def.name} ticket face`}>
      <defs>
        <linearGradient id={`f-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e0f13" />
          <stop offset="0.42" stopColor="#08090c" />
          <stop offset="1" stopColor="#131117" />
        </linearGradient>
        <radialGradient id={`g-${seed}`} cx="0.5" cy="0.22" r="0.85">
          <stop offset="0" stopColor={tint} stopOpacity="0.20" />
          <stop offset="0.55" stopColor={tint} stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <clipPath id={`c-${seed}`}>
          <rect x="0" y="0" width="120" height="176" rx="9" />
        </clipPath>
      </defs>

      <g clipPath={`url(#c-${seed})`}>
        <rect width="120" height="176" fill={`url(#f-${seed})`} />
        <rect width="120" height="176" fill={`url(#g-${seed})`} />

        {/* engraved security field */}
        <g transform="translate(60 96)" color={tint} opacity={fieldA}>
          <Engraving seed={seed} rings={rings} />
        </g>

        {/* hairline double frame with corner flourishes */}
        <rect x="4" y="4" width="112" height="168" rx="6.5" fill="none" stroke={tint} strokeOpacity="0.55" strokeWidth="0.6" />
        <rect
          x="6.6"
          y="6.6"
          width="106.8"
          height="162.8"
          rx="4.6"
          fill="none"
          stroke={tint}
          strokeOpacity="0.22"
          strokeWidth="0.4"
        />
        <g stroke={tint} strokeOpacity="0.5" strokeWidth="0.5" fill="none">
          <path d="M10 18V10h8M110 10h8v8M118 158v8h-8M10 158v8h8" />
        </g>

        {/* top rail: catalogue + price */}
        <text
          x="12"
          y="21"
          fill={tint}
          fillOpacity="0.85"
          fontSize={catSize}
          letterSpacing={catSize * 0.18}
          fontFamily="var(--font-b, sans-serif)"
          fontWeight="700">
          {catLabel}
        </text>
        <text
          x="108"
          y="21"
          textAnchor="end"
          fill="#fff"
          fillOpacity="0.5"
          fontSize={Math.min(6.2, catSize + 0.6)}
          letterSpacing={(catSize + 0.6) * 0.07}
          fontFamily="var(--font-b, sans-serif)"
          fontWeight="600">
          {priceLabel}
        </text>

        {motifA > 0 ? (
          <g transform="translate(60 56)" color={tint} opacity={motifA}>
            <Icon name={def.motif || 'ticket'} size={54} style={{ transform: 'translate(-27px,-27px)' }} />
          </g>
        ) : null}

        {/* name plate */}
        <g transform="translate(60 160)">
          <path d="M-46 -9h92" stroke={tint} strokeOpacity="0.35" strokeWidth="0.5" />
          <text
            textAnchor="middle"
            y="2.5"
            fill="#f6f7fa"
            fontSize="10.5"
            letterSpacing="0.2"
            fontWeight="800"
            fontFamily="var(--font-d, sans-serif)">
            {def.name.toUpperCase()}
          </text>
          <text
            textAnchor="middle"
            y="11.5"
            fill={tint}
            fillOpacity="0.7"
            fontSize="5.4"
            letterSpacing="1.4"
            fontFamily="var(--font-b, sans-serif)"
            fontWeight="700">
            {(def.tag || 'scratch & win').toUpperCase()}
          </text>
        </g>
      </g>
    </svg>
  );
}

/** App crest: monogram inside a milled coin, with a scratch arc across it. */
export function Crest({ size = 32, className = null, style = null }) {
  const g = React.useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} style={style} aria-label="ScratchVerse" role="img">
      <defs>
        <linearGradient id={`c-${g}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c9" />
          <stop offset="0.35" stopColor="#e8c88a" />
          <stop offset="0.6" stopColor="#7d5f28" />
          <stop offset="0.8" stopColor="#e8c88a" />
          <stop offset="1" stopColor="#fff3c9" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21.5" fill="#07080b" stroke={`url(#c-${g})`} strokeWidth="1.4" />
      <circle
        cx="24"
        cy="24"
        r="17.6"
        fill="none"
        stroke="#e8c88a"
        strokeOpacity="0.22"
        strokeWidth="0.6"
        strokeDasharray="0.8 1.6"
      />
      <path
        d="M14.5 30.5c4-9.5 6.5-13 9.5-16"
        stroke="#000"
        strokeOpacity="0.55"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="24"
        y="29.6"
        textAnchor="middle"
        fill={`url(#c-${g})`}
        fontFamily="var(--font-d, sans-serif)"
        fontWeight="800"
        fontSize="15.5"
        letterSpacing="-0.8">
        SV
      </text>
    </svg>
  );
}

/** A minted coin, used for the balance pill, the brush cursor and the rain. */
export function Coin({ value = 1, size = 20, skin = 'gold', style = null, className = null }) {
  const m = SKIN_METAL[skin] || SKIN_METAL.gold;
  const g = React.useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`n-${g}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.42" stopColor={m.mid} />
          <stop offset="0.62" stopColor={m.deep} />
          <stop offset="1" stopColor={m.low} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.6" fill={`url(#n-${g})`} />
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="7.9" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="0.6" strokeDasharray="0.5 0.9" />
      <path
        d="M8.6 15.2c1.4-3.4 2.4-4.8 3.4-6"
        stroke="#000"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        fill="#2a1f06"
        fillOpacity="0.72"
        fontFamily="var(--font-d, sans-serif)"
        fontWeight="800"
        fontSize="8">
        {value}
      </text>
    </svg>
  );
}
