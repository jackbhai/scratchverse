// ============================================================
// ScratchVerse — pure rules.  No React, no DOM.  Fully testable.
// ============================================================
import {
  COINS,
  UPGRADES,
  GADGETS,
  ACHIEVEMENTS,
  PITY,
  AUTO_AT,
  HARDNESS_DAB,
  xpNeed,
  jpFrom,
  nodeCost,
  MONEY_CAP,
  unlockGate,
} from './config.js';

export const CELLS = 9;
let _n = 0;
/** collision-free ids: monotonic counter + 32-bit entropy + time bucket */
export const nid = (p = 't') =>
  `${p}${((_n = (_n + 1) >>> 0)).toString(36)}${((Math.random() * 4294967295) >>> 0).toString(36)}${(Date.now() % 1e6).toString(36)}`;

/* ------------------------------------------------- derived stats */
export function stats(s) {
  const up = id => s.upg?.[id] || 0;
  const node = id => s.nodes?.[id] || 0;
  const gd = id => (s.gadgets && s.gadgets[id]) || {};
  const luckPct = up('luck') * 3.2 + node('core') * 5 + Math.min(12, (s.luckStreak || 0) * 0.6);
  const coin = COINS.find(c => c.id === s.coin) || COINS[0];
  const eggOn = (gd('egg').until || 0) > Date.now();
  const eggSpeed = eggOn ? 1.6 + (gd('egg').lvl || 0) * 0.25 : 1;
  return {
    luckPct,
    payout: (1 + up('payout') * 0.11) * (1 + node('midas') * 0.15) * (1 + (gd('machine').lvl || 0) * 0.35),
    brush: coin.r * (1 + up('size') * 0.07),
    strength: Math.max(1, 10 - up('coin')),
    coin,
    refund: Math.min(0.9, 0.4 + up('toss') * 0.06),
    hazardsOff: node('haz') > 0,
    eggOn,
    eggSpeed,
    botLvl: gd('bot').lvl || 0,
    speed: eggSpeed * (1 + (gd('bot').lvl || 0) * 0.12),
  };
}
export const isOn = (s, id) => !!s.gadgets?.[id]?.on && (s.gadgets[id].lvl || 0) > 0;
export const botSpeed = s => stats(s).speed * (0.6 + stats(s).botLvl * 0.5);
export const fanInterval = s => 2400 / (1 + (s.gadgets.fan?.lvl || 0)) / stats(s).eggSpeed;
export const claimInterval = s => (3000 - (s.gadgets.mundo?.lvl || 0) * 700) / stats(s).eggSpeed;
export const autoInterval = s => 2600 / (s.gadgets.auto?.lvl || 1) / stats(s).eggSpeed;

/* ------------------------------------------------- odds table */
/** p = chance this symbol is the deciding one (given the card is a winner) */
/** per-ticket multipliers: extra-match bonus + instant "all 9 cells pay" */
export function modeMult(ticket, i, extraMatches = 0) {
  const sy = ticket.syms[i];
  if (sy.neg || ticket.win === 'final' || sy.super || sy.final || ticket.win === 'instant') return 1;
  const cap = ticket.maxWin || 4;
  return 1 + 0.35 * Math.max(0, Math.min(cap, extraMatches));
}
/** expected paying cells for the chosen symbol */
export function expectedMatches(_s, ticket, _i) {
  if (ticket.win === 'instant') return CELLS; // all nine cells pay
  return 1; // modeMult already folds the bonus in
}
export function ticketOdds(s, ticket, { ignoreLuck = false } = {}) {
  const st = stats(s || {});
  const shift = ignoreLuck ? 0 : st.luckPct / 100;
  const cap = ticket.win === 'final' ? 0.55 : 0.88;
  // win rate = sum of *positive* symbol weights (penalty symbols never make you win)
  const posW = ticket.syms.reduce((a, x) => a + (x.neg ? 0 : x.w), 0);
  const wsum = Math.min(cap * 100, posW);
  const w = ticket.syms.map(x => x.w * (1 + (x.pay > 0 ? shift : shift * 0.4) * 0.9));
  const tot = w.reduce((a, b) => a + b, 0);
  const base = Math.min(cap, Math.max(0.03, (wsum / 100) * (1 + shift * 0.5)));
  const pool = s?.pools?.[ticket.id] || 0;
  const rows = ticket.syms.map((sy, i) => {
    const share = w[i] / tot;
    const extra = ticket.win === 'instant' || ticket.win === 'final' || sy.neg || sy.super || sy.final ? 0 : 0.2;
    let pay = ticket.price * sy.pay * modeMult(ticket, i, extra) * expectedMatches(s || { pools: {} }, ticket, i) * st.payout;
    if (sy.super) pay = Math.round(ticket.price * 45 * st.payout);
    else if (sy.final) pay = Math.round(ticket.price * 12 * st.payout);
    if (sy.neg) pay = 0;
    return { ...sy, i, share, p: share * base, pay: Math.round(pay), loss: !!sy.neg };
  });
  const avg = rows.reduce((a, r) => a + r.share * (r.pay / ticket.price), 0);
  const evPct = Math.round((base * avg - 1) * 100); // -100 … +N  (net of the ticket price)
  return {
    winChance: base,
    loseChance: 1 - base,
    rows,
    evPct,
    poolBonus: pool ? +(pool / ticket.price).toFixed(2) : 0,
    returnMult: +(base * avg).toFixed(2),
    pool,
    payoutMult: st.payout,
    need: ticket.need || (ticket.win === 'match3' ? 3 : 2),
    luckPct: st.luckPct,
  };
}
export const expectedProfit = (s, ticket) => {
  const o = ticketOdds(s, ticket);
  return Math.round(o.winChance * o.rows.reduce((a, r) => a + r.share * r.pay, 0) - ticket.price);
};

/* ------------------------------------------------- ticket roll */
export function rollTicket(s, ticket) {
  const st = stats(s);
  const o = ticketOdds(s, ticket);
  const pityNeed = Math.max(6, PITY.need - (s.upg?.luck || 0));
  const pityRescue = (s.pity || 0) >= pityNeed && ticket.win !== 'final';
  let win = pityRescue || Math.random() < o.winChance;

  const idxBy = f => ticket.syms.findIndex(f);
  const negIdx = idxBy(x => x.neg);
  let syIdx;
  if (win) {
    const good = ticket.syms.map((x, i) => ({ x, i })).filter(r => !r.x.neg);
    const wsum = good.reduce((a, r) => a + r.x.w * (1 + (r.x.pay > 0 ? st.luckPct : 0) / 130), 0);
    let r = Math.random() * wsum;
    syIdx = good[0].i;
    for (const g of good) {
      r -= g.x.w * (1 + (g.x.pay > 0 ? st.luckPct : 0) / 130);
      if (r <= 0) {
        syIdx = g.i;
        break;
      }
    }
  } else {
    syIdx = negIdx >= 0 && Math.random() < 0.34 ? negIdx : 0;
  }
  if (ticket.win === 'final') {
    const fi = idxBy(x => x.final);
    if (win && fi >= 0) syIdx = fi;
  }
  const need = ticket.need || (ticket.win === 'match3' ? 3 : 2);
  const other = i => (i + 1 + Math.floor(Math.random() * Math.max(1, ticket.syms.length - 1))) % ticket.syms.length;

  const grid = Array.from({ length: CELLS }, () => (Math.random() < 0.55 ? syIdx : other(syIdx)));
  if (win && (ticket.win === 'match3' || ticket.win === 'any')) {
    const count = need + (Math.random() < 0.12 ? 1 : 0);
    const spots = [...Array(CELLS).keys()].sort(() => Math.random() - 0.5).slice(0, count);
    for (const i of spots) grid[i] = syIdx;
  }

  // hazard symbols (Sea Turtle / Sand Dollars): penalty cells scattered anywhere
  const hzIdx = idxBy(x => x.hazard);
  let hazards = [];
  if (ticket.hazard && hzIdx >= 0) {
    hazards = [...Array(CELLS).keys()].sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.4 ? 1 : 0));
    for (const i of hazards) grid[i] = hzIdx;
  }

  return {
    id: nid('tk'),
    ticket: ticket.id,
    price: ticket.price,
    grid,
    syIdx,
    win,
    matchCount: grid.filter(g => g === syIdx).length,
    hazards,
    scratch: Array(CELLS).fill(0),
    revealed: 0,
    coverage: 0,
    done: false,
    hazardHit: false,
    super: !!(win && ticket.syms[syIdx].super),
    final: !!(win && ticket.syms[syIdx].final),
    pity: !!pityRescue,
    status: 'tray',
    createdAt: Date.now(),
    claimAt: 0,
  };
}

/* ------------------------------------------------- scratch engine */
export const cellThreshold = (ticket, strength = 10) =>
  Math.max(0.22, Math.min(0.9, 0.3 + (1 - (HARDNESS_DAB[ticket.hardness] || 0.9)) * 1.15 - (strength - 1) * 0.022));

export function cellsForStroke(x0, y0, x1, y1, pad = 0.07) {
  const out = [];
  const seen = new Set();
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 26));
  const ring = pad > 0.17 ? 1 : 0; // a wide brush (Quarter coin rush) also takes the neighbours
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const x = x0 + (x1 - x0) * f,
      y = y0 + (y1 - y0) * f;
    const c0 = Math.max(0, Math.min(2, Math.floor(x * 3))),
      r0 = Math.max(0, Math.min(2, Math.floor(y * 3)));
    for (let r = Math.max(0, r0 - ring); r <= Math.min(2, r0 + ring); r++)
      for (let c = Math.max(0, c0 - ring); c <= Math.min(2, c0 + ring); c++) {
        const gx = (c + 0.5) / 3,
          gy = (r + 0.5) / 3;
        if (Math.abs(x - gx) > 1 / 6 + pad || Math.abs(y - gy) > 1 / 6 + pad) continue;
        const k = r * 3 + c;
        if (!seen.has(k)) {
          seen.add(k);
          out.push(k);
        }
      }
  }
  return out;
}

/** Tear the paper seal off the given cells in one go — the pointer's whole model of scratching. */
export function tearCells(t, ticket, cells, strength = 10) {
  const th = cellThreshold(ticket, strength);
  const sc = t.scratch.slice();
  const newly = [];
  for (const i of cells) {
    if (i == null || i < 0 || i >= sc.length || sc[i] >= th) continue;
    sc[i] = 1;
    newly.push(i);
  }
  const coverage = sc.reduce((a, b) => a + Math.min(1, b), 0) / CELLS;
  const revealed = sc.filter(v => v >= th).length;
  return { scratch: sc, newly, revealed, coverage, complete: revealed >= CELLS || coverage >= AUTO_AT };
}
/** erase cells in deterministic order — used by the Scratch Bot */
export function revealCells(t, ticket, n, strength) {
  const th = cellThreshold(ticket, strength);
  const sc = t.scratch.slice();
  const newly = [];
  const len = (t.scratch && t.scratch.length) || CELLS;
  const order = [...Array(len).keys()];
  // stable-ish pseudo order seeded by ticket id → looks random, replays identically
  order.sort((a, b) => h32(t.id + a) - h32(t.id + b));
  for (const i of order) {
    if (sc[i] >= th) continue;
    sc[i] = Math.max(sc[i], th + 0.02 + (h32(t.id + 'x' + i) % 1000) / 4000);
    newly.push(i);
    if (newly.length >= n) break;
  }
  const coverage = sc.reduce((a, b) => a + Math.min(1, b), 0) / CELLS;
  const revealed = sc.filter(v => v >= th).length;
  return { scratch: sc, newly, revealed, coverage, complete: revealed >= CELLS };
}
export function h32(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/* ------------------------------------------------- hazards + payout */
export function applyHazards(s, ticket, t) {
  if (t.hazardHit) return t;
  const st = stats(s);
  if (st.hazardsOff) return { ...t, hazardBlocked: true };
  let hit = false;
  if (ticket.hazard && ticket.hazard.at && t.hazards?.length) {
    const th = cellThreshold(ticket, st.strength);
    const exposed = t.hazards.filter(i => (t.scratch[i] || 0) >= th).length;
    if (exposed / t.hazards.length >= ticket.hazard.at) hit = true;
  }
  const snake = ticket.syms.findIndex(x => x.e === 'snake');
  if (!hit && snake >= 0) {
    const n = t.grid.filter(g => g === snake).length;
    if (n >= 2 && (n < (ticket.need || 3) || t.grid.filter(g => g === t.syIdx).length < (ticket.need || 3))) hit = true;
  }
  return hit ? { ...t, hazardHit: true } : t;
}

export function payoutFor(s, ticket, t) {
  const st = stats(s);
  if (t.hazardHit) return { pay: 0, penalty: Math.round(ticket.price * 2), superWin: false, jackpot: false };
  if (!t.win) {
    const refund = s.gadgets.machine?.lvl || 0 ? Math.round(ticket.price * 0.15 * (s.gadgets.machine.lvl || 0)) : 0;
    return { pay: 0, penalty: 0, refund, superWin: false, jackpot: false };
  }
  if (t.final) {
    return {
      pay: Math.round(Math.min(MONEY_CAP, Math.max(s.balance * 3, ticket.price * 12))),
      penalty: 0,
      superWin: false,
      jackpot: false,
      final: true,
    };
  }
  const sy = ticket.syms[t.syIdx];
  if (t.super) return { pay: Math.round(ticket.price * 45 * st.payout), penalty: 0, superWin: true, jackpot: false };
  const need = ticket.need || (ticket.win === 'match3' ? 3 : 2);
  const pool = s.pools?.[ticket.id] || 0;
  let total = 0;
  if (ticket.win === 'instant') {
    total = t.grid.reduce((a, gi) => a + ticket.syms[gi].pay, 0);
  } else {
    const matched = Math.max(need, Math.min(ticket.maxWin || 9, t.matchCount || need));
    total = sy.pay * modeMult(ticket, t.syIdx, matched - need);
  }
  // progressive pool: a jackpot symbol banks the whole pool on top of its base pay
  const jackpot = !!(sy.jackpot && pool > 0);
  if (jackpot) total += pool / (ticket.price || 1);
  if (total <= 0) return { pay: 0, penalty: 0, superWin: false, jackpot: false };
  const pay = Math.round(ticket.price * total * st.payout);
  return { pay: Math.max(1, pay), penalty: 0, superWin: false, jackpot };
}

/* ------------------------------------------------- cosmetics / toss */
export const tossRefund = (s, t) => {
  if ((t.revealed || 0) > 0) return 0; // scratched → no money back
  return Math.round((t.price || 0) * stats(s).refund);
};
export const peekCost = t => Math.round((t.price || 0) * 0.15);
/** the equipped skin's metal key (see SKIN_METAL in src/ui/art.jsx) */
export const foilFor = s => (s.skin && s.skins?.[s.skin] !== false ? s.skin : 'gold');

/* ------------------------------------------------- progression */
export function addXp(s, amount) {
  const evs = [];
  s.xp = (s.xp || 0) + amount;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level);
    s.level += 1;
    const bonus = 40 * s.level;
    s.balance = Math.min(MONEY_CAP, s.balance + bonus);
    evs.push({ t: 'level', v: s.level, bonus });
  }
  return evs;
}

export function checkAchievements(s) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements?.[a.id]) continue;
    let ok = false;
    try {
      ok = !!a.test(s);
    } catch {
      ok = false;
    }
    if (ok) {
      s.achievements[a.id] = Date.now();
      s.tokens += a.tok;
      got.push(a);
    }
  }
  return got;
}

export const jpEarnable = s => jpFrom(s.run?.earn || 0);
export const isUnlocked = (s, ticket) =>
  (s.lifetime?.earn || 0) + (s.run?.earn || 0) >= unlockGate(ticket) || (s.owned?.[ticket.id] || 0) > 0;

export function upgradeValue(s, id) {
  const u = UPGRADES.find(x => x.id === id);
  const lvl = s.upg?.[id] || 0;
  return { u, lvl, max: u?.max || 0, cost: !u || lvl >= u.max ? null : Math.round(u.base * Math.pow(u.k, lvl)) };
}
export function gadgetValue(s, id) {
  const g = GADGETS.find(x => x.id === id);
  const lvl = s.gadgets?.[id]?.lvl || 0;
  return {
    g,
    lvl,
    max: g?.max || 0,
    cost: lvl >= g.max ? null : Math.round(g.base * Math.pow(g.k, lvl)),
    jpGate: (g?.gateJP || 0) > (s.jp || 0) ? g.gateJP : 0,
  };
}
export function nodeValue(s, n) {
  const lvl = s.nodes?.[n.id] || 0;
  return { lvl, max: n.max, cost: lvl >= n.max ? null : nodeCost(n, lvl) };
}
export const canBuy = (s, price) => (s.balance || 0) >= price;
export const pay = (s, price) => {
  s.balance = Math.max(0, (s.balance || 0) - price);
};

/* ------------------------------------------------- daily gift */
export const dailyReward = s => {
  const streak = s.daily?.streak || 0;
  const base = Math.max(200, Math.round((s.run?.peak || 0) * 0.06 + (s.lifetime?.earn || 0) * 0.0015));
  return { coins: Math.round(base * (1 + streak * 0.25)), jp: streak >= 6 ? 1 : 0, streak };
};

export const tableSlots = _s => 3;
export const traySlots = s => 12 + (s.gadgets?.fan?.lvl || 0) * 6;
