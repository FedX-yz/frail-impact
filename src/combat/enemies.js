// Enemy roster. `hp` / `coin` are stage-1 values before speed and stage scaling.
// size is in design px. speed is 0 (still) → 1 (very fast).
//
// attacks:
//   poke   – small red circle on itself (armed basics, stage 3+)
//   circle – red circle around itself, then a white ring hits it
//   slash  – red band through where you are, then a white slash
//   shot   – red line toward you, then a projectile flies down it
//   dash   – its own sprite flashes red, then it launches itself at you
//
// Boss patterns (see engine.js): slamRing, crossSlash, barrage, rain

const BASE = import.meta.env.BASE_URL;

export const ENEMY_TYPES = {
  xiao: {
    name: 'Xiao', tier: 'basic',
    img: `${BASE}enemies/xiaoenemy.png`, size: 70,
    hp: 30, coin: 12,
    speedRange: [0, 0.9],                 // rolled per spawn; HP follows speed
    attacks: [], armedAttacks: ['poke'],
    cooldown: [5, 7],
  },
  bonk: {
    name: 'Bonk', tier: 'elite',
    img: `${BASE}enemies/bonkenemy.png`, size: 88,
    hp: 120, coin: 60, speed: 0.15,
    attacks: ['circle', 'slash'],
    cooldown: [3.2, 4.5],
  },
  rusher: {
    name: 'Rusher', tier: 'elite',
    img: `${BASE}enemies/niglet.png`, size: 80,
    hp: 95, coin: 55, speed: 0.55,
    attacks: ['dash', 'shot'],
    cooldown: [3.5, 5],
  },
  devourer: {
    name: 'DEVOURER OF WORLDS', tier: 'boss',
    img: `${BASE}enemies/hoxboss.jpg`, size: 150,
    hp: 700, coin: 400, gems: 10, speed: 0,
    bossPatterns: ['slamRing', 'crossSlash', 'barrage', 'rain'],
    cooldown: [2.6, 3.4],
  },
  treasure: {
    name: 'Treasure', tier: 'treasure',
    img: `${BASE}enemies/treasure.png`, size: 56,
    hp: 25, coin: 0, gems: 1, speed: 1,
    attacks: [],
  },
};

// Base damage of each attack at stage 1 (before DEF / damage reduction)
export const ATTACK_DMG = {
  poke: 6, circle: 14, slash: 16, shot: 10, dash: 20,
  slam: 28, ring: 14, cross: 18, barrage: 10, rain: 14,
};
