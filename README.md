# ScratchVerse 🎟️

A **premium, portrait, dark-UI scratch-card arcade** for mobile browsers — an original,
feature-complete homage to the incremental scratch-card genre (*Scritchy Scratchy*-style
loop: scratch → win → upgrade → automate → prestige), built with **Vite + React + IndexedDB**
and deployable to **GitHub Pages** as-is. No backend, no ads, no real money, fully offline-capable.

> All art is AI-rendered for this project (card art, foil textures, 3D props like the ticket,
> the Scratch Bot, the VIP bot, coins, gift, crown) and compressed to WebP + PNG fallback.

---

## 1. Run / build

```bash
npm install
npm run dev        # http://localhost:5173   (host 0.0.0.0, portrait-first)
npm run build      # → dist/ (+ manifest.webmanifest + 404.html SPA fallback)
npm run preview    # serve the production build
npm test           # 206 assertions: rules, economy, save layer + a real React mount
npm run lint
npm run tune       # re-balance every ticket against EV_TARGET via real-engine sampling
npm run preview:static  # render the real screens to preview.html (no browser needed)
```

## 2. Deploy to GitHub Pages (2 minutes)

**Already deployed:** <https://jackbhai.github.io/scratchverse/> (source:
<https://github.com/jackbhai/scratchverse>, branch `main`).

For a fresh repo:

1. New repo → upload this folder → default branch `main`.
2. **Settings → Pages → Build and deployment: Source = GitHub Actions.**
3. Push. `.github/workflows/deploy.yml` builds `dist/` and publishes it.
   Live at `https://<user>.github.io/<repo>/`. Any push to `main` redeploys (~40 s).

`vite.config.js` uses `base: './'` (relative asset URLs) so the same build works on a project
page, a custom domain, or by double-clicking `dist/index.html`. `scripts/gen-manifest.mjs`
writes `404.html` (SPA fallback) and the PWA manifest (portrait, standalone, 192/512/maskable
icons from `public/icons/`). `public/sw.js` is the offline shell: cache-first for content-hashed
assets, network-first for `index.html`, and it is registered only in production builds
(`src/main.jsx`) so `npm run dev` never caches you out.

Manual alternative: `npm run build && npx gh-pages -d dist`.

## 3. Feature map vs the original

| Original mechanic | In ScratchVerse |
|---|---|
| Day job (plates, ~10% break) | Shop → **Day Job**, sink polish upgrade raises pay, lowers break % |
| Ticket catalogues 1–4, named tickets with own rules | **4 catalogues, 13 tickets** — Two Win, Mini Scratch, Apple Tree, Quick Cash, Sea Turtle, Snake Eyes, Lucky Cat, Gold Rush, Mega Jackpot, Sand Dollars, Mystery Box, Booster Pack, **Final Chance** |
| Symbol-chance panel + "Hardness" | Animated odds sheet: per-symbol chance, payout, **player return %**, progressive pool, hardness 1–4 |
| Scratch with a coin (Penny→Half Dollar) | **Finger scratch** with 5 coin tiers = brush radius, plus Scratch Size & Iron Coin (strength) upgrades |
| Auto-Scratch Bot (can't peek, ignores traps) | **Scratch Bot** lvl 1–5 with visible live scratching; deliberately *no peeking*, still hits hazard cells |
| Fan / Sticky Mat / Mundo / Autobuyer / Egg Timer / Spellbook / Machine | All **8 gadgets**, same roles: fan feeds the table, sticky mat protects pinned + super-jackpot tickets, Mundo auto-claims, autobuyer refills with a reserve guard, egg timer boosts all gadget speed, spellbook instantly finishes (daily charges), machine multiplies payouts + refunds losses |
| Run upgrades (luck / size / coin) | 6 run upgrades incl. payout, refund clerk |
| Prestige + Jack Points + permanent tree | **Prestige** (√-curve on run earnings) + 7-node JP tree (seed money, luck core, oiled gears, hazard shield, midas ink, scribe pact, jack echo) |
| Achievements (34) → tokens → Night Market cosmetics | 12 achievements → tokens → Night Market: 4 foil skins + 3 table backgrounds |
| Progressive jackpot / Super jackpot | Two live pools that grow with every ticket sold; super jackpots pay money **+1 JP** (with Jack Echo) and are parked on the mat |
| Penalties / trap tickets | Sea Turtle (over-scratching reveals plastic bags), Snake Eyes (a snake pair bites), Sand Dollars (tide), 💀 cells |
| Trash can | **Toss** an unscratched ticket for a 40–90% refund |
| The phone / Corporation, Final Chance, secret ending | Rotary **phone sheet** with 3 endings: Claim (money), Walk Away (JP), and the **60-second Faithful Servant** wait |
| Save export/import | **IndexedDB autosave** + rotating backups + `SV1.` base64 save codes (merge or replace) |
| Landscape desktop table | **Portrait, one-thumb layout**: top bar → stage → actions → tray/mat; bottom tab bar |

### Things the original doesn't have (our "better")
- **Pity meter** (14 straight losses → guaranteed ≥2.2× payout) so a bad run can't end the game.
- **Peek/Reveal before you commit** — reveal the card, then claim or toss it.
- **Auto-claim toggle** and reduce-effects mode for low-end phones.
- **ASMR audio synthesized at runtime** (scratch noise reacts to stroke speed) — zero downloads, offline-safe.
- **Haptics** on scratch / win / jackpot via the Vibration API.
- **Transparent fairness panel**: every ticket shows win chance, EV/player-return and pool maths.
- **XP + levels** with coin bonuses, live bot feed log, daily stash with streak + JP.
- WebP textures with PNG fallback, ~5 MB total, no runtime image re-encode.
- One-command CI deploy, installable PWA + offline service worker, 404 SPA fallback, `no-undef`-clean lint, 215-assertion test suite (incl. an asset-integrity test that fails if any `src/assets.js` entry is missing from `public/`).

## 3b. 3D art pipeline (how the props get into the UI)

```
assets/raw/*.png            AI-rendered, pure-white background: ticket, Scratch Bot (gold),
                            VIP bot (diamond), coin stack, gift, crown, app logo
scripts/process_assets.py   flood-fill bg removal → tight alpha crop → 560px → WebP + PNG fallback
                            textures resized/re-encoded too → regenerates src/assets.js (url maps)
```
`npm run assets` re-runs it after you drop new renders in `assets/raw`. The assets are then used as
real UI features: ticket = empty-table art + win burst, bots = bot-stage mascot, coins = balance pill +
rain, gift = daily stash, crown = leaderboard/profile + super-jackpot, logo = splash/icon.

## 3c. Screenshots / visual QA (`npm run shots`)

`scripts/shots.mjs` boots the dev server, seeds a realistic mid-run save through the
`__SV_SEED__` hook, then **plays** the game — buys tickets, drags real `PointerEvent` strokes
across the foil (one move per animation frame), claims, opens every tab — and captures
390×844 @3x PNGs into `shots/`, finishing with `shots/contact-sheet.png` (made by
`scripts/contact-sheet.py`). Any app-level console/page error fails the run (`shots/errors.txt`).

The headless Chromium in this sandbox was missing `libnss3`/`libnspr4`/… and any emoji font, so
`.browser-libs/` keeps private copies (extracted from Debian packages, never installed system-wide)
and `scripts/ensure-browser-libs.sh` + a `fonts.conf` point Chromium at them. `shots.mjs` re-execs
itself with that environment, so `npm run shots` just works.

## 3d. Art inventory (all AI-generated, then processed)

| kind | files | how it is used |
|---|---|---|
| per-ticket art (13 of 13) | `public/art/<ticket>.{webp,jpg}` from `assets/raw/art-<ticket>.png` | card background on the table, catalogue rows, tray cards |
| 3D props (7) | `public/assets/*` | ticket (empty table + win burst), gold Scratch Bot, diamond VIP bot, coins (balance + rain), gift (daily stash), crown (profile/super), logo (splash/PWA icon) |
| foil skins (4) | `public/img/foil-{gold,rose,neon,carbon}` | the scratch surface; **metal-mastered** — AI grain + brushed streaks + engraved guilloché + sheen + foil flakes, tinted per skin |
| table surfaces (5) | `public/img/bg-{wood,felt,metal}` + `card-gems` / `card-cyber` | `scripts/synth-textures.py` procedural walnut / felt / steel; Walnut Table is the default mat, others are Night-Market token unlocks |

Add a render to `assets/raw/` (pure white background, 4:5 for card art) and run `npm run assets`:
backgrounds are flooded out, alpha-cropped, WebP+PNG/JPEG encoded, and `src/assets.js` is rewritten.
Ticket art is looked up by ticket id (`ART[id]`) with the shared `card-*` textures as fallback, so
`mystery`, `booster` and `final` still look right until their own `assets/raw/art-<id>.png` lands —
drop the file in and re-run `npm run assets`, nothing else to change.

## 4. Architecture

```
src/
  assets.js              generated (scripts/process_assets.py) → IMG / ASSET url maps
  styles.css             design system: dark glass, gold accents, skins via [data-skin]
  main.jsx / App.jsx       shell: top bar, level/pity strip, 5 tabs, overlay host
  store.js               single reducer + bot engine (TICK every 180 ms) + autosave
  db/store.js            Dexie tables, merge/strip, export/import codes, backups
  game/config.js         ALL balance data: tickets, odds, gadgets, upgrades, JP tree, skins, endings
  game/logic.js          pure rules: rollTicket, applyDab/revealCells, payoutFor, odds, achievements
  game/fmt.js            1e3→K … 1e15+ scientific (like the original's "1.11e69")
  game/sound.js          WebAudio synth (scratch/win/jackpot/level/break/prestige)
  components/ScratchCard.jsx   canvas foil: coverage→per-cell reveal→auto-complete at 55%
  components/screens.jsx       Table / Catalog+Shop / Bots / Prestige / Profile
  components/Overlays.jsx      toasts, win burst, coin rain, phone, gift, onboarding
  ui/base.jsx                  icons, Switch, Sheet, stat blocks, WebP-aware <Asset>
```

Balance is data-driven: tweak `EV_TARGET` / prices / weights in `config.js`, then run
`npm run tune` to rescale symbol payouts by simulating **real rolls + real `payoutFor`** (12k–30k per
ticket), and `npm test` to prove the whole set is still inside its band.

## 5. Scratch engine (how the feel is built)

1. Foil texture is tiled as a canvas pattern over the 3×3 symbol grid, plus an engraved cell mask + vignette.
2. Pointer strokes paint soft radial `destination-out` dabs; distance between events is interpolated so fast
   swipes never leave gaps.
3. `applyDab()` accumulates **per-cell coverage**; a cell opens at a hardness- and strength-derived threshold
   (Iron Coin strength 10→1 literally makes digging easier).
4. Coverage ≥ 55 % (or all 9 cells) → auto-complete: canvas fades, symbols pop, hazard check fires,
   payout resolves.
5. The Scratch Bot uses the same `revealCells()` path (deterministic order, no peeking) so bot and
   human results are consistent and testable headlessly — that's what the jsdom test drives.

## 6. Notes / ethics

Fictional currency only. No purchases, no links to gambling, no RNG tied to real money. The game teaches
expected-value literacy by showing odds and "player return" on every ticket, and protects players with a
pity system and refund mechanics.
