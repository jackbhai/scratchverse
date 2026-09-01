#!/usr/bin/env node
/**
 * ScratchVerse — balance tuner.
 * Simulates each ticket through the REAL engine (rollTicket + payoutFor),
 * then rescales every symbol `pay` so the expected return lands on target.
 * Keeps the maths honest after any config change:  node scripts/tune.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = resolve(ROOT, 'src/game/config.js');
const { TICKETS, TICKET_BY_ID, EV_TARGET } = await import(pathToFileURL(CFG).href);
const L = await import(pathToFileURL(resolve(ROOT, 'src/game/logic.js')).href);
const { initialState } = await import(pathToFileURL(resolve(ROOT, 'src/db/store.js')).href);
const N = +(process.env.N || 30000);

// target expected return as a multiple of ticket price (in config so the game + tests share it)
export const TARGETS = EV_TARGET;   // 'final' is a story ticket: fixed payout by design

const sim = (s, ticket) => {
  let tot = 0;
  for (let i = 0; i < N; i++) tot += L.payoutFor(s, ticket, L.rollTicket(s, ticket)).pay;
  return tot / N / ticket.price;
};
const base = () => {
  const s = initialState();
  s.balance = 1e14; s.lifetime = { earn: 1e14, spent: 0, jp: 0 };
  s.run = { earn: 1e14, spent: 0, peak: 1e14 };
  return s;
};

let out = [];
for (const t of TICKETS) {
  const target = TARGETS[t.id]; if (!target) { out.push([t.id, sim(base(), t), 0, 1]); continue; }
  let ratio = sim(base(), t);
  if (!isFinite(ratio) || ratio <= 0) { out.push([t.id, ratio, target, 1]); continue; }
  let factor = target / ratio, applied = 1;
  for (let pass = 0; pass < 3; pass++) {
    scalePays(t, factor);
    ratio = sim(base(), TICKET_BY_ID[t.id]);
    applied *= factor;
    if (Math.abs(ratio - target) / target < 0.06) break;
    factor = target / Math.max(ratio, 1e-6);
  }
  out.push([t.id, ratio, target, applied]);
}
function scalePays(ticket, f) {
  ticket.syms.forEach((sy) => {
    if (sy.pay > 0 && !sy.final) sy.pay = +(sy.pay * f).toPrecision(3) * 1;
    if (sy.pay > 0) sy.pay = +sy.pay.toPrecision(3);
  });
}

console.log('ticket        simEV/price   target   scale');
for (const [id, r, tg, f] of out) {
  console.log(`${id.padEnd(13)} ${(r ?? 0).toFixed(3).padStart(7)}    ${tg}    ${(+f).toFixed(3)}`);
}
if (process.argv.includes('--check')) {
  const bad = out.filter(([id, r]) => TARGETS[id] && Math.abs((r ?? 0) - TARGETS[id]) > 0.1);
  console.log(bad.length ? `\n❌ ${bad.length} tickets out of band: ${bad.map(b => b[0]).join(', ')}` : '\n✅ all tickets inside ±10% of target');
  process.exit(bad.length ? 1 : 0);
} else {
  // rewrite config pay values positionally (symbol order is stable in the config)
  let src = readFileSync(CFG, 'utf8');
  for (const t of TICKETS) {
    const idAt = src.indexOf(`id: '${t.id}'`);
    if (idAt < 0) { console.log('! missing ticket', t.id); continue; }
    const open = src.indexOf('syms: [', idAt);
    if (open < 0) { console.log('! no syms for', t.id); continue; }
    let depth = 0, i = src.indexOf('[', open);
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === '[') depth++;
      else if (src[i] === ']') { depth--; if (depth === 0) break; }
    }
    let body = src.slice(start, i + 1);
    let n = 0;
    body = body.replace(/pay: *-?[\d.]+/g, () => {
      const sy = t.syms[n++];
      return `pay: ${(+sy.pay.toPrecision(3)).toString()}`;
    });
    if (n !== t.syms.length) console.log(`! ${t.id}: patched ${n}/${t.syms.length} symbols`);
    src = src.slice(0, start) + body + src.slice(i + 1);
  }
  writeFileSync(CFG, src);
  console.log('\n✓ wrote tuned pay values into src/game/config.js');
}
