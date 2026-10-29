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
//   looks:     which way the character in the picture looks ('left' / 'right'): it's
//              mirrored to keep looking at your cursor
//   poses:     extra pictures for attacks — warn (one picture, or two that
//              flicker) while it winds up, attack while it strikes/dashes
//   poseFacing: which way the pose pictures look (180 = left, 0 = right); they
//              then turn toward the attack (flipped instead of upside down)
//   imgBroken: picture while its own shield is broken (Shield Bonk)

const BASE = import.meta.env.BASE_URL;

export const ENEMY_TYPES = {
  // ── Small fry: low HP, walk in from the sides, keep their distance and plink at you with
  // quick weak shots. They spawn often — clear them out before you deal with the big ones.
  //   keep:    the distance (design px) they try to stay from your cursor
  //   attacks: kind, or { kind, …options } (dmgKey, teleMult, small, debuff)
  xiao: {
    name: 'Xiao', tier: 'basic', move: 'kite', enter: true,
    img: `${BASE}enemies/xiaoenemy.png`, size: 60, drawScale: 1.35, looks: 'right',
    hp: 20, coin: 12,
    speedRange: [0.3, 0.7],               // rolled per spawn; HP follows speed
    keep: [230, 330],
    attacks: [], armedAttacks: [{ kind: 'shot', dmgKey: 'pellet', teleMult: 0.55, small: true }],
    cooldown: [2.2, 3.2],
  },
  // Hexer: its purple shots WEAKEN you (−30% damage for a few seconds)
  xiaoHex: {
    name: 'Xiao Hexer', tier: 'basic', move: 'kite', enter: true, alwaysArmed: true, badge: { icon: '✦', color: '#c084fc' },
    img: `${BASE}enemies/xiaoenemy.png`, size: 60, drawScale: 1.35, looks: 'right', tint: 'saturate(1.8) brightness(0.75) contrast(1.15)',
    hp: 24, coin: 16, speedRange: [0.25, 0.55],
    keep: [270, 380],
    attacks: [{ kind: 'shot', dmgKey: 'hex', teleMult: 0.7, small: true, debuff: 'weak' }],
    cooldown: [2.8, 3.8],
  },
  // Medic: stops at the edge and every few seconds heals the enemies around it and makes
  // them FORTIFIED (take 30% less damage). Kill it first.
  xiaoMedic: {
    name: 'Xiao Medic', tier: 'basic', move: 'still', enter: true, alwaysArmed: true, badge: { icon: '✚', color: '#4ade80' },
    img: `${BASE}enemies/xiaoenemy.png`, size: 62, drawScale: 1.35, looks: 'right', tint: 'hue-rotate(170deg) saturate(1.3) brightness(1.05)',
    hp: 30, coin: 18, speed: 0.4,
    support: { every: 4.5, radius: 240, heal: 0.08, fort: 0.3, dur: 3 },
    attacks: [{ kind: 'shot', dmgKey: 'pellet', teleMult: 0.6, small: true }],
    cooldown: [3.5, 5],
  },
  // ── Big ones: lots of HP, come in from the sides and chase you, only attack up close —
  // but those hits are heavy. Every so often they turn to MIRROR for a moment: hits you land
  // on them yourself come back at you (auto-attacks, allies and burns don't).
  //   reach:   how close (design px) they get before they swing
  //   reflect: seconds between mirrors, warning time, how long it lasts
  bonk: {
    name: 'Bonk', tier: 'elite', move: 'chase', enter: true,
    img: `${BASE}enemies/bonk.png`, size: 140, drawScale: 1.55, looks: 'left',
    hp: 230, coin: 100, speed: 0.3,
    reach: 150,
    attacks: [{ kind: 'circle', dmgKey: 'smash', rK: 85, teleMult: 0.85 }],
    cooldown: [2.2, 3.2],
    reflect: { every: [9, 14], warn: 0.9, dur: 1.8 },
  },
  rusher: {
    name: 'Rusher', tier: 'elite', move: 'chase', enter: true,
    img: `${BASE}enemies/rusher_idle.png`, size: 92,                                     // red skull
    poses: {
      warn:   [`${BASE}enemies/rusher_warn.png`, `${BASE}enemies/rusher_idle.png`],     // flickers yellow/red before attacking
      attack: `${BASE}enemies/rusher_attack.png`,                                       // screaming, while dashing
    },
    poseFacing: 180,   // the skulls look left; they turn/flip to face where they attack
    hp: 180, coin: 90, speed: 0.6,
    reach: 270,
    attacks: [{ kind: 'dash', dmgKey: 'lunge', overshoot: 50, teleMult: 0.8 }],
    cooldown: [2.4, 3.4],
    reflect: { every: [10, 15], warn: 0.9, dur: 1.6 },
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
    img: `${BASE}enemies/shielder.png`, imgBroken: `${BASE}enemies/shielder_broken.png`, size: 92,
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
    weakPoints: true,   // SEALED until you break its weak spots around the arena (engine.js → seals)
  },
  // The Devourer's weak spots: they open up around the arena while it's sealed. Their HP is set
  // from the boss's (engine.js → SEAL); they don't attack, move or count as kills.
  weakspot: {
    name: 'WEAK SPOT', tier: 'elite', core: true, shape: 'core', move: 'still',
    size: 58, hp: 1, coin: 0, xp: 0, speed: 0, cooldown: [9e9, 9e9], attacks: [],
  },
  // Worm (like Terraria's Eater of Worlds): HP is split across body parts,
  // every part can be clicked, but the HEAD hurts you if it touches your
  // cursor. Kill the head and the next segment becomes the new head.
  worm: {
    name: 'EATER OF FRAILS', tier: 'boss', kind: 'worm',
    img: `${BASE}enemies/worm_head.png`, size: 74, facing: 90, drawScale: 1.75,
    hp: 120, coin: 0, xp: 40,
    segments: 14, segmentType: 'wormSeg', spacing: 40,
    wormSpeed: 165, turnRate: 2.4,
    groupReward: { coin: 400, gems: 10, xp: 1000 },
  },
  wormSeg: {
    name: 'EATER OF FRAILS', tier: 'boss', kind: 'worm',
    img: `${BASE}enemies/worm_body.png`, size: 54, facing: -90, drawScale: 2.55,
    hp: 54, coin: 7, xp: 28,   // 14 parts: same total HP/rewards as the old 10 × 75
  },
  // Hydra: three heads with their own HP bars. A head at 0 HP goes DOWN
  // for 5s. Get all three down at the same time or the downed ones regrow
  // at half HP. The heads hang from long necks that come down from the top
  // of the arena (drawn in BattleArena.jsx from stacked neckImg segments).
  //   headImgs:   left, middle, right head
  //   neckAttach: where each head's neck meets it, as a fraction of its picture (x, y)
  hydra: {
    name: 'HYDRA', tier: 'boss', kind: 'hydra',
    img: `${BASE}enemies/hydra_head_front.png`, size: 112, drawScale: 1.75,
    headImgs: [`${BASE}enemies/hydra_head_sting.png`, `${BASE}enemies/hydra_head_front.png`, `${BASE}enemies/hydra_head_eyes.png`],
    neckImg: `${BASE}enemies/hydra_neck.png`,
    neckAttach: [[0.4, 0.2], [0.5, 0.17], [0.47, 0.16]],
    hp: 300, coin: 0, xp: 40, speed: 0,
    heads: 3, downTime: 5, regrowPct: 0.5,
    attacks: ['shot', 'circle'], cooldown: [2.4, 3.6],
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

// Player debuffs from enemies (engine.js): weak = you deal 30% less damage
export const DEBUFFS = { weak: { name: 'WEAKENED', color: '#c084fc', dur: 4, dmg: 0.7 } };

// Base damage of each attack at stage 1 (before DEF / damage reduction)
export const ATTACK_DMG = {
  poke: 6, circle: 14, slash: 16, shot: 10, dash: 20,
  pellet: 4, hex: 3,       // small fry: quick, weak shots
  smash: 26, lunge: 24,    // big ones: heavy close-range hits
  slam: 28, ring: 14, cross: 18, barrage: 10, rain: 14,
  bite: 14,   // worm head touching your cursor
  blast: 24,  // Volatile elite explosion
  poison: 5,  // Toxic puddle, per tick
};
