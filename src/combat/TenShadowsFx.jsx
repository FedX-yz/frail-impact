// ─────────────────────────────────────────────────────────────────────────────
// Bio's Ten Shadows and Mahoraga: everything that's drawn (the rules are in
// tenShadows.js). The Divine Dogs, the Toad, Nue and Mahoraga are drawn sprites
// (public/allies); the shadows without art yet are game-icons.net silhouettes
// (data/gameIcons.js) painted in shadow ink with a rim of light.
// ─────────────────────────────────────────────────────────────────────────────
import { GAME_ICONS } from '../data/gameIcons';
import { SHADOWS, SHADOW_BY_ID, COMBOS, SHIKI_IMG, costFor, tapFor, combosKnown } from './tenShadows';

const BASE = import.meta.env.BASE_URL;
export const MAHORAGA_IMG = `${BASE}allies/mahoraga-shades.png`;
// the shikigami with art: the black dog looks right, the white one left; the Toad and Nue face you
// a dog sprite turned toward `left` (true = looking left)
export function DogSprite({ white, width, left, glow }) {
  const flip = white ? !left : left;
  return <img src={white ? SHIKI_IMG.dogWhite : SHIKI_IMG.dogBlack} alt="" draggable={false} width={width}
    style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined, filter: glow }} />;
}
const art = (src, width, filter) => <img src={src} alt="" draggable={false} width={width} style={{ display: 'block', filter }} />;
// the wheel / the toast use the art where there is some
const ICON_ART = { dogs: SHIKI_IMG.dogWhite, dog: SHIKI_IMG.dogWhite, toad: SHIKI_IMG.toad, nue: SHIKI_IMG.nue };
export const MAHORAGA_BERSERK_IMG = `${BASE}allies/mahoraga-berserk.png`;   // the berserk General (cut out of the cut-in art)
export const CUTIN_SUMMON = `${BASE}cardart/bio-shadows-card.png`;          // "…WITH THIS TREASURE I SUMMON!"
export const CUTIN_BERSERK = `${BASE}cutins/mahoraga-berserk.png`;

const INK = '#07061a';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A shikigami as a DOM element (allies)
export function ShikiArt({ name, size, fill = INK, rim = '#c7d2fe', flip, sw = 22, children }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} style={{ display: 'block', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d={GAME_ICONS[name][2]} fill={fill} stroke={rim} strokeWidth={sw} strokeLinejoin="round" paintOrder="stroke" />
      {children}
    </svg>
  );
}
// The same inside an <svg>, centred on (x, y)
function Sil({ name, x, y, size, fill = INK, rim = '#c7d2fe', sw = 18, flip = false, rot = 0, opacity, filter, sy = 1 }) {
  const sc = size / 512;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -sc : sc} ${sc * sy}) translate(-256 -256)`} opacity={opacity} style={filter ? { filter } : undefined}>
      <path d={GAME_ICONS[name][2]} fill={fill} stroke={rim} strokeWidth={sw} strokeLinejoin="round" paintOrder="stroke" />
    </g>
  );
}
const arcPath = (cx, cy, r, a0, a1) => {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} A${r},${r} 0 ${large} 1 ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r}`;
};
const wedgePath = (cx, cy, r0, r1, a0, a1) => {
  const p = (r, a) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
};

// ── The summoned (DOM, above the enemies) ─────────────────────────────────
export function TsAllies({ s, k }) {
  return s.allies.map(a => {
    if (!a.ts) return null;   // the usual kit's shikigami are drawn by BattleArena
    const op = a.life < 1 ? Math.max(0, a.life) : 1;
    const base = { position: 'absolute', left: a.x, top: a.y, zIndex: 8, pointerEvents: 'none', opacity: op };
    if (a.kind === 'dog') {
      const tg = s.enemies.find(e => e.id === a.target), left = !!tg && tg.x < a.x;
      // Totality: the two dogs as one, bigger, white-hot and red-eyed
      if (a.totality) return (
        <div key={a.id} className="shiki summoned dog totality" style={{ ...base, filter: a.pack ? 'drop-shadow(0 0 12px #f97316) drop-shadow(0 0 3px #ef4444)' : 'drop-shadow(0 0 12px #e0e7ff) drop-shadow(0 0 4px #ef4444)' }}>
          <DogSprite width={124 * k} left={left} />
          {a.howl > 0 && <span className="shiki-howl" style={{ opacity: a.howl / 0.8 }} />}
        </div>
      );
      return (
        <div key={a.id} className="shiki summoned dog" style={{ ...base, filter: a.pack ? 'drop-shadow(0 0 9px #f97316) drop-shadow(0 2px 3px #000)' : a.white ? 'drop-shadow(0 0 6px #6366f1) drop-shadow(0 2px 3px #000)' : 'drop-shadow(0 0 6px #e0e7ff) drop-shadow(0 2px 3px #000)' }}>
          <DogSprite white={a.white} width={70 * k} left={left} />
        </div>
      );
    }
    if (a.kind === 'nue2') return (
      <div key={a.id} className="shiki summoned nue2" style={{ ...base, zIndex: 9 }}>
        {art(SHIKI_IMG.nue, 92 * k)}
      </div>
    );
    if (a.kind === 'toad') return (
      <div key={a.id} className="shiki summoned toad" style={{ ...base, filter: 'drop-shadow(0 0 8px #22c55e) drop-shadow(0 2px 3px #000)' }}>
        {art(SHIKI_IMG.toad, (a.sit > 0 ? 84 : 68) * k)}
      </div>
    );
    if (a.kind === 'deer') return (
      <div key={a.id} className="shiki summoned deer" style={{ ...base, filter: `drop-shadow(0 0 ${a.healT > 0 ? 16 : 8}px #4ade80) drop-shadow(0 2px 3px #000)` }}>
        <ShikiArt name="deer" size={78 * k} fill={INK} rim="#bbf7d0" flip={a.x > s.W * 0.6} />
      </div>
    );
    return null;
  });
}

// ── On the ground (inside the low <svg>): water, the deer's ward, bound prey, the garden's floor ──
export function TsGround({ s, k, P, time }) {
  const kit = s.kit;
  const w = kit.ward;
  return (
    <g>
      {kit.domain && s.enemies.map(e => {
        const r = e.size * k * 0.5;
        return <ellipse key={`sink${e.id}`} cx={e.x} cy={e.y + r * 0.72} rx={r * 1.05} ry={r * 0.3} fill="#020108" opacity={0.78} />;
      })}
      {(kit.floods ?? []).map(f => {
        const o = clamp(Math.min(f.t / 0.3, (f.dur - f.t) / 0.8), 0, 1), zap = f.zap > 0, holy = f.holy;
        return (
          <g key={f.id} opacity={o}>
            <circle cx={f.x} cy={f.y} r={f.r} fill={zap ? 'rgba(253,224,71,0.24)' : holy ? 'rgba(254,249,195,0.16)' : 'rgba(37,99,235,0.2)'}
              stroke={zap ? '#fde047' : holy ? '#fef9c3' : '#93c5fd'} strokeWidth={(holy ? 3.5 : 2.5) * k} strokeOpacity={holy ? 0.85 : 0.65} />
            {[0, 1, 2].map(i => {
              const ph = (time * 0.55 + i / 3) % 1;
              return <circle key={i} cx={f.x} cy={f.y} r={f.r * ph} fill="none" stroke={zap ? '#fef08a' : holy ? '#fefce8' : '#bfdbfe'} strokeWidth={2 * k} opacity={0.4 * (1 - ph)} />;
            })}
            {/* HOLY WATER: light rising off it */}
            {holy && Array.from({ length: 9 }, (_, i) => {
              const ph = (time * 0.6 + i / 9) % 1, a = i * 2.4 + f.id, rr = f.r * (0.15 + 0.75 * ((i * 37) % 10) / 10);
              return <circle key={`m${i}`} cx={f.x + Math.cos(a) * rr} cy={f.y + Math.sin(a) * rr * 0.5 - ph * 46 * k} r={(2 + (i % 3)) * k} fill="#fefce8" opacity={(1 - ph) * 0.9} />;
            })}
          </g>
        );
      })}
      {w && P && (
        <g opacity={clamp(Math.min(w.t / 0.2, (w.dur - w.t) / 0.5), 0, 1)}>
          <circle cx={P.x} cy={P.y} r={w.r} fill="rgba(187,247,208,0.07)" stroke="#86efac" strokeWidth={9 * k} strokeOpacity={0.14} />
          <circle cx={P.x} cy={P.y} r={w.r} fill="none" stroke="#bbf7d0" strokeWidth={2.5 * k} strokeDasharray={`${10 * k} ${7 * k}`} strokeDashoffset={-time * 40} />
        </g>
      )}
      {s.enemies.map(e => {
        if (!(e.boundT > 0)) return null;
        const r = e.size * k * 0.5;
        return <ellipse key={`bound${e.id}`} cx={e.x} cy={e.y + r * 0.6} rx={r * 0.95} ry={r * 0.32} fill="none" stroke="#86efac" strokeWidth={3 * k} strokeDasharray={`${7 * k} ${4 * k}`} strokeDashoffset={time * 30} opacity={0.85} />;
      })}
    </g>
  );
}

// ── Above the enemies (inside the top <svg>) ──────────────────────────────
export function TsOver({ s, k, time }) {
  const kit = s.kit;
  return (
    <g>
      {kit.sign && <SignPool sign={kit.sign} time={s.time} k={k} />}
      {(kit.tongues ?? []).map(tg => <Tongue key={tg.id} tg={tg} k={k} />)}
      {(kit.serpents ?? []).map(sp => <Serpent key={sp.id} sp={sp} k={k} />)}
      {(kit.tigers ?? []).map(tg => <Tiger key={tg.id} tg={tg} k={k} time={time} />)}
      {(kit.oxen ?? []).map(ox => <Ox key={ox.id} ox={ox} k={k} />)}
      {(kit.drops ?? []).map(dp => <Elephant key={dp.id} dp={dp} k={k} H={s.H} />)}
      {(kit.dives ?? []).map(dv => <NueDive key={dv.id} dv={dv} k={k} />)}
    </g>
  );
}
// the hand sign forming: a pool of shadow under where you pressed
function SignPool({ sign, time, k }) {
  const g = Math.min(1, (time - sign.t0) / 0.22), r = (18 + 22 * g) * k;
  return (
    <g>
      <ellipse cx={sign.x} cy={sign.y} rx={r} ry={r * 0.42} fill="#05030f" opacity={0.75} />
      <ellipse cx={sign.x} cy={sign.y} rx={r} ry={r * 0.42} fill="none" stroke="#818cf8" strokeWidth={2 * k} opacity={0.6 + 0.4 * Math.sin(time * 18)} />
    </g>
  );
}
function Tongue({ tg, k }) {
  const p = Math.min(1, tg.t / tg.out);
  const ex = tg.hit ? tg.tx : tg.x + (tg.tx - tg.x) * p, ey = tg.hit ? tg.ty : tg.y + (tg.ty - tg.y) * p;
  const d = `M${tg.x},${tg.y} Q${(tg.x + ex) / 2},${(tg.y + ey) / 2 + 22 * k} ${ex},${ey}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#3f0a1f" strokeWidth={12 * k} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#f472b6" strokeWidth={7 * k} strokeLinecap="round" />
      <circle cx={ex} cy={ey} r={10 * k} fill="#f9a8d4" stroke="#3f0a1f" strokeWidth={2.5 * k} />
    </g>
  );
}
// The Great Serpent: rises out of a shadow pool next to its prey, lunges down on it, sinks back
function Serpent({ sp, k }) {
  const lev = !!sp.lev, S = (lev ? 340 : 250) * k, ease = q => 1 - (1 - q) ** 3;
  const rise = ease(Math.min(1, sp.t / 0.35)), strike = clamp((sp.t - 0.36) / 0.1, 0, 1), sink = clamp((sp.t - 0.8) / 0.6, 0, 1);
  const gx = sp.x - S * 0.26, gy = sp.y + S * 0.28;   // the pool: its head ends up right over the target
  const lunge = strike * (1 - sink) * S * 0.36, up = S * (0.8 * rise - sink * 0.9);
  const id = `serp${sp.id}`;
  return (
    <g>
      <defs><clipPath id={id}><rect x={gx - S} y={gy - S * 2} width={S * 2} height={S * 2} /></clipPath></defs>
      <ellipse cx={gx} cy={gy} rx={S * 0.42 * Math.min(1, sp.t * 6) * (1 - sink * 0.6)} ry={S * 0.13 * Math.min(1, sp.t * 6) * (1 - sink * 0.6)} fill={lev ? '#031427' : '#04030c'} stroke={lev ? '#38bdf8' : '#4f46e5'} strokeWidth={2.5 * k} opacity={0.95} />
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(${gx - S * 0.5} ${gy - up + lunge})`} style={{ filter: `drop-shadow(0 0 ${lev ? 14 : 10}px ${lev ? '#0284c7' : '#4338ca'})` }}>
          <path d={GAME_ICONS.serpent[2]} transform={`scale(${S / 512})`} fill={lev ? '#03101f' : INK} stroke={lev ? '#7dd3fc' : '#a5b4fc'} strokeWidth={14} strokeLinejoin="round" paintOrder="stroke" />
        </g>
      </g>
      {/* LEVIATHAN: the water sprays up around it */}
      {lev && rise > 0.3 && sink < 1 && [0, 1, 2, 3, 4].map(i => {
        const a = -Math.PI / 2 + (i - 2) * 0.42, d = S * (0.2 + 0.25 * rise) * (1 - sink), jy = Math.sin(sp.t * 14 + i) * 4 * k;
        return <circle key={i} cx={gx + Math.cos(a) * d * 1.4} cy={gy + Math.sin(a) * d * 0.5 + jy} r={(5 + (i % 2) * 3) * k} fill="#bae6fd" opacity={0.75 * (1 - sink)} />;
      })}
      {strike > 0 && strike < 1 && <circle cx={sp.x} cy={sp.y} r={(30 + 50 * strike) * k} fill="none" stroke="#e0e7ff" strokeWidth={5 * k * (1 - strike)} />}
    </g>
  );
}
// Max Elephant: its shadow spreads on the ground, it drops out of the sky, the water bursts out
function Elephant({ dp, k, H }) {
  const p = Math.min(1, dp.t / dp.fall), after = Math.max(0, dp.t - dp.fall);
  const S = Math.min(dp.r * 1.25, 290 * k), fade = Math.max(0, 1 - Math.max(0, after - 0.25) / 0.5);
  const squash = after > 0 ? 1 - 0.18 * Math.sin(Math.min(1, after / 0.18) * Math.PI) : 1;
  const y = dp.y - (1 - p * p) * (H * 0.9 + S) + S * 0.04 - S * 0.346 * squash, sink = after > 0.25 ? (after - 0.25) * S * 0.6 : 0;
  const wave = Math.min(1, after / 0.45);
  return (
    <g>
      {!dp.landed && (
        <g>
          <ellipse cx={dp.x} cy={dp.y} rx={dp.r * (0.25 + 0.75 * p)} ry={dp.r * 0.38 * (0.25 + 0.75 * p)} fill="rgba(4,3,12,0.5)" />
          <circle cx={dp.x} cy={dp.y} r={dp.r} fill="none" stroke="#60a5fa" strokeWidth={2.5 * k} strokeDasharray={`${12 * k} ${8 * k}`} opacity={0.5 + 0.5 * p} />
        </g>
      )}
      {after > 0 && (
        <g opacity={1 - wave}>
          <path d={GAME_ICONS.splash[2]} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth={14} paintOrder="stroke"
            transform={`translate(${dp.x} ${dp.y}) scale(${(S * (0.9 + 0.9 * wave)) / 512}) translate(-256 -440)`} style={{ filter: 'drop-shadow(0 0 10px #3b82f6)' }} />
        </g>
      )}
      <g opacity={fade} transform={`translate(${dp.x} ${y + sink})`} style={{ filter: 'drop-shadow(0 0 14px #1d4ed8)' }}>
        <path d={GAME_ICONS.elephant[2]} transform={`scale(${S / 512 * (2 - squash)} ${S / 512 * squash}) translate(-256 -256)`} fill="#060c1f" stroke="#93c5fd" strokeWidth={12} strokeLinejoin="round" paintOrder="stroke" />
      </g>
    </g>
  );
}
// Piercing Ox: a charging bull with a dust trail, tilted along its run
function Ox({ ox, k }) {
  const S = (ox.stampede ? 215 : 170) * k, ux = Math.cos(ox.a), uy = Math.sin(ox.a), left = ux < 0;
  const tilt = (left ? ox.a - Math.PI : ox.a) * 180 / Math.PI * 0.6;
  const rim = ox.wet ? '#7dd3fc' : '#fca5a5', glow = ox.wet ? '#0ea5e9' : '#b91c1c';
  return (
    <g>
      {[1, 2, 3, 4].map(i => (
        <ellipse key={i} cx={ox.x - ux * S * 0.32 * i} cy={ox.y + S * 0.32 - uy * S * 0.32 * i} rx={S * 0.15 * (1 + i * 0.25)} ry={S * 0.07 * (1 + i * 0.15)}
          fill={ox.wet ? '#7dd3fc' : '#78716c'} opacity={0.38 - i * 0.07} />
      ))}
      {[-1, 0, 1].map(i => (
        <line key={`l${i}`} x1={ox.x - ux * S * 0.55 + -uy * i * S * 0.18} y1={ox.y - uy * S * 0.55 + ux * i * S * 0.18}
          x2={ox.x - ux * S * 1.3 + -uy * i * S * 0.18} y2={ox.y - uy * S * 1.3 + ux * i * S * 0.18} stroke={rim} strokeWidth={3 * k} opacity={0.5} strokeLinecap="round" />
      ))}
      {/* STAMPEDE: Totality runs beside it */}
      {ox.stampede && <Sil name="dog" x={ox.x - uy * S * 0.74 * (left ? -1 : 1) - ux * S * 0.3} y={ox.y + ux * S * 0.74 * (left ? -1 : 1) - uy * S * 0.3 - S * 0.06} size={S * 0.58} fill="#05040f" rim="#f1f5f9" sw={18} flip={left} rot={tilt}
        filter="drop-shadow(0 0 10px #e0e7ff)" />}
      <Sil name="ox" x={ox.x} y={ox.y} size={S} fill={ox.wet ? '#06122b' : INK} rim={ox.stampede && !ox.wet ? '#f1f5f9' : rim} sw={14} flip={left} rot={tilt} filter={`drop-shadow(0 0 12px ${glow})`} />
    </g>
  );
}
// Nue's dive: it folds its wings and drops onto its prey
function NueDive({ dv, k }) {
  if (dv.hit) return null;
  const S = 84 * k, p = Math.min(1, dv.t / dv.dur), left = dv.tx < dv.x0;
  return (
    <g>
      <line x1={dv.x0} y1={dv.y0} x2={dv.x} y2={dv.y} stroke="#fde047" strokeWidth={4 * k * (0.4 + p)} strokeLinecap="round" opacity={0.55} style={{ filter: 'drop-shadow(0 0 6px #facc15)' }} />
      <Sil name="nue" x={dv.x} y={dv.y} size={S * (1 - 0.25 * p)} fill={INK} rim="#fde047" sw={20} flip={left} rot={(left ? -1 : 1) * 35 * p} sy={1 - 0.35 * p} filter="drop-shadow(0 0 10px #facc15)" />
    </g>
  );
}
// Tiger Funeral: the pounce, then a blur of claws on its prey
function Tiger({ tg, k, time }) {
  const S = 136 * k, o = tg.phase === 'gone' ? Math.max(0, 1 - tg.fade / 0.45) : 1;
  const jig = tg.phase === 'maul' ? Math.sin(time * 70) * 5 * k : 0;
  const y = tg.y - S * (tg.phase === 'maul' ? 0.32 : 0.22);
  return <Sil name="tiger" x={tg.x + jig} y={y} size={S} fill={INK} rim="#fdba74" sw={14} flip={tg.face < 0} opacity={o} filter="drop-shadow(0 0 10px #ea580c)" />;
}

// ── Effects ───────────────────────────────────────────────────────────────
export function TsEffect({ f, k }) {
  const p = Math.min(1, f.t / (f.life ?? 0.5));
  // a pool of shadow (where shikigami come from and go back to)
  if (f.kind === 'puddle') {
    const grow = Math.min(1, p * 3), fade = p < 0.6 ? 1 : (1 - p) / 0.4;
    return (
      <g opacity={fade}>
        <ellipse cx={f.x} cy={f.y} rx={f.r * grow} ry={f.r * 0.42 * grow} fill="#05030f" opacity={0.85} />
        <ellipse cx={f.x} cy={f.y} rx={f.r * grow} ry={f.r * 0.42 * grow} fill="none" stroke="#6366f1" strokeWidth={2.5 * k} opacity={0.8} />
      </g>
    );
  }
  // Rabbit Escape: a burst of shadow rabbits scattering
  if (f.kind === 'rabbits') return (
    <g opacity={p < 0.7 ? 1 : (1 - p) / 0.3}>
      <ellipse cx={f.x} cy={f.y + 8 * k} rx={34 * k * Math.min(1, p * 4)} ry={12 * k * Math.min(1, p * 4)} fill="#05030f" opacity={0.7 * (1 - p)} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = i * 0.449 + f.id * 0.7, d = (10 + 120 * (1 - (1 - p) ** 2)) * k * (0.6 + (i % 4) * 0.15);
        const hop = Math.abs(Math.sin(p * Math.PI * 3 + i)) * 14 * k, sz = (16 + (i % 3) * 5) * k;
        const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.6 - hop;
        return <path key={i} d={GAME_ICONS.rabbit[2]} fill={i % 3 ? '#f8fafc' : '#0b0a1f'} stroke={i % 3 ? '#1e1b4b' : '#e2e8f0'} strokeWidth={36} paintOrder="stroke"
          transform={`translate(${x - sz / 2} ${y - sz / 2}) scale(${sz / 512})${Math.cos(a) < 0 ? ' translate(512 0) scale(-1 1)' : ''}`} />;
      })}
    </g>
  );
  // Nue's lightning: a jagged bolt from the bird down to the target (its dive: a big one from the sky)
  if (f.kind === 'bolt') {
    const b = f.big ? 2 : 1;
    const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => {
      const j = i === 0 || i === 5 ? 0 : (((f.id * 13 + i * 7) % 11) - 5) * 3.2 * k * b;
      return `${f.x0 + (f.x - f.x0) * t + j},${f.y0 + (f.y - f.y0) * t}`;
    }).join(' ');
    return (
      <g opacity={1 - p} style={{ filter: 'drop-shadow(0 0 8px #facc15)' }}>
        <polyline points={pts} fill="none" stroke="#fde047" strokeWidth={6 * k * b} strokeLinejoin="bevel" />
        <polyline points={pts} fill="none" stroke="#fffbeb" strokeWidth={2 * k * b} strokeLinejoin="bevel" />
        <circle cx={f.x} cy={f.y} r={(14 + 18 * p) * k * b} fill="none" stroke="#fde047" strokeWidth={3 * k} />
      </g>
    );
  }
  // a wisp of shadow flying from a shikigami's kill back to your cursor (the meter)
  if (f.kind === 'wisp') {
    const at = q => { const e = 1 - (1 - q) ** 2; return [f.x + (f.x1 - f.x) * e, f.y + (f.y1 - f.y) * e - Math.sin(q * Math.PI) * 50 * k]; };
    const [x, y] = at(p);
    return (
      <g opacity={p < 0.85 ? 1 : (1 - p) / 0.15}>
        {[0.16, 0.1, 0.05].map((d, i) => { const [tx, ty] = at(Math.max(0, p - d)); return <circle key={i} cx={tx} cy={ty} r={(3 + i * 1.3) * k} fill="#6366f1" opacity={0.25 + i * 0.15} />; })}
        <circle cx={x} cy={y} r={6.5 * k} fill="#a5b4fc" opacity={0.55} />
        <circle cx={x} cy={y} r={3.2 * k} fill="#eef2ff" />
      </g>
    );
  }
  // Round Deer takes the blow that would have killed you: it leaps over you in a ring of light
  if (f.kind === 'saved') {
    const S = 120 * k, q = 1 - (1 - Math.min(1, p * 1.6)) ** 2;
    return (
      <g opacity={p < 0.6 ? 1 : (1 - p) / 0.4}>
        <circle cx={f.x} cy={f.y} r={(40 + 160 * q) * k} fill="none" stroke="#bbf7d0" strokeWidth={6 * k * (1 - p)} style={{ filter: 'drop-shadow(0 0 10px #4ade80)' }} />
        <circle cx={f.x} cy={f.y} r={(20 + 90 * q) * k} fill="rgba(187,247,208,0.18)" />
        <Sil name="deer" x={f.x - S * 0.7 + S * 1.4 * q} y={f.y - S * 0.35 - Math.sin(q * Math.PI) * S * 0.6} size={S} fill={INK} rim="#bbf7d0" sw={18} filter="drop-shadow(0 0 12px #4ade80)" />
      </g>
    );
  }
  // Chimera Shadow Garden: a shadow hand reaches up out of the floor and grabs
  if (f.kind === 'hand') {
    const rise = Math.min(1, p * 3.5), S = Math.max(48 * k, f.r * 1.5);
    return (
      <g opacity={p < 0.6 ? 1 : (1 - p) / 0.4}>
        <ellipse cx={f.x} cy={f.y} rx={S * 0.42} ry={S * 0.12} fill="#020108" opacity={0.85} />
        <Sil name="grasp" x={f.x} y={f.y - S * 0.42 * rise} size={S * (0.6 + 0.4 * rise)} fill={INK} rim="#818cf8" sw={20} sy={rise} />
      </g>
    );
  }
  // Tiger Funeral: three claw marks raked across its prey
  if (f.kind === 'claws') {
    const R = f.r * 1.25, draw = Math.min(1, p * 4);
    return (
      <g opacity={1 - p} transform={`translate(${f.x} ${f.y}) rotate(${(f.a ?? 0) * 57.3})`} style={{ filter: 'drop-shadow(0 0 6px #f97316)' }}>
        {[-1, 0, 1].map(i => (
          <path key={i} d={`M${-R},${i * R * 0.34 - R * 0.3} Q0,${i * R * 0.34 + R * 0.12} ${R},${i * R * 0.34 + R * 0.38}`} pathLength={1}
            fill="none" stroke="#fff7ed" strokeWidth={6 * k * (1 - p * 0.6)} strokeLinecap="round" strokeDasharray={`${draw} 1`} />
        ))}
      </g>
    );
  }
  return null;
}

// Mahoraga's WORLD-CUTTING SLASH (drawn above everything, the tint included)
export function WorldCuts({ effects, k }) {
  const cuts = effects.filter(f => f.kind === 'worldcut');
  if (!cuts.length) return null;
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 13, pointerEvents: 'none', overflow: 'visible' }}>
      {cuts.map(f => {
        const p = Math.min(1, f.t / f.life), grow = Math.min(1, p * 7);
        const mx = (f.x1 + f.x2) / 2, my = (f.y1 + f.y2) / 2;
        const x1 = mx + (f.x1 - mx) * grow, y1 = my + (f.y1 - my) * grow, x2 = mx + (f.x2 - mx) * grow, y2 = my + (f.y2 - my) * grow;
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1, nx = -(f.y2 - f.y1) / L, ny = (f.x2 - f.x1) / L, sep = 14 * k * p;
        return (
          <g key={f.id} opacity={p < 0.55 ? 1 : (1 - p) / 0.45}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={26 * k * (1 - p * 0.6)} opacity={0.55} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth={12 * k * (1 - p * 0.5)} style={{ filter: 'drop-shadow(0 0 14px #ef4444)' }} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={4 * k} />
            {[1, -1].map(sd => <line key={sd} x1={x1 + nx * sep * sd} y1={y1 + ny * sep * sd} x2={x2 + nx * sep * sd} y2={y2 + ny * sep * sd} stroke="#fecaca" strokeWidth={1.5 * k} opacity={0.8} />)}
          </g>
        );
      })}
    </svg>
  );
}

// ── The shadow meter by your cursor (mouse only) ─────────────────────────
export function ShadowGauge({ s, sk, P }) {
  const n = Math.round(sk.maxBars), filled = (s.kit.shadow ?? 0) / sk.barCost;
  const r = 25, gap = 0.26, seg = (Math.PI * 2) / n;
  const ready = !s.kit.domain && (s.kit.garden?.length ?? 0) >= Math.round(sk.gardenNeed);
  const full = filled >= n;
  return (
    <g className={full ? 'gauge-full' : undefined} style={full ? { transformOrigin: `${P.x}px ${P.y}px` } : undefined}>
      {Array.from({ length: n }, (_, i) => {
        const a0 = -Math.PI / 2 + i * seg + gap / 2, a1 = a0 + seg - gap, fill = clamp(filled - i, 0, 1);
        return (
          <g key={i}>
            <path d={arcPath(P.x, P.y, r, a0, a1)} stroke="rgba(79,70,229,0.35)" strokeWidth={3.5} fill="none" strokeLinecap="round" />
            {fill > 0 && <path d={arcPath(P.x, P.y, r, a0, a0 + (a1 - a0) * fill)} stroke={fill >= 1 ? '#c7d2fe' : '#818cf8'} strokeWidth={3.5} fill="none" strokeLinecap="round"
              style={fill >= 1 ? { filter: 'drop-shadow(0 0 4px #818cf8)' } : undefined} />}
          </g>
        );
      })}
      {ready && <path d={`M${P.x},${P.y - r - 12} l5,6 l-5,6 l-5,-6 Z`} fill="#e0e7ff" style={{ filter: 'drop-shadow(0 0 5px #a5b4fc)' }} />}
      {s.kit.domain && <circle cx={P.x} cy={P.y} r={r + 6} fill="none" stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.7} />}
    </g>
  );
}

// ── The hand-sign wheel (M2 held): the eight shadows around where you pressed ──
export function HandSignWheel({ s, sk, W, H, mobile }) {
  const sign = s.kit.sign;
  if (!sign?.open || !sk) return null;
  const R = clamp(Math.min(W, H) * 0.25, 74, 118), outer = R * 1.46, inner = R * 0.56;
  const cx = clamp(sign.x, outer + 6, W - outer - 6), cy = clamp(sign.y, outer + 6, H - outer - 22);
  const dom = !!s.kit.domain;
  const bars = Math.min(Math.round(sk.maxBars), Math.floor((s.kit.shadow ?? 0) / sk.barCost));
  const garden = s.kit.garden ?? [], need = Math.round(sk.gardenNeed), ready = !dom && garden.length >= need;
  const sel = sign.sel;
  let dx, dy;
  if (sign.aim) { dx = sign.aim.dx; dy = sign.aim.dy; } else { const P = s.player.pos ?? sign; dx = P.x - sign.x; dy = P.y - sign.y; }
  const dl = Math.hypot(dx, dy);
  const iconS = R * 0.48, fs = Math.max(9, R * 0.105);
  const pick = sel >= 0 ? SHADOWS[sel] : null, pickCost = pick ? costFor(pick.id, dom) : 0;
  const centre = pick
    ? [pick.name.split(' ')[0], pick.name.split(' ').slice(1).join(' '), bars >= pickCost ? 'LET GO' : `NEEDS ${pickCost}`]
    : ready ? ['DOMAIN', 'EXPANSION', 'LET GO HERE'] : ['', 'CANCEL', ''];
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', overflow: 'visible' }}>
      <rect x={0} y={0} width={W} height={H} fill="rgba(3,2,12,0.42)" className="sign-dim" />
      <g className="sign-wheel" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={outer + 6} fill="none" stroke="#312e81" strokeWidth={10} opacity={0.6} />
      <circle cx={cx} cy={cy} r={outer} fill="rgba(7,6,26,0.88)" stroke="#6366f1" strokeWidth={2} />
      {SHADOWS.map((sh, i) => {
        const a = -Math.PI / 2 + i * Math.PI / 4, c = costFor(sh.id, dom), ok = bars >= c, on = i === sel;
        const ix = cx + Math.cos(a) * R, iy = cy + Math.sin(a) * R - fs * 0.45;
        const used = !dom && garden.includes(sh.id);
        return (
          <g key={sh.id}>
            {on && <path d={wedgePath(cx, cy, inner, outer, a - Math.PI / 8, a + Math.PI / 8)} fill={ok ? 'rgba(129,140,248,0.38)' : 'rgba(239,68,68,0.22)'} stroke={ok ? '#c7d2fe' : '#f87171'} strokeWidth={2} />}
            <line x1={cx + Math.cos(a + Math.PI / 8) * inner} y1={cy + Math.sin(a + Math.PI / 8) * inner} x2={cx + Math.cos(a + Math.PI / 8) * outer} y2={cy + Math.sin(a + Math.PI / 8) * outer} stroke="rgba(99,102,241,0.35)" strokeWidth={1.5} />
            {ICON_ART[sh.id]
              ? <image href={ICON_ART[sh.id]} x={ix - iconS * (on ? 0.66 : 0.55)} y={iy - iconS * (on ? 0.6 : 0.5)} width={iconS * (on ? 1.32 : 1.1)} height={iconS * (on ? 1.2 : 1)} preserveAspectRatio="xMidYMid meet"
                  opacity={ok ? 1 : 0.55} style={{ filter: !ok ? 'grayscale(1) brightness(0.55)' : on ? 'drop-shadow(0 0 8px #818cf8)' : undefined }} />
              : <Sil name={sh.icon} x={ix} y={iy} size={iconS * (on ? 1.2 : 1)} fill={!ok ? '#1a1830' : INK} rim={!ok ? '#4b5563' : on ? '#ffffff' : '#a5b4fc'} sw={20}
                  opacity={ok ? 1 : 0.6} filter={on && ok ? 'drop-shadow(0 0 8px #818cf8)' : undefined} />}
            <text x={ix} y={iy + iconS * 0.62 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={800} fill={!ok ? '#6b7280' : on ? '#ffffff' : '#c7d2fe'}
              style={{ letterSpacing: 0.5, paintOrder: 'stroke', stroke: '#05040f', strokeWidth: 3 }}>{sh.short}</text>
            {Array.from({ length: c }, (_, j) => (
              <rect key={j} x={ix - (c * fs * 0.62) / 2 + j * fs * 0.62} y={iy + iconS * 0.62 + fs * 0.62} width={fs * 0.46} height={fs * 0.32} rx={1}
                fill={j < bars ? '#a5b4fc' : '#374151'} />
            ))}
            {used && <circle cx={ix + iconS * 0.48} cy={iy - iconS * 0.42} r={fs * 0.28} fill="#a5b4fc" />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={inner} fill="#05040f" stroke={ready && sel < 0 ? '#e0e7ff' : '#4f46e5'} strokeWidth={ready && sel < 0 ? 3 : 2}
        style={ready && sel < 0 ? { filter: 'drop-shadow(0 0 10px #a5b4fc)' } : undefined} />
      {dl > 4 && sel >= 0 && <line x1={cx} y1={cy} x2={cx + dx / dl * inner * 0.92} y2={cy + dy / dl * inner * 0.92} stroke="#c7d2fe" strokeWidth={3} strokeLinecap="round" opacity={0.85} />}
      {centre.map((t, i) => t && (
        <text key={i} x={cx} y={cy + (i - 1) * fs * 1.25 + fs * 0.35} textAnchor="middle" fontSize={i === 2 ? fs * 0.82 : fs * 1.1} fontWeight={900}
          fill={i === 2 ? (pick && bars < pickCost ? '#f87171' : '#818cf8') : ready && !pick ? '#e0e7ff' : '#c7d2fe'} style={{ letterSpacing: 1 }}>{t}</text>
      ))}
      {!dom && (() => {
        // the garden: the shadows called toward it (once it's ready, the slots for a PERFECT one)
        const slots = garden.length >= need ? SHADOWS.length : need, step = fs * (slots > need ? 0.7 : 0.9), d = fs * (slots > need ? 0.24 : 0.3);
        return (
          <g>
            {Array.from({ length: slots }, (_, i) => {
              const extra = i >= need;
              return <path key={i} d={`M${cx + (i - (slots - 1) / 2) * step},${cy + inner * 0.62} l${d},${d} l${-d},${d} l${-d},${-d} Z`}
                fill={i < garden.length ? (extra ? '#fde68a' : '#a5b4fc') : 'none'} stroke={extra ? '#d97706' : '#6366f1'} strokeWidth={1.2} />;
            })}
          </g>
        );
      })()}
      <text x={cx} y={cy + outer + fs + 6} textAnchor="middle" fontSize={fs * 0.85} fontWeight={800} fill="#818cf8" style={{ letterSpacing: 2, paintOrder: 'stroke', stroke: '#05040f', strokeWidth: 3 }}>
        COMBOS FOUND {combosKnown()}/{COMBOS.length}
      </text>
      <text x={cx} y={cy - outer - 12} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#a5b4fc" style={{ letterSpacing: 2, paintOrder: 'stroke', stroke: '#05040f', strokeWidth: 3 }}>
        {dom ? 'SHADOW GARDEN · EVERYTHING COSTS A BAR LESS' : mobile ? 'HAND SIGN · SLIDE, THEN LET GO' : 'HAND SIGN · FLICK, THEN LET GO'}
      </text>
      </g>
    </svg>
  );
}

// ── Chimera Shadow Garden: the floor turns to shadow, things move under it ──
const LURKERS = [
  { icon: 'serpent', x0: 0.1, y: 0.8, v: 0.035, s: 230 },
  { icon: 'elephant', x0: 0.75, y: 0.9, v: -0.022, s: 270 },
  { icon: 'dog', x0: 0.42, y: 0.7, v: 0.055, s: 120 },
  { icon: 'tiger', x0: 0.95, y: 0.76, v: -0.045, s: 160 },
  { icon: 'ox', x0: 0.25, y: 0.94, v: 0.03, s: 200 },
];
const EYES = Array.from({ length: 9 }, (_, i) => ({ x: ((i * 37) % 100) / 100, y: 0.62 + ((i * 53) % 34) / 100, ph: i * 1.7 }));
export function ChimeraGarden({ dom, W, H, k, time }) {
  const perfect = !!dom.perfect;
  const open = Math.min(1, dom.t / 0.9), ending = clamp((dom.dur - dom.t) / 0.6, 0, 1);
  const R = Math.hypot(W, H) * (0.05 + 1.1 * (1 - (1 - open) ** 3));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', opacity: ending, clipPath: open < 1 ? `circle(${R}px at ${dom.x}px ${dom.y}px)` : undefined, overflow: 'hidden' }}>
      <div className={`garden-floor${perfect ? ' perfect' : ''}`} />
      <div className="garden-ripples" />
      {/* shikigami gliding under the surface: each its own layer, only its position changes */}
      {LURKERS.map((L, i) => {
        const S = L.s * k, x = (((L.x0 + time * L.v) % 1.4 + 1.4) % 1.4 - 0.2) * W - S / 2, y = H * L.y + Math.sin(time * 0.8 + i) * 10 * k - S / 2;
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: 0, width: S, height: S, opacity: 0.6, transform: `translate3d(${x}px, ${y}px, 0)`, willChange: 'transform' }}>
            <ShikiArt name={L.icon} size={S} fill="#000" rim="#312e81" sw={10} flip={L.v < 0} />
          </div>
        );
      })}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {EYES.map((e, i) => {
          const o = Math.sin(time * 1.3 + e.ph) > 0.55 ? 1 : 0.1;
          return (
            <g key={i} opacity={o}>
              <ellipse cx={e.x * W - 6 * k} cy={e.y * H} rx={5 * k} ry={3 * k} fill="#6366f1" opacity={0.45} />
              <ellipse cx={e.x * W + 6 * k} cy={e.y * H} rx={5 * k} ry={3 * k} fill="#6366f1" opacity={0.45} />
              <ellipse cx={e.x * W - 6 * k} cy={e.y * H} rx={3.2 * k} ry={1.6 * k} fill="#e0e7ff" />
              <ellipse cx={e.x * W + 6 * k} cy={e.y * H} rx={3.2 * k} ry={1.6 * k} fill="#e0e7ff" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Anime cut-ins: Mahoraga's summon / berserk (art), the garden (the shadows in a row) ──
export function CutIn({ c }) {
  const t = c.t, kind = c.kind, berserk = kind === 'berserk';
  const inP = Math.min(1, t / 0.18), outP = Math.max(0, (t - (c.life - 0.3)) / 0.3);
  const ease = 1 - (1 - inP) ** 3, slide = (berserk ? 1 : -1) * ((1 - ease) * 120 + outP * -130);
  const shake = berserk && t < 0.5 ? Math.sin(t * 90) * 6 * (0.5 - t) : 0;
  const textO = Math.min(1, Math.max(0, (t - 0.15) / 0.15)) * (1 - outP);
  if (kind === 'domain') return (
    <div className={`cutin domain${c.perfect ? ' perfect' : ''}`} style={{ opacity: 1 - outP * 0.6 }}>
      <div className="cutin-bg" style={{ opacity: Math.min(1, t / 0.08) * (1 - outP) }} />
      <div className="cutin-lines" style={{ opacity: 1 - outP }} />
      <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', left: 0, right: 0, top: '14%', width: '100%', height: '52%', overflow: 'visible' }}>
        <rect x={-400} y={232} width={1600} height={80} fill="#020108" />
        <line x1={-400} y1={232} x2={1200} y2={232} stroke="#6366f1" strokeWidth={3} />
        {SHADOWS.map((sh, i) => {
          const rise = clamp((t - 0.1 - i * 0.06) / 0.35, 0, 1), q = 1 - (1 - rise) ** 3;
          const S = sh.id === 'elephant' || sh.id === 'serpent' ? 150 : 112;
          return <Sil key={sh.id} name={sh.icon} x={60 + i * 97} y={232 - S * 0.48 * q + (1 - q) * 40} size={S} fill={sh.id === 'dogs' ? '#f8fafc' : '#000'} rim={c.perfect ? '#fde68a' : '#a5b4fc'} sw={14}
            opacity={q} filter={c.perfect ? 'drop-shadow(0 0 8px #d97706)' : 'drop-shadow(0 0 8px #4f46e5)'} />;
        })}
      </svg>
      <div className="cutin-text" style={{ opacity: textO }}>
        <div className="small">{c.perfect ? 'DOMAIN EXPANSION · ALL EIGHT · PERFECT' : 'DOMAIN EXPANSION'}</div>
        <div className="big">CHIMERA SHADOW GARDEN</div>
      </div>
    </div>
  );
  return (
    <div className={`cutin ${kind}`} style={{ opacity: 1 - outP * 0.6 }}>
      <div className="cutin-bg" style={{ opacity: Math.min(1, t / 0.08) * (1 - outP) }} />
      <div className="cutin-lines" style={{ opacity: 1 - outP }} />
      <div className="cutin-panel" style={{ transform: `translate(${slide}%, ${shake}px) skewX(-10deg)` }}>
        <img src={berserk ? CUTIN_BERSERK : CUTIN_SUMMON} alt="" draggable={false} style={{ transform: `skewX(10deg) scale(${1.18 + 0.07 * t})` }} />
      </div>
      <div className="cutin-text" style={{ opacity: textO }}>
        <div className="small">{berserk ? 'THE WHEEL HAS TURNED' : 'EIGHT-HANDLED SWORD · DIVERGENT SILA · DIVINE GENERAL'}</div>
        <div className="big">{berserk ? 'MAHORAGA HAS ADAPTED' : 'MAHORAGA'}</div>
      </div>
    </div>
  );
}

// ── Mahoraga in the field ─────────────────────────────────────────────────
// Its dharma wheel: eight spokes, a click and a flash every time it turns
function DharmaWheel({ size, turns, color, flash }) {
  return (
    <svg viewBox="-56 -56 112 112" width={size} height={size}
      style={{ display: 'block', overflow: 'visible', transform: `rotate(${turns * 45}deg)`, transition: 'transform 0.35s cubic-bezier(.3,1.6,.5,1)', filter: `drop-shadow(0 0 ${flash ? 14 : 5}px ${color})` }}>
      <circle r="38" fill="none" stroke={color} strokeWidth="6" />
      <circle r="10" fill={color} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4, c = Math.cos(a), sn = Math.sin(a);
        return (
          <g key={i}>
            <line x1={c * 10} y1={sn * 10} x2={c * 38} y2={sn * 38} stroke={color} strokeWidth="5" />
            <circle cx={c * 47} cy={sn * 47} r="6" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
export function MahoragaLayer({ s, k }) {
  const m = s.mahoraga;
  if (!m) return null;
  const w = (m.berserk ? 178 : 150) * k;
  const tint = m.berserk ? 'grayscale(1) brightness(0.62)' : 'grayscale(1) brightness(0.7)';
  const lift = m.lift ?? 0, rise = lift * 110 * k, scale = 1 + lift * 0.4;
  const f = m.finale, color = m.berserk ? '#f87171' : '#fde047';
  const L = Math.hypot(s.W, s.H) * 1.2;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none', backdropFilter: tint, WebkitBackdropFilter: tint }} />
      {m.berserk && <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, rgba(127,29,29,0.22), rgba(127,29,29,0.48))' }} />}
      {(m.berserk || (f && !f.cut)) && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 13, pointerEvents: 'none', overflow: 'visible' }}>
          {s.shots.filter(sh => sh.maho).map(sh => {
            const t = s.enemies.find(e => e.id === sh.target), a = t ? Math.atan2(t.y - sh.y, t.x - sh.x) : 0, len = 26 * k;
            return <line key={sh.id} x1={sh.x - Math.cos(a) * len} y1={sh.y - Math.sin(a) * len} x2={sh.x} y2={sh.y} stroke="#fef08a" strokeWidth={3.5 * k} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px #ef4444)' }} />;
          })}
          {/* the world-cutting slash is coming: where it will go */}
          {f && !f.cut && (
            <line x1={m.x - Math.cos(f.a) * L} y1={m.y - Math.sin(f.a) * L} x2={m.x + Math.cos(f.a) * L} y2={m.y + Math.sin(f.a) * L}
              stroke="#ffffff" strokeWidth={(2 + f.t * 7) * k} strokeDasharray={`${18 * k} ${10 * k}`} opacity={0.72 + 0.28 * Math.sin(f.t * 40)}
              style={{ filter: 'drop-shadow(0 0 6px #ef4444)' }} />
          )}
        </svg>
      )}
      <div className={`suspended-text${m.berserk ? ' berserk' : ''}`}>
        {f ? 'WORLD-CUTTING SLASH' : `${m.berserk ? 'MAHORAGA HAS ADAPTED' : m.general ? 'GENERAL OF THE GARDEN' : 'COMMAND MAHORAGA'} · click an enemy · ${Math.max(0, Math.ceil(m.timeout - m.t))}s`}
      </div>
      {/* its shadow stays on the ground when it leaps */}
      <div style={{ position: 'absolute', left: m.x - w * 0.36 * (1 - lift * 0.35), top: m.y + w * 0.42 - w * 0.07, width: w * 0.72 * (1 - lift * 0.35), height: w * 0.14,
        borderRadius: '50%', background: 'rgba(0,0,0,0.55)', zIndex: 13, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: m.x - w / 2, top: Math.max(w * 0.25, m.y - w * 0.3 - rise), width: w, zIndex: 13, pointerEvents: 'none', transform: `scale(${scale})`, transformOrigin: '50% 60%' }}>
        <img src={m.berserk ? MAHORAGA_BERSERK_IMG : MAHORAGA_IMG} alt="Mahoraga" draggable={false} className={m.berserk ? 'maho-berserk' : undefined}
          style={{ width: '100%', display: 'block', filter: m.invuln > 0.15 && !f ? 'brightness(1.8)' : f ? `drop-shadow(0 0 ${10 + f.t * 30}px #fecaca)` : m.berserk ? 'drop-shadow(0 0 16px #dc2626) drop-shadow(0 0 4px #3b82f6)' : 'drop-shadow(0 0 12px #fde047)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 * k, width: '86%', margin: `${3 * k}px auto 0` }}>
          <DharmaWheel size={24 * k} turns={m.wheel} color={color} flash={m.turnFx > 0 || !!f} />
          <div style={{ flex: 1, height: 7 * k, background: 'rgba(0,0,0,0.7)', borderRadius: 4, border: `1px solid ${color}` }}>
            <div style={{ width: `${Math.max(0, m.hp / m.maxHp) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
        {m.berserk && m.flashT > 0 && (
          <svg viewBox="-20 -20 40 40" style={{ position: 'absolute', width: 54 * k, height: 54 * k, top: '44%', [m.flashSide > 0 ? 'right' : 'left']: '-22%', overflow: 'visible' }}>
            <polygon points="0,-18 5,-5 18,0 5,5 0,18 -5,5 -18,0 -5,-5" fill="#fef08a" style={{ filter: 'drop-shadow(0 0 8px #f97316) drop-shadow(0 0 3px #fff)' }} />
            <circle r="5" fill="#fff" />
          </svg>
        )}
      </div>
    </>
  );
}

// ── A combo found for the first time ─────────────────────────────────────
export function ComboToast({ f }) {
  const t = f.t, inP = Math.min(1, t / 0.22), out = clamp((t - 2.5) / 0.5, 0, 1);
  const many = f.icons.length > 3, size = many ? 22 : 36;
  return (
    <div className="combo-toast" style={{ opacity: inP * (1 - out), transform: `translateX(-50%) translateY(${(1 - inP) * -18}px) scale(${0.92 + 0.08 * inP})` }}>
      <div className="ct-icons" style={many ? { flexWrap: 'wrap', width: size * 4 + 6, gap: 2 } : undefined}>
        {f.icons.map((ic, i) => ic === 'wheel'
          ? <DharmaWheel key={i} size={size} turns={Math.floor(t * 3)} color="#fde047" flash={false} />
          : ICON_ART[ic] ? <span key={i} style={{ width: size, display: 'flex', alignItems: 'center' }}>{art(ic === 'dog' && (i > 0 || many) ? SHIKI_IMG.dogBlack : ICON_ART[ic], size)}</span>
            : <ShikiArt key={i} name={ic} size={size} fill={INK} rim={ic === 'grasp' ? '#818cf8' : '#c7d2fe'} sw={26} />)}
      </div>
      <div>
        <div className="ct-small">NEW COMBO · {f.n}/{f.of}</div>
        <div className="ct-big">{f.name}</div>
      </div>
    </div>
  );
}

// ── The status chips ──────────────────────────────────────────────────────
export function TsChips({ s, sk, mobile }) {
  const dom = s.kit.domain;
  const bars = Math.min(Math.round(sk.maxBars), Math.floor((s.kit.shadow ?? 0) / sk.barCost)), max = Math.round(sk.maxBars);
  const part = ((s.kit.shadow ?? 0) % sk.barCost) / sk.barCost;
  const tap = tapFor(bars, !!dom);
  const dogsOut = s.allies.some(a => a.kind === 'dog');
  const tapName = !tap ? 'hit to fill' : tap === 'dogs' && dogsOut ? (s.allies.some(a => a.totality) ? 'TOTALITY HOWL' : 'TOTALITY') : SHADOW_BY_ID[tap].short;
  const garden = s.kit.garden?.length ?? 0, need = Math.round(sk.gardenNeed);
  return (
    <>
      <div className="ts-chip">
        <span>SHADOWS</span>
        {Array.from({ length: max }, (_, i) => <i key={i} className={i < bars ? 'on' : ''} style={i === bars ? { background: `linear-gradient(90deg, #6366f1 ${part * 100}%, transparent ${part * 100}%)` } : undefined} />)}
        <b>{tap ? (mobile ? tapName : `tap: ${tapName}`) : tapName}</b>
        <span className="hint">· hold: wheel</span>
      </div>
      {dom ? <div className={`ts-chip garden on${dom.perfect ? ' perfect' : ''}`}>{dom.perfect ? 'PERFECT GARDEN' : 'CHIMERA SHADOW GARDEN'} · {s.mahoraga?.general ? 'HELD' : `${Math.max(0, Math.ceil(dom.dur - dom.t))}s`}</div>
        : garden >= need ? <div className="ts-chip garden ready">{mobile ? 'GARDEN READY · hold SPEC, let go without sliding' : 'GARDEN READY · hold M2, let go in the middle'}</div>
          : garden > 0 ? (
            <div className="ts-chip garden">
              <span>GARDEN</span>
              {Array.from({ length: need }, (_, i) => <i key={i} className={`d${i < garden ? ' on' : ''}`} />)}
            </div>
          ) : null}
    </>
  );
}

export const TS_CSS = `
  .ts-chip { display:flex; align-items:center; gap:4px; background:rgba(4,3,12,0.75); border:1px solid #6366f1; border-radius:12px; padding:2px 10px;
    font-size:12px; font-weight:800; color:#c7d2fe; letter-spacing:1px; white-space:nowrap; }
  @media (max-width: 520px) { .ts-chip { font-size:10.5px; letter-spacing:0.5px; padding:2px 7px; } .ts-chip i { width:10px; } }
  .ts-chip i { display:inline-block; width:14px; height:8px; border:1px solid #818cf8; border-radius:2px; transform:skewX(-15deg); }
  .ts-chip i.on { background:#a5b4fc; box-shadow:0 0 6px #818cf8; }
  .ts-chip i.d { width:8px; height:8px; transform:rotate(45deg); border-radius:1px; }
  .ts-chip b { margin-left:4px; color:#e0e7ff; }
  .ts-chip .hint { color:#818cf8; font-weight:700; letter-spacing:0.5px; }
  .sign-wheel { animation: signOpen 0.16s cubic-bezier(.2,1.4,.5,1); }
  .sign-dim { animation: signDim 0.16s ease-out; }
  @keyframes signOpen { from { transform: scale(0.55) rotate(-25deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
  @keyframes signDim { from { opacity: 0; } to { opacity: 1; } }
  .gauge-full { animation: gaugeFull 0.8s ease-in-out infinite alternate; }
  @keyframes gaugeFull { from { transform: scale(1); } to { transform: scale(1.12); } }
  .ts-chip.garden.ready { border-color:#e0e7ff; color:#e0e7ff; box-shadow:0 0 12px rgba(165,180,252,0.6); animation: blinkSlow 1.2s ease-in-out infinite; }
  .ts-chip.garden.on { border-color:#a5b4fc; background:rgba(30,27,75,0.85); color:#fff; }
  .ts-chip.garden.on.perfect { border-color:#fde68a; color:#fef3c7; box-shadow:0 0 10px rgba(253,230,138,0.45); }
  .combo-toast { position:absolute; left:50%; top:78px; z-index:17; pointer-events:none; display:flex; align-items:center; gap:12px; max-width:92%;
    background:linear-gradient(100deg, rgba(7,6,26,0.95), rgba(30,27,75,0.95)); border:1px solid #a5b4fc; border-radius:10px; padding:7px 16px 7px 12px;
    box-shadow:0 0 22px rgba(129,140,248,0.55), 0 0 0 2px #05040f; overflow:hidden; font-family: var(--font-dramatic); }
  .combo-toast::after { content:''; position:absolute; top:0; bottom:0; width:40%; left:-50%; background:linear-gradient(100deg, transparent, rgba(224,231,255,0.35), transparent);
    animation: toastShine 1.1s ease-out 0.15s 1 forwards; }
  @keyframes toastShine { to { left:120%; } }
  .ct-icons { display:flex; align-items:center; gap:4px; flex-shrink:0; filter: drop-shadow(0 0 6px #6366f1); }
  .ct-small { font-size:10.5px; letter-spacing:3px; color:#a5b4fc; font-weight:800; white-space:nowrap; }
  .ct-big { font-size:clamp(15px, 4.2vw, 22px); letter-spacing:2px; color:#eef2ff; font-weight:900; line-height:1.1; text-shadow:0 0 12px #6366f1, 2px 2px 0 #000; white-space:nowrap; }
  .garden-floor.perfect::before { background: linear-gradient(90deg, transparent, #d97706, #fef3c7, #d97706, transparent); }
  .cutin.domain.perfect .cutin-text .small { color:#fde68a; }
  .cutin.domain.perfect .cutin-text .big { text-shadow: 0 0 26px #d97706, 0 0 10px #6366f1, 3px 3px 0 #000, -2px -2px 0 #000; }
  .maho-berserk { animation: mahoRage 0.35s ease-in-out infinite alternate; border-radius: 50%; }
  @keyframes mahoRage { from { transform: scale(0.97) rotate(-1.5deg); } to { transform: scale(1.04) rotate(1.5deg); } }
  .suspended-text.berserk { color: #fecaca; text-shadow: 0 0 12px #dc2626; }
  .cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .cutin-bg { position:absolute; inset:0; }
  .cutin.summon .cutin-bg { background: radial-gradient(ellipse at 50% 45%, rgba(253,224,71,0.35), rgba(10,8,0,0.88) 70%); }
  .cutin.berserk .cutin-bg { background: radial-gradient(ellipse at 50% 45%, rgba(220,38,38,0.55), rgba(10,0,0,0.92) 70%); }
  .cutin.domain .cutin-bg { background: radial-gradient(ellipse at 50% 60%, rgba(67,56,202,0.45), rgba(2,1,8,0.95) 72%); }
  .cutin-lines { position:absolute; inset:-20%; mix-blend-mode:screen; animation: cutinLines 0.25s linear infinite;
    background: repeating-linear-gradient(100deg, transparent 0 22px, rgba(255,255,255,0.10) 23px 25px, transparent 26px 70px); }
  .cutin.berserk .cutin-lines { background: repeating-linear-gradient(80deg, transparent 0 18px, rgba(255,80,80,0.22) 19px 22px, transparent 23px 60px); }
  .cutin.domain .cutin-lines { background: repeating-linear-gradient(90deg, transparent 0 30px, rgba(129,140,248,0.12) 31px 33px, transparent 34px 90px); }
  @keyframes cutinLines { from { transform: translateX(0); } to { transform: translateX(-70px); } }
  .cutin-panel { position:absolute; left:6%; right:6%; top:10%; bottom:24%; overflow:hidden; border:4px solid #fde047;
    box-shadow: 0 0 30px rgba(253,224,71,0.7), 0 0 0 3px #000; background:#000; }
  .cutin.berserk .cutin-panel { border-color:#ef4444; box-shadow: 0 0 40px rgba(239,68,68,0.9), 0 0 0 3px #000; }
  .cutin-panel img { width:100%; height:100%; object-fit:cover; object-position:50% 38%; display:block; }
  .cutin-text { position:absolute; left:0; right:0; bottom:9%; text-align:center; font-family: var(--font-dramatic); }
  .cutin-text .small { font-size: clamp(9px, 1.9cqw, 15px); letter-spacing: 3px; color:#fef9c3; text-shadow:0 0 8px #000, 0 0 2px #000; }
  .cutin-text .big { font-size: clamp(24px, 11cqw, 76px); text-wrap: balance; padding: 0 4%; font-weight:900; letter-spacing:4px; color:#fde047; line-height:1.05;
    text-shadow: 0 0 22px rgba(253,224,71,0.8), 3px 3px 0 #000, -2px -2px 0 #000; }
  .cutin.berserk .cutin-text .small { color:#fecaca; }
  .cutin.berserk .cutin-text .big { font-size: clamp(22px, 7.4cqw, 60px); letter-spacing: 0.04em; color:#fff; text-shadow: 0 0 26px #ef4444, 0 0 8px #3b82f6, 3px 3px 0 #000, -2px -2px 0 #000; }
  .cutin.domain .cutin-text .small { color:#c7d2fe; letter-spacing: 6px; }
  .cutin.domain .cutin-text .big { font-size: clamp(20px, 6.6cqw, 58px); letter-spacing: 0.06em; color:#e0e7ff; text-shadow: 0 0 26px #6366f1, 3px 3px 0 #000, -2px -2px 0 #000; }
  .shiki { transform: translate(-50%, -50%); filter: drop-shadow(0 0 8px #6366f1) drop-shadow(0 2px 3px #000); line-height: 1; }
  .shiki.summoned { animation: shikiIn 0.28s ease-out, shikiHop 0.3s ease-in-out 0.28s infinite alternate; }
  .shiki.summoned.totality { animation: shikiIn 0.35s ease-out, shikiHop 0.22s ease-in-out 0.35s infinite alternate; }
  .shiki.summoned.toad { animation: shikiIn 0.28s ease-out, shikiHop 0.5s ease-in-out 0.28s infinite alternate; }
  .shiki.summoned.deer { animation: shikiIn 0.3s ease-out, shikiHop 0.9s ease-in-out 0.3s infinite alternate; }
  .shiki.nue2 { filter: drop-shadow(0 0 10px #facc15) drop-shadow(0 0 2px #fff); animation: shikiIn 0.3s ease-out, nueFlap 0.18s ease-in-out 0.3s infinite alternate; }
  @keyframes shikiIn { from { transform: translate(-50%, 0%) scale(0.4, 0.05); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
  @keyframes nueFlap { from { transform: translate(-50%, -50%) scaleY(1); } to { transform: translate(-50%, -54%) scaleY(0.86); } }
  @keyframes shikiHop { from { margin-top: 0; } to { margin-top: -5px; } }
  .shiki-howl { position:absolute; left:50%; top:50%; width:220%; height:220%; transform:translate(-50%,-50%); border-radius:50%;
    border:3px solid rgba(226,232,240,0.8); box-shadow:0 0 18px rgba(226,232,240,0.6); animation: howlRing 0.6s ease-out infinite; pointer-events:none; }
  @keyframes howlRing { from { transform:translate(-50%,-50%) scale(0.4); } to { transform:translate(-50%,-50%) scale(1.3); opacity:0; } }
  .garden-floor { position:absolute; inset:0;
    background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(49,46,129,0.35), transparent 70%),
      linear-gradient(180deg, rgba(2,1,8,0.5) 0%, rgba(2,1,8,0.58) 38%, rgba(4,3,16,0.86) 50%, rgba(2,1,8,0.95) 100%); }
  .garden-floor::before { content:''; position:absolute; left:-5%; right:-5%; top:46%; height:3px; background: linear-gradient(90deg, transparent, #6366f1, #a5b4fc, #6366f1, transparent);
    filter: blur(1px); opacity:0.7; animation: gardenSurface 3s ease-in-out infinite alternate; }
  @keyframes gardenSurface { from { transform: translateY(-4px) scaleX(0.98); } to { transform: translateY(4px) scaleX(1.02); } }
  .garden-ripples { position:absolute; left:0; right:0; top:48%; bottom:0; opacity:0.55;
    background:
      radial-gradient(ellipse 18% 4% at 20% 30%, transparent 60%, rgba(129,140,248,0.35) 66%, transparent 72%),
      radial-gradient(ellipse 22% 5% at 70% 60%, transparent 60%, rgba(129,140,248,0.3) 66%, transparent 72%),
      radial-gradient(ellipse 14% 3% at 45% 85%, transparent 60%, rgba(129,140,248,0.3) 66%, transparent 72%);
    animation: gardenRipple 2.2s ease-out infinite; }
  @keyframes gardenRipple { from { transform: scale(0.85); opacity:0.7; } to { transform: scale(1.25); opacity:0; } }
`;
