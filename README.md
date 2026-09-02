# ScratchVerse

A **premium, portrait-only, AMOLED-dark scratch-card arcade** for mobile browsers — an original,
feature-complete homage to the incremental scratch-card genre (*Scritchy Scratchy*-style loop:
scratch → win → upgrade → automate → prestige), built with **Vite + React 19 + IndexedDB** and
deployable to **GitHub Pages** as-is. No backend, no ads, no real money, fully offline-capable.

> **Zero bitmap art.** Every ticket face, foil, coin, prop glyph and table texture in this game is
> generated: inline SVG paths, CSS gradients and a canvas painted from an SVG data URI. There is no
> image pipeline, no CDN and no emoji — the whole `dist/` is **1.4 MB**, of which 172 kB is the app
> bundle and 115 kB is the self-hosted variable fonts.

---

## 1. Run / build

```bash
npm install
npm run dev        # http://localhost:5173  (host 0.0.0.0, portrait-first)
npm run build      # → dist/ (+ manifest.webmanifest + 404.html SPA fallback)
npm run preview    # serve the production build
npm run verify     # typecheck + lint + tests + balance check + build, in one go
npm run test       # vitest units (51) + the bundled engine/mount suite (230 assertions)
npm run test:unit  # vitest only
npm run lint       # biome check (format + lint) over src, scripts, tests
npm run typecheck  # tsc --noEmit with checkJs over all of src/
npm run tune       # re-balance every ticket against EV_TARGET via real-engine sampling
npm run shots      # play the game in headless Chromium and write shots/*.png + contact sheet
npm run contact    # tile shots/*.png into shots/contact-sheet.png for review
npm run fonts      # copy the self-hosted woff2 out of @fontsource into src/fonts
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
page, a custom domain, or by double-clicking `dist/index.html`. `scripts/gen-manifest.mjs` writes
`404.html` (SPA fallback) and the PWA manifest (portrait, standalone, 192/512/maskable icons in
`public/icons/` — the only rasters in the project, because launchers demand them). `public/sw.js`
is the offline shell: cache-first for content-hashed assets, network-first for `index.html`, and it
is registered only in production builds (`src/main.jsx`) so `npm run dev` never caches you out.

Manual alternative: `npm run build && npx gh-pages -d dist`.

## 3. The visual system (vector, three layers)

| Layer | File | What it does |
|---|---|---|
| Glyphs | `src/ui/icons.jsx` | ~90 monoline 24×24 icons (`ICONS` map + `<Icon name size title>`). Symbols, gadgets, achievements, tabs, feed rows and every button icon come from here. Unknown keys render nothing instead of a tofu box, and `tests/unit/icons.test.jsx` fails if any key in `config.js` is unresolvable. |
| Surfaces | `src/ui/art.jsx` | `TicketFace` draws a 120×176 card from the ticket's own data: engraved guilloché field (deterministic PRNG seeded by ticket id), hairline double frame, catalogue + price rail, motif glyph, name plate. `SKIN_METAL` / `foilSvg()` produce the scratchable metal (also used as a `createPattern` source on the canvas), `metalCss()` the DOM swatches, `MATS_CSS` the five table themes as pure CSS. `Crest` and `Coin` are the app's mark and currency. |
| Motion & chrome | `src/styles.css`, `src/ui/base.jsx` | AMOLED layer stack (`@layer theme, reset, layout, chrome, components, card, effects`), one `<Modal>` for every overlay, WAAPI metal shavings, spring pay-line, pointer-driven gloss and tilt. |

Because the card art is *generated from the data*, adding a ticket to `config.js` gives it a
correct face, foil tint, odds panel and icon row automatically — there is nothing to render,
compress, register or ship.

### Why the ✕ works everywhere
Every sheet, dialog, win burst, gift and phone call is the same `<Modal>` (`src/ui/base.jsx`),
which owns: a real `<button aria-label="Close">` in the header, backdrop tap, `Escape` (only for
the topmost modal, tracked in a module-level stack), swipe-down past 96 px / 640 px·s⁻¹, focus
move-in and focus restore, body-scroll lock and unlock. The old bug was structural — overlays
were hand-rolled per screen, and `UI` patches went through a `merge()` that dropped `null`, so
`sheet: null` never closed them. Both are now covered by tests
(`tests/unit/modal.test.jsx`, `tests/unit/sheets.test.jsx`, and a regression assertion on the
`UI` reducer action).

## 4. Feature map vs the original

| Original mechanic | In ScratchVerse |
|---|---|
| Day job (plates, ~10% break) | Shop → **Day Job**, Sink Polish upgrade raises pay, lowers break % |
| Ticket catalogues 1–4, named tickets with own rules | **4 catalogues, 13 tickets** — Two Win, Mini Scratch, Apple Tree, Quick Cash, Sea Turtle, Snake Eyes, Lucky Cat, Gold Rush, Mega Jackpot, Sand Dollars, Mystery Box, Booster Pack, **Final Chance** |
| Symbol-chance panel + "Hardness" | Odds sheet: per-symbol chance, payout, **player return %**, progressive pool, hardness 1–4 |
| Scratch with a coin (Penny→Half Dollar) | **Finger scratch** with 5 coin tiers = brush radius, plus Scratch Size & Iron Coin (strength) upgrades |
| Auto-Scratch Bot (can't peek, ignores traps) | **Scratch Bot** lvl 1–5 with visible live scratching; deliberately *no peeking*, still hits hazard cells |
| Fan / Sticky Mat / Mundo / Autobuyer / Egg Timer / Spellbook / Machine | All **8 gadgets**, same roles: fan feeds the table, sticky mat protects pinned + super-jackpot tickets, Mundo auto-claims, autobuyer refills with a reserve guard, egg timer boosts all gadget speed, spellbook instantly finishes (daily charges), machine multiplies payouts + refunds losses |
| Run upgrades (luck / size / coin) | 6 run upgrades incl. payout, refund clerk, sink polish |
| Prestige + Jack Points + permanent tree | **Prestige** (√-curve on run earnings) + 7-node JP tree (seed money, luck core, oiled gears, hazard shield, midas ink, scribe pact, jack echo) |
| Achievements (34) → tokens → Night Market cosmetics | 12 achievements → tokens → Night Market: 4 metal coatings + 5 table themes (all vector) |
| Progressive jackpot / Super jackpot | Two live pools that grow with every ticket sold; super jackpots pay money **+1 JP** (with Jack Echo) and are parked on the mat |
| Penalties / trap cells | Sea Turtle (over-scratching reveals plastic bags), Snake Eyes (a snake pair bites), Sand Dollars (tide), skull cells |
| Trash can | **Toss** an unscratched ticket for a 40–90 % refund |
| The phone / Corporation, Final Chance, secret ending | **Phone sheet** with 3 endings: Claim (money), Walk Away (JP), and the **60-second Faithful Servant** wait |
| Save export/import | **IndexedDB autosave** + rotating backups + `SV1.` base64 save codes (merge or replace), schema-validated on the way in |
| Landscape desktop table | **Portrait, one-thumb layout**: top bar → stage → actions → tray/mat; bottom tab bar |

### Things the original doesn't have (our "better")
- **Pity meter** (14 straight losses → guaranteed ≥ 2.2× payout) so a bad run can't end the game.
- **Reveal before you commit** — reveal the card, then claim or toss it.
- **Auto-claim toggle** and a reduce-effects mode that also disables flakes, rain and tilt.
- **ASMR audio synthesized at runtime** (scratch noise reacts to stroke speed) — zero downloads.
- **Haptics** on scratch / win / jackpot via the Vibration API.
- **Transparent fairness panel**: every ticket shows win chance, EV/player-return and pool maths.
- **XP + levels** with coin bonuses, live machine feed, daily stash with streak + JP.
- **Two-tab safety**: a `BroadcastChannel` tells an open tab to reload the save instead of
  overwriting it; every read path is `zod`-validated and v1 (bitmap-era) saves are migrated.
- Narrow-subscription store (`zustand`) so hot widgets read one field instead of re-rendering on
  the 180 ms clock, while all game rules stay in one pure `reducer(state, action)`.
- Installable PWA + offline service worker, 404 SPA fallback, CI deploy, and **281 automated
  assertions** (51 vitest units + the 230-assertion engine/mount suite).

## 5. Architecture

```
src/
  styles.css               @layer'd AMOLED design system + [data-skin] metal re-tint
  main.jsx / App.jsx       shell: crest, money pills, level strip, 5 tabs, overlay host
  store.js                 pure reducer (all rules) + zustand store/provider + bot engine
  db/store.js              Dexie tables, zod schema, v1→v2 migration, codes, backups, tab sync
  game/config.js           ALL balance + art keys: tickets, odds, gadgets, upgrades, JP tree, skins, endings
  game/logic.js            pure rules: rollTicket, applyDab/revealCells, payoutFor, ticketOdds, achievements
  game/fmt.js              1e3→K … 1e15+ scientific (like the original's "1.11e69")
  game/sound.js            WebAudio synth (scratch/win/jackpot/level/break/prestige)
  ui/icons.jsx             the icon registry (single source of glyph identity)
  ui/art.jsx               TicketFace / foil metal / mat themes / crest / coin, all procedural
  ui/base.jsx              Modal (every overlay), IconBtn, Chip, Switch, Bar, Stat, Lv, Swatch
  components/ScratchCard.jsx    canvas foil: coverage→per-cell reveal→auto-complete at 55 %
  components/screens.jsx        Table / Catalog / Bots / Shop / Prestige / Profile
  components/Overlays.jsx       toasts, win burst, coin rain, phone, gift, onboarding
tests/unit/*.test.jsx      icons + art + save schema + modal/sheet closing (vitest, jsdom)
tests/run.cjs              engine, economy, geometry, save layer, full React mount click-through
scripts/                   tune.mjs (EV), gen-manifest.mjs (PWA+404), shots.mjs (screenshots),
                           copy-fonts.mjs, ensure-browser-libs.sh, run-tests.sh
```

Balance is data-driven: tweak `EV_TARGET`, prices or weights in `config.js`, run `npm run tune` to
rescale symbol payouts by simulating **real rolls + real `payoutFor`** (12k–30k samples per ticket),
then `npm run tune -- --check` to prove every ticket is inside ±10 % of its target. That check is
part of `npm run verify`, so a cosmetic rewrite can never silently change the economy — the 2.0
art swap kept all 13 tickets inside band with identical prices and weights.

## 6. Scratch engine (how the feel is built)

1. The coating is *painted*, not loaded: `foilSvg(skin)` → `createPattern`, then engraved security
   lines, per-cell wells, a catalogue-tinted overlay, a vignette and a microprint band.
2. Pointer strokes carve soft radial `destination-out` dabs; the distance between events is
   interpolated so fast swipes never leave gaps, and a bright "torn lip" is left behind each dab.
3. `applyDab()` accumulates **per-cell coverage**; a cell opens at a hardness- and
   strength-derived threshold (Iron Coin strength 10→1 literally makes digging easier).
4. Coverage ≥ 55 % (or all 9 cells) → auto-complete: the foil fades, cells spring open, matched
   cells get a drawn pay-line, the hazard check fires and the payout resolves.
5. The Scratch Bot uses the same `revealCells()` path (deterministic order, no peeking), so bot and
   human results are consistent and testable headlessly — that is what the jsdom suite drives.
6. Shavings are real DOM elements animated with WAAPI (`element.animate`), capped at 26 live
   flakes and skipped entirely under `reduceFx`.

## 7. Notes / ethics

Fictional currency only. No purchases, no links to gambling, no RNG tied to real money. The game
teaches expected-value literacy by showing odds and "player return" on every ticket, and protects
players with a pity system and refund mechanics.
