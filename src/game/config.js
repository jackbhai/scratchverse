// ============================================================
// ScratchVerse — game data (all balance numbers live here)
// Visuals are vector: every `e` / `motif` / `icon` below is a key into
// src/ui/icons.jsx, so the app ships zero bitmap art and zero emoji.
// ============================================================

export const APP = { name: 'ScratchVerse', tag: 'premium scratch arcade', version: '2.0.0', db: 2 };

export const START_BALANCE = 15;
export const MONEY_CAP = 1e15;

export const XP_PER_LEVEL = 10;
export const xpNeed = lvl => Math.round(45 * Math.pow(lvl, 1.55));

/* ---------- tickets ----------
   win:  'match3' | 'any' | 'instant' | 'final'
   syms: [{ e: <iconKey>, w, pay, neg?, jack?, super? }]   (pay = ticket-price multiples)
   hazard:{ sym, at } -> revealing >= at of hazard cells fires a penalty
   maxWin: 0 = unlimited
------------------------------------------------------------ */
export const CATALOGS = [
  { id: 1, name: 'Corner Shop', color: '#cbb488', blurb: 'cheap, steady, forgiving' },
  { id: 2, name: 'Neon Arcade', color: '#79d8c4', blurb: 'bigger swings, real penalties' },
  { id: 3, name: 'Vault Tier', color: '#e8c88a', blurb: 'jackpots & progressive pools' },
  { id: 4, name: 'Midnight Market', color: '#c1a6ff', blurb: 'unstable. legendary. read the odds' },
];
const CAT = Object.fromEntries(CATALOGS.map(c => [c.id, c]));

export const TICKETS = [
  // ——— Catalogue 1
  {
    id: 'twowin',
    cat: 1,
    name: 'Two Win',
    price: 25,
    win: 'any',
    need: 2,
    hardness: 1,
    tag: 'beginner',
    blurb: 'Two matching coins is enough. The safest card in the shop.',
    motif: 'coin',
    foil: 'gold',
    syms: [
      { e: 'coin', w: 12, pay: 0.461 },
      { e: 'cash', w: 10, pay: 0.692 },
      { e: 'cherry', w: 7, pay: 1.16 },
      { e: 'bell', w: 4, pay: 2.01 },
      { e: 'sparkle', w: 2, pay: 5.76 },
    ],
  },
  {
    id: 'miniscratch',
    cat: 1,
    name: 'Mini Scratch',
    price: 150,
    win: 'match3',
    need: 3,
    hardness: 1,
    tag: 'classic',
    blurb: 'Match three. The one everybody learns on.',
    motif: 'cherry',
    foil: 'gold',
    syms: [
      { e: 'none', w: 10, pay: 0.0196 },
      { e: 'cherry', w: 8, pay: 0.0496 },
      { e: 'cash', w: 6, pay: 0.983 },
      { e: 'pot', w: 4, pay: 0.496 },
      { e: 'gem', w: 3, pay: 2.48 },
      { e: 'clover', w: 1, pay: 24.8, special: true },
    ],
  },
  {
    id: 'appletree',
    cat: 1,
    name: 'Apple Tree',
    price: 900,
    win: 'instant',
    hardness: 1,
    tag: 'steady',
    blurb: 'Every cell pays. Scratch all 9 or stop early and toss it.',
    motif: 'tree',
    foil: 'gold',
    syms: [
      { e: 'apple', w: 24, pay: 0.179 },
      { e: 'leaf', w: 12, pay: 0.297 },
      { e: 'coin', w: 6, pay: 0.743 },
      { e: 'bag', w: 3, pay: -0.4, neg: true },
    ],
  },
  // ——— Catalogue 2
  {
    id: 'quickcash',
    cat: 2,
    name: 'Quick Cash',
    price: 7500,
    win: 'match3',
    need: 3,
    hardness: 2,
    tag: 'swing',
    blurb: 'Hardness 2 coating. Bigger payouts, but you pay for the peek.',
    motif: 'cash',
    foil: 'gold',
    syms: [
      { e: 'cash', w: 12, pay: 0.0709 },
      { e: 'pot', w: 8, pay: 0.0928 },
      { e: 'bolt', w: 5, pay: 0.796 },
      { e: 'gem', w: 4, pay: 2.6 },
      { e: 'crown', w: 2, pay: 11.9 },
      { e: 'bag', w: 1, pay: -0.75, neg: true },
    ],
  },
  {
    id: 'seaturtle',
    cat: 2,
    name: 'Sea Turtle',
    price: 30000,
    win: 'instant',
    hardness: 2,
    tag: 'trap',
    hazard: { at: 0.67 },
    blurb: 'Careful — dig too deep into the shells and you surface plastic bags.',
    motif: 'turtle',
    foil: 'gold',
    syms: [
      { e: 'turtle', w: 24, pay: 0.0256 },
      { e: 'shell', w: 12, pay: 0.0448 },
      { e: 'gem', w: 6, pay: 0.157 },
      { e: 'crown', w: 3, pay: 1.49 },
      { e: 'bag', w: 2, pay: 0.0321, hazard: true },
    ],
  },
  {
    id: 'snakeeyes',
    cat: 2,
    name: 'Snake Eyes',
    price: 120000,
    win: 'match3',
    need: 3,
    hardness: 3,
    tag: 'risk',
    blurb: 'Pay 2 on snakes — but a pair of snakes with no match bites for 2× the price.',
    motif: 'snake',
    foil: 'platinum',
    syms: [
      { e: 'slot', w: 10, pay: 0.165 },
      { e: 'pot', w: 8, pay: 0.191 },
      { e: 'snake', w: 5, pay: 0.197, hazard: true },
      { e: 'gem', w: 4, pay: 5.35 },
      { e: 'crown', w: 3, pay: 4.87 },
      { e: 'skull', w: 2, pay: -1.2, neg: true },
    ],
  },
  // ——— Catalogue 3
  {
    id: 'luckycat',
    cat: 3,
    name: 'Lucky Cat',
    price: 900000,
    win: 'any',
    need: 3,
    hardness: 2,
    tag: 'progressive',
    progressive: { rate: 0.012, seed: 120000 },
    blurb: 'Three cats or more = the whole progressive pot, plus it grows every ticket you buy.',
    motif: 'cat',
    foil: 'gold',
    syms: [
      { e: 'cat', w: 6, pay: 0.0334 },
      { e: 'pot', w: 8, pay: 0.0886 },
      { e: 'medal', w: 6, pay: 0.222 },
      { e: 'gem', w: 4, pay: 2.49 },
      { e: 'clover', w: 3, pay: 2.51 },
      { e: 'sparkle', w: 1, pay: 22.2, special: true },
    ],
  },
  {
    id: 'goldrush',
    cat: 3,
    name: 'Gold Rush',
    price: 6500000,
    win: 'instant',
    hardness: 3,
    tag: 'grind',
    blurb: 'Nine cells of raw gold. Every dig pays, occasionally one pays 60×.',
    motif: 'pot',
    foil: 'gold',
    syms: [
      { e: 'coin', w: 24, pay: 0.0635 },
      { e: 'medal', w: 12, pay: 0.11 },
      { e: 'gem', w: 6, pay: 0.288 },
      { e: 'target', w: 3, pay: 0.635 },
    ],
  },
  {
    id: 'megajack',
    cat: 3,
    name: 'Mega Jackpot',
    price: 60000000,
    win: 'match3',
    need: 3,
    hardness: 4,
    tag: 'jackpot',
    super: { chance: 0.004, jp: 25, pay: 12000 },
    blurb: 'SUPER JACKPOT: Mundo parks this one on the Sticky Mat for you, never scratches it.',
    motif: 'target',
    foil: 'gold',
    maxWin: 0,
    syms: [
      { e: 'pot', w: 10, pay: 0.0424 },
      { e: 'gem', w: 7, pay: 1.25 },
      { e: 'clover', w: 5, pay: 0.354 },
      { e: 'crown', w: 3, pay: 2.13 },
      { e: 'target', w: 2, pay: 9.15 },
      { e: 'bag', w: 1, pay: -0.6, neg: true },
      { e: 'sparkle', w: 0.15, pay: 0, super: true, special: true },
    ],
  },
  // ——— Catalogue 4
  {
    id: 'sanddollars',
    cat: 4,
    name: 'Sand Dollars',
    price: 750000000,
    win: 'match3',
    need: 3,
    hardness: 3,
    tag: 'deep',
    hazard: { at: 0.34 },
    blurb: 'Beach money. Dig past the shells and the tide takes 40% of the price back.',
    motif: 'palm',
    foil: 'rose',
    syms: [
      { e: 'shell', w: 20, pay: 0.166 },
      { e: 'palm', w: 10, pay: 0.332 },
      { e: 'cash', w: 6, pay: 1.1 },
      { e: 'gem', w: 4, pay: 3.06 },
      { e: 'crown', w: 2, pay: 13.9 },
      { e: 'bag', w: 2, pay: 0.059, neg: true, hazard: true },
    ],
  },
  {
    id: 'mystery',
    cat: 4,
    name: 'Mystery Box',
    price: 9000000000,
    win: 'instant',
    hardness: 4,
    tag: 'volatile',
    blurb: 'Blind multipliers per cell — could pay 15× the price, could eat 60% of it.',
    motif: 'box',
    foil: 'neon',
    syms: [
      { e: 'question', w: 18, pay: 0.0152 },
      { e: 'orb', w: 14, pay: 0.122 },
      { e: 'gem', w: 9, pay: 0.378 },
      { e: 'bolt', w: 5, pay: 0.91 },
      { e: 'skull', w: 10, pay: -0.6, neg: true },
    ],
  },
  {
    id: 'booster',
    cat: 4,
    name: 'Booster Pack',
    price: 120000000000,
    win: 'any',
    need: 4,
    hardness: 4,
    tag: 'endgame',
    progressive: { rate: 0.02, seed: 0 },
    blurb: 'Four matches and a second progressive pool. This is where runs are made.',
    motif: 'rocket',
    foil: 'platinum',
    syms: [
      { e: 'rocket', w: 6, pay: 0.0217 },
      { e: 'bolt', w: 7, pay: 0.058 },
      { e: 'gem', w: 5, pay: 0.183 },
      { e: 'trophy', w: 4, pay: 0.653 },
      { e: 'crown', w: 3, pay: 2.9 },
      { e: 'clover', w: 2, pay: 14.7 },
      { e: 'skull', w: 7, pay: -1.4, neg: true },
    ],
  },
  {
    id: 'final',
    cat: 4,
    name: 'Final Chance',
    price: 1e13,
    win: 'final',
    hardness: 4,
    jpCost: 5,
    tag: 'story',
    maxWin: 0,
    blurb: 'Costs 5 JP + 10T. Win everything — then the Corporation calls, and you must choose.',
    motif: 'monolith',
    foil: 'platinum',
    syms: [
      { e: 'question', w: 5, pay: 0.2 },
      { e: 'gem', w: 7, pay: 1.6 },
      { e: 'bolt', w: 8, pay: 5 },
      { e: 'skull', w: 6, pay: -0.5, neg: true },
      { e: 'pot', w: 5, pay: 12 },
      { e: 'void', w: 2, pay: 0, final: true, special: true },
    ],
  },
].map(t => ({ ...t, tint: CAT[t.cat].color, catName: CAT[t.cat].name }));

export const TICKET_BY_ID = Object.fromEntries(TICKETS.map(t => [t.id, t]));
export const ticketsInCat = c => TICKETS.filter(t => t.cat === c);
export const unlockGate = t => Math.round(t.price * 1.2); // lifetime earnings needed
export const winChanceOf = t => t.syms.reduce((a, s) => a + s.w, 0) / 100;

/* ---------- scratch tools (the coin you scratch with) ---------- */
export const COINS = [
  { id: 'penny', name: 'Penny', r: 0.1, gate: 0, v: 1 },
  { id: 'nickel', name: 'Nickel', r: 0.126, gate: 1500, v: 5 },
  { id: 'dime', name: 'Dime', r: 0.155, gate: 60000, v: 10 },
  { id: 'quarter', name: 'Quarter', r: 0.19, gate: 2500000, v: 25 },
  { id: 'halfdollar', name: 'Half Dollar', r: 0.235, gate: 900000000, v: 50 },
];

/* ---------- run upgrades (bought with money, reset on prestige) ---------- */
export const UPGRADES = [
  {
    id: 'luck',
    name: 'Scratch Luck',
    icon: 'clover',
    max: 25,
    base: 180,
    k: 1.9,
    desc: '+3.2% win chance on every ticket',
    stat: l => `win chance +${(l * 3.2).toFixed(1)}%`,
  },
  {
    id: 'size',
    name: 'Scratch Size',
    icon: 'level',
    max: 12,
    base: 220,
    k: 2.05,
    desc: '+7% brush radius — cover the card faster',
    stat: l => `brush +${l * 7}%`,
  },
  {
    id: 'coin',
    name: 'Iron Coin',
    icon: 'coin',
    max: 6,
    base: 900,
    k: 2.6,
    desc: 'Coating strength 10→1: each dig reveals more',
    stat: l => `strength ${10 - l}`,
  },
  {
    id: 'payout',
    name: 'Golden Payout',
    icon: 'pot',
    max: 20,
    base: 4000,
    k: 2.2,
    desc: '+11% winnings on every card',
    stat: l => `payout +${l * 11}%`,
  },
  {
    id: 'toss',
    name: 'Refund Clerk',
    icon: 'trash',
    max: 5,
    base: 1200,
    k: 2.3,
    desc: 'Better money back when you toss an unrevealed ticket',
    stat: l => `toss refund ${40 + l * 6}%`,
  },
  {
    id: 'job',
    name: 'Sink Polish',
    icon: 'sponge',
    max: 8,
    base: 260,
    k: 2.4,
    desc: 'Day-job plates pay more, and break less often',
    stat: l => `${10 - l}% break chance`,
  },
];
export const upCost = (u, l) => Math.round(u.base * Math.pow(u.k, l));

/* ---------- gadgets (the machine) ---------- */
export const GADGETS = [
  {
    id: 'bot',
    name: 'Scratch Bot',
    icon: 'bot',
    max: 5,
    base: 1400,
    k: 2.4,
    costMode: 'run',
    desc: 'Scratches the table ticket for you. It never peeks and never avoids traps.',
    stat: l => `speed ${(l * 2.6).toFixed(1)}×`,
  },
  {
    id: 'fan',
    name: 'Fan',
    icon: 'fan',
    max: 3,
    base: 6000,
    k: 3,
    costMode: 'run',
    desc: 'Blows tickets from the tray onto the table so the bot never starves.',
    stat: l => (l ? `auto-feed ${['off', 'slow', 'steady', 'storm'][l]}` : 'inactive'),
  },
  {
    id: 'mat',
    name: 'Sticky Mat',
    icon: 'mat',
    max: 1,
    base: 15000,
    k: 2,
    costMode: 'run',
    desc: 'Pin tickets here — the Fan and the Bot will not touch them.',
    stat: l => (l ? 'holds 3 tickets' : 'locked'),
  },
  {
    id: 'mundo',
    name: 'Mundo',
    icon: 'catface',
    max: 3,
    base: 40000,
    k: 2.6,
    costMode: 'run',
    desc: 'The cat claims resolved tickets automatically and parks super jackpots on the mat.',
    stat: l => (l ? `claims every ${(3.2 - l * 0.6).toFixed(1)}s` : 'manual claim'),
  },
  {
    id: 'auto',
    name: 'Autobuyer',
    icon: 'cart',
    max: 3,
    base: 120000,
    k: 2.8,
    costMode: 'run',
    desc: 'Re-buys your selected ticket as the tray empties. Keeps a reserve.',
    stat: l => `${l}× qty per buy`,
  },
  {
    id: 'egg',
    name: 'Egg Timer',
    icon: 'timer',
    max: 4,
    base: 900000,
    k: 3.2,
    costMode: 'run',
    desc: 'Crank it: every gadget (except the Machine) runs faster for a while.',
    stat: l => `${18 + l * 6}s boost · ×${(1.6 + l * 0.25).toFixed(2)}`,
  },
  {
    id: 'spell',
    name: 'Spellbook',
    icon: 'book',
    max: 5,
    base: 2500000,
    k: 2.5,
    costMode: 'run',
    desc: 'Instantly finishes the table ticket — works even on super jackpots.',
    stat: l => `${2 + l} charges / day`,
  },
  {
    id: 'machine',
    name: 'The Machine',
    icon: 'machine',
    max: 4,
    base: 5e8,
    k: 3.4,
    costMode: 'run',
    desc: 'Late-game engine: +35% payouts per level and refunds 15% of every loss.',
    stat: l => (l ? `payout +${l * 35}% · loss refund ${l * 15}%` : 'dormant'),
    gateJP: 2,
  },
];
export const GATE_MAX = { mat: 1, mundo: 3, egg: 4, machine: 4 };
export const gdCost = (g, l) => Math.round(g.base * Math.pow(g.k, l));

/* ---------- prestige ---------- */
export const PRESTIGE_BASE = 2.5e7;
export const jpFrom = runEarn => (runEarn < PRESTIGE_BASE ? 0 : Math.floor(3 * Math.pow(runEarn / PRESTIGE_BASE, 0.55)));
export const JP_NODES = [
  {
    id: 'seed',
    name: 'Rich Seed',
    jp: 1,
    max: 4,
    icon: 'cash',
    desc: 'Start each run with more money.',
    stat: l => `${[100, 2500, 120000, 6e6][l - 1] ?? ''} seed`,
  },
  {
    id: 'core',
    name: 'Lucky Core',
    jp: 2,
    max: 5,
    icon: 'clover',
    desc: 'Permanent +5% win chance per level.',
    stat: l => `+${l * 5}% win chance`,
  },
  {
    id: 'mech',
    name: 'Oiled Gears',
    jp: 3,
    max: 1,
    icon: 'gear',
    desc: 'Gadgets keep level 1 after you prestige.',
    stat: () => 'keeps bot lvl 1',
  },
  {
    id: 'haz',
    name: 'Hazard Shield',
    jp: 4,
    max: 1,
    icon: 'shield',
    desc: 'Penalty cells (plastic bags, snake bites) can never hurt you.',
    stat: () => 'hazards disabled',
  },
  {
    id: 'midas',
    name: 'Midas Ink',
    jp: 5,
    max: 4,
    icon: 'pen',
    desc: 'Printed payouts are +15% per level, forever.',
    stat: l => `+${l * 15}% payout`,
  },
  {
    id: 'scribe',
    name: 'Scribe Pact',
    jp: 2,
    max: 1,
    icon: 'book',
    desc: 'Spellbook charges refill 2× faster.',
    stat: () => 'daily refill ×2',
  },
  {
    id: 'echo',
    name: 'Jack Echo',
    jp: 6,
    max: 1,
    icon: 'deck',
    desc: 'Super jackpots also hand you +1 Jack Point.',
    stat: () => '+1 JP per super win',
  },
];
export const nodeCost = (n, l) => n.jp * (l + 1);

/* ---------- achievements -> tokens ---------- */
export const ACHIEVEMENTS = [
  {
    id: 'first',
    name: 'First Blood',
    icon: 'scratch',
    tok: 1,
    desc: 'Scratch your first ticket',
    test: s => s.stats.scratched >= 1,
  },
  { id: 'ten', name: 'Warm Fingers', icon: 'hand', tok: 1, desc: 'Scratch 25 tickets', test: s => s.stats.scratched >= 25 },
  {
    id: 'job',
    name: 'Employee of the Month',
    icon: 'sponge',
    tok: 1,
    desc: 'Wash 50 plates at the day job',
    test: s => s.stats.plates >= 50,
  },
  { id: 'win10', name: 'Lucky Streak', icon: 'clover', tok: 2, desc: 'Win 10 tickets in total', test: s => s.stats.wins >= 10 },
  {
    id: 'streak3',
    name: 'Triple Trouble',
    icon: 'three',
    tok: 2,
    desc: 'Win 3 tickets in a row',
    test: s => s.stats.bestStreak >= 3,
  },
  {
    id: 'spend1',
    name: 'High Roller',
    icon: 'chip',
    tok: 2,
    desc: 'Spend 1M on tickets',
    test: s => s.run.spent + s.lifetime.spent >= 1e6,
  },
  { id: 'bot', name: 'Delegator', icon: 'bot', tok: 1, desc: 'Buy the Scratch Bot', test: s => s.gadgets.bot.lvl >= 1 },
  {
    id: 'full',
    name: 'Please Take One Each',
    icon: 'deck',
    tok: 3,
    desc: 'Own one ticket from every catalogue',
    test: s => Object.values(s.owned).filter(n => n > 0).length >= 12,
  },
  { id: 'sup', name: 'SUPER!!', icon: 'crown', tok: 4, desc: 'Hit a Super Jackpot', test: s => s.stats.supers >= 1 },
  { id: 'pres1', name: 'Fresh Start', icon: 'refresh', tok: 2, desc: 'Prestige once', test: s => s.runs >= 2 },
  { id: 'jp10', name: 'Point Collector', icon: 'gem', tok: 3, desc: 'Bank 10 JP total', test: s => s.lifetime.jp >= 10 },
  {
    id: 'end',
    name: 'Faithful Servant',
    icon: 'monolith',
    tok: 8,
    desc: 'Get the secret ending',
    test: s => (s.endings || []).includes('faithful'),
  },
];

/* ---------- Night Market (tokens + coin cosmetics) ---------- */
export const SKINS = [
  { id: 'gold', name: 'Ivory Deckle', foil: 'gold', tok: 0, coin: 0, note: 'the house stock, warm white' },
  { id: 'rose', name: 'Rose Wash', foil: 'rose', tok: 3, coin: 25000, note: 'blush cotton, copper ink' },
  { id: 'neon', name: 'Ice Laid', foil: 'neon', tok: 6, coin: 5e6, note: 'cool laid paper, teal ink' },
  { id: 'platinum', name: 'Pressed Platinum', foil: 'platinum', tok: 10, coin: 5e8, note: 'bright white, silver ink' },
];
export const MATS = [
  { id: 'noir', name: 'Pure Noir', tok: 0, note: 'matte black, default' },
  { id: 'oxblood', name: 'Oxblood Felt', tok: 0, note: 'deep red house felt' },
  { id: 'emerald', name: 'Emerald Felt', tok: 2, note: 'casino green' },
  { id: 'graphite', name: 'Graphite Desk', tok: 4, note: 'fine milled grain' },
  { id: 'platinum', name: 'Platinum Rail', tok: 8, note: 'cold metal table' },
];

/* ---------- balance targets (used by scripts/tune.mjs + tests) ----------
   expected gross return as a multiple of ticket price. 'final' is a story ticket. */
export const EV_TARGET = {
  twowin: 0.88,
  miniscratch: 0.87,
  appletree: 0.9,
  quickcash: 0.86,
  seaturtle: 0.84,
  snakeeyes: 0.83,
  luckycat: 0.86,
  goldrush: 0.9,
  megajack: 0.84,
  sanddollars: 0.85,
  mystery: 0.8,
  booster: 0.82,
};

/* ---------- pity / fairness ---------- */
export const PITY = { need: 14, mult: 2.2 }; // 14 straight losses -> next win pays >= 2.2×
export const AUTO_AT = 0.55; // auto-complete at 55% coverage
export const HARDNESS_DAB = [0, 0.9, 0.72, 0.58, 0.46]; // coverage per dab by hardness

/* ---------- day job ---------- */
export const platePay = s => Math.max(1, Math.round(1 * Math.pow(1.75, s.upg.job || 0) * (1 + Math.log10(1 + s.lifetime.earn))));
export const plateBreak = s => Math.max(0.02, 0.1 - 0.01 * (s.upg.job || 0));

/* ---------- endings ---------- */
export const ENDINGS = {
  claim: {
    name: 'The Payout',
    icon: 'briefcase',
    desc: 'You grabbed the briefcase. The money is real, the fine print is longer.',
    coin: 1e14,
    jp: 0,
    badge: 'Sold',
  },
  walk: {
    name: 'Walk Away',
    icon: 'door',
    desc: 'You hung up, kept the ticket and left the neon behind. Smart.',
    coin: 0,
    jp: 12,
    badge: 'Sane',
  },
  faithful: {
    name: 'Faithful Servant',
    icon: 'monolith',
    desc: 'You did not touch the mouse for a minute. Something collected the ticket for you.',
    coin: 5e13,
    jp: 25,
    badge: 'Faithful',
  },
};
