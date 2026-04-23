// data/enemyTypes.js

export const ENEMY_TYPES = {
    basic: {
      tier: 'basic',
      hpMultiplier: 1,
      speed: 0,
      attacks: [],
      spawnWeight: 10,
      reward: 1,         // coin multiplier on kill
    },
    elite: {
      tier: 'elite',
      hpMultiplier: 3,
      speed: 1.5,
      attacks: ['projectile'],
      spawnWeight: 3,
      attackCooldown: 4000,
      reward: 3,
    },
    boss: {
      tier: 'boss',
      hpMultiplier: 10,
      speed: 0.8,
      attacks: ['projectile', 'slam'],
      spawnWeight: 0,
      attackCooldown: 2500,
      reward: 15,
    },
    treasure: {
      tier: 'treasure',
      hpMultiplier: 0.5,
      speed: 2.5,        // moves fast = less hp
      attacks: ['lure'],
      spawnWeight: 1,
      reward: 0,         // gives pull currency instead
      pullReward: 1,
    },
  }
  
  // Weighted random pick from spawnable types
  export function pickRandomEnemyType() {
    const spawnable = Object.values(ENEMY_TYPES).filter(t => t.spawnWeight > 0)
    const totalWeight = spawnable.reduce((sum, t) => sum + t.spawnWeight, 0)
    let roll = Math.random() * totalWeight
    for (const type of spawnable) {
      roll -= type.spawnWeight
      if (roll <= 0) return type.tier
    }
    return 'basic'
  }