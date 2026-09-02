// ============================================================
// ScratchVerse — screens. Everything here is vector: ticket faces are
// <TicketFace>, metals are CSS gradients, icons are from the registry.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOGS,
  TICKETS,
  TICKET_BY_ID,
  UPGRADES,
  GADGETS,
  COINS,
  SKINS,
  MATS,
  JP_NODES,
  ACHIEVEMENTS,
  ENDINGS,
  PRESTIGE_BASE,
  unlockGate,
} from '../game/config.js';
import {
  stats,
  ticketOdds,
  isUnlocked,
  upgradeValue,
  gadgetValue,
  nodeValue,
  jpEarnable,
  traySlots,
  dailyReward as dailyRewardOf,
} from '../game/logic.js';
import { fmt, fmtFull, pct, mmss, untilNextMidnight } from '../game/fmt.js';
import { todayKey } from '../db/store.js';
import { useGame, dispatch as push } from '../store.js';
import ScratchCard from './ScratchCard.jsx';
import {
  Bar,
  Chip,
  Coin,
  Crest,
  Icon,
  Lv,
  MATS_CSS,
  Modal,
  PaperSwatch,
  Stat,
  Switch,
  TicketFace,
  cx,
  metalCss,
} from '../ui/base.jsx';
import SFX from '../game/sound.js';

const payLabel = (pay, price) => {
  if (pay < 0) return `−${Math.round(-pay * 100)}% of price`;
  const mult = pay / price;
  if (mult >= 1) return `${mult.toFixed(mult < 10 ? 1 : 0)}× price`;
  return `${Math.round(mult * 100)}% of price`;
};

/* -------------------------------------------------------------- odds sheet */
export function OddsSheet({ def, s, onClose, onBuy }) {
  if (!def) return null;
  const o = ticketOdds(s, def);
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={def.catName}
      title={def.name}
      icon={def.motif || 'ticket'}
      foot={
        <button
          type="button"
          className="btn btn--gold btn--w"
          onClick={() => {
            onBuy(def.id);
            onClose();
          }}>
          <Icon name="cart" size={15} /> Buy for {fmtFull(def.price)}
        </button>
      }>
      <div className="note" style={{ marginBottom: 10 }}>
        {def.blurb}
      </div>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <Stat v={fmt(def.price)} k="price" />
        <Stat v={pct(o.winChance)} k="win chance" />
        <Stat v={`${Math.round(o.returnMult * 100)}%`} k="player return" />
      </div>
      {def.progressive ? (
        <div className="row" style={{ marginBottom: 8 }}>
          <Chip tone="gold" icon="target">
            progressive pool
          </Chip>
          <b className="tabular" style={{ marginLeft: 'auto', color: 'var(--violet)' }}>
            {fmt(o.pool)}
          </b>
        </div>
      ) : null}
      <div className="row tiny dim">
        <span>hardness {def.hardness}</span>
        <span>·</span>
        <span>{def.hazard ? 'trap cells' : def.super ? 'super jackpot' : 'no traps'}</span>
        <span className="end tabular">payout ×{o.payoutMult.toFixed(2)}</span>
      </div>
      <div className="odds">
        {o.rows.map((r, i) => (
          <div key={i} className={cx('oddrow', r.neg && 'oddrow--loss', (r.jackpot || r.super || r.final) && 'oddrow--jack')}>
            <span className="oddrow__sym">
              <Icon name={r.e || 'none'} size={19} />
            </span>
            <span className="tiny">
              {r.super
                ? 'SUPER JACKPOT'
                : r.jackpot
                  ? `base ${fmt(r.pay)} + whole pool`
                  : r.neg
                    ? 'penalty'
                    : payLabel(r.pay, def.price)}
            </span>
            <span className="oddrow__w tabular">{pct(r.p, 2)}</span>
            <span className="oddrow__p tabular">{fmt(r.pay)}</span>
          </div>
        ))}
        <div className="oddrow oddrow--loss">
          <span className="oddrow__sym">
            <Icon name="none" size={19} />
          </span>
          <span className="tiny">no match</span>
          <span className="oddrow__w tabular">{pct(o.loseChance, 1)}</span>
          <span className="oddrow__p tabular">0</span>
        </div>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        Luck shifts the heavy symbols your way: <b className="tabular">+{o.luckPct.toFixed(1)}%</b> right now.
        {def.super ? ' A SUPER JACKPOT is parked on the Sticky Mat — Mundo never scratches it.' : ''}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ ticket rows */
/** @param {{ def: any, s: any, onOdds: (id: string) => void, key?: string }} props */
function TicketRow({ def, s, onOdds }) {
  const owned = s.owned?.[def.id] || 0;
  const unlocked = isUnlocked(s, def);
  const gate = unlockGate(def);
  const o = useMemo(() => ticketOdds(s, def), [s.level, s.upg?.luck, def.id]);
  return (
    <div className={cx('tk', !unlocked && 'tk--locked')}>
      <div className="tk__face">
        <TicketFace def={def} />
      </div>
      <div style={{ minWidth: 0 }}>
        <h4>
          {def.name}
          {def.super ? (
            <Chip tone="violet" icon="crown">
              super
            </Chip>
          ) : null}
          {def.tag === 'trap' || def.tag === 'risk' || def.tag === 'volatile' ? <Chip tone="red">{def.tag}</Chip> : null}
        </h4>
        <div className="tk__meta">
          <span className="tabular price">
            <i aria-hidden="true" />
            {fmt(def.price)}
          </span>
          <span>{pct(o.winChance)} win</span>
          <span>hard {def.hardness}</span>
          {owned ? <span className="tk__own">{owned} bought</span> : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 4, justifyItems: 'stretch' }}>
        <button
          type="button"
          className="btn btn--gold btn--xs"
          onClick={() => {
            SFX.click();
            push({ type: 'BUY', ticket: def.id, n: 1 });
          }}
          disabled={!unlocked || s.balance < def.price}>
          {unlocked ? (
            <>
              <Icon name="cart" size={13} /> Buy
            </>
          ) : (
            <>
              <Icon name="lock" size={13} /> {fmt(gate - (s.lifetime.earn + s.run.earn))}
            </>
          )}
        </button>
        <button type="button" className="btn btn--xs" onClick={() => onOdds(def.id)}>
          <Icon name="eye" size={13} /> odds
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ TABLE */
export function TableScreen() {
  const { s } = useGame();
  const st = stats(s);
  const [odds, setOdds] = useState(null);
  const def = s.table ? TICKET_BY_ID[s.table.ticket] : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const eggLeft = Math.max(0, (s.gadgets.egg.until || 0) - now);
  const dailyReady = s.daily.day !== todayKey();
  const rew = dailyRewardOf(s);
  const autoDef = TICKET_BY_ID[s.autoTarget || 'twowin'];
  const botOn = !!(s.gadgets.bot.on && s.gadgets.bot.lvl);

  return (
    <div className="screen">
      {dailyReady ? (
        <button
          type="button"
          className="card card--metal row"
          style={{ gridTemplateColumns: 'auto 1fr auto', display: 'grid', marginTop: 4 }}
          onClick={() => push({ type: 'DAILY' })}>
          <span className="giftbox giftbox--sm" style={{ background: metalCss(s.skin) }}>
            <Icon name="gift" size={20} />
          </span>
          <span style={{ textAlign: 'left' }}>
            <span className="h3" style={{ fontSize: 14, display: 'block' }}>
              Daily stash · day {rew.streak + 1}
            </span>
            <span className="note">
              {fmt(rew.coins)} coins{rew.jp ? ` + ${rew.jp} JP` : ''} · resets in {mmss(untilNextMidnight(now))}
            </span>
          </span>
          <span className="chip chip--gold">claim</span>
        </button>
      ) : null}

      <div className="sect" style={{ marginTop: dailyReady ? 10 : 4 }}>
        <h2>Scratch Table</h2>
        <span className="hint">
          {s.table
            ? s.table.done
              ? s.table.settled
                ? 'resolved'
                : 'ready to claim'
              : 'touch the paper'
            : `${(s.tray || []).length} in tray`}
        </span>
      </div>

      <div className="stage">
        <ScratchCard
          s={s}
          ticket={s.table}
          st={st}
          skin={s.skin}
          reduceFx={s.settings.reduceFx}
          onScratch={r => push({ type: 'SCRATCH', ...r })}
          onFinish={() => push({ type: 'FINISH' })}
        />

        {s.table && !s.table.done ? (
          <div className="trow">
            <button type="button" className="tprop" onClick={() => setOdds(def.id)} title="Odds" aria-label="Odds">
              <Icon name="eye" size={16} />
            </button>
            <button
              type="button"
              className="tprop"
              onClick={() => {
                SFX.click();
                push({ type: 'REVEAL_ALL' });
              }}
              title="Reveal all"
              aria-label="Reveal all">
              <Icon name="sparkle" size={16} />
            </button>
            <button
              type="button"
              className="tprop"
              onClick={() => push({ type: 'PIN' })}
              title="Pin to Sticky Mat"
              aria-label="Pin to mat">
              <Icon name="pin" size={16} />
            </button>
            <button
              type="button"
              className="tprop tprop--danger"
              onClick={() => push({ type: 'TOSS' })}
              title="Toss for a refund"
              aria-label="Toss ticket">
              <Icon name="trash" size={16} />
            </button>
            <button
              type="button"
              className="tprop"
              onClick={() => push({ type: 'REVEAL_ALL' })}
              title="Auto-scratch the rest"
              aria-label="Auto-scratch">
              <Icon name="bot" size={16} />
            </button>
          </div>
        ) : null}

        {s.table && s.table.done && !s.table.settled ? (
          <div className="card row card--metal" style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div className="h3" style={{ fontSize: 14 }}>
                {s.table.payout > 0
                  ? `Winner · ${fmtFull(s.table.payout)}`
                  : s.table.payoutMeta?.penalty
                    ? 'Trap sprung'
                    : 'Nothing this time'}
              </div>
              <div className="note">
                {s.table.payout > 0
                  ? 'Tap claim to bank it.'
                  : s.table.payoutMeta?.penalty
                    ? `You dug into the hazard — ${fmt(s.table.payoutMeta.penalty)} penalty.`
                    : 'The ticket was a dud.'}
              </div>
            </div>
            <button type="button" className="btn btn--gold btn--xs" onClick={() => push({ type: 'CLAIM' })}>
              <Icon name="coin" size={13} /> Claim
            </button>
          </div>
        ) : null}

        <div className="row" style={{ width: '100%', maxWidth: 360 }}>
          <button
            type="button"
            className="btn btn--gold"
            style={{ flex: 1 }}
            aria-label={`Buy ${autoDef?.name || 'ticket'}`}
            onClick={() => push({ type: 'BUY', ticket: s.autoTarget || 'twowin', n: 1 })}>
            <Icon name="ticket" size={15} /> {autoDef?.name} · {fmt(autoDef?.price || 0)}
          </button>
          <button
            type="button"
            className={cx('btn', botOn && 'btn--on')}
            onClick={() => push({ type: 'GADGET_ON', id: 'bot' })}
            aria-pressed={botOn}>
            <Icon name="bot" size={15} /> {botOn ? 'on' : 'off'}
          </button>
          {s.gadgets.egg.lvl ? (
            <button
              type="button"
              className="btn btn--xs"
              onClick={() => push({ type: 'EGG' })}
              disabled={!!eggLeft || (s.gadgets.egg.readyAt || 0) > now}
              aria-label="Egg timer boost">
              <Icon name="timer" size={14} /> {eggLeft ? mmss(eggLeft) : 'boost'}
            </button>
          ) : null}
          {s.gadgets.spell.lvl ? (
            <button
              type="button"
              className="btn btn--xs"
              onClick={() => push({ type: 'SPELL' })}
              disabled={!s.daily.charges || !s.table}
              aria-label="Spellbook instant scratch">
              <Icon name="book" size={14} /> {s.daily.charges}
            </button>
          ) : null}
        </div>
        {def && !s.table ? (
          <div className="note">
            {def.win === 'instant' ? 'every cell pays' : def.win === 'final' ? 'win everything' : `match ${def.need || 3} to win`}
          </div>
        ) : null}
      </div>

      <div className="sect">
        <h2>Tray</h2>
        <span className="hint">
          {(s.tray || []).length}/{traySlots(s)}
        </span>
      </div>
      <div className="tray">
        {(s.tray || [])
          .slice(-10)
          .reverse()
          .map(t => {
            const d = TICKET_BY_ID[t.ticket];
            return (
              <button
                type="button"
                key={t.id}
                className={cx('mini-t', t.done && 'mini-t--won')}
                disabled={!!s.table}
                onClick={() => !s.table && push({ type: 'SELECT', index: (s.tray || []).findIndex(x => x.id === t.id) })}>
                <div className="mini-t__face">
                  <TicketFace def={d} />
                </div>
                <span className="n">{d.name}</span>
                <span className="q tabular">
                  {fmt(d.price)}
                  {t.done ? (t.payout > 0 ? ' · won' : ' · dud') : ''}
                </span>
              </button>
            );
          })}
        {!(s.tray || []).length ? (
          <div className="note" style={{ padding: '6px 2px' }}>
            Empty. Buy a ticket above — or switch the Autobuyer on in the machine.
          </div>
        ) : null}
      </div>

      {s.gadgets.mat.lvl > 0 ? (
        <>
          <div className="sect">
            <h2>Sticky Mat</h2>
            <span className="hint">the bot can't touch these</span>
          </div>
          <div className="tray">
            {(s.mat || []).map(t => {
              const d = TICKET_BY_ID[t.ticket];
              return (
                <button
                  type="button"
                  key={t.id}
                  className={cx('mini-t', 'mini-t--pin', t.done && 'mini-t--won')}
                  onClick={() => push({ type: 'UNPIN', id: t.id })}>
                  {t.done ? <span className="mini-t__flag">{t.payout > 0 ? 'claim' : 'dud'}</span> : null}
                  <div className="mini-t__face">
                    <TicketFace def={d} />
                  </div>
                  <span className="n">{d.name}</span>
                  <span className="q">{t.done ? 'tap to claim' : 'pinned'}</span>
                </button>
              );
            })}
            {!(s.mat || []).length ? (
              <div className="note" style={{ padding: '6px 2px' }}>
                Pin a ticket here to keep it away from the Fan and the Bot.
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {odds ? (
        <OddsSheet
          def={TICKET_BY_ID[odds]}
          s={s}
          onClose={() => setOdds(null)}
          onBuy={id => push({ type: 'BUY', ticket: id, n: 1 })}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- CATALOG */
export function CatalogScreen() {
  const { s } = useGame();
  const [odds, setOdds] = useState(null);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}>
        <h2>Ticket Catalogues</h2>
        <span className="hint">{TICKETS.length} tickets</span>
      </div>
      {CATALOGS.map(c => {
        const list = TICKETS.filter(t => t.cat === c.id);
        const open = list.some(t => isUnlocked(s, t));
        return (
          <div key={c.id} className="catblock">
            <div className="cat-h">
              <i style={{ background: `linear-gradient(90deg, ${c.color}, transparent)` }} />
              <b>{c.name}</b>
              <span className="n">{open ? c.blurb : `locked · earn ${fmt(unlockGate(list[0]))}`}</span>
            </div>
            {list.map(t => (
              <TicketRow key={t.id} def={t} s={s} onOdds={setOdds} />
            ))}
          </div>
        );
      })}
      <div className="note" style={{ margin: '14px 2px' }}>
        Catalogues are progression, not a promise: every later card risks more. Keep a cheap fallback in the tray so a losing streak
        can't end the run.
      </div>
      {odds ? (
        <OddsSheet
          def={TICKET_BY_ID[odds]}
          s={s}
          onClose={() => setOdds(null)}
          onBuy={id => push({ type: 'BUY', ticket: id, n: 1 })}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- GADGETS */
export function GadgetsScreen() {
  const { s } = useGame();
  const [qty, setQty] = useState(1);
  const running = !!(s.gadgets.bot.on && s.gadgets.bot.lvl);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}>
        <h2>The Machine</h2>
        <span className="hint">8 gadgets · one pipeline</span>
      </div>

      <div className="botstage">
        <div style={{ maxWidth: '60%', position: 'relative', zIndex: 1 }}>
          <div className="row">
            <span className={cx('pulse', running && 'on')} />
            <b className="h3" style={{ fontSize: 13 }}>
              {running ? 'Scratch Bot running' : 'Idle'}
            </b>
          </div>
          <div className="note" style={{ marginTop: 4 }}>
            tray {(s.tray || []).length} · table {s.table ? 1 : 0} · mat {(s.mat || []).length}
            <br />
            {s.gadgets.mundo.lvl
              ? `Mundo claims every ${Math.max(0.9, (3 - s.gadgets.mundo.lvl * 0.7) / (s.gadgets.egg?.until > Date.now() ? 1.6 : 1)).toFixed(1)}s`
              : 'You claim by hand'}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {[
              ['fan', 'Fan'],
              ['mundo', 'Mundo'],
              ['auto', 'autobuy'],
            ].map(([id, label]) =>
              s.gadgets[id].lvl ? (
                <button
                  key={id}
                  type="button"
                  className={cx('btn btn--xs', s.gadgets[id].on && 'btn--on')}
                  onClick={() => push({ type: 'GADGET_ON', id })}>
                  <Icon name={GADGETS.find(g => g.id === id).icon} size={13} /> {label}
                </button>
              ) : null
            )}
          </div>
        </div>
        <div className={cx('botstage__art', running && 'running')}>
          <Icon name={s.nodes?.echo ? 'gem' : 'bot'} size={74} />
        </div>
      </div>

      <div className="card">
        <div className="row tiny dim" style={{ marginBottom: 7 }}>
          <span>Autobuyer target</span>
          <span className="end tabular">reserve {fmt(s.autoReserve)}</span>
        </div>
        <div className="row wrap">
          <select
            className="select"
            value={s.autoTarget}
            onChange={e => push({ type: 'AUTO_SET', ticket: e.target.value })}
            aria-label="Autobuyer target">
            {TICKETS.filter(t => isUnlocked(s, t)).map(t => (
              <option key={t.id} value={t.id}>
                {t.name} · {fmt(t.price)}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--xs" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="fewer">
            −
          </button>
          <span className="tabular" style={{ minWidth: 18, textAlign: 'center' }}>
            {qty}
          </span>
          <button type="button" className="btn btn--xs" onClick={() => setQty(Math.min(10, qty + 1))} aria-label="more">
            +
          </button>
          <button type="button" className="btn btn--xs" onClick={() => push({ type: 'BUY', ticket: s.autoTarget, n: qty })}>
            buy now
          </button>
        </div>
      </div>

      {GADGETS.map(g => {
        const v = gadgetValue(s, g.id);
        const canAfford = v.cost != null && s.balance >= v.cost;
        const toggles = ['bot', 'fan', 'mundo', 'auto'].includes(g.id);
        return (
          <div key={g.id} className={cx('gd', s.gadgets[g.id]?.on && v.lvl && 'gd--on', v.lvl >= g.max && 'gd--max')}>
            <div className="gd__mark">
              <Icon name={g.icon} size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4>
                {g.name}
                {v.lvl >= g.max ? <Chip tone="gold">max</Chip> : null}
              </h4>
              <div className="gd__d">{g.desc}</div>
              <div className="gd__v">
                {g.stat(v.lvl)}
                {g.id === 'egg' && s.gadgets.egg.until > Date.now() ? ` · ${mmss(s.gadgets.egg.until - Date.now())} left` : ''}
              </div>
              <Lv lvl={v.lvl} max={g.max} />
            </div>
            <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}>
              {toggles ? (
                <Switch
                  on={!!s.gadgets[g.id].on && v.lvl > 0}
                  onChange={() => push({ type: 'GADGET_ON', id: g.id })}
                  label={`${g.name} toggle`}
                />
              ) : null}
              {v.cost != null ? (
                <button
                  type="button"
                  className={cx('btn btn--xs', canAfford && 'btn--gold')}
                  disabled={!canAfford}
                  onClick={() => push({ type: 'BUY_GD', id: g.id })}>
                  {fmt(v.cost)}
                </button>
              ) : null}
              {v.jpGate ? <Chip tone="red">{v.jpGate} JP</Chip> : null}
              {g.id === 'spell' ? <Chip>{s.daily.charges} left</Chip> : null}
            </div>
          </div>
        );
      })}

      <div className="sect">
        <h2>Recent</h2>
        <span className="hint">{running ? 'live' : 'log'}</span>
      </div>
      <div className="feed">
        {(s.feed || []).slice(0, 10).map((f, i) => (
          <div key={i} className="fi">
            <Icon name={f.e || 'sparkle'} size={15} />
            <span className="tiny muted">{f.x}</span>
            <b className={cx('tabular', f.a ? 'up' : f.r ? 'down' : 'dim')}>{f.a ? `+${fmt(f.a)}` : f.r ? `−${fmt(f.r)}` : ''}</b>
          </div>
        ))}
        {!(s.feed || []).length ? <div className="note">Nothing yet — scratch something.</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- SHOP */
export function ShopScreen() {
  const { s } = useGame();
  const st = stats(s);
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}>
        <h2>Scratch Tools</h2>
        <span className="hint">tap to equip</span>
      </div>
      <div className="grid3">
        {COINS.map(c => {
          const locked = s.lifetime.earn + s.run.earn < c.gate;
          return (
            <button
              key={c.id}
              type="button"
              className={cx('card coinpick', s.coin === c.id && 'coinpick--on')}
              style={{ opacity: locked ? 0.45 : 1 }}
              onClick={() => {
                SFX.click();
                push({ type: 'COIN', id: c.id });
              }}>
              <Coin value={c.v} size={38} skin={s.skin} />
              <span className="tiny h3">{c.name}</span>
              <span className="dim" style={{ fontSize: 10 }}>
                {Math.round(c.r * 100)}% brush
              </span>
              {locked ? (
                <span className="chip">
                  <Icon name="lock" size={11} /> {fmt(c.gate)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="sect">
        <h2>Upgrades</h2>
        <span className="hint">run money · lost on prestige</span>
      </div>
      {UPGRADES.map(g => {
        const v = upgradeValue(s, g.id);
        const can = v.cost != null && s.balance >= v.cost;
        return (
          <div key={g.id} className={cx('gd', v.lvl >= v.max && 'gd--max')}>
            <div className="gd__mark">
              <Icon name={g.icon} size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4>{g.name}</h4>
              <div className="gd__d">{g.desc}</div>
              <div className="gd__v">{v.lvl ? g.stat(v.lvl) : 'not bought'}</div>
              <Lv lvl={v.lvl} max={v.max} />
            </div>
            <div style={{ display: 'grid', justifyItems: 'end' }}>
              {v.cost != null ? (
                <button
                  type="button"
                  className={cx('btn btn--xs', can && 'btn--gold')}
                  disabled={!can}
                  onClick={() => push({ type: 'BUY_UPG', id: g.id })}>
                  {fmt(v.cost)}
                </button>
              ) : (
                <Chip tone="gold">MAX</Chip>
              )}
            </div>
          </div>
        );
      })}

      <div className="sect">
        <h2>Day Job</h2>
        <span className="hint">start-money faucet</span>
      </div>
      <DayJob />

      <div className="note" style={{ marginTop: 12 }}>
        scratch strength {st.strength}/10 · brush {(st.brush * 100).toFixed(1)}% · refund {Math.round(st.refund * 100)}% · win
        chance +{st.luckPct.toFixed(1)}% · payout ×{st.payout.toFixed(2)}
        {st.hazardsOff ? ' · hazards off' : ''}
      </div>
    </div>
  );
}

function DayJob() {
  const { s } = useGame();
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  const t = useRef(0);
  const per = Math.max(1, Math.round(1 * Math.pow(1.75, s.upg.job || 0) * (1 + Math.log10(1 + s.lifetime.earn))));
  return (
    <div className="card row">
      <span className="gd__mark">
        <Icon name="sponge" size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h3" style={{ fontSize: 14 }}>
          Wash plates
        </div>
        <div className="note">
          {s.stats.plates} washed · {s.stats.breaks} broken · {fmt(per)} per plate ·{' '}
          {Math.round(Math.max(0.02, 0.1 - 0.01 * (s.upg.job || 0)) * 100)}% break risk
        </div>
      </div>
      <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}>
        <button
          type="button"
          className="btn btn--gold btn--xs"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            push({ type: 'PLATE' });
            setN(x => x + 1);
            setBusy(true);
            clearTimeout(t.current);
            t.current = setTimeout(() => setBusy(false), 130);
          }}>
          <Icon name="drop" size={13} /> scrub
        </button>
        <span className="dim tiny tabular">{n} this session</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- PRESTIGE */
export function PrestigeScreen() {
  const { s } = useGame();
  const gain = jpEarnable(s);
  const nextAt = PRESTIGE_BASE;
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}>
        <h2>Prestige</h2>
        <span className="hint">run {s.runs}</span>
      </div>
      <div className="card card--metal">
        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="h3" style={{ fontSize: 15 }}>
              Reset the run → Jack Points
            </div>
            <div className="note">
              Money, upgrades and gadgets are wiped. Achievements, tokens, skins, JP nodes and lifetime stats stay.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="disp" style={{ fontSize: 26, fontWeight: 800, color: 'var(--violet)' }}>
              +{gain}
            </div>
            <div className="dim tiny">JP</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="row tiny dim" style={{ marginBottom: 4 }}>
            <span>run earnings</span>
            <span className="end tabular">
              {fmt(s.run.earn)} / {fmt(nextAt)}
            </span>
          </div>
          <Bar value={Math.min(1, s.run.earn / nextAt)} tone="violet" />
        </div>
        <button
          type="button"
          className="btn btn--violet btn--w"
          style={{ marginTop: 11 }}
          disabled={gain < 1}
          onClick={() => {
            if (window.confirm(`Prestige now for ${gain} JP? Your run money and gadgets are wiped.`)) push({ type: 'PRESTIGE' });
          }}>
          <Icon name="gem" size={15} />{' '}
          {gain >= 1 ? `Prestige for ${gain} JP` : `Earn ${fmt(nextAt - s.run.earn)} more to prestige`}
        </button>
      </div>

      <div className="sect">
        <h2>Permanent Tree</h2>
        <span className="hint">{s.jp} JP held</span>
      </div>
      {JP_NODES.map(n => {
        const v = nodeValue(s, n);
        const can = v.cost != null && s.jp >= v.cost;
        return (
          <div key={n.id} className={cx('gd', v.lvl >= n.max && 'gd--max')}>
            <div className="gd__mark" style={{ color: 'var(--violet)' }}>
              <Icon name={n.icon} size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4>{n.name}</h4>
              <div className="gd__d">{n.desc}</div>
              {v.lvl ? (
                <div className="gd__v" style={{ color: 'var(--violet)' }}>
                  {n.stat(v.lvl)}
                </div>
              ) : null}
              <Lv lvl={v.lvl} max={n.max} />
            </div>
            <div style={{ display: 'grid', justifyItems: 'end' }}>
              {v.cost != null ? (
                <button
                  type="button"
                  className={cx('btn btn--xs', can && 'btn--violet')}
                  disabled={!can}
                  onClick={() => push({ type: 'NODE', id: n.id })}>
                  {v.cost} JP
                </button>
              ) : (
                <Chip tone="gold">MAX</Chip>
              )}
            </div>
          </div>
        );
      })}

      <div className="sect">
        <h2>Endings</h2>
        <span className="hint">Final Chance · {(s.endings || []).length}/3</span>
      </div>
      <div className="list">
        {Object.entries(ENDINGS).map(([k, e]) => {
          const got = (s.endings || []).includes(k);
          return (
            <div key={k} className={cx('li', got && 'li--got', !got && 'li--off')}>
              <span className="li__mark">
                <Icon name={e.icon} size={18} />
              </span>
              <span>
                <b className="h3" style={{ fontSize: 13 }}>
                  {got ? e.name : '???'}
                </b>
                <small>{got ? e.desc : 'Win the Final Chance ticket, then answer the phone.'}</small>
              </span>
              <Chip tone={got ? 'gold' : undefined}>{got ? e.badge : 'locked'}</Chip>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- PROFILE */
export function ProfileScreen() {
  const { s } = useGame();
  const [code, setCode] = useState('');
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [sheet, setSheet] = useState(null);
  useEffect(() => {
    let alive = true;
    import('../db/store.js').then(m => {
      if (alive) setCode(m.exportCode(s));
    });
    return () => {
      alive = false;
    };
  }, [s.balance, s.jp, s.stats.scratched]);
  const say = m => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2600);
  };

  const gotAch = ACHIEVEMENTS.filter(a => s.achievements?.[a.id]).length;
  return (
    <div className="screen">
      <div className="sect" style={{ marginTop: 6 }}>
        <h2>Profile</h2>
        <span className="hint">everything lives on this device</span>
      </div>
      <div className="card">
        <div className="row">
          <span className="avatar">
            <Crest size={46} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="nameplate"
              value={s.name}
              maxLength={12}
              onChange={e => push({ type: 'NAME', name: e.target.value })}
              aria-label="Your name"
            />
            <div className="dim tiny">
              level {s.level} · {s.lifetime.earn > 0 ? `lifetime ${fmt(s.lifetime.earn)}` : 'newcomer'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Chip tone="gold" icon="coin">
              {fmt(s.balance)}
            </Chip>
            <div style={{ height: 4 }} />
            <Chip tone="violet" icon="gem">
              {s.jp} JP
            </Chip>
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

      <div className="sect">
        <h2>Achievements</h2>
        <span className="hint">
          {gotAch}/{ACHIEVEMENTS.length} · {s.tokens} tokens
        </span>
      </div>
      <div className="list">
        {ACHIEVEMENTS.map(a => {
          const got = !!s.achievements?.[a.id];
          return (
            <div key={a.id} className={cx('li', got ? 'li--got' : 'li--off')}>
              <span className="li__mark">
                <Icon name={a.icon} size={18} />
              </span>
              <span>
                <b className="h3" style={{ fontSize: 13 }}>
                  {a.name}
                </b>
                <small>{a.desc}</small>
              </span>
              <Chip tone={got ? 'gold' : undefined} icon={got ? 'check' : 'ticket'}>
                {got ? 'done' : `${a.tok}`}
              </Chip>
            </div>
          );
        })}
      </div>

      <div className="sect">
        <h2>Night Market</h2>
        <span className="hint">tokens + coins</span>
      </div>
      <div className="grid2">
        {SKINS.map(k => {
          const have = !!s.skins?.[k.id];
          return (
            <button
              key={k.id}
              type="button"
              className={cx('card shopitem', s.skin === k.id && 'shopitem--on')}
              onClick={() => push({ type: 'SKIN', id: k.id })}>
              <div className="swatch swatch--paper">
                <PaperSwatch skin={k.id} label={k.id === 'gold' ? 'ivory' : k.id} />
              </div>
              <div className="h3" style={{ fontSize: 13, marginTop: 8 }}>
                {k.name}
              </div>
              <div className="dim tiny">{k.note}</div>
              <div style={{ marginTop: 6 }}>
                {have ? (
                  <Chip tone={s.skin === k.id ? 'gold' : undefined} icon={s.skin === k.id ? 'check' : undefined}>
                    {s.skin === k.id ? 'equipped' : 'owned'}
                  </Chip>
                ) : (
                  <Chip tone="violet" icon="ticket">
                    {k.tok} + {fmt(k.coin)}
                  </Chip>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="grid2" style={{ marginTop: 9 }}>
        {MATS.map(m => {
          const have = !!s.matsOwned?.[m.id];
          return (
            <button
              key={m.id}
              type="button"
              className={cx('card shopitem', s.matBg === m.id && 'shopitem--on')}
              onClick={() => push({ type: 'MAT', id: m.id })}>
              <div className="swatch" style={{ height: 40, borderRadius: 12, background: MATS_CSS[m.id] }} />
              <div className="h3" style={{ fontSize: 13, marginTop: 7 }}>
                {m.name}
              </div>
              <div style={{ marginTop: 5 }}>
                {have ? (
                  <Chip tone={s.matBg === m.id ? 'gold' : undefined} icon={s.matBg === m.id ? 'check' : undefined}>
                    {s.matBg === m.id ? 'equipped' : 'owned'}
                  </Chip>
                ) : (
                  <Chip tone="violet" icon="ticket">
                    {m.tok}
                  </Chip>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sect">
        <h2>Settings</h2>
      </div>
      <div className="card col">
        {[
          ['sound', 'Sound (ASMR scratch)', 'synthesized locally, zero downloads', 'soundOn'],
          ['haptics', 'Haptics', 'vibration on scratch + wins', 'drop'],
          ['reduceFx', 'Reduce effects', 'no flakes, no rain, calmer motion', 'sparkle'],
          ['autoClaim', 'Auto-claim after scratch', 'skips the claim tap', 'bot'],
        ].map(([k, t, sub, ic]) => (
          <div key={k} className="row">
            <span className="li__mark">
              <Icon name={ic} size={17} />
            </span>
            <span style={{ flex: 1 }}>
              <b className="h3" style={{ fontSize: 13.5 }}>
                {t}
              </b>
              <small className="dim tiny" style={{ display: 'block' }}>
                {sub}
              </small>
            </span>
            <Switch
              on={!!s.settings[k]}
              onChange={() => {
                SFX.click();
                push({ type: 'SETTINGS', patch: { [k]: !s.settings[k] } });
              }}
              label={t}
            />
          </div>
        ))}
      </div>

      <div className="sect">
        <h2>Save</h2>
        <span className="hint">IndexedDB · autosaves · 2 tabs sync</span>
      </div>
      <div className="card col">
        <div className="row wrap">
          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setSheet('save')}>
            <Icon name="download" size={15} /> export / import
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setSheet('about')}>
            <Icon name="question" size={15} /> about
          </button>
        </div>
        {msg ? (
          <Chip tone="gold" icon="check">
            {msg}
          </Chip>
        ) : null}
        <button
          type="button"
          className={cx('btn btn--danger btn--w', confirmWipe && 'btn--gold')}
          onClick={() => {
            if (!confirmWipe) {
              setConfirmWipe(true);
              setTimeout(() => setConfirmWipe(false), 4000);
              return;
            }
            push({ type: 'RESET', confirm: true });
            import('../db/store.js').then(m => m.wipe());
            setConfirmWipe(false);
          }}>
          <Icon name="trash" size={15} /> {confirmWipe ? 'Tap again to erase everything' : 'Reset game'}
        </button>
        <div className="dim tiny center">ScratchVerse v2.0 · fictional money only · no ads, no IAP, no backend</div>
      </div>

      {sheet === 'save' ? (
        <SaveSheet code={code} importText={importText} setImportText={setImportText} say={say} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'about' ? (
        <Modal open variant="center" onClose={() => setSheet(null)} title="ScratchVerse" eyebrow="about" icon="question">
          <div className="note">
            A portrait-only scratch arcade: 13 tickets across 4 catalogues, hazard cells, progressive pools, super jackpots, 8
            gadgets, 6 run upgrades, a permanent JP tree, 12 achievements with a token economy, 3 endings and a Night Market of
            vector finishes. Save lives in IndexedDB on this device; export codes are validated with a schema before they touch
            state. Every pixel of "art" in here is SVG or a CSS gradient — no bitmaps, no CDN, works on a plane.
          </div>
          <hr className="sep" />
          <div className="row wrap">
            <Chip icon="deck">{TICKETS.length} tickets</Chip>
            <Chip icon="bot">{GADGETS.length} gadgets</Chip>
            <Chip icon="trophy">{ACHIEVEMENTS.length} badges</Chip>
            <Chip icon="sparkle">{CATALOGS.length} catalogues</Chip>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function SaveSheet({ code, importText, setImportText, say, onClose }) {
  const { s } = useGame();
  return (
    <Modal
      open
      onClose={onClose}
      title="Save & transfer"
      eyebrow="copy, restore, replace"
      icon="vault"
      foot={
        <div className="row">
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                say('Copied');
              } catch {
                say('Long-press the box to copy');
              }
            }}>
            <Icon name="copy" size={15} /> copy code
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            onClick={async () => {
              const m = await import('../db/store.js');
              const st = await m.latestBackup();
              if (!st) {
                say('no backup yet');
                return;
              }
              push({ type: 'INIT', state: st });
              say('restored last backup');
              onClose();
            }}>
            <Icon name="refresh" size={15} /> restore backup
          </button>
        </div>
      }>
      <div className="tiny muted">
        This code is your whole run ({fmt(s.lifetime.earn)} lifetime earned). Keep it anywhere you like.
      </div>
      <textarea className="code" readOnly value={code} onFocus={e => e.target.select()} aria-label="Save code" />
      <hr className="sep" />
      <div className="tiny muted">Paste a code to load it on this device:</div>
      <textarea
        className="code"
        placeholder="SV1.…"
        value={importText}
        onChange={e => setImportText(e.target.value)}
        aria-label="Paste save code"
      />
      <div className="row">
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          disabled={!importText.trim()}
          onClick={async () => {
            try {
              const m = await import('../db/store.js');
              const next = await m.importCode(importText, { wipe: false });
              push({ type: 'INIT', state: next });
              say('imported');
              setImportText('');
            } catch (e) {
              say(String(e.message || e));
            }
          }}>
          <Icon name="download" size={15} /> import (merge)
        </button>
        <button
          type="button"
          className="btn btn--danger"
          style={{ flex: 1 }}
          disabled={!importText.trim()}
          onClick={async () => {
            try {
              const m = await import('../db/store.js');
              const next = await m.importCode(importText, { wipe: true });
              push({ type: 'INIT', state: next });
              say('replaced');
              setImportText('');
              onClose();
            } catch (e) {
              say(String(e.message || e));
            }
          }}>
          <Icon name="refresh" size={15} /> replace all
        </button>
      </div>
    </Modal>
  );
}
