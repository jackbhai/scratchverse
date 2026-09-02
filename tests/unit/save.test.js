// The save layer is the only thing a player can lose, and import codes are
// untrusted input: schema-validate, migrate v1, never crash.
import { describe, expect, it } from 'vitest';
import { exportCode, importCode, initialState, loadState, merge, migrate, strip, validateSave } from '../../src/db/store.js';
import { APP } from '../../src/game/config.js';

describe('save schema (zod)', () => {
  it('accepts a fresh state and stamps the current version', () => {
    const out = validateSave(initialState());
    expect(out.v).toBe(2);
    expect(out.matBg).toBe('noir');
    expect(out.balance).toBe(15);
  });

  it('rejects a non-numeric balance and says which field broke', () => {
    let err;
    try {
      validateSave({ ...initialState(), balance: 'lots' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/balance/);
  });

  it('rejects negative money, huge names and non-array trays', () => {
    expect(() => validateSave({ balance: -5 })).toThrow();
    expect(() => validateSave({ balance: 10, name: 'x'.repeat(40) })).toThrow();
    expect(() => validateSave({ balance: 10, tray: 'two tickets' })).toThrow();
  });

  it('tolerates unknown extra keys (forward compatible)', () => {
    const out = validateSave({ balance: 10, someFutureField: { a: 1 } });
    expect(out.someFutureField.a).toBe(1);
  });
});

describe('migration from v1 (bitmap era)', () => {
  it('maps old mat ids and the carbon skin onto the vector themes', () => {
    const m = migrate({
      matBg: 'cyber',
      skins: { gold: true, carbon: true },
      skin: 'carbon',
      matsOwned: { wood: true, gems: true },
    });
    expect(m.matBg).toBe('platinum');
    expect(m.skin).toBe('platinum');
    expect(m.skins.carbon).toBeUndefined();
    expect(m.skins.platinum).toBe(true);
    expect(m.matsOwned.noir).toBe(true);
    expect(m.matsOwned.emerald).toBe(true);
  });

  it('drops tickets whose id no longer exists instead of rendering an empty card', () => {
    const m = migrate({
      tray: [
        { id: 'a', ticket: 'twowin' },
        { id: 'b', ticket: 'deleted-ticket' },
      ],
      table: { id: 'c', ticket: 'nope' },
    });
    expect(m.tray.length).toBe(1);
    expect(m.table).toBe(null);
  });

  it('leaves a valid modern save alone', () => {
    const clean = { matBg: 'oxblood', skins: { gold: true }, skin: 'gold', matsOwned: { oxblood: true } };
    expect(migrate(clean)).toMatchObject(clean);
  });
});

describe('export / import codes', () => {
  it('round-trips a run through a code, dropping ephemeral UI fields', async () => {
    const s = {
      ...initialState(),
      balance: 123456,
      jp: 7,
      tokens: 3,
      name: 'Asha',
      owned: { twowin: 4 },
      ui: { tab: 'shop', sheet: 'gift' },
      queue: [{ t: 'x' }],
    };
    const code = exportCode(s);
    expect(code.startsWith('SV1.')).toBe(true);
    const parsed = JSON.parse(
      Buffer.from(code.slice(4).replace(/\n/g, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    expect(parsed.s.balance).toBe(123456);
    expect(parsed.s.ui).toBeUndefined();
    expect(parsed.s.queue).toBeUndefined();
    const back = await importCode(code, { wipe: true });
    expect(back.balance).toBe(123456);
    expect(back.name).toBe('Asha');
    expect(back.jp).toBe(7);
  });

  it('rejects junk, truncated codes and foreign payloads with a readable message', async () => {
    await expect(importCode('hello world')).rejects.toThrow(/ScratchVerse code/);
    const code = exportCode({ ...initialState(), balance: 9 }).slice(0, 24);
    await expect(importCode(code)).rejects.toThrow(/corrupted/i);
    await expect(importCode('SV1.' + Buffer.from(JSON.stringify({ s: { balance: 'x' } })).toString('base64'))).rejects.toThrow();
  });

  it('merge keeps arrays whole and ignores undefined/null (that is why UI patches do not use it)', () => {
    const base = { a: 1, arr: [1, 2, 3], obj: { x: 1 } };
    const out = merge(base, { a: 2, arr: [9], b: undefined, c: null });
    expect(out).toMatchObject({ a: 2, arr: [9], obj: { x: 1 } });
    expect(out.c).toBeUndefined();
    expect(out.b).toBeUndefined();
  });

  it('the UI action preserves an explicit null (the stuck-overlay regression)', async () => {
    const { reducer } = await import('../../src/store.js');
    const open = reducer({ ...initialState(), ui: { tab: 'table', sheet: null } }, { type: 'UI', patch: { sheet: 'gift' } });
    expect(open.ui.sheet).toBe('gift');
    expect(open.ui.tab).toBe('table');
    const closed = reducer(open, { type: 'UI', patch: { sheet: null } });
    expect(closed.ui.sheet).toBe(null);
  });

  it('strip removes exactly the ephemeral fields', () => {
    const out = strip({ balance: 1, queue: [1], ui: { tab: 'x' }, feed: [] });
    expect(out.queue).toBeUndefined();
    expect(out.ui).toBeUndefined();
    expect(out.feed).toEqual([]);
  });

  it('loadState falls back to null with no database (never throws)', async () => {
    const s = await loadState();
    expect(s === null || typeof s === 'object').toBe(true);
  });

  it('the seed hook injects a whole state for tooling and screenshots', async () => {
    globalThis.__SV_SEED__ = { balance: 999, seenOnboard: true };
    const s = await loadState();
    expect(s.balance).toBe(999);
    expect(s.seenOnboard).toBe(true);
    delete globalThis.__SV_SEED__;
  });

  it('exports the app version into the code header', () => {
    const code = exportCode(initialState());
    const parsed = JSON.parse(
      Buffer.from(code.slice(4).replace(/\n/g, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    expect(parsed.app).toBe(APP.version);
    expect(parsed.v).toBe(1);
  });
});
