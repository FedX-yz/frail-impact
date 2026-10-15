// 5★/6★ kits, keyed by the `effect` id in characters.js.
//
// Skills are always-on upgrades to clicking. From LV1 you get a weaker
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
  rock_shard:    { type: 'splash',    radius: 110, pct: 0.5,
                   lv1: { radius: 85, pct: 0.25 },
                   si: { radius: 18, pct: 0.12 },
                   desc: 'Every click also sends rock shards into enemies near the target for {pct} click DMG ({radius} range).' },
  quantum_burst: { type: 'pulse',     interval: 2.5, radius: 120, pct: 1.5,
                   lv1: { interval: 3.5, radius: 95, pct: 0.75 },
                   si: { interval: -0.25, radius: 20, pct: 0.3 },
                   desc: 'Every {interval}s a quantum pulse at your cursor deals {pct} click DMG in a {radius} radius.' },
  swag_strike:   { type: 'gun',       pct: 1.0, shots: 1,
                   lv1: { pct: 0.5 },
                   si: { pct: 0.2, shots: 0.5 },
                   desc: 'Click empty space to fire {shots} homing shot(s) at the nearest enemies for {pct} click DMG each.' },
  frost_bolt:    { type: 'frost',     chance: 0.15, dur: 2, bonus: 0.3,
                   lv1: { chance: 0.07, dur: 1.2, bonus: 0.15 },
                   si: { chance: 0.04, dur: 0.4, bonus: 0.08 },
                   desc: 'Clicks have a {chance} chance to freeze an enemy for {dur}s. Frozen enemies take +{bonus} DMG.' },
  healing_tide:  { type: 'lifesteal', pctHp: 0.003, pct: 0.02, maxPctHp: 0.012,
                   lv1: { pct: 0.01, maxPctHp: 0.006 },
                   si: { pct: 0.008, maxPctHp: 0.004 },
                   desc: 'Clicks heal you for 0.3% max HP + {pct} of the damage dealt (up to {maxPctHp} max HP per click).' },
  reality_slice: { type: 'crit',      rate: 0.15, dmg: 1.0,
                   lv1: { rate: 0.07, dmg: 0.5 },
                   si: { rate: 0.04, dmg: 0.2 },
                   desc: '+{rate} crit rate and +{dmg} crit DMG.' },
  devour:        { type: 'devour',    pct: 0.04, healPctHp: 0.003,
                   lv1: { pct: 0.02, healPctHp: 0.0015 },
                   si: { pct: 0.01, healPctHp: 0.001 },
                   desc: "Clicks also bite off {pct} of the target's current HP and heal you for {healPctHp} max HP." },

  // ── Anemics Kaisen ──────────────────────────────────────────────────────
  // (how each one works in battle: combat/kitRuntime.js)
  ratio:     { type: 'ratio',     period: 1.0, window: 0.12, bonus: 1.5, critRateMod: -0.10,
               lv1: { window: 0.09, bonus: 0.8 },
               si: { window: 0.01, bonus: 0.25 },
               desc: 'A 7:3 bar sits on the enemy under your cursor. Click when the red line crosses the mark ({window} window) for a guaranteed crit with +{bonus} crit DMG. Normal crit rate is 10% lower.' },
  transfig:  { type: 'transfig',  every: 6, pct: 1.5, radius: 70,
               lv1: { every: 9, pct: 0.9 },
               si: { every: -0.5, pct: 0.25 },
               desc: 'Every {every}th kill becomes a transfigured crawler that runs at an enemy and explodes for {pct} click DMG ({radius} range). Killed elites always turn, for double.' },
  lava:      { type: 'lava',      dps: 0.3, radius: 60, dur: 4,
               lv1: { dps: 0.15, radius: 48, dur: 3 },
               si: { dps: 0.06, dur: 0.5 },
               desc: 'Kills erupt into lava ({radius} range, {dur}s) that burns enemies for {dps} click DMG per second. Every 6th hit leaves a small puddle too.' },
  firetrail: { type: 'firetrail', pct: 0.5, dur: 1.6,
               lv1: { pct: 0.25, dur: 1.0 },
               si: { pct: 0.1, dur: 0.2 },
               desc: 'Moving your cursor fast leaves a fire wall for {dur}s. It burns enemies for {pct} click DMG per second and stops enemy shots.' },
  souls:     { type: 'souls',     cap: 20, perSoul: 0.07,
               lv1: { cap: 12, perSoul: 0.035 },
               si: { cap: 2.5, perSoul: 0.01 },
               desc: 'Kills become spirits that orbit your cursor (up to {cap}; elites give 3). Each spirit deals {perSoul} click DMG per second to enemies they touch. Getting hit loses one.' },
  infinity:  { type: 'infinity',  radius: 90,
               lv1: { radius: 65 },
               si: { radius: 10 },
               desc: 'Infinity: a {radius} bubble around your cursor stops enemy shots, dashes and the worm\'s bite, and pushes enemies away. Blocking drains it; it refills when idle. Red circles and slashes still hit.' },
  phantom:   { type: 'phantom',   lag: 0.5, autoRate: 4, autoPct: 0.25,
               lv1: { lag: 0.3, autoRate: 2, autoPct: 0.2 },
               si: { lag: 0.05, autoPct: 0.05 },
               desc: 'No cursed energy: enemies aim where your cursor was {lag}s ago, so keep moving. Strongest auto-attack in the game: {autoRate} hits a second on the nearest enemy for {autoPct} click DMG each.' },
  copy:      { type: 'copy',      every: 20,
               lv1: { every: 30 },
               si: { every: -2 },
               desc: 'Copies a random 5★ skill (its weaker version) and switches to another every {every}s.' },
  shadows:   { type: 'shadows',   pct: 0.6,
               lv1: { pct: 0.35 },
               si: { pct: 0.1 },
               desc: 'Combo 10 summons a Divine Dog, combo 25 a Toad that eats the next hit on you, combo 50 Nue. Shikigami hit for {pct} click DMG.' },
};

export const ULTS = {
  tectonic_wrath: { type: 'nuke',      mult: 10, charge: 1,
                    si: { mult: 2 },
                    desc: 'Rock spires hit every enemy for {mult} click DMG.' },
  black_hole:     { type: 'blackhole', mult: 7, stun: 3, charge: 1,
                    si: { mult: 1.5, stun: 0.5 },
                    desc: 'Pulls every enemy into the centre, stuns them for {stun}s and deals {mult} click DMG.' },
  swag_mode:      { type: 'transform', dur: 10, clickMult: 2.5, autoClicks: 6, charge: 1,
                    si: { dur: 1.5, clickMult: 0.3 },
                    desc: 'SWAG MODE for {dur}s: {clickMult}× click DMG and 6 automatic clicks per second.' },
  permafrost:     { type: 'timestop',  dur: 6, mult: 3, charge: 1,
                    si: { dur: 1, mult: 0.75 },
                    desc: 'Stops time for {dur}s — every attack is cancelled — and deals {mult} click DMG to all enemies.' },
  tidal_surge:    { type: 'surge',     mult: 6, coins: 30, charge: 1,
                    si: { mult: 1.25, coins: 10 },
                    desc: 'Deals {mult} click DMG to all enemies, fully heals you and drops a pile of coins.' },
  reality_break:  { type: 'execute',   dur: 3, mult: 20, threshold: 0.2, charge: 1,
                    si: { mult: 4, threshold: 0.04 },
                    desc: 'Stops time for {dur}s, hits the strongest enemy for {mult} click DMG and executes non-bosses under {threshold} HP.' },
  hox:            { type: 'hox',       bossPct: 0.25, charge: 1.6,
                    si: { bossPct: 0.04 },
                    desc: "Eats every non-boss enemy, bites {bossPct} of the boss's max HP and fully heals you." },

  // ── Anemics Kaisen ──────────────────────────────────────────────────────
  overtime:        { type: 'overtime',   dur: 10, mult: 1.5, collapse: 5, charge: 1,
                     si: { dur: 1, collapse: 1 },
                     desc: 'OVERTIME for {dur}s: every click is a ratio hit and deals {mult} DMG. When it ends, Collapse hits every enemy for {collapse} click DMG.' },
  distortion:      { type: 'distortion', dur: 10, slashes: 3, mult: 0.42, charge: 1,
                     si: { dur: 1, mult: 0.07 },
                     desc: 'For {dur}s every click also fires {slashes} slashes through your cursor at random angles, each hitting everything on its line for {mult} click DMG.' },
  meteor:          { type: 'meteor',     mult: 20, radius: 170, charge: 1,
                     si: { mult: 4, radius: 10 },
                     desc: 'Maximum: Meteor drops on your cursor after a short warning: {mult} click DMG in a {radius} radius, then leaves a huge lava field.' },
  fuga:            { type: 'fuga',       mult: 12, burn: 4, charge: 1,
                     si: { mult: 2, burn: 1 },
                     desc: 'A fire arrow flies to the strongest enemy and explodes for {mult} click DMG, then the whole arena burns for {burn} click DMG.' },
  uzumaki:         { type: 'uzumaki',    base: 3, perSpirit: 1.4, min: 5, charge: 1,
                     si: { perSpirit: 0.2 },
                     desc: 'Needs {min}+ spirits. Fires every spirit in a spiral: {base} click DMG to all enemies, plus {perSpirit} per spirit spent.' },
  hollow_purple:   { type: 'purple',     mult: 25, width: 90, charge: 1,
                     si: { mult: 5, width: 10 },
                     desc: 'Hollow Purple: a beam from you through your cursor, {mult} click DMG to everything in its path ({width} wide). Deletes enemy shots it touches.' },
  sorcerer_killer: { type: 'sorcerer',   dur: 8, speed: 5, mult: 1.5, threshold: 0.2, killsNeeded: 20, chargeOn: 'kills',
                     si: { dur: 1, threshold: 0.03 },
                     desc: 'Charges from kills ({killsNeeded} — elites count 3), not damage. For {dur}s your auto-attacks hit {speed}× as fast for {mult} DMG and execute non-bosses under {threshold} HP.' },
  ora:             { type: 'ora',        dur: 45, punches: 10, pct: 0.3, charge: 1.3,
                     si: { punches: 1, pct: 0.03 },
                     desc: 'Pick 1 of 3 skills to use at full strength for {dur}s, with a punch barrage: {punches} punches a second for {pct} click DMG each.' },
  mahoraga:        { type: 'mahoraga',   hp: 2.5, mult: 4, charge: 1.4,
                     si: { hp: 0.4, mult: 0.8 },
                     desc: 'Summons Mahoraga ({hp}× your max HP, slams for {mult} click DMG). You are suspended and can only watch. It adapts to every attack that hits it, and its wheel turns every 6s, making it stronger. It must clear the field (boss included). If it dies, you die.' },
};

// Each S level after S1 also cuts the ult cooldown by this much (S5 = −32%)
export const ULT_CD_PER_SI = 0.08;

// How a number is shown in descriptions
const PCT_KEYS = new Set(['pct', 'chance', 'bonus', 'rate', 'dmg', 'threshold', 'bossPct', 'maxPctHp', 'healPctHp',
  'window', 'dps', 'perSoul', 'autoPct']);
const MULT_KEYS = new Set(['mult', 'collapse', 'burn', 'base', 'perSpirit']);
function showVal(key, v) {
  if (MULT_KEYS.has(key)) return `${Math.round(v * 100)}%`;
  if (PCT_KEYS.has(key)) return `${+(v * 100).toFixed(1)}%`;
  if (key === 'shots' || key === 'every' || key === 'cap') return String(Math.round(v));
  return String(+v.toFixed(2));
}

// Skill before LV20: the weaker `lv1` numbers replace the base ones
export const weakKit = (kit) => (kit?.lv1 ? { ...kit, ...kit.lv1, weak: true } : kit);

// The kit at a given superimposition (si = 0 for S1 … 4 for S5)
export function scaleKit(kit, si = 0) {
  if (!kit) return kit;
  const out = { ...kit };
  const n = Math.max(0, Math.min(4, si));
  // weak (pre-LV20) skills still get their superimposition steps, at half size
  Object.entries(kit.si ?? {}).forEach(([k, step]) => { out[k] = kit[k] + step * n * (kit.weak ? 0.5 : 1); });
  if (out.shots) out.shots = Math.floor(out.shots);
  return out;
}

// Description with this superimposition's numbers filled in
export function describeKit(kit, si = 0) {
  if (!kit) return '';
  const k = scaleKit(kit, si);
  return kit.desc.replace(/\{(\w+)\}/g, (_, key) => (key in k ? showVal(key, k[key]) : key));
}

// One line saying what the next superimposition improves, e.g. "range 110 → 128, DMG 50% → 62%"
const LABELS = { radius: 'range', pct: 'DMG', interval: 'every', shots: 'shots', chance: 'chance', dur: 'duration', bonus: 'bonus',
  rate: 'crit rate', dmg: 'crit DMG', mult: 'DMG', stun: 'stun', clickMult: 'click ×', coins: 'coins', threshold: 'execute',
  bossPct: 'boss bite', maxPctHp: 'max heal', healPctHp: 'heal',
  window: 'ratio window', dps: 'burn', cap: 'max spirits', perSoul: 'per spirit', lag: 'aim lag', autoPct: 'auto DMG',
  collapse: 'collapse', burn: 'burn', perSpirit: 'per spirit', width: 'width', punches: 'punches/s', hp: 'HP' };
export function describeSiStep(kit, si) {
  if (!kit?.si || si >= 4) return '';
  const a = scaleKit(kit, si), b = scaleKit(kit, si + 1);
  return Object.keys(kit.si)
    .filter(k => showVal(k, a[k]) !== showVal(k, b[k]))
    .map(k => `${LABELS[k] ?? k} ${showVal(k, a[k])} → ${showVal(k, b[k])}`).join(', ');
}
