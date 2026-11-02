// The RED GIANT, drawn in pieces from his layered art (giantRig.js, made by tools/build-giant.py):
// body, head, eight pupils, and two arms (upper arm → forearm → hand; the right one is the left
// mirrored). Everything is placed in the rig's art units inside one box that's scaled onto the
// arena (the engine's giantLayout), so the resting pose is exactly the friend's reference.
//
//   · his arms bend to reach his hands (two-bone IK: shoulder → elbow → wrist). The hands are
//     enemies of their own (engine.js); each one is drawn here, on the end of its arm.
//   · he breathes; his head sways and leans toward you
//   · every pupil looks around on its own, darting like in the reference, mostly at you; they
//     all lock onto you and dilate before the eye bolts, and turn red once he's mad
import { useRef } from 'react';
import { GIANT_RIG as R } from './giantRig';

const BASE = import.meta.env.BASE_URL;
const src = f => `${BASE}${f}`;   // (paths inside public/)
const RAD = Math.PI / 180;
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// each arm at rest: its bones' lengths and angles, and which way the elbow bends
const ARMS = Object.fromEntries(['l', 'r'].map(sd => {
  const a = R.arms[sd], u = sub(a.E, a.S), w = sub(a.W, a.S);
  return [sd, { ...a, L1: len(a.S, a.E), L2: len(a.E, a.W), up0: ang(a.S, a.E), lo0: ang(a.E, a.W), bend: Math.sign(u[0] * w[1] - u[1] * w[0]) }];
}));

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const HAND_FOLLOW = 0.5;   // the hand turns half as much as the forearm (it stays more upright)
// Pose an arm so its hand's centre lands on `target` (art units), from shoulder S. The elbow goes
// on whichever side keeps it low and out from his body (staying on the side it was on unless the
// other is clearly better, so it doesn't flip back and forth). Returns where its pieces go.
function poseArm(sd, S, target, mem) {
  const A = ARMS[sd], handOff = sub(A.hand.c, A.W), out = sd === 'l' ? -1 : 1;
  let dH = 0, dLo = 0, E = A.E, W = A.W, bend = mem.bend ?? A.bend;
  for (let i = 0; i < 3; i++) {   // (the wrist depends on how the hand is turned: settle it)
    const want = sub(target, rot(handOff, dH));
    let d = len(S, want);
    const maxD = A.L1 + A.L2 - 0.5, minD = Math.abs(A.L1 - A.L2) + 1;
    const base = ang(S, want);
    d = Math.min(maxD, Math.max(minD, d));
    const k = Math.acos(Math.max(-1, Math.min(1, (A.L1 * A.L1 + d * d - A.L2 * A.L2) / (2 * A.L1 * d))));
    let best = -Infinity;
    for (const b of [1, -1]) {
      const ua = base - b * k, e = [S[0] + Math.cos(ua) * A.L1, S[1] + Math.sin(ua) * A.L1];
      const score = (e[1] - S[1]) + (e[0] - S[0]) * out * 0.3 + (b === A.bend ? 120 : 0) + (b === (mem.bend ?? A.bend) ? 60 : 0);
      if (score > best) { best = score; E = e; bend = b; }
    }
    W = [S[0] + Math.cos(base) * d, S[1] + Math.sin(base) * d];
    dLo = wrap(ang(E, W) - A.lo0); dH = dLo * HAND_FOLLOW;
  }
  mem.bend = bend;
  const dUp = wrap(ang(S, E) - A.up0);
  const place = (p, origin0, origin, dA) => ({ p, c: add(origin, rot(sub(p.c, origin0), dA)), r: p.rot + dA / RAD });
  return { upper: place(A.upper, A.S, S, dUp), lower: place(A.lower, A.E, E, dLo), hand: place(A.hand, A.W, W, dH) };
}

function Piece({ p, c, r, filter, extra = '' }) {
  return (
    <img src={src(p.src)} alt="" draggable={false} className="giant-piece"
      style={{ left: c[0] - p.w / 2, top: c[1] - p.h / 2, width: p.w, height: p.h, filter,
        transform: `rotate(${r.toFixed(2)}deg)${p.flip ? ' scaleX(-1)' : ''}${extra}` }} />
  );
}

// a pupil's darting: a new spot every so often, snapped to quickly (like the reference)
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function dart(i, t, rate) {
  const ph = hash(i + 1) * 10, v = t * rate * (0.7 + hash(i + 7) * 0.6) + ph, n = Math.floor(v), f = v - n;
  const at = m => { const a = hash(m * 3.1 + i * 17) * Math.PI * 2, r = Math.sqrt(hash(m * 5.7 + i * 31)); return [Math.cos(a) * r, Math.sin(a) * r]; };
  const p0 = at(n - 1), p1 = at(n), e = Math.min(1, f * 6), s = e * e * (3 - 2 * e);
  return [p0[0] + (p1[0] - p0[0]) * s, p0[1] + (p1[1] - p0[1]) * s];
}

// L: the layout (left, top, sc); t: time; look: your cursor in arena px (or null);
// hands: { l, r } hand centres in arena px (null = at rest) and their state;
// state: open (his head can be hit) / warn (eye bolts coming) / mad / hit; dim: a filter for all of him
export function GiantRig({ L, t, look, hands = {}, state = {}, dim }) {
  const mem = useRef({ l: {}, r: {} }).current;   // which way each elbow is bent
  const toArt = p => [(p.x - L.left) / L.sc, (p.y - L.top) / L.sc];
  const breath = Math.sin(t * 1.5);
  const lift = breath * 5;                            // shoulders and head rise as he breathes in (with the chest)
  const P = look ? toArt(look) : null;
  // the head: sways, leans a little toward you
  const hd = R.head, pv = hd.pivot;
  const lean = P ? Math.max(-4, Math.min(4, (P[0] - pv[0]) / 60)) : 0;
  const headRot = Math.sin(t * 0.9) * 1.2 + lean + (state.mad ? Math.sin(t * 13) * 0.6 : 0);
  const headDy = -lift + (state.warn ? -3 : 0);
  // the arms
  const arms = {};
  for (const sd of ['l', 'r']) {
    const A = ARMS[sd], h = hands[sd];
    const S = [A.S[0], A.S[1] - lift];
    arms[sd] = { pose: poseArm(sd, S, h?.at ? toArt(h.at) : add(A.hand.c, [0, -lift]), mem[sd]), h };
  }
  const handFilter = h => (h?.down ? 'brightness(0.45) saturate(0.6)' : h?.hurt ? 'brightness(1.9)' : h?.frozen ? 'grayscale(1) brightness(1.45) sepia(1) hue-rotate(165deg) saturate(1.9)' : undefined);
  const armFilter = h => (h?.down ? 'brightness(0.6) saturate(0.7)' : undefined);
  const parts = {
    body: <img key="body" src={src(R.body.src)} alt="" draggable={false} className="giant-piece"
      style={{ left: R.body.c[0] - R.body.w / 2, top: R.body.c[1] - R.body.h / 2, width: R.body.w, height: R.body.h,
        transformOrigin: '50% 100%', transform: `scale(${1 + breath * 0.006}, ${1 + breath * 0.012})` }} />,
  };
  for (const sd of ['l', 'r']) {
    const { pose, h } = arms[sd];
    parts[`${sd}upper`] = <Piece key={`${sd}u`} {...pose.upper} filter={armFilter(h)} />;
    parts[`${sd}lower`] = <Piece key={`${sd}l`} {...pose.lower} filter={armFilter(h)} />;
    parts[`${sd}hand`] = <Piece key={`${sd}h`} {...pose.hand} filter={handFilter(h)} />;
  }
  // the head, its pupils, and the glow in its eyes
  const hx = hd.c[0] - hd.w / 2, hy = hd.c[1] - hd.h / 2;
  const rate = state.mad ? 2.4 : 1.3;
  parts.head = (
    <div key="head" className="giant-head" style={{ left: hx, top: hy + headDy, width: hd.w, height: hd.h,
      transformOrigin: `${pv[0] - hx}px ${pv[1] - hy}px`, transform: `rotate(${headRot.toFixed(2)}deg)`,
      filter: state.hit ? 'brightness(1.6)' : undefined }}>
      <img src={src(hd.src)} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {R.eyes.map((e, i) => {
        // mostly at you, darting around it (locked on you before the bolts)
        let o = [0, 0];
        if (P) { const d = sub(P, e.c), n = Math.hypot(...d) || 1, k = Math.min(1, n / 260); o = [d[0] / n * k, d[1] / n * k]; }
        if (!state.warn) { const j = dart(i, t, rate); o = [o[0] * 0.55 + j[0] * 0.7, o[1] * 0.55 + j[1] * 0.7]; }
        const m = Math.hypot(...o); if (m > 1) o = [o[0] / m, o[1] / m];
        const sc = state.warn ? 1.28 : state.mad ? 0.85 : 1;
        return (
          <img key={i} src={src(e.src)} alt="" draggable={false} className={`giant-pupil${state.mad ? ' mad' : ''}`}
            style={{ left: e.c[0] - hx - e.w / 2 + o[0] * e.look, top: e.c[1] - hy - e.h / 2 + o[1] * e.look, width: e.w, height: e.h,
              transform: sc !== 1 ? `scale(${sc})` : undefined }} />
        );
      })}
      <svg viewBox={`0 0 ${hd.w} ${hd.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {R.eyes.map((e, i) => (
          <circle key={i} className={`giant-eye${state.warn ? ' warn' : state.open ? ' open' : ''}${state.mad ? ' mad' : ''}${state.hit ? ' hit' : ''}`}
            cx={e.c[0] - hx} cy={e.c[1] - hy} r={e.big ? 36 : 17} fill={`url(#${state.mad ? 'giantEyeMad' : 'giantEye'})`} />
        ))}
      </svg>
    </div>
  );
  return (
    <div className="giant-rig" style={{ width: R.size[0], height: R.size[1], transform: `translate(${L.left}px, ${L.top}px) scale(${L.sc})`, filter: dim }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="giantEye"><stop offset="0%" stopColor="#f7ffd6" stopOpacity="0.95" /><stop offset="45%" stopColor="#bef264" stopOpacity="0.55" /><stop offset="100%" stopColor="#84cc16" stopOpacity="0" /></radialGradient>
          <radialGradient id="giantEyeMad"><stop offset="0%" stopColor="#fff1f2" stopOpacity="0.95" /><stop offset="45%" stopColor="#f43f5e" stopOpacity="0.6" /><stop offset="100%" stopColor="#be123c" stopOpacity="0" /></radialGradient>
        </defs>
      </svg>
      {R.order.map(k => parts[k])}
    </div>
  );
}

export const GIANT_RIG_CSS = `
  .giant-rig { position:absolute; left:0; top:0; z-index:5; pointer-events:none; transform-origin:0 0; }
  .giant-rig img { max-width:none; max-height:none; }
  .giant-piece { position:absolute; }
  .giant-head { position:absolute; }
  .giant-pupil { position:absolute; transition: transform 0.15s; }
  .giant-pupil.mad { filter: hue-rotate(-95deg) saturate(2.2) brightness(1.1); }
`;
