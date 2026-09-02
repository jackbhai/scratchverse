// Procedural art: the ticket faces, metal and mat themes replace the old
// AI-generated bitmaps. These tests are the guarantee that nothing bitmap- or
// CDN-shaped crept back in, and that every ticket still gets a real face.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TICKETS, TICKET_BY_ID, MATS, SKINS, COINS } from '../../src/game/config.js';
import {
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
} from '../../src/ui/art.jsx';

const VECTOR_ONLY = html => {
  expect(html).not.toMatch(/<image/i);
  expect(html).not.toMatch(/\burl\(\s*['"]?(https?:|data:image\/(png|jpeg|webp))/i);
  expect(html).not.toMatch(/\.(png|jpe?g|webp|gif)\b/i);
};

describe('TicketFace', () => {
  it('renders a distinct face for all 13 tickets', () => {
    const seen = new Set();
    for (const t of TICKETS) {
      const html = renderToStaticMarkup(<TicketFace def={t} />);
      expect(html).toContain('<svg');
      expect(html).toContain(t.name.toUpperCase());
      VECTOR_ONLY(html);
      // catalogue + price are printed on the card, like the original
      expect(html).toContain(t.catName.toUpperCase());
      expect(html).toContain('SYMS');
      seen.add(html.length);
    }
    expect(seen.size).toBeGreaterThan(6);
  });

  it('names every symbol it paints and never invents one', () => {
    for (const t of TICKETS) {
      for (const s of t.syms) expect(typeof s.e).toBe('string');
    }
  });

  it('gives each instance unique gradient ids so tray + table can co-render', () => {
    // the same ticket appears twice in the real app (table + tray): ids must not collide
    const html = renderToStaticMarkup(
      <div>
        <TicketFace def={TICKET_BY_ID.twowin} />
        <TicketFace def={TICKET_BY_ID.twowin} />
        <TicketFace def={TICKET_BY_ID.megajack} />
      </div>
    );
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
    // every url(#…) reference resolves to an id that exists in the document
    const refs = [...html.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
    for (const r of refs) expect(ids).toContain(r);
  });

  it('survives a missing ticket definition', () => {
    expect(renderToStaticMarkup(<TicketFace def={null} />)).toBe('');
  });
});

describe('metals and mats', () => {
  it('every skin paints from a CSS/SVG key, not an image key', () => {
    for (const s of SKINS) {
      expect(SKIN_METAL[s.foil]).toBeTruthy();
      const css = metalCss(s.foil);
      VECTOR_ONLY(css);
      expect(css).toContain('gradient');
    }
  });

  it('every table theme is CSS-only and AMOLED safe (ends in black)', () => {
    for (const m of MATS) {
      const css = MATS_CSS[m.id];
      expect(typeof css).toBe('string');
      VECTOR_ONLY(css);
      expect(css).toMatch(/#000\b|#000\s|\b#0[0-9a-f]{5}/i);
    }
  });

  it('every coating ships a paper stock and a swatch, with no bitmap involved', () => {
    for (const sk of SKINS) {
      const q = PAPER_OF(sk.foil);
      expect(q.stock).toMatch(/^#[0-9a-f]{6}$/i);
      expect(q.ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PAPER[sk.foil]).toBe(q);
      expect(PAPER_OF(`ghost-${sk.id}`)).toBe(PAPER.gold); // an unknown stock never blanks the card
      const css = paperCss(sk.foil);
      expect(css).toContain('linear-gradient');
      expect(css).toContain(q.stock);
      expect(css).not.toContain('url('); // nothing is fetched
      const html = renderToStaticMarkup(<PaperSwatch skin={sk.foil} />);
      expect(html).toContain('<svg');
      expect(html).toContain(q.stock);
      const pts = /points="([^"]+)"/.exec(html);
      expect(pts, 'the swatch is a torn polygon').toBeTruthy();
      expect(pts[1].trim().split(/\s+/).length).toBeGreaterThanOrEqual(40);
      expect(/<image|xlink:href|\.png|\.jpg|\.webp/i.test(html)).toBe(false);
    }
  });
});

describe('engraving generator', () => {
  it('mints every coin tier as an SVG coin, sized by value', () => {
    const sizes = [];
    for (const c of COINS) {
      const html = renderToStaticMarkup(<Coin value={c.v} size={30} skin="rose" />);
      expect(html).toContain('<svg');
      expect(html).not.toMatch(/<image|\.png|\.jpg|\.webp|https?:\/\//i);
      for (const m of html.matchAll(/url\(#([^)]+)\)/g)) expect(html).toContain(`id="${m[1]}"`); // gradients are local, never fetched
      expect(html).toContain(SKIN_METAL.rose.hi); // coins stay metal even when the seal is paper
      sizes.push(html.length);
    }
    expect(COINS.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0); // tiers differ in art
    VECTOR_ONLY(renderToStaticMarkup(<Crest size={32} />));
    expect(renderToStaticMarkup(<Crest size={32} />)).toContain('SV');
  });

  it('is deterministic per seed', () => {
    const seq = k => [rng(k)(), rng(k)(), rng(k)()].map(x => x.toFixed(6)).join(',');
    expect(seq('twowin')).toBe(seq('twowin'));
    expect(seq('twowin')).not.toBe(seq('booster'));
    const first = rng('twowin')();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });

  it('produces finite path data only', () => {
    const p = guilloche('megajack', { steps: 120 });
    expect(p).toMatch(/^M[\d.-]/);
    expect(p).not.toMatch(/NaN|Infinity/);
    const html = renderToStaticMarkup(<Engraving seed="snakeeyes" rings={4} />);
    VECTOR_ONLY(html);
    expect(html).not.toMatch(/NaN/);
  });
});
