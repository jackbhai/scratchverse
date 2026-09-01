// ScratchVerse — state shape, IndexedDB (Dexie) persistence, export/import
import Dexie from 'dexie';
import { APP, START_BALANCE } from '../game/config.js';

export const db = new Dexie('scratchverse');
db.version(1).stores({
  meta: 'key',
  snapshots: '++id, at',
});

export const initialState = () => ({
  v: 1,
  createdAt: Date.now(),
  balance: START_BALANCE,
  jp: 0,
  tokens: 0,
  level: 1,
  xp: 0,
  name: 'Maxed',
  seenOnboard: false,
  coin: 'penny',
  luckStreak: 0,
  pity: 0,
  pools: { luckycat: 120000, booster: 40000000000 },
  owned: {},
  upg: {},
  nodes: {},
  gadgets: {
    bot: { lvl: 0, on: false },
    fan: { lvl: 0, on: false },
    mat: { lvl: 0 },
    mundo: { lvl: 0, on: false },
    auto: { lvl: 0, on: false },
    egg: { lvl: 0, until: 0, ready: 0 },
    spell: { lvl: 0, charges: 0, max: 0 },
    machine: { lvl: 0 },
  },
  table: null,
  tray: [],
  mat: [],
  autoTarget: 'twowin',
  autoReserve: 50,
  run: { earn: 0, spent: 0, peak: 0 },
  lifetime: { earn: 0, spent: 0, jp: 0 },
  daily: { day: '', claimed: false, spell: '', charges: 0 },
  achievements: {},
  endings: [],
  skins: { gold: true, rose: false, neon: false, carbon: false },
  matBg: 'wood',
  skin: 'gold',
  feed: [],
  stats: {
    scratched: 0, wins: 0, losses: 0, spent: 0, earned: 0, supers: 0,
    bestWin: 0, streak: 0, bestStreak: 0, plates: 0, breaks: 0, peeks: 0,
    refunds: 0, jackpots: 0, autoScratched: 0,
  },
  settings: { sound: true, haptics: true, reduceFx: false, autoClaim: false, tab: 'table' },
  matsOwned: { wood: true, felt: true },
  autoQty: 1,
  queue: [],
  ui: { tab: 'table', sheet: null },
  runs: 1,
  bestBalance: START_BALANCE,
});

export async function loadState() {
  // test / static-render hook: lets tooling inject a seeded save without a DB
  if (globalThis.__SV_SEED__) return merge(initialState(), globalThis.__SV_SEED__);
  try {
    const row = await db.meta.get('save');
    if (!row?.v) return null;
    return merge(initialState(), row);
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

export async function persist(state) {
  const clean = strip(state);
  try {
    await db.meta.put({ key: 'save', ...clean, at: Date.now(), app: APP.version });
  } catch (e) {
    console.warn('save failed', e);
  }
}

/** merge with array/undefined safety (arrays replaced, objects deep-merged) */
export function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over || {})) {
    const b = base?.[k];
    const a = over[k];
    if (Array.isArray(a)) out[k] = a;
    else if (b && typeof b === 'object' && a && typeof a === 'object') out[k] = merge(b, a);
    else if (a !== undefined && a !== null) out[k] = a;
  }
  return out;
}

/** drop ephemeral UI fields before writing to IndexedDB / export codes */
export function strip(s) {
  const { queue: _queue, ui: _ui, ...rest } = s;
  return rest;
}

/* ---------- export / import codes ---------- */
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportCode(state) {
  try {
    const payload = { v: 1, app: APP.version, at: Date.now(), s: strip(state) };
    return 'SV1.' + toB64(JSON.stringify(payload)).match(/.{1,44}/g).join('\n');
  } catch (e) {
    console.warn(e);
    return '';
  }
}

export async function importCode(text, { wipe = false } = {}) {
  const t = String(text || '').trim().replace(/\s+/g, '');
  if (!t.startsWith('SV1.')) throw new Error('Not a ScratchVerse code (should start with SV1.)');
  let payload;
  try {
    payload = JSON.parse(fromB64(t.slice(4)));
  } catch {
    throw new Error('Code is corrupted — cannot decode.');
  }
  if (!payload?.s || typeof payload.s.balance !== 'number') throw new Error('Code has no valid save inside.');
  const base = wipe ? initialState() : await loadState() || initialState();
  const next = merge(base, payload.s);
  await persist(next);
  return next;
}

export async function wipe() {
  await db.meta.delete('save');
  await db.snapshots.clear();
}

/** keep a rotating backup snapshot so a bad import can be undone */
export async function backup(state) {
  try {
    await db.snapshots.add({ at: Date.now(), ...strip(state) });
    const n = await db.snapshots.count();
    if (n > 8) await db.snapshots.orderBy('at').limit(n - 8).delete();
  } catch (e) {
    console.warn('backup failed', e);
  }
}

export async function latestBackup() {
  const row = await db.snapshots.orderBy('at').last();
  return row || null;
}

export const todayKey = (offset = 0) => {
  const d = new Date(Date.now() - offset * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
