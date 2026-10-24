// 5★/6★ kits, keyed by the `effect` id in characters.js.
//
// Each skill has a `style`: how you use it with the mouse (see STYLES below).
//   click   – spam M1; the skill makes every click stronger
//   special – M2 (right-click / Q / the SPECIAL button) fires it, then a cooldown
//   charge  – tap M2 to stock up one charge; hold M2 or M1 for 1s to keep charging, let go to release
//   hold    – hold M1 to charge, let go to fire
//   drag    – hold M1 and drag across enemies
// Every skill also has a smaller always-on `passive` (with its own lv1 / si numbers).
//
// From LV1 you get a weaker
// version (the `lv1` numbers); at LV20 the skill reaches full strength.
// Ults (unlock at LV50) charge up from damage you deal and have a cooldown
// (the `cooldown` in characters.js, in seconds). Press E or tap the orb.
// `charge` scales how much damage the ult needs (1 = normal).
//
// Superimposition (S2–S5) makes each kit stronger — see `si` on each entry:
// every S level adds the `si` values once (S5 = base + 4× si).

export const SKILL_UNLOCK = 20;   // full-strength skill
export const ULT_UNLOCK   = 50;

export const SKILLS = {
  // ── CLICK: spam M1 ─────────────────────────────────────────────────────
  swag_strike:   { type: 'gun',       style: 'click', pct: 0.35, shots: 1,
                   lv1: { pct: 0.2 },
                   si: { pct: 0.08, shots: 0.5 },
                   desc: 'Every click also fires {shots} homing shot(s) at the nearest enemies for {pct} click DMG each, hit or miss. Spam it.',
                   passive: { type: 'extraShot', chance: 0.1, shots: 2, pct: 0.4,
                              lv1: { chance: 0.06 }, si: { chance: 0.02 },
                              desc: 'Clicks have a {chance} chance to fire {shots} extra shots for {pct} click DMG each.' } },
  reality_slice: { type: 'crit',      style: 'click', rate: 0.12, dmg: 0.8, cut: 0.2,
                   lv1: { rate: 0.06, dmg: 0.4, cut: 0.08 },
                   si: { rate: 0.03, dmg: 0.15, cut: 0.05 },
                   desc: '+{rate} crit rate and +{dmg} crit DMG. Every crit click also slices reality: a line through the target that hits every enemy on it for {cut} click DMG.',
                   passive: { type: 'critCharge', bonus: 0.5,
                              lv1: { bonus: 0.25 }, si: { bonus: 0.1 },
                              desc: 'Crits charge your ult {bonus} faster.' } },
  devour:        { type: 'devour',    style: 'click', pct: 0.04, maxBite: 0.8, healPctHp: 0.003,
                   lv1: { pct: 0.02, maxBite: 0.5, healPctHp: 0.0015 },
                   si: { pct: 0.01, maxBite: 0.1, healPctHp: 0.001 },
                   desc: "Clicks also bite off {pct} of the target's current HP (at most {maxBite} click DMG) and heal you for {healPctHp} max HP.",
                   passive: { type: 'killHeal', heal: 0.01,
                              lv1: { heal: 0.005 }, si: { heal: 0.002 },
                              desc: 'Kills heal you {heal} max HP.' } },
  ratio:         { type: 'ratio',     style: 'click', period: 1.0, window: 0.12, bonus: 1.5, critRateMod: -0.10,
                   lv1: { window: 0.09, bonus: 0.8 },
                   si: { window: 0.01, bonus: 0.25 },
                   desc: 'A 7:3 bar sits on the enemy under your cursor. Click when the red line crosses the mark ({window} window) for a guaranteed crit with +{bonus} crit DMG. Normal crit rate is 10% lower.',
                   passive: { type: 'ratioHeal', heal: 0.004,
                              lv1: { heal: 0.002 }, si: { heal: 0.001 },
                              desc: 'Ratio hits heal you {heal} max HP.' } },

  // ── SPECIAL: M2, then a cooldown ───────────────────────────────────────
  rock_shard:    { type: 'spike',     style: 'special', cooldown: 7, radius: 135, pct: 6, stun: 0.6,
                   lv1: { cooldown: 9, radius: 110, pct: 3 },
                   si: { cooldown: -0.5, radius: 12, pct: 1 },
                   desc: 'M2: rock spikes erupt under your cursor: {pct} click DMG in a {radius} radius and a {stun}s stun. {cooldown}s cooldown.',
                   passive: { type: 'shardProc', chance: 0.12, pct: 0.6, radius: 90,
                              lv1: { chance: 0.07, pct: 0.4 }, si: { chance: 0.02, pct: 0.1 },
                              desc: 'Clicks have a {chance} chance to burst into rock shards that hit enemies near the target for {pct} click DMG ({radius} range).' } },
  quantum_burst: { type: 'entangle',  style: 'special', cooldown: 8, links: 4, share: 0.35, dur: 6, range: 260,
                   lv1: { cooldown: 10, links: 3, share: 0.2, dur: 5 },
                   si: { cooldown: -0.5, links: 0.5, share: 0.05 },
                   desc: 'M2: Quantum Entanglement links the enemy nearest your cursor with up to {links} others nearby ({range} range) for {dur}s. {share} of the damage any of them takes is copied onto all the others. {cooldown}s cooldown.',
                   passive: { type: 'pulseProc', chance: 0.08, pct: 0.8, radius: 90,
                              lv1: { chance: 0.05, pct: 0.5 }, si: { chance: 0.015, pct: 0.15 },
                              desc: 'Clicks have a {chance} chance to set off a small quantum pulse at your cursor: {pct} click DMG ({radius} range).' } },
  infinity:      { type: 'repel',     style: 'special', cooldown: 6, radius: 160, crush: 5,
                   lv1: { cooldown: 9, radius: 120, crush: 3 },
                   si: { cooldown: -0.5, radius: 10, crush: 0.4 },
                   desc: 'M2: Infinity repels everything within {radius} of your cursor. Slam them into a wall to CRUSH them for {crush} click DMG, or into another enemy to hurt both. Bosses are too heavy to move and take half. {cooldown}s cooldown.',
                   passive: { type: 'infinity', radius: 75,
                              lv1: { radius: 55 }, si: { radius: 8 },
                              desc: "Infinity: a {radius} bubble around your cursor slows enemy shots to a crawl and stops dashes and the worm's bite (blocking drains it; it refills when nothing hits it)." } },
  lava:          { type: 'eruption',  style: 'special', cooldown: 9, radius: 115, pct: 2.5, dps: 0.6, dur: 5,
                   lv1: { cooldown: 11, radius: 95, pct: 1.4, dps: 0.35, dur: 4 },
                   si: { cooldown: -0.5, pct: 0.4, dps: 0.1, dur: 0.5 },
                   desc: 'M2: an eruption under your cursor hits for {pct} click DMG ({radius} range) and leaves a lava pool for {dur}s that burns for {dps} click DMG per second. {cooldown}s cooldown.',
                   passive: { type: 'lavaKill', chance: 0.15, radius: 50, dur: 3, dps: 0.25,
                              lv1: { chance: 0.08 }, si: { chance: 0.03, dps: 0.05 },
                              desc: 'Kills have a {chance} chance to leave a lava puddle ({radius} range, {dur}s) that burns for {dps} click DMG per second.' } },
  shadows:       { type: 'dogs',      style: 'special', cooldown: 12, pct: 0.7, dur: 10,
                   lv1: { cooldown: 15, pct: 0.35, dur: 8 },
                   si: { cooldown: -0.5, pct: 0.1, dur: 1 },
                   desc: 'M2: summons two Divine Dogs for {dur}s that hunt enemies for {pct} click DMG a bite. {cooldown}s cooldown.',
                   passive: { type: 'shadows', chance: 0.06, pct: 0.6,
                              lv1: { chance: 0.03, pct: 0.3 }, si: { chance: 0.01, pct: 0.08 },
                              desc: 'Kills have a {chance} chance to summon a shikigami: a Toad that eats the next hit on you, or Nue (hits for {pct} click DMG).' } },

  // ── CHARGE: spam M2 to charge, M1 fires ────────────────────────────────
  souls:         { type: 'souls',     style: 'charge', cap: 20, throwPct: 0.62,
                   lv1: { cap: 12, throwPct: 0.4 },
                   si: { cap: 2.5, throwPct: 0.09 },
                   rate: 10,
                   desc: 'Tap M2 to summon a cursed spirit (up to {cap}). Hold M2 (or M1) for 1s to keep summoning, then let go to hurl them all at your cursor: {throwPct} click DMG per spirit to the enemy you aim at, a third of that to everything around it.',
                   passive: { type: 'spirits', chance: 0.3,
                              lv1: { chance: 0.18 }, si: { chance: 0.05 },
                              desc: 'Kills have a {chance} chance to add a cursed spirit to your stock (elites always add 3).' } },
  transfig:      { type: 'crawlers',  style: 'charge', cap: 8, pct: 0.95, radius: 55,
                   lv1: { cap: 5, pct: 0.6 },
                   si: { cap: 0.5, pct: 0.15 },
                   rate: 6,
                   desc: 'Tap M2 to transfigure a crawler (up to {cap}). Hold M2 (or M1) for 1s to keep transfiguring, then let go to set them all loose at the enemies around your cursor: each explodes for {pct} click DMG ({radius} range).',
                   passive: { type: 'transfig', chance: 0.08, pct: 1.0, radius: 60,
                              lv1: { chance: 0.05, pct: 0.6 }, si: { chance: 0.015, pct: 0.15 },
                              desc: 'Kills have a {chance} chance to turn into a crawler that runs at an enemy and explodes for {pct} click DMG. Killed elites always turn.' } },
  copy:          { type: 'platinum',  style: 'charge', cap: 12, pct: 1.1,
                   lv1: { cap: 8, pct: 0.7 },
                   si: { cap: 1, pct: 0.17 },
                   rate: 6,
                   desc: 'Tap M2 to wind up a punch (up to {cap}). Hold M2 (or M1) for 1s to keep winding up, then let go to unleash them all on the enemy nearest your cursor: {pct} click DMG per punch. ORA!',
                   passive: { type: 'copy', every: 20,
                              lv1: { every: 30 }, si: { every: -2 },
                              desc: "Copies another 5★ agent's passive and switches to a new one every {every}s." } },

  // ── HOLD: hold M1, release to fire ─────────────────────────────────────
  frost_bolt:    { type: 'lance',     style: 'hold', full: 1.2, minPct: 2.5, pct: 10, width: 50, freeze: 1.5,
                   lv1: { minPct: 1.4, pct: 5.5, freeze: 1 },
                   si: { pct: 1.6, freeze: 0.25, width: 6 },
                   desc: 'Hold M1 to charge (full in {full}s), release: an ice lance from you through your cursor hits everything on its line for up to {pct} click DMG (35% less for each enemy it has already gone through) and freezes it for {freeze}s.',
                   passive: { type: 'frost', chance: 0.06, dur: 1, bonus: 0.2,
                              lv1: { chance: 0.03, bonus: 0.1 }, si: { chance: 0.015, bonus: 0.04 },
                              desc: 'Clicks have a {chance} chance to freeze an enemy for {dur}s. Frozen enemies take +{bonus} DMG.' } },
  healing_tide:  { type: 'wave',      style: 'hold', full: 1.2, minPct: 1.8, radius: 175, pct: 8, heal: 0.03, maxHeal: 0.15,
                   lv1: { minPct: 1, radius: 140, pct: 4.4, heal: 0.02, maxHeal: 0.1 },
                   si: { radius: 10, pct: 1.3, heal: 0.004, maxHeal: 0.02 },
                   desc: 'Hold M1 to gather a tide at your cursor (full in {full}s), release: the wave hits the enemy nearest your cursor for up to {pct} click DMG and everything else within up to {radius} for 40% of that, and heals you {heal} max HP per enemy hit (up to {maxHeal}).',
                   passive: { type: 'lifesteal', pctHp: 0.001, pct: 0.008, maxPctHp: 0.004,
                              lv1: { pct: 0.004, maxPctHp: 0.002 }, si: { pct: 0.003, maxPctHp: 0.0015 },
                              desc: 'Clicks heal you a little: 0.1% max HP + {pct} of the damage dealt (up to {maxPctHp} max HP per click).' } },
  phantom:       { type: 'flashstep', style: 'hold', full: 1.0, targets: 5, minPct: 0.6, pct: 1.7, range: 320,
                   lv1: { targets: 3, minPct: 0.35, pct: 1.0 },
                   si: { targets: 0.5, pct: 0.28 },
                   desc: 'Hold M1 to charge (full in {full}s), release: {targets} flash-step strikes on the nearest enemies around your cursor ({range} range), up to {pct} click DMG each. Fewer enemies = more strikes on each.',
                   passive: { type: 'phantom', lag: 0.3,
                              lv1: { lag: 0.2 }, si: { lag: 0.03 },
                              desc: 'No cursed energy: enemies aim where your cursor was {lag}s ago.' } },

  // ── DRAG: hold M1 and drag ─────────────────────────────────────────────
  firetrail:     { type: 'firetrail', style: 'drag', slash: 3.0, pct: 0.5, dur: 1.6,
                   lv1: { slash: 1.8, pct: 0.25, dur: 1.0 },
                   si: { slash: 0.45, pct: 0.1, dur: 0.2 },
                   desc: 'Hold M1 and drag: Dismantle cuts every enemy your cursor passes through for {slash} click DMG and leaves a fire wall for {dur}s that burns for {pct} click DMG per second and stops enemy shots.',
                   passive: { type: 'ignite', chance: 0.1, dps: 0.4, dur: 3,
                              lv1: { chance: 0.06, dps: 0.25 }, si: { chance: 0.02, dps: 0.08 },
                              desc: 'Clicks have a {chance} chance to set the target on fire: {dps} click DMG per second for {dur}s.' } },
};

// How each style is used, for the UI (main screen, Deck, Records)
export const STYLES = {
  click:   { name: 'CLICK',  how: 'Spam M1',                         phone: 'Spam taps',                         color: '#facc15' },
  special: { name: 'SPECIAL', how: 'M2 (right-click) or Q',          phone: 'The SPECIAL button',                color: '#a78bfa' },
  charge:  { name: 'CHARGE', how: 'Tap M2 to stock up · hold M1 or M2 for 1s to charge, let go to release', phone: 'Tap SPECIAL to stock up · hold anywhere 1s to charge, let go to release', color: '#e879f9' },
  hold:    { name: 'HOLD',   how: 'Hold M1, release to fire',        phone: 'Hold, let go to fire',              color: '#67e8f9' },
  drag:    { name: 'DRAG',   how: 'Hold M1 and drag',                phone: 'Hold and drag',                     color: '#fb923c' },
};

export const ULTS = {
  tectonic_wrath: { type: 'nuke',      mult: 60, charge: 1,
                    si: { mult: 6 },
                    desc: 'Rock spires hit every enemy for {mult} click DMG.' },
  black_hole:     { type: 'blackhole', mult: 55, stun: 3, charge: 1,
                    si: { mult: 5, stun: 0.5 },
                    desc: 'Pulls every enemy into the centre, stuns them for {stun}s and deals {mult} click DMG.' },
  swag_mode:      { type: 'transform', dur: 10, clickMult: 1.4, autoClicks: 3, charge: 1,
                    si: { dur: 1.5, clickMult: 0.3 },
                    desc: 'SWAG MODE for {dur}s: {clickMult}× click DMG and {autoClicks} automatic clicks per second.' },
  permafrost:     { type: 'timestop',  dur: 6, mult: 55, charge: 1,
                    si: { dur: 1, mult: 5 },
                    desc: 'Stops time for {dur}s — every attack is cancelled — and deals {mult} click DMG to all enemies.' },
  tidal_surge:    { type: 'surge',     mult: 45, coins: 30, charge: 1,
                    si: { mult: 4, coins: 10 },
                    desc: 'Deals {mult} click DMG to all enemies, fully heals you and drops a pile of coins.' },
  reality_break:  { type: 'execute',   dur: 3, mult: 60, threshold: 0.2, charge: 1,
                    si: { mult: 8, threshold: 0.04 },
                    desc: 'Stops time for {dur}s, hits the strongest enemy for {mult} click DMG and executes non-bosses under {threshold} HP.' },
  hox:            { type: 'hox',       bossPct: 0.2, charge: 1.6,
                    si: { bossPct: 0.04 },
                    desc: "Eats every non-boss enemy, bites {bossPct} of the boss's max HP and fully heals you." },

  // ── Anemic Kaisen ──────────────────────────────────────────────────────
  overtime:        { type: 'overtime',   dur: 8, mult: 1, collapse: 12, charge: 1,
                     si: { dur: 1, collapse: 2 },
                     desc: 'OVERTIME for {dur}s: every click is a ratio hit (a guaranteed crit with bonus crit DMG). When it ends, Collapse hits every enemy for {collapse} click DMG.' },
  distortion:      { type: 'distortion', dur: 10, slashes: 3, mult: 0.42, charge: 1,
                     si: { dur: 1, mult: 0.07 },
                     desc: 'For {dur}s every click also fires {slashes} slashes through your cursor at random angles, each hitting everything on its line for {mult} click DMG.' },
  meteor:          { type: 'meteor',     mult: 65, radius: 170, charge: 1,
                     si: { mult: 7, radius: 10 },
                     desc: 'Maximum: Meteor drops on your cursor after a short warning: {mult} click DMG in a {radius} radius, then leaves a huge lava field.' },
  fuga:            { type: 'fuga',       mult: 65, burn: 12, charge: 1,
                     si: { mult: 7, burn: 2 },
                     desc: 'A fire arrow flies to the strongest enemy and explodes for {mult} click DMG, then the whole arena burns for {burn} click DMG.' },
  uzumaki:         { type: 'uzumaki',    base: 25, perSpirit: 1.5, min: 5, charge: 1,
                     si: { base: 3, perSpirit: 0.3 },
                     desc: 'Needs {min}+ spirits. Fires every spirit in a spiral: {base} click DMG to all enemies, plus {perSpirit} per spirit spent.' },
  hollow_purple:   { type: 'purple',     mult: 70, width: 90, charge: 1,
                     si: { mult: 10, width: 10 },
                     desc: 'Hollow Purple: a beam from you through your cursor, {mult} click DMG to everything in its path ({width} wide). Deletes enemy shots it touches.' },
  sorcerer_killer: { type: 'sorcerer',   dur: 8, speed: 5, mult: 1.5, pct: 0.8, threshold: 0.2, killsNeeded: 20, chargeOn: 'kills',
                     si: { dur: 1, pct: 0.06, threshold: 0.03 },
                     desc: 'Charges from kills ({killsNeeded} — elites count 3), not damage. For {dur}s you strike the nearest enemy 10 times a second for {pct} click DMG each and execute non-bosses under {threshold} HP.' },
  ora:             { type: 'ora',        dur: 45, punches: 10, pct: 0.6, charge: 1.3,
                     si: { punches: 1, pct: 0.05 },
                     desc: 'Pick 1 of 3 skills to use at full strength for {dur}s, with a punch barrage: {punches} punches a second for {pct} click DMG each.' },
  mahoraga:        { type: 'mahoraga',   hp: 2.5, mult: 10, charge: 1.4,
                     si: { hp: 0.4, mult: 1.3 },
                     desc: 'Summons Mahoraga ({hp}× your max HP, slams for {mult} click DMG). You are suspended and can only watch. It adapts to every attack that hits it, and its wheel turns every 6s, making it stronger. It must clear the field (boss included). If it dies, you die.' },
};

// Each S level after S1 also cuts the ult cooldown by this much (S5 = −32%)
export const ULT_CD_PER_SI = 0.08;

// How a number is shown in descriptions
const PCT_KEYS = new Set(['share', 'slash', 'cut', 'heal', 'maxHeal', 'pct', 'chance', 'bonus', 'rate', 'dmg', 'threshold', 'bossPct', 'maxPctHp', 'healPctHp',
  'window', 'dps', 'perSoul', 'autoPct']);
const MULT_KEYS = new Set(['maxBite', 'throwPct', 'minPct', 'mult', 'collapse', 'burn', 'base', 'perSpirit', 'crush']);
function showVal(key, v) {
  if (MULT_KEYS.has(key)) return `${Math.round(v * 100)}%`;
  if (PCT_KEYS.has(key)) return `${+(v * 100).toFixed(1)}%`;
  if (key === 'shots' || key === 'targets' || key === 'links') return String(Math.floor(v));
  if (key === 'every' || key === 'cap') return String(Math.round(v));
  if (key === 'cooldown') return String(+v.toFixed(1));
  return String(+v.toFixed(2));
}

// Skill before LV20: the weaker `lv1` numbers replace the base ones
export const weakKit = (kit) => (kit?.lv1 ? { ...kit, ...kit.lv1, weak: true } : kit?.passive ? { ...kit, weak: true } : kit);

// The kit at a given superimposition (si = 0 for S1 … 4 for S5)
export function scaleKit(kit, si = 0) {
  if (!kit) return kit;
  const out = { ...kit };
  const n = Math.max(0, Math.min(4, si));
  // weak (pre-LV20) skills still get their superimposition steps, at half size
  Object.entries(kit.si ?? {}).forEach(([k, step]) => { out[k] = kit[k] + step * n * (kit.weak ? 0.5 : 1); });
  if (out.shots) out.shots = Math.floor(out.shots);
  if (out.targets) out.targets = Math.floor(out.targets);
  // the passive scales the same way (and is weaker too before LV20)
  if (kit.passive) out.passive = scaleKit(kit.weak && kit.passive.lv1 ? { ...kit.passive, ...kit.passive.lv1, weak: true } : kit.passive, n);
  return out;
}

// Description with this superimposition's numbers filled in
export function describeKit(kit, si = 0) {
  if (!kit) return '';
  const k = scaleKit(kit, si);
  return kit.desc.replace(/\{(\w+)\}/g, (_, key) => (key in k ? showVal(key, k[key]) : key))
    // "{every}th" → 1st / 2nd / 3rd / 4th…
    .replace(/\b(\d+)th\b/g, (_, n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'));
}

// A skill's passive, with this superimposition's numbers (`weak` = before LV20)
export function describePassive(kit, si = 0, weak = false) {
  if (!kit?.passive) return '';
  const p = weak && kit.passive.lv1 ? { ...kit.passive, ...kit.passive.lv1, weak: true } : kit.passive;
  return describeKit(p, si);
}

// What a card's skill or ult does, with the real numbers (the `description` text in
// characters.js is older and can be out of date, so it's only the fallback)
export function abilityText(ability, si = 0) {
  if (!ability) return '';
  const kit = SKILLS[ability.effect] ?? ULTS[ability.effect];
  if (!kit) return ability.description ?? '';
  return describeKit(kit, si) + (kit.passive ? `\nPassive: ${describePassive(kit, si)}` : '');
}

// One line saying what the next superimposition improves, e.g. "range 110 → 128, DMG 50% → 62%"
const LABELS = { radius: 'range', pct: 'DMG', interval: 'every', shots: 'shots', chance: 'chance', dur: 'duration', bonus: 'bonus',
  rate: 'crit rate', dmg: 'crit DMG', mult: 'DMG', stun: 'stun', clickMult: 'click ×', coins: 'coins', threshold: 'execute',
  bossPct: 'boss bite', maxPctHp: 'max heal', healPctHp: 'heal',
  window: 'ratio window', dps: 'burn', cap: 'max spirits', perSoul: 'per spirit', lag: 'aim lag', autoPct: 'auto DMG',
  collapse: 'collapse', burn: 'burn', perSpirit: 'per spirit', cooldown: 'cooldown', links: 'links', share: 'shared', slash: 'cut', throwPct: 'throw', cut: 'slice', heal: 'heal', maxHeal: 'max heal', freeze: 'freeze', targets: 'targets', width: 'width', punches: 'punches/s', hp: 'HP', crush: 'crush' };
export function describeSiStep(kit, si) {
  if (!kit?.si || si >= 4) return '';
  const a = scaleKit(kit, si), b = scaleKit(kit, si + 1);
  return Object.keys(kit.si)
    .filter(k => showVal(k, a[k]) !== showVal(k, b[k]))
    .map(k => `${LABELS[k] ?? k} ${showVal(k, a[k])} → ${showVal(k, b[k])}`).join(', ');
}
