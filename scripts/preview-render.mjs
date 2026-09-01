#!/usr/bin/env node
/**
 * ScratchVerse — static render pass (no browser needed).
 * Bundles the REAL screens with esbuild, mounts them in jsdom with a seeded save,
 * then writes a self-contained preview HTML that keeps the live CSS + WebP assets.
 * Useful for reviewing layout/visuals in any browser (or as a README preview).
 *   node scripts/preview-render.mjs
 */
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'preview.html');

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from ${JSON.stringify(resolve(ROOT, 'src/App.jsx'))};
import * as dbmod from ${JSON.stringify(resolve(ROOT, 'src/db/store.js'))};
import { TICKET_BY_ID } from ${JSON.stringify(resolve(ROOT, 'src/game/config.js'))};
import { rollTicket } from ${JSON.stringify(resolve(ROOT, 'src/game/logic.js'))};

globalThis.__seed = () => {
  const s = dbmod.initialState();
  s.seenOnboard = true; s.name = 'Maxed';
  s.balance = 1.24e6; s.jp = 18; s.tokens = 9; s.level = 7; s.xp = 62;
  s.lifetime = { earn: 6.4e6, spent: 4.1e6, jp: 14 };
  s.run = { earn: 3.9e6, spent: 2.2e6, peak: 1.6e6 };
  s.upg = { luck: 9, size: 4, coin: 2, payout: 5, toss: 2 };
  s.coin = 'quarter';
  s.gadgets = {
    bot: { lvl: 3, on: true }, fan: { lvl: 2, on: true }, mat: { lvl: 1 },
    mundo: { lvl: 1, on: true }, auto: { lvl: 1, on: true },
    egg: { lvl: 2, until: 0, readyAt: 0 }, spell: { lvl: 1, charges: 2, max: 3 }, machine: { lvl: 0 },
  };
  s.skin = 'gold'; s.matBg = 'felt'; s.skins = { gold: true, rose: true, neon: false, carbon: false };
  s.matsOwned = { felt: true, gems: true };
  s.pools = { luckycat: 486_000, booster: 0 };
  s.autoTarget = 'miniscratch';
  const t1 = rollTicket(s, TICKET_BY_ID.miniscratch);
  t1.win = true; t1.syIdx = 1; t1.grid = [1, 1, 1, 4, 0, 2, 0, 1, 3]; t1.matchCount = 4;
  t1.scratch = [0.55, 0.55, 0.55, 0.2, 0.1, 0, 0, 0, 0]; t1.revealed = 3; t1.coverage = 0.34; t1.status = 'table';
  s.table = t1;
  s.tray = [0, 1, 2].map(() => { const t = rollTicket(s, TICKET_BY_ID.appletree); t.status = 'tray'; return t; });
  s.mat = [0].map(() => { const t = rollTicket(s, TICKET_BY_ID.megajack); t.super = true; t.win = true; t.done = true; t.payout = 2_700_000_000; t.status = 'mat'; return t; });
  s.feed = [
    { e: '✨', x: 'Mega Jackpot SUPER JACKPOT +2.7B', a: 2.7e9, at: Date.now() },
    { e: '🐈', x: 'Lucky Cat jackpot +486K', a: 486000, at: Date.now() },
    { e: '', x: 'Two Win paid +60', a: 60, at: Date.now() },
    { e: '🫥', x: 'Quick Cash paid nothing −7.5K', r: 7500, at: Date.now() },
  ];
  s.stats = { ...s.stats, scratched: 812, wins: 214, losses: 598, spent: 4.1e6, earned: 6.4e6,
    supers: 1, bestWin: 2.7e9, streak: 3, bestStreak: 9, plates: 260, refunds: 34, jackpots: 12 };
  s.owned = { twowin: 220, miniscratch: 140, appletree: 60, quickcash: 40, seaturtle: 18, luckycat: 6 };
  s.achievements = { first: 1, ten: 1, win10: 1, streak3: 1, bot: 1, spend1: 1 };
  s.daily = { day: dbmod.todayKey(), last: dbmod.todayKey(), claimed: true, streak: 4, spell: dbmod.todayKey(), charges: 2 };
  s.nodes = { seed: 2, core: 3 };
  return s;
};
export { React, createRoot, App };
`;
writeFileSync(resolve(ROOT, 'dist-test/preview-entry.jsx'), entry);

await build({
  entryPoints: [resolve(ROOT, 'dist-test/preview-entry.jsx')],
  bundle: true, platform: 'node', format: 'cjs', outfile: resolve(ROOT, 'dist-test/preview.cjs'),
  external: ['jsdom', 'react', 'react-dom', 'react-dom/client', 'dexie'],
  loader: { '.jsx': 'jsx' }, jsx: 'automatic', logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"production"' },
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
Object.assign(globalThis, {
  window: w, document: w.document, navigator: w.navigator, HTMLElement: w.HTMLElement,
  Element: w.Element, Node: w.Node, Image: w.Image, Event: w.Event, MouseEvent: w.MouseEvent,
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, self: w,
});
const noop = () => {};
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({
    canvas: this, save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    arc: noop, arcTo: noop, moveTo: noop, lineTo: noop, translate: noop, scale: noop, fillRect: noop,
    clearRect: noop, createPattern: () => ({ setTransform: noop }),
    createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)) }),
    measureText: () => ({ width: 10 }), setTransform: noop,
  }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
};
w.HTMLElement.prototype.setPointerCapture = noop;
w.HTMLElement.prototype.releasePointerCapture = noop;

// seed the save through the documented hook, then mount the real App (real provider,
// real reducer, real bot tick) and freeze the DOM.
const mod = await import(resolve(ROOT, 'dist-test/preview.cjs'));   // module body defines __seed
globalThis.__SV_SEED__ = globalThis.__seed();
mod.createRoot(w.document.getElementById('root')).render(mod.React.createElement(mod.App));
await new Promise((r) => setTimeout(r, 1800));

const seedState = globalThis.__SV_STATE__;
if (seedState) {
  const ids = { tray: (seedState.tray || []).map((x) => x.id), table: seedState.table?.id, mat: (seedState.mat || []).map((x) => x.id), queue: (seedState.tableQueue || []).map((x) => x.id) };
  console.log('[dbg] ids', JSON.stringify(ids));
}
const html = w.document.getElementById('root').innerHTML;
const css = readFileSync(resolve(ROOT, 'src/styles.css'), 'utf8');
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>ScratchVerse — static render preview</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>${css}</style>
<style>body{padding:0}.app{height:auto;min-height:100dvh;box-shadow:0 0 80px rgba(0,0,0,.6)}</style>
</head><body>${html}
<div style="max-width:480px;margin:10px auto;padding:12px;color:#8a92a8;font:12px/1.5 Manrope,system-ui;text-align:center">
  Static render of the real React screens (jsdom) — for interaction, play the live build:
  <code>npm run dev</code> / <code>npm run preview</code>.
</div></body></html>`;
writeFileSync(OUT, page);
if (existsSync(resolve(ROOT, 'dist'))) writeFileSync(resolve(ROOT, 'dist/preview.html'), page);
console.log(`✓ preview.html written (${(page.length / 1024).toFixed(0)} KB) — open it from the scratchverse/ folder so ./img + ./assets resolve`);

process.exit(0);
