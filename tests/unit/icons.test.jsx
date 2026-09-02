// The icon registry is the single source of visual identity now, so it is a
// correctness surface, not a nicety: every key the data references must exist.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasIcon, iconNames, Icon } from '../../src/ui/icons.jsx';
import * as C from '../../src/game/config.js';

const allIconKeys = () => {
  const keys = [];
  for (const t of C.TICKETS) {
    keys.push(t.motif);
    for (const s of t.syms) keys.push(s.e);
  }
  for (const list of [C.SKINS, C.MATS, C.UPGRADES, C.GADGETS, C.JP_NODES, C.ACHIEVEMENTS]) {
    for (const x of list) if (x.icon) keys.push(x.icon);
  }
  for (const e of Object.values(C.ENDINGS)) keys.push(e.icon);
  for (const t of C.TICKETS) for (const s of t.syms) keys.push(s.e);
  return keys.filter(Boolean);
};

describe('icon registry', () => {
  it('exposes a real set of glyphs', () => {
    expect(iconNames().length).toBeGreaterThanOrEqual(60);
  });

  it('every key referenced by game data resolves to a glyph', () => {
    const missing = [...new Set(allIconKeys())].filter(k => !hasIcon(k));
    expect(missing, `unresolved icon keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('renders each glyph as SVG with a title for a11y', () => {
    const html = renderToStaticMarkup(<Icon name="crown" size={24} title="crown" />);
    expect(html).toContain('<svg');
    expect(html).toContain('<title>crown</title>');
    expect(html).toContain('role="img"');
    expect(renderToStaticMarkup(<Icon name="crown" />)).toContain('aria-hidden="true"');
  });

  it('unknown names fall back instead of throwing', () => {
    expect(() => renderToStaticMarkup(<Icon name="definitely-not-an-icon" />)).not.toThrow();
    expect(hasIcon('definitely-not-an-icon')).toBe(false);
    expect(hasIcon('constructor')).toBe(false);
  });

  it('is vector only — no image elements anywhere in the glyphs', () => {
    const html = iconNames()
      .map(n => renderToStaticMarkup(<Icon name={n} />))
      .join('');
    expect(html).not.toMatch(/<image|\.(png|jpe?g|webp|gif)/i);
    expect(html.match(/<svg/g)?.length).toBe(iconNames().length);
  });
});

describe('config after the art swap', () => {
  it('carries no bitmap or emoji fields', () => {
    for (const t of C.TICKETS) {
      expect(t.art).toBeUndefined();
      expect(t.img).toBeUndefined();
      expect(t.e).toBeUndefined();
      for (const s of t.syms) expect(s.e.codePointAt(0), `non-ascii symbol key ${s.e}`).toBeLessThan(128);
    }
    for (const m of C.MATS) expect(m.img).toBeUndefined();
    for (const g of C.GADGETS) expect(g.img).toBeUndefined();
    for (const c of C.COINS) expect(c.e).toBeUndefined();
  });

  it('keeps the balance contract: prices, weights and pays untouched', () => {
    expect(C.TICKETS.map(t => `${t.id}:${t.price}`)).toEqual([
      'twowin:25',
      'miniscratch:150',
      'appletree:900',
      'quickcash:7500',
      'seaturtle:30000',
      'snakeeyes:120000',
      'luckycat:900000',
      'goldrush:6500000',
      'megajack:60000000',
      'sanddollars:750000000',
      'mystery:9000000000',
      'booster:120000000000',
      'final:10000000000000',
    ]);
    expect(Number(C.TICKETS.reduce((a, t) => a + t.syms.reduce((x, s) => x + s.w, 0), 0).toFixed(2))).toBe(491.15);
    expect(C.START_BALANCE).toBe(15);
    expect(C.AUTO_AT).toBe(0.55);
    expect(C.PITY).toEqual({ need: 14, mult: 2.2 });
    expect(C.HARDNESS_DAB).toEqual([0, 0.9, 0.72, 0.58, 0.46]);
    expect(C.PRESTIGE_BASE).toBe(2.5e7);
  });

  it('gives every ticket a catalogue tint and face motif', () => {
    for (const t of C.TICKETS) {
      expect(t.tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.catName).toBeTruthy();
      expect(hasIcon(t.motif)).toBe(true);
    }
  });

  it('night market ids are metals + CSS themes, not asset keys', () => {
    expect(C.SKINS.map(s => s.foil)).toEqual(['gold', 'rose', 'neon', 'platinum']);
    expect(C.MATS.map(m => m.id)).toEqual(['noir', 'oxblood', 'emerald', 'graphite', 'platinum']);
    expect(C.MATS.filter(m => m.tok === 0).length).toBeGreaterThanOrEqual(2);
  });
});
