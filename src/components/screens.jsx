// ============================================================
// ScratchVerse — screens
// ============================================================
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  CATALOGS, TICKETS, TICKET_BY_ID, UPGRADES, GADGETS, COINS, SKINS, MATS,
  JP_NODES, ACHIEVEMENTS, ENDINGS, PRESTIGE_BASE, unlockGate,
} from '../game/config.js';
import {
  stats, ticketOdds, isUnlocked, upgradeValue, gadgetValue, nodeValue,
  jpEarnable, traySlots, foilFor, dailyReward as dailyRewardOf,
} from '../game/logic.js';
import { fmt, fmtFull, pct, mmss, untilNextMidnight } from '../game/fmt.js';
import { todayKey } from '../db/store.js';
import { useGame } from '../store.js';
import ScratchCard from './ScratchCard.jsx';
import { Asset, Bar, Ic, Lv, Sheet, Switch, Stat, cx, imgFor } from '../ui/base.jsx';
import SFX from '../game/sound.js';

/* ------------------------------------------------- shared bits */
export function OddsSheet({ def, s, onClose, onBuy }) {
  if (!def) return null;
  const o = ticketOdds(s, def);
  return (
    <Sheet open onClose={onClose} title={def.name}
      foot={<button className="btn p w" onClick={() => { onBuy(def.id); onClose(); }}>Buy for {fmtFull(def.price)}</button>}>
      <div className="note" style={{ marginBottom: 10 }}>{def.blurb}</div>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <Stat v={fmt(def.price)} k="price" />
        <Stat v={pct(o.winChance)} k="win chance" />
        <Stat v={`${Math.round(o.returnMult * 100)}%`} k="player return" />
      </div>
      {def.progressive ? (
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="chip hot">🎯 progressive pool</span>
          <b className="mono" style={{ marginLeft: 'auto', color: 'var(--violet)' }}>{fmt(o.pool)}</b>
        </div>
      ) : null}
      <div className="row tiny dim" style={{ marginBottom: 6 }}>
        <span>Hardness {def.hardness}</span><span>·</span>
        <span>{def.hazard ? 'has trap cells' : def.super ? 'super jackpot' : 'no traps'}</span>
        <span style={{ marginLeft: 'auto' }}>payout ×{o.payoutMult.toFixed(2)}</span>
      </div>
      <div className="odds">
        {o.rows.map((r, i) => (
          <div key={i} className={cx('oddrow', r.neg && 'loss', (r.jackpot || r.super || r.final) && 'jack')}>
            <span className="s">{r.e}</span>
            <span className="tiny">{r.super ? 'SUPER JACKPOT' : r.jackpot ? `base ${fmt(r.pay)} + whole pool` : r.neg ? 'penalty' : `${r.pay >= def.price ? (r.pay / def.price).toFixed(r.pay / def.price < 10 ? 1 : 0) + '×' : Math.round((r.pay / def.price) * 100) + '%'} of price`}</span>
            <span className="w">{pct(r.p, 2)}</span>
            <span className="p">{fmt(r.pay)}</span>
          </div>
        ))}
        <div className="oddrow loss">
          <span className="s">🫥</span><span className="tiny">no match</span>
          <span className="w">{pct(o.loseChance, 1)}</span><span className="p">0</span>
        </div>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        Luck moves the heavy symbols in your favour: <b className="mono">+{o.luckPct.toFixed(1)}%</b> right now.
        {def.super ? ' A SUPER JACKPOT is parked on the Sticky Mat — Mundo will never scratch it.' : ''}
      </div>
    </Sheet>
  );
}

function TicketRow({ def, s, dispatch, onOdds }) {
  const owned = s.owned?.[def.id] || 0;
  const unlocked = isUnlocked(s, def);
  const gate = unlockGate(def);
  const o = useMemo(() => ticketOdds(s, def), [s.balance, s.upg.luck, def.id]);
  return (
    <div className={cx('tk', !unlocked && 'locked')}>
      <div className="em" style={{ backgroundImage: `url(${imgFor(def.art)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ minWidth: 0 }}>
        <h4>{def.name}{def.tag === 'trap' || def.tag === 'risk' ? <span className="chip bad" style={{ padding: '1px 5px' }}>{def.tag}</span> : null}
          {def.super ? <span className="star">★</span> : null}</h4>
        <div className="meta">
          <span className="mono">{fmt(def.price)}</span>
          <span>{pct(o.winChance)} win</span>
          <span>hard {def.hardness}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <button className="btn xs p" onClick={() => { SFX.click(); dispatch({ type: 'BUY', ticket: def.id, n: 1 }); }}
          disabled={!unlocked || s.balance < def.price}>{unlocked ? 'Buy' : fmt(gate - (s.lifetime.earn + s.run.earn))}</button>
        <div style={{ marginTop: 4 }}>
          <button className="btn xs" onClick={() => onOdds(def.id)}>odds</button>
        </div>
      </div>
      {owned ? <div className="own">{owned} bought</div> : null}
    </div>
  );
}

/* ------------------------------------------------- TABLE */
export function TableScreen() {
  const { s, dispatch } = useGame();
  const st = stats(s);
  const [odds, setOdds] = useState(null);
  const def = s.table ? TICKET_BY_ID[s.table.ticket] : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const eggLeft = Math.max(0, (s.gadgets.egg.until || 0) - now);
  const dailyReady = s.daily.day !== todayKey();
  const rew = dailyRewardOf(s);

  return (
    <div className="screen">
      {dailyReady ? (
        <div className="card glow" style={{ display: 'grid', gridTemplateColumns: '62px 1fr auto', gap: 10, alignItems: 'center', marginTop: 4 }}
          onClick={() => dispatch({ type: 'DAILY' })}>
          <Asset name="gift" alt="" style={{ width: 62 }} />
          <div>
            <div className="h3" style={{ fontSize: 14 }}>Daily stash · day {rew.streak + 1}</div>
            <div className="note">{fmt(rew.coins)} coins{rew.jp ? ` + ${rew.jp} JP` : ''} · resets in {mmss(untilNextMidnight(now))}</div>
          </div>
          <span className="btn xs p">Claim</span>
        </div>
      ) : null}

      <div className="sect" style={{ marginTop: dailyReady ? 12 : 6 }}>
        <h2>Scratch Table</h2>
        <span className="hint">{s.table ? (s.table.done ? (s.table.settled ? 'resolved' : 'ready to claim') : 'scratch the foil') : `${(s.tray || []).length} in tray`}</span>
      </div>

      <div className="stage">
        <ScratchCard
          s={s} ticket={s.table} st={st} foil={foilFor(s, def || TICKETS[0])}
          reduceFx={s.settings.reduceFx}
          disabled={false}
          onScratch={(r) => dispatch({ type: 'SCRATCH', ...r })}
          onFinish={() => dispatch({ type: 'FINISH' })}
        />

        {s.table && !s.table.done ? (
          <div className="row" style={{ width: '100%', maxWidth: 360 }}>
            <button className="btn sm" onClick={() => setOdds(def.id)}>{Ic.eye}<span>odds</span></button>
            <button className="btn sm" onClick={() => { SFX.click(); dispatch({ type: 'REVEAL_ALL' }); }}>reveal</button>
            <button className="btn sm" onClick={() => dispatch({ type: 'PIN' })}>{Ic.pin}</button>
            <button className="btn sm d" style={{ marginLeft: 'auto' }} onClick={() => dispatch({ type: 'TOSS' })}>{Ic.trash}</button>
          </div>
        ) : null}

        {s.table && s.table.done && !s.table.settled ? (
          <div className="card glow row" style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ flex: 1 }}>
              <div className="h3" style={{ fontSize: 14 }}>{s.table.payout > 0 ? `Winner · ${fmtFull(s.table.payout)}` : s.table.payoutMeta?.penalty ? 'Trap sprung' : 'Nothing this time'}</div>
              <div className="note">{s.table.payout > 0 ? 'Tap claim to bank it.' : s.table.payoutMeta?.penalty ? `You dug into the hazard — ${fmt(s.table.payoutMeta.penalty)} penalty.` : 'The ticket was a dud.'}</div>
            </div>
            <button className="btn p sm" onClick={() => dispatch({ type: 'CLAIM' })}>Claim</button>
          </div>
        ) : null}

        <div className="row" style={{ width: '100%', maxWidth: 360, gap: 7 }}>
          <button className="btn p" style={{ flex: 1 }} onClick={() => dispatch({ type: 'BUY', ticket: s.autoTarget || 'twowin', n: 1 })}>
            Buy {TICKET_BY_ID[s.autoTarget || 'twowin']?.name} · {fmt(TICKET_BY_ID[s.autoTarget || 'twowin']?.price || 0)}
          </button>
          <button className={cx('btn', s.gadgets.bot.on && s.gadgets.bot.lvl && 'g')} onClick={() => dispatch({ type: 'GADGET_ON', id: 'bot' })}>
            {s.gadgets.bot.on && s.gadgets.bot.lvl ? '🤖 on' : '🤖 off'}
          </button>
          {s.gadgets.egg.lvl ? (
            <button className="btn sm" onClick={() => dispatch({ type: 'EGG' })}
              disabled={!!eggLeft || (s.gadgets.egg.readyAt || 0) > now}>
              {eggLeft ? mmss(eggLeft) : '🥚'}
            </button>
          ) : null}
          {s.gadgets.spell.lvl ? (
            <button className="btn sm" onClick={() => dispatch({ type: 'SPELL' })} disabled={!s.daily.charges || !s.table}>
              📖 {s.daily.charges}
            </button>
          ) : null}
        </div>
      </div>

      {/* tray */}
      <div className="sect"><h2>Tray</h2><span className="hint">{(s.tray || []).length}/{traySlots(s)}</span></div>
      <div className="tray">
        {(s.tray || []).slice(-10).reverse().map((t) => {
          const d = TICKET_BY_ID[t.ticket];
          return (
            <div key={t.id} className="mini-t" onClick={() => !s.table && dispatch({ type: 'SELECT', index: (s.tray || []).findIndex((x) => x.id === t.id) })}>
              <div className="e">{d.syms[0].e}</div>
              <div className="n">{d.name}</div>
              <div className="tag">{fmt(d.price)}</div>
              {t.win ? <div className="q">?</div> : null}
            </div>
          );
        })}
        {!(s.tray || []).length ? <div className="note" style={{ padding: '6px 2px' }}>Empty. Buy a ticket above — or switch the Autobuyer on in Gadgets.</div> : null}
      </div>

      {/* sticky mat */}
      {(s.gadgets.mat.lvl > 0) ? (
        <>
          <div className="sect"><h2>Sticky Mat</h2><span className="hint">bot can't touch these</span></div>
          <div className="tray">
            {(s.mat || []).map((t) => {
              const d = TICKET_BY_ID[t.ticket];
              return (
                <div key={t.id} className={cx('mini-t', 'sticky', t.done && 'done')} onClick={() => dispatch({ type: 'UNPIN', id: t.id })}>
                  <div className="e">{t.done ? (t.payout > 0 ? '✨' : '🫥') : d.syms[0].e}</div>
                  <div className="n">{d.name}</div>
                  <div className="tag">{t.done ? 'tap to claim' : 'on table?'}</div>
                </div>
              );
            })}
            {!(s.mat || []).length ? <div className="note" style={{ padding: '6px 2px' }}>Pin a ticket here with the pin button to keep it off the bot.</div> : null}
          </div>
        </>
      ) : null}

      {odds ? <OddsSheet def={TICKET_BY_ID[odds]} s={s} onClose={() => setOdds(null)} onBuy={(id) => dispatch({ type: 'BUY', ticket: id, n: 1 })} /> : null}
    </div>
  );
}

/* ------------------------------------------------- CATALOG */
export function CatalogScreen() {
  const { s, dispatch } = useGame();
  const [odds, setOdds] = useState(null);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}><h2>Ticket Catalogues</h2><span className="hint">{TICKETS.length} tickets</span></div>
      {CATALOGS.map((c) => {
        const list = TICKETS.filter((t) => t.cat === c.id);
        const open = list.some((t) => isUnlocked(s, t));
        return (
          <div key={c.id}>
            <div className="cat-h"><i style={{ background: c.color }} />{c.name}<span className="n">{open ? c.blurb : `locked · earn ${fmt(unlockGate(list[0]))}`}</span></div>
            {list.map((t) => <TicketRow key={t.id} def={t} s={s} dispatch={dispatch} onOdds={setOdds} />)}
          </div>
        );
      })}
      <div className="note" style={{ margin: '14px 2px' }}>
        Catalogues are progression, not a promise: every later card risks more. Keep a cheap fallback in the tray
        so a losing streak can't end the run.
      </div>
      {odds ? <OddsSheet def={TICKET_BY_ID[odds]} s={s} onClose={() => setOdds(null)} onBuy={(id) => dispatch({ type: 'BUY', ticket: id, n: 1 })} /> : null}
    </div>
  );
}

/* ------------------------------------------------- GADGETS */
export function GadgetsScreen() {
  const { s, dispatch } = useGame();
  const [qty, setQty] = useState(1);
  const running = !!(s.gadgets.bot.on && s.gadgets.bot.lvl);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}><h2>The Machine</h2><span className="hint">8 gadgets · one pipeline</span></div>

      <div className="botstage">
        <div style={{ maxWidth: '58%' }}>
          <div className="row" style={{ gap: 6 }}>
            <span className={cx('pulse', running && 'on')} />
            <b className="d" style={{ fontSize: 13 }}>{running ? 'Scratch Bot running' : 'Idle'}</b>
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            Tray {(s.tray || []).length} · table {s.table ? 1 : 0} · mat {(s.mat || []).length}
            <br />{s.gadgets.mundo.lvl ? `Mundo claims every ${Math.max(0.9, (3 - s.gadgets.mundo.lvl * 0.7) / (s.gadgets.egg?.until > Date.now() ? 1.6 : 1)).toFixed(1)}s` : 'You claim by hand'}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            {s.gadgets.fan.lvl ? <button className={cx('btn xs', s.gadgets.fan.on && 'g')} onClick={() => dispatch({ type: 'GADGET_ON', id: 'fan' })}>fan</button> : null}
            {s.gadgets.mundo.lvl ? <button className={cx('btn xs', s.gadgets.mundo.on && 'g')} onClick={() => dispatch({ type: 'GADGET_ON', id: 'mundo' })}>mundo</button> : null}
            {s.gadgets.auto.lvl ? <button className={cx('btn xs', s.gadgets.auto.on && 'g')} onClick={() => dispatch({ type: 'GADGET_ON', id: 'auto' })}>autobuy</button> : null}
          </div>
        </div>
        <Asset name={s.nodes?.echo ? 'bot-diamond' : 'bot-gold'} alt="" className={cx('bot', running && 'run')} />
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="row tiny dim" style={{ marginBottom: 7 }}><span>Autobuyer target</span><span style={{ marginLeft: 'auto' }}>reserve {fmt(s.autoReserve)}</span></div>
        <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
          <select
            style={{ flex: 1, minWidth: 130, background: 'rgba(0,0,0,0.35)', color: 'var(--txt)', border: '1px solid var(--line)', borderRadius: 11, padding: '8px 10px' }}
            value={s.autoTarget} onChange={(e) => dispatch({ type: 'AUTO_SET', ticket: e.target.value })}>
            {TICKETS.filter((t) => isUnlocked(s, t)).map((t) => <option key={t.id} value={t.id}>{t.name} · {fmt(t.price)}</option>)}
          </select>
          <button className="btn xs" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span className="mono" style={{ minWidth: 20, textAlign: 'center' }}>{qty}</span>
          <button className="btn xs" onClick={() => setQty(Math.min(10, qty + 1))}>+</button>
          <button className="btn xs" onClick={() => dispatch({ type: 'BUY', ticket: s.autoTarget, n: qty })}>buy now</button>
        </div>
      </div>

      {GADGETS.map((g) => {
        const v = gadgetValue(s, g.id);
        const lvl = v.lvl, cost = v.cost;
        const canAfford = cost != null && s.balance >= cost;
        const toggles = ['bot', 'fan', 'mundo', 'auto'].includes(g.id);
        return (
          <div key={g.id} className={cx('gd', s.gadgets[g.id]?.on && lvl && 'onrow', lvl >= g.max && 'maxed')} style={{ marginTop: 7 }}>
            <div className="ic">{g.img ? <Asset name={g.img} alt="" /> : <span>{g.e}</span>}</div>
            <div style={{ minWidth: 0 }}>
              <h4>{g.name}{lvl >= g.max ? <span className="chip hot" style={{ marginLeft: 6, padding: '1px 6px' }}>max</span> : null}</h4>
              <div className="d">{g.desc}</div>
              <div className="d" style={{ color: 'var(--accent)' }}>{g.stat(lvl)}{g.id === 'egg' && s.gadgets.egg.until > Date.now() ? ` · ${mmss(s.gadgets.egg.until - Date.now())} left` : ''}</div>
              <Lv lvl={lvl} max={g.max} />
            </div>
            <div style={{ textAlign: 'right', display: 'grid', gap: 5, justifyItems: 'end' }}>
              {toggles ? <Switch on={!!s.gadgets[g.id].on && lvl > 0} onChange={() => dispatch({ type: 'GADGET_ON', id: g.id })} label={`${g.name} toggle`} /> : null}
              {cost != null
                ? <button className={cx('btn xs', canAfford ? 'p' : '')} disabled={!canAfford} onClick={() => dispatch({ type: 'BUY_GD', id: g.id })}>{fmt(cost)}</button>
                : null}
              {v.jpGate ? <span className="chip bad">{v.jpGate} JP</span> : null}
              {g.id === 'spell' ? <span className="chip">{s.daily.charges} left</span> : null}
            </div>
          </div>
        );
      })}

      <div className="sect"><h2>Recent</h2><span className="hint">{running ? 'live' : 'log'}</span></div>
      <div className="feed">
        {(s.feed || []).slice(0, 10).map((f, i) => (
          <div key={i} className="fi">
            <span>{f.e}</span><span className="tiny muted">{f.x}</span>
            <span className={cx(f.a ? 'a' : f.r ? 'r' : 'tiny dim', !f.a && !f.r && '')}>{f.a ? `+${fmt(f.a)}` : f.r ? `−${fmt(f.r)}` : ''}</span>
          </div>
        ))}
        {!(s.feed || []).length ? <div className="note">Nothing yet — scratch something.</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------- SHOP */
export function ShopScreen() {
  const { s, dispatch } = useGame();
  const st = stats(s);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}><h2>Scratch Tools</h2><span className="hint">tap to equip</span></div>
      <div className="grid3">
        {COINS.map((c) => {
          const locked = s.lifetime.earn + s.run.earn < c.gate;
          return (
            <button key={c.id} className={cx('card flat', s.coin === c.id && 'glow')} style={{ padding: 9, textAlign: 'center', opacity: locked ? 0.45 : 1 }}
              onClick={() => { SFX.click(); dispatch({ type: 'COIN', id: c.id }); }}>
              <div style={{ fontSize: 22 }}>{c.e}</div>
              <div className="tiny h3">{c.name}</div>
              <div className="dim" style={{ fontSize: 10 }}>{Math.round(c.r * 100)}% brush</div>
              {locked ? <div className="dim" style={{ fontSize: 9.5 }}>🔒 {fmt(c.gate)}</div> : null}
            </button>
          );
        })}
      </div>

      <div className="sect"><h2>Upgrades</h2><span className="hint">run money · lost on prestige</span></div>
      {UPGRADES.map((g) => {
        const v = upgradeValue(s, g.id);
        const can = v.cost != null && s.balance >= v.cost;
        return (
          <div key={g.id} className={cx('gd', v.lvl >= v.max && 'maxed')} style={{ marginTop: 7 }}>
            <div className="ic"><span>{g.e}</span></div>
            <div>
              <h4>{g.name}</h4>
              <div className="d">{g.desc}</div>
              <div className="d" style={{ color: 'var(--accent)' }}>{v.lvl ? g.stat(v.lvl) : 'not bought'}</div>
              <Lv lvl={v.lvl} max={v.max} />
            </div>
            <div style={{ textAlign: 'right' }}>
              {v.cost != null
                ? <button className={cx('btn xs', can ? 'p' : '')} disabled={!can} onClick={() => dispatch({ type: 'BUY_UPG', id: g.id })}>{fmt(v.cost)}</button>
                : <span className="chip hot">MAX</span>}
            </div>
          </div>
        );
      })}

      <div className="sect"><h2>Day Job</h2><span className="hint">start-money faucet</span></div>
      <DayJob />

      <div className="note" style={{ marginTop: 12 }}>
        Scratch strength {st.strength}/10 · brush {(st.brush * 100).toFixed(1)}% · refund {Math.round(st.refund * 100)}% ·
        win chance +{st.luckPct.toFixed(1)}% · payout ×{st.payout.toFixed(2)}{st.hazardsOff ? ' · hazards off' : ''}
      </div>
    </div>
  );
}

function DayJob() {
  const { s, dispatch } = useGame();
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  const t = useRef(0);
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
      <div>
        <div className="h3" style={{ fontSize: 14 }}> Wash plates</div>
        <div className="note">{s.stats.plates} washed · {s.stats.breaks} broken · {fmt(Math.max(1, Math.round(1 * Math.pow(1.75, s.upg.job || 0) * (1 + Math.log10(1 + s.lifetime.earn)))))} per plate</div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        <button className="btn p sm" disabled={busy} onClick={() => {
          if (busy) return;
          dispatch({ type: 'PLATE' }); setN((x) => x + 1);
          setBusy(true); clearTimeout(t.current); t.current = setTimeout(() => setBusy(false), 130);
        }}>
          scrub
        </button>
        <span className="dim tiny">{n} this session</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------- PRESTIGE */
export function PrestigeScreen() {
  const { s, dispatch } = useGame();
  const gain = jpEarnable(s);
  const nextAt = PRESTIGE_BASE;
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}><h2>Prestige</h2><span className="hint">run {s.runs}</span></div>
      <div className="card glow">
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="h3" style={{ fontSize: 15 }}>Reset the run → Jack Points</div>
            <div className="note">Money, upgrades and gadgets are wiped. Achievements, tokens, skins, JP nodes and lifetime stats stay.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="d" style={{ fontSize: 26, fontWeight: 800, color: 'var(--violet)' }}>+{gain}</div>
            <div className="dim tiny">JP</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="row tiny dim" style={{ marginBottom: 4 }}><span>run earnings</span><span className="mono" style={{ marginLeft: 'auto' }}>{fmt(s.run.earn)} / {fmt(nextAt)}</span></div>
          <Bar value={Math.min(1, s.run.earn / nextAt)} cls="violet" />
        </div>
        <button className="btn v w" style={{ marginTop: 11 }} disabled={gain < 1}
          onClick={() => { if (confirm(`Prestige now for ${gain} JP? Your run money and gadgets are wiped.`)) dispatch({ type: 'PRESTIGE' }); }}>
          {gain >= 1 ? `Prestige for ${gain} JP` : `Earn ${fmt(nextAt - s.run.earn)} more to prestige`}
        </button>
      </div>

      <div className="sect"><h2>Permanent Tree</h2><span className="hint">{s.jp} JP held</span></div>
      {JP_NODES.map((n) => {
        const v = nodeValue(s, n);
        const can = v.cost != null && s.jp >= v.cost;
        return (
          <div key={n.id} className={cx('gd', v.lvl >= n.max && 'maxed')} style={{ marginTop: 7 }}>
            <div className="ic"><span>{n.e}</span></div>
            <div>
              <h4>{n.name}</h4>
              <div className="d">{n.desc}</div>
              {v.lvl ? <div className="d" style={{ color: 'var(--violet)' }}>{n.stat(v.lvl)}</div> : null}
              <Lv lvl={v.lvl} max={n.max} />
            </div>
            <div style={{ textAlign: 'right' }}>
              {v.cost != null
                ? <button className={cx('btn xs', can ? 'v' : '')} disabled={!can} onClick={() => dispatch({ type: 'NODE', id: n.id })}>{v.cost} JP</button>
                : <span className="chip hot">MAX</span>}
            </div>
          </div>
        );
      })}

      <div className="sect"><h2>Endings</h2><span className="hint">Final Chance · {Object.keys(s.endings || {}).length}/3</span></div>
      <div className="stack">
        {Object.entries(ENDINGS).map(([k, e]) => {
          const got = (s.endings || []).includes(k);
          return (
            <div key={k} className={cx('achv', got ? 'got' : 'off')}>
              <span className="e">{e.e}</span>
              <div>
                <div className="h3" style={{ fontSize: 13 }}>{got ? e.name : '???'}</div>
                <div className="dim tiny">{got ? e.desc : 'Win the Final Chance ticket, then answer the phone.'}</div>
              </div>
              <span className={cx('chip', got ? 'good' : '')}>{got ? e.badge : 'locked'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------- PROFILE */
export function ProfileScreen() {
  const { s, dispatch } = useGame();
  const [code, setCode] = useState('');
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  useEffect(() => {
    import('../db/store.js').then((m) => {
      setCode(m.exportCode(s));
      window.__sv = { m, s, dispatch };
    });
  }, [s.balance, s.jp, s.stats.scratched]);

  const gotAch = ACHIEVEMENTS.filter((a) => s.achievements?.[a.id]).length;
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}><h2>Profile</h2><span className="hint">everything lives on this device</span></div>
      <div className="card">
        <div className="row" style={{ gap: 10 }}>
          <Asset name="crown" alt="" style={{ width: 62 }} />
          <div style={{ flex: 1 }}>
            <input
              value={s.name} maxLength={12}
              onChange={(e) => dispatch({ type: 'NAME', name: e.target.value })}
              style={{ width: '100%', background: 'transparent', border: 0, color: 'var(--txt)', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em', padding: 0 }} />
            <div className="dim tiny">level {s.level} · {s.lifetime.earn > 0 ? 'lifetime ' + fmt(s.lifetime.earn) : 'newcomer'}</div>
          </div>
        </div>
        <hr className="sep" />
        <div className="grid3">
          <Stat v={s.stats.scratched} k="scratched" />
          <Stat v={s.stats.wins} k="wins" />
          <Stat v={s.stats.losses} k="losses" />
          <Stat v={fmt(s.stats.bestWin)} k="best win" />
          <Stat v={s.stats.supers} k="supers" />
          <Stat v={s.stats.jackpots} k="jackpots" />
          <Stat v={s.stats.plates} k="plates" />
          <Stat v={s.stats.refunds} k="tossed" />
          <Stat v={`${Math.round((s.stats.wins / Math.max(1, s.stats.wins + s.stats.losses)) * 100)}%`} k="hit rate" />
        </div>
      </div>

      <div className="sect"><h2>Achievements</h2><span className="hint">{gotAch}/{ACHIEVEMENTS.length} · {s.tokens} tokens</span></div>
      <div className="stack">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={cx('achv', s.achievements?.[a.id] ? 'got' : 'off')}>
            <span className="e">{a.e}</span>
            <div>
              <div className="h3" style={{ fontSize: 13 }}>{a.name}</div>
              <div className="dim tiny">{a.desc}</div>
            </div>
            <span className={cx('chip', s.achievements?.[a.id] ? 'good' : '')}>{s.achievements?.[a.id] ? '✓' : `${a.tok}🎟️`}</span>
          </div>
        ))}
      </div>

      <div className="sect"><h2>Night Market</h2><span className="hint">tokens + coins</span></div>
      <div className="grid2">
        {SKINS.map((k) => {
          const have = !!s.skins[k.id];
          return (
            <button key={k.id} className={cx('card flat', s.skin === k.id && 'glow')} style={{ padding: 10, textAlign: 'left' }}
              onClick={() => dispatch({ type: 'SKIN', id: k.id })}>
              <div style={{ height: 46, borderRadius: 12, marginBottom: 8, background: `#222 url(${imgFor(k.foil)}) center/cover` }} />
              <div className="h3" style={{ fontSize: 13 }}>{k.name}</div>
              <div className="dim tiny">{k.note}</div>
              <div style={{ marginTop: 6 }}>{have ? <span className="chip good">{s.skin === k.id ? 'equipped' : 'owned'}</span> : <span className="chip hot">{k.tok}🎟️ + {fmt(k.coin)}</span>}</div>
            </button>
          );
        })}
      </div>
      <div className="grid2" style={{ marginTop: 9 }}>
        {MATS.map((m) => {
          const have = !!s.matsOwned?.[m.id];
          return (
            <button key={m.id} className={cx('card flat', s.matBg === m.id && 'glow')} style={{ padding: 10, textAlign: 'left' }}
              onClick={() => dispatch({ type: 'MAT', id: m.id })}>
              <div style={{ height: 40, borderRadius: 12, marginBottom: 8, background: `#111 url(${imgFor(m.img)}) center/cover`, opacity: 0.85 }} />
              <div className="h3" style={{ fontSize: 13 }}>{m.name}</div>
              <div style={{ marginTop: 5 }}>{have ? <span className="chip good">{s.matBg === m.id ? 'equipped' : 'owned'}</span> : <span className="chip hot">{m.tok}🎟️</span>}</div>
            </button>
          );
        })}
      </div>

      <div className="sect"><h2>Settings</h2></div>
      <div className="card stack" style={{ gap: 11 }}>
        {[['sound', 'Sound (ASMR scratch)', 'synthesized locally, zero downloads'],
          ['haptics', 'Haptics', 'vibration on scratch + wins'],
          ['reduceFx', 'Reduce effects', 'fewer particles, calmer phone'],
          ['autoClaim', 'Auto-claim after scratch', 'skips the claim tap']].map(([k, t, sub]) => (
          <div key={k} className="row">
            <div><div className="h3" style={{ fontSize: 13.5 }}>{t}</div><div className="dim tiny">{sub}</div></div>
            <Switch on={!!s.settings[k]} onChange={() => { SFX.click(); dispatch({ type: 'SETTINGS', patch: { [k]: !s.settings[k] } }); }} label={t} style={{ marginLeft: 'auto' }} />
          </div>
        ))}
      </div>

      <div className="sect"><h2>Save</h2><span className="hint">IndexedDB · autosaves</span></div>
      <div className="card stack" style={{ gap: 9 }}>
        <div className="tiny muted">Copy this code somewhere safe — it contains your whole run.</div>
        <textarea className="code" readOnly value={code} onFocus={(e) => e.target.select()} />
        <div className="row" style={{ gap: 7 }}>
          <button className="btn sm" style={{ flex: 1 }} onClick={async () => {
            try { await navigator.clipboard.writeText(code); setMsg('Copied ✓'); } catch { setMsg('Long-press the box to copy'); }
            setTimeout(() => setMsg(''), 2200);
          }}>copy code</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={async () => {
            const m = await import('../db/store.js');
            const st = await m.latestBackup();
            if (!st) { setMsg('no backup yet'); return; }
            dispatch({ type: 'INIT', state: st }); setMsg('restored last backup ✓');
            setTimeout(() => setMsg(''), 2200);
          }}>restore backup</button>
        </div>
        <div className="tiny muted">Paste a code to load it on this device:</div>
        <textarea className="code" placeholder="SV1.…" value={importText} onChange={(e) => setImportText(e.target.value)} />
        <div className="row" style={{ gap: 7 }}>
          <button className="btn sm" style={{ flex: 1 }} disabled={!importText.trim()} onClick={async () => {
            try {
              const m = await import('../db/store.js');
              const next = await m.importCode(importText, { wipe: false });
              dispatch({ type: 'INIT', state: next });
              setMsg('imported ✓'); setImportText('');
            } catch (e) { setMsg(String(e.message || e)); }
            setTimeout(() => setMsg(''), 3200);
          }}>import (merge)</button>
          <button className="btn sm d" style={{ flex: 1 }} disabled={!importText.trim()} onClick={async () => {
            const m = await import('../db/store.js');
            const next = await m.importCode(importText, { wipe: true });
            dispatch({ type: 'INIT', state: next });
            setMsg('replaced ✓'); setImportText('');
            setTimeout(() => setMsg(''), 2200);
          }}>replace all</button>
        </div>
        {msg ? <div className="chip good">{msg}</div> : null}
        <hr className="sep" />
        <button className={cx('btn d w', confirmWipe && 'p')} onClick={() => {
          if (!confirmWipe) { setConfirmWipe(true); setTimeout(() => setConfirmWipe(false), 4000); return; }
          dispatch({ type: 'RESET', confirm: true });
          import('../db/store.js').then((m) => m.wipe());
          setConfirmWipe(false);
        }}>{confirmWipe ? 'Tap again to erase everything' : 'Reset game'}</button>
        <div className="dim tiny" style={{ textAlign: 'center' }}>ScratchVerse v1.0 · fictional money only · no ads, no IAP, no backend</div>
      </div>
    </div>
  );
}
