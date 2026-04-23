// hooks/useEnemyAI.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { ENEMY_TYPES, pickRandomEnemyType } from '../data/enemyTypes'

let nextId = 0

function makeEnemy(tier, wave) {
  const type = ENEMY_TYPES[tier]
  const baseHp = 50 * Math.pow(1.3, wave)
  return {
    id: nextId++,
    tier,
    hp: Math.floor(baseHp * type.hpMultiplier),
    maxHp: Math.floor(baseHp * type.hpMultiplier),
    x: 10 + Math.random() * 80,   // % across arena
    y: 10 + Math.random() * 80,
    vx: (Math.random() - 0.5) * type.speed,
    vy: (Math.random() - 0.5) * type.speed,
    state: 'idle',               // idle | telegraphing | attacking | dead
    attackZone: null,
    attackTimer: null,
    attackCooldownLeft: ENEMY_TYPES[tier].attackCooldown ?? null,
    isFrozen: false,
  }
}

export function useEnemyAI({ wave, playerPosRef, onPlayerHit, onEnemyKilled, clickPower }) {
  const [enemies, setEnemies] = useState([])
  const [projectiles, setProjectiles] = useState([])
  const enemiesRef = useRef([])
  const projectilesRef = useRef([])
  const killsRef = useRef(0)

  // Keep ref in sync so intervals can read latest enemies
  useEffect(() => { enemiesRef.current = enemies }, [enemies])

  // Spawn initial enemies
  useEffect(() => {
    const initial = Array.from({ length: 5 }, () => makeEnemy('basic', wave))
    enemiesRef.current = initial
    setEnemies(initial)
    killsRef.current = 0
  }, [wave])

  // Periodic spawner
  useEffect(() => {
    const interval = setInterval(() => {
      setEnemies(prev => {
        if (prev.length >= 8) return prev   // cap alive enemies
        const tier = pickRandomEnemyType()
        return [...prev, makeEnemy(tier, wave)]
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [wave])

  // Main AI tick
  useEffect(() => {
    const tick = setInterval(() => {
      const playerPos = playerPosRef.current  // { x, y } in % coords

      setEnemies(prev => prev.map(enemy => {
        if (enemy.state === 'dead' || enemy.isFrozen) return enemy

        let { x, y, vx, vy, attackCooldownLeft, state, attackZone } = enemy
        const type = ENEMY_TYPES[enemy.tier]

        // Move
        if (type.speed > 0) {
          x += vx
          y += vy
          // Bounce off walls
          if (x < 5 || x > 95) vx *= -1
          if (y < 5 || y > 95) vy *= -1
          x = Math.max(5, Math.min(95, x))
          y = Math.max(5, Math.min(95, y))
        }

        // Attack logic
        if (type.attacks.length > 0 && state === 'idle') {
          const newCooldown = attackCooldownLeft - 200
          if (newCooldown <= 0) {
            // Start telegraph
            const zone = { x, y, radius: 12 }
            // Schedule the actual attack after 1 second
            setTimeout(() => {
              fireAttack(enemy.id, zone, playerPos)
            }, 1000)
            return { ...enemy, x, y, vx, vy, state: 'telegraphing', attackZone: zone, attackCooldownLeft: type.attackCooldown }
          }
          return { ...enemy, x, y, vx, vy, attackCooldownLeft: newCooldown }
        }

        return { ...enemy, x, y, vx, vy }
      }))
    }, 200)
    return () => clearInterval(tick)
  }, [wave])

  // Fire attack — checks if player is in zone, spawns projectile
  const fireAttack = useCallback((enemyId, zone, playerPos) => {
    // Check if player was in zone (didn't dodge)
    if (playerPos) {
      const dx = playerPos.x - zone.x
      const dy = playerPos.y - zone.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < zone.radius) {
        onPlayerHit(10)  // deal 10 damage
      }
    }

    // Spawn visual projectile
    const proj = {
      id: nextId++,
      x: zone.x,
      y: zone.y,
      targetX: playerPos?.x ?? 50,
      targetY: playerPos?.y ?? 50,
      born: Date.now(),
    }
    setProjectiles(prev => [...prev, proj])
    setTimeout(() => {
      setProjectiles(prev => prev.filter(p => p.id !== proj.id))
    }, 600)

    // Clear telegraph on the enemy
    setEnemies(prev => prev.map(e =>
      e.id === enemyId ? { ...e, state: 'idle', attackZone: null } : e
    ))
  }, [onPlayerHit])

  // Click an enemy
  const handleEnemyClick = useCallback((enemyId) => {
    setEnemies(prev => {
      return prev.map(enemy => {
        if (enemy.id !== enemyId) return enemy
        const newHp = enemy.hp - clickPower
        if (newHp <= 0) {
          onEnemyKilled(enemy)
          return { ...enemy, hp: 0, state: 'dead' }
        }
        return { ...enemy, hp: newHp }
      }).filter(e => e.state !== 'dead')
    })
  }, [clickPower, onEnemyKilled])

  return { enemies, projectiles, handleEnemyClick }
}