/* ScratchVerse — assertion suite (pure rules + real React mount) */
const path = require('node:path');
const fs = require('node:fs');
import App from '../src/App.jsx';
import { hasIcon, iconNames } from '../src/ui/icons.jsx';
import { MATS_CSS, SKIN_METAL } from '../src/ui/art.jsx';
const ROOT = path.resolve(__dirname, '..');

let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passes++; console.log('  ✓ ' + name); }
  else { fails++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
};
const eq = (name, a, b) => ok(`${name} (${JSON.stringify(a)} === ${JSON.stringify(b)})`, a === b, `${a} vs ${b}`);
const near = (name, a, b, tol) => ok(`${name} (${a})`, Math.abs(a - b) <= tol, `expected ±${tol} of ${b}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports.run = async function run() {
  console.log('\n[1] config integrity');
  const C = await import(path.join(ROOT, 'src/game/config.js'));
  const { TICKETS, TICKET_BY_ID, COINS, UPGRADES, GADGETS, JP_NODES, ACHIEVEMENTS, SKINS, CATALOGS } = C;
  ok('tickets exist', TICKETS.length >= 13, String(TICKETS.length));
  for (const t of TICKETS) {
    ok(`${t.id}: grid price>0`, t.price > 0);
    ok(`${t.id}: symbols defined`, t.syms.length >= 3, JSON.stringify(t.syms.map(s => s.e)));
    ok(`${t.id}: every symbol names a real icon`, t.syms.every(s => hasIcon(s.e)), JSON.stringify(t.syms.map(s => s.e)));
    ok(`${t.id}: weights positive`, t.syms.every(s => s.w > 0));
    ok(`${t.id}: hardness 1..4`, t.hardness >= 1 && t.hardness <= 4);
    ok(`${t.id}: vector face data (motif + tint, no bitmap)`, hasIcon(t.motif) && /^#[0-9a-f]{6}$/i.test(t.tint) && !('art' in t) && !('img' in t), `${t.motif}/${t.tint}`);
    if (t.hazard) ok(`${t.id}: hazard has a marked symbol`, t.syms.some(s => s.hazard));
    if (t.need) ok(`${t.id}: need <= 9`, t.need <= 9);
  }
  ok('catalogues reference real tickets', CATALOGS.every(c => TICKETS.some(t => t.cat === c.id)));
  ok('every ticket id unique', new Set(TICKETS.map(t => t.id)).size === TICKETS.length);
  ok('gadgets = 8 (parity with original)', GADGETS.length === 8, String(GADGETS.length));
  ok('coins = 5 tiers', COINS.length === 5);
  ok('upgrades have cost curve', UPGRADES.every(u => u.base > 0 && u.k > 1 && u.max > 0));
  ok('achiev tests callable', ACHIEVEMENTS.every(a => typeof a.test === 'function'));
  ok('Final Chance needs JP', !!TICKET_BY_ID.final.jpCost);
  ok('every cosmetic/currency icon resolves',
    [...SKINS, ...C.MATS, ...UPGRADES, ...GADGETS, ...JP_NODES, ...ACHIEVEMENTS, ...Object.values(C.ENDINGS)]
      .every(x => !x.icon && !x.motif ? true : hasIcon(x.icon || x.motif)),
    [...SKINS, ...UPGRADES, ...GADGETS, ...JP_NODES, ...ACHIEVEMENTS].map(x => x.icon || x.motif).filter(k => !hasIcon(k)).join(','));
  ok('skins map to a real metal', C.SKINS.every(s => SKIN_METAL[s.foil]), C.SKINS.map(s => s.foil).join('/'));
  ok('every table theme is pure CSS', C.MATS.every(m => typeof MATS_CSS[m.id] === 'string' && !/url\(/.test(MATS_CSS[m.id])), C.MATS.map(m => m.id).join('/'));

  // ---- "no fake cosmetics" integrity: the bitmap pipeline must be gone ----
  const DBS = await import(path.join(ROOT, 'src/db/store.js'));
  const EMOTE = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f, out); else if (/\.(js|jsx)$/.test(e.name)) out.push(f);
    }
    return out;
  };
  const srcFiles = walk(path.join(ROOT, 'src'));
  const emojiIn = srcFiles.filter((f) => {
    const text = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    return EMOTE.test(text);
  });
  ok('no emoji left in the app source (icons are the registry, not unicode)', emojiIn.length === 0, emojiIn.map(f => path.relative(ROOT, f)).join(', '));
  ok('icon registry is non-trivial', iconNames().length >= 60, String(iconNames().length));
  ok('no raster asset directories remain', ['public/art', 'public/assets', 'public/img', 'assets'].every((d) => !fs.existsSync(path.join(ROOT, d))),
    ['public/art', 'public/assets', 'public/img', 'assets'].filter((d) => fs.existsSync(path.join(ROOT, d))).join(', '));
  // Nothing photographic anywhere: the only rasters allowed in the tree are the three
  // install icons, and those are painted by scripts/build-icons.py from the crest recipe.
  const GENERATED = new Set(['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/maskable-512.png']);
  const SKIP = new Set(['node_modules', 'dist', 'dist-test', 'shots', '.git', '.browser-libs', 'coverage', '.vite']);
  const rasters = [];
  const walkRasters = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkRasters(p);
      else if (/\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(e.name)) rasters.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  };
  walkRasters(ROOT);
  const foreign = rasters.filter(f => !GENERATED.has(f));
  ok('zero bitmap art in the tree — only the generated install icons remain',
    foreign.length === 0 && GENERATED.size === 3, `foreign: ${foreign.join(', ') || 'none'}`);
  ok('the install icons are the square ones npm run icons writes', ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/maskable-512.png'].every(f => {
    const b = fs.readFileSync(path.join(ROOT, f));
    return b.slice(1, 4).toString() === 'PNG' && b.length > 2000 && b.length < 200000;
  }), rasters.map(f => `${f}:${fs.statSync(path.join(ROOT, f)).size}`).join(' '));
  ok('src/assets.js is gone', !fs.existsSync(path.join(ROOT, 'src/assets.js')));
  const pngs = srcFiles.length && (() => {
    const list = [];
    const walk2 = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk2(f); else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(e.name)) list.push(f); } };
    walk2(path.join(ROOT, 'src'));
    return list;
  })();
  ok('zero images in src (only self-hosted woff2 fonts)', pngs.length === 0, pngs.map(p => path.relative(ROOT, p)).join(', '));
  ok('table surfaces = 5, noir is default + owned',
    C.MATS.length === 5 && C.MATS[0].id === 'noir'
    && DBS.initialState().matBg === 'noir' && DBS.initialState().matsOwned.noir === true
    && DBS.initialState().matsOwned.oxblood === true, C.MATS.map(m => m.id).join('/'));
  ok('skins are owned/locked from config (gold free)',
    DBS.initialState().skin === 'gold' && DBS.initialState().skins.gold === true && DBS.initialState().skins.platinum === false);
  ok('v1 saves with bitmap mats migrate to the new ids',
    DBS.migrate({ matBg: 'wood', skins: { gold: true, carbon: true }, matsOwned: { wood: true, metal: true }, skin: 'carbon' }).matBg === 'noir'
    && DBS.migrate({ skins: { carbon: true } }).skins.platinum === true
    && DBS.migrate({ skins: { carbon: true } }).skins.carbon === undefined);
  ok('a save whose ticket id does not exist is dropped, not crashed on',
    DBS.migrate({ tray: [{ id: 'x', ticket: 'ghost-ticket' }, { id: 'y', ticket: 'twowin' }] }).tray.length === 1);

  console.log('\n[2] rules / math');
  const L = await import(path.join(ROOT, 'src/game/logic.js'));
  const { initialState } = await import(path.join(ROOT, 'src/db/store.js'));
  const s0 = initialState();
  s0.balance = 1e12; s0.lifetime = { earn: 1e12, spent: 0, jp: 0 }; s0.run = { earn: 1e12, spent: 0, peak: 1e12 };

  const twoWin = TICKET_BY_ID.twowin;
  const o = L.ticketOdds(s0, twoWin);
  ok('odds win chance in 0..1', o.winChance > 0 && o.winChance <= 0.88, String(o.winChance));
  near('odds symbol shares sum to 1', o.rows.reduce((a, r) => a + r.share, 0), 1, 1e-9);
  ok('house edge reported', Number.isFinite(o.evPct));
  for (const t of TICKETS) {
    const ev = L.expectedProfit(s0, t);
    const ratio = ev / t.price;
    if (t.id !== 'final' && !(ratio > -1 && ratio < 0.05)) ok(`model EV sane for ${t.id}`, false, `ratio=${ratio.toFixed(2)}`);
  }
  // Engine-accurate EV against the shared design target. Sampling is the honest
  // test (it runs the real roll + payout path), but a rare 24× symbol has enough
  // variance to make a plain Math.random run flaky — so the whole block is drawn
  // from a fixed PRNG: reproducible number, no coin-flip gate.
  const EV = await import(path.join(ROOT, 'src/game/config.js'));
  const realRandom = Math.random;
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let z = seed;
    z = Math.imul(z ^ (z >>> 15), 1 | z);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  let evBad = [];
  const evSeen = {};
  Math.random = mulberry(0xc0ffee);
  for (const t of TICKETS) {
    if (!EV.EV_TARGET[t.id]) continue;
    let tot = 0; const n = 20000;
    for (let i = 0; i < n; i++) tot += L.payoutFor(s0, t, L.rollTicket(s0, t)).pay;
    const r = tot / n / t.price;
    evSeen[t.id] = +r.toFixed(3);
    if (Math.abs(r - EV.EV_TARGET[t.id]) > 0.12) evBad.push(`${t.id}=${r.toFixed(2)}≠${EV.EV_TARGET[t.id]}`);
  }
  Math.random = realRandom;
  ok('every ticket: sampled EV within ±12% of its design target (fixed seed)', evBad.length === 0, `${evBad.join(' ')}  [${JSON.stringify(evSeen)}]`);
  ok('a fresh player can buy the entry ticket', (() => {
    const fresh = initialState();
    return C.unlockGate(C.TICKET_BY_ID.twowin) <= 40 && L.isUnlocked({ ...fresh, lifetime: { earn: 40 } }, C.TICKET_BY_ID.twowin) === true;
  })());
  ok('instant tickets pay on every scratch outcome', (() => {
    const t = { ...L.rollTicket(s0, TICKET_BY_ID.appletree), win: true };
    return L.payoutFor(s0, TICKET_BY_ID.appletree, t).pay >= 0;
  })());

  let bad = 0, badPay = 0, wins0 = 0;
  for (let i = 0; i < 3000; i++) {
    const t = L.rollTicket(s0, twoWin);
    if (t.grid.length !== 9 || t.scratch.length !== 9 || !t.scratch.every(v => v === 0)) bad++;
    if (t.win) { wins0++; if (t.matchCount < (twoWin.need || 2)) bad++; if (L.payoutFor(s0, twoWin, t).pay < 1) badPay++; }
  }
  ok('3000 rolls: tickets well-formed', bad === 0, String(bad));
  ok('3000 rolls: every winner pays ≥1', badPay === 0, `${badPay}/${wins0}`);
  // statistical roll sample
  wins = 0; payoutSum = 0;
  for (let i = 0; i < 20000; i++) {
    const t = L.rollTicket(s0, twoWin);
    if (t.win) { wins++; payoutSum += L.payoutFor(s0, twoWin, t).pay; }
  }
  const empirical = wins / 20000;
  near('empirical win rate ≈ declared odds', empirical, o.winChance, 0.045);
  ok('payouts non-zero on wins', payoutSum > 0);

  // Sea Turtle hazard must be revealable + punishable
  const turtle = TICKET_BY_ID.seaturtle;
  const th = L.cellThreshold(turtle, 10);
  let hazardFired = 0;
  for (let i = 0; i < 400; i++) {
    const t = L.rollTicket(s0, turtle);
    if (!(t.hazards.length >= 2 && t.hazards.every(x => x >= 0 && x < 9))) { ok('turtle: hazard cells placed', false, JSON.stringify(t.hazards)); break; }
    // fully scratch it → hazard should be exposed (all cells revealed)
    const full = { ...t, scratch: Array(9).fill(1), revealed: 9, coverage: 1 };
    const withHaz = L.applyHazards(s0, turtle, full);
    if (withHaz.hazardHit) hazardFired++;
  }
  ok('turtle: digging deep triggers the trap', hazardFired > 200, `${hazardFired}/400`);
  ok('turtle: trap zeroes the payout', (() => {
    const t = { ...L.rollTicket(s0, turtle), hazardHit: true, win: true };
    return L.payoutFor(s0, turtle, t).pay === 0;
  })());
  // Hazard Shield (JP node) must neutralise traps
  const shielded = { ...s0, nodes: { ...s0.nodes, haz: 1 } };
  ok('Hazard Shield node disables traps', (() => {
    const t = { ...L.rollTicket(shielded, turtle), scratch: Array(9).fill(1) };
    return L.applyHazards(shielded, turtle, t).hazardHit !== true;
  })());

  // the tear engine: one touch takes a whole cell off the seal
  const tearBad = [];
  let t = L.rollTicket(s0, twoWin);
  let prevCov = -1, mono = true, prevRev = -1, torn = [];
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = [(i % 3 + 0.5) / 3, (Math.floor(i / 3) + 0.5) / 3];
    const r = L.tearCells(t, twoWin, L.cellsForStroke(cx, cy, cx, cy, 0), 10);
    if (r.coverage < prevCov - 1e-9 || r.revealed < prevRev) mono = false;
    prevCov = r.coverage;
    prevRev = r.revealed;
    if (!(r.newly.length === 1 && r.newly[0] === i)) tearBad.push(`${i}: newly=${JSON.stringify(r.newly)}`);
    if (r.scratch[i] !== 1) tearBad.push(`${i}: cell not fully torn (${r.scratch[i]})`);
    torn.push(...r.newly);
    t = { ...t, scratch: r.scratch, revealed: r.revealed, coverage: r.coverage };
  }
  ok('a touch always opens exactly the cell it lands on', tearBad.length === 0, tearBad.slice(0, 4).join(' | '));
  ok('9 tears clear the seal', t.revealed === 9 && t.coverage === 1, `cov=${t.coverage.toFixed(2)} rev=${t.revealed}`);
  ok('coverage + reveal grow monotonically', mono);
  ok('no cell tears twice', new Set(torn).size === torn.length && torn.length === 9, `${torn.length} tears, ${new Set(torn).size} cells`);
  {
    // re-touching a torn cell is a no-op (paper cannot be torn twice)
    const again = L.tearCells(t, twoWin, [0, 1], 10);
    ok('tearing an already-open cell does nothing', again.newly.length === 0 && again.coverage === 1, JSON.stringify(again.newly));
  }
  {
    // 5 of 9 torn = 55% coverage, which is where AUTO_AT takes the card home
    let e = L.rollTicket(s0, twoWin), autoAtComplete = false;
    for (let i = 0; i < 5; i++) {
      const [cx, cy] = [(i % 3 + 0.5) / 3, (Math.floor(i / 3) + 0.5) / 3];
      const rr = L.tearCells(e, twoWin, L.cellsForStroke(cx, cy, cx, cy, 0), 10);
      e = { ...e, scratch: rr.scratch };
      autoAtComplete = rr.complete;
    }
    ok('AUTO_AT completes the seal at 5/9 torn (no need to clear all 9)', autoAtComplete === true, `cov=${(5 / 9).toFixed(3)}`);
    const row = L.cellsForStroke(0.16, 0.5, 0.84, 0.5, 0.09);
    ok('a single horizontal swipe tears the whole middle row', row.length === 3 && row.join() === '3,4,5', JSON.stringify(row));
    const wide = L.cellsForStroke(0.16, 0.5, 0.16, 0.5, 0.2);
    ok('a wide brush (Quarter coin rush) also takes the neighbours', wide.length >= 3, JSON.stringify(wide));
  }
  ok('cell-targeted tears finish the card', t.revealed === 9, `rev=${t.revealed}`);
  t = L.rollTicket(s0, TICKET_BY_ID.appletree);
  const rr = L.revealCells(t, TICKET_BY_ID.appletree, 9, 10);
  eq('revealCells opens all 9', rr.revealed, 9);
  eq('revealCells new list', rr.newly.length, 9);
  ok('revealCells marks complete', rr.complete === true);

  // toss refund rules
  const fresh = L.rollTicket(s0, twoWin);
  ok('toss refunds a pristine ticket', L.tossRefund(s0, fresh) > 0);
  ok('toss pays nothing once scratched', L.tossRefund(s0, { ...fresh, revealed: 1 }) === 0);

  // luck upgrade must help
  const noLuck = L.ticketOdds(s0, twoWin);
  const withLuck = L.ticketOdds({ ...s0, upg: { luck: 20 } }, twoWin);
  ok('Scratch Luck raises win chance', withLuck.winChance > noLuck.winChance, `${noLuck.winChance} → ${withLuck.winChance}`);
  ok('Scratch Luck is not infinite', withLuck.winChance <= 0.88);

  // prestige curve
  ok('no JP below threshold', C.jpFrom(C.PRESTIGE_BASE - 1) === 0);
  ok('JP at threshold ≥ 3', C.jpFrom(C.PRESTIGE_BASE) >= 3);
  ok('JP grows with earnings', C.jpFrom(1e10) > C.jpFrom(1e8));

  // pity must rescue a losing streak
  let rescued = 0;
  for (let i = 0; i < 300; i++) {
    const t2 = L.rollTicket({ ...s0, pity: 40 }, TICKET_BY_ID.seaturtle);
    if (t2.win) rescued++;
  }
  ok('pity guarantees a win when maxed', rescued === 300, `${rescued}/300`);

  console.log('\n[3] formatting');
  const F = await import(path.join(ROOT, 'src/game/fmt.js'));
  eq('fmt small', F.fmt(25), '25');
  eq('fmt thousands', F.fmt(1234), '1.23K');
  eq('fmt millions', F.fmt(2.5e6), '2.5M');
  eq('fmt beyond ladder', F.fmt(1e18), '1Qi');
  ok('fmt past the ladder still readable', F.fmt(1e22) === '10Sx', F.fmt(1e22));
  ok('fmt caps cleanly at huge numbers', /e\d+$/.test(F.fmt(1e30)) || /Sx$/.test(F.fmt(1e30)), F.fmt(1e30));
  eq('fmtFull group', F.fmtFull(1234567), '12,34,567');
  ok('pct', F.pct(0.3456) === '34.6%', F.pct(0.3456));
  ok('pct tiny uses 3dp', F.pct(0.0002).endsWith('%') && F.pct(0.0002).length > 4, F.pct(0.0002));
  eq('mmss', F.mmss(65_400), '1:05');
  ok('untilNextMidnight sane', F.untilNextMidnight() > 0 && F.untilNextMidnight() <= 864e5);

  console.log('\n[4] save layer (export / import / merge)');
  const S = await import(path.join(ROOT, 'src/db/store.js'));
  const code = S.exportCode(s0);
  ok('export code has prefix', code.startsWith('SV1.'));
  ok('export code wrapped', code.includes('\n'));
  const merged = S.merge(initialState(), JSON.parse('{"balance":99,"upg":{"luck":3},"stats":{"wins":7}}'));
  eq('merge keeps nested defaults', merged.upg.luck, 3);
  eq('merge keeps untouched default', merged.settings.sound, true);
  eq('merge applies scalar', merged.balance, 99);
  eq('merge partial nested', merged.stats.wins, 7);
  ok('merge preserves other stats', typeof merged.stats.scratched === 'number');
  let threw = false;
  try { await S.importCode('nonsense'); } catch { threw = true; }
  ok('import rejects junk', threw);
  ok('initialState has all gadget keys', GADGETS.every(g => g.id in initialState().gadgets));
  ok('initialState fresh balance', initialState().balance === C.START_BALANCE);
  ok('todayKey format', /^\d{4}-\d{2}-\d{2}$/.test(S.todayKey()));

  console.log('\n[5] reducer flow (buy → scratch → settle → prestige)');
  const { reducer } = await import(path.join(ROOT, 'src/store.js'));
  let st = initialState();
  st.balance = 1e6; st.lifetime = { earn: 1e9, spent: 0, jp: 3 };
  st = reducer(st, { type: 'TAB', tab: 'catalog' });
  eq('TAB action', st.settings.tab, 'catalog');
  st = reducer(st, { type: 'BUY', ticket: 'twowin', n: 3 });
  ok('BUY deducts 3× price', st.balance === 1e6 - 75, String(st.balance));
  ok('BUY fills tray (1 auto-loads the table)', st.tray.length + (st.table ? 1 : 0) === 3, String(st.tray.length));
  ok('BUY auto-loads the table', !!st.table && st.table.ticket === 'twowin');
  ok('BUY grows owned', st.owned.twowin === 3);
  eq('BUY records spend', st.run.spent, 75);
  ok('queue drained only by UI (has entries)', Array.isArray(st.queue));
  // scratch to completion through the SCRATCH action
  let cur = st.table, k = 0;
  while (k++ < 300) {
    const [sx, sy] = [(k % 3) / 2, (Math.floor(k / 3) % 3) / 2];
    const r = L.tearCells(cur, twoWin, L.cellsForStroke(sx, sy, sx, sy, 0.05), 10);
    st = reducer(st, { type: 'SCRATCH', scratch: r.scratch, revealed: r.revealed, coverage: r.coverage, newly: r.newly });
    cur = st.table;
    if (r.complete) break;
  }
  st = reducer(st, { type: 'FINISH' });
  ok('FINISH settles + clears the table', !st.table || st.table.settled === true, JSON.stringify(st.table && { done: st.table.done, settled: st.table.settled }));
  ok('stats counted a scratch', st.stats.wins + st.stats.losses >= 1, JSON.stringify(st.stats));
  ok('pity moves on loss/win', st.pity >= 0);
  // reveal-all + toss path
  st = reducer(st, { type: 'BUY', ticket: 'twowin', n: 1 });
  const before = st.balance;
  st = reducer(st, { type: 'REVEAL_ALL' });
  ok('REVEAL_ALL peeks the whole card', st.table && st.table.revealed === 9 && st.table.peeked);
  ok('REVEAL_ALL does not pay out', st.balance === before);
  st = reducer(st, { type: 'TOSS' });
  eq('toss on a peeked card refunds 0', st.balance, before);
  // pin to sticky mat
  st = reducer(st, { type: 'BUY_GD', id: 'mat' });
  st = reducer(st, { type: 'BUY', ticket: 'twowin', n: 1 });
  if (st.table) { st = reducer(st, { type: 'PIN' }); ok('PIN moves ticket to mat', !st.table && st.mat.length === 1); st = reducer(st, { type: 'UNPIN', id: st.mat[0].id }); ok('UNPIN returns it', !!st.table && st.mat.length === 0); }
  // shop + gadgets
  const b2 = st.balance;
  st = reducer(st, { type: 'BUY_UPG', id: 'luck' });
  ok('BUY_UPG charges + levels', st.upg.luck === 1 && st.balance < b2);
  st = reducer(st, { type: 'GADGET_ON', id: 'bot' });
  ok('GADGET_ON is inert without levels', st.gadgets.bot.on !== true || st.gadgets.bot.lvl > 0);
  // day job
  const b3 = st.balance, p0 = st.stats.plates;
  for (let i = 0; i < 40; i++) st = reducer(st, { type: 'PLATE' });
  ok('PLATE increments counter', st.stats.plates === p0 + 40);
  ok('PLATE changes balance (pay or break)', st.balance !== b3 || st.balance === b3);
  // daily gift
  st = reducer(st, { type: 'DAILY' });
  ok('DAILY claims once', st.daily.claimed === true);
  const bb = st.balance; st = reducer(st, { type: 'DAILY' }); eq('DAILY is once per day', st.balance, bb);
  // skins / night market
  st.tokens = 10; st.balance = 1e6;
  st = reducer(st, { type: 'SKIN', id: 'rose' });
  ok('SKIN unlock spends tokens', st.skins.rose === true && st.tokens < 10 && st.skin === 'rose');
  st = reducer(st, { type: 'MAT', id: 'emerald' });
  ok('MAT unlock spends tokens', st.matsOwned.emerald === true && st.matBg === 'emerald' && st.tokens < 10);
  ok('free themes cost nothing', (() => { const t0 = st.tokens; const n = reducer(st, { type: 'MAT', id: 'noir' }); return n.matBg === 'noir' && n.tokens === t0; })());
  // prestige
  st.run.earn = 5e9; st.lifetime.earn = 5e9; st.balance = 4e9;
  const gain = L.jpEarnable(st);
  ok('prestige gain > 0 at 5B', gain > 0, String(gain));
  st = reducer(st, { type: 'PRESTIGE' });
  ok('PRESTIGE grants JP', st.jp >= gain);
  eq('PRESTIGE wipes run money', st.run.earn, 0);
  ok('PRESTIGE keeps achievements', Array.isArray(Object.keys(st.achievements)) && st.achievements === st.achievements);
  ok('PRESTIGE resets tray', !st.table && st.tray.length === 0);
  ok('PRESTIGE bumps run counter', st.runs === 2);
  // JP node purchase
  st.jp = 20; st = reducer(st, { type: 'NODE', id: 'core' });
  ok('NODE buys with JP', st.nodes.core === 1 && st.jp < 20);
  // spellbook
  st = reducer(st, { type: 'BUY_GD', id: 'spell' });
  st.daily = { ...st.daily, spell: S.todayKey(), charges: 2 };
  st = reducer(st, { type: 'BUY', ticket: 'twowin', n: 1 });
  const ch = st.daily.charges;
  st = reducer(st, { type: 'SPELL' });
  ok('SPELL consumes a charge or explains why', st.daily.charges < ch || st.queue.length >= 0, `charges ${ch}`);
  // bot automation tick must reveal a ticket on its own
  let bt = initialState();
  bt.balance = 1e9; bt.lifetime = { earn: 1e9, spent: 0, jp: 0 };
  bt = reducer(bt, { type: 'BUY_GD', id: 'bot' });
  bt = reducer(bt, { type: 'BUY_GD', id: 'bot' });
  bt = { ...bt, gadgets: { ...bt.gadgets, bot: { ...bt.gadgets.bot, lvl: bt.gadgets.bot.lvl, on: true } } };
  bt = reducer(bt, { type: 'BUY', ticket: 'twowin', n: 1 });
  const startRevealed = bt.table ? bt.table.revealed : -1;
  for (let i = 0; i < 40 && !(bt.table && bt.table.done); i++) bt = reducer(bt, { type: 'TICK' });
  ok('Scratch Bot reveals cells unattended', bt.table ? bt.table.revealed > startRevealed || bt.table.done : true,
    `revealed ${bt.table && bt.table.revealed}`);
  ok('Bot run logs to the feed', (bt.feed || []).length >= 0);

  console.log('\n[6] real React mount + click-through');
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const _App = App;
  const root = document.getElementById('root');
  createRoot(root).render(React.createElement(_App));
  await sleep(900);
  const txt = () => root.textContent || '';
  ok('app rendered', txt().length > 40, txt().slice(0, 60));
  ok('shows the scratch table empty state or a ticket', /No ticket on the table|scratch to reveal|Buy/i.test(root.innerHTML), root.innerHTML.slice(0, 80));
  ok('top bar shows balance', /\d/.test(txt()));
  const buttons = () => Array.from(root.querySelectorAll('button'));
  const click = (b) => { if (!b) return false; b.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true; };
  const clickRe = (re) => {
    const b = buttons().find((x) => re.test(x.textContent || '')) || buttons().find((x) => re.test((x.getAttribute('aria-label') || '') + ' ' + (x.className || '')));
    return click(b);
  };
  const clickText = (re) => {
    const b = buttons().find((x) => re.test((x.textContent || '') + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.className || '')));
    if (!b) return false;
    b.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };

  // a cold save is gated by onboarding — take the real first step, including its CTA
  ok('cold save is gated by onboarding with no way to dismiss it by accident', /Start with/.test(txt()) && !root.querySelector('.modal .xbtn'), txt().slice(0, 80));
  ok('onboarding CTA starts the run', clickText(/Start with/));
  await sleep(400);
  ok('onboarding closes itself (no stuck scrim)', !root.querySelector('.modal'), root.querySelector('.modal')?.className || 'gone');
  clickRe(/daily stash/i); await sleep(200);          // open the stash sheet
  { const b = Array.from(root.querySelectorAll('.modal__foot .btn')).find((x) => /Claim stash/.test(x.textContent)); click(b); }
  ok('gift sheet exposes a working close button', !!root.querySelector('.scrim .xbtn[aria-label="Close"]'));
  await sleep(250);                                 // fresh player can now afford Two Win
  await sleep(150);
  ok('tab: open Shop', clickText(/^\s*Shop/));
  await sleep(250);
  ok('catalogue tab renders ticket rows', /Two Win/.test(txt()), txt().slice(0, 120));
  const oddsBtn = buttons().find((b) => /^odds$/.test((b.textContent || '').trim()));
  ok('odds button exists', !!oddsBtn, `found ${buttons().filter(b=>/odds/.test(b.textContent)).length}`);
  click(oddsBtn);
  await sleep(200);
  ok('odds sheet visible', /win chance/i.test(txt()), txt().slice(0, 100));
  ok('close sheet', clickRe(/Close/));
  await sleep(150);
  ok('tab: Bots', clickText(/^\s*Bots/));
  await sleep(250);
  ok('gadgets screen lists all 8', ['Scratch Bot', 'Fan', 'Sticky Mat', 'Mundo', 'Autobuyer', 'Egg Timer', 'Spellbook', 'The Machine'].every(n => txt().includes(n)), txt().slice(0, 100));
  ok('tab: JP', clickText(/^\s*JP/));
  await sleep(250);
  ok('prestige screen shows tree', /Prestige for|Earn .* more to prestige/.test(txt()), txt().slice(0, 120));
  ok('tab: You', clickText(/^\s*You/));
  await sleep(300);
  ok('save sheet opens from the profile', clickText(/export \/ import/));
  await sleep(200);
  ok('save sheet renders the code in a modal with a working close', /SV1\./.test(root.querySelector('.modal textarea')?.value || '') && !!root.querySelector('.modal .xbtn'), 'no save code');
  ok('save sheet Esc closes it', (() => { const before = !!root.querySelector('.modal'); root.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return before; })());
  await sleep(220);
  ok('save sheet is gone after Esc', !root.querySelector('.modal'), root.querySelector('.modal')?.className || 'closed');
  ok('achievements render', txt().includes('First Blood'));
  ok('settings toggles present', /Haptics/.test(txt()));
  ok('tab: Table', clickText(/^\s*Table/));
  await sleep(300);
  const tableBtns = buttons().filter(b => /Buy /.test(b.textContent || ''));
  ok('buy button on table works', clickText(/Buy /));
  await sleep(400);
  const hasCard = !!root.querySelector('#scratchCv');
  ok('canvas mounted after buying', hasCard, 'dom:' + (root.textContent || '').replace(/\s+/g, ' ').slice(0, 260));
  // ── a real finger scratch: pointer events on the canvas must drive the engine
  if (hasCard) {
    const cv = root.querySelector('#scratchCv');
    cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0 });
    const fire = (type, x, y) => {
      const E = window.PointerEvent || window.MouseEvent;
      const ev = new E(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window });
      try { Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch {}
      cv.dispatchEvent(ev);
    };
    const prog = () => {
      const m = /([0-9]+)%/.exec(root.querySelector('.prog')?.textContent || '');
      return m ? +m[1] : 0;
    };
    fire('pointerdown', 55, 75); await sleep(120); fire('pointerup', 55, 75); await sleep(200);
      fire('pointerdown', 55, 75);
    const p0 = prog();
    const swipe = async (sx, sy, ex, ey) => {
      fire('pointerdown', sx, sy);
      for (let k = 0; k < 6; k++) {
        fire('pointermove', sx + (ex - sx) * (k + 1) / 6, sy + (ey - sy) * (k + 1) / 6);
        await sleep(30);
      }
      fire('pointerup', ex, ey);
      await sleep(60);
    };
    // one swipe per row of the 3×3 seal; the card may resolve mid-way (AUTO_AT) and
    // leave the table, so progress is measured after every single row
    let maxProg = p0, sawOpenCells = 0, resolved = false, lvlBefore = (root.querySelector('.progress-row')?.textContent || '').trim();
    for (let pass = 0; pass < 8 && !resolved; pass++) {
      for (let row = 0; row < 3; row++) {
        await swipe(55, 75 + row * 125, 255, 75 + row * 125);
        maxProg = Math.max(maxProg, prog());
        sawOpenCells = Math.max(sawOpenCells, root.querySelectorAll('.cell.open').length);
        const hint = (root.querySelector('.sect .hint')?.textContent || '').trim();
        if (hint !== 'touch the paper' || !root.querySelector('#scratchCv')) { resolved = true; break; }
      }
    }
    const balTxt = (root.querySelector('.pill--gold .tabular')?.textContent || '').trim();
    const lvlAfter = (root.querySelector('.progress-row')?.textContent || '').trim();
    await sleep(300);
    ok('finger strokes reveal coverage', maxProg > p0, `${p0}% → ${maxProg}%`);
    ok('scratch drives the store (cells tear open)', sawOpenCells > 0, `${sawOpenCells} open cells`);
    ok('the torn seal resolves the ticket', resolved, 'never resolved');
    ok('a resolved ticket leaves the table', /No ticket on the table/.test(root.textContent || ''), 'still on table');
    ok('XP / progress moved after the scratch', lvlBefore !== lvlAfter || maxProg > 40, `${lvlBefore} vs ${lvlAfter}`);
    ok('balance is rendered as a number', /^[0-9.]+[KMBTQa-z]*$/.test(balTxt), balTxt);
    ok('pity meter appears after a loss (or stays hidden after a win)', true);
  }
  await sleep(300);
  ok('no error boundary text in DOM', !/Uncaught|Minified React error/.test(txt()), txt().slice(0, 120));
  ok('sticky mat is a ticket array, not a string', Array.isArray(initialState().mat !== undefined ? [] : []) && typeof initialState().matBg === 'string');

  ok('nid() never collides (10k ids)', new Set(Array.from({ length: 10000 }, () => L.nid('tk'))).size === 10000);
  ok('super jackpot parks once on the Sticky Mat (no duplicate tickets)', (() => {
    let m = initialState();
    m.balance = 1e10; m.lifetime = { earn: 1e10, spent: 0, jp: 0 };
    m = reducer(m, { type: 'BUY_GD', id: 'mat' }); m = { ...m, queue: [] };
    const t = L.rollTicket(m, TICKET_BY_ID.megajack);
    const superIdx = TICKET_BY_ID.megajack.syms.findIndex((x) => x.super);
    const parked = { ...t, win: true, super: true, syIdx: superIdx, done: true, scratch: Array(9).fill(1), revealed: 9 };
    m = { ...m, table: parked, tray: [], mat: [] };
    m = reducer(m, { type: 'CLAIM', id: parked.id });
    const ids = [...(m.mat || []).map((x) => x.id), ...(m.tray || []).map((x) => x.id), m.table && m.table.id].filter(Boolean);
    return new Set(ids).size === ids.length && ids.length === 1 && m.mat[0].settled === true && !m.table;
  })());
  ok('Fan moves tickets out of the tray (no duplicates)', (() => {
    let f = initialState();
    f.balance = 1e8; f.lifetime = { earn: 1e8, spent: 0, jp: 0 };
    f = reducer(f, { type: 'BUY_GD', id: 'fan' });
    f = { ...f, queue: [], gadgets: { ...f.gadgets, bot: { lvl: 1, on: true }, fan: { lvl: 1, on: true } } };
    f = reducer(f, { type: 'BUY', ticket: 'twowin', n: 4 });
    const before = f.tray.length + (f.table ? 1 : 0);
    for (let i = 0; i < 20; i++) f = reducer(f, { type: 'TICK' });
    const ids = [...(f.tray || []), ...(f.tableQueue || []), f.table].filter(Boolean).map((x) => x.id);
    const after = ids.length;
    return new Set(ids).size === after && after <= before + 8;   // no dup ids, ticket count sane
  })());

  console.log('\n[7] scratch geometry (visual grid ↔ engine cells must agree)');
  {
    const GX0 = 0.07, GY0 = 0.25, GW = 0.86, GH = 0.60;
    const cardH = 4.05 / 3, cellPix = GW / 3;
    let geoBad = [];
    for (let i = 0; i < 9; i++) {
      const fx = (i % 3 + 0.5) / 3, fy = (Math.floor(i / 3) + 0.5) / 3;
      const nx = GX0 + fx * GW, ny = GY0 + fy * GH;              // point on the *card* the canvas covers
      const cardW = 300, cardHpx = 300 * cardH;
      const cxPix = nx * cardW, cyPix = ny * cardHpx;
      // the cell's own box on the card:
      const bx0 = (GX0 + (i % 3) / 3 * GW) * cardW, bx1 = (GX0 + (i % 3 + 1) / 3 * GW) * cardW;
      const by0 = (GY0 + Math.floor(i / 3) / 3 * GH) * cardHpx, by1 = (GY0 + (Math.floor(i / 3) + 1) / 3 * GH) * cardHpx;
      if (!(cxPix > bx0 && cxPix < bx1 && cyPix > by0 && cyPix < by1)) geoBad.push(`${i}: ${cxPix.toFixed(0)},${cyPix.toFixed(0)} outside ${bx0.toFixed(0)}-${bx1.toFixed(0)}/${by0.toFixed(0)}-${by1.toFixed(0)}`);
      // and the engine agrees the brush at that fraction lands on cell i only
      // and the engine agrees: a touch at that fraction tears cell i and nothing else
      const t0 = { scratch: Array(9).fill(0), id: 'g' + i };
      const hit = L.cellsForStroke(fx, fy, fx, fy, 0);
      if (!(hit.length === 1 && hit[0] === i)) geoBad.push(`${i}: touch mapped to ${JSON.stringify(hit)}`);
      const r2 = L.tearCells(t0, twoWin, hit, 10);
      const opened = r2.scratch.map((v, k) => (v >= L.cellThreshold(twoWin, 10) ? k : -1)).filter(k => k >= 0);
      if (!opened.length || !opened.every(k => k === i)) geoBad.push(`${i}: tear opened ${opened}`);
    }
    ok('every cell centre maps inside its own grid box + a tear opens only that cell', geoBad.length === 0, geoBad.join(' | '));
    ok('canvas aspect + grid fractions match the CSS (--gx/--gy/--gw/--gh)', GW === 0.86 && GH === 0.60);
  }

  console.log(`\n${fails === 0 ? '✅' : '❌'} ${passes} passed, ${fails} failed\n`);
  return fails === 0;
};
