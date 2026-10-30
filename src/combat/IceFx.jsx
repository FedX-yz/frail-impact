// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Ice's kit looks like (the logic is in icePlatinum.js). Everything here is
// drawn in code except two pictures: the ice figures (his full-body art, frozen over)
// and the burst art (mainCard.burstArt, his full-body art until the real one is drawn).
//   IceGround   frost lines and the figures' cold, under the enemies
//   IceFigures  the ice figures (HTML, with the allies)
//   IceOver     Freeze meters, ice around frozen enemies, flying shards, the Shatter
//               charge at the cursor, the M2 detonate charge
//   IceEffect   one-off effects: iceburst, shatter, flashfreeze
//   IceScreen   Absolute Zero: the burst cut-in, the frozen world, the storm
// ─────────────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL;
export const ICE_FIGURE_IMG = `${BASE}sprites/ice-platinum.png`;
const clamp01 = v => Math.max(0, Math.min(1, v));
const FROST = '#bae6fd', WHITE = '#f0f9ff', DEEP = '#0c4a6e';

// a crystal around a point: n jagged spikes
function crystalPath(x, y, r, n = 9, seed = 1) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + seed;
    const rr = r * (i % 2 ? 0.72 + 0.12 * Math.sin(seed * 7 + i * 3.1) : 1 + 0.1 * Math.sin(seed * 3 + i * 1.7));
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
}

// ── under the enemies ────────────────────────────────────────────────────
export function IceGround({ s, k, time }) {
  const ic = s.kit.ice, sk = s.stats.skill;
  if (!ic || (!ic.walls.length && !ic.figures.length)) return null;
  return (
    <g>
      {ic.figures.map(f => (
        <circle key={`a${f.id}`} cx={f.x} cy={f.y} r={(sk?.figR ?? 110) * k} fill="rgba(186,230,253,0.07)" stroke={FROST} strokeOpacity={0.35}
          strokeWidth={1.5} strokeDasharray={`${3 * k} ${7 * k}`} transform={`rotate(${time * 20} ${f.x} ${f.y})`} />
      ))}
      {ic.walls.map(w => {
        const fade = clamp01(Math.min(w.t / 0.12, (w.life - w.t) / 0.6));
        return (
          <g key={w.id} opacity={fade}>
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#38bdf8" strokeOpacity={0.35} strokeWidth={22 * k} strokeLinecap="round" />
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={FROST} strokeWidth={10 * k} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #7dd3fc)' }} />
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={WHITE} strokeWidth={3 * k} strokeLinecap="round" />
          </g>
        );
      })}
      {/* little spikes along the line */}
      {ic.walls.filter((_, i) => i % 2 === 0).map(w => {
        const fade = clamp01(Math.min(w.t / 0.12, (w.life - w.t) / 0.6));
        const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
        return <path key={`s${w.id}`} d={crystalPath(mx, my, 9 * k, 5, w.id)} fill={WHITE} opacity={0.8 * fade} />;
      })}
    </g>
  );
}

// ── the ice figures ──────────────────────────────────────────────────────
export function IceFigures({ s, k }) {
  const ic = s.kit.ice;
  if (!ic?.figures.length) return null;
  return ic.figures.map(f => {
    const h = 132 * k, rise = clamp01(f.t / 0.25), hit = s.time - (f.hitT ?? -9) < 0.15, end = clamp01((f.life - f.t) / 0.6);
    return (
      <div key={f.id} style={{ position: 'absolute', left: f.x, top: f.y, width: 0, height: 0, zIndex: 6, pointerEvents: 'none', opacity: end }}>
        <div style={{ position: 'absolute', left: -h * 0.42, top: -h * 0.82, width: h * 0.84, height: h, transform: `scaleY(${0.3 + 0.7 * rise})`, transformOrigin: '50% 100%' }}>
          <img src={ICE_FIGURE_IMG} alt="" draggable={false} className={`ice-fig${hit ? ' hit' : ''}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom', transform: f.flip ? 'scaleX(-1)' : undefined }} />
        </div>
        {/* ice pedestal */}
        <svg width={h} height={h * 0.3} viewBox="-50 -12 100 24" style={{ position: 'absolute', left: -h / 2, top: -h * 0.12, overflow: 'visible' }}>
          <ellipse cx={0} cy={2} rx={34} ry={9} fill="rgba(186,230,253,0.55)" stroke={WHITE} strokeWidth={1.5} />
          <path d="M-30,2 L-22,-8 L-12,0 L-4,-11 L6,-1 L15,-9 L24,1 L31,-4 L32,4 L-31,5 Z" fill="rgba(224,242,254,0.85)" />
        </svg>
        {/* cracks: how many shots it can still take */}
        {f.hp < 3 && <div className="ice-fig-hp">{'◆'.repeat(Math.max(0, f.hp))}{'◇'.repeat(3 - Math.max(0, f.hp))}</div>}
      </div>
    );
  });
}

// ── above the enemies ────────────────────────────────────────────────────
export function IceOver({ s, k, P, time }) {
  const ic = s.kit.ice, sk = s.stats.skill, zero = sk?.type === 'zero';
  if (!ic && !zero) return null;
  const pl = s.player, held = pl.held;
  // Shatter charging at the cursor (not while drawing a frost line)
  let charge = null;
  if (zero && P && held && !held.ice?.drag && !s.mahoraga) {
    const f = clamp01((s.time - held.t0 - 0.25) / Math.max(0.01, (sk.full ?? 0.9) - 0.25));
    if (s.time - held.t0 > 0.12) charge = f;
  }
  const nFrozen = zero ? s.enemies.filter(e => e.frozen > 0).length : 0;
  // M2 held with figures out: detonate charge
  const m2 = pl.m2 && !pl.m2.viaM1 && zero && ic?.figures.length ? clamp01(s.time - pl.m2.t0) : null;
  return (
    <g>
      {zero && s.enemies.map(e => {
        const r = e.size * s.k * 0.5;
        if (e.frozen > 0 && e.tier !== 'boss' && !e.group) {
          const seed = e.id * 1.37, gl = 0.5 + 0.5 * Math.sin(time * 5 + e.id);
          return (
            <g key={`fz${e.id}`} opacity={Math.min(1, e.frozen / 0.4)}>
              <path d={crystalPath(e.x, e.y, r * 0.78, 8, seed)} fill="rgba(186,230,253,0.28)" stroke={WHITE} strokeWidth={2.2 * k} strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 ${4 + 5 * gl}px #7dd3fc)` }} />
              <path d={`M${e.x - r * 0.4},${e.y - r * 0.5} L${e.x - r * 0.1},${e.y - r * 0.05} L${e.x + r * 0.35},${e.y - r * 0.35} M${e.x - r * 0.1},${e.y - r * 0.05} L${e.x + r * 0.05},${e.y + r * 0.5}`}
                stroke={WHITE} strokeOpacity={0.55} strokeWidth={1.4 * k} fill="none" />
            </g>
          );
        }
        if (!(e.chill > 0)) return null;
        const R = r * 0.62 + 5 * k, C = 2 * Math.PI * R, f = Math.min(1, e.chill / 100), boss = e.tier === 'boss' || e.group;
        return (
          <g key={`ch${e.id}`}>
            <circle cx={e.x} cy={e.y} r={R} fill="none" stroke="rgba(8,47,73,0.55)" strokeWidth={5 * k} />
            <circle cx={e.x} cy={e.y} r={R} fill="none" stroke={boss ? '#7dd3fc' : FROST} strokeWidth={4 * k} strokeDasharray={`${C * f} ${C}`}
              transform={`rotate(-90 ${e.x} ${e.y})`} style={f > 0.7 ? { filter: 'drop-shadow(0 0 5px #7dd3fc)' } : undefined} />
            {f > 0.66 && !boss && <text x={e.x} y={e.y - R - 4 * k} textAnchor="middle" fontSize={11 * k} fill={WHITE} fontWeight={900}>❄</text>}
          </g>
        );
      })}
      {ic?.shards.map(sh => {
        const z = 9 * k * sh.sz, o = 1 - sh.t / sh.life;
        return <path key={sh.id} d={`M0,${-z} L${z * 0.45},0 L0,${z * 0.6} L${-z * 0.45},0 Z`} fill={WHITE} stroke="#7dd3fc" strokeWidth={1}
          transform={`translate(${sh.x} ${sh.y}) rotate(${sh.rot * 57.3})`} opacity={o} />;
      })}
      {charge != null && P && (() => {
        const R = 34 * k, C = 2 * Math.PI * R, full = charge >= 1;
        return (
          <g>
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={6 * k} />
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke={full ? WHITE : FROST} strokeWidth={5 * k} strokeDasharray={`${C * charge} ${C}`}
              transform={`rotate(-90 ${P.x} ${P.y})`} style={full ? { filter: 'drop-shadow(0 0 10px #e0f2fe)' } : undefined} />
            {full && <path d={crystalPath(P.x, P.y, R * 1.25, 6, time * 2)} fill="none" stroke={WHITE} strokeOpacity={0.6} strokeWidth={1.5} />}
            <text x={P.x} y={P.y - R - 8 * k} textAnchor="middle" fontSize={12 * k} fontWeight={900} fill={nFrozen ? WHITE : '#94a3b8'}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{nFrozen ? `💠 SHATTER ×${nFrozen}` : 'nothing frozen'}</text>
          </g>
        );
      })()}
      {m2 != null && P && (() => {
        const R = 46 * k, C = 2 * Math.PI * R;
        return (
          <g>
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={4 * k} />
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="#bae6fd" strokeWidth={3.5 * k} strokeDasharray={`${C * m2} ${C}`} transform={`rotate(-90 ${P.x} ${P.y})`} />
            {m2 >= 1 && <text x={P.x} y={P.y + R + 16 * k} textAnchor="middle" fontSize={12 * k} fontWeight={900} fill={WHITE}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>let go: DETONATE</text>}
          </g>
        );
      })()}
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function IceEffect({ f, k }) {
  const p = clamp01(f.t / (f.life ?? 0.5)), o = 1 - p;
  if (f.kind === 'iceburst') return (
    <g opacity={o}>
      <path d={crystalPath(f.x, f.y, f.r * (0.6 + 0.5 * p), 7, f.id)} fill="rgba(224,242,254,0.35)" stroke={WHITE} strokeWidth={2 * k} />
      <circle cx={f.x} cy={f.y} r={f.r * (0.4 + 0.9 * p)} fill="none" stroke={FROST} strokeWidth={2 * k} />
    </g>
  );
  if (f.kind === 'shatter') {
    const n = 10;
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={f.r * (0.3 + 1.1 * p)} fill="rgba(240,249,255,0.25)" stroke={WHITE} strokeWidth={3 * k * o} />
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + f.id, L = f.r * (0.5 + 1.2 * p);
          return <line key={i} x1={f.x + Math.cos(a) * L * 0.35} y1={f.y + Math.sin(a) * L * 0.35} x2={f.x + Math.cos(a) * L} y2={f.y + Math.sin(a) * L}
            stroke={i % 2 ? FROST : WHITE} strokeWidth={(i % 2 ? 2 : 3.5) * k} strokeLinecap="round" />;
        })}
      </g>
    );
  }
  if (f.kind === 'flashfreeze') {
    const R = f.r * (0.25 + 0.75 * Math.min(1, p * 2.2));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="rgba(186,230,253,0.22)" stroke={WHITE} strokeWidth={4 * k} style={{ filter: 'drop-shadow(0 0 12px #7dd3fc)' }} />
        <path d={crystalPath(f.x, f.y, R * 0.98, 16, f.id)} fill="none" stroke={FROST} strokeWidth={2 * k} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          return <line key={i} x1={f.x} y1={f.y} x2={f.x + Math.cos(a) * R} y2={f.y + Math.sin(a) * R} stroke={WHITE} strokeOpacity={0.7} strokeWidth={2 * k} />;
        })}
      </g>
    );
  }
  return null;
}

// ── Absolute Zero: the burst art, the frozen world, the storm ─────────────
export function IceScreen({ s, mainCard, mobile }) {
  const ic = s.kit.ice;
  if (!ic) return null;
  const az = s.ult.active?.type === 'absolutezero' ? s.ult.active : null;
  return (
    <>
      {az && !ic.cutin && <div className="ice-world" />}
      {az && !ic.cutin && <div className="ice-snow slow" />}
      {az && !ic.cutin && <div className="ice-az-tag" style={mobile ? { top: '24%' } : undefined}>ABSOLUTE ZERO · {Math.max(0, az.t).toFixed(1)}s</div>}
      {ic.cutin && <IceCutIn c={ic.cutin} card={mainCard} mobile={mobile} />}
      {ic.storm && <IceStorm st={ic.storm} />}
    </>
  );
}

function IceCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life;
  const inP = clamp01(t / 0.22), ease = 1 - (1 - inP) ** 3, outP = clamp01((t - (L - 0.28)) / 0.28);
  const art = card?.burstArt ?? card?.sprite ?? ICE_FIGURE_IMG;
  const [fx, fy] = card?.burstFocus ?? [50, 10];
  const crack = clamp01((t - 0.55) / 0.35);
  const textO = clamp01((t - 0.3) / 0.15) * (1 - outP);
  const zoom = 1.25 + 0.12 * t;   // the face fills the band
  return (
    <div className="ice-cutin" style={{ opacity: 1 - outP * 0.7 }}>
      <div className="ice-cutin-bg" style={{ opacity: clamp01(t / 0.06) * (1 - outP) }} />
      <div className="ice-cutin-streaks" style={{ opacity: 1 - outP, backgroundPosition: `${-t * 900}px 0` }} />
      {/* his full-body art behind the band, sliding in from the right */}
      <img src={art} alt="" draggable={false} className="ice-cutin-full" style={{ opacity: clamp01((t - 0.1) / 0.2) * (1 - outP), transform: `translateX(${(1 - ease) * 40 - outP * 20}%) scale(${1 + 0.05 * t})` }} />
      {/* his face in a diamond-cut band across the screen */}
      <div className="ice-cutin-band" style={{ transform: `translateX(${(1 - ease) * -110 + outP * 110}%) skewX(-14deg)` }}>
        <div className="ice-cutin-watermark" style={{ transform: `skewX(14deg) translateX(${-t * 6}%)` }}>ZERO POINT</div>
        <img src={art} alt="" draggable={false} className="ice-cutin-face"
          style={{ width: `${zoom * 100}%`, left: mobile ? '46%' : '32%', transform: `translate(-${fx}%, -${fy}%) skewX(14deg)` }} />
        <div className="ice-cutin-glint" style={{ left: `${-40 + t * 140}%` }} />
      </div>
      {/* the screen freezes over */}
      <svg className="ice-cutin-crack" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: crack * (1 - outP) }}>
        {[[50, 50, 0, 8], [50, 50, 100, 22], [50, 50, 12, 100], [50, 50, 92, 100], [50, 50, 0, 64], [50, 50, 100, 70], [50, 50, 60, 0]].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * crack} y2={y1 + (y2 - y1) * crack} stroke="#fff" strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="ice-cutin-text" style={{ opacity: textO, fontSize: mobile ? '0.75em' : undefined }}>
        <div className="small">PLATINUM · ZERO POINT</div>
        <div className="big">ABSOLUTE ZERO</div>
        <div className="small jp">絶対零度</div>
      </div>
    </div>
  );
}

function IceStorm({ st }) {
  const t = st.t, L = st.life, inP = clamp01(t / 0.35), outP = clamp01((t - (L - 0.5)) / 0.5);
  return (
    <>
      <div className="ice-snow fast" style={{ opacity: inP * (1 - outP) }} />
      <div className="ice-storm-white" style={{ opacity: st.hit ? Math.max(0, 0.75 - (t - 0.45) * 1.6) : 0 }} />
    </>
  );
}

export const ICE_CSS = `
  .ice-fig { filter: grayscale(1) brightness(1.75) contrast(0.85) sepia(1) hue-rotate(160deg) saturate(2.4) drop-shadow(0 0 2px #fff) drop-shadow(0 0 10px #38bdf8);
    opacity: 0.9; mix-blend-mode: normal; }
  .ice-fig.hit { filter: brightness(3) drop-shadow(0 0 12px #fff); }
  .ice-fig-hp { position:absolute; left:-30px; width:60px; top:10px; text-align:center; font-size:10px; color:#e0f2fe; text-shadow:0 0 4px #000; letter-spacing:1px; }
  .ice-world { position:absolute; inset:0; z-index:10; pointer-events:none;
    background: radial-gradient(ellipse at center, rgba(224,242,254,0.05) 30%, rgba(186,230,253,0.42) 100%);
    box-shadow: inset 0 0 90px rgba(224,242,254,0.75); }
  .ice-az-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#f0f9ff; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #38bdf8, 0 2px 0 #0c4a6e; white-space:nowrap; }
  .ice-snow { position:absolute; inset:-20%; z-index:11; pointer-events:none;
    background-image: radial-gradient(circle, #fff 0 1.4px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.8) 0 1px, transparent 1.6px);
    background-size: 90px 90px, 53px 53px; }
  .ice-snow.slow { opacity:0.55; animation: iceSnowSlow 9s linear infinite; }
  .ice-snow.fast { z-index:14; background-image: linear-gradient(100deg, transparent 0 46%, rgba(255,255,255,0.85) 47% 48%, transparent 49%),
      radial-gradient(circle, #fff 0 2px, transparent 2.6px); background-size: 120px 40px, 60px 60px; animation: iceSnowFast 0.5s linear infinite; }
  .ice-storm-white { position:absolute; inset:0; z-index:15; background:#f0f9ff; pointer-events:none; }
  @keyframes iceSnowSlow { from { transform: translate(0,0); } to { transform: translate(-90px, 180px); } }
  @keyframes iceSnowFast { from { transform: translate(0,0); } to { transform: translate(-240px, 80px); } }

  .ice-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .ice-cutin-bg { position:absolute; inset:0; background: linear-gradient(115deg, #020617 0%, #0b1324 40%, #12233f 60%, #020617 100%); }
  .ice-cutin-streaks { position:absolute; inset:0; mix-blend-mode:screen;
    background-image: repeating-linear-gradient(115deg, transparent 0 38px, rgba(226,232,240,0.10) 38px 40px, transparent 40px 90px, rgba(186,230,253,0.22) 90px 91px); }
  .ice-cutin-band { position:absolute; left:-8%; right:-8%; top:24%; height:42%; overflow:hidden;
    border-top: 4px solid #e2e8f0; border-bottom: 4px solid #e2e8f0; box-shadow: 0 0 0 2px #0f172a, 0 0 40px rgba(186,230,253,0.55), inset 0 0 60px rgba(2,6,23,0.6);
    background: repeating-linear-gradient(115deg, rgba(226,232,240,0.06) 0 2px, transparent 2px 26px), linear-gradient(90deg, #0b1220 0%, #1e293b 45%, #334155 70%, #0f172a 100%); }
  .ice-cutin-watermark { position:absolute; right:4%; top:50%; margin-top:-0.55em; font-family: var(--font-hit, serif); font-size: clamp(40px, 11cqw, 140px); line-height:1.1;
    color: transparent; -webkit-text-stroke: 1.5px rgba(226,232,240,0.35); letter-spacing: 0.08em; white-space:nowrap; }
  .ice-cutin-face { position:absolute; left:30%; top:50%; max-width:none; height:auto; filter: contrast(1.1) brightness(1.05) drop-shadow(0 0 10px #38bdf8); }
  .ice-cutin-glint { position:absolute; top:-20%; bottom:-20%; width:18%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent); transform: skewX(-20deg); mix-blend-mode: overlay; }
  .ice-cutin-full { position:absolute; right:4%; bottom:-6%; height:104%; filter: saturate(0.7) drop-shadow(0 0 2px #e2e8f0) drop-shadow(0 0 22px #38bdf8); }
  .ice-cutin-crack { position:absolute; inset:0; width:100%; height:100%; filter: drop-shadow(0 0 3px #7dd3fc); }
  .ice-cutin-text { position:absolute; left:6%; bottom:9%; text-align:left; font-size: 1em; }
  .ice-cutin-text .small { font-family: var(--font-ui, monospace); color:#cbd5e1; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); }
  .ice-cutin-text .small.jp { letter-spacing: 0.3em; margin-top: 2px; color:#7dd3fc; }
  .ice-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7.5cqw, 84px); line-height:1; letter-spacing: 0.06em;
    background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 38%, #94a3b8 52%, #f8fafc 70%, #cbd5e1 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 0 #0f172a) drop-shadow(0 0 16px rgba(125,211,252,0.8)); }
`;
