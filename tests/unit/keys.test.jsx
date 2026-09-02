// React only warns about duplicate keys in dev — so we capture the console here
// and fail the suite on it. Cheap, and it catches whole-tree identity bugs.
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import App from '../../src/App.jsx';
import { gameStore } from '../../src/store.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

describe('react tree hygiene', () => {
  it('mounts, clicks through every tab and every sheet with no key/AnimatePresence warnings', async () => {
    globalThis.__SV_SEED__ = {
      seenOnboard: true,
      balance: 1e7,
      lifetime: { earn: 1e7, spent: 1, jp: 9 },
      run: { earn: 1e7, spent: 1, peak: 1e7 },
      jp: 9,
      tokens: 9,
      level: 9,
      gadgets: {
        bot: { lvl: 3, on: true },
        fan: { lvl: 1, on: true },
        mat: { lvl: 1 },
        mundo: { lvl: 2, on: true },
        auto: { lvl: 1, on: true },
        egg: { lvl: 2 },
        spell: { lvl: 1 },
        machine: { lvl: 0 },
      },
      settings: { sound: false, haptics: false, reduceFx: true, autoClaim: false, tab: 'table' },
      ui: { tab: 'table', sheet: null },
    };
    gameStore.getState().replace(null);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);
    await waitFor(() => expect(document.querySelector('.app')).toBeTruthy(), { timeout: 4000 });
    for (const label of ['Shop', 'Bots', 'JP', 'You', 'Table']) {
      const tab = Array.from(document.querySelectorAll('.tab')).find(b => b.textContent.includes(label));
      fireEvent.click(tab);
      await wait(140);
    }
    // open + close each overlay
    for (const patch of [{ sheet: 'gift' }, { sheet: 'phone' }]) {
      gameStore.getState().dispatch({ type: 'UI', patch });
      await wait(120);
      fireEvent.click(document.querySelector('.modal .xbtn'));
      await wait(120);
    }
    await wait(300);
    const logs = [...err.mock.calls, ...warn.mock.calls].map(c => c.map(String).join(' ')).join('\n');
    err.mockRestore();
    warn.mockRestore();
    cleanup();
    delete globalThis.__SV_SEED__;
    const bad = logs.split('\n').filter(l => /same key|duplicate|unique key|Each child in a list/i.test(l));
    expect(bad, bad.slice(0, 3).join('\n')).toEqual([]);
  });
});
