// ScratchVerse — state shape, IndexedDB (Dexie) persistence, export/import
import Dexie from 'dexie';
import { z } from 'zod';
import { APP, START_BALANCE, TICKETS, SKINS, MATS } from '../game/config.js';

/**
 * Dexie's tables are declared through version().stores(), which its TS surface
 * cannot see from plain JS — so the shape the app relies on is stated here.
 * @typedef {Dexie & {
 *   meta: { get: (k: string) => Promise<any>, put: (r: any) => Promise<void>, delete: (k: string) => Promise<void> },
 *   snapshots: { add: (r: any) => Promise<number>, toArray: () => Promise<any[]>, count: () => Promise<number>, clear: () => Promise<void>,
 *     orderBy: (k: string) => { last: () => Promise<any>, first: () => Promise<any>, limit: (n: number) => { toArray: () => Promise<any[]>, delete: () => Promise<void> } },
 *     limit: (n: number) => { toArray: () => Promise<any[]> } }
 * }} SVDb
 */
/** @type {SVDb} */
export const db = /** @type {SVDb} */ (/** @type {unknown} */ (new Dexie('scratchverse')));
db.version(1).stores({
  meta: 'key',
  snapshots: '++id, at',
});

/** save codes and DB rows are untrusted input — this is the guard */
const saveSchema = z
  .object({
    v: z.number().optional(),
    balance: z.number().finite().nonnegative(),
    jp: z.number().finite().nonnegative().optional(),
    tokens: z.number().finite().nonnegative().optional(),
    level: z.number().int().positive().optional(),
    xp: z.number().finite().nonnegative().optional(),
    name: z.string().max(24).optional(),
    skin: z.string().optional(),
    matBg: z.string().optional(),
    coin: z.string().optional(),
    autoTarget: z.string().optional(),
    autoQty: z.number().int().min(1).max(99).optional(),
    autoReserve: z.number().finite().nonnegative().optional(),
    matsOwned: z.record(z.boolean()).optional(),
    skins: z.record(z.boolean()).optional(),
    ticketsOwned: z.record(z.number().finite()).optional(),
    owned: z.record(z.number().finite()).optional(),
    settings: z
      .object({
        sound: z.boolean().optional(),
        haptics: z.boolean().optional(),
        reduceFx: z.boolean().optional(),
        autoClaim: z.boolean().optional(),
        tab: z.string().optional(),
      })
      .passthrough()
      .optional(),
    tray: z.array(z.any()).optional(),
    mat: z.array(z.any()).optional(),
    table: z.any().optional(),
    feed: z.array(z.any()).optional(),
    endings: z.array(z.string()).optional(),
    achievements: z.record(z.boolean()).optional(),
    daily: z.any().optional(),
    nodes: z.any().optional(),
    upg: z.any().optional(),
    gadgets: z.any().optional(),
    stats: z.any().optional(),
    run: z.any().optional(),
    lifetime: z.any().optional(),
  })
  .passthrough();

/** v1 saves used bitmap mats and a 'carbon' skin — both are gone. */
const MAT_MAP = { wood: 'noir', felt: 'oxblood', metal: 'graphite', gems: 'emerald', cyber: 'platinum' };
const SKIN_MAP = { carbon: 'platinum' };
export function migrate(raw) {
  const s = { ...(raw || {}) };
  if (s.matBg && !MATS.some(m => m.id === s.matBg)) s.matBg = MAT_MAP[s.matBg] || 'noir';
  if (s.skins) {
    const sk = {};
    for (const [k, v] of Object.entries(s.skins)) sk[SKIN_MAP[k] || k] = v;
    for (const m of SKINS) if (!(m.id in sk)) sk[m.id] = m.tok === 0;
    s.skins = sk;
  }
  if (s.matsOwned) {
    const mo = {};
    for (const [k, v] of Object.entries(s.matsOwned)) mo[MAT_MAP[k] || k] = v;
    s.matsOwned = mo;
  }
  if (s.skin && SKIN_MAP[s.skin]) s.skin = SKIN_MAP[s.skin];
  if (Array.isArray(s.tray)) s.tray = s.tray.filter(t => t && TICKETS.some(x => x.id === t.ticket));
  if (Array.isArray(s.mat)) s.mat = s.mat.filter(t => t && TICKETS.some(x => x.id === t.ticket));
  if (s.table && !TICKETS.some(x => x.id === s.table.ticket)) s.table = null;
  s.v = 2;
  return s;
}

export function validateSave(raw, { loose = false } = {}) {
  const parsed = saveSchema.safeParse(raw || {});
  if (!parsed.success) {
    const first = parsed.error?.issues?.[0];
    /** @type {Error & { issues?: unknown[] }} */
    const err = new Error(
      loose ? 'Save needs repair' : `Save invalid: ${first?.path?.join('.') || '?'} — ${first?.message || 'bad value'}`
    );
    err.issues = parsed.error?.issues;
    throw err;
  }
  return migrate(parsed.data);
}

export const initialState = () => ({
  v: 2,
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
  skins: Object.fromEntries(SKINS.map(k => [k.id, k.tok === 0])),
  matBg: 'noir',
  skin: 'gold',
  feed: [],
  stats: {
    scratched: 0,
    wins: 0,
    losses: 0,
    spent: 0,
    earned: 0,
    supers: 0,
    bestWin: 0,
    streak: 0,
    bestStreak: 0,
    plates: 0,
    breaks: 0,
    peeks: 0,
    refunds: 0,
    jackpots: 0,
    autoScratched: 0,
  },
  settings: { sound: true, haptics: true, reduceFx: false, autoClaim: false, tab: 'table' },
  matsOwned: Object.fromEntries(MATS.map(m => [m.id, m.tok === 0])),
  autoQty: 1,
  queue: [],
  ui: { tab: 'table', sheet: null },
  runs: 1,
  bestBalance: START_BALANCE,
});

export async function loadState() {
  // test / static-render hook: lets tooling inject a seeded save without a DB
  if (globalThis.__SV_SEED__) return merge(initialState(), migrate(globalThis.__SV_SEED__));
  try {
    const row = await db.meta.get('save');
    if (!row?.v) return null;
    try {
      return merge(initialState(), validateSave(row));
    } catch (bad) {
      // a corrupt row should never brick the game: fall back to the auto-backup
      console.warn('save failed validation, trying backup', bad);
      const snap = await latestBackup();
      return snap ? merge(initialState(), validateSave(snap, { loose: true })) : null;
    }
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

/** cross-tab signal so a second tab's save can refresh this one */
const TAB_ID = Math.random().toString(36).slice(2);
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('scratchverse') : null;
export function onRemoteSave(cb) {
  if (!chan) return () => {};
  const fn = e => {
    if (e?.data?.tab === TAB_ID || e?.data?.type !== 'save') return;
    cb?.();
  };
  chan.addEventListener('message', fn);
  return () => chan.removeEventListener('message', fn);
}

export async function persist(state) {
  const clean = strip(state);
  try {
    await db.meta.put({ key: 'save', ...clean, at: Date.now(), app: APP.version, tab: TAB_ID });
    chan?.postMessage({ type: 'save', tab: TAB_ID, at: Date.now() });
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
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportCode(state) {
  try {
    const payload = { v: 1, app: APP.version, at: Date.now(), s: strip(state) };
    return (
      'SV1.' +
      toB64(JSON.stringify(payload))
        .match(/.{1,44}/g)
        .join('\n')
    );
  } catch (e) {
    console.warn(e);
    return '';
  }
}

export async function importCode(text, { wipe = false } = {}) {
  const t = String(text || '')
    .trim()
    .replace(/\s+/g, '');
  if (!t.startsWith('SV1.')) throw new Error('Not a ScratchVerse code (should start with SV1.)');
  let payload;
  try {
    payload = JSON.parse(fromB64(t.slice(4)));
  } catch {
    throw new Error('Code is corrupted — cannot decode.');
  }
  if (!payload?.s || typeof payload.s.balance !== 'number') throw new Error('Code has no valid save inside.');
  const safe = validateSave(payload.s);
  const base = wipe ? initialState() : (await loadState()) || initialState();
  const next = merge(base, safe);
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
    if (n > 8)
      await db.snapshots
        .orderBy('at')
        .limit(n - 8)
        .delete();
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
