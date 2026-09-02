// ============================================================
// ScratchVerse — single reducer store + IndexedDB autosave + bot engine
// ============================================================
import React, { useEffect, useRef } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand/react';
import {
  TICKET_BY_ID,
  SKINS,
  MATS,
  GADGETS,
  JP_NODES,
  COINS,
  ENDINGS,
  XP_PER_LEVEL,
  PRESTIGE_BASE,
  MONEY_CAP,
  platePay,
  plateBreak,
} from './game/config.js';
import {
  stats,
  rollTicket,
  applyHazards,
  payoutFor,
  tossRefund,
  addXp,
  checkAchievements,
  jpEarnable,
  isUnlocked,
  upgradeValue,
  gadgetValue,
  nodeValue,
  revealCells,
  tableSlots,
  traySlots,
  botSpeed,
  isOn,
  claimInterval,
  autoInterval,
  dailyReward,
  nid,
} from './game/logic.js';
import { loadState, persist, backup, initialState, todayKey, merge, onRemoteSave } from './db/store.js';
import SFX from './game/sound.js';

const clampBal = n => Math.max(0, Math.min(MONEY_CAP, Math.round(n || 0)));
const q = (s, ...items) => ({ ...s, queue: [...(s.queue || []), ...items.filter(Boolean).map(i => ({ id: nid('q'), ...i }))] });

/* ------------------------------------------------- settle a ticket */
function settle(s, id, opts = {}) {
  let t = s.table?.id === id ? s.table : (s.mat || []).find(x => x.id === id) || (s.tray || []).find(x => x.id === id);
  if (!t || t.settled) return s;
  const ticket = TICKET_BY_ID[t.ticket];
  let evs = [];
  let next = { ...s };

  if (opts.toss) {
    const refund = tossRefund(s, t);
    next.balance = clampBal(s.balance + refund);
    next.tray = (s.tray || []).filter(x => x.id !== id);
    next.mat = (s.mat || []).filter(x => x.id !== id);
    if (s.table?.id === id) next.table = null;
    next.stats = { ...s.stats, refunds: s.stats.refunds + 1 };
    next.feed = [{ e: 'trash', x: `${ticket.name} tossed · +${refund}`, a: refund, at: Date.now() }, ...(s.feed || [])].slice(
      0,
      14
    );
    return q(next, { t: 'toast', text: refund ? `Tossed — ${refund} back` : 'Tossed', kind: refund ? 'good' : 'bad' });
  }

  const withHaz = applyHazards(s, ticket, t);
  const res = payoutFor(s, ticket, withHaz);
  const win = res.pay > 0;
  const isSuper = !!res.superWin;
  const isFinal = !!res.final;

  next.balance = clampBal(s.balance + res.pay + (res.refund || 0));
  const st = { ...s.stats };
  st.earned += res.pay;
  st.wins += win ? 1 : 0;
  st.losses += win ? 0 : 1;
  st.bestWin = Math.max(st.bestWin, res.pay);
  st.supers += isSuper ? 1 : 0;
  st.jackpots += res.jackpot ? 1 : 0;
  if (isFinal) st.finals = (st.finals || 0) + 1;
  next.stats = st;
  next.run = { ...s.run, earn: s.run.earn + res.pay, peak: Math.max(s.run.peak, next.balance) };
  next.lifetime = { ...s.lifetime, earn: s.lifetime.earn + res.pay };
  next.pity = win ? 0 : (s.pity || 0) + 1;
  next.luckStreak = win ? Math.min(20, (s.luckStreak || 0) + 1) : 0;
  next.bestBalance = Math.max(s.bestBalance || 0, next.balance);

  const done = { ...withHaz, settled: true, done: true, payout: res.pay, payoutMeta: res };

  if (isFinal) {
    next.table = null;
    next.mat = (s.mat || []).filter(x => x.id !== id);
    next.tray = (s.tray || []).filter(x => x.id !== id);
    next = q(next, { t: 'phone' });
    next.feed = [{ e: 'phone', x: 'The Corporation is calling…', at: Date.now() }, ...(next.feed || [])].slice(0, 14);
    return { ...next, queue: [...(next.queue || []), { t: 'sound', v: 'jackpot' }, { t: 'rain', v: 26 }] };
  }

  // a settled ticket always leaves the table; super jackpots are parked on the Sticky
  // Mat for the human (the Mundo rule) instead of being auto-claimed.
  const park = isSuper && (s.gadgets.mat?.lvl || 0) > 0;
  if (s.table?.id === id) next.table = null;
  next.mat = park ? [done, ...(s.mat || []).filter(x => x.id !== id)].slice(0, 3) : (s.mat || []).filter(x => x.id !== id);
  next.tray = (s.tray || []).filter(x => x.id !== id);
  if (win && isSuper) next.jp = (s.jp || 0) + (s.nodes?.echo || 0 ? 1 : 0);

  if (win) {
    evs = addXp(next, Math.round(XP_PER_LEVEL * 0.35 + Math.log10(1 + res.pay)));
    const ratio = res.pay / (t.price || 1);
    next.feed = [
      {
        e: isSuper ? 'sparkle' : res.jackpot ? 'target' : 'coin',
        x: `${ticket.name} ${isSuper ? 'SUPER JACKPOT' : res.jackpot ? 'jackpot' : 'paid'} +${res.pay}`,
        a: res.pay,
        at: Date.now(),
      },
      ...(next.feed || []),
    ].slice(0, 14);
    const got = checkAchievements(next);
    next = markAchieved(next, got);
    return q(
      next,
      { t: 'win', pay: res.pay, ratio, super: isSuper, ticket: ticket.name, name: ticket.name },
      ...(isSuper
        ? [
            { t: 'sound', v: 'jackpot' },
            { t: 'rain', v: 30 },
          ]
        : []),
      ...evs.map(e => ({ t: 'level', v: e.v, bonus: e.bonus })),
      { t: 'sound', v: isSuper ? 'jackpot' : ratio >= 6 ? 'jackpot' : 'win' }
    );
  }

  next.feed = [
    {
      e: res.penalty ? 'skull' : 'none',
      x: `${ticket.name} ${res.penalty ? 'bit you' : 'paid nothing'} −${ticket.price}`,
      r: res.penalty || ticket.price,
      at: Date.now(),
    },
    ...(next.feed || []),
  ].slice(0, 14);
  const got = checkAchievements(next);
  next = markAchieved(next, got);
  return q(
    next,
    { t: 'sound', v: 'lose' },
    { t: 'toast', text: res.penalty ? `Hazard! −${res.penalty + ticket.price}` : 'No win', kind: 'bad' }
  );
}

function markAchieved(s, got) {
  if (!got?.length) return s;
  return { ...s, queue: [...(s.queue || []), ...got.map(a => ({ t: 'achv', name: a.name, e: a.e, tok: a.tok }))] };
}

/* ------------------------------------------------- buy */
function buy(s, ticketId, n = 1, opts = {}) {
  const ticket = TICKET_BY_ID[ticketId];
  if (!ticket) return s;
  if (!isUnlocked(s, ticket)) return q(s, { t: 'toast', text: 'Locked — earn more first', kind: 'bad' });
  if (ticket.jpCost && (s.jp || 0) < ticket.jpCost) return q(s, { t: 'toast', text: `Needs ${ticket.jpCost} JP`, kind: 'bad' });
  const total = ticket.price * n;
  if (s.balance < total) {
    SFX.error();
    return q(s, { t: 'toast', text: 'Not enough coins', kind: 'bad' });
  }
  let next = { ...s, balance: clampBal(s.balance - total) };
  if (ticket.jpCost) next.jp = next.jp - ticket.jpCost;
  const tickets = Array.from({ length: n }, () => rollTicket(next, ticket));
  next.tray = [...(s.tray || []), ...tickets].slice(-traySlots(s));
  next.owned = { ...s.owned, [ticketId]: (s.owned[ticketId] || 0) + n };
  next.run = { ...next.run, spent: next.run.spent + total };
  next.lifetime = { ...next.lifetime, spent: next.lifetime.spent + total };
  next.stats = { ...next.stats, spent: next.stats.spent + total };
  next.pools = { ...next.pools };
  for (const t of tickets) {
    if (t.win) {
      const c = TICKET_BY_ID[t.ticket];
      if (c.progressive) next.pools[t.ticket] = Math.round((next.pools[t.ticket] || 0) + (c.progressive.rate * total) / n);
    }
  }
  if (ticket.progressive) next.pools[ticket.id] = Math.round((next.pools[ticket.id] || 0) + ticket.progressive.rate * total);
  // auto-load an empty table
  if (!next.table && next.tray.length) {
    const [head, ...rest] = next.tray;
    next.table = { ...head, status: 'table' };
    next.tray = rest.map(x => ({ ...x, status: 'tray' }));
  }
  if (!opts.silent) {
    SFX.buy();
  }
  return q(next, { t: 'sound', v: 'buy' }, { t: 'toast', text: `${n}× ${ticket.name}`, kind: 'good' });
}

/* ------------------------------------------------- tick (automation) */
function tick(s, now) {
  let next = { ...s };
  let changed = false;
  const speed = botSpeed(s);

  // egg timer expiry
  if (next.gadgets.egg.until && next.gadgets.egg.until <= now) {
    next = { ...next, gadgets: { ...next.gadgets, egg: { ...next.gadgets.egg, until: 0, readyAt: 0 } } };
    changed = true;
  }

  // Fan: push tray → table (the bot never starves)
  if (isOn(next, 'fan')) {
    const iv = 2400 / (1 + (next.gadgets.fan.lvl || 0)) / stats(next).eggSpeed;
    if (now - (next._last?.fan || 0) > iv && next.table && next.tray.length) {
      const head = next.tray[0];
      next = {
        ...next,
        tray: next.tray.slice(1), // leaves the tray — never duplicated
        tableQueue: [...(next.tableQueue || []), { ...head, status: 'queue' }].slice(0, Math.max(0, tableSlots(next) - 1)),
        _last: { ...next._last, fan: now },
      };
      changed = true;
    }
  }

  // Scratch Bot
  if (isOn(next, 'bot') && next.table && !next.table.done && !(next.table.claimAt && !isOn(next, 'mundo'))) {
    const t = next.table;
    const ticket = TICKET_BY_ID[t.ticket];
    const st = stats(next);
    const per = Math.max(0.6, 0.28 * speed * (1 + st.strength * 0.03));
    const want = Math.min(9, (t.revealed || 0) + per);
    const n = Math.max(1, Math.floor(want) - (t.revealed || 0));
    {
      const r = revealCells(t, ticket, n, st.strength);
      next = { ...next, table: { ...t, scratch: r.scratch, revealed: r.revealed, coverage: r.coverage, auto: true } };
      changed = true;
      if (r.revealed >= 9) {
        if (isOn(next, 'mundo')) {
          next = { ...next, table: { ...next.table, claimAt: now + Math.max(300, claimInterval(next)) } };
        } else {
          next = settle(next, next.table.id);
        }
      }
      if (!next.table && next.tableQueue?.length) {
        // next ticket off the fan
        const [head, ...rest] = next.tableQueue;
        next = { ...next, table: { ...head, status: 'table' }, tableQueue: rest };
      }
    }
  }

  // Mundo auto-claim
  if (isOn(next, 'mundo')) {
    if (next.table?.done && next.table?.claimAt && now >= next.table.claimAt) {
      next = settle(next, next.table.id);
      changed = true;
    }
    const parked = (next.mat || []).filter(x => x.done && !x.settled);
    for (const p of parked) {
      if (now - (p.createdAt || 0) > 900) {
        next = settle(next, p.id);
        changed = true;
        break;
      }
    }
  }

  // Autobuyer
  if (isOn(next, 'auto') && next.autoTarget) {
    const iv = autoInterval(next);
    if (now - (next._last?.auto || 0) > iv && next.tray.length < 3) {
      const ticket = TICKET_BY_ID[next.autoTarget];
      const qty = next.gadgets.auto.lvl || 1;
      if (ticket && next.balance - ticket.price * qty >= (next.autoReserve || 0)) {
        next = buy(next, next.autoTarget, qty, { silent: true });
        next._last = { ...next._last, auto: now };
        changed = true;
      }
    }
  }

  // pools drift so jackpots feel alive
  if (now - (next._last?.pool || 0) > 4000 && (next.run.spent || 0) > 0) {
    const pools = { ...next.pools };
    let moved = false;
    for (const k of Object.keys(pools)) {
      const t = TICKET_BY_ID[k];
      if (!t?.progressive) continue;
      const rate = t.price * 0.0006 * (1 + Math.log10(1 + next.run.spent));
      const add = Math.min(rate, pools[k] * 0.02);
      if (add > 1) {
        pools[k] = Math.round(pools[k] + add);
        moved = true;
      }
    }
    next = { ...next, _last: { ...next._last, pool: now } };
    if (moved) {
      next.pools = pools;
      changed = true;
    }
  }

  return changed || next.queue?.length ? next : s;
}

/* ------------------------------------------------- reducer */
export function reducer(s, a) {
  const now = Date.now();
  switch (a.type) {
    case 'INIT':
      return a.state;
    case 'QUEUE_POP':
      return { ...s, queue: (s.queue || []).filter(x => x.id !== a.id) };
    // plain spread on purpose: merge() ignores nulls, which used to swallow
    // `sheet: null` and leave overlays open with a dead X button.
    case 'UI':
      return { ...s, ui: { ...(s.ui || {}), ...(a.patch || {}) } };
    case 'SETTINGS': {
      const settings = { ...s.settings, ...a.patch };
      SFX.settings(settings);
      return { ...s, settings };
    }
    case 'NAME':
      return { ...s, name: String(a.name || 'Maxed').slice(0, 12) };
    case 'ONBOARD':
      return { ...s, seenOnboard: true, name: a.name || s.name, balance: clampBal(s.balance + (a.bonus || 0)) };
    case 'COIN': {
      const c = COINS.find(x => x.id === a.id);
      if (!c) return s;
      if ((s.lifetime.earn || 0) < c.gate)
        return q(s, { t: 'toast', text: `Locked until ${c.gate.toLocaleString()} lifetime earnings`, kind: 'bad' });
      return { ...s, coin: a.id };
    }
    case 'BUY':
      return buy(s, a.ticket, a.n || 1);
    case 'SELECT': {
      if (!a.ticket) {
        // pull from tray to table
        const t = (s.tray || [])[a.index ?? 0];
        if (!t) return s;
        return {
          ...s,
          table: s.table ? { ...s.table, status: 'tray', ...{} } : { ...t, status: 'table' },
          tray: s.table
            ? [{ ...s.table, status: 'tray' }, ...s.tray.filter(x => x.id !== t.id)]
            : s.tray.filter(x => x.id !== t.id),
        };
      }
      return buy(s, a.ticket, 1);
    }
    case 'SCRATCH': {
      if (!s.table || s.table.done) return s;
      let next = { ...s, table: { ...s.table, scratch: a.scratch, revealed: a.revealed, coverage: a.coverage, manual: true } };
      if (a.newly?.length) SFX.reveal();
      if (a.complete && !next.table.done) {
        const done = { ...next.table, done: true, scratch: Array(9).fill(1), revealed: 9, coverage: 1 };
        next = { ...next, table: done };
        if (isOn(next, 'mundo')) next = { ...next, table: { ...done, claimAt: now + Math.max(400, claimInterval(next)) } };
        else if (next.settings?.autoClaim) next = settle(next, done.id);
      }
      return next;
    }
    case 'FINISH':
      return s.table && !s.table.settled ? settle(s, s.table.id) : s;
    case 'REVEAL_ALL': {
      if (!s.table || s.table.done) return s;
      const st = stats(s);
      const r = revealCells(s.table, TICKET_BY_ID[s.table.ticket], 9, st.strength);
      return { ...s, table: { ...s.table, scratch: r.scratch, revealed: 9, coverage: 1, peeked: true } };
    }
    case 'TAB':
      return { ...s, ui: { ...s.ui, tab: a.tab }, settings: { ...s.settings, tab: a.tab } };
    case 'CLAIM': {
      const id = a.id || s.table?.id;
      if (!id) return s;
      return settle(s, id);
    }
    case 'TOSS': {
      const id = a.id || s.table?.id;
      if (!id) return s;
      return settle(s, id, { toss: true });
    }
    case 'PIN': {
      if (!s.table) return s;
      if (!(s.gadgets.mat?.lvl > 0)) return q(s, { t: 'toast', text: 'Buy the Sticky Mat first', kind: 'bad' });
      if ((s.mat || []).length >= 3) return q(s, { t: 'toast', text: 'Sticky Mat is full', kind: 'bad' });
      return { ...s, table: null, mat: [{ ...s.table, status: 'mat' }, ...(s.mat || [])] };
    }
    case 'UNPIN': {
      const t = (s.mat || []).find(x => x.id === a.id);
      if (!t) return s;
      if (s.table) return q(s, { t: 'toast', text: 'Table busy', kind: 'bad' });
      return { ...s, mat: s.mat.filter(x => x.id !== a.id), table: { ...t, status: 'table' } };
    }
    case 'SPELL': {
      const g = s.gadgets.spell;
      if (!g.lvl) return q(s, { t: 'toast', text: 'Spellbook not bought', kind: 'bad' });
      if (!s.table || s.table.done) return q(s, { t: 'toast', text: 'Put a ticket on the table', kind: 'bad' });
      const day = todayKey();
      const charges = s.daily.spell === day ? s.daily.charges : 0;
      if (charges <= 0) return q(s, { t: 'toast', text: 'No charges left today', kind: 'bad' });
      const st = stats(s);
      const r = revealCells(s.table, TICKET_BY_ID[s.table.ticket], 9, st.strength);
      let next = {
        ...s,
        daily: { ...s.daily, spell: day, charges: charges - 1 },
        table: { ...s.table, scratch: r.scratch, revealed: 9, coverage: 1, done: true, magic: true },
      };
      next = { ...next, table: { ...next.table, claimAt: 0 } };
      return q(settle(next, next.table.id), { t: 'sound', v: 'whoosh' }, { t: 'toast', text: 'Spellbook used', kind: 'good' });
    }
    case 'BUY_UPG': {
      const { u, lvl, cost, max } = upgradeValue(s, a.id);
      if (!u) return s;
      if (lvl >= max) return s;
      if (s.balance < cost) {
        SFX.error();
        return q(s, { t: 'toast', text: 'Not enough coins', kind: 'bad' });
      }
      const next = { ...s, balance: clampBal(s.balance - cost), upg: { ...s.upg, [a.id]: lvl + 1 } };
      return q(next, { t: 'sound', v: 'buy' });
    }
    case 'BUY_GD': {
      const { g, lvl, cost, jpGate } = gadgetValue(s, a.id);
      if (!g) return s;
      if (jpGate) return q(s, { t: 'toast', text: `The Machine needs ${jpGate} JP`, kind: 'bad' });
      if (lvl >= g.max) return s;
      if (s.balance < cost) {
        SFX.error();
        return q(s, { t: 'toast', text: 'Not enough coins', kind: 'bad' });
      }
      const next = {
        ...s,
        balance: clampBal(s.balance - cost),
        gadgets: { ...s.gadgets, [a.id]: { ...s.gadgets[a.id], lvl: lvl + 1 } },
      };
      if (a.id === 'spell') next.daily = { ...next.daily, spell: todayKey(), charges: Math.max(next.daily.charges, 2 + lvl + 1) };
      if (a.id === 'mat' && !next.gadgets.mat.on) next.gadgets.mat = { ...next.gadgets.mat, on: true };
      return q(checkA(next, { t: 'sound', v: 'buy' }), { t: 'toast', text: `${g.name} Lv.${lvl + 1}`, kind: 'good' });
    }
    case 'GADGET_ON': {
      const g = s.gadgets[a.id];
      if (!g || !g.lvl) return s;
      return { ...s, gadgets: { ...s.gadgets, [a.id]: { ...g, on: !g.on } } };
    }
    case 'EGG': {
      const g = s.gadgets.egg;
      if (!g.lvl) return q(s, { t: 'toast', text: 'Buy the Egg Timer', kind: 'bad' });
      if (g.until > now) return s;
      if ((g.readyAt || 0) > now) return s;
      const dur = (18 + g.lvl * 6) * 1000;
      const next = { ...s, gadgets: { ...s.gadgets, egg: { ...g, until: now + dur, readyAt: now + dur + 75000 } } };
      return q(
        next,
        { t: 'sound', v: 'whoosh' },
        { t: 'toast', text: 'Cranked! Gadgets ×' + (1.6 + g.lvl * 0.25).toFixed(2), kind: 'good' }
      );
    }
    case 'AUTO_SET':
      return { ...s, autoTarget: a.ticket || s.autoTarget, autoQty: a.qty ?? s.autoQty, autoReserve: a.reserve ?? s.autoReserve };
    case 'DAILY': {
      const day = todayKey();
      if (s.daily.day === day && s.daily.claimed) return s;
      const gap = s.daily.last ? Math.round((+new Date(day) - +new Date(s.daily.last)) / 864e5) : 99;
      const streak = gap === 1 ? (s.daily.streak || 0) + 1 : 1;
      const rew = dailyReward({ ...s, daily: { ...s.daily, streak } });
      const next = {
        ...s,
        balance: clampBal(s.balance + rew.coins),
        jp: s.jp + rew.jp,
        // the stash also counts as "seen money" so catalogue tiers keep unlocking
        run: { ...s.run, earn: s.run.earn + rew.coins },
        lifetime: { ...s.lifetime, earn: s.lifetime.earn + rew.coins },
        daily: {
          ...s.daily,
          day,
          last: day,
          claimed: true,
          streak,
          spell: todayKey(),
          charges: Math.max(s.daily.charges, 2 + (s.gadgets.spell.lvl || 0)),
        },
      };
      return q(next, { t: 'sound', v: 'coin' }, { t: 'gift', coins: rew.coins, jp: rew.jp, streak });
    }
    case 'PLATE': {
      const payAmt = platePay(s);
      const broke = Math.random() < plateBreak(s);
      const st = { ...s.stats, plates: s.stats.plates + 1, breaks: s.stats.breaks + (broke ? 1 : 0) };
      let next = { ...s, stats: st };
      if (broke) {
        const fine = Math.min(4 * payAmt, Math.round(s.balance * 0.02));
        next.balance = clampBal(s.balance - fine);
        next = q(next, { t: 'sound', v: 'break' }, { t: 'toast', text: `Plate broke! −${fine}`, kind: 'bad' });
      } else {
        next.balance = clampBal(s.balance + payAmt);
        next.run = { ...s.run, earn: s.run.earn + payAmt };
        next.lifetime = { ...s.lifetime, earn: s.lifetime.earn + payAmt };
        next = q(next, { t: 'sound', v: 'coin' }, { t: 'float', text: `+${payAmt}` });
      }
      return checkA(next);
    }
    case 'PRESTIGE': {
      const gain = jpEarnable(s);
      if (gain < 1)
        return q(s, { t: 'toast', text: `Need ${Math.ceil(PRESTIGE_BASE).toLocaleString()} earned this run`, kind: 'bad' });
      const keep = {
        v: 1,
        name: s.name,
        level: s.level,
        xp: s.xp,
        jp: s.jp + gain,
        tokens: s.tokens,
        achievements: s.achievements,
        skins: s.skins,
        mat: s.mat,
        skin: s.skin,
        settings: s.settings,
        endings: s.endings,
        coin: s.coin,
        nodes: s.nodes,
        lifetime: s.lifetime,
        stats: s.stats,
        runs: (s.runs || 1) + 1,
        bestBalance: s.bestBalance,
        createdAt: s.createdAt,
        seenOnboard: true,
      };
      const fresh = merge(initialState(), keep);
      const seed = [0, 100, 2500, 120000, 6e6][s.nodes.seed || 0] ?? 0;
      fresh.balance = clampBal(seed || 15);
      fresh.run = { earn: 0, spent: 0, peak: fresh.balance };
      if (s.nodes.mech)
        for (const g of GADGETS)
          if (g.id !== 'machine') fresh.gadgets[g.id] = { ...fresh.gadgets[g.id], lvl: Math.max(1, fresh.gadgets[g.id].lvl) };
      fresh.daily = { ...s.daily, day: todayKey(), charges: 2 + (s.gadgets.spell.lvl || 0) };
      const next = { ...fresh, lifetime: { ...s.lifetime, jp: s.lifetime.jp + gain } };
      return q(next, { t: 'prestige', gain }, { t: 'sound', v: 'prestige' });
    }
    case 'NODE': {
      const n = JP_NODES.find(x => x.id === a.id);
      if (!n) return s;
      const { lvl, cost } = nodeValue(s, n);
      if (lvl >= n.max) return s;
      if ((s.jp || 0) < cost) return q(s, { t: 'toast', text: `Need ${cost} JP`, kind: 'bad' });
      return q(
        { ...s, jp: s.jp - cost, nodes: { ...s.nodes, [n.id]: lvl + 1 } },
        { t: 'sound', v: 'buy' },
        { t: 'toast', text: `${n.name} Lv.${lvl + 1}`, kind: 'good' }
      );
    }
    case 'SKIN': {
      const sk = SKINS.find(x => x.id === a.id);
      if (!sk) return s;
      if (!s.skins[a.id]) {
        if (s.tokens < sk.tok || s.balance < sk.coin) return q(s, { t: 'toast', text: 'Need more tokens / coins', kind: 'bad' });
        const next = {
          ...s,
          tokens: s.tokens - sk.tok,
          balance: clampBal(s.balance - sk.coin),
          skins: { ...s.skins, [a.id]: true },
          skin: a.id,
        };
        return q(next, { t: 'toast', text: `${sk.name} unlocked`, kind: 'good' }, { t: 'sound', v: 'buy' });
      }
      return { ...s, skin: a.id };
    }
    case 'MAT': {
      const m = MATS.find(x => x.id === a.id);
      if (!m) return s;
      if (!s.matsOwned?.[a.id]) {
        if ((s.tokens || 0) < (m.tok || 0)) return q(s, { t: 'toast', text: `Need ${m.tok} tokens`, kind: 'bad' });
        const next = { ...s, tokens: s.tokens - (m.tok || 0), matsOwned: { ...(s.matsOwned || {}), [a.id]: true }, matBg: a.id };
        return q(next, { t: 'toast', text: `${m.name} table unlocked`, kind: 'good' });
      }
      return { ...s, matBg: a.id };
    }
    case 'ENDING': {
      const e = ENDINGS[a.kind];
      if (!e) return s;
      if ((s.endings || []).includes(a.kind)) return { ...s, ui: { ...s.ui, ending: null, phone: false } };
      const next = {
        ...s,
        balance: clampBal(s.balance + (e.coin || 0)),
        jp: s.jp + (e.jp || 0),
        lifetime: { ...s.lifetime, jp: s.lifetime.jp + (e.jp || 0) },
        endings: [...(s.endings || []), a.kind],
        achievements: { ...s.achievements },
        table: null,
        ui: { ...s.ui, ending: a.kind, phone: false },
      };
      return q(checkA(next, { t: 'sound', v: 'jackpot' }, { t: 'rain', v: 34 }), {
        t: 'toast',
        text: `Ending: ${e.name}`,
        kind: 'good',
      });
    }
    case 'RESET': {
      if (a.confirm !== true) return s;
      return { ...initialState(), seenOnboard: false };
    }
    case 'TICK':
      return tick(s, now);
    default:
      return s;
  }
}
function checkA(s, ...items) {
  const got = checkAchievements(s);
  let out = got.length ? markAchieved(s, got) : s;
  if (items.length) out = { ...out, queue: [...(out.queue || []), ...items.map(i => ({ id: nid('q'), ...i }))] };
  return out;
}

/* ------------------------------------------------- store (zustand) */
// The whole game stays in `reducer(s, a)` above — a plain, testable function.
// zustand only provides the subscription layer, so a component can pick the
// one field it paints (`useSel(s => s.balance)`) instead of re-rendering on
// every 180 ms tick.
const store = createStore((set, get) => ({
  s: null,
  dispatch: a => {
    const cur = get().s;
    if (!cur && a?.type !== 'INIT') return;
    const next = a?.type === 'INIT' ? a.state : reducer(cur, a);
    if (next !== cur) set({ s: next });
  },
  replace: s => set({ s }),
}));

export const gameStore = store;
export const dispatch = a => store.getState().dispatch(a);
export const getState = () => store.getState().s;

/** whole-state read (screens) */
export function useGame() {
  const s = useStore(store, st => st.s);
  return { s, dispatch: store.getState().dispatch, st: s ? stats(s) : null };
}
/** narrow read for hot leaves: useSel(s => s.balance) */
export function useSel(sel) {
  return useStore(store, st => (st.s ? sel(st.s) : undefined));
}
export const useGameCtx = useGame;

export function GameProvider({ children }) {
  const ready = useStore(store, st => !!st.s);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadState();
      if (!alive) return;
      const base = s || initialState();
      const day = todayKey();
      const patched = {
        ...base,
        daily:
          base.daily?.day === day ? base.daily : { ...base.daily, day, charges: 2 + (base.gadgets?.spell?.lvl || 0), spell: day },
        ui:
          base.ui && typeof base.ui === 'object'
            ? { ...base.ui, tab: base.settings?.tab || 'table' }
            : { tab: 'table', sheet: null },
        queue: [],
        autoQty: base.autoQty || 1,
      };
      store.getState().replace(patched);
      loaded.current = true;
      SFX.settings(patched.settings);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // autosave (debounced) — subscribed, not rendered
  useEffect(() => {
    if (!ready) return undefined;
    let t = null;
    const write = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = getState();
        if (s) persist(s);
      }, 700);
    };
    const unsub = store.subscribe(write);
    const i = setInterval(() => {
      const s = getState();
      if (s) backup(s);
    }, 90000);
    const onHide = () => {
      const s = getState();
      if (s && document.visibilityState === 'hidden') backup(s);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(t);
      clearInterval(i);
      document.removeEventListener('visibilitychange', onHide);
      unsub();
    };
  }, [ready]);

  // a second tab saved — pull its state in rather than overwrite it
  useEffect(() => {
    if (!ready) return undefined;
    let skip = false;
    const off = store.subscribe(() => {
      skip = true;
      setTimeout(() => {
        skip = false;
      }, 900);
    });
    const stop = onRemoteSave(async () => {
      if (skip) return;
      const s = await loadState();
      if (s) store.getState().replace({ ...s, queue: [], ui: { ...(s.ui || {}), tab: getState()?.ui?.tab || 'table' } });
    });
    return () => {
      off();
      stop();
    };
  }, [ready]);

  // game clock
  useEffect(() => {
    if (!ready) return undefined;
    const i = setInterval(() => dispatch({ type: 'TICK' }), 180);
    return () => clearInterval(i);
  }, [ready]);

  // event-queue drain (sounds, win bursts, toasts)
  useEffect(() => {
    if (!ready) return undefined;
    let timer = null;
    let pending = false;
    const pump = () => {
      if (pending) return;
      const q = getState()?.queue || [];
      if (!q.length) return;
      pending = true;
      const first = q[0];
      timer = setTimeout(
        () => {
          pending = false;
          dispatch({ type: 'QUEUE_POP', id: first.id });
          pump();
        },
        first.t === 'win' ? 160 : 90
      );
    };
    const unsub = store.subscribe(pump);
    pump();
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [ready]);

  if (!ready) {
    return React.createElement('div', { className: 'splash' }, [
      React.createElement(CrestMark, { key: 'i' }),
      React.createElement('div', { key: 't', className: 'note' }, 'loading your save…'),
    ]);
  }
  return children;
}

function CrestMark() {
  return React.createElement(
    'div',
    { className: 'crest', 'aria-hidden': 'true' },
    React.createElement(
      'svg',
      { viewBox: '0 0 24 24' },
      React.createElement('path', { d: 'M12 2.2 21 7v10l-9 4.8L3 17V7z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
      React.createElement('path', {
        d: 'M12 6.4 17 9.2v5.6L12 17.6 7 14.8V9.2z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1,
        opacity: 0.55,
      })
    )
  );
}
