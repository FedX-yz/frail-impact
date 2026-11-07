// ─────────────────────────────────────────────────────────────────────────────
// What 6★ Ramsf's kit (HELLFIRE STYLE) looks like (the logic is in ramsfPlatinum.js). All drawn
// in code except the doll arms (hand-drawn pieces in public/fx/ramsf_arm, jointed here) and the
// burst art (mainCard.burstArt, his full-body art until the real one is drawn).
//   RamsfOver    the doll arms on your cursor (Manic Puppeteer), the parry window and cue,
//                Strings, the wings, the Otherworld Rift, the shadow and the two guns (Shadow
//                Gunslinger) and their bullets, Hell Drums' gates and wicked souls
//   RamsfEffect  one-off effects: parryflash, gust, yank, armhit, muzzle, soulgain, pillar, shadowpuff
//   RamsfScreen  the parry's hit, the ult's tag, Ascent of the Master, the burst art
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_ARMS, ULT_NAMES } from './ramsfPlatinum.js';
const clamp01 = v => Math.max(0, Math.min(1, v));
const PORCELAIN = '#f5efe6', PINK = '#f472b6', BLUSH = '#fbcfe8', LAV = '#e9d5ff', HELL = '#f97316', EMBER = '#fdba74', SOUL = '#c084fc', BLOOD = '#dc2626', VOID = '#0c0414';

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
// going f of the way (0..1) to `to`; the elbow bends to get it there, and it goes no further than
// the arm's full stretch. `side`: which side of the cursor it's on (mirrors the pieces).
function DollArm({ x, y, ang, k, to = null, f = 0, ghost = false, seg = 21, side = 1 }) {
  const U = U0 * k * seg / 21, L1 = L1N * U, L2 = L2N * U, HL = 300 * U;
  const S = { x, y }, bend = Math.cos(ang) > 0 ? 1 : -1, flip = side > 0;
  // resting pose
  let a1 = ang, E = at(S, a1, L1), a2 = ang + bend * 0.55, W = at(E, a2, L2), ah = a2 + bend * 0.2;
  if (to && f > 0) {
    const toW = at(to, Math.atan2(to.y - S.y, to.x - S.x) + Math.PI, HL * 0.75);   // the wrist stops short so the hand lands on it
    const T = { x: W.x + (toW.x - W.x) * f, y: W.y + (toW.y - W.y) * f };
    const D = Math.hypot(T.x - S.x, T.y - S.y), a = Math.atan2(T.y - S.y, T.x - S.x);
    if (D >= L1 + L2) {
      // full stretch: straight out
      a1 = a2 = a; E = at(S, a, L1); W = at(E, a, L2);
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
  const open = s.ult.active?.type === 'openarms', n = open ? MAX_ARMS : 0;
  const held = s.player.held, wings = held && !held.ramsf?.drag && s.time - held.t0 > 0.12 && !s.mahoraga;
  const charge = wings ? clamp01((s.time - held.t0 - 0.25) / Math.max(0.01, (sk.full ?? 0.8) - 0.25)) : 0;
  const strings = r.strings?.ids.map(id => s.enemies.find(e => e.id === id)).filter(Boolean) ?? [];
  const g = r.gun;
  return (
    <g>
      {/* Hell Drums' wicked souls (the gates are under the enemies: RamsfGround) */}
      {r.wisps.map(w => <Wisp key={w.id} w={w} k={k} time={time} />)}
      {/* Shadow Gunslinger: your shadow, out among them */}
      {g && <Shadow g={g} k={k} time={time} />}
      {/* the bullets: a streak each */}
      {r.bullets.map(b => {
        const dx = b.x - b.x0, dy = b.y - b.y0, d = Math.hypot(dx, dy) || 1, L = Math.min(d, 46 * k);
        return <line key={b.id} x1={b.x - dx / d * L} y1={b.y - dy / d * L} x2={b.x} y2={b.y} stroke="#fef3c7" strokeWidth={2.6 * k} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #f97316)' }} />;
      })}
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
      {/* his two guns, either side of the cursor, while the shadow is out */}
      {P && g && <Guns P={P} g={g} s={s} k={k} />}
    </g>
  );
}

// ── under the enemies: the rift and the gates (what they drag in stays visible on top) ──
export function RamsfGround({ s, k, time }) {
  const r = s.kit.ramsf, sk = s.stats.skill;
  if (!r || sk?.type !== 'marionette') return null;
  return (
    <g>
      {r.gates && <defs><radialGradient id="rfGateFire"><stop offset="0" stopColor="#fde047" /><stop offset="0.45" stopColor="#dc2626" /><stop offset="1" stopColor="#dc2626" stopOpacity="0" /></radialGradient></defs>}
      {r.gates?.map(gt => <HellGate key={gt.id} gt={gt} k={k} time={time} pullR={(s.stats.ult?.gatePull ?? 230) * k} />)}
      {r.rift && <Rift rf={r.rift} k={k} sk={sk} time={time} />}
    </g>
  );
}

// ── HELLFIRE: the rift, the shadow, the guns, the gates, the souls ───────
function Rift({ rf, k, sk, time }) {
  const R = (sk.riftR ?? 110) * k, open = clamp01(Math.min(rf.t / 0.3, (rf.life - rf.t) / 0.4)), x = rf.x, y = rf.y;
  const h = R * 1.5 * open, w = R * 0.42 * open * (1 + 0.06 * Math.sin(time * 9));
  return (
    <g>
      <circle cx={x} cy={y} r={(sk.riftPull ?? 260) * k} fill="none" stroke={SOUL} strokeOpacity={0.16 * open} strokeWidth={1.5 * k} strokeDasharray={`${3 * k} ${9 * k}`} transform={`rotate(${(-time * 60) % 360} ${x} ${y})`} />
      <ellipse cx={x} cy={y} rx={R} ry={R * 0.3} fill="rgba(88,28,135,0.18)" stroke={SOUL} strokeOpacity={0.35 * open} strokeWidth={1.5 * k} />
      {/* what it's pulling in: motes spiralling toward the tear */}
      {Array.from({ length: 10 }, (_, i) => {
        const f = (time * 0.7 + i / 10) % 1, a = i * 2.4 + time * 2.5 + f * 3, d = R * 1.6 * (1 - f);
        return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.45} r={(1.5 + 2 * f) * k} fill={i % 3 ? SOUL : BLOOD} opacity={open * (0.3 + 0.7 * f)} />;
      })}
      {/* the tear itself: a black slit with a burning edge */}
      <path d={`M${x},${y - h} Q${x + w},${y} ${x},${y + h} Q${x - w},${y} ${x},${y - h} Z`} fill={VOID} stroke="#e879f9" strokeWidth={3 * k} style={{ filter: 'drop-shadow(0 0 10px #a855f7)' }} />
      <path d={`M${x},${y - h * 0.8} Q${x + w * 0.45},${y} ${x},${y + h * 0.8}`} fill="none" stroke={BLOOD} strokeOpacity={0.8} strokeWidth={1.4 * k} />
    </g>
  );
}

// a shadow of the cursor: a black pointer with a burning rim and two red eyes
function Shadow({ g, k, time }) {
  const c = g.clone, fade = clamp01(Math.min(g.t / 0.25, (g.life - g.t) / 0.35)), hit = time - (g.clone.hitT ?? -9) < 0.12;
  const S = 1.5 * k * (hit ? 1.12 : 1), x = c.x, y = c.y;
  const pts = [[0, 0], [0, 22], [5.5, 17], [9.5, 26], [13, 24.5], [9, 16], [16, 16]].map(([px, py]) => `${(x + (px - 6) * S).toFixed(1)},${(y + (py - 13) * S).toFixed(1)}`).join(' ');
  return (
    <g opacity={fade}>
      {/* smoke coming off it */}
      {Array.from({ length: 6 }, (_, i) => {
        const f = (time * 0.9 + i / 6) % 1;
        return <circle key={i} cx={x + Math.sin(i * 2.1 + time * 2) * 10 * k} cy={y - f * 40 * k} r={(4 + 6 * f) * k} fill="#1e1b4b" opacity={0.45 * (1 - f)} />;
      })}
      <ellipse cx={x} cy={y + 20 * k} rx={18 * k} ry={5 * k} fill="#000" opacity={0.35} />
      <polygon points={pts} fill={VOID} stroke="#a855f7" strokeWidth={1.6 * k} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #7c3aed)' }} />
      <circle cx={x - 3.2 * S} cy={y - 3 * S} r={1.3 * S} fill={BLOOD} />
      <circle cx={x + 0.4 * S} cy={y - 1 * S} r={1.3 * S} fill={BLOOD} />
      {hit && <circle cx={x} cy={y} r={30 * k} fill="none" stroke="#a5b4fc" strokeWidth={2 * k} opacity={0.6} />}
    </g>
  );
}

// a pistol, pointing along angle a from (x, y)
function Pistol({ x, y, a, k, kick, flip }) {
  const S = k * 1.6, d = deg(a);
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${d.toFixed(1)}) translate(${(-kick * 6 * S).toFixed(1)} 0) scale(1 ${flip ? -1 : 1})`}>
      <rect x={-4 * S} y={-3 * S} width={20 * S} height={5 * S} rx={1 * S} fill="#1c1917" stroke="#a8a29e" strokeWidth={0.8 * S} />
      <rect x={-4 * S} y={1.5 * S} width={5.5 * S} height={9 * S} rx={1.2 * S} fill="#292524" stroke="#78716c" strokeWidth={0.7 * S} transform={`rotate(14 ${-1.2 * S} ${1.5 * S})`} />
      <rect x={14 * S} y={-2 * S} width={3 * S} height={3 * S} fill={HELL} opacity={0.7} />
    </g>
  );
}
function Guns({ P, g, s, k }) {
  const t = s.enemies.reduce((b, e) => (e.hp > 0 && (!b || Math.hypot(e.x - P.x, e.y - P.y) < Math.hypot(b.x - P.x, b.y - P.y)) ? e : b), null);
  const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : -Math.PI / 2, kick = clamp01(1 - (s.time - (g.recoil ?? -9)) / 0.1);
  return (
    <g>
      <Pistol x={P.x - 22 * k} y={P.y + 6 * k} a={a} k={k} kick={kick} flip={Math.cos(a) < 0} />
      <Pistol x={P.x + 22 * k} y={P.y + 6 * k} a={a} k={k} kick={kick} flip={Math.cos(a) < 0} />
    </g>
  );
}

// a hell gate: a burning ring of runes that beats like a drum
function HellGate({ gt, k, time, pullR }) {
  if (gt.t < 0) return null;
  const open = clamp01(gt.t / 0.4), beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * 1.6)), 6), R = 46 * k * open * (1 + 0.08 * beat), x = gt.x, y = gt.y;
  return (
    <g>
      <circle cx={x} cy={y} r={pullR} fill="none" stroke={HELL} strokeOpacity={0.12 + 0.12 * beat} strokeWidth={1.5 * k} strokeDasharray={`${4 * k} ${10 * k}`} transform={`rotate(${(time * 40) % 360} ${x} ${y})`} />
      <circle cx={x} cy={y} r={R * 1.25} fill="rgba(124,45,18,0.25)" />
      <circle cx={x} cy={y} r={R * 1.08} fill="none" stroke="#ea580c" strokeOpacity={0.35} strokeWidth={10 * k} />
      <circle cx={x} cy={y} r={R} fill={VOID} stroke={HELL} strokeWidth={4 * k} />
      <circle cx={x} cy={y} r={R * 0.72} fill="none" stroke={BLOOD} strokeWidth={2 * k} strokeDasharray={`${3 * k} ${4 * k}`} transform={`rotate(${(-time * 120) % 360} ${x} ${y})`} />
      {/* the runes round the rim */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = i / 8 * Math.PI * 2 + time * 0.8, rx = x + Math.cos(a) * R * 1.12, ry = y + Math.sin(a) * R * 1.12;
        return <path key={i} d={`M${rx - 3 * k},${ry - 3 * k} L${rx + 3 * k},${ry + 3 * k} M${rx + 3 * k},${ry - 3 * k} L${rx},${ry + 4 * k}`} stroke={EMBER} strokeWidth={1.4 * k} opacity={0.8} />;
      })}
      {/* the fire inside */}
      <circle cx={x} cy={y} r={R * 0.55 * (1 + 0.3 * beat)} fill="url(#rfGateFire)" opacity={0.6 + 0.4 * beat} />
    </g>
  );
}

// a wicked soul: a violet flame with a tail, and a face
function Wisp({ w, k, time }) {
  const sp = Math.hypot(w.vx, w.vy) || 1, ux = w.vx / sp, uy = w.vy / sp, L = 16 * k, r0 = 5.5 * k;
  return (
    <g>
      <path d={`M${w.x - ux * L * 2.2},${w.y - uy * L * 2.2} Q${w.x - ux * L - uy * r0 * 1.4},${w.y - uy * L + ux * r0 * 1.4} ${w.x - uy * r0},${w.y + ux * r0} L${w.x + uy * r0},${w.y - ux * r0} Q${w.x - ux * L + uy * r0 * 1.4},${w.y - uy * L - ux * r0 * 1.4} ${w.x - ux * L * 2.2},${w.y - uy * L * 2.2} Z`}
        fill={SOUL} opacity={0.55} />
      <circle cx={w.x} cy={w.y} r={r0 * 1.9} fill="#a855f7" opacity={0.25} />
      <circle cx={w.x} cy={w.y} r={r0 * (1 + 0.15 * Math.sin(time * 20 + w.id))} fill="#f5d0fe" />
      <circle cx={w.x - uy * 2 * k + ux * 1.5 * k} cy={w.y + ux * 2 * k + uy * 1.5 * k} r={1 * k} fill={VOID} />
      <circle cx={w.x + uy * 2 * k + ux * 1.5 * k} cy={w.y - ux * 2 * k + uy * 1.5 * k} r={1 * k} fill={VOID} />
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
  if (f.kind === 'muzzle') {
    const c = Math.cos(f.a), sn = Math.sin(f.a), L = 18 * k * (1 - p * 0.5);
    return (
      <g opacity={o}>
        <path d={`M${f.x - sn * 4 * k},${f.y + c * 4 * k} L${f.x + c * L},${f.y + sn * L} L${f.x + sn * 4 * k},${f.y - c * 4 * k} Z`} fill="#fef3c7" style={{ filter: 'drop-shadow(0 0 5px #f97316)' }} />
        <circle cx={f.x} cy={f.y} r={5 * k} fill={HELL} />
      </g>
    );
  }
  if (f.kind === 'soulgain') {
    // a soul flying from what died to you
    const q = p * p * (3 - 2 * p), x = f.x1 + (f.x2 - f.x1) * q, y = f.y1 + (f.y2 - f.y1) * q - Math.sin(p * Math.PI) * 60 * k;
    return (
      <g>
        <circle cx={x} cy={y} r={7 * k} fill={EMBER} opacity={1 - p * 0.3} style={{ filter: 'drop-shadow(0 0 8px #f97316)' }} />
        {p > 0.85 && <circle cx={f.x2} cy={f.y2} r={(10 + 40 * (p - 0.85) / 0.15) * k} fill="none" stroke={HELL} strokeWidth={2.5 * k} opacity={(1 - p) * 6} />}
      </g>
    );
  }
  if (f.kind === 'pillar') {
    // hellfire straight down onto it
    const w = (f.big ? 1.6 : 1) * f.r * (1 - p * 0.4), H = 1400 * k, top = f.y - H;
    return (
      <g opacity={o}>
        <rect x={f.x - w / 2} y={top} width={w} height={H} fill={`url(#rfPillar)`} />
        <rect x={f.x - w * 0.18} y={top} width={w * 0.36} height={H} fill="#fff7ed" opacity={0.85} />
        <ellipse cx={f.x} cy={f.y} rx={w * 1.1} ry={w * 0.35} fill={HELL} opacity={0.8} />
        <defs><linearGradient id="rfPillar" x1="0" x2="1"><stop offset="0" stopColor={BLOOD} stopOpacity="0" /><stop offset="0.5" stopColor={HELL} /><stop offset="1" stopColor={BLOOD} stopOpacity="0" /></linearGradient></defs>
      </g>
    );
  }
  if (f.kind === 'shadowpuff') {
    const R = f.r * (0.4 + 0.6 * Math.min(1, p * 2));
    return (
      <g opacity={o}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = i / 7 * Math.PI * 2 + f.id;
          return <circle key={i} cx={f.x + Math.cos(a) * R * 0.6} cy={f.y + Math.sin(a) * R * 0.6} r={R * 0.38} fill={f.color ?? VOID} opacity={0.55} />;
        })}
        <circle cx={f.x} cy={f.y} r={R} fill="none" stroke={f.color === '#1e1b4b' ? '#a855f7' : f.color ?? SOUL} strokeWidth={2 * k} />
      </g>
    );
  }
  return null;
}

// ── on the screen ────────────────────────────────────────────────────────
export function RamsfScreen({ s, mainCard, mobile }) {
  const r = s.kit.ramsf;
  if (!r || s.stats.skill?.type !== 'marionette') return null;
  const act = s.ult.active, mine = act && (act.type === 'openarms' || act.type === 'helldrums' || act.type === 'ascent') ? act : null;
  const hit = r.lastParry ? s.time - r.lastParry.t : 9;
  return (
    <>
      {/* the impact frame: while the hitstop holds, everything goes stark */}
      {r.hitstop > 0 && <div className={`rf-impact${r.streak >= 3 ? ' big' : ''}`} />}
      {hit < 0.22 && <div className="rf-parry-hit" style={{ opacity: 1 - hit / 0.22 }} />}
      {mine?.type === 'openarms' && !r.cutin && <div className="rf-open" />}
      {mine?.type === 'helldrums' && !r.cutin && <div className="rf-drums" />}
      {mine?.type === 'ascent' && !r.cutin && <Ascent act={mine} time={s.time} />}
      {mine && !r.cutin && <div className={`rf-tag lv${mine.lv ?? 1}`} style={mobile ? { top: '24%' } : undefined}>{ULT_NAMES[mine.lv ?? 1]} · {Math.max(0, mine.t).toFixed(1)}s</div>}
      {r.cutin && <RfCutIn c={r.cutin} card={mainCard} mobile={mobile} />}
    </>
  );
}

// Ascent of the Master: the sky tears open on a vast burning eye, and the light comes down
function Ascent({ act, time }) {
  const into = clamp01((act.dur - act.t - 1.1) / 0.6), out = clamp01(act.t / 0.5), o = into * out;
  const lid = clamp01((act.dur - act.t - 1.3) / 0.8);   // the eye opens
  return (
    <div className="rf-ascent" style={{ opacity: o }}>
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMin slice" width="100%" height="100%">
        <defs>
          <radialGradient id="rfIris" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff7ed" /><stop offset="0.25" stopColor="#fde047" /><stop offset="0.6" stopColor="#ea580c" /><stop offset="1" stopColor="#450a0a" /></radialGradient>
          <clipPath id="rfLid"><path d={`M260,120 Q500,${120 - 110 * lid} 740,120 Q500,${120 + 110 * lid} 260,120 Z`} /></clipPath>
        </defs>
        {/* the tear in the sky */}
        <path d="M120,130 L260,108 L330,140 L420,96 L500,126 L590,92 L680,138 L760,110 L880,128 L760,150 L680,170 L590,150 L500,176 L420,148 L330,172 L260,150 Z" fill="#0c0414" stroke="#ea580c" strokeWidth="5" style={{ filter: 'drop-shadow(0 0 14px #f97316)' }} />
        {/* the eye */}
        <g clipPath="url(#rfLid)">
          <rect x="250" y="0" width="500" height="260" fill="#1c0606" />
          <circle cx={500 + Math.sin(time * 1.3) * 26} cy="120" r="78" fill="url(#rfIris)" />
          <ellipse cx={500 + Math.sin(time * 1.3) * 26} cy="120" rx="11" ry="56" fill="#0c0414" />
        </g>
        <path d={`M260,120 Q500,${120 - 110 * lid} 740,120 Q500,${120 + 110 * lid} 260,120 Z`} fill="none" stroke="#fdba74" strokeWidth="4" />
        {/* embers falling out of it */}
        {Array.from({ length: 18 }, (_, i) => {
          const f = (time * 0.35 + i / 18) % 1;
          return <circle key={i} cx={180 + (i * 137) % 660 + Math.sin(time * 2 + i) * 14} cy={140 + f * 480} r={2 + (i % 3)} fill={i % 2 ? '#f97316' : '#fde047'} opacity={1 - f} />;
        })}
      </svg>
    </div>
  );
}

// The burst art: a ring of his arms closes over the screen like a curtain, then opens on him
function RfCutIn({ c, card, mobile }) {
  const lv = c.lv ?? 1;
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
        <div className="small">HELLFIRE STYLE · OBEY YOUR MASTER</div>
        <div className={`big lv${lv}`}>{ULT_NAMES[lv]}</div>
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
  .rf-drums { position:absolute; inset:0; z-index:10; pointer-events:none; box-shadow: inset 0 0 120px rgba(234,88,12,0.6); animation: rf-drum 0.625s ease-out infinite; will-change: opacity; }
  @keyframes rf-drum { 0% { opacity: 1; } 100% { opacity: 0.45; } }   /* (opacity only: an animated box-shadow repaints the whole screen every frame) */
  .rf-ascent { position:absolute; inset:0; z-index:11; pointer-events:none; overflow:hidden;
    background: radial-gradient(ellipse at 50% 18%, rgba(127,29,29,0.25) 0%, rgba(69,10,10,0.55) 60%, rgba(12,4,20,0.75) 100%); }
  .rf-tag.lv2 { color:#ffedd5; text-shadow: 0 0 10px #ea580c, 0 2px 0 #431407; }
  .rf-tag.lv3 { color:#fee2e2; text-shadow: 0 0 12px #dc2626, 0 2px 0 #450a0a; }
  .rf-cutin-text .big.lv2 { text-shadow: 0 3px 0 #431407, 0 0 18px rgba(249,115,22,0.95); }
  .rf-cutin-text .big.lv3 { color:#fee2e2; text-shadow: 0 3px 0 #450a0a, 0 0 22px rgba(220,38,38,1); }
  .rf-tag { position:absolute; left:50%; top:12%; transform:translateX(-50%); z-index:13; pointer-events:none; font-family: var(--font-hit, sans-serif);
    color:#fdf2f8; font-size: clamp(14px, 2.2vw, 22px); letter-spacing: 4px; text-shadow: 0 0 10px #db2777, 0 2px 0 #3b0a24; white-space:nowrap; }
  .rf-cutin { position:absolute; inset:0; z-index:16; pointer-events:none; overflow:hidden; container-type:inline-size; }
  .rf-cutin-iris { position:absolute; inset:0; background: radial-gradient(circle at 50% 46%, #451a03 0%, #1c0606 55%, #0c0414 80%);
    box-shadow: inset 0 0 0 3px #fdba74, inset 0 0 60px rgba(234,88,12,0.6); }
  .rf-cutin-face { position:absolute; left:50%; top:46%; height:240%; width:auto; max-width:none; filter: contrast(1.1) drop-shadow(0 0 12px #ea580c); }
  .rf-cutin-text { position:absolute; left:0; right:0; bottom:9%; text-align:center; }
  .rf-cutin-text .small { font-family: var(--font-ui, monospace); color:#fdba74; letter-spacing: 0.45em; font-size: clamp(10px, 1.6cqw, 16px); text-shadow: 0 0 6px #000; }
  .rf-cutin-text .big { font-family: var(--font-hit, serif); font-size: clamp(30px, 7cqw, 80px); line-height:1; letter-spacing: 0.06em; color:#fdf2f8;
    text-shadow: 0 3px 0 #431407, 0 0 18px rgba(249,115,22,0.9); }
`;
