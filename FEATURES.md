# Scritchy Scratchy → ScratchVerse — feature map

Research source: official Steam page (app 3948120, release 18 Mar 2026), itch.io demo,
funday-games pages + community wikis (scritchyscratchy.cc / .site / .org), PC Gamer / Kotaku /
TheGamer coverage. Fetched 2026-09-02.

## A. What the original is
"An addictive incremental scratch-card game": buy fictional lottery tickets, drag a coin to scratch
the silver coating, match symbols, collect payouts, reinvest into luck/size/payout upgrades, unlock
automation gadgets, then Prestige for Jack Points. ASMR scratch SFX are a core selling point.
It is landscape, pixel-art, mouse-driven, table-of-cards metaphor.

## B. Full feature list found in the original
| # | Feature | How it looks in the original |
|---|---|---|
| 1 | Day Job (start money) | sink icon in Catalog 1, $1/plate, ~10% plates break |
| 2 | Ticket catalogues 1–4 | left column, grouped headers, price + owned "Lvl" + green progress bar |
| 3 | Named tickets with own rules | Two Win, Mini Scratch, Apple Tree, Quick Cash, Lucky Cat, Sand Dollars, Booster Pack, Sea Turtle, Snake Eyes, Progressive/Mega Jackpot, Final Chance |
| 4 | Symbol-chance panel | dark panel right of card: symbol %, payout, `?` for progressive, "Hardness: 1" |
| 5 | Manual scratching with a coin | silver/blue halftone coating, coin cursor sweeps, coating crumbles |
| 6 | Scratch tool tiers | Penny → Nickel → Dime → Quarter → Half Dollar = bigger brush, faster cards |
| 7 | Run upgrades | right panel: Scratch Luck (clover), Scratch Size (arrows), Iron Coin (strength) |
| 8 | Negative / penalty tickets | red minus values inside cards, Sea Turtle "plastic bag" trap when over-scratched |
| 9 | Trash can | bottom-right bin, discard a ticket |
| 10 | Gadgets ×8 | on the table: Scratch Bot (arm), Fan, Sticky Mat, Mundo (cat), Autobuyer, Egg Timer, Spellbook, Machine |
| 11 | Bot trade-off | bot can't peek / avoid hazards — fast but dumber than manual |
| 12 | Super Jackpot → sticky mat | Mundo parks super-jackpot tickets so the human scratches them |
| 13 | Egg Timer | crank that temporarily speeds every gadget except the Machine |
| 14 | Spellbook | instantly scratches a selected ticket, incl. Super Jackpot |
| 15 | Progressive jackpot pool | grows with every ticket bought in the run; `?` in the odds panel |
| 16 | Prestige + Jack Points | "JP" chip top-left, `Prestige (2)` button, permanent tree |
| 17 | Achievements (34) + tokens | badge chip top-left; tokens are a second currency |
| 18 | Night Market | spend tokens on cosmetics (12 in patch 1.1), gadget customization |
| 19 | Cosmetics: foils / skins | card + coating colour themes |
| 20 | The phone / Corporation | red rotary phone on the table, late-game "Win Everything" events |
| 21 | Final Chance + endings | huge ticket, "Claim"/"Wait 5 min" → Faithful Servant secret ending |
| 22 | Save export / import code | Settings → Export Save string, import to move progress |
| 23 | Offline / browser-save play | progress in browser cache |
| 24 | Money formatting | 1.11e69 scientific, "Maxed" nameplate at cap |
| 25 | Ticker/chips header | balance + nameplate + JP + badges + settings gear |

## C. ScratchVerse port (same loop, better on mobile)
| Original | ScratchVerse |
|---|---|
| landscape pixel table | **portrait**, premium dark glass UI, 3D AI-rendered props |
| coin cursor | **finger scratch** w/ pressure-ish speed response, haptics, per-coin brush sizes |
| silver coating | **real foil textures** (gold / rose / neon / carbon) with edge glints + crumbling |
| symbol panel | animated odds sheet + EV% + "fairness" maths shown |
| bot on table | **bot stage**: Gold bot + Diamond VIP bot sprites, live scratch, feed log |
| fan | Fan gadget = auto-feed queue → table with flying-card animation |
| sticky mat | Sticky Mat zone: pinned tickets are bot-immune; super jackpots auto-park there |
| Mundo (cat) | Mundo auto-claim with paw animation + park-super-jackpot rule |
| autobuyer | AutoBuy ON/OFF + qty multiplier + reserve guard |
| egg timer | Turbo (Egg Timer) with real countdown + cooldown ring |
| spellbook | Spellbook daily charges = instant reveal |
| machine | Machine = end-game payout multiplier + 25% loss refund |
| achievements | 12 achievements → tokens → Night Market skins |
| phone/endings | Rotary phone sheet, Final Chance ticket, 3 endings (Claim / Walk Away / 60s Faithful wait) |
| browser cache | **IndexedDB (Dexie)** autosave + export/import code + full offline |

## D. Ours is *better* because
1. Portrait + one-thumb reach (top bar, bottom tabs) vs mouse-only desktop layout.
2. Real foil physics-ish feel: soft brush, coverage-driven per-cell reveal, auto-complete at 55%.
3. ASMR layered audio synthesized at runtime (no downloads, works offline) + vibration.
4. Hard-stuck protection: **pity meter** + **peek-before-claim** (a fair upgrade over the bot trade-off)
   and **toss-for-refund** so a bad ticket can't end your run.
5. Visible fairness: every ticket shows odds, EV, hardness, and progressive pool math.
6. Zero-backend mobile DB save w/ versioned schema + backup code (original only had a save string in settings).
7. Ship-ready: GitHub Pages relative-base build, PWA manifest, `404.html` SPA fallback, one-action CI.

## 6. Visual parity added in this pass (after screenshot review)

| original element | ScratchVerse now |
|---|---|
| unique artwork per ticket | 10 AI-rendered 4:5 card arts (`public/art/<id>`), used on the table card, catalogue rows, tray + sticky-mat thumbs; the 3 not yet rendered fall back to the shared card textures |
| metallic scratch foil | `process_assets.py` metal-masters the AI grain: brushed streaks + engraved guilloché + sheen bands + foil flakes, tinted per skin (gold/rose/neon/carbon) |
| wooden table | procedural walnut plank surface (`scripts/synth-textures.py`) is the default table mat; felt / steel / gems / neon are Night-Market unlocks |
| coin cursor that scales with Iron Coin | a gold-coin ghost follows the pointer over the card, sized from `stats(s).brush`, hidden on touch and in reduce-effects mode |
| red rotary phone on the table | inline-SVG phone prop in the table header; shakes + red dot while the Corporation call is queued, opens the endings sheet |
| crisp typography offline | Sora + Manrope self-hosted (`public/fonts`, `npm run fonts`) — no Google-Fonts dependency, so the PWA is truly offline |

Everything above is verified by real Chromium screenshots (`npm run shots` → `shots/*.png`, `shots/contact-sheet.png`, `shots/hero.png`) and the app-error check in `shots/errors.txt`.

---

## 7. Honest parity ledger vs. the original

Checked against the itch.io page, the community wiki/guide and the Steam store page. Not marketing —
what is genuinely identical, what is an approximation, and what is missing.

**Same or stronger (mechanically verified in code + tests)**

| System | Original | ScratchVerse |
|---|---|---|
| Scratch engine | drag to remove foil, whole card clears at a threshold | same, plus per-cell threshold from hardness/coin, 55 % auto-complete, `reveal-cells` debug hook |
| Tickets / catalogues | 4 catalogues, early + late game | 13 tickets / 4 catalogues, per-ticket art, symbol tables, hazard tickets |
| Gadgets | Bot, Fan, Sticky Mat, Mundo, Autobuyer, Egg Timer, Spellbook, Machine | all 8, same roles (bot scratches what you drop in it, fan pushes tickets, mat is the no-move zone, Mundo claims, egg speeds everything but the Machine) |
| Coins / brush size | 5 coin tiers change scratch radius | 5 tiers, each with `r` + unlock gate |
| Upgrades | luck, size, money, payout, toss, job | same 6, exponential curves |
| Prestige | Jack Points, permanent nodes | 7-node JP tree, `PRESTIGE_BASE` 2.5e7 |
| Day Job | wash plates for non-ticket income, plates can break | plate-washing card + `job` upgrade + break risk |
| Hazards | Sea Turtle punishes over-scratching, Sand Dollars penalty cells | both, plus Hazard Shield JP node |
| Night Market | achievement tokens → cosmetics | 4 foils + 5 table surfaces |
| Endings | phone call / Corporation finale | Claim / hang up / 60-second "hands off" sheet with badges |
| Save | local save, export/import in settings | IndexedDB + `SV1.` export/import code, offline PWA |

**Approximated, not 1:1**

- **Audio** — the original ships recorded ASMR scratching; here every cue is synthesized in WebAudio
  (filtered noise bursts whose pitch follows scratch speed). Zero downloads, but it is not the same recording.
- **Animations** — built from written descriptions and layout notes of the original, never frame-compared
  against its video: foil tears, symbol `pop`, stamp, coin rain, phone ring-shake, bot bob, screen fade.
  Nothing was "captured" from the original's footage, so treat per-animation fidelity as designed, not matched.
- **Numbers** — payouts are tuned into a ±10 % EV band by `scripts/tune.mjs --check`; the itch.io demo's
  exact values are not the full game's, so they were not copied.
- **Layout** — portrait-only, dark premium (per brief). The original is a desktop window; its mobile port is
  a straight 1:1 of the desktop layout, this is not.

**Missing (cannot exist on the web / not built)**

- 34 Steam achievements (and Game Center / Play Games achievements + cloud save). Here: 12 local
  achievements feeding the Night Market only — no platform layer is reachable from a static site.
- The one-time supporter purchase (a store SKU, not a game system).
- Bespoke pixel art and hand-drawn UI chrome of the original; here it is AI-generated texture/ticket art.
