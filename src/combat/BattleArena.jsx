import { Children, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BAL } from './balance';
import { AFFIXES, ENEMY_TYPES } from './enemies';
import { SKILLS, describeKit } from './kits';
import { SKILL_NAMES } from './kitRuntime';
import { getSettings } from '../utils/settings';
import FocusImg from '../components/FocusImg';
import CctvOverlay from './CctvOverlay';
import TapButton from '../components/TapButton';
import { Icon, SvgIcon } from '../components/Icon';
import { withIcons } from '../utils/withIcons';

const BASE = import.meta.env.BASE_URL;
const STATUS_PORTRAITS = {
  1:  `${BASE}ui/ui_statusastrec.png`,
  2:  `${BASE}ui/ui_statusbio.png`,
  6:  `${BASE}ui/ui_statusice.png`,
  9:  `${BASE}ui/ul_statusreef.png`,
  10: `${BASE}ui/ui_statusforbiddenone.png`,
  99: `${BASE}ui/ui_statushox.png`,
};
// Battle background: three layers of the city painting, back to front, each shifting with
// the cursor by `depth` px (farther = less) for a parallax effect. A stage with its own
// `bg` (story levels) shows that one picture instead.
// SCROLL (test): the layers also slide sideways forever at `speed` px/s (the view travels to the
// right; it eases to a stop while a boss is out), using the *_loop pictures (each painting + its mirror image, so it repeats seamlessly).
const SCROLL = true;
const LOOP_ASPECT = 4800 / 1682;   // width / height of the *_loop pictures
const PARALLAX = [
  { src: `${BASE}backgrounds/city_sky.png`,  loop: `${BASE}backgrounds/city_sky_loop.png`,  depth: 6,  speed: 8 },
  { src: `${BASE}backgrounds/city_far.png`,  loop: `${BASE}backgrounds/city_far_loop.png`,  depth: 14, speed: 22 },
  { src: `${BASE}backgrounds/city_near.png`, loop: `${BASE}backgrounds/city_near_loop.png`, depth: 28, speed: 55 },
];
const MAHORAGA_IMG = `${BASE}allies/mahoraga.gif`;
const SHIKI_ICON = { dog: '🐺', toad: '🐸', nue: '🦅' };

// Load attack-pose pictures up front so the first wind-up doesn't show a blank
Object.values(ENEMY_TYPES).forEach(t => {
  if (!t.poses) return;
  [t.poses.warn, t.poses.attack].flat().filter(Boolean).forEach(src => { const im = new Image(); im.src = src; });
});

// Draws the engine every animation frame and feeds it mouse/touch input.
// `mobile` makes the status frame a bit bigger so it's easy to tap on a phone.
export default function BattleArena({ engine, mainCard, mobile, children, comboTop = 40 }) {
  const ref = useRef(null);
  const frameRef = useRef(null);
  // enemy id → DOM node; positions are written straight to these every frame
  const nodes = useRef(new Map());
  const parallaxRefs = useRef([]);
  const parallax = useRef({ x: 0, y: 0 });
  const scroll = useRef({ off: [0, 0, 0], v: 1, last: 0, tile: [0, 0, 0], key: '', els: null });   // SCROLL: offsets, speed factor (0 = stopped), last frame time, tile widths
  const scrollRefs = useRef([]);   // SCROLL: the wide strip inside each layer that slides
  const register = useCallback((id, el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id); }, []);
  const onUlt = useCallback(() => engine.activateUlt(), [engine]);
  const [, setFrame] = useState(0);
  const [touchMode, setTouchMode] = useState(false);

  // Debug handle for the browser console (window.__battle): always in dev,
  // and on the live site when you open it with ?debug at the end of the URL
  useEffect(() => {
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__battle = engine;
  }, [engine]);

  // pictures an enemy switches to mid-fight (a broken shield): load them up front so the swap is instant
  useEffect(() => { Object.values(ENEMY_TYPES).forEach(t => { if (t.imgBroken) new Image().src = t.imgBroken; }); }, []);

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
    let reported = false;
    const loop = (now) => {
      // One bad frame must never freeze the whole battle
      try { engine.update((now - last) / 1000); }
      catch (err) { if (!reported) { console.error('battle update failed:', err); reported = true; } }
      last = now;
      setFrame(f => (f + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // E = ult
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.repeat) return;   // holding E doesn't spam it
      if (engine.state.choosing && /^[1-3]$/.test(e.key)) { engine.choose(Number(e.key) - 1); return; }
      if (e.key === 'e' || e.key === 'E') engine.activateUlt();
      if (e.key === 'q' || e.key === 'Q') engine.special();   // M2 for trackpads
    };
    const onKeyUp = (e) => { if (e.key === 'q' || e.key === 'Q') engine.specialUp(); };
    // M2 is tracked with mouse events: a right-press while M1 is already held doesn't fire pointerdown
    const onMouseUp = (e) => { if (e.button === 2) engine.specialUp(); };
    // let go of the mouse outside the window / switch apps: the holds end
    const release = () => { engine.pointerHold(false); engine.specialUp(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('blur', release);
    };
  }, [engine]);

  const toLocal = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' !== touchMode) setTouchMode(e.pointerType === 'touch');
    if (e.button !== 0) return;   // M2 comes through onMouseDown
    const [x, y] = toLocal(e);
    // keep getting moves / the release even if the cursor leaves the arena while held
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    engine.pointerDown(x, y);
  };
  const onPointerMove = (e) => { const [x, y] = toLocal(e); engine.pointerMove(x, y); };
  const onPointerUp = (e) => { if (e.button === 0 || e.pointerType !== 'mouse') engine.pointerHold(false); };
  const onMouseDown = (e) => { if (e.button === 2) { const [x, y] = toLocal(e); engine.special(x, y); } };   // M2: the card's special move
  const onSpecial = useCallback((down) => (down ? engine.special() : engine.specialUp()), [engine]);

  const s = engine.state;
  const k = s.k;
  const pl = s.player;
  const shakeOn = getSettings().shake;
  const cctvOn = getSettings().cctv;
  const shakeX = shakeOn && s.shake > 0 ? (Math.random() - 0.5) * 22 * s.shake : 0;
  const shakeY = shakeOn && s.shake > 0 ? (Math.random() - 0.5) * 22 * s.shake : 0;
  const bossParts = s.enemies.filter(e => e.tier === 'boss');
  // worm parts nearer the head draw on top of the ones behind them
  const hasWorm = s.enemies.some(e => e.move === 'worm');
  const drawList = hasWorm
    ? [...s.enemies.filter(e => e.move !== 'worm'), ...s.enemies.filter(e => e.move === 'worm').sort((a, b) => b.segIndex - a.segIndex)]
    : s.enemies;
  // who is winding up an attack right now (for enemies with attack poses)
  const windingUp = new Set(s.attacks.filter(a => a.phase === 'tele' && a.owner != null).map(a => a.owner));
  const poseOf = (e) => (!e.type.poses ? null : e.dashing || e.attackT > 0 ? 'attack' : e.flashRed || windingUp.has(e.id) ? 'warn' : null);
  const ult = s.stats.ult;
  const charge = s.ult.charge;
  const ultCd = s.ult.cd > 0 ? Math.ceil(s.ult.cd) : 0;
  const ultReady = ult && charge >= 1 && !ultCd && !s.ult.active && !s.ult.blocked;
  const curSkill = engine.curSkill?.();
  const curPassive = engine.curPassive?.();
  const sp = engine.specialInfo?.();
  const P = pl.pos;
  const hover = s.hoverId != null ? s.enemies.find(e => e.id === s.hoverId) : null;
  const OVER = new Set(['dslash', 'beam', 'slash', 'zap', 'fist', 'stab', 'ratio', 'spiral', 'crack', 'cut', 'implode', 'spikes', 'ring']);   // effects drawn above enemies
  const hpRatio = pl.maxHp ? pl.hp / pl.maxHp : 0;

  // Move every enemy by setting its transform directly (no React re-render
  // needed for movement). Runs after each frame's render, before paint.
  useLayoutEffect(() => {
    // parallax: layers drift opposite to the cursor (eased), farther layers less
    if (!s.stage.bg && s.W) {
      const P = s.player.pos, par = parallax.current;
      const tx = P ? (P.x / s.W - 0.5) * -2 : 0, ty = P ? (P.y / s.H - 0.5) * -2 : 0;
      // SCROLL: eases to a stop while a boss is coming / out, and back up after
      const sc = scroll.current, now = performance.now(), dt = sc.last ? Math.min(0.1, (now - sc.last) / 1000) : 0;
      sc.last = now;
      const boss = s.phase === 'boss' || s.phase === 'bossIntro' || s.paused;
      sc.v += ((boss ? 0 : 1) - sc.v) * Math.min(1, dt * 1.6);
      par.x += (tx - par.x) * 0.06; par.y += (ty - par.y) * 0.06;
      // one painting's width at the layer's height; only re-measured when the arena changes size
      const key = `${s.W}x${s.H}`, strips = scrollRefs.current;
      if (strips.some((el, i) => el !== sc.els?.[i])) { sc.els = [...strips]; sc.key = ''; }   // new strips (arena re-opened)
      if (SCROLL && sc.key !== key) {
        sc.key = key;
        PARALLAX.forEach((l, i) => {
          const strip = scrollRefs.current[i];
          if (!strip) return;
          sc.tile[i] = strip.offsetHeight * LOOP_ASPECT;
          strip.style.width = `calc(100% + ${Math.ceil(sc.tile[i]) + 2}px)`;
        });
      }
      PARALLAX.forEach((l, i) => {
        const el = parallaxRefs.current[i];
        if (!el) return;
        el.style.transform = `translate3d(${(par.x * l.depth).toFixed(2)}px, ${(par.y * l.depth * 0.4).toFixed(2)}px, 0)`;
        // slide the strip left (= travelling right) and jump back one painting width, which looks identical.
        // A transform is moved by the GPU; changing background-position repainted the whole layer every frame.
        const strip = scrollRefs.current[i], T = sc.tile[i];
        if (SCROLL && strip && T > 0) {
          sc.off[i] = (sc.off[i] + l.speed * s.k * sc.v * dt) % T;
          strip.style.transform = `translate3d(${(-sc.off[i]).toFixed(1)}px, 0, 0)`;
        }
      });
    }
    for (const e of s.enemies) {
      const el = nodes.current.get(e.id);
      if (!el) continue;
      const half = e.size * s.k / 2;
      el.style.transform = `translate3d(${e.x - half}px, ${e.y - half}px, 0)`;
      // art with a `facing` turns toward where it's going (worm parts)
      if (e.facing != null) el.style.setProperty('--rot', `${Math.round(e.angle * 57.2958 - e.facing)}deg`);
      // hydra heads turn to look at you
      if (e.role === 'hydra') el.style.setProperty('--tilt', `${(e.tilt ?? 0).toFixed(1)}deg`);
      // attack poses face the attack: mirrored when aiming the other way, then tilted
      if (e.type.poses && e.aim != null && e.type.poseFacing != null) {
        const deg = e.aim * 57.2958;
        const aimLeft = Math.cos(e.aim) < 0, artLeft = Math.cos(e.type.poseFacing / 57.2958) < 0;
        let rot = aimLeft ? deg - 180 : deg;
        rot = ((rot + 540) % 360) - 180;
        el.style.setProperty('--aim-rot', `${Math.round(rot)}deg`);
        el.style.setProperty('--aim-flip', aimLeft === artLeft ? '1' : '-1');
      }
    }
  });

  return (
    <>
      <div
        ref={ref}
        className="battle-arena"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onMouseDown={onMouseDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onContextMenu={e => e.preventDefault()}
        style={{
          flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
          border: '2px solid #cc8800', borderRadius: 6,
          backgroundImage: s.stage.bg ? `url(${s.stage.bg})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0f1625',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {!s.stage.bg && PARALLAX.map((l, i) => (
          <div key={l.src} ref={el => { parallaxRefs.current[i] = el; }} style={{ position: 'absolute', inset: `-${l.depth + 4}px`, pointerEvents: 'none', overflow: 'hidden',
            backgroundImage: SCROLL ? undefined : `url(${l.src})`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom', willChange: 'transform' }}>
            {SCROLL && <div ref={el => { scrollRefs.current[i] = el; }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '300%',
              backgroundImage: `url(${l.loop})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x', backgroundPosition: 'left bottom', willChange: 'transform' }} />}
          </div>
        ))}
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${shakeX}px,${shakeY}px)` }}>
          <div style={{ position: 'absolute', inset: 0, background: s.stage.bg ? 'rgba(10,14,30,0.45)' : 'rgba(10,14,30,0.22)', pointerEvents: 'none' }} />

          {/* ── Malevolent Shrine: the domain closes in from where you cast it ── */}
          {s.ult.active?.type === 'shrine' && <ShrineDomain dom={s.ult.active} W={s.W} H={s.H} k={k} time={s.time} />}

          {/* ── Attack areas ─────────────────────────────────────────── */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, overflow: 'visible' }}>
            <defs>
              <radialGradient id="lavaGrad">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#f97316" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.15" />
              </radialGradient>
            </defs>
            {s.zones.map(z => {
              const fade = Math.min(1, z.t / 0.25, (z.life - z.t) / 0.6);
              return <circle key={z.id} cx={z.x} cy={z.y} r={z.r} fill="url(#lavaGrad)" opacity={Math.max(0, fade)} stroke="#fb923c" strokeWidth={2} strokeOpacity={0.6 * fade} />;
            })}
            {s.fire.length > 0 && (
              <g>
                {s.fire.map(f => {
                  const o = Math.max(0, 1 - f.t / f.life);
                  return (
                    <g key={f.id} opacity={o}>
                      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#f97316" strokeWidth={22 * k} strokeLinecap="round" opacity={0.25} />
                      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#ea580c" strokeWidth={12 * k} strokeLinecap="round" />
                      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#fde68a" strokeWidth={4 * k} strokeLinecap="round" />
                    </g>
                  );
                })}
              </g>
            )}
            {s.kit.meteor && (() => {
              const m = s.kit.meteor, p = Math.min(1, m.t / m.tele);
              return (
                <g>
                  <circle cx={m.x} cy={m.y} r={m.r} fill={`rgba(249,115,22,${0.1 + 0.25 * p})`} stroke="#fb923c" strokeWidth={3} strokeDasharray={`${12 * k} ${8 * k}`} />
                  <circle cx={m.x} cy={m.y} r={m.r * p} fill="none" stroke="#fde68a" strokeWidth={2} />
                </g>
              );
            })()}
            {s.hazards.map(h => {
              const grow = Math.min(1, h.t / h.grow), fade = h.t > h.life - 0.5 ? (h.life - h.t) / 0.5 : 1;
              return <circle key={h.id} cx={h.x} cy={h.y} r={h.r * (0.4 + 0.6 * grow)} fill={`rgba(132,204,22,${(grow < 1 ? 0.15 : 0.32) * fade})`}
                stroke={`rgba(190,242,100,${0.8 * fade})`} strokeWidth={2} strokeDasharray={grow < 1 ? '4 4' : 'none'} />;
            })}
            {/* enemies thrown by Jerry's repel leave a streak */}
            {s.enemies.map(e => {
              if (!e.kb) return null;
              const sp = Math.hypot(e.kb.vx, e.kb.vy);
              if (sp < 200 * k) return null;
              const len = Math.min(sp * 0.08, 140 * k), ux = e.kb.vx / sp, uy = e.kb.vy / sp;
              return <line key={`kb${e.id}`} x1={e.x - ux * len} y1={e.y - uy * len} x2={e.x} y2={e.y} stroke="#bfdbfe"
                strokeWidth={e.size * k * 0.45} strokeLinecap="round" opacity={0.3} />;
            })}
            {s.attacks.map(a => <AttackShape key={a.id} a={a} k={k} />)}
            {/* something walking in from off-screen: an arrow on that edge (red = a big one) */}
            {s.enemies.map(e => {
              if (!e.entering || (e.x > 0 && e.x < s.W)) return null;
              const left = e.x <= 0, x = left ? 6 * k : s.W - 6 * k, big = e.tier === 'elite', sz = (big ? 16 : 10) * k, d = left ? 1 : -1;
              return <polygon key={`in${e.id}`} points={`${x},${e.y - sz} ${x + d * sz * 1.3},${e.y} ${x},${e.y + sz}`}
                fill={big ? '#ef4444' : '#fbbf24'} opacity={0.6 + 0.4 * Math.abs(Math.sin(s.time * 8))} style={{ filter: `drop-shadow(0 0 6px ${big ? '#ef4444' : '#fbbf24'})` }} />;
            })}
            {s.shots.map(sh => (
              <circle key={sh.id} cx={sh.x} cy={sh.y} r={8 * k} fill="#e9d5ff" stroke="#a855f7" strokeWidth={3 * k} style={{ filter: 'drop-shadow(0 0 6px #a855f7)' }} />
            ))}
            {s.effects.filter(f => !OVER.has(f.kind)).map(f => <EffectShape key={f.id} f={f} k={k} />)}
          </svg>

          {/* ── Allies (crawlers, shikigami) ─────────────────────────── */}
          {s.allies.map(a => {
            if (a.kind === 'crawler') {
              const sz = a.size * k;
              return (
                <div key={a.id} className="crawler" style={{ position: 'absolute', left: a.x - sz / 2, top: a.y - sz / 2, width: sz, height: sz, zIndex: 8, pointerEvents: 'none' }}>
                  <img src={a.img} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'hue-rotate(250deg) saturate(1.8) brightness(0.8) drop-shadow(0 0 6px #a855f7)' }} />
                </div>
              );
            }
            if (SHIKI_ICON[a.kind]) return (
              <div key={a.id} className={`shiki ${a.kind}`} style={{ position: 'absolute', left: a.x, top: a.y, zIndex: 8, pointerEvents: 'none', fontSize: (a.kind === 'nue' ? 40 : 44) * k,
                opacity: a.life < 1 ? a.life : 1, color: '#c7d2fe' }}><Icon name={a.kind} /></div>
            );
            return null;
          })}

          {/* ── Hydra necks: behind its heads, in front of small enemies ─ */}
          <HydraNecks heads={s.enemies.filter(e => e.role === 'hydra')} k={k} time={s.time} />

          {/* ── Enemies ──────────────────────────────────────────────── */}
          {drawList.map(e => {
            const isWormHead = e.move === 'worm' && e.role === 'head';
            return (
              <EnemySprite key={e.id} id={e.id} register={register}
                img={e.shield && e.shield.hp <= 0 && e.type.imgBroken ? e.type.imgBroken : e.img} shape={e.shape} tint={e.tint} tier={e.tier} role={e.role} grouped={!!e.group}
                size={e.size * k} k={k} isWormHead={isWormHead}
                frozen={e.frozen > 0} down={e.down > 0 ? Math.ceil(e.down * 10) / 10 : 0}
                flashRed={e.flashRed} hurt={e.hurt > 0} dashing={!!e.dashing} paused={s.timeStop > 0}
                hpPct={Math.max(0, Math.round(e.hp / e.maxHp * 200) / 2)}
                shieldR={e.shield ? e.shieldCfg.radius * k : 0}
                affix={e.affix} pose={poseOf(e)} poses={e.type.poses} drawScale={e.drawScale} turns={e.facing != null}
                sway={e.role === 'hydra' ? e.segIndex : null}
                shieldPct={e.shield ? Math.round(e.shield.hp / e.shield.max * 100) : 0}
                mirror={e.refl && e.refl.state !== 'idle' ? e.refl.state : null} fort={e.fortT > 0} badge={e.type.badge}
                weak={e.type.weakPoints ? s.weakPts.filter(w => w.boss === e.id).map(w => `${w.id}:${w.rx}:${w.ry}`).join('|') : ''} />
            );
          })}

          {/* ── Kit visuals above the enemies ───────────────────────── */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9, overflow: 'visible' }}>
            {s.kit.souls > 0 && P && (
              <g>
                {Array.from({ length: s.kit.souls }, (_, i) => {
                  const a = s.time * 1.8 + (i / s.kit.souls) * Math.PI * 2;
                  const rr = 75 * k + Math.sin(s.time * 3 + i) * 6 * k;
                  const x = P.x + Math.cos(a) * rr, y = P.y + Math.sin(a) * rr;
                  return <g key={i}><circle cx={x} cy={y} r={10 * k} fill="#e879f9" opacity={0.25} /><circle cx={x} cy={y} r={5 * k} fill="#f5d0fe" /></g>;
                })}
              </g>
            )}
            {/* Jerry's Infinity bubble (passive) */}
            {curPassive?.type === 'infinity' && P && !s.mahoraga && (
              <g opacity={0.25 + 0.6 * s.kit.inf / 100}>
                <circle cx={P.x} cy={P.y} r={curPassive.radius * k} fill="rgba(147,197,253,0.07)" stroke="#93c5fd" strokeWidth={2}
                  strokeDasharray={s.kit.inf < 25 ? `${6 * k} ${6 * k}` : 'none'} />
              </g>
            )}
            {/* Bio's entanglement: links between the enemies that share damage */}
            {s.kit.entangle && (() => {
              const es = s.kit.entangle.ids.map(id => s.enemies.find(e => e.id === id)).filter(Boolean);
              const fade = Math.min(1, s.kit.entangle.t / 0.6);
              return (
                <g opacity={0.85 * fade} style={{ filter: 'drop-shadow(0 0 6px #8b5cf6)' }}>
                  {es.slice(1).map(e => <line key={e.id} x1={es[0].x} y1={es[0].y} x2={e.x} y2={e.y} stroke="#c4b5fd" strokeWidth={2.5 * k}
                    strokeDasharray={`${8 * k} ${5 * k}`} strokeDashoffset={-s.time * 40} />)}
                  {es.map(e => <circle key={`c${e.id}`} cx={e.x} cy={e.y} r={e.size * k * 0.55} fill="none" stroke="#a78bfa" strokeWidth={2 * k} />)}
                </g>
              );
            })()}
            {/* HOLD moves: a ring around the cursor fills while you charge */}
            {P && !s.mahoraga && ((curSkill?.style === 'hold' && pl.held) || (curSkill?.style === 'charge' && pl.m2)) && (() => {
              // HOLD: fills over the charge time. CHARGE (M2 held): fills over 1s, then it's charging
              const f = curSkill.style === 'charge' ? Math.min(1, s.time - pl.m2.t0)
                : curSkill.type === 'tide' ? (s.kit.tide ? 1 - s.kit.tide.t / curSkill.dur : s.kit.tideHold === pl.held.t0 ? 0 : Math.min(1, (s.time - pl.held.t0) / curSkill.full))
                : Math.max(0, Math.min(1, (s.time - pl.held.t0 - 0.25) / Math.max(0.01, curSkill.full - 0.25)));
              const R = 30 * k, C = 2 * Math.PI * R, col = { lance: '#67e8f9', tide: '#38bdf8', flashstep: '#fda4af', souls: '#e879f9', crawlers: '#c084fc', platinum: '#f472b6' }[curSkill.type] ?? '#fff';
              const tideR = 0;
              return (
                <g>
                  {tideR > 0 && <circle cx={P.x} cy={P.y} r={tideR} fill="rgba(59,130,246,0.08)" stroke="#60a5fa" strokeWidth={2} strokeDasharray={`${8 * k} ${6 * k}`} />}
                  {curSkill.type === 'flashstep' && <circle cx={P.x} cy={P.y} r={curSkill.range * k} fill="none" stroke="#fda4af" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray={`${4 * k} ${8 * k}`} />}
                  <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={6 * k} />
                  <circle cx={P.x} cy={P.y} r={R} fill="none" stroke={col} strokeWidth={5 * k} strokeDasharray={`${C * f} ${C}`}
                    transform={`rotate(-90 ${P.x} ${P.y})`} style={f >= 1 ? { filter: `drop-shadow(0 0 8px ${col})` } : undefined} />
                </g>
              );
            })()}
            {hover && (curSkill?.type === 'ratio' || s.ult.active?.type === 'overtime') && (() => {
              const w = Math.max(70 * k, hover.size * k * 1.15), x0 = hover.x - w / 2, y = hover.y - hover.size * k * 0.5 - 20 * k, h = 9 * k;
              const ot = s.ult.active?.type === 'overtime';
              const win = s.kit.ratioWin || 0.1;
              return (
                <g>
                  <rect x={x0} y={y} width={w} height={h} rx={2} fill="rgba(0,0,0,0.65)" stroke={ot ? '#22d3ee' : '#94a3b8'} strokeWidth={1} />
                  {ot ? <rect x={x0} y={y} width={w} height={h} rx={2} fill="#22d3ee" opacity={0.6} />
                      : <rect x={x0 + w * (0.7 - win / 2)} y={y} width={w * win} height={h} fill="#facc15" opacity={0.85} />}
                  <line x1={x0 + w * 0.7} y1={y - 3 * k} x2={x0 + w * 0.7} y2={y + h + 3 * k} stroke="#fff" strokeWidth={1.5} />
                  {!ot && <line x1={x0 + w * s.kit.ratioU} y1={y - 4 * k} x2={x0 + w * s.kit.ratioU} y2={y + h + 4 * k} stroke="#ef4444" strokeWidth={3 * k} />}
                  <text x={x0 + w * 0.7} y={y - 5 * k} textAnchor="middle" fill="#fde68a" fontSize={9 * k} fontWeight={900}>7:3</text>
                </g>
              );
            })()}
            {/* Malevolent Shrine aura around your cursor */}
            {s.ult.active?.type === 'shrine' && P && (
              <g style={{ filter: 'drop-shadow(0 0 10px #dc2626)' }}>
                <circle cx={P.x} cy={P.y} r={44 * k} fill="none" stroke="#7f1d1d" strokeWidth={10 * k} opacity={0.55} />
                <circle cx={P.x} cy={P.y} r={44 * k} fill="none" stroke="#ef4444" strokeWidth={3 * k} strokeDasharray={`${18 * k} ${10 * k}`}
                  transform={`rotate(${s.time * 160} ${P.x} ${P.y})`} />
                <circle cx={P.x} cy={P.y} r={30 * k} fill="none" stroke="#fca5a5" strokeWidth={2 * k} strokeDasharray={`${6 * k} ${9 * k}`}
                  transform={`rotate(${-s.time * 240} ${P.x} ${P.y})`} />
                {Array.from({ length: 8 }, (_, i) => {
                  const a = i * 0.785 + s.time * 1.5, f = 1 + 0.35 * Math.sin(s.time * 9 + i * 1.7);
                  return <path key={i} d={`M${P.x + Math.cos(a) * 44 * k},${P.y + Math.sin(a) * 44 * k} Q${P.x + Math.cos(a + 0.25) * 62 * k * f},${P.y + Math.sin(a + 0.25) * 62 * k * f} ${P.x + Math.cos(a + 0.05) * 74 * k * f},${P.y + Math.sin(a + 0.05) * 74 * k * f}`}
                    fill="none" stroke="#dc2626" strokeWidth={3 * k} strokeLinecap="round" opacity={0.75} />;
                })}
              </g>
            )}
            {/* Doro's fire arrows streaking down */}
            {(s.kit.arrows ?? []).map(ar => {
              const p = Math.min(1, ar.t / ar.dur), sx = ar.tx - 340 * k, sy = ar.ty - 480 * k;
              const x = sx + (ar.tx - sx) * p, y = sy + (ar.ty - sy) * p, ang = Math.atan2(ar.ty - sy, ar.tx - sx), len = (ar.big ? 150 : 80) * k;
              return (
                <g key={ar.id} style={{ filter: `drop-shadow(0 0 ${ar.big ? 16 : 8}px #f97316)` }}>
                  <circle cx={ar.tx} cy={ar.ty} r={ar.r * (0.3 + 0.7 * p)} fill="rgba(249,115,22,0.12)" stroke="#fb923c" strokeWidth={2} strokeDasharray={`${8 * k} ${6 * k}`} />
                  <line x1={x - Math.cos(ang) * len} y1={y - Math.sin(ang) * len} x2={x} y2={y} stroke="#fb923c" strokeWidth={(ar.big ? 14 : 7) * k} strokeLinecap="round" />
                  <line x1={x - Math.cos(ang) * len * 0.6} y1={y - Math.sin(ang) * len * 0.6} x2={x} y2={y} stroke="#fef3c7" strokeWidth={(ar.big ? 5 : 3) * k} strokeLinecap="round" />
                </g>
              );
            })}
            {/* Hollow Purple winding up: an aiming line through your cursor, blue and red closing in */}
            {s.kit.purple && s.kit.purple.a != null && (() => {
              const pu = s.kit.purple, p = 1 - pu.t / pu.dur, L = Math.hypot(s.W, s.H) * 1.2, d = 80 * k * (1 - p);
              const cx = Math.cos(pu.a), sy = Math.sin(pu.a);
              return (
                <g>
                  <line x1={pu.x - cx * L} y1={pu.y - sy * L} x2={pu.x + cx * L} y2={pu.y + sy * L} stroke="#a855f7" strokeWidth={pu.width * (0.3 + 0.7 * p)} opacity={0.22 + 0.25 * p} />
                  <line x1={pu.x - cx * L} y1={pu.y - sy * L} x2={pu.x + cx * L} y2={pu.y + sy * L} stroke="#f5f3ff" strokeWidth={3} strokeDasharray={`${10 * k} ${8 * k}`} opacity={0.9} />
                  <circle cx={pu.x} cy={pu.y} r={7 * k} fill="#f5f3ff" />
                  <circle cx={pu.x - sy * d} cy={pu.y + cx * d} r={16 * k} fill="#3b82f6" style={{ filter: 'drop-shadow(0 0 10px #3b82f6)' }} />
                  <circle cx={pu.x + sy * d} cy={pu.y - cx * d} r={16 * k} fill="#ef4444" style={{ filter: 'drop-shadow(0 0 10px #ef4444)' }} />
                </g>
              );
            })()}
            {/* Ice holding the lance: where it will go */}
            {curSkill?.type === 'lance' && pl.held && s.kit.aimA != null && P && (() => {
              const ax = pl.held.x ?? P.x, ay = pl.held.y ?? P.y;
              const L = Math.hypot(s.W, s.H) * 1.2, cx = Math.cos(s.kit.aimA), sy = Math.sin(s.kit.aimA);
              return (
                <g>
                  <line x1={ax - cx * L} y1={ay - sy * L} x2={ax + cx * L} y2={ay + sy * L} stroke="#67e8f9" strokeWidth={2.5} strokeDasharray={`${12 * k} ${8 * k}`} opacity={0.75} />
                  <circle cx={ax} cy={ay} r={6 * k} fill="#67e8f9" />
                </g>
              );
            })()}
            {/* refabiba's water beam */}
            {s.kit.tide && (() => {
              const tb = s.kit.tide, L = Math.hypot(s.W, s.H) * 1.2, cx = Math.cos(tb.a), sy = Math.sin(tb.a), w = (curSkill?.width ?? 46) * k;
              const x1 = tb.x - cx * L, y1 = tb.y - sy * L, x2 = tb.x + cx * L, y2 = tb.y + sy * L, flow = -s.time * 420;
              const grow = Math.min(1, tb.t / 0.15);
              return (
                <g style={{ filter: 'drop-shadow(0 0 12px #0ea5e9)' }}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#075985" strokeWidth={w * 1.35 * grow} opacity={0.35} strokeLinecap="round" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth={w * grow} opacity={0.75} strokeLinecap="round" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e0f2fe" strokeWidth={w * 0.3 * grow} strokeDasharray={`${40 * k} ${22 * k}`} strokeDashoffset={flow} />
                  <circle cx={tb.x} cy={tb.y} r={w * 0.6} fill="#0ea5e9" fillOpacity={0.35} stroke="#bae6fd" strokeWidth={3 * k} opacity={0.9} />
                </g>
              );
            })()}
            {s.allies.filter(a => a.kind === 'arrow').map(a => (
              <g key={a.id} style={{ filter: 'drop-shadow(0 0 8px #f97316)' }}>
                <line x1={a.x - Math.cos(a.ang) * 60 * k} y1={a.y - Math.sin(a.ang) * 60 * k} x2={a.x} y2={a.y} stroke="#fb923c" strokeWidth={8 * k} strokeLinecap="round" />
                <circle cx={a.x} cy={a.y} r={10 * k} fill="#fde68a" />
              </g>
            ))}
            {s.kit.meteor && (() => {
              const m = s.kit.meteor, p = Math.min(1, m.t / m.tele);
              return <circle cx={m.x + (1 - p) * 160 * k} cy={m.y - (1 - p) * 420 * k} r={(18 + 22 * p) * k} fill="#fdba74" style={{ filter: 'drop-shadow(0 0 16px #f97316)' }} />;
            })()}
            {s.effects.filter(f => OVER.has(f.kind)).map(f => <EffectShape key={f.id} f={f} k={k} />)}
          </svg>

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
        {s.effects.filter(f => f.kind === 'flash').map(f => (
          <div key={f.id} style={{ position: 'absolute', inset: 0, background: f.color, opacity: 0.45 * Math.max(0, 1 - f.t / (f.life ?? 0.5)), pointerEvents: 'none', zIndex: 12 }} />
        ))}

        {/* Mahoraga: everything else goes grey, you can only watch */}
        {s.mahoraga && (() => {
          const m = s.mahoraga, w = 150 * k;
          return (
            <>
              <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none', backdropFilter: 'grayscale(1) brightness(0.7)', WebkitBackdropFilter: 'grayscale(1) brightness(0.7)' }} />
              <div className="suspended-text">SUSPENDED · WATCH AND PRAY</div>
              <div style={{ position: 'absolute', left: m.x - w / 2, top: m.y - w * 0.3, width: w, zIndex: 13, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 4 * k, display: 'flex', alignItems: 'center', gap: 4 * k }}>
                  <span className="maho-wheel" style={{ transform: `rotate(${m.wheel * 45}deg)`, fontSize: 20 * k, color: '#fde047', lineHeight: 0 }}><Icon name="wheel" /></span>
                  <div style={{ width: w * 0.8, height: 7 * k, background: 'rgba(0,0,0,0.7)', borderRadius: 4, border: '1px solid #fde047' }}>
                    <div style={{ width: `${Math.max(0, m.hp / m.maxHp) * 100}%`, height: '100%', background: '#fde047', borderRadius: 4 }} />
                  </div>
                </div>
                <img src={MAHORAGA_IMG} alt="Mahoraga" draggable={false} style={{ width: '100%', display: 'block', filter: m.invuln > 0.15 ? 'brightness(1.8)' : 'drop-shadow(0 0 12px #fde047)' }} />
              </div>
            </>
          );
        })()}

        <StageBarView {...stageBarProps(s, bossParts)} />

        <ComboMeter n={s.combo.n} left={s.combo.n ? Math.max(0, 1 - s.combo.t / BAL.COMBO_WINDOW) : 0} k={k} top={comboTop} />

        {/* Status chips */}
        <div style={{ position: 'absolute', top: s.mahoraga ? 62 : 44, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, zIndex: 13, pointerEvents: 'none' }}>
          <KitChip s={s} sk={s.stats.skill} cur={curSkill} />
          {s.stage.mod && <span title={s.stage.mod.desc}><Chip color={s.stage.mod.color}>◆ {s.stage.mod.name}</Chip></span>}
          {s.frenzy > 0 && <Chip color="#ff8c00">FRENZY {s.frenzy.toFixed(0)}s</Chip>}
          {pl.debuffs?.weak > 0 && <Chip color="#c084fc">WEAKENED −30% DMG {pl.debuffs.weak.toFixed(0)}s</Chip>}
          {s.timeStop > 0 && <Chip color="#67e8f9">TIME STOP {s.timeStop.toFixed(1)}s</Chip>}
          {s.ult.active && (s.ult.active.type === 'mahoraga'
            ? <Chip color="#fde047">☸ MAHORAGA · {s.mahoraga ? Object.values(s.mahoraga.adapt).reduce((a, n) => a + Math.min(n, 3), 0) : 0} adapted</Chip>
            : <Chip color="#c084fc">{(ult?.name ?? 'ULT').length > 24 ? ult.name.split(' ').slice(-2).join(' ') : ult?.name ?? 'ULT'} {s.ult.active.t.toFixed(1)}s</Chip>)}
        </div>

        {s.banner && (
          <div className="stage-banner" key={s.banner.text}>
            <div style={{ fontFamily: 'var(--font-dramatic)', fontSize: `clamp(30px, ${8 * k}vmin, 62px)`, fontWeight: 800, letterSpacing: 3,
              color: s.banner.boss || s.banner.bad ? '#ff4400' : s.banner.good ? '#4ade80' : '#ffb347',
              textShadow: `0 0 28px ${s.banner.boss || s.banner.bad ? '#ff2200' : s.banner.good ? '#16a34a' : '#ff8c00'}` }}>
              {s.banner.text}
            </div>
            {s.banner.sub && <div style={{ color: s.banner.subColor ?? '#ddd', fontSize: 15, marginTop: 4, letterSpacing: s.banner.subColor ? 0.5 : 2, fontWeight: s.banner.subColor ? 700 : 400, textShadow: '0 1px 4px #000', padding: s.banner.subColor ? '4px 12px' : '0 12px',
              ...(s.banner.subColor && { background: 'rgba(8,10,20,0.72)', borderRadius: 8, display: 'inline-block', maxWidth: '92%' }) }}>{s.banner.sub}</div>}
          </div>
        )}

        {/* Status frame (portrait / ult orb / HP) — your art, on PC and phone */}
        <StatusFrame frameRef={frameRef} mobile={mobile} mainCard={mainCard}
          hpRatio={Math.round(hpRatio * 400) / 400} charge={Math.floor(charge * 100) / 100} ult={ult} ultReady={!!ultReady} cd={ultCd}
          onUlt={onUlt} hp={Math.ceil(pl.hp)} maxHp={pl.maxHp} blocked={ult && charge >= 1 && !ultCd ? s.ult.blocked : null}
          spKind={sp?.kind} spColor={sp?.color} onSpecial={onSpecial}
          spFill={!sp ? 0 : sp.kind === 'cd' ? Math.round((1 - (sp.cdMax ? sp.cd / sp.cdMax : 0)) * 40) / 40 : sp.n / sp.max}
          spText={!sp ? '' : sp.kind === 'cd' ? (sp.cd > 0 ? `${Math.ceil(sp.cd)}s` : '') : `${sp.n}`} />

        {/* Room 16's ult: pick a skill (the fight waits) */}
        {s.choosing && (
          <div className="ora-pick" onPointerDown={e => e.stopPropagation()}>
            <div style={{ color: '#f9a8d4', fontWeight: 900, fontSize: 22 * Math.max(0.8, k), letterSpacing: 2, textShadow: '0 0 14px #ec4899' }}>ORA ORA ORA</div>
            <div style={{ color: '#ddd', fontSize: 13, marginBottom: 6 }}>Pick a skill to use at full strength</div>
            {s.choosing.options.map((id, i) => (
              <TapButton key={id} className="ora-opt" onClick={() => engine.choose(i)}>
                <span style={{ color: '#f9a8d4', fontWeight: 900, marginRight: 8 }}>{i + 1}</span>
                <b>{SKILL_NAMES[id] ?? id}</b>
                <span style={{ display: 'block', color: '#bbb', fontSize: 12, fontWeight: 400, marginTop: 2 }}>{describeKit(SKILLS[id], s.stats.si ?? 0)}</span>
              </TapButton>
            ))}
          </div>
        )}

        {/* Security-camera look (Settings → CCTV battle camera) */}
        {cctvOn && <CctvOverlay cam={((s.stageNum - 1) % 12) + 1} place={s.stage.label ? null : `SECTOR ${s.stageNum}`} hurt={pl.hitT > 0.2} mobile={mobile} />}

        {/* Extra layers from the screen using the arena (story mode: codec popups) */}
        {children}
      </div>

      <style>{ARENA_CSS}</style>
    </>
  );
}

// Malevolent Shrine's domain: a dark red world closing in from where it was cast, the shrine
// (roofs, pillars, a fanged maw, skulls at its feet) rising at the bottom, and its name on the side.
function ShrineDomain({ dom, W, H, k, time }) {
  const open = Math.min(1, 1 - Math.max(0, dom.intro));            // 0 → 1 while it opens
  const ending = Math.min(1, dom.t / 0.5);                           // fades out in the last half second
  const R = Math.hypot(W, H) * (0.08 + 1.05 * (1 - (1 - open) ** 3));
  const sw = Math.min(W * 0.62, 460 * k), sh = sw * 0.62, sx = W / 2 - sw / 2, sy = H - sh * (0.55 + 0.45 * open);
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', opacity: ending,
      clipPath: `circle(${R}px at ${dom.x}px ${dom.y}px)` }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 85%, rgba(127,29,29,${0.55 + 0.15 * pulse}) 0%, rgba(40,4,4,0.82) 55%, rgba(5,0,0,0.92) 100%)` }} />
      <div className="shrine-sky" />
      <div style={{ position: 'absolute', right: '3%', top: '10%', writingMode: 'vertical-rl', fontFamily: 'serif', fontWeight: 900,
        fontSize: Math.max(22, 44 * k), color: 'rgba(239,68,68,0.55)', letterSpacing: 6, textShadow: '0 0 18px rgba(220,38,38,0.8)' }}>伏魔御廚子</div>
      <svg width={sw} height={sh} viewBox="0 0 400 248" style={{ position: 'absolute', left: sx, top: sy, overflow: 'visible', filter: 'drop-shadow(0 0 18px rgba(220,38,38,0.65))' }}>
        {/* skulls piled at its feet */}
        {Array.from({ length: 15 }, (_, i) => <circle key={i} cx={22 + i * 25 + (i % 2) * 6} cy={238 - (i % 3) * 5} r={11 + (i % 3) * 2} fill="#d6c7b0" stroke="#1a0505" strokeWidth={2} />)}
        {Array.from({ length: 15 }, (_, i) => <g key={`e${i}`} fill="#1a0505"><circle cx={18 + i * 25 + (i % 2) * 6} cy={236 - (i % 3) * 5} r={2.6} /><circle cx={26 + i * 25 + (i % 2) * 6} cy={236 - (i % 3) * 5} r={2.6} /></g>)}
        {/* the maw between the pillars */}
        <rect x={120} y={128} width={160} height={92} fill={`rgba(220,38,38,${0.55 + 0.35 * pulse})`} />
        {Array.from({ length: 9 }, (_, i) => <polygon key={`t${i}`} points={`${122 + i * 17.5},128 ${139 + i * 17.5},128 ${130.5 + i * 17.5},${150 + (i % 2) * 8}`} fill="#f5f5f4" />)}
        {Array.from({ length: 9 }, (_, i) => <polygon key={`b${i}`} points={`${122 + i * 17.5},220 ${139 + i * 17.5},220 ${130.5 + i * 17.5},${200 - (i % 2) * 8}`} fill="#f5f5f4" />)}
        {/* pillars */}
        {[70, 112, 280, 322].map(x => <rect key={x} x={x} y={112} width={14} height={116} fill="#1a0505" stroke="#7f1d1d" strokeWidth={2} />)}
        {/* lower roof, upturned ends */}
        <path d="M20,118 Q60,96 110,92 L290,92 Q340,96 380,118 L362,104 Q330,84 290,80 L110,80 Q70,84 38,104 Z" fill="#1a0505" stroke="#ef4444" strokeWidth={2.5} />
        {/* upper roof */}
        <path d="M70,70 Q110,52 150,50 L250,50 Q290,52 330,70 L316,58 Q290,40 250,38 L150,38 Q110,40 84,58 Z" fill="#1a0505" stroke="#ef4444" strokeWidth={2.5} />
        <rect x={140} y={50} width={120} height={30} fill="#240707" stroke="#7f1d1d" strokeWidth={2} />
        <path d="M188,38 L200,6 L212,38 Z" fill="#1a0505" stroke="#ef4444" strokeWidth={2} />
        {/* ribs hanging from the eaves */}
        {[48, 88, 312, 352].map(x => <path key={`r${x}`} d={`M${x},108 q${x < 200 ? -8 : 8},18 0,34`} fill="none" stroke="#d6c7b0" strokeWidth={3} />)}
      </svg>
    </div>
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
    const hex = !!a.opts?.debuff, col = hex ? '#c084fc' : '#ff2a2a';
    if (a.phase === 'tele') {
      // small fry: a short pointer that grows (a full-screen line for every pellet was a mess)
      const L = a.opts?.small ? (50 + 70 * p) * k : 2000;
      return <line x1={a.sx} y1={a.sy} x2={a.sx + a.ux * L} y2={a.sy + a.uy * L} stroke={hex ? `rgba(192,132,252,${0.3 + 0.5 * p})` : redFill} strokeWidth={a.r * 2.2} strokeLinecap="round" strokeDasharray={a.opts?.small ? undefined : `${14 * k} ${8 * k}`} />;
    }
    return <circle cx={a.x} cy={a.y} r={a.r} fill="#fff" stroke={col} strokeWidth={(a.opts?.small ? 3 : 4) * k} style={{ filter: `drop-shadow(0 0 8px ${col})` }} />;
  }
  if (a.kind === 'dash' && a.phase === 'tele') {
    return <line x1={a.fx} y1={a.fy} x2={a.tx} y2={a.ty} stroke={`rgba(255,0,0,${0.25 + 0.4 * p})`} strokeWidth={6 * k} strokeDasharray={`${10 * k} ${8 * k}`} />;
  }
  return null;
}

function EffectShape({ f, k }) {
  const p = Math.min(1, f.t / (f.life ?? 0.5));
  if (f.kind === 'beam') return (
    <g opacity={1 - p * p}>
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color === 'ice' ? '#0e7490' : '#7e22ce'} strokeWidth={f.w * 1.25} strokeLinecap="round" opacity={0.35} />
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color === 'ice' ? '#67e8f9' : '#c084fc'} strokeWidth={f.w} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 18px ${f.color === 'ice' ? '#22d3ee' : '#a855f7'})` }} />
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#fff" strokeWidth={f.w * 0.3} strokeLinecap="round" />
    </g>
  );
  if (f.kind === 'slash') return <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#f5d0fe" strokeWidth={7 * k * (1 - p)} strokeLinecap="round" opacity={1 - p} style={{ filter: 'drop-shadow(0 0 6px #a855f7)' }} />;
  if (f.kind === 'zap') {
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
      const j = i === 0 || i === 4 ? 0 : (((f.id * 7 + i * 13) % 10) - 5) * 3 * k;
      return `${f.x1 + (f.x2 - f.x1) * t + j},${f.y1 + (f.y2 - f.y1) * t - j}`;
    }).join(' ');
    return <polyline points={pts} fill="none" stroke="#fde047" strokeWidth={3 * k} opacity={1 - p} style={{ filter: 'drop-shadow(0 0 6px #facc15)' }} />;
  }
  if (f.kind === 'fist') return <SvgIcon name="fist" x={f.x} y={f.y} size={26 * k * (1 + p * 0.4)} color="#fde68a" opacity={1 - p} />;
  if (f.kind === 'stab') return <line x1={f.x - f.r * 0.6} y1={f.y + f.r * 0.6} x2={f.x + f.r * 0.6} y2={f.y - f.r * 0.6} stroke="#fff" strokeWidth={3 * k} opacity={1 - p} />;
  if (f.kind === 'ratio') return <line x1={f.x - f.r} y1={f.y + f.r * 0.4} x2={f.x + f.r} y2={f.y - f.r * 0.4} stroke="#facc15" strokeWidth={5 * k * (1 - p * 0.5)} opacity={1 - p} style={{ filter: 'drop-shadow(0 0 8px #facc15)' }} />;
  if (f.kind === 'spiral') {
    const arms = [0, 1, 2].map(arm => {
      let d = '';
      for (let i = 0; i <= 24; i++) {
        const r = (i / 24) * f.r * (0.3 + p), a = arm * 2.094 + i * 0.32 + p * 5;
        d += `${i ? 'L' : 'M'}${f.x + Math.cos(a) * r},${f.y + Math.sin(a) * r}`;
      }
      return <path key={arm} d={d} fill="none" stroke="#e879f9" strokeWidth={10 * k * (1 - p)} strokeLinecap="round" />;
    });
    return <g opacity={1 - p} style={{ filter: 'drop-shadow(0 0 10px #d946ef)' }}>{arms}</g>;
  }
  if (f.kind === 'shards') {
    const n = f.n ?? 8, ease = 1 - (1 - Math.min(1, p)) ** 2;
    return (
      <g opacity={1 - p}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + f.id;   // f.id gives each burst its own rotation
          const d = f.r * (0.25 + ease * 0.95) * (0.8 + ((i * 37) % 10) / 25);
          return <rect key={i} x={f.x + Math.cos(a) * d - 3 * k} y={f.y + Math.sin(a) * d - 3 * k} width={6 * k * (1 - p * 0.6)} height={6 * k * (1 - p * 0.6)}
            fill={f.color} transform={`rotate(${(a * 180) / Math.PI + p * 240} ${f.x + Math.cos(a) * d} ${f.y + Math.sin(a) * d})`} />;
        })}
      </g>
    );
  }
  if (f.kind === 'ripple') {
    const q = Math.min(1, f.t / 0.3);
    if (q >= 1) return null;
    return <circle cx={f.x} cy={f.y} r={(6 + 22 * q) * k} fill="none" stroke={f.miss ? 'rgba(255,255,255,0.45)' : '#fff8d0'} strokeWidth={(f.miss ? 1.5 : 2.5) * k} opacity={1 - q} />;
  }
  if (f.kind === 'crack') {
    // jagged cracks spreading from where something got slammed into the wall
    const lines = [-1.1, -0.55, 0, 0.55, 1.1].map((off, i) => {
      const a = f.a + off, L = f.r * (0.7 + ((f.id + i * 3) % 4) * 0.15);
      const mx = f.x + Math.cos(a) * L * 0.5 + Math.cos(a + 1.57) * L * 0.12 * (i % 2 ? 1 : -1);
      const my = f.y + Math.sin(a) * L * 0.5 + Math.sin(a + 1.57) * L * 0.12 * (i % 2 ? 1 : -1);
      return <polyline key={i} points={`${f.x},${f.y} ${mx},${my} ${f.x + Math.cos(a) * L},${f.y + Math.sin(a) * L}`} fill="none" stroke="#e0f2fe" strokeWidth={3 * k} strokeLinejoin="bevel" />;
    });
    return <g opacity={p < 0.6 ? 1 : (1 - p) / 0.4}>{lines}</g>;
  }
  // Bio's implosion: rings collapsing onto the point
  if (f.kind === 'implode') return (
    <g opacity={0.35 + 0.65 * p}>
      <circle cx={f.x} cy={f.y} r={f.r * (1 - p)} fill="none" stroke="#c4b5fd" strokeWidth={3 * k} strokeDasharray={`${10 * k} ${7 * k}`} />
      <circle cx={f.x} cy={f.y} r={f.r * 0.6 * (1 - p)} fill="rgba(139,92,246,0.12)" stroke="#8b5cf6" strokeWidth={2 * k} />
      <circle cx={f.x} cy={f.y} r={(6 + 10 * p) * k} fill="#ede9fe" style={{ filter: 'drop-shadow(0 0 12px #8b5cf6)' }} />
    </g>
  );
  // Malevolent Shrine's Dismantle / Cleave: red slashes with a white edge
  if (f.kind === 'dslash') return (
    <g opacity={1 - p}>
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#b91c1c" strokeWidth={(f.big ? 10 : 5) * k * (1 - p * 0.5)} strokeLinecap="round" />
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#fff1f2" strokeWidth={(f.big ? 3 : 1.6) * k} strokeLinecap="round" />
    </g>
  );
  // Doro's drag: a bright cut along the path
  if (f.kind === 'cut') return <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#fff7ed" strokeWidth={5 * k * (1 - p)} strokeLinecap="round" opacity={1 - p} style={{ filter: 'drop-shadow(0 0 5px #f97316)' }} />;
  // a ring sweeping outward (Jerry's repel, refabiba's wave)
  if (f.kind === 'ring') return <circle cx={f.x} cy={f.y} r={f.r * (0.3 + 0.7 * p)} fill="none" stroke={f.color} strokeWidth={6 * k * (1 - p)} opacity={1 - p} />;
  // Astrec's rock spikes: jagged spikes jutting up across the area
  if (f.kind === 'spikes') {
    const up = Math.min(1, p * 4), fade = p < 0.6 ? 1 : (1 - p) / 0.4;
    return (
      <g opacity={fade}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = i * 2.4 + f.id, d = f.r * (i === 0 ? 0 : 0.25 + ((i * 37) % 10) / 14), x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.6;
          const h = (26 + ((i * 13) % 5) * 7) * k * up, w = 9 * k;
          return <polygon key={i} points={`${x - w},${y} ${x + w},${y} ${x + w * 0.2},${y - h}`} fill="#b45309" stroke="#fcd34d" strokeWidth={1.5} />;
        })}
      </g>
    );
  }
  if (f.kind === 'poof') return <circle cx={f.x} cy={f.y} r={f.r * (0.6 + p)} fill="none" stroke="#fff" strokeWidth={3 * k} opacity={1 - p} />;
  if (f.kind === 'burst') return <circle cx={f.x} cy={f.y} r={f.r * (0.4 + 0.6 * p)} fill={f.color} fillOpacity={0.15 * (1 - p)} stroke={f.color} strokeWidth={4 * k} opacity={1 - p} />;
  return null;
}

function stageBarProps(s, bossParts) {
  let label, ratio, color;
  const name = s.stage.label ?? `STAGE ${s.stageNum}`;
  const boss = bossParts.length > 0 && s.bossInfo;
  if (boss) {
    label = s.bossInfo.name;
    ratio = bossParts.reduce((a, e) => a + Math.max(0, e.hp), 0) / s.bossInfo.maxHp;
    color = '#ff4400';
  }
  else if (s.phase === 'fight') { label = `${name} · ${s.kills}/${s.stage.killTarget} kills`; ratio = s.kills / s.stage.killTarget; color = '#ff8c00'; }
  else if (s.phase === 'bossIntro') { label = `${name} · BOSS`; ratio = 1; color = '#ff4400'; }
  else { label = name; ratio = 1; color = '#4ade80'; }
  return { label, ratio: Math.round(Math.max(0, Math.min(1, ratio)) * 400) / 400, color, boss: !!boss };
}

const StageBarView = memo(function StageBarView({ label, ratio, color, boss }) {
  return (
    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 'min(70%, 460px)', zIndex: 13, pointerEvents: 'none', textAlign: 'center' }}>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 1, textShadow: '0 1px 4px #000', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {boss && <><Icon name="swords" />{' '}</>}{label}
      </div>
      <div style={{ height: boss ? 10 : 6, background: 'rgba(0,0,0,0.55)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.15s' }} />
      </div>
    </div>
  );
});

// One enemy. Only re-renders when how it LOOKS changes; its position is set
// directly on the DOM node by BattleArena every frame.
// The hydra's heads hang from long necks that come down from the top of the
// arena. Each neck is a chain of neck pictures along a curve from the top down to
// its head, with a wave running down it (snake-like). The heads lean toward you
// (engine.js → moveHydraHead), and the necks follow them.
function HydraNecks({ heads, k, time }) {
  if (!heads.length) return null;
  const t = heads[0].type;
  return heads.flatMap(h => {
    const box = h.size * k * h.drawScale;
    const [fx, fy] = t.neckAttach?.[h.segIndex] ?? [0.5, 0.2];
    const ax = h.x - box / 2 + fx * box, ay = h.y - box / 2 + fy * box;      // where the neck meets the head now
    const topX = (h.hx ?? h.x) - box / 2 + fx * box;                           // where it comes from (above its home spot)
    const bw = box * 0.6, bh = bw * 856 / 715, step = bh * 0.5;
    const y0 = -bh * 0.6, cy = (y0 + ay) * 0.55;
    const amp = box * (h.down > 0 ? 0.04 : 0.11);
    const at = (u) => {                                                        // point on the neck, u = 0 top … 1 head
      const v = 1 - u;
      const bx = v * v * topX + 2 * v * u * topX + u * u * ax;
      const by = v * v * y0 + 2 * v * u * cy + u * u * ay;
      const wave = Math.sin(time * 2.1 - u * 5 + h.segIndex * 1.9) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * amp;
      return [bx + wave, by];
    };
    const n = Math.max(3, Math.ceil(Math.hypot(ax - topX, ay - y0) / step));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = Math.min(1, (i + 0.35) / n);                                   // last piece tucks in behind the head
      const [x, y] = at(u), [px, py] = at(Math.max(0, u - 0.02));
      const rot = Math.atan2(y - py, x - px) * 57.2958 - 90;
      out.push(
        <img key={`${h.id}-${i}`} src={t.neckImg} alt="" draggable={false} className="hydra-neck"
          style={{ position: 'absolute', left: x - bw / 2, top: y - bh / 2, width: bw, height: bh, zIndex: 7, pointerEvents: 'none',
            transform: `rotate(${rot.toFixed(1)}deg)`, filter: h.down > 0 ? 'brightness(0.7) saturate(0.8)' : undefined }} />,
      );
    }
    return out;
  });
}

const EnemySprite = memo(function EnemySprite({ id, register, img, shape, tint, tier, role, grouped, size, k, isWormHead,
  frozen, down, flashRed, hurt, dashing, paused, hpPct, shieldR, shieldPct, weak, affix, pose, poses, drawScale = 1, turns, sway = null, mirror = null, fort = false, badge = null }) {
  const ax = affix ? AFFIXES[affix] : null;
  let filter = tint ?? 'none';
  if (down) filter = sway != null ? 'brightness(0.75)' : 'grayscale(1) brightness(0.5)';
  else if (frozen) filter = 'hue-rotate(180deg) brightness(1.4) saturate(2)';
  else if (flashRed || pose) filter = 'none';
  else if (hurt) filter = `${tint ?? ''} brightness(2.2)`;
  const showBar = tier !== 'boss' || role === 'hydra' || (grouped && role !== 'head');
  return (
    <div ref={el => register(id, el)} style={{
      position: 'absolute', left: 0, top: 0, width: size, height: size, willChange: 'transform',
      // bosses float above the small enemies
      zIndex: isWormHead ? 9 : tier === 'boss' ? 8 : tier === 'treasure' ? 8 : 6, pointerEvents: 'none',
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
      {tier === 'boss' && (role === 'hydra' || !grouped) && <div className="boss-shadow" style={{ top: `${50 + drawScale * 58}%` }} />}
      {dashing && <div className="dash-trail" />}
      {ax && <div className="affix-aura" style={{ '--ac': ax.color }} />}
      {/* big ones' MIRROR: silver flicker while it's coming, a solid mirror while it reflects */}
      {mirror && <div className={`mirror-aura ${mirror}`} />}
      {mirror === 'on' && <div className="mirror-tag" style={{ fontSize: 11 * Math.max(0.85, k) }}>MIRROR · don't hit</div>}
      {fort && <div className="fort-aura" />}
      {badge && <div className="enemy-badge" style={{ color: badge.color, borderColor: badge.color, fontSize: 12 * Math.max(0.85, k) }}>{badge.icon}</div>}
      {ax && <div className="affix-tag" style={{ color: ax.color, fontSize: 10 * Math.max(0.85, k) }}>{ax.name}</div>}
      <div className={`squash${hurt ? ' hit' : ''}${mirror === 'on' ? ' mirrored' : ''}`}>
      <div style={{ width: '100%', height: '100%', transform: `${turns ? 'rotate(var(--rot, 0deg)) ' : ''}scale(${drawScale})` }}>
      {shape === 'segment' ? (
        <div className="worm-seg" style={{ filter: frozen ? 'hue-rotate(180deg) brightness(1.4)' : hurt ? 'brightness(2)' : 'none' }} />
      ) : pose ? (
        // attack poses: the warn pictures flicker, the attack picture holds;
        // the wrapper turns them toward the attack (--aim-rot / --aim-flip)
        <div className="pose-aim">{[pose === 'warn' ? poses.warn : poses.attack].flat().map((src, i, all) => (
          <img key={src} src={src} alt="" draggable={false}
            className={`enemy-img pose ${pose}${all.length > 1 ? ` flick${i}` : ''}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', filter: frozen ? 'hue-rotate(180deg) brightness(1.4)' : hurt ? 'brightness(2)' : undefined }} />
        ))}</div>
      ) : (
        <img src={img} alt="" draggable={false} decoding="async"
          className={`enemy-img${tier === 'boss' && !grouped ? ' boss' : ''}${flashRed ? ' flash-red' : ''}${tier === 'treasure' ? ' treasure' : ''}${isWormHead ? ' worm-head' : ''}${turns ? ' turns' : ''}${poses ? ' smooth' : ''}${sway != null ? ` hydra-head${down ? ' severed' : ''}` : ''}`}
          style={{ width: '100%', height: '100%', objectFit: isWormHead && !turns ? 'cover' : 'contain', filter: turns && filter === 'none' ? undefined : filter, animationPlayState: frozen || (down && sway == null) || paused ? 'paused' : 'running' }} />
      )}
      </div>
      </div>
      {down > 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', fontWeight: 900, fontSize: 13 * Math.max(0.8, k), textShadow: '0 1px 4px #000' }}>{sway != null ? `REGROWS ${down.toFixed(1)}s` : `DOWN ${down.toFixed(1)}s`}</div>}
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
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: role === 'hydra' ? `${50 + drawScale * 48}%` : '100%', height: role === 'hydra' ? 8 : 5, background: '#222a', borderRadius: 3, marginTop: 2 }}>
          <div style={{ width: `${hpPct}%`, height: '100%', borderRadius: 3, background: role === 'hydra' ? '#ff4400' : tier === 'elite' ? '#c084fc' : tier === 'treasure' ? '#fbbf24' : '#ff4444' }} />
        </div>
      )}
      {frozen && <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 8px)', color: '#67e8f9', fontSize: 13, whiteSpace: 'nowrap' }}><Icon name="snow" /></div>}
    </div>
  );
});

// Floating damage numbers: they animate with CSS once placed, so this layer
// only re-renders when one is added or removed (ver changes).
const FloaterLayer = memo(function FloaterLayer({ floaters, k }) {
  return floaters.map(f => (
    <div key={f.id} className={`dmg-float${f.kind === 'crit' ? ' crit' : ''}`} style={{
      left: f.x, top: f.y, color: f.color, fontFamily: 'var(--font-hit)', fontWeight: 400,
      fontSize: (f.kind === 'crit' ? 26 : f.big ? 22 : 17) * Math.max(0.8, k),
    }}>
      {withIcons(f.text)}
      {f.icon === 'coin' && <img src={`${BASE}ui/ui_cucoin.png`} alt="" style={{ width: 18 * k, height: 18 * k, marginLeft: 3, imageRendering: 'pixelated', verticalAlign: 'middle' }} />}
      {f.icon === 'gem'  && <img src={`${BASE}ui/ui_frailite.png`} alt="" style={{ width: 18 * k, height: 18 * k, marginLeft: 3, imageRendering: 'pixelated', verticalAlign: 'middle' }} />}
    </div>
  ));
}, (a, b) => a.ver === b.ver && a.k === b.k);

// Combo: number + bonus, with a bar that drains until it runs out
const ComboMeter = memo(function ComboMeter({ n, left, k, top }) {
  if (n < 2) return null;
  const pct = Math.round(Math.min(n, BAL.COMBO_MAX) * BAL.COMBO_PER * 100);
  const hot = n >= BAL.COMBO_MAX ? '#f43f5e' : n >= 25 ? '#fb923c' : '#facc15';
  return (
    <div style={{ position: 'absolute', left: 12, top, zIndex: 13, pointerEvents: 'none', textAlign: 'left', transition: 'top 0.2s' }}>
      <div key={n} className="combo-num" style={{ color: hot, fontFamily: 'var(--font-hit)', fontSize: 32 * Math.max(0.75, k), fontWeight: 400, lineHeight: 1, textShadow: `0 0 12px ${hot}, 0 2px 4px #000` }}>
        {n}<span style={{ fontSize: '0.45em', marginLeft: 4, letterSpacing: 1 }}>COMBO</span>
      </div>
      <div style={{ color: '#fde68a', fontSize: 11, fontWeight: 800, textShadow: '0 1px 3px #000' }}>+{pct}% DMG</div>
      <div style={{ width: 70 * Math.max(0.8, k), height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, marginTop: 2 }}>
        <div style={{ width: `${left * 100}%`, height: '100%', background: hot, borderRadius: 2 }} />
      </div>
    </div>
  );
}, (a, b) => a.n === b.n && Math.abs(a.left - b.left) < 0.04 && a.k === b.k);

// What the main card's kit is doing right now (charges, Infinity, copied passive…)
function KitChip({ s, sk, cur }) {
  if (!sk) return null;
  const out = [];
  if (cur?.type === 'souls') out.push(<Chip key="m" color="#e879f9">👻 {s.kit.souls}/{Math.round(cur.cap)}{s.player.m2 && s.time - s.player.m2.t0 >= 1 ? ' · let go to hurl' : ' · hold to charge'}</Chip>);
  else if (s.kit.souls > 0) out.push(<Chip key="m" color="#e879f9">👻 {s.kit.souls}</Chip>);
  if (cur?.type === 'crawlers') out.push(<Chip key="c" color="#c084fc">✋ {s.kit.crawlN}/{Math.round(cur.cap)}{s.player.m2 && s.time - s.player.m2.t0 >= 1 ? ' · let go to release' : ' · hold to charge'}</Chip>);
  if (cur?.type === 'platinum') out.push(<Chip key="p" color="#f472b6">👊 {s.kit.punches}/{Math.round(cur.cap)}{s.player.m2 && s.time - s.player.m2.t0 >= 1 ? ' · let go: ORA' : ' · hold to charge'}</Chip>);
  if (cur?.type === 'firetrail') out.push(<Chip key="f" color="#fb923c">✂ {s.player.held ? 'CUTTING' : 'hold + drag to cut'}</Chip>);
  if (s.kit.entangle) out.push(<Chip key="e" color="#a78bfa">🔗 ENTANGLED {s.kit.entangle.t.toFixed(1)}s</Chip>);
  if (s.stats.skill?.passive?.type === 'infinity' && !s.kit.oraSkill) out.push(<Chip key="i" color="#93c5fd">∞ {Math.round(s.kit.inf)}%</Chip>);
  if (cur?.type === 'tide') out.push(<Chip key="h" color="#38bdf8">{s.kit.tide ? `💧 BEAM ${Math.max(0, cur.dur - s.kit.tide.t).toFixed(1)}s` : s.player.held && s.kit.tideHold === s.player.held.t0 ? 'let go, then hold again' : 'hold M1 for the beam'}</Chip>);
  else if (cur?.style === 'hold') out.push(<Chip key="h" color="#67e8f9">{s.player.held ? 'CHARGING…' : 'hold M1, let go to fire'}</Chip>);
  if (sk.passive?.type === 'copy' && s.kit.copied) out.push(<Chip key="cp" color="#f472b6">⧉ {s.kit.copied.name} {Math.max(0, Math.ceil(s.kit.copyT))}s</Chip>);
  if (s.kit.oraSkill) out.push(<Chip key="o" color="#f472b6">ORA · {s.kit.oraSkill.name}</Chip>);
  return out.length ? <>{out}</> : null;
}

const Chip = ({ color, children }) => (
  <div style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}`, color, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{Children.map(children, c => withIcons(c))}</div>
);

const StatusFrame = memo(function StatusFrame({ frameRef, mobile, mainCard, hpRatio, charge, ult, ultReady, cd, onUlt, hp, maxHp, blocked, spKind, spColor, spFill, spText, onSpecial }) {
  return (
    <div ref={frameRef} style={{ position: 'absolute', left: '2%', bottom: mobile ? '6%' : '4%', zIndex: 14, width: mobile ? '46%' : '30%', maxWidth: mobile ? 190 : 300, aspectRatio: '919 / 677' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* SPECIAL (M2) button, next to the ult orb: fills up as the cooldown runs out / as you charge */}
        {spKind && (
          // PC: just a cooldown / counter (M2 and Q do the work). Phone: a button (tap / hold).
          // Its touches never move your aim.
          <div className={`sp-btn${spKind === 'cd' && spFill >= 1 ? ' ready' : ''}${mobile ? '' : ' display'}`}
            {...(mobile ? holdButton(() => onSpecial(true), () => onSpecial(false)) : {})}
            onContextMenu={e => e.preventDefault()}
            title={mobile ? undefined : spKind === 'cd' ? 'Special: right-click (M2) or Q' : 'Charge: tap M2 / Q to stock one; hold M2, Q or M1 for 1s to keep charging, let go to release'}
            style={{ '--sp': spColor, width: mobile ? 52 : 46, height: mobile ? 52 : 46 }}>
            <span className="sp-fill" style={{ height: `${Math.min(1, spFill) * 100}%` }} />
            <span className="sp-txt">{spText || (mobile ? 'SPEC' : 'M2')}</span>
          </div>
        )}
        {/* Portrait first, so the frame's ring and bar sit on top of it */}
        {mainCard && STATUS_PORTRAITS[mainCard.id] && (
          <div style={{ position: 'absolute', right: '0.5%', bottom: '0.5%', width: '95%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
            <img src={STATUS_PORTRAITS[mainCard.id]} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          </div>
        )}
        {/* Full art with a face position (portraitFocus in characters.js) → zoom onto the face */}
        {mainCard && !STATUS_PORTRAITS[mainCard.id] && mainCard.portraitFocus && (mainCard.sprite || mainCard.cardArt) && (
          <div style={{
            position: 'absolute', left: '2%', top: '4%', width: '54%', height: '84%', overflow: 'hidden', pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(ellipse 72% 70% at 50% 42%, #000 55%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 72% 70% at 50% 42%, #000 55%, transparent 100%)',
          }}>
            <FocusImg src={mainCard.sprite || mainCard.cardArt} focus={mainCard.portraitFocus} at={[40, 46]} />   {/* left of the ult orb */}
          </div>
        )}
        {/* No custom status portrait yet → crop the card art into the portrait area */}
        {mainCard && !STATUS_PORTRAITS[mainCard.id] && !(mainCard.portraitFocus && (mainCard.sprite || mainCard.cardArt)) && (
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
          filter: ultReady ? 'drop-shadow(0 0 10px #c084fc) brightness(1.2)' : cd ? 'grayscale(0.85) brightness(0.7)' : 'none',
          animation: ultReady ? 'orbReady 0.9s ease-in-out infinite' : 'none',
        }} />
        <img src={`${BASE}ui/ui_status.png`} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
        <div
          {...holdButton(onUlt, null)}
          title={ult ? `${ult.name} — fills from damage you deal, ${Math.round(ult.cooldown)}s cooldown after use` : mainCard?.ult ? 'Ult unlocks at LV50' : 'No ult'}
          style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 'clamp(11px,1.6vw,18px)', textShadow: '0 0 8px #000', cursor: ultReady ? 'pointer' : 'default', textAlign: 'center' }}>
          {!ult ? (mainCard?.ult ? 'LV50' : '—') : blocked ? <span style={{ fontSize: '0.8em' }}>{withIcons(blocked)}</span> : ultReady ? (mobile ? 'TAP' : 'E') : cd ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.05 }}>
              <span>{cd}s</span>
              <span style={{ fontSize: '0.6em', opacity: 0.8 }}>{Math.floor(charge * 100)}%</span>
            </span>
          ) : `${Math.floor(charge * 100)}%`}
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

// Touch/mouse handlers for an on-screen button inside the arena: the press stays on the button
// (captured) and none of its moves reach the arena, so it doesn't drag your aim onto the button.
function holdButton(onDown, onUp) {
  const stop = e => e.stopPropagation();
  return {
    onPointerDown: e => { e.stopPropagation(); e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } onDown?.(); },
    onPointerMove: stop,
    onPointerUp: e => { e.stopPropagation(); onUp?.(); },
    onPointerCancel: e => { e.stopPropagation(); onUp?.(); },
    onLostPointerCapture: stop,
    onMouseDown: stop,
  };
}

const ARENA_CSS = `
  .shrine-sky { position:absolute; inset:0; opacity:0.35; mix-blend-mode:screen;
    background: repeating-linear-gradient(115deg, transparent 0 46px, rgba(239,68,68,0.18) 47px 49px, transparent 50px 120px);
    animation: shrineSky 2.4s linear infinite; }
  @keyframes shrineSky { from { background-position: 0 0; } to { background-position: 240px 0; } }
  .sp-btn.display { pointer-events:none; }
  .mirror-aura { position:absolute; inset:-14%; border-radius:50%; pointer-events:none; z-index:-1; }
  .mirror-aura.warn { border:3px dashed rgba(226,232,240,0.85); animation: mirrorWarn .18s steps(2) infinite; }
  .mirror-aura.on { border:4px solid #f8fafc; background: radial-gradient(circle, rgba(226,232,240,0.28), rgba(148,163,184,0.12) 60%, transparent 72%);
    box-shadow: 0 0 22px rgba(226,232,240,0.9), inset 0 0 18px rgba(255,255,255,0.6); animation: mirrorOn 0.6s ease-in-out infinite alternate; }
  .squash.mirrored img { filter: grayscale(0.6) brightness(1.6) contrast(1.2) !important; }
  .mirror-tag { position:absolute; left:50%; bottom:112%; transform:translateX(-50%); white-space:nowrap; font-weight:900; color:#0f172a;
    background:#f1f5f9; padding:1px 6px; border-radius:4px; box-shadow:0 0 10px rgba(255,255,255,0.8); pointer-events:none; }
  .enemy-badge { position:absolute; left:50%; bottom:100%; transform:translate(-50%, -2px); width:1.5em; height:1.5em; border-radius:50%; border:1.5px solid;
    background:rgba(8,10,20,0.85); display:flex; align-items:center; justify-content:center; font-weight:900; line-height:1; pointer-events:none; }
  .fort-aura { position:absolute; inset:-6%; border-radius:50%; border:2px solid rgba(74,222,128,0.9); box-shadow:0 0 12px rgba(74,222,128,0.7); pointer-events:none; z-index:-1; }
  @keyframes mirrorWarn { 0% { opacity:1 } 50% { opacity:0.15 } }
  @keyframes mirrorOn { from { transform: scale(0.97); } to { transform: scale(1.04); } }
  .sp-btn { position:absolute; left:100%; bottom:14%; margin-left:8px; border-radius:50%; overflow:hidden; cursor:pointer; touch-action:none;
    background:rgba(10,10,20,0.75); border:2px solid var(--sp); box-shadow:0 0 8px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; }
  .sp-btn .sp-fill { position:absolute; left:0; right:0; bottom:0; background:var(--sp); opacity:0.35; transition:height .1s linear; }
  .sp-btn .sp-txt { position:relative; color:#fff; font-weight:900; font-size:13px; text-shadow:0 0 4px #000; letter-spacing:0.5px; }
  .sp-btn.ready { box-shadow:0 0 14px var(--sp); animation: orbReady 0.9s ease-in-out infinite; }
  .sp-btn.ready .sp-fill { opacity:0.55; }
  .battle-arena img { -webkit-user-drag: none; user-select: none; }
  .enemy-img { display:block; image-rendering:pixelated; animation: enemyBob 2.4s ease-in-out infinite; }
  .enemy-img.boss { animation: enemyBob 1.8s ease-in-out infinite, bossPulse 1.2s ease-in-out infinite; }
  .enemy-img.flash-red { animation: flashRed 0.22s steps(2) infinite !important; }
  .enemy-img.treasure { animation: treasureWiggle 0.5s ease-in-out infinite; }
  .worm-seg { width:100%; height:100%; border-radius:50%;
              background: radial-gradient(circle at 35% 30%, #c2410c, #7f1d1d 55%, #2a0a0a);
              border: 2px solid #451a03; box-shadow: inset 0 -4px 8px rgba(0,0,0,0.5), 0 0 6px rgba(0,0,0,0.6); }
  .enemy-img.worm-head:not(.turns) { border-radius:50%; border:3px solid #7f1d1d; box-shadow:0 0 14px rgba(255,60,0,0.8); animation:none; }
  .enemy-img.turns { animation:none; image-rendering:auto; }
  .enemy-img.smooth { image-rendering:auto; }
  /* hydra heads grow in (spawn and regrow) and fall off when beheaded */
  .enemy-img.hydra-head { animation: hydraGrow .75s cubic-bezier(.2,1.5,.45,1) both; }
  .enemy-img.hydra-head.severed { animation: hydraFall 1.1s cubic-bezier(.45,0,.9,.6) forwards; }
  @keyframes hydraGrow { 0% { transform: scale(.08) rotate(var(--tilt, 0deg)); opacity:.3; } 60% { opacity:1; } 100% { transform: scale(1) rotate(var(--tilt, 0deg)); } }
  @keyframes hydraFall { 0% { transform: rotate(var(--tilt, 0deg)); opacity:1; } 18% { transform: translate(6%, -6%) rotate(18deg); }
    100% { transform: translate(18%, 170%) rotate(120deg); opacity:0; } }
  .enemy-img.hydra-head { image-rendering:auto; transform-origin: 50% 15%; transform: rotate(var(--tilt, 0deg));
    filter: drop-shadow(0 8px 12px rgba(0,0,0,0.45)); }
  .boss-shadow { position:absolute; left:12%; right:12%; height:16%; transform:translateY(-50%); z-index:-1; pointer-events:none;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0.25) 45%, transparent 70%); }
  .hydra-neck { image-rendering:auto; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); }
  .pose-aim { position:absolute; inset:0; transform: rotate(var(--aim-rot, 0deg)) scaleX(var(--aim-flip, 1)); transition: transform 0.08s ease-out; }
  .enemy-img.worm-head.turns { filter: drop-shadow(0 0 10px rgba(255,40,120,0.75)); }
  .enemy-img.pose { animation:none; image-rendering:auto; }
  .enemy-img.pose.warn { filter: drop-shadow(0 0 10px rgba(255,40,40,0.9)); }
  .enemy-img.pose.attack { filter: drop-shadow(0 0 14px rgba(255,90,0,0.95)); transform: scale(1.12); }
  .enemy-img.flick0 { animation: flickA 0.16s steps(1) infinite; }
  .enemy-img.flick1 { animation: flickB 0.16s steps(1) infinite; }
  @keyframes flickA { 0% { opacity:1 } 50% { opacity:0 } }
  @keyframes flickB { 0% { opacity:0 } 50% { opacity:1 } }
  .crawler { animation: crawl 0.35s ease-in-out infinite alternate; }
  @keyframes crawl { from { transform: skewX(-8deg) scaleY(0.92); } to { transform: skewX(8deg) scaleY(1.05); } }
  .shiki { transform: translate(-50%, -50%); filter: drop-shadow(0 0 8px #6366f1) drop-shadow(0 2px 3px #000); line-height: 1; }
  .shiki.dog { animation: shikiHop 0.3s ease-in-out infinite alternate; }
  .shiki.nue { animation: shikiHop 0.5s ease-in-out infinite alternate; }
  @keyframes shikiHop { from { margin-top: 0; } to { margin-top: -5px; } }
  .suspended-text { position:absolute; top:34px; left:50%; transform:translateX(-50%); z-index:13; pointer-events:none; white-space:nowrap;
                    color:#fde047; font-weight:900; letter-spacing:3px; font-size:clamp(11px, 2.4vw, 14px); text-shadow:0 0 12px #000, 0 0 4px #000; animation: blinkSlow 1.4s ease-in-out infinite; }
  @keyframes blinkSlow { 50% { opacity: 0.45; } }
  .maho-wheel { display:inline-block; color:#fde047; text-shadow:0 0 8px #000; transition: transform 0.35s cubic-bezier(.3,1.6,.5,1); line-height:1; }
  .ora-pick { position:absolute; inset:0; z-index:40; background:rgba(20,5,20,0.82); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:12px; }
  .ora-opt { width:min(420px, 92%); text-align:left; background:#2a0f2a; border:2px solid #ec4899; border-radius:8px; color:#fff; padding:10px 14px; font-size:15px; cursor:pointer; }
  .ora-opt:hover, .ora-opt:focus-visible { background:#4a1240; outline:none; }
  .squash { width:100%; height:100%; transition: transform 70ms ease-out; }
  .squash.hit { transform: scale(0.86, 0.9); }
  .affix-aura { position:absolute; inset:-14%; border-radius:50%; pointer-events:none;
                background: radial-gradient(circle, transparent 55%, color-mix(in srgb, var(--ac) 45%, transparent) 70%, transparent 74%);
                animation: auraSpin 2.2s linear infinite; will-change: transform, opacity; }
  .affix-tag { position:absolute; left:50%; bottom:calc(100% + 9px); transform:translateX(-50%); white-space:nowrap;
               font-weight:900; letter-spacing:0.5px; text-shadow:0 1px 3px #000, 0 0 6px #000; pointer-events:none; }
  .dmg-float.crit { animation: critPop 1.1s ease-out forwards; }
  .combo-num { animation: comboBump 0.16s ease-out; }
  @keyframes critPop { 0%{opacity:1; transform:translate(-50%,-50%) scale(1.7)} 12%{transform:translate(-50%,-50%) scale(1)} 70%{opacity:1} 100%{opacity:0; transform:translate(-50%, calc(-50% - 60px)) scale(0.95)} }
  @keyframes comboBump { from{transform:scale(1.25)} to{transform:scale(1)} }
  @keyframes auraSpin { 0%,100%{opacity:0.7; transform:scale(0.95)} 50%{opacity:1; transform:scale(1.06)} }
  @media (prefers-reduced-motion: reduce) { .squash, .combo-num, .dmg-float.crit { animation:none !important; transition:none !important; } }
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
