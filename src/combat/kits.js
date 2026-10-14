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
};

// Each S level after S1 also cuts the ult cooldown by this much (S5 = −32%)
export const ULT_CD_PER_SI = 0.08;

// How a number is shown in descriptions
const PCT_KEYS = new Set(['pct', 'chance', 'bonus', 'rate', 'dmg', 'threshold', 'bossPct', 'maxPctHp', 'healPctHp']);
const MULT_KEYS = new Set(['mult']);
function showVal(key, v) {
  if (MULT_KEYS.has(key)) return `${Math.round(v * 100)}%`;
  if (PCT_KEYS.has(key)) return `${+(v * 100).toFixed(1)}%`;
  if (key === 'shots') return String(Math.floor(v));
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
  bossPct: 'boss bite', maxPctHp: 'max heal', healPctHp: 'heal' };
export function describeSiStep(kit, si) {
  if (!kit?.si || si >= 4) return '';
  const a = scaleKit(kit, si), b = scaleKit(kit, si + 1);
  return Object.keys(kit.si)
    .filter(k => showVal(k, a[k]) !== showVal(k, b[k]))
    .map(k => `${LABELS[k] ?? k} ${showVal(k, a[k])} → ${showVal(k, b[k])}`).join(', ');
}
