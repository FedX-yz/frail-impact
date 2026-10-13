import { BAL } from './balance';

// A stage is plain config, so story mode (the Tower) can hand the engine its
// own hand-made stages later — custom rosters, bosses, kill targets, etc.
//
// Flow: fight (basics + elites spawn until killTarget) → boss intro → boss →
// stage clear → next stage. Dying restarts the current stage.

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

    elites: n < 2 ? ['bonk'] : ['bonk', 'rusher'],
    eliteCap: Math.min(3, 1 + Math.floor(n / 3)),
    eliteEvery: Math.max(5, 11 - n * 0.6),

    boss: 'devourer',
    bossCooldownMult: Math.max(0.6, 1 - (n - 1) * 0.05),

    hpScale: Math.pow(BAL.HP_GROWTH, n - 1),
    dmgScale: 1 + (n - 1) * BAL.DMG_GROWTH,
    coinScale: Math.pow(BAL.COIN_GROWTH, n - 1),

    clearReward: { coins: 150 * n, gems: 1 },
  };
}
