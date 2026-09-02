// The complaint was "the cross doesn't work in several places". Every overlay
// is the same Modal now, so this mounts the real app and closes every sheet
// that exists — via the X, and via Escape.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import App from '../../src/App.jsx';
import { gameStore, getState } from '../../src/store.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const byText = (re, sel = 'button') => $$(sel).find(b => re.test(`${b.textContent || ''} ${b.getAttribute('aria-label') || ''}`));
const tap = el => {
  if (!el) return false;
  fireEvent.click(el);
  return true;
};

beforeEach(async () => {
  globalThis.__SV_SEED__ = {
    seenOnboard: true,
    balance: 5e9,
    lifetime: { earn: 5e9, spent: 1e6, jp: 40 },
    run: { earn: 5e9, spent: 1e6, peak: 5e9 },
    jp: 40,
    tokens: 20,
    level: 12,
    gadgets: {
      bot: { lvl: 2, on: false },
      mat: { lvl: 1, on: true },
      mundo: { lvl: 1, on: false },
      egg: { lvl: 1 },
      spell: { lvl: 1 },
      fan: { lvl: 1 },
      auto: { lvl: 1 },
      machine: { lvl: 0 },
    },
    settings: { sound: false, haptics: false, reduceFx: true, autoClaim: false, tab: 'table' },
    ui: { tab: 'table', sheet: null },
  };
  gameStore.getState().replace(null);
});
afterEach(() => {
  cleanup();
  delete globalThis.__SV_SEED__;
  gameStore.getState().replace(null);
});

async function booted() {
  const view = render(<App />);
  await waitFor(() => expect($('.app')).toBeTruthy(), { timeout: 3000 });
  await wait(120);
  return view;
}

async function openSheet(patch) {
  gameStore.getState().dispatch({ type: 'UI', patch });
  await wait(80);
}

describe('every sheet closes', () => {
  it('the app boots into the table with no stuck overlay', async () => {
    await booted();
    expect($('.app')).toBeTruthy();
    expect($('.scrim')).toBe(null);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it.each([
    ['daily stash', { sheet: 'gift' }],
    ['the phone call', { sheet: 'phone' }],
  ])('%s opens with an X and closes with it', async (label, patch) => {
    await booted();
    await openSheet(patch);
    expect($('.modal')).toBeTruthy();
    const x = $('.modal .xbtn');
    expect(x, 'no close button on the sheet').toBeTruthy();
    expect(x.getAttribute('aria-label')).toBe('Close');
    tap(x);
    await wait(60);
    expect($('.modal'), `${label} stayed open after tapping the cross`).toBe(null);
    expect(getState().ui.sheet).toBe(null);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('the phone call also closes on Escape and on the backdrop', async () => {
    await booted();
    await openSheet({ sheet: 'phone' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await wait(60);
    expect($('.modal')).toBe(null);
    await openSheet({ sheet: 'phone' });
    tap($('.scrim'));
    await wait(60);
    expect($('.modal')).toBe(null);
  });

  it('a ticket odds sheet opened from the catalogue closes with its X', async () => {
    const { unmount } = await booted();
    gameStore.getState().dispatch({ type: 'TAB', tab: 'catalog' });
    await wait(120);
    const odds = byText(/^\s*odds\s*$/);
    expect(odds, 'no odds button in the catalogue').toBeTruthy();
    tap(odds);
    await wait(120);
    expect($('.modal')).toBeTruthy();
    expect(document.body.textContent).toMatch(/win chance/i);
    tap($('.modal .xbtn'));
    await wait(80);
    expect($('.modal')).toBe(null);
    unmount();
  });

  it('the buy button on the table actually puts a ticket on the table', async () => {
    const { unmount } = await booted();
    const before = (getState().tray || []).length + (getState().table ? 1 : 0);
    expect(tap(byText(/Buy Two Win/i))).toBe(true);
    await wait(200);
    const after = (getState().tray || []).length + (getState().table ? 1 : 0);
    expect(after).toBe(before + 1);
    expect(getState().balance).toBeLessThan(5e9);
    // and the scratcher is mounted for it, with its canvas + face
    await wait(200);
    expect($('#scratchCv')).toBeTruthy();
    expect($('.tcard__face svg')).toBeTruthy();
    unmount();
  });

  it('a queued event fires exactly once (no doubled sounds, toasts or floats)', async () => {
    const { unmount } = await booted();
    gameStore.getState().dispatch({ type: 'BUY', ticket: 'twowin', n: 3 });
    await wait(60);
    const before = document.querySelectorAll('.toast').length;
    await wait(600); // several store ticks while the queue drains
    const after = document.querySelectorAll('.toast').length;
    expect(after).toBeLessThanOrEqual(before + 1);
    expect(new Set($$('.toast').map(t => t.textContent.trim())).size).toBe(after);
    expect($$('.floaty').length).toBe(0);
    unmount();
  });

  it('no overlay in the app is hand-rolled any more (grep the source)', async () => {
    const fs = await import('node:fs');
    const files = ['src/components/Overlays.jsx', 'src/components/screens.jsx', 'src/App.jsx', 'src/ui/base.jsx'];
    const offenders = files.filter(f => /className="(veil|sheet\b)/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders, `hand-rolled overlays left in: ${offenders.join(', ')}`).toEqual([]);
  });
});
