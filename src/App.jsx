// ============================================================
// ScratchVerse — app shell: crest, money pills, level rail, tabs, mat theme.
// Portrait only; the whole frame is 480px wide and pure black.
// ============================================================
import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { GameProvider, useGame, useSel, dispatch as push } from './store.js';
import { APP, xpNeed } from './game/config.js';
import { fmt } from './game/fmt.js';
import { todayKey } from './db/store.js';
import { Chip, Crest, Icon, MATS_CSS, cx } from './ui/base.jsx';
import { TableScreen, CatalogScreen, GadgetsScreen, ShopScreen, PrestigeScreen, ProfileScreen } from './components/screens.jsx';
import Overlays, { Onboard } from './components/Overlays.jsx';
import SFX from './game/sound.js';

const TABS = [
  { id: 'table', label: 'Table', icon: 'scratch' },
  { id: 'catalog', label: 'Shop', icon: 'deck' },
  { id: 'gadgets', label: 'Bots', icon: 'bot' },
  { id: 'prestige', label: 'JP', icon: 'gem' },
  { id: 'profile', label: 'You', icon: 'user' },
];

function Pill({ icon, value, tone, title }) {
  return (
    <span className={cx('pill', tone && `pill--${tone}`)} title={title}>
      <Icon name={icon} size={14} />
      <span className="tabular">{value}</span>
    </span>
  );
}

function Shell() {
  const { s } = useGame();
  const tab = s.ui?.tab || 'table';
  const balance = useSel(x => x.balance);
  const jp = useSel(x => x.jp);
  const tokens = useSel(x => x.tokens);
  const trayN = useSel(x => (x.tray || []).length);
  const need = xpNeed(s.level);
  const pendingGift = s.daily.day !== todayKey() || !s.daily.claimed;

  useEffect(() => {
    const wake = () => SFX.init();
    window.addEventListener('pointerdown', wake, { once: true });
    return () => window.removeEventListener('pointerdown', wake);
  }, []);
  useEffect(() => {
    SFX.settings(s.settings);
  }, [s.settings.sound, s.settings.haptics]);

  const mat = useMemo(() => MATS_CSS[s.matBg] || MATS_CSS.noir, [s.matBg]);
  const go = id => {
    SFX.click();
    push({ type: 'TAB', tab: id });
  };

  return (
    <div className="app" data-skin={s.skin} style={{ '--mat-bg': mat }}>
      <header className="topbar">
        <div className="brand">
          <span className="crest">
            <Crest size={26} />
          </span>
          <span className="who">
            <b>{APP.name}</b>
            <small>{s.name}</small>
          </span>
        </div>
        <div className="pills">
          <Pill icon="coin" value={fmt(balance)} tone="gold" title="coins" />
          <Pill icon="gem" value={jp} tone="violet" title="jack points" />
          <Pill icon="ticket" value={tokens} tone="mint" title="night market tokens" />
        </div>
        <button
          type="button"
          className={cx('iconbtn', s.settings.sound && 'on')}
          aria-label={s.settings.sound ? 'Mute sound' : 'Unmute sound'}
          aria-pressed={!!s.settings.sound}
          onClick={() => push({ type: 'SETTINGS', patch: { sound: !s.settings.sound } })}>
          <Icon name={s.settings.sound ? 'soundOn' : 'soundOff'} size={17} />
        </button>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="iconbtn"
            aria-label="Daily stash"
            onClick={() => push({ type: 'UI', patch: { sheet: 'gift' } })}>
            <Icon name="gift" size={17} />
          </button>
          {pendingGift ? <span className="iconbtn__dot" /> : null}
        </div>
      </header>

      <div className="progress-row">
        <span className="lvl">LV {s.level}</span>
        <div
          className="bar"
          role="progressbar"
          aria-label="experience"
          aria-valuenow={Math.round((s.xp / need) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}>
          <i style={{ width: `${Math.min(100, (s.xp / need) * 100)}%` }} />
        </div>
        <span className="dim tiny tabular">
          {fmt(s.xp)}/{fmt(need)}
        </span>
        {s.pity > 0 ? (
          <Chip icon="clover" tone="mint">
            {Math.min(14, s.pity)}/14
          </Chip>
        ) : null}
        {s.luckStreak >= 2 ? (
          <Chip icon="flame" tone="gold">
            {s.luckStreak}
          </Chip>
        ) : null}
      </div>

      <main className="main">
        <motion.div
          className="screen"
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: s.settings.reduceFx ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}>
          {tab === 'table' ? <TableScreen /> : null}
          {tab === 'catalog' ? <CatalogScreen /> : null}
          {tab === 'gadgets' ? <GadgetsScreen /> : null}
          {tab === 'shop' ? <ShopScreen /> : null}
          {tab === 'prestige' ? <PrestigeScreen /> : null}
          {tab === 'profile' ? <ProfileScreen /> : null}
        </motion.div>
      </main>

      <nav className="tabbar" role="tablist" aria-label="Main">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cx('tab', tab === t.id && 'on')}
            onClick={() => go(t.id)}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
            {t.id === 'gadgets' && s.gadgets.bot.on && s.gadgets.bot.lvl ? (
              <span className="tab__n tab__n--dot" aria-label="bots running" />
            ) : null}
            {t.id === 'table' && trayN ? <span className="tab__n">{trayN}</span> : null}
          </button>
        ))}
      </nav>

      <div className="wide-note">Portrait only — the table is built for one thumb.</div>
      <Overlays />
      {s.seenOnboard ? null : <Onboard />}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
