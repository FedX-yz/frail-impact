// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Astrec's kit looks like (the logic is in astrecPlatinum.js). All drawn in code except
// the burst art (mainCard.burstArt, his story art until the real one is drawn).
//   AstrecOver    Brace's guard at the cursor (and what it has soaked up), Draw Fire's marks
//   AstrecEffect  one-off effects: dwcleave, dwshock, dwcounter, dwrevive, dwwind, dwbreach (his charge's track)
//   AstrecScreen  Death Wish's tier on the screen's edge, Not Yet's grey, No Retreat
// ─────────────────────────────────────────────────────────────────────────────
import { dwTier, TIER_COLORS } from './astrecPlatinum.js';
const clamp01 = v => Math.max(0, Math.min(1, v));
const PALE = '#fecaca', RED = '#ef4444', BONE = '#e5e5e5';

// ── above the enemies ────────────────────────────────────────────────────
export function AstrecOver({ s, k, P, time }) {
  const a = s.kit.astrec, sk = s.stats.skill;
  if (!a || sk?.type !== 'deathwish') return null;
  const t = dwTier(s);
  return (
    <g>
      {/* Draw Fire: every armed enemy has him in its sights */}
      {a.draw > 0 && s.enemies.filter(e => e.armed || e.tier === 'elite' || e.tier === 'boss').map(e => {
        const r = e.size * s.k * 0.5, y = e.y - r - 16 * k, bl = 0.6 + 0.4 * Math.sin(time * 12 + e.id);
        return <text key={`df${e.id}`} x={e.x} y={y} textAnchor="middle" fontSize={16 * k} fontWeight={900} fill={RED} opacity={bl}
          style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>!</text>;
      })}
      {/* Brace: the guard, and how much it has soaked up */}
      {a.bracing && P && (() => {
        const R = 40 * k, f = clamp01(a.soak / Math.max(1, s.player.maxHp) / 0.5);
        return (
          <g>
            {[0, 1, 2, 3].map(i => {
              const a0 = (i / 4) * Math.PI * 2 + time * 1.5, a1 = a0 + Math.PI / 3;
              return <path key={i} d={`M${P.x + Math.cos(a0) * R},${P.y + Math.sin(a0) * R} A${R},${R} 0 0 1 ${P.x + Math.cos(a1) * R},${P.y + Math.sin(a1) * R}`}
                fill="none" stroke={BONE} strokeWidth={5 * k} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #fff)' }} />;
            })}
            <circle cx={P.x} cy={P.y} r={R * 0.75} fill={`rgba(239,68,68,${0.08 + 0.35 * f})`} stroke={PALE} strokeOpacity={0.5} strokeWidth={1.5 * k} />
            <text x={P.x} y={P.y - R - 8 * k} textAnchor="middle" fontSize={12 * k} fontWeight={900} fill={a.soak > 0 ? PALE : '#a3a3a3'}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{a.soak > 0 ? `🛡 SOAKED ${Math.round(a.soak)}` : '🛡 BRACING'}</text>
          </g>
        );
      })()}
      {/* the tier, a small ring of marks around the cursor */}
      {P && t > 0 && !a.bracing && (
        <g opacity={0.85}>
          {Array.from({ length: t }, (_, i) => {
            const ang = -Math.PI / 2 + (i - (t - 1) / 2) * 0.32, R = 30 * k;
            return <path key={i} d={`M${P.x + Math.cos(ang) * R},${P.y + Math.sin(ang) * R} l${-3 * k},${-8 * k} l${6 * k},0 z`} fill={TIER_COLORS[t]} />;
          })}
        </g>
      )}
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function AstrecEffect({ f, k }) {
  const p = clamp01(f.t / (f.life ?? 0.5)), o = 1 - p;
  if (f.kind === 'dwcleave') {
    const a = f.a ?? 0, R = f.r * (0.6 + 0.4 * p);
    const arc = (r, w, c) => <path d={`M${f.x + Math.cos(a) * r},${f.y + Math.sin(a) * r} A${r},${r} 0 0 1 ${f.x + Math.cos(a + Math.PI * 1.1) * r},${f.y + Math.sin(a + Math.PI * 1.1) * r}`}
      fill="none" stroke={c} strokeWidth={w * k} strokeLinecap="round" />;
    return <g opacity={o}>{arc(R, 7, 'rgba(127,29,29,0.7)')}{arc(R, 3, PALE)}{arc(R * 0.8, 1.5, RED)}</g>;
  }
  if (f.kind === 'dwshock') return (
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={f.r * (0.2 + 0.8 * p)} fill="none" stroke={RED} strokeWidth={5 * k * o} />
      <circle cx={f.x} cy={f.y} r={f.r * (0.1 + 0.6 * p)} fill="rgba(239,68,68,0.15)" stroke={PALE} strokeWidth={1.5 * k} />
    </g>
  );
  if (f.kind === 'dwcounter') {
    const R = f.r * (0.25 + 0.75 * Math.min(1, p * 2));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill={f.big ? 'rgba(254,202,202,0.18)' : 'rgba(229,229,229,0.1)'} stroke={f.big ? PALE : BONE} strokeWidth={(f.big ? 6 : 3) * k} style={f.big ? { filter: 'drop-shadow(0 0 10px #ef4444)' } : undefined} />
        {f.big && Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + f.id;
          return <line key={i} x1={f.x + Math.cos(a) * R * 0.4} y1={f.y + Math.sin(a) * R * 0.4} x2={f.x + Math.cos(a) * R * 1.1} y2={f.y + Math.sin(a) * R * 1.1}
            stroke={i % 2 ? RED : PALE} strokeWidth={3 * k} strokeLinecap="round" />;
        })}
      </g>
    );
  }
  if (f.kind === 'dwrevive') {
    // he gets back up: a dark ring pulled inward, then a pale one out
    const inP = clamp01(p / 0.35), outP = clamp01((p - 0.35) / 0.65);
    return (
      <g>
        {inP < 1 && <circle cx={f.x} cy={f.y} r={f.r * (1 - inP)} fill="none" stroke="#000" strokeWidth={14 * k} opacity={0.6} />}
        {outP > 0 && <circle cx={f.x} cy={f.y} r={f.r * outP} fill="none" stroke={PALE} strokeWidth={6 * k * (1 - outP)} opacity={1 - outP} />}
        <text x={f.x} y={f.y + 6 * k} textAnchor="middle" fontSize={34 * k} fontWeight={900} fill={PALE} opacity={1 - outP}
          style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 5 }}>✝</text>
      </g>
    );
  }
  if (f.kind === 'dwbreach') {
    // his charge: a heavy streak where he went through, cracks either side
    const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, mx = (f.x1 + f.x2) / 2, my = (f.y1 + f.y2) / 2;
    return (
      <g opacity={o}>
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="rgba(0,0,0,0.55)" strokeWidth={22 * k} strokeLinecap="round" />
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={RED} strokeOpacity={0.55} strokeWidth={12 * k} strokeLinecap="round" />
        <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={PALE} strokeWidth={3 * k} strokeLinecap="round" />
        {[1, -1].map(sd => <path key={sd} d={`M${mx + nx * sd * 10 * k},${my + ny * sd * 10 * k} l${nx * sd * 9 * k + dx / L * 6 * k},${ny * sd * 9 * k + dy / L * 6 * k} l${nx * sd * 6 * k - dx / L * 4 * k},${ny * sd * 6 * k - dy / L * 4 * k}`}
          fill="none" stroke={BONE} strokeOpacity={0.6} strokeWidth={1.5 * k} />)}
      </g>
    );
  }
  if (f.kind === 'dwwind') return (
    <g opacity={o}>
      <circle cx={f.x} cy={f.y} r={f.r * (0.3 + 0.7 * p)} fill="rgba(134,239,172,0.12)" stroke="#86efac" strokeWidth={3 * k} />
    </g>
  );
  return null;
}

// ── on the screen ────────────────────────────────────────────────────────
export function AstrecScreen({ s, mainCard, mobile }) {
  const a = s.kit.astrec, sk = s.stats.skill;
  if (!a || sk?.type !== 'deathwish') return null;
  const nr = s.ult.active?.type === 'noretreat' ? s.ult.active : null;
  const t = dwTier(s);
  return (
    <>
      {t > 0 && <div className={`dw-edge t${t}`} />}
      {a.lock > 0 && !nr && <div className="dw-lock" style={{ opacity: Math.min(1, a.lock / 2) }} />}
      {nr && !a.cutin && <div className="dw-tag" style={mobile ? { top: '24%' } : undefined}>NO RETREAT · {Math.max(0, nr.t).toFixed(1)}s</div>}
      {a.cutin && <DwCutIn c={a.cutin} card={mainCard} mobile={mobile} />}
    </>
  );
}

// The burst art: a narrow vertical slit opens down the middle with him in it (no backdrop)
function DwCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life;
  const open = clamp01(t / 0.16), close = clamp01((t - (L - 0.2)) / 0.2), w = (mobile ? 46 : 30) * open * (1 - close);
  const art = card?.burstArt ?? card?.sprite;
  const [fx, fy] = card?.burstFocus ?? [50, 10];
  return (
    <div className="dw-cutin">
      <div className="dw-cutin-slit" style={{ width: `${w}%` }}>
        {art && <img src={art} alt="" draggable={false} className="dw-cutin-face" style={{ transform: `translate(-${fx}%, -${fy}%) scale(${1 + 0.06 * t})` }} />}
      </div>
      <div className="dw-cutin-text" style={{ opacity: clamp01((t - 0.15) / 0.1) * (1 - close) }}>
        <div className="small">PLATINUM · DEATH WISH</div>
        <div className="big">NO RETREAT</div>
      </div>
    </div>
  );
}

export const ASTREC_CSS = `
  .dw-edge { position:absolute; inset:0; z-index:10; pointer-events:none; transition: box-shadow .3s; }
  .dw-edge.t1 { box-shadow: inset 0 0 40px rgba(251,146,60,0.35); }
  .dw-edge.t2 { box-shadow: inset 0 0 60px rgba(239,68,68,0.45); }
  .dw-edge.t3 { box-shadow: inset 0 0 90px rgba(185,28,28,0.7); animation: dwBeat 0.8s ease-in-out infinite; }
  @keyframes dwBeat { 0%,100% { filter: brightness(1); } 15% { filter: brightness(1.5); } 30% { filter: brightness(1); } 45% { filter: brightness(1.3); } }
  .dw-lock { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 70px rgba(115,115,115,0.55); backdrop-filter: saturate(0.6); }
  .dw-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#fee2e2; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #b91c1c, 0 2px 0 #000; white-space:nowrap; }
  .dw-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .dw-cutin-slit { position:absolute; left:50%; top:0; bottom:0; transform:translateX(-50%); overflow:hidden; background:#0a0a0a;
    border-left: 3px solid #fecaca; border-right: 3px solid #fecaca; box-shadow: 0 0 40px rgba(239,68,68,0.6); }
  .dw-cutin-face { position:absolute; left:50%; top:22%; width:auto; height:260%; max-width:none; filter: contrast(1.15) drop-shadow(0 0 10px #ef4444); }
  .dw-cutin-text { position:absolute; left:0; right:0; bottom:24%; text-align:center; }
  .dw-cutin-text .small { font-family: var(--font-ui, monospace); color:#fecaca; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .dw-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7cqw, 80px); line-height:1; letter-spacing: 0.06em; color:#fee2e2;
    text-shadow: 0 3px 0 #000, 0 0 18px rgba(239,68,68,0.9); }
`;
