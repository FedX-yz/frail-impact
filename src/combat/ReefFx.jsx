// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Reef's kit (LAST RITES) looks like (the logic is in reefPlatinum.js). All drawn in code;
// his summons are the enemies' own pictures turned ghostly (an SVG colour matrix, no new art),
// and the burst art is his story art until a real one is drawn (mainCard.burstArt).
//   ReefGround   under the enemies: pentagrams, blood sigils, the séance circle
//   ReefOver     above them: the risen (with their eyes and HP), the command tether, the drag
//                you're drawing, the soul wheel, hex marks
//   ReefEffect   one-off effects: claw, ghost, pentaburst, crumble, rise, drain
//   ReefScreen   Legion's tint and tag, the burst art
// ─────────────────────────────────────────────────────────────────────────────
import { soulsTotal } from './reefPlatinum.js';

const MAG = '#e879f9', BONE = '#f5f0e6', VIOLET = '#a78bfa', SICK = '#86efac', BLOOD = '#be123c', VOID = '#12041a';
const clamp01 = v => Math.max(0, Math.min(1, v));

// a five-pointed star in a circle, centred on (x, y)
function Star({ x, y, R, a = -Math.PI / 2, stroke = MAG, w = 2, opacity = 1, fill = 'none', glow = false }) {
  const pts = Array.from({ length: 5 }, (_, i) => { const q = a + i * Math.PI * 4 / 5; return `${(x + Math.cos(q) * R).toFixed(1)},${(y + Math.sin(q) * R).toFixed(1)}`; }).join(' ');
  return (
    <g opacity={opacity} style={glow ? { filter: 'drop-shadow(0 0 6px #c026d3)' } : undefined}>
      <circle cx={x} cy={y} r={R * 1.04} fill={fill} stroke={stroke} strokeWidth={w} />
      <circle cx={x} cy={y} r={R * 1.14} fill="none" stroke={stroke} strokeWidth={w * 0.5} strokeDasharray={`${w * 2} ${w * 3}`} />
      <polygon points={pts} fill="none" stroke={stroke} strokeWidth={w} strokeLinejoin="round" />
    </g>
  );
}

// ── under the enemies ────────────────────────────────────────────────────
export function ReefGround({ s, k, time }) {
  const r = s.kit.reef, sk = s.stats.skill;
  if (!r || sk?.type !== 'necro') return null;
  const se = r.seance;
  return (
    <g>
      {r.sigils.map(g => {
        const o = clamp01(Math.min(g.t / 0.15, (g.life - g.t) / 0.5));
        const d = g.pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
        return (
          <g key={g.id} opacity={o}>
            <path d={d} fill="none" stroke={BLOOD} strokeOpacity={0.45} strokeWidth={10 * k} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={MAG} strokeWidth={2.4 * k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${10 * k} ${6 * k}`} strokeDashoffset={-time * 30 * k} />
          </g>
        );
      })}
      {r.pents.map(pg => {
        const o = clamp01(Math.min(pg.t / 0.12, (pg.life + 0.3 - pg.t) / 0.4)), beat = Math.pow(Math.max(0, Math.cos((pg.t % 0.5) / 0.5 * Math.PI * 2)), 4);
        return (
          <g key={pg.id}>
            <circle cx={pg.x} cy={pg.y} r={pg.R} fill={BLOOD} opacity={o * (0.12 + 0.12 * beat)} />
            <Star x={pg.x} y={pg.y} R={pg.R} a={pg.a + pg.t * 0.3} stroke={MAG} w={(2.5 + 1.5 * beat) * k} opacity={o} />
          </g>
        );
      })}
      {se && (() => {
        const R = (sk.seanceR ?? 150) * k, o = clamp01(Math.min(se.t / 0.2, (se.life - se.t) / 0.4));
        return (
          <g opacity={o}>
            <circle cx={se.x} cy={se.y} r={R} fill="rgba(76,29,149,0.16)" stroke={VIOLET} strokeWidth={2 * k} />
            <circle cx={se.x} cy={se.y} r={R * 0.82} fill="none" stroke={VIOLET} strokeOpacity={0.6} strokeWidth={1.2 * k} strokeDasharray={`${3 * k} ${6 * k}`} transform={`rotate(${(time * 25) % 360} ${se.x} ${se.y})`} />
            {/* the candles round it */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = i / 6 * Math.PI * 2 - Math.PI / 2, cx = se.x + Math.cos(a) * R, cy = se.y + Math.sin(a) * R, fl = 1 + 0.25 * Math.sin(time * 14 + i * 2);
              return (
                <g key={i}>
                  <rect x={cx - 3 * k} y={cy - 2 * k} width={6 * k} height={10 * k} rx={1.5 * k} fill={BONE} />
                  <ellipse cx={cx} cy={cy - 5 * k * fl} rx={2.6 * k} ry={5 * k * fl} fill="#c4b5fd" opacity={0.9} />
                </g>
              );
            })}
          </g>
        );
      })()}
    </g>
  );
}

// a risen enemy: its own picture, drained to a violet ghost (all of them in one filtered group:
// one filter pass instead of one per summon), then its burning eyes and HP on top
function risenPose(m, k, time) {
  const big = m.big, S = m.size * m.drawScale * k * (big ? 1.35 : 0.9), hit = time - m.hitT < 0.12, hurt = time - m.hurtT < 0.15;
  const rise = clamp01(m.t / 0.35), fade = m.life < 1 && !big ? 0.4 + 0.6 * m.life : 1, flip = m.looks ? ((m.looks === 'right') !== (m.face > 0)) : m.face < 0;
  const bob = Math.sin(time * 4 + m.id) * 2 * k;
  return { big, S, hit, hurt, o: rise * fade, flip, x: m.x, y: m.y + bob + (1 - rise) * S * 0.3 };
}
function RisenBody({ m, k, time }) {
  const q = risenPose(m, k, time), { S, x, y } = q;
  if (!m.img) return <path d={`M${x - S * 0.35},${y + S * 0.4} Q${x - S * 0.4},${y - S * 0.45} ${x},${y - S * 0.45} Q${x + S * 0.4},${y - S * 0.45} ${x + S * 0.35},${y + S * 0.4} L${x + S * 0.18},${y + S * 0.3} L${x},${y + S * 0.42} L${x - S * 0.18},${y + S * 0.3} Z`} fill="#5b21b6" opacity={0.85 * q.o} />;
  return <image href={m.img} x={-S / 2} y={-S / 2} width={S} height={S} opacity={(q.hurt ? 0.6 : 0.92) * q.o}
    transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${q.flip ? -1 : 1} 1) ${q.hit ? 'scale(1.08)' : ''}`} />;
}
function RisenTop({ m, k, time }) {
  const q = risenPose(m, k, time), { S, x, y, big } = q;
  return (
    <g opacity={q.o}>
      {big && <circle cx={x} cy={y} r={S * 0.62} fill="none" stroke={MAG} strokeOpacity={0.45 + 0.2 * Math.sin(time * 6 + m.id)} strokeWidth={3 * k} />}
      {[-1, 1].map(sd => (
        <g key={sd}>
          <circle cx={x + sd * S * 0.1} cy={y - S * 0.12} r={Math.max(4 * k, S * 0.08)} fill={MAG} opacity={0.3} />
          <circle cx={x + sd * S * 0.1} cy={y - S * 0.12} r={Math.max(1.8 * k, S * 0.035)} fill="#fdf4ff" />
        </g>
      ))}
      {!big && <>
        <rect x={x - S * 0.3} y={y - S * 0.55} width={S * 0.6} height={3 * k} fill="#1f0a1f" opacity={0.7} />
        <rect x={x - S * 0.3} y={y - S * 0.55} width={S * 0.6 * clamp01(m.hp / m.maxHp)} height={3 * k} fill={SICK} />
      </>}
    </g>
  );
}

// ── above the enemies ────────────────────────────────────────────────────
export function ReefOver({ s, k, P, time }) {
  const r = s.kit.reef, sk = s.stats.skill;
  if (!r || sk?.type !== 'necro') return null;
  const held = s.player.held, d0 = held?.reef, cmd = r.command != null && r.cmdHold ? s.enemies.find(e => e.id === r.command) : null;
  return (
    <g>
      <defs>
        {/* the ghost look: drained, pushed to violet and a little see-through */}
        <filter id="reefGhost" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.45 0.35 0.2 0 0.08  0.2 0.22 0.18 0 0.02  0.55 0.45 0.4 0 0.16  0 0 0 0.9 0" />
        </filter>
      </defs>
      {/* hex marks: a little crescent over every cursed enemy */}
      {s.enemies.map(e => e.reefHex > s.time && e.hp > 0 && (
        <path key={`h${e.id}`} d={`M${e.x - 6 * k},${e.y - e.size * s.k * 0.62} a ${7 * k} ${7 * k} 0 1 0 ${12 * k} 0 a ${5 * k} ${5 * k} 0 1 1 ${-12 * k} 0`} fill={VIOLET} opacity={0.85} />
      ))}
      {r.minions.map(m => <ellipse key={`s${m.id}`} cx={m.x} cy={m.y + m.size * m.drawScale * k * (m.big ? 1.35 : 0.9) * 0.42} rx={m.size * m.drawScale * k * (m.big ? 1.35 : 0.9) * 0.4} ry={m.size * m.drawScale * k * (m.big ? 1.35 : 0.9) * 0.1} fill={m.big ? '#4a044e' : '#000'} opacity={0.4} />)}
      {r.minions.length > 0 && <g filter="url(#reefGhost)">{r.minions.map(m => <RisenBody key={m.id} m={m} k={k} time={time} />)}</g>}
      {r.minions.map(m => <RisenTop key={`t${m.id}`} m={m} k={k} time={time} />)}
      {/* COMMAND: a blood tether from you to it */}
      {P && cmd && cmd.hp > 0 && (
        <g>
          <line x1={P.x} y1={P.y} x2={cmd.x} y2={cmd.y} stroke={BLOOD} strokeOpacity={0.5} strokeWidth={8 * k} strokeLinecap="round" />
          <line x1={P.x} y1={P.y} x2={cmd.x} y2={cmd.y} stroke="#fda4af" strokeWidth={2 * k} strokeDasharray={`${6 * k} ${8 * k}`} strokeDashoffset={time * 60 * k} />
          <circle cx={cmd.x} cy={cmd.y} r={cmd.size * s.k * 0.6 + 6 * k} fill="none" stroke={BLOOD} strokeWidth={2.5 * k} strokeDasharray={`${8 * k} ${5 * k}`} transform={`rotate(${(time * 90) % 360} ${cmd.x} ${cmd.y})`} />
        </g>
      )}
      {/* what you're drawing right now */}
      {d0?.drag && d0.pts.length > 1 && (() => {
        const a = d0.pts[0], close = P && Math.hypot(P.x - a.x, P.y - a.y) < 45 * k && d0.L > 220 * k;
        return (
          <g>
            <path d={d0.pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')} fill="none" stroke={MAG} strokeWidth={3 * k} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} style={{ filter: 'drop-shadow(0 0 4px #c026d3)' }} />
            <circle cx={a.x} cy={a.y} r={(close ? 14 : 8) * k} fill="none" stroke={close ? '#fdf4ff' : MAG} strokeWidth={2 * k} opacity={0.8} />
          </g>
        );
      })()}
      {/* the soul wheel */}
      {r.wheel && <Wheel r={r} k={k} P={P} sk={sk} />}
    </g>
  );
}
function Wheel({ r, k, P, sk }) {
  const w = r.wheel, n = r.souls.length, R = (n > 6 ? 105 : 90) * k, o = clamp01(w.t / 0.12);
  // which one the cursor points at
  let sel = null;
  if (P && Math.hypot(P.x - w.x, P.y - w.y) >= 28 * k) {
    const a = Math.atan2(P.y - w.y, P.x - w.x);
    r.souls.forEach((x, i) => { const q = -Math.PI / 2 + i / n * Math.PI * 2, d = Math.abs(Math.atan2(Math.sin(a - q), Math.cos(a - q))); if (!sel || d < sel.d) sel = { d, key: x.key }; });
  }
  return (
    <g opacity={o}>
      <circle cx={w.x} cy={w.y} r={R + 34 * k} fill="rgba(18,4,26,0.72)" stroke={MAG} strokeWidth={1.5 * k} />
      <circle cx={w.x} cy={w.y} r={26 * k} fill="none" stroke={MAG} strokeOpacity={0.5} strokeWidth={1 * k} />
      <text x={w.x} y={w.y + 4 * k} textAnchor="middle" fontSize={11 * k} fill={BONE} fontFamily="var(--font-ui, monospace)">{soulsTotal(r)}/{sk.soulCap}</text>
      {r.souls.map((x, i) => {
        const q = -Math.PI / 2 + i / n * Math.PI * 2, cx = w.x + Math.cos(q) * R, cy = w.y + Math.sin(q) * R, on = sel?.key === x.key, S = (on ? 46 : 38) * k;
        return (
          <g key={x.key}>
            <circle cx={cx} cy={cy} r={S * 0.62} fill={on ? '#4a044e' : '#1e0a24'} stroke={x.tier === 'boss' ? '#fde047' : x.tier === 'elite' ? MAG : VIOLET} strokeWidth={(on ? 3 : 1.5) * k} />
            {x.img ? <image href={x.img} x={cx - S / 2} y={cy - S / 2} width={S} height={S} filter="url(#reefGhost)" /> : <text x={cx} y={cy + 6 * k} textAnchor="middle" fontSize={18 * k}>👻</text>}
            <text x={cx + S * 0.45} y={cy + S * 0.55} textAnchor="middle" fontSize={11 * k} fontWeight="bold" fill={BONE} stroke={VOID} strokeWidth={3 * k} paintOrder="stroke" fontFamily="var(--font-ui, monospace)">×{x.n}</text>
            {on && <text x={cx} y={cy - S * 0.75} textAnchor="middle" fontSize={11 * k} fill={MAG} stroke={VOID} strokeWidth={3 * k} paintOrder="stroke" fontFamily="var(--font-ui, monospace)">{x.name}{x.tier !== 'basic' ? ` (${x.tier})` : ''}</text>}
          </g>
        );
      })}
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function ReefEffect({ f, k }) {
  const p = clamp01(f.t / f.life), o = 1 - p;
  if (f.kind === 'claw') {
    // three bone-white scratches across it
    const c = Math.cos(f.a + 0.6), sn = Math.sin(f.a + 0.6), L = f.r * (0.6 + 0.6 * p);
    return (
      <g opacity={o}>
        {[-1, 0, 1].map(i => <line key={i} x1={f.x - c * L - sn * i * 7 * k} y1={f.y - sn * L + c * i * 7 * k} x2={f.x + c * L - sn * i * 7 * k} y2={f.y + sn * L + c * i * 7 * k} stroke={BONE} strokeWidth={2.5 * k} strokeLinecap="round" />)}
      </g>
    );
  }
  if (f.kind === 'ghost' || f.kind === 'drain') {
    // a soul (or a drop of blood) flying to you
    const q = p * p * (3 - 2 * p), lift = f.kind === 'ghost' ? Math.sin(p * Math.PI) * 50 * k : 0;
    const x = f.x1 + (f.x2 - f.x1) * q, y = f.y1 + (f.y2 - f.y1) * q - lift, big = f.boss ? 1.8 : 1;
    if (f.kind === 'drain') return <circle cx={x} cy={y} r={3.5 * k} fill={BLOOD} opacity={0.9} />;
    return (
      <g opacity={1 - p * 0.4}>
        <circle cx={x} cy={y} r={10 * k * big} fill={f.pale ? '#ddd6fe' : MAG} opacity={0.3} />
        <path d={`M${x - 6 * k * big},${y + 7 * k * big} Q${x - 7 * k * big},${y - 8 * k * big} ${x},${y - 8 * k * big} Q${x + 7 * k * big},${y - 8 * k * big} ${x + 6 * k * big},${y + 7 * k * big} L${x + 2 * k},${y + 4 * k} L${x},${y + 8 * k * big} L${x - 2 * k},${y + 4 * k} Z`} fill={f.pale ? '#ede9fe' : '#f5d0fe'} />
        <circle cx={x - 2.2 * k * big} cy={y - 2 * k * big} r={1.2 * k * big} fill={VOID} />
        <circle cx={x + 2.2 * k * big} cy={y - 2 * k * big} r={1.2 * k * big} fill={VOID} />
      </g>
    );
  }
  if (f.kind === 'pentaburst') {
    const R = f.r * (0.85 + 0.15 * p);
    return (
      <g>
        <circle cx={f.x} cy={f.y} r={R} fill={f.huge ? '#4a044e' : BLOOD} opacity={o * (f.huge ? 0.45 : 0.35)} />
        <Star x={f.x} y={f.y} R={R} a={f.a} stroke={p < 0.3 ? '#fdf4ff' : MAG} w={(f.huge ? 8 : 4) * k * o + k} opacity={o} glow={!f.huge} />
      </g>
    );
  }
  if (f.kind === 'crumble' || f.kind === 'rise') {
    // bone dust going up (rise: a ring opening in the ground first)
    const n = 8;
    return (
      <g opacity={o}>
        {f.kind === 'rise' && <ellipse cx={f.x} cy={f.y + f.r * 0.4} rx={f.r * (0.4 + 0.6 * p)} ry={f.r * 0.18 * (0.4 + 0.6 * p)} fill="none" stroke={MAG} strokeWidth={2.5 * k} />}
        {Array.from({ length: n }, (_, i) => {
          const a = i / n * Math.PI * 2 + f.id, d = f.r * 0.5 * p;
          return <circle key={i} cx={f.x + Math.cos(a) * d} cy={f.y + Math.sin(a) * d * 0.5 - p * f.r * 0.6} r={(2 + (i % 3)) * k} fill={f.kind === 'rise' ? MAG : BONE} />;
        })}
      </g>
    );
  }
  return null;
}

// ── on the screen ────────────────────────────────────────────────────────
export function ReefScreen({ s, mainCard, mobile }) {
  const r = s.kit.reef;
  if (!r) return null;
  const lg = s.ult.active?.type === 'legion' ? s.ult.active : null;
  return (
    <>
      {lg && !r.cutin && <div className="rf2-legion" />}
      {lg && !r.cutin && <div className="rf2-tag" style={mobile ? { top: '24%' } : undefined}>LEGION · {r.minions.length} RISEN · {Math.max(0, lg.t).toFixed(1)}s</div>}
      {r.cutin && <ReefCutIn c={r.cutin} card={mainCard} mobile={mobile} />}
    </>
  );
}
// the burst: his art in a pentagram-shaped window, the army's name under it
function ReefCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life, inP = clamp01(t / 0.2), outP = clamp01((t - (L - 0.25)) / 0.25);
  const art = card?.burstArt ?? card?.sprite;
  const [fx, fy] = card?.burstFocus ?? [50, 13];
  return (
    <div className="rf2-cutin" style={{ opacity: 1 - outP }}>
      <div className="rf2-cutin-band" style={{ transform: `scaleY(${inP})` }}>
        {art && <img src={art} alt="" draggable={false} className="rf2-cutin-face" style={{ transform: `translate(-${fx}%, -${fy}%) scale(${1.0 + 0.06 * t})` }} />}
        <svg className="rf2-cutin-star" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet" style={{ transform: `rotate(${t * 40}deg)` }}>
          <circle r="46" fill="none" stroke="#e879f9" strokeWidth="1.2" />
          <polygon points={Array.from({ length: 5 }, (_, i) => { const q = -Math.PI / 2 + i * Math.PI * 4 / 5; return `${Math.cos(q) * 44},${Math.sin(q) * 44}`; }).join(' ')} fill="none" stroke="#e879f9" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="rf2-cutin-text" style={{ opacity: clamp01((t - 0.18) / 0.12) * (1 - outP), fontSize: mobile ? '0.75em' : undefined }}>
        <div className="small">LAST RITES · RISE</div>
        <div className="big">LEGION</div>
      </div>
    </div>
  );
}

export const REEF_CSS = `
  .rf2-legion { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 110px rgba(134,25,143,0.55); background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(18,4,26,0.4) 100%); }
  .rf2-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#fdf4ff; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #c026d3, 0 2px 0 #2e1065; white-space:nowrap; }
  .rf2-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .rf2-cutin-band { position:absolute; left:0; right:0; top:18%; height:52%; overflow:hidden; transform-origin: 50% 50%;
    background: radial-gradient(ellipse at 50% 50%, #3b0764 0%, #12041a 70%); box-shadow: inset 0 3px 0 #e879f9, inset 0 -3px 0 #e879f9, 0 0 40px rgba(192,38,211,0.6); }
  .rf2-cutin-face { position:absolute; left:50%; top:50%; height:260%; width:auto; max-width:none; filter: contrast(1.1) saturate(1.1); will-change: transform; }
  .rf2-cutin-star { position:absolute; left:50%; top:50%; width:min(46cqw, 120%); height:auto; aspect-ratio:1; margin-left: calc(min(46cqw, 120%) / -2); margin-top: calc(min(46cqw, 120%) / -2); opacity:0.55; }
  .rf2-cutin-text { position:absolute; left:0; right:0; bottom:12%; text-align:center; }
  .rf2-cutin-text .small { font-family: var(--font-ui, monospace); color:#f0abfc; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .rf2-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7cqw, 80px); line-height:1; letter-spacing: 0.08em; color:#fdf4ff;
    text-shadow: 0 3px 0 #2e1065, 0 0 20px rgba(217,70,239,0.95); }
`;
