// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Bonk's kit looks like (the logic is in bonkPlatinum.js). All drawn in code except
// the burst art (mainCard.burstArt, his full-body art until the real one is drawn).
//   BonkGround  claw rakes torn into the floor, under the enemies
//   BonkOver    Bleed meters, hemorrhaging enemies, wounds on the big ones, blood drops, the
//               Rupture charge at the cursor, and his claw arm when he's carrying something
//   BonkEffect  one-off effects: bloodburst, rupture, bloodnova, bonkslam, clawstrike
//   BonkScreen  Red Mist: the burst art crossing the screen (the fight goes on behind it),
//               the red haze, the harvest at the end
// ─────────────────────────────────────────────────────────────────────────────
const clamp01 = v => Math.max(0, Math.min(1, v));
const RED = '#ef4444', BRIGHT = '#fca5a5', DEEP = '#7f1d1d', BLACK = '#1c0505';
const big = e => e.tier === 'boss' || e.group || e.move === 'worm' || e.role === 'hydra' || e.type?.core;

// a splash of blood: a blob with n lobes
function splatPath(x, y, r, n = 9, seed = 1) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + seed;
    const rr = r * (i % 2 ? 0.55 + 0.15 * Math.sin(seed * 5 + i * 2.3) : 0.95 + 0.35 * Math.abs(Math.sin(seed * 3 + i * 1.9)));
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
}
// three claw marks along a segment
function clawLines(x1, y1, x2, y2, gap) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * gap, ny = dx / L * gap;
  return [-1, 0, 1].map(i => [x1 + nx * i, y1 + ny * i, x2 + nx * i, y2 + ny * i]);
}

// ── under the enemies ────────────────────────────────────────────────────
export function BonkGround({ s, k }) {
  const bk = s.kit.bonk;
  if (!bk?.rakes.length) return null;
  return (
    <g>
      {bk.rakes.map(r => {
        const fade = clamp01(Math.min(r.t / 0.06, (r.life - r.t) / 0.45));
        return (
          <g key={r.id} opacity={fade}>
            {clawLines(r.x1, r.y1, r.x2, r.y2, 9 * k).map(([a, b, c, d], i) => (
              <g key={i}>
                <line x1={a} y1={b} x2={c} y2={d} stroke={DEEP} strokeWidth={7 * k} strokeLinecap="round" opacity={0.7} />
                <line x1={a} y1={b} x2={c} y2={d} stroke={i === 1 ? BRIGHT : RED} strokeWidth={(i === 1 ? 3 : 2.2) * k} strokeLinecap="round" />
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ── above the enemies ────────────────────────────────────────────────────
export function BonkOver({ s, k, P, time }) {
  const bk = s.kit.bonk, sk = s.stats.skill, on = sk?.type === 'boil';
  if (!bk && !on) return null;
  const pl = s.player, held = pl.held;
  // Rupture charging at the cursor (not while raking)
  let charge = null;
  if (on && P && held && !held.bonk?.drag && !s.mahoraga && !bk?.grab) {
    const f = clamp01((s.time - held.t0 - 0.25) / Math.max(0.01, (sk.full ?? 0.6) - 0.25));
    if (s.time - held.t0 > 0.12) charge = f;
  }
  const nOpen = on ? s.enemies.filter(e => e.hemo > 0).length : 0;
  const grabbed = bk?.grab ? s.enemies.find(e => e.id === bk.grab.id) : null;
  return (
    <g>
      {on && s.enemies.map(e => {
        const r = e.size * s.k * 0.5;
        if (e.hemo > 0 && !big(e)) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 9 + e.id);
          return (
            <g key={`hm${e.id}`} opacity={Math.min(1, e.hemo / 0.4)}>
              <circle cx={e.x} cy={e.y} r={r * 0.72} fill={`rgba(220,38,38,${0.12 + 0.12 * pulse})`} stroke={RED} strokeWidth={2.4 * k}
                style={{ filter: `drop-shadow(0 0 ${3 + 6 * pulse}px #dc2626)` }} />
              {/* wounds across it */}
              {clawLines(e.x - r * 0.35, e.y - r * 0.4, e.x + r * 0.3, e.y + r * 0.35, 6 * k).map(([a, b, c, d], i) => (
                <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={BRIGHT} strokeOpacity={0.75} strokeWidth={1.8 * k} strokeLinecap="round" />
              ))}
              <text x={e.x} y={e.y - r * 0.72 - 5 * k} textAnchor="middle" fontSize={11 * k} fontWeight={900} fill={BRIGHT}
                style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>🩸{Math.ceil(e.hemo)}</text>
            </g>
          );
        }
        if (!(e.bleed > 0)) return null;
        const R = r * 0.62 + 5 * k, C = 2 * Math.PI * R, f = Math.min(1, e.bleed / 100), wound = big(e);
        return (
          <g key={`bl${e.id}`}>
            <circle cx={e.x} cy={e.y} r={R} fill="none" stroke="rgba(28,5,5,0.6)" strokeWidth={5 * k} />
            <circle cx={e.x} cy={e.y} r={R} fill="none" stroke={wound ? '#b91c1c' : RED} strokeWidth={4 * k} strokeDasharray={`${C * f} ${C}`}
              transform={`rotate(-90 ${e.x} ${e.y})`} style={f > 0.7 ? { filter: 'drop-shadow(0 0 5px #dc2626)' } : undefined} />
            {wound && f > 0.15 && <text x={e.x} y={e.y - R - 4 * k} textAnchor="middle" fontSize={11 * k} fill={BRIGHT} fontWeight={900}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>WOUND +{Math.round(30 * f)}%</text>}
          </g>
        );
      })}
      {bk?.drops.map(d => {
        const z = 5 * k * d.sz, o = 1 - d.t / d.life;
        return <ellipse key={d.id} cx={d.x} cy={d.y} rx={z * 0.7} ry={z} fill={d.sz > 1.1 ? DEEP : '#dc2626'} opacity={o} />;
      })}
      {grabbed && <ClawArm s={s} e={grabbed} k={k} time={time} t={bk.grab.t} />}
      {charge != null && P && (() => {
        const R = 34 * k, C = 2 * Math.PI * R, full = charge >= 1;
        return (
          <g>
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={6 * k} />
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke={full ? BRIGHT : RED} strokeWidth={5 * k} strokeDasharray={`${C * charge} ${C}`}
              transform={`rotate(-90 ${P.x} ${P.y})`} style={full ? { filter: 'drop-shadow(0 0 10px #dc2626)' } : undefined} />
            {full && <path d={splatPath(P.x, P.y, R * 1.3, 7, time * 2)} fill="none" stroke={RED} strokeOpacity={0.6} strokeWidth={1.5} />}
            <text x={P.x} y={P.y - R - 8 * k} textAnchor="middle" fontSize={12 * k} fontWeight={900} fill={nOpen ? BRIGHT : '#94a3b8'}
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{nOpen ? `🩸 RUPTURE ×${nOpen}` : 'nothing bleeding'}</text>
          </g>
        );
      })()}
    </g>
  );
}

// His claw arm, reaching out of the status frame to what he's carrying: plated segments, red
// cables, three talons around it
function ClawArm({ s, e, k, time, t }) {
  const r = s.reserved;
  const O = r ? { x: (r.x0 + r.x1) / 2, y: r.y0 + (r.y1 - r.y0) * 0.3 } : { x: s.W * 0.12, y: s.H * 0.85 };
  const R = e.size * s.k * 0.5;
  const dx = e.x - O.x, dy = e.y - O.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  // the elbow bows up (out of the corner), the wrist stops at the enemy's edge
  const W = { x: e.x - ux * R * 0.95, y: e.y - uy * R * 0.95 };
  const bend = Math.min(L * 0.18, 120 * k);
  const E = { x: (O.x + W.x) / 2 + uy * bend, y: (O.y + W.y) / 2 - ux * bend };
  const seg = (a, b, w) => (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BLACK} strokeWidth={(w + 5) * k} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3f3f46" strokeWidth={w * k} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={RED} strokeWidth={2 * k} strokeDasharray={`${10 * k} ${7 * k}`} strokeDashoffset={-time * 60} strokeLinecap="round" />
    </g>
  );
  // three talons from the wrist: the outer two wrap round it, the middle one sinks in
  const a0 = Math.atan2(uy, ux), grip = 1 + 0.08 * Math.sin(time * 14);
  const dir = (a, m) => ({ x: e.x + Math.cos(a) * R * m, y: e.y + Math.sin(a) * R * m });
  const talons = [-1, 0, 1].map(i => {
    const c = i ? dir(a0 + Math.PI + i * 1.25 * grip, 1.15) : dir(a0 + Math.PI, 0.6);
    const end = i ? dir(a0 + i * 0.9 * grip, 0.85) : dir(a0, 0.15);
    return `M${W.x.toFixed(1)},${W.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  });
  const reach = clamp01(t / 0.12);
  return (
    <g opacity={reach}>
      {seg(O, E, 16)}
      {seg(E, W, 13)}
      <circle cx={E.x} cy={E.y} r={9 * k} fill="#27272a" stroke={RED} strokeWidth={2 * k} />
      <circle cx={W.x} cy={W.y} r={8 * k} fill="#27272a" stroke={RED} strokeWidth={2 * k} />
      {talons.map((d, i) => <path key={i} d={d} fill="none" stroke={BLACK} strokeWidth={7 * k} strokeLinecap="round" />)}
      {talons.map((d, i) => <path key={`h${i}`} d={d} fill="none" stroke="#a1a1aa" strokeWidth={3 * k} strokeLinecap="round" />)}
      {/* how long before he slams it anyway */}
      <circle cx={e.x} cy={e.y} r={R * 1.15} fill="none" stroke={RED} strokeOpacity={0.5} strokeWidth={2 * k}
        strokeDasharray={`${2 * Math.PI * R * 1.15 * clamp01(1 - t / 4)} 9999`} transform={`rotate(-90 ${e.x} ${e.y})`} />
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function BonkEffect({ f, k }) {
  const p = clamp01(f.t / (f.life ?? 0.5)), o = 1 - p;
  if (f.kind === 'bloodburst') return (
    <g opacity={o}>
      <path d={splatPath(f.x, f.y, f.r * (0.5 + 0.6 * p), 7, f.id)} fill="rgba(220,38,38,0.4)" stroke={RED} strokeWidth={2 * k} />
    </g>
  );
  if (f.kind === 'rupture') {
    const n = 12;
    return (
      <g opacity={o}>
        <path d={splatPath(f.x, f.y, f.r * (0.4 + 1.0 * p), 10, f.id)} fill="rgba(153,27,27,0.55)" stroke={BRIGHT} strokeWidth={2.5 * k * o} />
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + f.id, L = f.r * (0.5 + 1.3 * p);
          return <line key={i} x1={f.x + Math.cos(a) * L * 0.3} y1={f.y + Math.sin(a) * L * 0.3} x2={f.x + Math.cos(a) * L} y2={f.y + Math.sin(a) * L}
            stroke={i % 2 ? DEEP : RED} strokeWidth={(i % 2 ? 2.5 : 4) * k} strokeLinecap="round" />;
        })}
      </g>
    );
  }
  if (f.kind === 'bloodnova') {
    const R = f.r * (0.25 + 0.75 * Math.min(1, p * 2.2));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="rgba(127,29,29,0.32)" stroke={RED} strokeWidth={4 * k} style={{ filter: 'drop-shadow(0 0 12px #dc2626)' }} />
        <path d={splatPath(f.x, f.y, R * 0.9, 14, f.id)} fill="none" stroke={BRIGHT} strokeWidth={2 * k} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          return <line key={i} x1={f.x + Math.cos(a) * R * 0.2} y1={f.y + Math.sin(a) * R * 0.2} x2={f.x + Math.cos(a) * R} y2={f.y + Math.sin(a) * R} stroke={RED} strokeOpacity={0.8} strokeWidth={3 * k} strokeLinecap="round" />;
        })}
      </g>
    );
  }
  if (f.kind === 'bonkslam') {
    const R = f.r * (0.3 + 0.9 * p);
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="none" stroke={BRIGHT} strokeWidth={5 * k * o} />
        <circle cx={f.x} cy={f.y} r={R * 0.7} fill="rgba(127,29,29,0.35)" />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + f.id, a2 = a + 0.25;
          return <path key={i} d={`M${f.x},${f.y} L${f.x + Math.cos(a) * R * 1.1},${f.y + Math.sin(a) * R * 1.1} L${f.x + Math.cos(a2) * R * 0.8},${f.y + Math.sin(a2) * R * 0.8}`}
            fill="none" stroke={DEEP} strokeWidth={3 * k} />;
        })}
      </g>
    );
  }
  if (f.kind === 'clawstrike') {
    const a = -0.9 + (f.id % 5) * 0.12, L = f.r * 1.6;
    const x1 = f.x - Math.cos(a) * L / 2, y1 = f.y - Math.sin(a) * L / 2, x2 = f.x + Math.cos(a) * L / 2, y2 = f.y + Math.sin(a) * L / 2;
    const q = Math.min(1, p * 3);
    return (
      <g opacity={o}>
        {clawLines(x1, y1, x1 + (x2 - x1) * q, y1 + (y2 - y1) * q, 10 * k).map(([a1, b1, c1, d1], i) => (
          <g key={i}>
            <line x1={a1} y1={b1} x2={c1} y2={d1} stroke={DEEP} strokeWidth={8 * k} strokeLinecap="round" />
            <line x1={a1} y1={b1} x2={c1} y2={d1} stroke={i === 1 ? '#fff' : BRIGHT} strokeWidth={3 * k} strokeLinecap="round" />
          </g>
        ))}
      </g>
    );
  }
  return null;
}

// ── Red Mist: the burst art, the haze, the harvest ─────────────────────────
export function BonkScreen({ s, mainCard, mobile }) {
  const bk = s.kit.bonk;
  if (!bk) return null;
  const rm = s.ult.active?.type === 'redmist' ? s.ult.active : null;
  return (
    <>
      {rm && <div className="bonk-mist" style={{ opacity: Math.min(1, (rm.dur - rm.t) / 0.4) * Math.min(1, rm.t / 0.5 + 0.4) }} />}
      {rm && !bk.cutin && <div className="bonk-mist-tag" style={mobile ? { top: '24%' } : undefined}>RED MIST · {Math.max(0, rm.t).toFixed(1)}s</div>}
      {bk.cutin && <BonkCutIn c={bk.cutin} card={mainCard} mobile={mobile} />}
      {bk.finale && <div className="bonk-harvest" style={{ opacity: Math.max(0, 0.7 - bk.finale.t * 1.2) }} />}
      {bk.rage > 0 && !rm && <div className="bonk-rage" style={{ opacity: Math.min(1, bk.rage / 0.5) * 0.8 }} />}
    </>
  );
}

// The burst art: a torn red band slashes across (no dark backdrop: the fight goes on under it)
function BonkCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life;
  const inP = clamp01(t / 0.18), ease = 1 - (1 - inP) ** 3, outP = clamp01((t - (L - 0.25)) / 0.25);
  const art = card?.burstArt ?? card?.sprite;
  const [fx, fy] = card?.burstFocus ?? [50, 10];
  const textO = clamp01((t - 0.2) / 0.12) * (1 - outP);
  const Z0 = 1.3, zs = (Z0 + 0.15 * t) / Z0;   // (zoomed with a scale, not a width change: see IceCutIn)
  return (
    <div className="bonk-cutin">
      <div className="bonk-cutin-band" style={{ transform: `translateX(${(1 - ease) * 110 - outP * 110}%) skewY(-6deg)` }}>
        <div className="bonk-cutin-watermark" style={{ transform: `skewY(6deg) translateX(${t * 6}%)` }}>BOILING POINT</div>
        {art && <img src={art} alt="" draggable={false} className="bonk-cutin-face"
          style={{ width: `${Z0 * 100}%`, left: mobile ? '54%' : '68%', transform: `translate(${50 * (zs - 1) - fx * zs}%, ${50 * (zs - 1) - fy * zs}%) skewY(6deg) scale(${zs})` }} />}
        <div className="bonk-cutin-slash" style={{ opacity: clamp01((t - 0.12) / 0.1) * (1 - outP) }} />
      </div>
      <div className="bonk-cutin-text" style={{ opacity: textO, fontSize: mobile ? '0.75em' : undefined }}>
        <div className="small">PLATINUM · BOILING POINT</div>
        <div className="big">RED MIST</div>
        <div className="small jp">血霧</div>
      </div>
    </div>
  );
}

export const BONK_CSS = `
  .bonk-mist { position:absolute; inset:0; z-index:10; pointer-events:none;
    background: radial-gradient(ellipse at center, rgba(127,29,29,0) 35%, rgba(153,27,27,0.38) 80%, rgba(69,10,10,0.6) 100%);
    box-shadow: inset 0 0 90px rgba(220,38,38,0.55); animation: bonkMist 1.1s ease-in-out infinite alternate; }
  @keyframes bonkMist { from { filter: brightness(0.9); } to { filter: brightness(1.25); } }
  .bonk-mist-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#fee2e2; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #dc2626, 0 2px 0 #450a0a; white-space:nowrap; }
  .bonk-rage { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 60px rgba(220,38,38,0.55); }
  .bonk-harvest { position:absolute; inset:0; z-index:15; pointer-events:none; background: radial-gradient(circle, rgba(239,68,68,0.6), rgba(69,10,10,0.9)); }
  .bonk-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .bonk-cutin-band { position:absolute; left:-8%; right:-8%; top:28%; height:34%; overflow:hidden;
    border-top: 4px solid #fecaca; border-bottom: 4px solid #fecaca; box-shadow: 0 0 0 2px #1c0505, 0 0 40px rgba(220,38,38,0.6), inset 0 0 60px rgba(28,5,5,0.7);
    background: repeating-linear-gradient(65deg, rgba(254,202,202,0.06) 0 2px, transparent 2px 24px), linear-gradient(90deg, #1c0505 0%, #450a0a 40%, #7f1d1d 70%, #1c0505 100%); }
  .bonk-cutin-watermark { position:absolute; left:4%; top:50%; margin-top:-0.55em; font-family: var(--font-hit, serif); font-size: clamp(36px, 10cqw, 130px); line-height:1.1;
    color: transparent; -webkit-text-stroke: 1.5px rgba(254,202,202,0.3); letter-spacing: 0.08em; white-space:nowrap; }
  .bonk-cutin-face { position:absolute; top:50%; max-width:none; height:auto; filter: contrast(1.15) saturate(1.1) drop-shadow(0 0 10px #dc2626); will-change: transform; }
  .bonk-cutin-slash { position:absolute; inset:0;
    background: linear-gradient(160deg, transparent 0 44%, rgba(254,226,226,0.95) 45%, transparent 46.5%, transparent 49%, rgba(239,68,68,0.9) 50%, transparent 51.5%, transparent 54%, rgba(254,226,226,0.9) 55%, transparent 56.5%); }
  .bonk-cutin-text { position:absolute; right:6%; bottom:14%; text-align:right; font-size: 1em; }
  .bonk-cutin-text .small { font-family: var(--font-ui, monospace); color:#fecaca; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .bonk-cutin-text .small.jp { letter-spacing: 0.3em; margin-top: 2px; color:#f87171; }
  .bonk-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7.5cqw, 84px); line-height:1; letter-spacing: 0.06em;
    background: linear-gradient(180deg, #fff1f2 0%, #fca5a5 35%, #dc2626 55%, #7f1d1d 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 3px 0 #1c0505) drop-shadow(0 0 16px rgba(220,38,38,0.85)); }
`;
