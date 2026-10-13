// 5★/6★ kits, keyed by the `effect` id in characters.js.
//
// Skills (unlock at LV20) are always-on upgrades to clicking.
// Ults (unlock at LV50) charge up from damage you deal; press E or tap the orb.
// `charge` scales how much damage the ult needs (1 = normal).

export const SKILL_UNLOCK = 20;
export const ULT_UNLOCK   = 50;

export const SKILLS = {
  rock_shard:    { type: 'splash',    radius: 110, pct: 0.5,
                   desc: 'Every click also sends rock shards into enemies near the target for 50% click DMG.' },
  quantum_burst: { type: 'pulse',     interval: 2.5, radius: 120, pct: 1.5,
                   desc: 'Every 2.5s a quantum pulse at your cursor deals 150% click DMG around it.' },
  swag_strike:   { type: 'gun',       pct: 1.0,
                   desc: 'Click empty space to fire a homing shot at the nearest enemy for 100% click DMG — hit from afar.' },
  frost_bolt:    { type: 'frost',     chance: 0.15, dur: 2, bonus: 0.3,
                   desc: 'Clicks have a 15% chance to freeze an enemy for 2s. Frozen enemies take +30% DMG.' },
  healing_tide:  { type: 'lifesteal', flat: 1, pct: 0.02, max: 6,
                   desc: 'Clicks heal you for 1 HP + 2% of the damage dealt (up to 6 per click).' },
  reality_slice: { type: 'crit',      rate: 0.15, dmg: 1.0,
                   desc: '+15% crit rate and +100% crit DMG.' },
  devour:        { type: 'devour',    pct: 0.04, heal: 2,
                   desc: "Clicks also bite off 4% of the target's current HP and heal you for 2 HP." },
};

export const ULTS = {
  tectonic_wrath: { type: 'nuke',      mult: 10, charge: 1,
                    desc: 'Rock spires hit every enemy for 1000% click DMG.' },
  black_hole:     { type: 'blackhole', mult: 7, stun: 3, charge: 1,
                    desc: 'Pulls every enemy into the centre, stuns them for 3s and deals 700% click DMG.' },
  swag_mode:      { type: 'transform', dur: 10, clickMult: 2.5, autoClicks: 6, charge: 1,
                    desc: 'SWAG MODE for 10s: 2.5× click DMG and 6 automatic clicks per second.' },
  permafrost:     { type: 'timestop',  dur: 6, mult: 3, charge: 1,
                    desc: 'Stops time for 6s — every attack is cancelled — and deals 300% click DMG to all enemies.' },
  tidal_surge:    { type: 'surge',     mult: 6, coins: 30, charge: 1,
                    desc: 'Deals 600% click DMG to all enemies, fully heals you and drops a pile of coins.' },
  reality_break:  { type: 'execute',   dur: 3, mult: 20, threshold: 0.2, charge: 1,
                    desc: 'Stops time for 3s, hits the strongest enemy for 2000% click DMG and executes non-bosses under 20% HP.' },
  hox:            { type: 'hox',       bossPct: 0.25, charge: 1.6,
                    desc: "Eats every non-boss enemy, bites 25% of the boss's max HP and fully heals you." },
};
