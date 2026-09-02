// ============================================================
// ScratchVerse — real Chromium screenshot pass
// Boots `vite dev`, seeds a mid-run save through the documented __SV_SEED__ hook,
// PLAYS the game with real pointer events, and captures 390×844 @3x screenshots.
//   npm run shots            → shots/*.png + shots/contact-sheet.png
//   SHOT_ORGANIC=1 npm run shots   → cold save, click through onboarding for real
// Self-re-execs with the private lib/font bundle in .browser-libs (scripts/ensure-browser-libs.sh).
// ============================================================
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialState, todayKey } from '../src/db/store.js';
import { TICKETS } from '../src/game/config.js';
import { rollTicket } from '../src/game/logic.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'shots');
const PORT = Number(process.env.SHOT_PORT || 5199);
const URL = `http://127.0.0.1:${PORT}/`;
const ORGANIC = process.env.SHOT_ORGANIC === '1';

/* ---- self-re-exec with the private Chromium libs + fontconfig ---- */
if (!process.env.SV_SHOTS_READY) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    cwd: ROOT,
    env: {
      ...process.env,
      SV_SHOTS_READY: '1',
      LD_LIBRARY_PATH: `${ROOT}/.browser-libs:${process.env.LD_LIBRARY_PATH || ''}`,
      FONTCONFIG_PATH: `${ROOT}/.browser-libs`,
      FONTCONFIG_FILE: `${ROOT}/.browser-libs/fonts.conf`,
    },
  });
  process.exit(r.status ?? 0);
}
mkdirSync(OUT, { recursive: true });

/* ---------------- saves: hand-tuned so every screen has something to show ---------- */
function baseSeed() {
  const s = initialState();
  s.seenOnboard = true;
  s.name = 'MAXED';
  s.balance = 2_400_000;
  s.jp = 26;
  s.tokens = 9;
  s.level = 9;
  s.xp = 40;
  s.lifetime = { earn: 9.4e6, spent: 6.1e6, jp: 26 };
  s.run = { earn: 4.9e6, spent: 3.2e6, peak: 2.6e6 };
  s.upg = { luck: 11, size: 6, coin: 3, payout: 7, toss: 3, job: 4 };
  s.coin = 'quarter';
  s.owned = Object.fromEntries(TICKETS.filter(t => t.cat <= 3).map(t => [t.id, 24]));
  s.stats = {
    ...s.stats,
    scratched: 1420,
    wins: 402,
    losses: 1018,
    spent: 6.1e6,
    earned: 9.4e6,
    supers: 1,
    bestWin: 4.86e5,
    streak: 2,
    bestStreak: 9,
    plates: 410,
    refunds: 51,
    jackpots: 18,
  };
  s.pools = { luckycat: 486_000, booster: 12_400_000 };
  s.achievements = { ...s.achievements, first: 1, ten: 1, win10: 1, streak3: 1, bot: 1, spend1: 1, full: 1, pres1: 1 };
  s.skins = { gold: true, rose: true, neon: true, platinum: true };
  s.matsOwned = { noir: true, oxblood: true, emerald: true, graphite: true, platinum: true };
  s.skin = 'gold';
  s.matBg = 'noir';
  s.daily = { day: todayKey(), last: todayKey(), claimed: true, streak: 4, spell: todayKey(), charges: 2 };
  s.nodes = { seed: 2, core: 3, mech: 1 };
  s.autoTarget = 'appletree';
  return s;
}
const rollWinning = (s, id, tries = 4000) => {
  const T = TICKETS.find(t => t.id === id);
  for (let i = 0; i < tries; i++) {
    const t = rollTicket(s, T);
    if (t.win && t.payout >= T.price * 2) return t;
  }
  return rollTicket(s, T);
};

/* A — manual play: table empty → buy → tap winner from tray → scratch → claim */
const sA = baseSeed();
sA.gadgets = {
  ...sA.gadgets,
  bot: { lvl: 3, on: false },
  fan: { lvl: 2, on: false },
  mundo: { lvl: 1, on: false },
  auto: { lvl: 1, on: false },
};
sA.table = null;
sA.tray = [0, 1, 2, 3].map(i => ({ ...rollWinning(sA, i === 0 ? 'miniscratch' : 'appletree'), status: 'tray', id: `seedwin${i}` }));
const superT = rollWinning(sA, 'megajack');
sA.mat = [
  {
    ...superT,
    id: 'seedsuper',
    super: true,
    done: true,
    settled: true,
    status: 'mat',
    payout: Math.round(60_000_000 * 41),
    scratch: Array(9).fill(1),
    revealed: 9,
  },
];
sA.feed = [
  { e: '✨', x: 'Lucky Cat jackpot +486K', a: 486000, at: Date.now() },
  { e: '', x: 'Two Win paid +60', a: 60, at: Date.now() },
  { e: '🫥', x: 'Quick Cash paid nothing −7.5K', r: 7500, at: Date.now() },
];
const SEEDA = JSON.stringify(sA);

/* B — automation: bots scratching on their own, mid-run */
const sB = baseSeed();
sB.balance = 148e6;
sB.lifetime = { earn: 6.4e7, spent: 5.1e7, jp: 26 };
sB.run = { earn: 3.2e7, spent: 2.9e7, peak: 4.4e7 };
sB.gadgets = {
  ...sB.gadgets,
  bot: { lvl: 4, on: true },
  fan: { lvl: 2, on: true },
  mundo: { lvl: 1, on: true },
  auto: { lvl: 2, on: true },
  egg: { lvl: 2, until: 0, readyAt: 0 },
};
sB.settings = { ...sB.settings, autoClaim: true };
sB.table = {
  ...rollTicket(
    sB,
    TICKETS.find(t => t.id === 'appletree')
  ),
  status: 'table',
};
sB.tray = Array.from({ length: 7 }, () => ({
  ...rollTicket(
    sB,
    TICKETS.find(t => t.id === 'quickcash')
  ),
  status: 'tray',
}));
const SEEDB = JSON.stringify(sB);

/* ---------------- boot ---------------- */
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});
const bye = () => {
  try {
    server.kill('SIGTERM');
  } catch {}
};
process.on('exit', bye);
const wait = ms => new Promise(r => setTimeout(r, ms));
const up = async () => {
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(URL)).ok) return true;
    } catch {}
    await wait(250);
  }
  return false;
};
if (!(await up())) {
  console.error('dev server did not start');
  bye();
  process.exit(1);
}

const b = await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'] });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
const errs = [];
const IGNORE = /net::ERR_(CONNECTION_REFUSED|FAILED)|WebSocket connection to|favicon/i;
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !IGNORE.test(t)) errs.push('console: ' + t.slice(0, 200));
});
page.on('pageerror', e => {
  errs.push('pageerror: ' + String(e).slice(0, 200));
  log('   PAGEERR: ' + String(e).slice(0, 200));
});
const log = (...a) => console.log(...a);
const shot = async (n, sel) => {
  await page
    .evaluate(() => {
      document.querySelectorAll('.main').forEach(e => {
        e.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    })
    .catch(() => {});
  await wait(320);
  try {
    sel
      ? await page
          .locator(sel)
          .first()
          .screenshot({ path: `${OUT}/${n}.png` })
      : await page.screenshot({ path: `${OUT}/${n}.png` });
  } catch {
    await page.screenshot({ path: `${OUT}/${n}.png` });
  }
  log(`  ✓ ${n}`);
};
const st = msg =>
  page
    .evaluate(() => ({
      screen: document.querySelector('.screen h2')?.textContent,
      card: !!document.querySelector('#scratchCv'),
      pills: [...document.querySelectorAll('.pill .tabular')].map(x => x.textContent),
      tray: document.querySelectorAll('.mini-t').length,
      cov: document.querySelector('.prog span')?.textContent,
    }))
    .then(v => log(`   ${msg} ${JSON.stringify(v)}`));

/* scratch engine driver: one pointermove per animation frame, exactly like a finger */
const scratch = (rows, per = 7) =>
  page.evaluate(
    async ([rows, per]) => {
      const cv = document.querySelector('#scratchCv');
      if (!cv) return { err: 'no canvas' };
      const frame = () => new Promise(r => requestAnimationFrame(() => r()));
      const r = cv.getBoundingClientRect();
      const G = { X: 0.07, Y: 0.25, W: 0.86, H: 0.6 };
      const P = (fx, fy) => [r.left + (G.X + fx * G.W) * r.width, r.top + (G.Y + fy * G.H) * r.height];
      const fire = (t, x, y) =>
        cv.dispatchEvent(
          new PointerEvent(t, {
            pointerId: 1,
            isPrimary: true,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            buttons: t === 'pointerup' ? 0 : 1,
          })
        );
      for (const [fx1, fy1, fx2, fy2] of rows) {
        const [x1, y1] = P(fx1, fy1),
          [x2, y2] = P(fx2, fy2);
        fire('pointerdown', x1, y1);
        await frame();
        for (let i = 1; i <= per; i++) {
          fire('pointermove', x1 + ((x2 - x1) * i) / per, y1 + ((y2 - y1) * i) / per);
          await frame();
        }
        fire('pointerup', x2, y2);
        await frame();
      }
      return { cov: document.querySelector('.prog span')?.textContent };
    },
    [rows, per]
  );
const serp = (n, top = 0.06, bot = 0.94, vert = false) =>
  Array.from({ length: n }, (_, i) => {
    const a = top + (bot - top) * (i / (n - 1));
    return vert ? (i % 2 ? [a, 0.01, a, 0.99] : [a, 0.99, a, 0.01]) : i % 2 ? [0.01, a, 0.99, a] : [0.99, a, 0.01, a];
  });
const hatch = (n = 7) => [...serp(n, 0.05, 0.95), ...serp(n, 0.05, 0.95, true)];

/* ============ 01 onboarding (cold save in an isolated context) ============ */
if (ORGANIC) {
  await page.goto(URL, { waitUntil: 'load' });
  await wait(2000);
  await shot('01-onboarding');
  await page.getByText(/Start with/).click();
  await wait(1400);
} else {
  const coldCtx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const cold = await coldCtx.newPage();
  await cold.goto(URL, { waitUntil: 'load' });
  await cold.waitForTimeout(2200);
  await cold.screenshot({ path: `${OUT}/01-onboarding.png` });
  log('  ✓ 01-onboarding');
  await coldCtx.close();
}

/* ============ 02/03 the table: empty slot (ticket art) then a real ticket ============ */
await page.addInitScript(`globalThis.__SV_SEED__ = ${SEEDA};`);
await page.goto(URL, { waitUntil: 'load' });
await wait(2400);
await shot('02-table-empty');
await st('empty table');

/* tray winner → tap it onto the table (that is the real SELECT gesture) */
await page.locator('.tray .mini-t').first().click();
await wait(1200);
await shot('03-ticket-on-table');
await st('after select');

/* ============ 04/05 shop: catalogue with per-ticket art + odds sheet ============ */
await page.locator('.tab', { hasText: 'Shop' }).click();
await wait(1100);
await shot('04-catalog');
await page.locator('.tk button', { hasText: /odds/i }).nth(1).click();
await wait(800);
await shot('05-odds-sheet');
// the X in the sheet header is the primary close affordance; Esc is the fallback
await page
  .locator('.modal .xbtn')
  .click({ timeout: 5000 })
  .catch(() => {});
await wait(400);
await shot('05b-sheet-closed-by-x');
await page.locator('.tk button', { hasText: /odds/i }).nth(1).click();
await wait(500);
await page.keyboard.press('Escape').catch(() => {});
await wait(400);
await page.locator('.tab', { hasText: 'Table' }).click();
await wait(900);

/* ============ 06/07/08 scratching, live ============ */
await page.waitForSelector('#scratchCv', { timeout: 15000 }).catch(() => {});
await wait(600);
log('   pre-scratch', JSON.stringify(await page.evaluate(() => ({ cov: document.querySelector('.prog span')?.textContent }))));
await scratch([[0.05, 0.16, 0.62, 0.17]], 7); // one finger pass over the top row
await wait(700);
await shot('06-mid-scratch');
await st('mid scratch');
await scratch(hatch(6), 9); // cross-hatch the rest
await wait(650);
await shot('07-revealed');
/* a fresh card caught mid-scratch (only one corner scratched) — the money shot */
await page
  .locator('.tray .mini-t')
  .first()
  .click({ timeout: 6000 })
  .catch(() => {});
await wait(900);
await page.waitForSelector('#scratchCv', { timeout: 8000 }).catch(() => {});
await scratch([[0.06, 0.15, 0.52, 0.16]], 6);
await wait(500);
await shot('07b-fresh-mid');
await scratch(hatch(6), 9);
await wait(1400);
await st('revealed');
/* claim it (tap the cat / claim button) */
await page
  .locator('.tcard')
  .click({ position: { x: 30, y: 420 } })
  .catch(() => {});
await page
  .getByRole('button', { name: /claim/i })
  .first()
  .click({ timeout: 4000 })
  .catch(() => {});
await wait(1100);
await shot('08-claimed');
await st('claimed');

/* ============ 09 sticky mat with the parked SUPER JACKPOT ============ */
await page
  .locator('.tray .sticky, .mini-t.sticky')
  .first()
  .click({ timeout: 5000 })
  .catch(() => log('   (mat ticket is on the table after tap)'));
await wait(900);
await shot('09-sticky-mat');

/* ============ 10 bots tab ============ */
await page.locator('.tab', { hasText: 'Bots' }).click();
await wait(1000);
await shot('10-bots');

/* ============ 11 prestige, 12 profile, 13 night market ============ */
await page.locator('.tab', { hasText: 'JP' }).click();
await wait(900);
await shot('11-prestige');
await page.locator('.tab', { hasText: 'You' }).click();
await wait(900);
await shot('12-profile');
const nm = page
  .locator('.sect h2')
  .filter({ hasText: /night market/i })
  .first();
if (await nm.count()) {
  await nm.scrollIntoViewIfNeeded().catch(() => {});
  await wait(700);
  await shot('13-night-market');
  // prove the cosmetics are real: equip a different metal + mat, then re-shoot the card
  await page
    .locator('.shopitem')
    .filter({ hasText: /Ice Neon/i })
    .click()
    .catch(() => {});
  await wait(400);
  await page
    .locator('.shopitem')
    .filter({ hasText: /Emerald Felt/i })
    .click()
    .catch(() => {});
  await wait(700);
  await shot('13b-night-market-equipped');
} else log('  – 13 night market (no entry point on this screen)');

/* ============ 14 automation running (second context, own save) ============ */
const ctxB = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const pb = await ctxB.newPage();
pb.on('pageerror', e => errs.push('B pageerror: ' + String(e).slice(0, 160)));
await pb.addInitScript(`globalThis.__SV_SEED__ = ${SEEDB};`);
await pb.goto(URL, { waitUntil: 'load' });
await pb.waitForTimeout(9000); // let the bot + fan + auto-buyer work
await pb.screenshot({ path: `${OUT}/14-autoplay.png` });
log('  ✓ 14-autoplay  feed:', await pb.evaluate(() => document.querySelector('.feed')?.textContent?.slice(0, 70) || 'n/a'));
await pb.locator('.tab', { hasText: 'Bots' }).click();
await pb.waitForTimeout(900);
await pb.screenshot({ path: `${OUT}/15-bots-stage.png` });
log('  ✓ 15-bots-stage');
await ctxB.close();

/* ============ 16 the card itself, close-up ============ */
await page.locator('.tab', { hasText: 'Table' }).click();
await wait(600);
for (let i = 0; i < 4 && !(await page.locator('#scratchCv').count()); i++) {
  await page.locator('.tab', { hasText: 'Shop' }).click();
  await wait(420);
  await page
    .locator('.tk button:not([disabled])', { hasText: /buy/i })
    .first()
    .click({ timeout: 6000 })
    .catch(() => {});
  await wait(420);
  await page.locator('.tab', { hasText: 'Table' }).click();
  await wait(900);
}
await scratch(serp(2), 6).catch(() => {});
await wait(400);
await shot('16-card-closeup', '.tcard');

/* ============ 16b narrow phone (360px) — top bar must not collide ============ */
await page.setViewportSize({ width: 360, height: 800 });
await wait(700);
await shot('16b-narrow');
await page.setViewportSize({ width: 390, height: 844 });
await wait(400);

/* ============ 17 desktop frame (portrait column centred) ============ */
await page.setViewportSize({ width: 1280, height: 900 });
await wait(900);
await shot('17-desktop');
await page.setViewportSize({ width: 390, height: 844 });

/* ============ 18 the coin cursor (desktop pointer, scales with Scratch Size) ============ */
const ctxC = await b.newContext({ viewport: { width: 900, height: 950 }, deviceScaleFactor: 2 });
const pc = await ctxC.newPage();
await pc.addInitScript(`globalThis.__SV_SEED__ = ${SEEDA};`);
await pc.goto(URL, { waitUntil: 'load' });
await pc.waitForTimeout(2400);
if (!(await pc.locator('#scratchCv').count())) {
  await pc.locator('.tab', { hasText: 'Shop' }).click();
  await pc.waitForTimeout(500);
  await pc
    .locator('.tk button:not([disabled])', { hasText: /buy/i })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {});
  await pc.locator('.tab', { hasText: 'Table' }).click();
  await pc.waitForTimeout(900);
}
const cb = await pc
  .locator('#scratchCv')
  .boundingBox()
  .catch(() => null);
if (cb) {
  await pc.mouse.move(cb.x + cb.width * 0.45, cb.y + cb.height * 0.42);
  await pc.waitForTimeout(350);
  await pc.locator('.tcard').screenshot({ path: `${OUT}/18-coin-cursor.png` });
  log('  ✓ 18-coin-cursor');
} else log('  – 18 coin cursor (no card)');
await ctxC.close();

/* ============ 19 the cosmetic swap, visible on the card itself ============ */
{
  const ctxD = await b.newContext({ viewport: { width: 900, height: 950 }, deviceScaleFactor: 2 });
  const pd = await ctxD.newPage();
  await pd.addInitScript(`globalThis.__SV_SEED__ = ${SEEDA};`);
  await pd.goto(URL, { waitUntil: 'load' });
  await pd.waitForTimeout(2200);
  await pd.locator('.tab', { hasText: 'You' }).click();
  await pd.waitForTimeout(600);
  await pd
    .locator('.sect h2', { hasText: /night market/i })
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await pd
    .locator('.shopitem')
    .filter({ hasText: /Rose Alloy/i })
    .click()
    .catch(() => {});
  await pd
    .locator('.shopitem')
    .filter({ hasText: /Platinum Rail/i })
    .click()
    .catch(() => {});
  await pd.waitForTimeout(500);
  await pd.locator('.tab', { hasText: 'Shop' }).click();
  await pd.waitForTimeout(500);
  await pd
    .locator('.tk button:not([disabled])', { hasText: /buy/i })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {});
  await pd.locator('.tab', { hasText: 'Table' }).click();
  await pd.waitForTimeout(1200);
  const bb = await pd
    .locator('.tcard')
    .boundingBox()
    .catch(() => null);
  if (bb) {
    await pd.mouse.move(bb.x + bb.width * 0.4, bb.y + bb.height * 0.4);
    await pd.mouse.down();
    for (let i = 0; i < 14; i++) {
      await pd.mouse.move(bb.x + bb.width * (0.18 + 0.045 * i), bb.y + bb.height * (0.3 + 0.012 * i));
      await pd.waitForTimeout(28);
    }
    await pd.mouse.up();
    await pd.waitForTimeout(500);
    await pd.locator('.tcard').screenshot({ path: `${OUT}/19-rose-metal.png` });
    log('  ✓ 19-rose-metal (skin + mat swap painted on the foil)');
  } else log('  – 19 rose metal (no card)');
  await ctxD.close();
}

writeFileSync(resolve(OUT, 'errors.txt'), errs.join('\n') || 'no console/page errors');
log(
  errs.length
    ? `⚠ ${errs.length} app console error(s):\n` + errs.slice(0, 8).join('\n')
    : '✓ no app console/page errors (HMR noise ignored)'
);
await b.close();
bye();
const { spawnSync } = await import('node:child_process');
spawnSync('python3', [resolve(ROOT, 'scripts/contact-sheet.py')], { cwd: ROOT, stdio: 'inherit' });
process.exit(0);
