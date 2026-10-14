import { BAL } from './balance';

// A stage is plain config, so story mode (the Tower) can hand the engine its
// own hand-made stages later — custom rosters, bosses, kill targets, etc.
//
// Flow: fight (basics + elites spawn until killTarget) → boss intro → boss →
// stage clear → next stage. Dying restarts the current stage.

// ── Stage modifiers ─────────────────────────────────────────────────────────
// From stage 3, most stages get one twist. Every number is a multiplier on the
// normal stage (1 = unchanged); leave a field out to keep it unchanged.
export const MODIFIERS = {
  haste:     { name: 'Haste',        color: '#38bdf8', desc: 'Enemies move 40% faster and attack more often. +25% coins.',
               enemySpeed: 1.4, enemyCd: 0.8, coin: 1.25 },
  glass:     { name: 'Glass Cannon', color: '#f87171', desc: 'You and the enemies both deal double damage.',
               playerDmg: 2, enemyDmg: 2 },
  treasure:  { name: 'Treasure Rush', color: '#fbbf24', desc: 'Treasures show up three times as often.',
               treasure: 3 },
  swarm:     { name: 'Swarm',        color: '#a3e635', desc: 'Hordes come twice as often and bigger. +30% XP.',
               hordeRate: 2, hordeExtra: 3, xp: 1.3 },
  elites:    { name: 'Elite Squad',  color: '#c084fc', desc: 'More elites, more of them with affixes. +50% coins and XP.',
               eliteCapAdd: 2, eliteRate: 1.6, affixAdd: 0.3, coin: 1.5, xp: 1.5 },
  bulwark:   { name: 'Bulwark',      color: '#94a3b8', desc: 'Enemies have 60% more HP. +40% gems.',
               enemyHp: 1.6, gem: 1.4 },
  bloodlust: { name: 'Bloodlust',    color: '#ef4444', desc: 'No HP regeneration, but every kill heals 2% of your HP.',
               noRegen: true, killHeal: 0.02 },
  shortfuse: { name: 'Short Fuse',   color: '#fb923c', desc: 'Red warnings last 35% shorter. +30% gems.',
               tele: 0.65, gem: 1.3 },
};

// Same stage number → same modifier every time (so reloading doesn't reroll it)
export function stageModifier(n) {
  if (n < BAL.MODIFIER_FROM_STAGE) return null;
  const h = (Math.imul(n, 2654435761) >>> 0) / 4294967296;     // 0..1, fixed per stage
  if (h >= BAL.MODIFIER_CHANCE) return null;
  const ids = Object.keys(MODIFIERS);
  const id = ids[Math.floor((h / BAL.MODIFIER_CHANCE) * ids.length) % ids.length];
  return { id, ...MODIFIERS[id] };
}

export function makeEndlessStage(n) {
  return {
    n,
    name: `Stage ${n}`,
    killTarget: Math.min(40, 10 + n * 3),

    basics: ['xiao'],
    basicCap: Math.min(10, 4 + n),
    basicEvery: Math.max(0.6, 1.4 - n * 0.06),
    // basics are punching bags at first; from stage 3 some of them poke back
    armedBasicChance: n < 3 ? 0 : Math.min(0.4, 0.1 * (n - 2)),

    elites: n < 2 ? ['bonk'] : n < 3 ? ['bonk', 'rusher'] : ['bonk', 'rusher', 'shielder'],
    eliteCap: Math.min(3, 1 + Math.floor(n / 3)),
    eliteEvery: Math.max(5, 11 - n * 0.6),

    // a pack of swarmlings bursts in every so often (stage 2+)
    hordeEvery: n < 2 ? 0 : Math.max(12, 24 - n),
    hordeSize: Math.min(9, 4 + Math.floor(n / 2)),
    hordeArmedChance: Math.min(0.5, 0.15 + n * 0.04),

    boss: ['devourer', 'worm', 'hydra'][(n - 1) % 3],
    bossCooldownMult: Math.max(0.6, 1 - (n - 1) * 0.05),

    hpScale: Math.pow(BAL.HP_GROWTH, n - 1),
    dmgScale: Math.pow(BAL.DMG_GROWTH, n - 1),
    coinScale: Math.pow(BAL.COIN_GROWTH, n - 1),
    gemScale: 1 + BAL.GEM_GROWTH * (n - 1),   // boss/treasure gems grow so later stages stay worth it

    clearReward: { coins: 150 * n, gems: Math.round(1 + BAL.GEM_GROWTH * 2 * (n - 1)) },

    // chance an elite spawns with an affix (enemies.js → AFFIXES)
    affixChance: n < BAL.AFFIX_FROM_STAGE ? 0
      : Math.min(BAL.AFFIX_CHANCE_MAX, BAL.AFFIX_CHANCE + BAL.AFFIX_CHANCE_GROWTH * (n - BAL.AFFIX_FROM_STAGE)),

    mod: stageModifier(n),
  };
}
