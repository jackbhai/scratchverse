// ============================================================
// ScratchVerse — app shell: top bar, tabs, portrait frame
// ============================================================
import React, { useEffect, useMemo } from 'react';
import { GameProvider, useGame } from './store.js';
import { APP, MATS } from './game/config.js';
import { xpNeed } from './game/config.js';
import { fmt } from './game/fmt.js';
import { todayKey } from './db/store.js';
import { Asset, Ic, cx } from './ui/base.jsx';
import {
  TableScreen, CatalogScreen, GadgetsScreen, ShopScreen, PrestigeScreen, ProfileScreen,
} from './components/screens.jsx';
import Overlays, { Onboard } from './components/Overlays.jsx';
import SFX from './game/sound.js';
import { imgFor } from './ui/base.jsx';

const TABS = [
  { id: 'table', label: 'Table', icon: Ic.table },
  { id: 'catalog', label: 'Shop', icon: Ic.catalog },
  { id: 'gadgets', label: 'Bots', icon: Ic.bot },
  { id: 'prestige', label: 'JP', icon: Ic.star },
  { id: 'profile', label: 'You', icon: Ic.user },
];

function Shell() {
  const { s, dispatch } = useGame();
  const tab = s.ui?.tab || 'table';
  const need = xpNeed(s.level);
  const pendingGift = s.daily.day !== todayKey() || !s.daily.claimed;

  useEffect(() => {
    const wake = () => SFX.init();
    window.addEventListener('pointerdown', wake, { once: true });
    return () => window.removeEventListener('pointerdown', wake);
  }, []);
  useEffect(() => { SFX.settings(s.settings); }, [s.settings.sound, s.settings.haptics]);

  const bg = useMemo(() => imgFor(MATS.find((m) => m.id === s.matBg)?.img || 'bg-wood'), [s.matBg]);

  return (
    <div className="app" data-skin={s.skin} style={{ ['--foil-img']: `url(${bg})` }}>
      <style>{`.app::before{background-image:url(${bg})}`}</style>
      <div className="grain" />

      <header className="topbar">
        <div className="brand">
          <Asset name="logo" alt="" />
          <div>
            <b>{APP.name}</b>
            <small>{s.name}</small>
          </div>
        </div>
        <div className="pills">
          <span className="pill gold" title="coins">
            <Asset name="coins" alt="" />
            <span className="v">{fmt(s.balance)}</span>
          </span>
          <span className="pill jp" title="jack points"> <span className="v">{s.jp}</span></span>
          <span className="pill" title="tokens">🎟️ <span className="v">{s.tokens}</span></span>
        </div>
        <button className="icon-btn" aria-label="sound" onClick={() => dispatch({ type: 'SETTINGS', patch: { sound: !s.settings.sound } })}>
          {s.settings.sound ? Ic.sound : Ic.mute}
        </button>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn on" aria-label="daily gift" onClick={() => dispatch({ type: 'UI', patch: { sheet: 'gift' } })}>
            <span style={{ fontSize: 17 }}>🎁</span>
          </button>
          {pendingGift ? <span className="dot" style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 9, background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} /> : null}
        </div>
      </header>

      <div className="lvlwrap">
        <span className="lvl">LV {s.level}</span>
        <div className="bar"><i style={{ width: `${Math.min(100, (s.xp / need) * 100)}%` }} /></div>
        <span className="dim tiny mono">{fmt(s.xp)}/{fmt(need)}</span>
        {s.pity > 0 ? <span className="chip hot" title="pity meter">🍀 {Math.min(14, s.pity)}/14</span> : null}
        {s.luckStreak >= 2 ? <span className="chip good">🔥 {s.luckStreak}</span> : null}
      </div>

      <main className="main">
        {tab === 'table' ? <TableScreen /> : null}
        {tab === 'catalog' ? (<><CatalogScreen /><ShopScreen /></>) : null}
        {tab === 'gadgets' ? <GadgetsScreen /> : null}
        {tab === 'shop' ? <ShopScreen /> : null}
        {tab === 'prestige' ? <PrestigeScreen /> : null}
        {tab === 'profile' ? <ProfileScreen /> : null}
      </main>

      <nav className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={cx('tab', tab === t.id && 'on')}
            onClick={() => { SFX.click(); dispatch({ type: 'TAB', tab: t.id }); }}>
            {t.icon}<span>{t.label}</span>
            {t.id === 'gadgets' && s.gadgets.bot.on && s.gadgets.bot.lvl ? <span className="badge g">●</span> : null}
            {t.id === 'table' && s.tray?.length ? <span className="badge" style={{ background: 'var(--accent)', color: '#241701' }}>{s.tray.length}</span> : null}
          </button>
        ))}
      </nav>

      <div className="wide-note">Play in portrait — the table is built for one thumb.</div>
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
