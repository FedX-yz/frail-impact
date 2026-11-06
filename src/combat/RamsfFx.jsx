// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Ramsf's kit looks like (the logic is in ramsfPlatinum.js). All drawn in code except
// the doll arms (hand-drawn pieces in public/fx/ramsf_arm, jointed here) and the burst art
// (mainCard.burstArt, his full-body art until the real one is drawn).
//   RamsfOver    the porcelain doll arms on your cursor (and their strikes), the parry
//                window, Strings while you drag, the wings while you hold, the tornado
//   RamsfEffect  one-off effects: parryflash, gust, yank, armhit
//   RamsfScreen  the parry's hit (a white-pink pulse on the edges), Open Arms
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_ARMS } from './ramsfPlatinum.js';
const clamp01 = v => Math.max(0, Math.min(1, v));
const PORCELAIN = '#f5efe6', SHADE = '#d8cfc2', INK = '#3b2530', PINK = '#f472b6', BLUSH = '#fbcfe8', LAV = '#e9d5ff';

// where arm i sits around the cursor: five a side, fanning up and out like wings
function armAngle(i, spread = 1, time = 0) {
  const side = i % 2 ? 1 : -1, rank = Math.floor(i / 2);
  return -Math.PI / 2 + side * (0.62 + rank * 0.4 * spread) + Math.sin(time * 2.2 + i * 1.3) * 0.06;
}

// One doll arm, put together from the hand-drawn pieces in public/fx/ramsf_arm (shoulder ball,
// upper bone, elbow ball, forearm, wrist ball, hand). Each piece: its size, and (bones/hand) the
// point where it hangs from the joint above (t) and where the next joint goes (b), in its own pixels.
// (full paths written out, so the build can point them at its WebP copies)
const BASE = import.meta.env.BASE_URL;
const PIECE = {
  upper:    { src: `${BASE}fx/ramsf_arm/upper.png`,    w: 118, h: 366, t: [53, 0],   b: [62, 366] },
  fore:     { src: `${BASE}fx/ramsf_arm/fore.png`,     w: 166, h: 395, t: [76, 0],   b: [106, 394] },
  hand:     { src: `${BASE}fx/ramsf_arm/hand.png`,     w: 268, h: 367, t: [190, 12], b: [150, 366] },
  shoulder: { src: `${BASE}fx/ramsf_arm/shoulder.png`, w: 121, h: 130, c: [60, 62] },
  elbow:    { src: `${BASE}fx/ramsf_arm/elbow.png`,    w: 118, h: 134, c: [57, 65] },
  wrist:    { src: `${BASE}fx/ramsf_arm/wrist.png`,    w: 65,  h: 68,  c: [32, 34] },
};
// (loaded up front, so the first arm isn't drawn before its pieces arrive)
if (typeof Image !== 'undefined') Object.values(PIECE).forEach(p => { const i = new Image(); i.src = p.src; });
const U0 = 0.062;              // the pieces' pixels → the arena's (× k)
const L1N = 416, L2N = 435;    // shoulder → elbow, elbow → wrist (bone + the bit hidden under the balls)
const deg = a => a * 180 / Math.PI;
// a bone (or the hand): its top at (x, y), pointing along angle a
function Piece({ p, x, y, a, U, flip }) {
  const f = flip ? -1 : 1, rot = deg(a - Math.atan2(p.b[1] - p.t[1], f * (p.b[0] - p.t[0])));
  return <image href={p.src} width={p.w} height={p.h} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${(f * U).toFixed(4)} ${U.toFixed(4)}) translate(${-p.t[0]} ${-p.t[1]})`} />;
}
// a ball joint, centred on (x, y), turning with the bone below it
function Ball({ p, x, y, a, U, flip }) {
  const f = flip ? -1 : 1;
  return <image href={p.src} width={p.w} height={p.h} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg(a - Math.PI / 2).toFixed(1)}) scale(${(f * U).toFixed(4)} ${U.toFixed(4)}) translate(${-p.c[0]} ${-p.c[1]})`} />;
}
const at = (p, a, d) => ({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });
const lerpA = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };

// `ang`: where it hangs from the cursor (bent a little at the elbow). `to` + `f`: a strike, the hand
// going f of the way (0..1) to `to`; the elbow bends to get it there, and past the arm's full stretch
// the hand flies off on a string. `side`: which side of the cursor it's on (mirrors the pieces).
function DollArm({ x, y, ang, k, to = null, f = 0, ghost = false, seg = 21, side = 1 }) {
  const U = U0 * k * seg / 21, L1 = L1N * U, L2 = L2N * U, HL = 300 * U;
  const S = { x, y }, bend = Math.cos(ang) > 0 ? 1 : -1, flip = side > 0;
  // resting pose
  let a1 = ang, E = at(S, a1, L1), a2 = ang + bend * 0.55, W = at(E, a2, L2), ah = a2 + bend * 0.2, W0 = null;
  if (to && f > 0) {
    const toW = at(to, Math.atan2(to.y - S.y, to.x - S.x) + Math.PI, HL * 0.75);   // the wrist stops short so the hand lands on it
    const T = { x: W.x + (toW.x - W.x) * f, y: W.y + (toW.y - W.y) * f };
    const D = Math.hypot(T.x - S.x, T.y - S.y), a = Math.atan2(T.y - S.y, T.x - S.x);
    if (D >= L1 + L2) {
      // full stretch: straight out, and the rest of the way the hand flies on its string
      a1 = a2 = a; E = at(S, a, L1); W0 = at(E, a, L2); W = D > L1 + L2 + 2 * k ? T : W0; if (W === W0) W0 = null;
    } else {
      const cosA = (L1 * L1 + D * D - L2 * L2) / (2 * L1 * Math.max(1e-3, D));
      a1 = a - bend * Math.acos(Math.max(-1, Math.min(1, cosA)));
      E = at(S, a1, L1); W = T; a2 = Math.atan2(W.y - E.y, W.x - E.x);
    }
    ah = lerpA(ah, Math.atan2(to.y - W.y, to.x - W.x), Math.min(1, f * 1.6));
  }
  const g1 = (L1N - PIECE.upper.h) / 2 * U, g2 = (L2N - PIECE.fore.h) / 2 * U;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <Piece p={PIECE.upper} {...at(S, a1, g1)} a={a1} U={U} flip={flip} />
      <Piece p={PIECE.fore} {...at(E, a2, g2)} a={a2} U={U} flip={flip} />
      {W0 && <line x1={W0.x} y1={W0.y} x2={W.x} y2={W.y} stroke="#fdf2f8" strokeWidth={1.1 * k} opacity={0.85} style={{ filter: 'drop-shadow(0 0 2px #f472b6)' }} />}
      <Piece p={PIECE.hand} {...at(W, ah, 4 * U)} a={ah} U={U} flip={flip} />
      <Ball p={PIECE.shoulder} {...S} a={a1} U={U} flip={flip} />
      <Ball p={PIECE.elbow} {...E} a={a2} U={U} flip={flip} />
      <Ball p={PIECE.wrist} {...W} a={ah} U={U} flip={flip} />
    </g>
  );
}

// ── above the enemies ────────────────────────────────────────────────────
export function RamsfOver({ s, k, P, time }) {
  const r = s.kit.ramsf, sk = s.stats.skill;
  if (!r || sk?.type !== 'marionette') return null;
  const open = s.ult.active?.type === 'openarms', n = open ? MAX_ARMS : r.arms;
  const held = s.player.held, wings = held && !held.ramsf?.drag && s.time - held.t0 > 0.12 && !s.mahoraga;
  const charge = wings ? clamp01((s.time - held.t0 - 0.25) / Math.max(0.01, (sk.full ?? 0.8) - 0.25)) : 0;
  const strings = r.strings?.ids.map(id => s.enemies.find(e => e.id === id)).filter(Boolean) ?? [];
  const tn = r.tornado;
  return (
    <g>
      {/* the tornado */}
      {tn && <Tornado tn={tn} k={k} sk={sk} time={time} />}
      {/* Strings: from the cursor through everything you've tied */}
      {P && strings.length > 0 && (
        <g>
          <polyline points={[P, ...strings.slice().reverse()].map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" stroke={BLUSH} strokeWidth={1.6 * k} strokeOpacity={0.9} style={{ filter: 'drop-shadow(0 0 3px #f472b6)' }} />
          {strings.map(e => <circle key={e.id} cx={e.x} cy={e.y} r={e.size * s.k * 0.32} fill="none" stroke={BLUSH} strokeWidth={1.4 * k} strokeDasharray={`${3 * k} ${3 * k}`} />)}
        </g>
      )}
      {P && r.strings && <polyline points={r.strings.pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" stroke={PINK} strokeOpacity={0.35} strokeWidth={1 * k} strokeDasharray={`${2 * k} ${4 * k}`} />}
      {/* the timing cue: the next hit coming at you. A ring closes in and meets the cursor's ring
          the moment it lands (it doesn't tell you when to press: you read it) */}
      {P && r.threat != null && !(r.pw > 0) && (() => {
        const f = clamp01(r.threat / 0.7), R0 = 16 * k, R = R0 + 70 * k * f;
        return (
          <g opacity={0.35 + 0.5 * (1 - f)}>
            <circle cx={P.x} cy={P.y} r={R0} fill="none" stroke={BLUSH} strokeOpacity={0.5} strokeWidth={1.2 * k} />
            <circle cx={P.x} cy={P.y} r={R} fill="none" stroke={PINK} strokeWidth={(1.5 + 1.5 * (1 - f)) * k} strokeDasharray={f > 0.02 ? `${4 * k} ${3 * k}` : undefined} />
          </g>
        );
      })()}
      {/* the parry window: a ring closing on the cursor */}
      {P && r.pw > 0 && (() => {
        const f = clamp01(r.pw / (sk.parryWin ?? 0.22));
        return <circle cx={P.x} cy={P.y} r={(14 + 34 * f) * k} fill="none" stroke="#fff" strokeWidth={2.5 * k} opacity={0.4 + 0.6 * (1 - f)} style={{ filter: 'drop-shadow(0 0 6px #f472b6)' }} />;
      })()}
      {/* wings: his arms folded out from the cursor while you hold */}
      {P && wings && Array.from({ length: MAX_ARMS }, (_, i) => (
        <DollArm key={`w${i}`} x={P.x + (i % 2 ? 6 : -6) * k} y={P.y} ang={armAngle(i, 1.15 + 0.25 * charge + 0.08 * Math.sin(time * (8 + 10 * charge)), time)} k={k} ghost={i >= n} seg={21 + 6 * charge} side={i % 2 ? 1 : -1} />
      ))}
      {/* the arms on your cursor */}
      {P && !wings && Array.from({ length: n }, (_, i) => {
        const st = r.strikes.filter(x => x.arm === i).at(-1);
        const f = st ? Math.sin(clamp01(st.t / st.life) * Math.PI) : 0;
        return <DollArm key={i} x={P.x + (i % 2 ? 5 : -5) * k} y={P.y + 2 * k} ang={armAngle(i, 1, time)} k={k} to={st} f={f} side={i % 2 ? 1 : -1} />;
      })}
    </g>
  );
}

function Tornado({ tn, k, sk, time }) {
  const core = (sk.torR ?? 110) * k, H = core * 2.4, fade = clamp01(Math.min(tn.t / 0.3, (tn.life - tn.t) / 0.5));
  const rings = 9;
  return (
    <g opacity={fade}>
      <circle cx={tn.x} cy={tn.y} r={(sk.torPull ?? 240) * k} fill="none" stroke={LAV} strokeOpacity={0.18} strokeWidth={1.5 * k} strokeDasharray={`${4 * k} ${10 * k}`}
        transform={`rotate(${(time * 90) % 360} ${tn.x} ${tn.y})`} />
      <ellipse cx={tn.x} cy={tn.y} rx={core} ry={core * 0.32} fill="rgba(233,213,255,0.12)" stroke={LAV} strokeOpacity={0.5} strokeWidth={2 * k} />
      {Array.from({ length: rings }, (_, i) => {
        const f = i / (rings - 1), w = core * (0.35 + 0.95 * f), y = tn.y - H * f * 0.85 + Math.sin(time * 6 + i) * 3 * k, x = tn.x + Math.sin(time * 3 + f * 4) * core * 0.18 * f;
        return <ellipse key={i} cx={x} cy={y} rx={w} ry={w * 0.22} fill="none" stroke={i % 3 === 0 ? '#ffffff' : LAV} strokeOpacity={0.75 - f * 0.35}
          strokeWidth={(2.6 - f) * k} strokeDasharray={`${w * 1.1} ${w * 0.5}`} strokeDashoffset={-time * 400 * (1 + f)} />;
      })}
      {/* bits caught in it */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = time * (5 + i) + i * 1.7, f = ((time * 0.6 + i / 6) % 1), w = core * (0.35 + 0.95 * f);
        return <circle key={`b${i}`} cx={tn.x + Math.cos(a) * w} cy={tn.y - H * f * 0.85 + Math.sin(a) * w * 0.22} r={2.2 * k} fill={i % 2 ? BLUSH : '#fff'} />;
      })}
    </g>
  );
}

// ── one-off effects ──────────────────────────────────────────────────────
export function RamsfEffect({ f, k }) {
  const p = clamp01(f.t / (f.life ?? 0.5)), o = 1 - p;
  if (f.kind === 'parryflash') {
    // the spark of contact: a starburst, a ring, and a bright slash across the line of the hit
    const R = f.r * (0.35 + 0.65 * Math.min(1, p * 2.5)), a = f.a ?? 0;
    const ca = Math.cos(a + Math.PI / 2), sa = Math.sin(a + Math.PI / 2), L = f.r * (f.big ? 1.5 : 1.15) * (1 - p * 0.3);
    const rays = f.big ? 12 : 8;
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="none" stroke="#fff" strokeWidth={(f.big ? 6 : 4) * k * o} style={{ filter: 'drop-shadow(0 0 10px #f472b6)' }} />
        {Array.from({ length: rays }, (_, i) => {
          const ra = (i / rays) * Math.PI * 2 + a, l = R * (i % 2 ? 0.9 : 1.4);
          return <line key={i} x1={f.x + Math.cos(ra) * R * 0.25} y1={f.y + Math.sin(ra) * R * 0.25} x2={f.x + Math.cos(ra) * l} y2={f.y + Math.sin(ra) * l}
            stroke={i % 2 ? BLUSH : '#fff'} strokeWidth={(i % 2 ? 2 : 3.5) * k} strokeLinecap="round" />;
        })}
        {!f.auto && <line x1={f.x - ca * L} y1={f.y - sa * L} x2={f.x + ca * L} y2={f.y + sa * L} stroke="#fff" strokeWidth={(f.big ? 7 : 5) * k * (1 - p)} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #fff)' }} />}
        <circle cx={f.x} cy={f.y} r={10 * k * (1 - p)} fill="#fff" />
      </g>
    );
  }
  if (f.kind === 'gust') {
    const R = f.r * (0.3 + 0.7 * Math.min(1, p * 1.8));
    return (
      <g opacity={o}>
        <circle cx={f.x} cy={f.y} r={R} fill="rgba(252,231,243,0.12)" stroke="#fce7f3" strokeWidth={3 * k} />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + f.id * 0.3, r0 = R * 0.55, r1 = R * 1.05;
          return <path key={i} d={`M${f.x + Math.cos(a) * r0},${f.y + Math.sin(a) * r0} Q${f.x + Math.cos(a + 0.25) * (r0 + r1) / 2},${f.y + Math.sin(a + 0.25) * (r0 + r1) / 2} ${f.x + Math.cos(a + 0.1) * r1},${f.y + Math.sin(a + 0.1) * r1}`}
            fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={2 * k} strokeLinecap="round" />;
        })}
      </g>
    );
  }
  if (f.kind === 'yank') {
    const q = Math.min(1, p * 2.5);
    return <line x1={f.x1} y1={f.y1} x2={f.x1 + (f.x2 - f.x1) * q} y2={f.y1 + (f.y2 - f.y1) * q} stroke={BLUSH} strokeWidth={2.2 * k} opacity={o} style={{ filter: 'drop-shadow(0 0 4px #f472b6)' }} />;
  }
  if (f.kind === 'armhit') return <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={PORCELAIN} strokeWidth={3 * k * o} strokeLinecap="round" opacity={o} />;
  return null;
}

// ── on the screen ────────────────────────────────────────────────────────
export function RamsfScreen({ s, mainCard, mobile }) {
  const r = s.kit.ramsf;
  if (!r || s.stats.skill?.type !== 'marionette') return null;
  const oa = s.ult.active?.type === 'openarms' ? s.ult.active : null;
  const hit = r.lastParry ? s.time - r.lastParry.t : 9;
  return (
    <>
      {/* the impact frame: while the hitstop holds, everything goes stark */}
      {r.hitstop > 0 && <div className={`rf-impact${r.streak >= 3 ? ' big' : ''}`} />}
      {hit < 0.22 && <div className="rf-parry-hit" style={{ opacity: 1 - hit / 0.22 }} />}
      {oa && !r.cutin && <div className="rf-open" />}
      {oa && !r.cutin && <div className="rf-tag" style={mobile ? { top: '24%' } : undefined}>OPEN ARMS · {Math.max(0, oa.t).toFixed(1)}s</div>}
      {r.cutin && <RfCutIn c={r.cutin} card={mainCard} mobile={mobile} />}
    </>
  );
}

// The burst art: a ring of his arms closes over the screen like a curtain, then opens on him
function RfCutIn({ c, card, mobile }) {
  const t = c.t, L = c.life, inP = clamp01(t / 0.2), outP = clamp01((t - (L - 0.25)) / 0.25);
  const art = card?.burstArt ?? card?.sprite;
  const [fx, fy] = card?.burstFocus ?? [50, 12];
  const R = 42 * inP * (1 - outP * 0.4);
  return (
    <div className="rf-cutin" style={{ opacity: 1 - outP }}>
      <div className="rf-cutin-iris" style={{ clipPath: `circle(${R}% at 50% 46%)` }}>
        {art && <img src={art} alt="" draggable={false} className="rf-cutin-face" style={{ transform: `translate(-${fx}%, -${fy}%) scale(${1.02 + 0.05 * t})` }} />}
      </div>
      <div className="rf-cutin-text" style={{ opacity: clamp01((t - 0.18) / 0.12) * (1 - outP), fontSize: mobile ? '0.75em' : undefined }}>
        <div className="small">PLATINUM · MARIONETTE</div>
        <div className="big">OPEN ARMS</div>
      </div>
    </div>
  );
}

export const RAMSF_CSS = `
  .rf-parry-hit { position:absolute; inset:0; z-index:15; pointer-events:none;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0) 45%, rgba(252,231,243,0.45) 85%, rgba(244,114,182,0.6) 100%); }
  .rf-impact { position:absolute; inset:0; z-index:14; pointer-events:none; backdrop-filter: contrast(1.45) saturate(0.35) brightness(1.12); }
  .rf-impact.big { backdrop-filter: contrast(1.7) saturate(0) brightness(1.2); }
  .rf-open { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 70px rgba(244,114,182,0.4); }
  .rf-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#fdf2f8; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #db2777, 0 2px 0 #3b0a24; white-space:nowrap; }
  .rf-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .rf-cutin-iris { position:absolute; inset:0; background: radial-gradient(circle at 50% 46%, #3b0a24 0%, #1a0510 70%);
    box-shadow: inset 0 0 0 3px #fbcfe8; }
  .rf-cutin-face { position:absolute; left:50%; top:46%; height:240%; width:auto; max-width:none; filter: contrast(1.1) drop-shadow(0 0 12px #f472b6); }
  .rf-cutin-text { position:absolute; left:0; right:0; bottom:9%; text-align:center; }
  .rf-cutin-text .small { font-family: var(--font-ui, monospace); color:#fbcfe8; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .rf-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7cqw, 80px); line-height:1; letter-spacing: 0.06em; color:#fdf2f8;
    text-shadow: 0 3px 0 #3b0a24, 0 0 18px rgba(244,114,182,0.9); }
`;
