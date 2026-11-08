// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Boi's kit looks like (the logic is in boiPlatinum.js). All drawn in code except
// the burst art (mainCard.burstArt: a placeholder until the real one is drawn).
//   BoiOver    the aura at the cursor (by form), the Ki ring, rocks lifting while he powers
//              up, the beam, Ki blasts, the Spirit Bomb, blinded enemies, Ultra's afterimages
//   BoiEffect  one-off effects (sbNova, sbZap, sbDash, sbFlare, sbDodge, sbTele, sbBlast, …)
//   BoiScreen  the form on the screen's edge, the cut-in when he goes up, Ultra's tag
// ─────────────────────────────────────────────────────────────────────────────
import { boiLook, isUltra, FORMS, CHANT } from './boiPlatinum.js';
const clamp01 = v => Math.max(0, Math.min(1, v));
const SKY = '#a5f3fc', WHITE = '#ffffff';

// a flickering flame of spikes around (x, y): the aura
function auraPath(x, y, R, time, n, wild, up = 1) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const tip = i % 2 === 0;
    // the flames lick upward: longer on top
    const top = 0.5 - 0.5 * Math.sin(a);
    const f = 1 + (tip ? (0.35 + 0.55 * top * up) * (0.75 + wild * 0.5 * Math.sin(time * 23 + i * 2.3) * Math.sin(time * 9 + i)) : -0.05);
    const r = R * f;
    d += `${i ? 'L' : 'M'}${x + Math.cos(a) * r},${y + Math.sin(a) * r * (tip && Math.sin(a) < 0 ? 1.25 : 1)}`;
  }
  return d + 'Z';
}
// a jagged lightning line between points
function bolt(pts, seed, jag) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    const steps = Math.max(2, Math.round(L / 28));
    for (let j = 1; j < steps; j++) {
      const u = j / steps, off = Math.sin(seed * 12.9 + i * 7.1 + j * 3.7) * jag;
      d += `L${x0 + (x1 - x0) * u + nx * off},${y0 + (y1 - y0) * u + ny * off}`;
    }
    d += `L${x1},${y1}`;
  }
  return d;
}

// ── above the enemies ────────────────────────────────────────────────────
export function BoiOver({ s, k, P, time }) {
  const a = s.kit.boi, sk = s.stats.skill;
  if (!a) return null;
  const mine = sk?.type === 'saiyan';
  const lk = boiLook(s), ultra = isUltra(s);
  const ch = a.charging, form = a.form;
  return (
    <g>
      {/* Solar Flare: the blinded ones, stars going round their heads */}
      {mine && s.enemies.filter(e => e.blind > 0).map(e => {
        const r = e.size * s.k * 0.5, y = e.y - r - 8 * k;
        return (
          <g key={`bl${e.id}`} opacity={Math.min(1, e.blind * 2)}>
            {[0, 1, 2].map(i => {
              const ang = time * 5 + i * 2.09, x = e.x + Math.cos(ang) * r * 0.55, yy = y + Math.sin(ang) * 5 * k;
              return <text key={i} x={x} y={yy} textAnchor="middle" fontSize={11 * k} fill="#fef08a" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2 }}>✦</text>;
            })}
          </g>
        );
      })}
      {/* Ki blasts */}
      {a.blasts.map((b, i) => (
        <g key={`kb${i}`}>
          <line x1={b.x - b.vx * 0.03} y1={b.y - b.vy * 0.03} x2={b.x} y2={b.y} stroke={lk.aura ?? SKY} strokeOpacity={0.5} strokeWidth={b.r * 1.4} strokeLinecap="round" />
          <circle cx={b.x} cy={b.y} r={b.r} fill={WHITE} style={{ filter: `drop-shadow(0 0 ${6 * k}px ${lk.aura ?? SKY})` }} />
        </g>
      ))}
      {/* KA-ME-HA-ME-BOI */}
      {a.beam && <Beam b={a.beam} s={s} k={k} time={time} form={form} ultra={ultra} />}
      {/* Ultra: afterimages behind the cursor */}
      {mine && P && (ultra || form >= 1) && a.trail.slice(0, -1).map((t, i, all) => (
        <circle key={`tr${i}`} cx={t.x} cy={t.y} r={(10 + i * 1.5) * k} fill="none" stroke={lk.aura} strokeOpacity={0.08 + 0.3 * (i / all.length)} strokeWidth={2 * k} />
      ))}
      {/* rocks lifting off the ground while he powers up */}
      {P && a.rocks.map((r, i) => {
        const o = 1 - clamp01((r.t - r.life * 0.7) / (r.life * 0.3));
        return <rect key={`rk${i}`} x={P.x + r.x - r.r} y={P.y + r.y - r.r} width={r.r * 2} height={r.r * 1.6} rx={r.r * 0.3} fill="#57534e" stroke="#292524" strokeWidth={1}
          opacity={o} transform={`rotate(${r.rot * 57} ${P.x + r.x} ${P.y + r.y})`} />;
      })}
      {/* the aura: flames licking up around him, bigger each form */}
      {mine && P && (lk.aura || ch) && (() => {
        const base = ultra ? 40 : 30 + 7 * form, R = (base + (ch ? 12 + 10 * (a.ki / 100) : 0)) * k;
        const col = lk.aura ?? SKY, wild = ultra ? 0.25 : ch ? 1.4 : 0.6 + 0.3 * form;
        const deep = ultra ? '#6366f1' : form ? '#d97706' : '#0891b2';
        return (
          <g>
            <path d={auraPath(P.x, P.y, R * 1.3, time, 9, wild, 1.4)} fill={deep} opacity={0.22} />
            <path d={auraPath(P.x, P.y, R, time + 0.37, 11, wild)} fill={col} fillOpacity={0.42} stroke={col} strokeWidth={2.5 * k}
              style={{ filter: `drop-shadow(0 0 ${10 * k}px ${col})` }} />
            <path d={auraPath(P.x, P.y, R * 0.72, time + 0.71, 9, wild * 0.8)} fill="#fffbeb" fillOpacity={0.35} stroke={WHITE} strokeOpacity={0.8} strokeWidth={1.2 * k} />
            {/* Super 2 and up (and Ultra): it crackles */}
            {(form >= 2 || ultra || (ch && form >= 1)) && [0, 1, 2, 3].map(i => {
              const seed = Math.floor(time * 14) + i * 31;
              if ((seed * 7) % 5 > (form >= 3 || ultra ? 3 : 2)) return null;
              const a0 = seed * 1.7, r0 = R * 0.4, r1 = R * 1.45;
              const d = bolt([[P.x + Math.cos(a0) * r0, P.y + Math.sin(a0) * r0], [P.x + Math.cos(a0 + 0.5) * r1, P.y + Math.sin(a0 + 0.5) * r1]], seed, 7 * k);
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={ultra ? '#818cf8' : '#0ea5e9'} strokeOpacity={0.6} strokeWidth={4.5 * k} strokeLinecap="round" />
                  <path d={d} fill="none" stroke={WHITE} strokeWidth={1.6 * k} strokeLinecap="round" />
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* the Ki ring: how much he has. Full while he powers up: it flashes (let go now) */}
      {mine && P && !ultra && (() => {
        const R = 38 * k, f = clamp01(a.ki / 100), full = f >= 0.995 && form < 3;
        const a0 = -Math.PI / 2, a1 = a0 + f * Math.PI * 2 * 0.9999;
        const big = f > 0.5 ? 1 : 0;
        const col = full && ch ? (Math.floor(time * 10) % 2 ? WHITE : lk.color) : FORMS[form].color;
        return (
          <g opacity={a.wind > 0 ? 0.4 : 0.9}>
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={4 * k} />
            {f > 0.005 && <path d={`M${P.x + Math.cos(a0) * R},${P.y + Math.sin(a0) * R} A${R},${R} 0 ${big} 1 ${P.x + Math.cos(a1) * R},${P.y + Math.sin(a1) * R}`}
              fill="none" stroke={col} strokeWidth={(full ? 4 : 3) * k} strokeLinecap="round" style={full ? { filter: `drop-shadow(0 0 ${6 * k}px ${col})` } : undefined} />}
            {/* a notch per form he's in */}
            {Array.from({ length: form }, (_, i) => {
              const ang = -Math.PI / 2 + (i - (form - 1) / 2) * 0.28;
              return <circle key={i} cx={P.x + Math.cos(ang) * (R + 8 * k)} cy={P.y + Math.sin(ang) * (R + 8 * k)} r={2.6 * k} fill={FORMS[form].color} />;
            })}
          </g>
        );
      })()}
      {/* OOFED!!!!: the last word, slammed in huge over the beam, bigger the more of the chant came first */}
      {a.oof && (() => {
        const f = a.oof, p = clamp01(f.t / f.life), pop = clamp01(f.t / 0.1), sz = (26 + 9 * f.stage) * k * (1.6 - 0.6 * pop) * (1 + 0.15 * p);
        const jx = Math.sin(f.t * 70) * (1 - p) * 4 * k, jy = Math.cos(f.t * 53) * (1 - p) * 4 * k;
        return <text x={f.x + jx} y={f.y - (40 + 8 * f.stage) * k - 30 * k * p + jy} textAnchor="middle" fontSize={sz} fill={WHITE} opacity={1 - clamp01((p - 0.6) / 0.4)}
          style={{ ...WORD, strokeWidth: 6 * k, filter: `drop-shadow(0 0 ${10 * k}px #38bdf8)` }}>OOFED!!!!</text>;
      })()}
      {/* the Spirit Bomb: it gathers over him, then comes down */}
      {a.bomb && <Bomb b={a.bomb} k={k} time={time} />}
      {mine && ultra && !a.thrown && P && (() => {
        const n = a.bombN, R = (8 + Math.min(30, n * 1.2)) * k, y = P.y - 90 * k;
        return (
          <g opacity={0.85}>
            <circle cx={P.x} cy={y} r={R} fill="rgba(191,219,254,0.35)" stroke="#dbeafe" strokeWidth={1.5 * k} style={{ filter: `drop-shadow(0 0 ${10 * k}px #93c5fd)` }} />
            <circle cx={P.x} cy={y} r={R * 0.55} fill={WHITE} opacity={0.6 + 0.2 * Math.sin(time * 6)} />
          </g>
        );
      })()}
    </g>
  );
}

const WORD = { fontFamily: 'var(--font-hit, sans-serif)', paintOrder: 'stroke', stroke: '#082f49', strokeLinejoin: 'round' };
function Beam({ b, s, k, time, form, ultra }) {
  const W = (ultra ? 2.4 : [1, 1.3, 1.6, 2.1][form]) * 46 * s.k * (0.55 + 0.15 * b.stage);
  const col = ultra ? '#c7d2fe' : form >= 1 ? '#7dd3fc' : '#67e8f9';
  if (!b.firing) {
    // the chant: the ball swells a step with every word, the light pulled into it faster
    const pop = clamp01(b.stageT / 0.12), full = b.stage >= CHANT.length;
    const R = (7 + 7 * b.stage + 3 * (1 - pop)) * k * (ultra ? 1.4 : 1 + form * 0.15) * (full ? 1 + 0.06 * Math.sin(time * 50) : 1);
    const lines = 6 + 3 * b.stage, speed = 1.5 + b.stage;
    // the words so far, side by side over his hands; the newest one big
    const words = CHANT.slice(0, b.stage), gap = 8 * k;
    const size = i => (i === b.stage - 1 ? (20 + 4 * b.stage) * k * (1.35 - 0.35 * pop) : 15 * k);
    const widths = words.map((w, i) => w.length * size(i) * 0.7);
    let x = b.x - (widths.reduce((a, c) => a + c, 0) + gap * (words.length - 1)) / 2;
    const y = b.y - R - 26 * k;
    return (
      <g>
        {Array.from({ length: lines }, (_, i) => {
          const ang = i * (6.283 / lines) + time * 3, r0 = (90 - 66 * ((time * speed + i * 0.13) % 1)) * k;
          return <line key={i} x1={b.x + Math.cos(ang) * r0} y1={b.y + Math.sin(ang) * r0} x2={b.x + Math.cos(ang) * (r0 - 16 * k)} y2={b.y + Math.sin(ang) * (r0 - 16 * k)}
            stroke={col} strokeWidth={2 * k} strokeLinecap="round" opacity={0.85} />;
        })}
        <circle cx={b.x} cy={b.y} r={R * 1.7} fill={col} opacity={0.25} />
        <circle cx={b.x} cy={b.y} r={R} fill={WHITE} style={{ filter: `drop-shadow(0 0 ${(10 + 4 * b.stage) * k}px ${col})` }} />
        {words.map((w, i) => {
          const sz = size(i), cx = x + widths[i] / 2, last = i === b.stage - 1;
          x += widths[i] + gap;
          const jx = full && last ? Math.sin(time * 61) * 1.5 * k : 0, jy = full && last ? Math.cos(time * 47) * 1.5 * k : 0;
          return <text key={i} x={cx + jx} y={y + jy} textAnchor="middle" fontSize={sz} fill={last ? WHITE : '#e0f2fe'} opacity={last ? 1 : 0.9}
            style={{ ...WORD, strokeWidth: (last ? 5 : 3) * k, filter: last ? `drop-shadow(0 0 ${6 * k}px ${col})` : undefined }}>{w}</text>;
        })}
      </g>
    );
  }
  // firing: at full width, then it thins out and is gone
  const L = Math.hypot(s.W, s.H) * 1.3, ux = Math.cos(b.ang), uy = Math.sin(b.ang);
  const left = b.fireDur - b.fireT, thin = clamp01(left / 0.3) * (0.6 + 0.4 * clamp01(b.fireT / 0.08));
  const x2 = b.x + ux * L, y2 = b.y + uy * L, wob = (1 + 0.08 * Math.sin(time * 40) + 0.05 * Math.sin(time * 17)) * thin;
  return (
    <g style={{ mixBlendMode: 'screen' }}>
      <line x1={b.x} y1={b.y} x2={x2} y2={y2} stroke={col} strokeOpacity={0.3} strokeWidth={W * 1.6 * wob} strokeLinecap="round" />
      <line x1={b.x} y1={b.y} x2={x2} y2={y2} stroke={col} strokeOpacity={0.8} strokeWidth={W * wob} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${14 * k}px ${col})` }} />
      <line x1={b.x} y1={b.y} x2={x2} y2={y2} stroke={WHITE} strokeWidth={W * 0.45 * wob} strokeLinecap="round" />
      {/* the rings that ride along it */}
      {[0, 1, 2, 3].map(i => {
        const d = ((time * 900 * s.k + i * 220 * s.k) % (L * 0.6)) + 30 * s.k;
        const cx = b.x + ux * d, cy = b.y + uy * d;
        return <ellipse key={i} cx={cx} cy={cy} rx={W * 0.18 * thin} ry={W * 0.75 * thin} fill="none" stroke={WHITE} strokeOpacity={0.55} strokeWidth={2 * k}
          transform={`rotate(${b.ang * 57.3} ${cx} ${cy})`} />;
      })}
      <circle cx={b.x} cy={b.y} r={W * 0.75 * wob} fill={WHITE} style={{ filter: `drop-shadow(0 0 ${16 * k}px ${col})` }} />
    </g>
  );
}

function Bomb({ b, k, time }) {
  // it lifts and swells high above, then drops onto where he was pointing
  const R = 40 * k * b.size * 2;
  const top = -R * 0.2;
  const lf = clamp01(b.t / b.lift), ff = clamp01((b.t - b.lift) / b.fall);
  const y = top + (b.y - top) * (ff * ff);
  const r = R * (0.4 + 0.6 * lf);
  return (
    <g>
      {ff > 0 && <ellipse cx={b.x} cy={b.y} rx={b.r * ff} ry={b.r * 0.35 * ff} fill="rgba(147,197,253,0.18)" stroke="#bfdbfe" strokeOpacity={0.5} strokeWidth={2 * k} />}
      <circle cx={b.x} cy={y} r={r * 1.35} fill="rgba(191,219,254,0.25)" />
      <circle cx={b.x} cy={y} r={r} fill="rgba(219,234,254,0.75)" stroke={WHITE} strokeWidth={2 * k} style={{ filter: `drop-shadow(0 0 ${20 * k}px #60a5fa)` }} />
      {[0, 1, 2, 3, 4].map(i => {
        const a = time * 2 + i * 1.26;
        return <ellipse key={i} cx={b.x} cy={y} rx={r * 0.9} ry={r * 0.25} fill="none" stroke="#93c5fd" strokeOpacity={0.6} strokeWidth={1.4 * k}
          transform={`rotate(${a * 57.3} ${b.x} ${y})`} />;
      })}
      <circle cx={b.x} cy={y} r={r * 0.45} fill={WHITE} />
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function BoiEffect({ f, k }) {
  const p = clamp01(f.t / (f.life ?? 0.5)), o = 1 - p;
  if (f.kind === 'sbNova') {
    // going up: a ring tears outward, light spikes, the ground cracks
    const R = f.r * (0.15 + 0.85 * Math.pow(p, 0.6));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="none" stroke={f.color} strokeWidth={14 * k * o} style={{ filter: `drop-shadow(0 0 ${12 * k}px ${f.color})` }} />
        <circle cx={f.x} cy={f.y} r={R * 0.75} fill="none" stroke={WHITE} strokeWidth={3 * k * o} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 + f.id, r0 = R * 0.2, r1 = R * (i % 2 ? 0.9 : 1.25);
          return <line key={i} x1={f.x + Math.cos(a) * r0} y1={f.y + Math.sin(a) * r0} x2={f.x + Math.cos(a) * r1} y2={f.y + Math.sin(a) * r1}
            stroke={i % 2 ? WHITE : f.color} strokeWidth={(i % 2 ? 2 : 4) * k} strokeLinecap="round" />;
        })}
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + f.id * 2;
          return <path key={`c${i}`} d={bolt([[f.x, f.y], [f.x + Math.cos(a) * f.r * 0.5, f.y + Math.sin(a) * f.r * 0.5]], f.id + i, 7 * k)} fill="none" stroke="#1c1917" strokeOpacity={0.6} strokeWidth={2.5 * k} />;
        })}
      </g>
    );
  }
  if (f.kind === 'sbPulse') return (
    <g opacity={o * 0.8}>
      <circle cx={f.x} cy={f.y} r={f.r * (0.3 + 0.7 * p)} fill="none" stroke={f.color} strokeWidth={4 * k * o} />
    </g>
  );
  if (f.kind === 'sbZap') {
    const seed = f.id + Math.floor(f.t * 30);
    return (
      <g opacity={o}>
        <path d={bolt(f.pts, seed, 10 * k)} fill="none" stroke={f.color} strokeOpacity={0.45} strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round" />
        <path d={bolt(f.pts, seed, 10 * k)} fill="none" stroke={WHITE} strokeWidth={2 * k} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${5 * k}px ${f.color})` }} />
      </g>
    );
  }
  if (f.kind === 'sbDash') {
    // where he blurred through: a streak and the ghosts he left
    const n = 3;
    return (
      <g opacity={o}>
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color} strokeOpacity={0.35} strokeWidth={18 * k} strokeLinecap="round" />
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={WHITE} strokeWidth={2.5 * k} strokeLinecap="round" />
        {Array.from({ length: n }, (_, i) => {
          const u = (i + 0.5) / n;
          return <circle key={i} cx={f.x1 + (f.x2 - f.x1) * u} cy={f.y1 + (f.y2 - f.y1) * u} r={12 * k} fill="none" stroke={f.color} strokeOpacity={0.6} strokeWidth={2 * k} />;
        })}
      </g>
    );
  }
  if (f.kind === 'sbFlare') return (
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={60 * k + f.r * 0.15 * p} fill={WHITE} opacity={0.9 * o} />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return <line key={i} x1={f.x} y1={f.y} x2={f.x + Math.cos(a) * f.r * (0.3 + p)} y2={f.y + Math.sin(a) * f.r * (0.3 + p)} stroke="#fef9c3" strokeOpacity={0.7} strokeWidth={(i % 2 ? 3 : 7) * k} />;
      })}
    </g>
  );
  if (f.kind === 'sbDodge') return (
    // the afterimage where he was, and where he went
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={16 * k} fill="rgba(199,210,254,0.25)" stroke="#e0e7ff" strokeWidth={2 * k} />
      <circle cx={f.x + f.dx * (1 + p)} cy={f.y + f.dy * (1 + p)} r={12 * k} fill="none" stroke="#a5b4fc" strokeWidth={1.5 * k} />
      <line x1={f.x} y1={f.y} x2={f.x + f.dx * 2} y2={f.y + f.dy * 2} stroke={WHITE} strokeOpacity={0.6} strokeWidth={1.5 * k} />
    </g>
  );
  if (f.kind === 'sbTele') return (
    <g opacity={o}>
      <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#c7d2fe" strokeOpacity={0.5} strokeWidth={3 * k} strokeDasharray={`${6 * k} ${5 * k}`} />
      <circle cx={f.x2} cy={f.y2} r={(10 + 26 * p) * k} fill="none" stroke={WHITE} strokeWidth={3 * k * o} />
    </g>
  );
  if (f.kind === 'sbBlast') return (
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={f.r * (0.3 + 0.7 * p)} fill={f.color} fillOpacity={0.35 * o} stroke={WHITE} strokeWidth={2.5 * k} />
    </g>
  );
  if (f.kind === 'sbBoom') {
    const R = f.r * (0.2 + 0.8 * Math.pow(p, 0.5));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="rgba(219,234,254,0.55)" stroke={WHITE} strokeWidth={8 * k * o} style={{ filter: `drop-shadow(0 0 ${24 * k}px #60a5fa)` }} />
        <circle cx={f.x} cy={f.y} r={R * 1.3} fill="none" stroke="#93c5fd" strokeWidth={4 * k * o} />
      </g>
    );
  }
  if (f.kind === 'sbDrop') return (
    // out of power: the aura gutters out
    <g opacity={o}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + f.id, r = f.r * (0.3 + 0.7 * p);
        return <circle key={i} cx={f.x + Math.cos(a) * r} cy={f.y + Math.sin(a) * r - 20 * k * p} r={(6 - 4 * p) * k} fill="#9ca3af" opacity={0.6} />;
      })}
    </g>
  );
  if (f.kind === 'sbZen') return (
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={f.r * (1 - p * 0.6)} fill="none" stroke="#ef4444" strokeWidth={6 * k * o} />
      <circle cx={f.x} cy={f.y} r={f.r * 0.5 * (0.5 + p)} fill="none" stroke="#fde047" strokeWidth={3 * k} />
    </g>
  );
  return null;
}

// ── on the screen ────────────────────────────────────────────────────────
export function BoiScreen({ s, mainCard, mobile }) {
  const a = s.kit.boi, sk = s.stats.skill;
  if (!a || sk?.type !== 'saiyan') return null;
  const ultra = isUltra(s) ? s.ult.active : null;
  return (
    <>
      <HairFilters />
      {ultra ? <div className="sb-edge ultra" /> : a.form > 0 && <div className={`sb-edge f${a.form}`} />}
      {a.charging && <div className="sb-charge" style={{ opacity: 0.35 + 0.5 * (a.ki / 100) }} />}
      {a.wind > 0 && <div className="sb-wind" style={{ opacity: Math.min(1, a.wind) }} />}
      {ultra && !a.cutin && <div className="sb-tag" style={mobile ? { top: '24%' } : undefined}>ULTRA BOI · {Math.max(0, ultra.t).toFixed(1)}s</div>}
      {a.cutin && <SbCutIn c={a.cutin} card={mainCard} mobile={mobile} />}
    </>
  );
}

// His hair, recoloured by the form (only the blue in the art changes: skin, coat and lines
// stay): gold for the Super forms, silver for Ultra. Used on the cut-in and his HUD portrait.
// (hairFilter in boiPlatinum.js picks which)
function HairFilters() {
  // mask = where the art is bluer than it is red (his hair), alpha ×4
  const mask = <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 4 0 0" result="m" />;
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="sbGold" colorInterpolationFilters="sRGB">
        {mask}
        <feColorMatrix in="SourceGraphic" type="hueRotate" values="-128" result="r" />
        <feColorMatrix in="r" type="saturate" values="1.6" result="r2" />
        <feComposite in="r2" in2="m" operator="in" result="hair" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="hair" /></feMerge>
      </filter>
      <filter id="sbSilver" colorInterpolationFilters="sRGB">
        {mask}
        <feColorMatrix in="SourceGraphic" type="saturate" values="0.25" result="r" />
        <feComponentTransfer in="r" result="r2"><feFuncR type="linear" slope="1.25" intercept="0.05" /><feFuncG type="linear" slope="1.25" intercept="0.05" /><feFuncB type="linear" slope="1.3" intercept="0.1" /></feComponentTransfer>
        <feComposite in="r2" in2="m" operator="in" result="hair" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="hair" /></feMerge>
      </filter>
    </svg>
  );
}

// The cut-in: a slanted band slams across the screen with him in it, lit by the form
function SbCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life;
  const open = clamp01(t / 0.14), close = clamp01((t - (L - 0.22)) / 0.22);
  const art = card?.burstArt ?? card?.sprite;
  const [fx, fy] = card?.burstFocus ?? [50, 12];
  const tint = c.ultra ? 'url(#sbSilver) drop-shadow(0 0 12px #a5b4fc)' : 'url(#sbGold) brightness(1.08) drop-shadow(0 0 12px #facc15)';
  return (
    <div className="sb-cutin">
      <div className="sb-band" style={{ height: `${(mobile ? 30 : 34) * open * (1 - close)}%`, '--sb': c.color }}>
        <div className="sb-lines" />
        {art && <img src={art} alt="" draggable={false} className="sb-face" style={{ transform: `translate(-${fx}%, -${fy}%) scale(${1.02 + 0.05 * t}) translateX(${(1 - open) * 30}%)`, filter: tint }} />}
      </div>
      <div className="sb-text" style={{ opacity: clamp01((t - 0.12) / 0.1) * (1 - close), color: c.color }}>
        <div className="small">PLATINUM · LIMIT BREAKER</div>
        <div className="big">{c.name}</div>
      </div>
    </div>
  );
}

export const BOI_CSS = `
  .sb-edge { position:absolute; inset:0; z-index:10; pointer-events:none; transition: box-shadow .3s; }
  .sb-edge.f1 { box-shadow: inset 0 0 50px rgba(250,204,21,0.35); }
  .sb-edge.f2 { box-shadow: inset 0 0 70px rgba(253,224,71,0.45), inset 0 0 12px rgba(125,211,252,0.5); animation: sbCrackle 0.18s steps(2) infinite; }
  .sb-edge.f3 { box-shadow: inset 0 0 100px rgba(245,158,11,0.6), inset 0 0 16px rgba(125,211,252,0.6); animation: sbCrackle 0.12s steps(2) infinite; }
  .sb-edge.ultra { box-shadow: inset 0 0 90px rgba(165,180,252,0.5); animation: sbCalm 2.4s ease-in-out infinite; }
  @keyframes sbCrackle { 0% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
  @keyframes sbCalm { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
  .sb-charge { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 80px rgba(255,255,255,0.35); animation: sbShudder 0.08s steps(2) infinite; }
  @keyframes sbShudder { 0% { transform: translate(0,0); } 50% { transform: translate(1px,-1px); } }
  .sb-wind { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 70px rgba(100,116,139,0.6); }
  .sb-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#e0e7ff; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #6366f1, 0 2px 0 #000; white-space:nowrap; }
  .sb-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .sb-band { position:absolute; left:-10%; right:-10%; top:50%; transform:translateY(-50%) rotate(-7deg); overflow:hidden;
    background: linear-gradient(90deg, #0a0a0a, #1c1917 50%, #0a0a0a); border-top: 4px solid var(--sb); border-bottom: 4px solid var(--sb);
    box-shadow: 0 0 50px var(--sb); }
  .sb-lines { position:absolute; inset:0; background: repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,255,255,0.08) 22px 24px, transparent 24px 61px, rgba(255,255,255,0.05) 61px 62px);
    animation: sbSpeed 0.25s linear infinite; }
  @keyframes sbSpeed { from { background-position: 0 0; } to { background-position: -124px 0; } }
  .sb-face { position:absolute; left:32%; top:50%; width:auto; height:330%; max-width:none; }
  .sb-text { position:absolute; left:0; right:0; top:61%; text-align:center; }
  .sb-text .small { font-family: var(--font-ui, monospace); color:#e7e5e4; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .sb-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7cqw, 80px); line-height:1; letter-spacing: 0.06em;
    text-shadow: 0 3px 0 #000, 0 0 22px currentColor; }
`;
