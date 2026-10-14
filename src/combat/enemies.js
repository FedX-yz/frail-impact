// Enemy roster. `hp` / `coin` are stage-1 values before speed and stage scaling.
// size is in design px. speed is 0 (still) → 1 (very fast).
//
// attacks:
//   poke   – small red circle on itself (armed basics, stage 3+)
//   circle – red circle around itself, then a white ring hits it
//   slash  – red band through where you are, then a white slash
//   shot   – red line toward you, then a projectile flies down it
//   dash   – its own sprite flashes red, then it launches itself at you
//   (worm heads don't telegraph — they hurt on contact)
//
// Boss patterns (see engine.js): slamRing, crossSlash, barrage, rain
//
// Art options:
//   facing:    which way the picture points, in degrees (0 = right, 90 = down,
//              -90 = up). Set it and the sprite turns to face where it moves.
//   drawScale: draw the picture bigger/smaller than the hitbox (`size`)
//   poses:     extra pictures for attacks — warn (one picture, or two that
//              flicker) while it winds up, attack while it strikes/dashes
//   poseFacing: which way the pose pictures look (180 = left, 0 = right); they
//              then turn toward the attack (flipped instead of upside down)

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
    img: `${BASE}enemies/rusher_idle.png`, size: 80,                                     // red skull
    poses: {
      warn:   [`${BASE}enemies/rusher_warn.png`, `${BASE}enemies/rusher_idle.png`],     // flickers yellow/red before attacking
      attack: `${BASE}enemies/rusher_attack.png`,                                       // screaming, while dashing / shooting
    },
    poseFacing: 180,   // the skulls look left; they turn/flip to face where they attack
    hp: 95, coin: 55, speed: 0.55,
    attacks: ['dash', 'shot'],
    cooldown: [3.5, 5],
  },
  // Horde: small, fast, weak, they show up as a pack and crowd around you.
  // Some of them poke (small red circles), so a swarm next to you is dangerous.
  swarmling: {
    name: 'Swarmling', tier: 'basic', horde: true,
    img: `${BASE}enemies/bat.gif`, size: 46,
    hp: 9, coin: 4, speedRange: [0.8, 1],
    attacks: [], armedAttacks: ['poke'],
    cooldown: [3.5, 5.5],
  },
  // Shield: a blue bubble that soaks up ALL damage to itself and anything
  // standing inside it. Break the bubble first; it comes back 5s after the
  // last hit, so keep the pressure on.
  shielder: {
    name: 'Shield Bonk', tier: 'elite',
    img: `${BASE}enemies/bonkenemy.png`, tint: 'hue-rotate(185deg) saturate(1.6)', size: 84,
    hp: 110, coin: 75, speed: 0.1,
    attacks: ['shot'], cooldown: [4, 5.5],
    shield: { pct: 0.7, radius: 125, regen: 5 },
  },

  // ── Bosses (rotate: Devourer → Worm → Hydra → Devourer …) ──
  devourer: {
    name: 'DEVOURER OF WORLDS', tier: 'boss',
    img: `${BASE}enemies/hoxboss.jpg`, size: 150,
    hp: 700, coin: 400, gems: 10, speed: 0,
    bossPatterns: ['slamRing', 'crossSlash', 'barrage', 'rain'],
    cooldown: [2.6, 3.4],
    weakPoints: true,
  },
  // Worm (like Terraria's Eater of Worlds): HP is split across body parts,
  // every part can be clicked, but the HEAD hurts you if it touches your
  // cursor. Kill the head and the next segment becomes the new head.
  worm: {
    name: 'EATER OF FRAILS', tier: 'boss', kind: 'worm',
    img: `${BASE}enemies/worm_head.png`, size: 74, facing: 90, drawScale: 1.75,
    hp: 120, coin: 0, xp: 40,
    segments: 10, segmentType: 'wormSeg', spacing: 40,
    wormSpeed: 165, turnRate: 2.4,
    groupReward: { coin: 400, gems: 10, xp: 1000 },
  },
  wormSeg: {
    name: 'EATER OF FRAILS', tier: 'boss', kind: 'worm',
    img: `${BASE}enemies/worm_body.png`, size: 54, facing: -90, drawScale: 2.55,
    hp: 75, coin: 10, xp: 40,
  },
  // Hydra: three heads with their own HP bars. A head at 0 HP goes DOWN
  // for 5s. Get all three down at the same time or the downed ones regrow
  // at half HP.
  hydra: {
    name: 'HYDRA', tier: 'boss', kind: 'hydra',
    img: `${BASE}enemies/hoxboss.jpg`, size: 100,
    hp: 300, coin: 0, xp: 40, speed: 0,
    heads: 3, downTime: 5, regrowPct: 0.5,
    attacks: ['shot', 'circle'], cooldown: [2.4, 3.6],
    headTints: ['hue-rotate(0deg)', 'hue-rotate(110deg)', 'hue-rotate(230deg)'],
    groupReward: { coin: 450, gems: 10, xp: 1000 },
  },
  treasure: {
    name: 'Treasure', tier: 'treasure',
    img: `${BASE}enemies/treasure.png`, size: 56,
    hp: 25, coin: 0, gems: 1, speed: 1,
    attacks: [],
  },
};

// ── Elite affixes ───────────────────────────────────────────────────────────
// From stage 4 some elites spawn with one of these (chance in balance.js).
// Affixed elites get +30% HP (Swift: −30%) and give +50% coins and XP.
export const AFFIXES = {
  volatile:  { name: 'Volatile',     color: '#f97316', desc: 'Explodes a moment after it dies — get out of the red circle.' },
  toxic:     { name: 'Toxic',        color: '#84cc16', desc: 'Leaves poison puddles that hurt while your cursor is in them.' },
  shielded:  { name: 'Shielded',     color: '#38bdf8', desc: 'Has its own shield bubble.' },
  swift:     { name: 'Swift',        color: '#e879f9', desc: 'Much faster and attacks more often, but has less HP.' },
  regen:     { name: 'Regenerating', color: '#4ade80', desc: 'Heals quickly when you stop hitting it.' },
  splitter:  { name: 'Splitter',     color: '#facc15', desc: 'Splits into swarmlings when it dies.' },
};

// Base damage of each attack at stage 1 (before DEF / damage reduction)
export const ATTACK_DMG = {
  poke: 6, circle: 14, slash: 16, shot: 10, dash: 20,
  slam: 28, ring: 14, cross: 18, barrage: 10, rain: 14,
  bite: 14,   // worm head touching your cursor
  blast: 24,  // Volatile elite explosion
  poison: 5,  // Toxic puddle, per tick
};
