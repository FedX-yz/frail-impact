import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BAL } from './balance';

const BASE = import.meta.env.BASE_URL;
const STATUS_PORTRAITS = {
  1:  `${BASE}ui/ui_statusastrec.png`,
  2:  `${BASE}ui/ui_statusbio.png`,
  6:  `${BASE}ui/ui_statusice.png`,
  9:  `${BASE}ui/ul_statusreef.png`,
  10: `${BASE}ui/ui_statusforbiddenone.png`,
  99: `${BASE}ui/ui_statushox.png`,
};
const BATTLE_BG = `${BASE}backgrounds/bg1.png`;

// Draws the engine every animation frame and feeds it mouse/touch input.
// `mobile` makes the status frame a bit bigger so it's easy to tap on a phone.
export default function BattleArena({ engine, mainCard, mobile }) {
  const ref = useRef(null);
  const frameRef = useRef(null);
  // enemy id → DOM node; positions are written straight to these every frame
  const nodes = useRef(new Map());
  const register = useCallback((id, el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id); }, []);
  const onUlt = useCallback(() => engine.activateUlt(), [engine]);
  const [, setFrame] = useState(0);
  const [touchMode, setTouchMode] = useState(false);

  // Debug handle for the browser console (window.__battle): always in dev,
  // and on the live site when you open it with ?debug at the end of the URL
  useEffect(() => {
    if (import.meta.env.DEV || location.search.includes('debug')) window.__battle = engine;
  }, [engine]);

  // Arena size → engine
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      engine.resize(el.clientWidth, el.clientHeight);
      const f = frameRef.current;
      if (f) {
        const a = el.getBoundingClientRect(), b = f.getBoundingClientRect();
        engine.setReserved({ x0: b.left - a.left, y0: b.top - a.top, x1: b.right - a.left, y1: b.bottom - a.top + 20 });
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [engine]);

  // Game loop
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      engine.update((now - last) / 1000);
      last = now;
      setFrame(f => (f + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // E = ult
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'e' || e.key === 'E') engine.activateUlt(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  const toLocal = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' !== touchMode) setTouchMode(e.pointerType === 'touch');
    const [x, y] = toLocal(e);
    engine.pointerDown(x, y);
  };
  const onPointerMove = (e) => { const [x, y] = toLocal(e); engine.pointerMove(x, y); };

  const s = engine.state;
  const k = s.k;
  const pl = s.player;
  const shakeX = s.shake > 0 ? (Math.random() - 0.5) * 10 * s.shake : 0;
  const shakeY = s.shake > 0 ? (Math.random() - 0.5) * 10 * s.shake : 0;
  const bossParts = s.enemies.filter(e => e.tier === 'boss');
  const ult = s.stats.ult;
  const charge = s.ult.charge;
  const ultReady = ult && charge >= 1 && !s.ult.active;
  const hpRatio = pl.maxHp ? pl.hp / pl.maxHp : 0;

  // Move every enemy by setting its transform directly (no React re-render
  // needed for movement). Runs after each frame's render, before paint.
  useLayoutEffect(() => {
    for (const e of s.enemies) {
      const el = nodes.current.get(e.id);
      if (!el) continue;
      const half = e.size * s.k / 2;
      el.style.transform = `translate3d(${e.x - half}px, ${e.y - half}px, 0)`;
    }
  });

  return (
    <>
      <div
        ref={ref}
        className="battle-arena"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onContextMenu={e => e.preventDefault()}
        style={{
          flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
          border: '2px solid #cc8800', borderRadius: 6,
          backgroundImage: `url(${BATTLE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0f1625',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px,${shakeY}px)` }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,30,0.45)', pointerEvents: 'none' }} />

          {/* ── Attack areas ─────────────────────────────────────────── */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, overflow: 'visible' }}>
            {s.attacks.map(a => <AttackShape key={a.id} a={a} k={k} />)}
            {s.shots.map(sh => (
              <circle key={sh.id} cx={sh.x} cy={sh.y} r={8 * k} fill="#e9d5ff" stroke="#a855f7" strokeWidth={3 * k} style={{ filter: 'drop-shadow(0 0 6px #a855f7)' }} />
            ))}
            {s.effects.map(f => <EffectShape key={f.id} f={f} k={k} />)}
          </svg>

          {/* ── Enemies ──────────────────────────────────────────────── */}
          {s.enemies.map(e => {
            const isWormHead = e.move === 'worm' && e.role === 'head';
            return (
              <EnemySprite key={e.id} id={e.id} register={register}
                img={e.img} shape={e.shape} tint={e.tint} tier={e.tier} role={e.role} grouped={!!e.group}
                size={e.size * k} k={k} isWormHead={isWormHead}
                frozen={e.frozen > 0} down={e.down > 0 ? Math.ceil(e.down * 10) / 10 : 0}
                flashRed={e.flashRed} hurt={e.hurt > 0} dashing={!!e.dashing} paused={s.timeStop > 0}
                hpPct={Math.max(0, Math.round(e.hp / e.maxHp * 200) / 2)}
                shieldR={e.shield ? e.type.shield.radius * k : 0}
                shieldPct={e.shield ? Math.round(e.shield.hp / e.shield.max * 100) : 0}
                weak={e.type.weakPoints ? s.weakPts.filter(w => w.boss === e.id).map(w => `${w.id}:${w.rx}:${w.ry}`).join('|') : ''} />
            );
          })}

          {/* ── Floating numbers (re-rendered only when one is added/removed) ── */}
          <FloaterLayer floaters={s.floaters} ver={s.floaterVer} k={k} />

          {/* Your position on touch screens (a mouse already shows a cursor) */}
          {touchMode && pl.pos && (
            <div style={{
              position: 'absolute', left: pl.pos.x, top: pl.pos.y, width: 26 * k, height: 26 * k,
              transform: 'translate(-50%,-50%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 9,
              border: `2px solid ${pl.invuln > 0 ? '#fff' : '#4ade80'}`, opacity: pl.invuln > 0 ? 0.5 : 0.85,
              boxShadow: '0 0 8px #000',
            }} />
          )}
        </div>

        {/* Overlays that don't shake */}
        {s.timeStop > 0 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(80,160,255,0.16)', backdropFilter: 'grayscale(0.7)', pointerEvents: 'none', zIndex: 10 }} />}
        {pl.hitT > 0 && <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${80 * pl.hitT}px rgba(255,0,0,0.9)`, pointerEvents: 'none', zIndex: 11 }} />}
        {s.effects.some(f => f.kind === 'ult') && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.5, pointerEvents: 'none', zIndex: 12, animation: 'ultFlash 0.5s ease-out forwards' }} />}

        <StageBarView {...stageBarProps(s, bossParts)} />

        {/* Status chips */}
        <div style={{ position: 'absolute', top: 44, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, zIndex: 13, pointerEvents: 'none' }}>
          {s.frenzy > 0 && <Chip color="#ff8c00">FRENZY {s.frenzy.toFixed(0)}s</Chip>}
          {s.timeStop > 0 && <Chip color="#67e8f9">TIME STOP {s.timeStop.toFixed(1)}s</Chip>}
          {s.ult.active && <Chip color="#c084fc">{ult?.name ?? 'ULT'} {s.ult.active.t.toFixed(1)}s</Chip>}
        </div>

        {s.banner && (
          <div className="stage-banner" key={s.banner.text}>
            <div style={{ fontSize: `clamp(26px, ${7 * k}vmin, 54px)`, fontWeight: 900, letterSpacing: 4,
              color: s.banner.boss || s.banner.bad ? '#ff4400' : s.banner.good ? '#4ade80' : '#ffb347',
              textShadow: `0 0 28px ${s.banner.boss || s.banner.bad ? '#ff2200' : s.banner.good ? '#16a34a' : '#ff8c00'}` }}>
              {s.banner.text}
            </div>
            {s.banner.sub && <div style={{ color: '#ddd', fontSize: 15, marginTop: 4, letterSpacing: 2, textShadow: '0 1px 4px #000' }}>{s.banner.sub}</div>}
          </div>
        )}

        {/* Status frame (portrait / ult orb / HP) — your art, on PC and phone */}
        <StatusFrame frameRef={frameRef} mobile={mobile} mainCard={mainCard}
          hpRatio={Math.round(hpRatio * 400) / 400} charge={Math.floor(charge * 100) / 100} ult={ult} ultReady={!!ultReady}
          onUlt={onUlt} hp={Math.ceil(pl.hp)} maxHp={pl.maxHp} />
      </div>

      <style>{ARENA_CSS}</style>
    </>
  );
}

function AttackShape({ a, k }) {
  if (a.phase === 'wait' || a.phase === 'done') return null;
  const p = a.phase === 'tele' ? Math.min(1, a.t / a.tele) : 0;
  const strikeFade = a.phase === 'strike' ? 1 - a.t / BAL.STRIKE_FLASH : 0;
  // Red telegraph gets more solid as the hit gets closer
  const redFill = `rgba(255,0,0,${0.18 + 0.32 * p})`;

  if (a.kind === 'circle' || a.kind === 'poke') {
    if (a.phase === 'tele') return (
      <g>
        <circle cx={a.cx} cy={a.cy} r={a.r} fill={redFill} stroke="#ff2a2a" strokeWidth={2.5} />
        <circle cx={a.cx} cy={a.cy} r={a.r * p} fill="none" stroke="#ff8080" strokeWidth={2} opacity={0.8} />
      </g>
    );
    return <circle cx={a.cx} cy={a.cy} r={a.r} fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth={12 * k} opacity={strikeFade}
      style={{ filter: 'drop-shadow(0 0 10px #fff)' }} />;
  }
  if (a.kind === 'slash') {
    if (a.phase === 'tele') return <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={redFill} strokeWidth={a.w} strokeLinecap="round" />;
    return <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#fff" strokeWidth={a.w * 0.4} opacity={strikeFade} strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 0 10px #fff)' }} />;
  }
  if (a.kind === 'shot') {
    if (a.phase === 'tele') {
      const L = 2000;
      return <line x1={a.sx} y1={a.sy} x2={a.sx + a.ux * L} y2={a.sy + a.uy * L} stroke={redFill} strokeWidth={a.r * 2.2} strokeLinecap="round" strokeDasharray={`${14 * k} ${8 * k}`} />;
    }
    return <circle cx={a.x} cy={a.y} r={a.r} fill="#fff" stroke="#ff2a2a" strokeWidth={4 * k} style={{ filter: 'drop-shadow(0 0 8px #ff2a2a)' }} />;
  }
  if (a.kind === 'dash' && a.phase === 'tele') {
    return <line x1={a.fx} y1={a.fy} x2={a.tx} y2={a.ty} stroke={`rgba(255,0,0,${0.25 + 0.4 * p})`} strokeWidth={6 * k} strokeDasharray={`${10 * k} ${8 * k}`} />;
  }
  return null;
}

function EffectShape({ f, k }) {
  const p = f.t / 0.5;
  if (f.kind === 'poof') return <circle cx={f.x} cy={f.y} r={f.r * (0.6 + p)} fill="none" stroke="#fff" strokeWidth={3 * k} opacity={1 - p} />;
  if (f.kind === 'burst') return <circle cx={f.x} cy={f.y} r={f.r * (0.4 + 0.6 * p)} fill={f.color} fillOpacity={0.15 * (1 - p)} stroke={f.color} strokeWidth={4 * k} opacity={1 - p} />;
  return null;
}

function stageBarProps(s, bossParts) {
  let label, ratio, color;
  const boss = bossParts.length > 0 && s.bossInfo;
  if (boss) {
    label = s.bossInfo.name;
    ratio = bossParts.reduce((a, e) => a + Math.max(0, e.hp), 0) / s.bossInfo.maxHp;
    color = '#ff4400';
  }
  else if (s.phase === 'fight') { label = `STAGE ${s.stageNum} · ${s.kills}/${s.stage.killTarget} kills`; ratio = s.kills / s.stage.killTarget; color = '#ff8c00'; }
  else if (s.phase === 'bossIntro') { label = `STAGE ${s.stageNum} · BOSS`; ratio = 1; color = '#ff4400'; }
  else { label = `STAGE ${s.stageNum}`; ratio = 1; color = '#4ade80'; }
  return { label, ratio: Math.round(Math.max(0, Math.min(1, ratio)) * 400) / 400, color, boss: !!boss };
}

const StageBarView = memo(function StageBarView({ label, ratio, color, boss }) {
  return (
    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 'min(70%, 460px)', zIndex: 13, pointerEvents: 'none', textAlign: 'center' }}>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 1, textShadow: '0 1px 4px #000', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {boss && '⚔ '}{label}
      </div>
      <div style={{ height: boss ? 10 : 6, background: 'rgba(0,0,0,0.55)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.15s' }} />
      </div>
    </div>
  );
});

// One enemy. Only re-renders when how it LOOKS changes; its position is set
// directly on the DOM node by BattleArena every frame.
const EnemySprite = memo(function EnemySprite({ id, register, img, shape, tint, tier, role, grouped, size, k, isWormHead,
  frozen, down, flashRed, hurt, dashing, paused, hpPct, shieldR, shieldPct, weak }) {
  let filter = tint ?? 'none';
  if (down) filter = 'grayscale(1) brightness(0.5)';
  else if (frozen) filter = 'hue-rotate(180deg) brightness(1.4) saturate(2)';
  else if (flashRed) filter = 'none';
  else if (hurt) filter = `${tint ?? ''} brightness(2.2)`;
  const showBar = tier !== 'boss' || role === 'hydra' || (grouped && role !== 'head');
  return (
    <div ref={el => register(id, el)} style={{
      position: 'absolute', left: 0, top: 0, width: size, height: size, willChange: 'transform',
      zIndex: isWormHead ? 9 : tier === 'boss' ? 6 : tier === 'treasure' ? 8 : 7, pointerEvents: 'none',
    }}>
      {shieldR > 0 && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: shieldR * 2, height: shieldR * 2, transform: 'translate(-50%,-50%)',
          borderRadius: '50%', pointerEvents: 'none', zIndex: -1,
          background: shieldPct > 0 ? `rgba(80,180,255,${0.08 + 0.14 * shieldPct / 100})` : 'transparent',
          border: shieldPct > 0 ? '2px solid rgba(125,211,252,0.85)' : '2px dashed rgba(125,211,252,0.25)',
          boxShadow: shieldPct > 0 ? 'inset 0 0 24px rgba(125,211,252,0.45)' : 'none',
        }} />
      )}
      {dashing && <div className="dash-trail" />}
      {shape === 'segment' ? (
        <div className="worm-seg" style={{ filter: frozen ? 'hue-rotate(180deg) brightness(1.4)' : hurt ? 'brightness(2)' : 'none' }} />
      ) : (
        <img src={img} alt="" draggable={false} decoding="async"
          className={`enemy-img${tier === 'boss' && !grouped ? ' boss' : ''}${flashRed ? ' flash-red' : ''}${tier === 'treasure' ? ' treasure' : ''}${isWormHead ? ' worm-head' : ''}`}
          style={{ width: '100%', height: '100%', objectFit: isWormHead ? 'cover' : 'contain', filter, animationPlayState: frozen || down || paused ? 'paused' : 'running' }} />
      )}
      {down > 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', fontWeight: 900, fontSize: 13 * Math.max(0.8, k), textShadow: '0 1px 4px #000' }}>DOWN {down.toFixed(1)}s</div>}
      {shieldR > 0 && (
        <div style={{ position: 'absolute', left: '10%', right: '10%', bottom: '100%', height: 5, background: '#0b2233', borderRadius: 3, marginBottom: 3 }}>
          <div style={{ width: `${shieldPct}%`, height: '100%', borderRadius: 3, background: '#38bdf8' }} />
        </div>
      )}
      {tier === 'treasure' && <div className="lure" />}
      {weak && weak.split('|').map(w => {
        const [wid, rx, ry] = w.split(':');
        return <div key={wid} className="weak-pt" style={{ left: `${50 + rx * 100}%`, top: `${50 + ry * 100}%`, width: 30 * k, height: 30 * k }} />;
      })}
      {showBar && (
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: '100%', height: role === 'hydra' ? 8 : 5, background: '#222a', borderRadius: 3, marginTop: 2 }}>
          <div style={{ width: `${hpPct}%`, height: '100%', borderRadius: 3, background: role === 'hydra' ? '#ff4400' : tier === 'elite' ? '#c084fc' : tier === 'treasure' ? '#fbbf24' : '#ff4444' }} />
        </div>
      )}
      {frozen && <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 8px)', color: '#67e8f9', fontSize: 11, whiteSpace: 'nowrap' }}>❄</div>}
    </div>
  );
});

// Floating damage numbers: they animate with CSS once placed, so this layer
// only re-renders when one is added or removed (ver changes).
const FloaterLayer = memo(function FloaterLayer({ floaters, k }) {
  return floaters.map(f => (
    <div key={f.id} className="dmg-float" style={{
      left: f.x, top: f.y, color: f.color,
      fontSize: (f.big ? 20 : 15) * Math.max(0.8, k), fontWeight: f.big ? 900 : 700,
    }}>
      {f.text}
      {f.icon === 'coin' && <img src={`${BASE}ui/ui_cucoin.png`} alt="" style={{ width: 18 * k, height: 18 * k, marginLeft: 3, imageRendering: 'pixelated', verticalAlign: 'middle' }} />}
      {f.icon === 'gem'  && <img src={`${BASE}ui/ui_frailite.png`} alt="" style={{ width: 18 * k, height: 18 * k, marginLeft: 3, imageRendering: 'pixelated', verticalAlign: 'middle' }} />}
    </div>
  ));
}, (a, b) => a.ver === b.ver && a.k === b.k);

const Chip = ({ color, children }) => (
  <div style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}`, color, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{children}</div>
);

const StatusFrame = memo(function StatusFrame({ frameRef, mobile, mainCard, hpRatio, charge, ult, ultReady, onUlt, hp, maxHp }) {
  return (
    <div ref={frameRef} style={{ position: 'absolute', left: '2%', bottom: mobile ? '6%' : '4%', zIndex: 14, width: mobile ? '46%' : '30%', maxWidth: mobile ? 190 : 300, aspectRatio: '919 / 677' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Portrait first, so the frame's ring and bar sit on top of it */}
        {mainCard && STATUS_PORTRAITS[mainCard.id] && (
          <div style={{ position: 'absolute', right: '0.5%', bottom: '0.5%', width: '95%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
            <img src={STATUS_PORTRAITS[mainCard.id]} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          </div>
        )}
        {/* No custom status portrait yet → crop the card art into the portrait area */}
        {mainCard && !STATUS_PORTRAITS[mainCard.id] && (
          <div style={{
            position: 'absolute', left: '2%', top: '4%', width: '54%', height: '84%', overflow: 'hidden', pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(ellipse 72% 70% at 50% 42%, #000 55%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 72% 70% at 50% 42%, #000 55%, transparent 100%)',
          }}>
            <img src={mainCard.characterImage || mainCard.image} alt="" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%', transform: 'scale(1.35)', transformOrigin: '50% 25%' }} />
          </div>
        )}
        {/* Ult orb — fills from the bottom with charge */}
        <img src={`${BASE}ui/ul_statusult.png`} alt="" draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
          clipPath: `inset(${(1 - (ult ? charge : 0)) * 100}% 0 0 0)`,
          filter: ultReady ? 'drop-shadow(0 0 10px #c084fc) brightness(1.2)' : 'none',
          animation: ultReady ? 'orbReady 0.9s ease-in-out infinite' : 'none',
        }} />
        <img src={`${BASE}ui/ui_status.png`} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
        <div
          onPointerDown={e => { e.stopPropagation(); onUlt(); }}
          title={ult ? `${ult.name} — ${ult.desc}` : 'Ult unlocks at LV50'}
          style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 'clamp(11px,1.6vw,18px)', textShadow: '0 0 8px #000', cursor: ultReady ? 'pointer' : 'default', textAlign: 'center' }}>
          {!ult ? 'LV50' : ultReady ? (mobile ? 'TAP' : 'E') : `${Math.floor(charge * 100)}%`}
        </div>
        <img src={`${BASE}ui/ui_statushp.png`} alt="" draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', imageRendering: 'pixelated', pointerEvents: 'none',
          clipPath: `inset(0 ${100 - hpRatio * 100}% 0 0)`, transition: 'clip-path 0.15s',
        }} />
        <div style={{ position: 'absolute', left: '4%', bottom: '-18px', color: '#ddd', fontSize: 11, textShadow: '0 1px 3px #000', pointerEvents: 'none' }}>
          {Math.ceil(hp)}/{maxHp} HP
        </div>
      </div>
    </div>
  );
});

const ARENA_CSS = `
  .battle-arena img { -webkit-user-drag: none; user-select: none; }
  .enemy-img { display:block; image-rendering:pixelated; animation: enemyBob 2.4s ease-in-out infinite; }
  .enemy-img.boss { animation: enemyBob 1.8s ease-in-out infinite, bossPulse 1.2s ease-in-out infinite; }
  .enemy-img.flash-red { animation: flashRed 0.22s steps(2) infinite !important; }
  .enemy-img.treasure { animation: treasureWiggle 0.5s ease-in-out infinite; }
  .worm-seg { width:100%; height:100%; border-radius:50%;
              background: radial-gradient(circle at 35% 30%, #c2410c, #7f1d1d 55%, #2a0a0a);
              border: 2px solid #451a03; box-shadow: inset 0 -4px 8px rgba(0,0,0,0.5), 0 0 6px rgba(0,0,0,0.6); }
  .enemy-img.worm-head { border-radius:50%; border:3px solid #7f1d1d; box-shadow:0 0 14px rgba(255,60,0,0.8); animation:none; }
  .dash-trail { position:absolute; inset:10%; border-radius:50%; box-shadow: 0 0 24px 12px rgba(255,40,40,0.55); }
  .lure { position:absolute; inset:-30%; border-radius:50%; pointer-events:none;
          background: radial-gradient(circle, rgba(255,215,90,0.35) 0%, transparent 65%); animation: lurePulse 1s ease-in-out infinite; }
  .weak-pt { position:absolute; transform:translate(-50%,-50%); border-radius:50%;
             background:radial-gradient(circle,#ffff44 30%,#ff8800); border:2px solid #fff;
             box-shadow:0 0 14px #ffff44; animation: weakPulse 0.45s ease-in-out infinite; }
  .dmg-float { position:absolute; pointer-events:none; z-index:15; white-space:nowrap;
               transform:translate(-50%,-50%); text-shadow:0 1px 4px rgba(0,0,0,0.9);
               animation: floatUp 1.1s ease-out forwards; }
  .stage-banner { position:absolute; top:42%; left:50%; transform:translate(-50%,-50%); text-align:center;
                  pointer-events:none; z-index:16; animation: bannerIn 0.4s ease-out; width:100%; }
  @keyframes enemyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes bossPulse { 0%,100%{filter:drop-shadow(0 0 6px #ff4400)} 50%{filter:drop-shadow(0 0 22px #ff4400)} }
  @keyframes flashRed { 0%{filter:brightness(1.4) sepia(1) saturate(8) hue-rotate(-30deg) drop-shadow(0 0 12px red)} 100%{filter:none} }
  @keyframes treasureWiggle { 0%,100%{transform:rotate(-8deg) scale(1)} 50%{transform:rotate(8deg) scale(1.08)} }
  @keyframes lurePulse { 0%,100%{opacity:0.5; transform:scale(0.9)} 50%{opacity:1; transform:scale(1.1)} }
  @keyframes weakPulse { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.35)} }
  @keyframes floatUp { 0%{opacity:1; transform:translate(-50%,-50%)} 70%{opacity:1} 100%{opacity:0; transform:translate(-50%, calc(-50% - 56px))} }
  @keyframes bannerIn { from{opacity:0; transform:translate(-50%,-50%) scale(0.7)} to{opacity:1; transform:translate(-50%,-50%) scale(1)} }
  @keyframes orbReady { 0%,100%{filter:drop-shadow(0 0 6px #c084fc)} 50%{filter:drop-shadow(0 0 18px #e9d5ff) brightness(1.25)} }
  @keyframes ultFlash { from{opacity:0.7} to{opacity:0} }
`;
