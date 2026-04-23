// components/EnemyArena.jsx
import { useRef, useCallback } from 'react'

function EnemySprite({ enemy, onClick }) {
  const { tier, hp, maxHp, x, y, state, attackZone } = enemy
  const hpPct = hp / maxHp

  const tierColors = {
    basic: '#888',
    elite: '#c084fc',
    boss: '#f87171',
    treasure: '#fbbf24',
  }

  return (
    <>
      {/* Telegraph zone — red flash */}
      {state === 'telegraphing' && attackZone && (
        <div style={{
          position: 'absolute',
          left: `${attackZone.x}%`,
          top: `${attackZone.y}%`,
          width: `${attackZone.radius * 2}px`,
          height: `${attackZone.radius * 2}px`,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'rgba(255,0,0,0.4)',
          border: '2px solid red',
          animation: 'pulse 0.5s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 5,
        }} />
      )}

      {/* Enemy body */}
      <div
        onClick={() => onClick(enemy.id)}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: 'translate(-50%, -50%)',
          cursor: 'pointer',
          zIndex: 10,
          outline: state === 'telegraphing' ? '2px solid red' : 'none',
          filter: state === 'telegraphing' ? 'brightness(2) saturate(0)' : 'none',
          transition: 'filter 0.1s',
        }}
      >
        {/* Placeholder — swap with your actual enemy sprite */}
        <div style={{
          width: tier === 'boss' ? 64 : tier === 'elite' ? 48 : 36,
          height: tier === 'boss' ? 64 : tier === 'elite' ? 48 : 36,
          background: tierColors[tier],
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff', fontWeight: 'bold',
        }}>
          {tier[0].toUpperCase()}
        </div>

        {/* HP bar */}
        <div style={{
          width: '100%', height: 4,
          background: '#333', marginTop: 2, borderRadius: 2,
        }}>
          <div style={{
            width: `${hpPct * 100}%`, height: '100%',
            background: hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#facc15' : '#f87171',
            borderRadius: 2, transition: 'width 0.1s',
          }} />
        </div>
      </div>
    </>
  )
}

function Projectile({ proj }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${proj.x}%`,
      top: `${proj.y}%`,
      width: 10, height: 10,
      background: 'red',
      borderRadius: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 15,
      boxShadow: '0 0 6px red',
    }} />
  )
}

export default function EnemyArena({ enemies, projectiles, onEnemyClick, onMouseMove }) {
  const arenaRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    const rect = arenaRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onMouseMove({ x, y })   // pass % coords up to parent
  }, [onMouseMove])

  return (
    <div
      ref={arenaRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        height: '400px',
        background: '#111',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #333',
      }}
    >
      {enemies.map(enemy => (
        <EnemySprite
          key={enemy.id}
          enemy={enemy}
          onClick={onEnemyClick}
        />
      ))}
      {projectiles.map(proj => (
        <Projectile key={proj.id} proj={proj} />
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>
  )
}