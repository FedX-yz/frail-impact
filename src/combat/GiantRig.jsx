// The RED GIANT, drawn in pieces from his layered art (giantRig.js, made by tools/build-giant.py):
// body, head, eight pupils, and two arms (upper arm → forearm → hand; the right one is the left
// mirrored). Everything is placed in the rig's art units inside one box that's scaled onto the
// arena (the engine's giantLayout). The art's own pose is the starting point; from there he
// moves through his idle poses (giantIdle.js) and reaches out to attack.
//
//   · his arms bend to reach his hands (shoulder → elbow → wrist, within what real joints allow:
//     giantArm.js). The hands are enemies of their own (engine.js); each one is drawn here, on
//     the end of its arm.
//   · he breathes; his head sways and leans toward you
//   · every pupil looks around on its own, darting like in the reference, mostly at you; they
//     all lock onto you and dilate before the eye bolts, and turn red once he's mad
import { useRef } from 'react';
import { GIANT_RIG as R } from './giantRig';
import { giantIdlePose } from './giantIdle';
import { ARMS, solveArm, armPieces, sub } from './giantArm';

const BASE = import.meta.env.BASE_URL;
const src = f => `${BASE}${f}`;   // (paths inside public/)
const RAD = Math.PI / 180;

// Pose an arm so its hand's centre lands on `target` (art units), from shoulder S, within what
// his joints allow (giantArm.js). Returns where its pieces go.
function poseArm(sd, S, target, mem, twist = 0) {
  return armPieces(sd, solveArm(sd, S, target, twist, mem));
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
// far: he's far away behind the city (dark, eyes lit, nobody fighting him: his hands follow his idle poses)
const FAR = 'brightness(0.4) saturate(1.15)';
// still: he doesn't move at all (only his eyes can); noArms: just his body and head
// state.dip: he bends forward this much (art units: shoulders and head go down with it)
// shade: a filter for his skin only (not his eyes); eyesLit: how lit each eye's glow is (0..1),
// instead of the fight's open/closed glows; front: 'l' / 'r' / 'both' draws that arm (or both) over his face
// layer: 'arm' = only his `arm` side's arm, 'back' = everything but it — two of them with the same
// props draw him split (his body behind the fight, that arm in front) with one and the same pose
const REST = { l: R.arms.l.hand.c, r: R.arms.r.hand.c, twist: { l: 0, r: 0 }, head: [0, 0], tilt: 0, body: [0, 0] };
export function GiantRig({ L, t, look, hands = {}, state = {}, dim, far = false, still = false, noArms = false, layer = 'all', arm = 'l', shade = null, eyesLit = null, front = null }) {
  const mem = useRef({ l: {}, r: {} }).current;   // which way each elbow is bent
  const toArt = p => [(p.x - L.left) / L.sc, (p.y - L.top) / L.sc];
  const idle = still ? REST : giantIdlePose(t, state.mad);   // (the engine rests his hands on the same poses)
  const breath = still ? 0 : Math.sin(t * 1.5);
  const lift = breath * 5;                            // shoulders and head rise as he breathes in (with the chest)
  // (lean: he shifts his weight toward a hand that's attacking: engine.js → placeGiant)
  const wl = state.lean ?? 0, dip = state.dip ?? 0, bx = idle.body[0] + wl, by = idle.body[1] + Math.abs(wl) * 0.25 + dip;
  const P = look ? toArt(look) : null;
  // the head: follows the body and the pose, sways, leans a little toward you
  const hd = R.head, pv = hd.pivot;
  const lean = P ? Math.max(-4, Math.min(4, (P[0] - pv[0]) / 60)) : 0;
  const headRot = still ? (state.laugh ? Math.sin(t * 22) * 2.5 : 0) + wl * 0.3 : Math.sin(t * 0.9) * 1.2 + idle.tilt + wl * 0.3 + lean + (state.mad ? Math.sin(t * 13) * 0.6 : 0) + (state.laugh ? Math.sin(t * 22) * 2.5 : 0);
  const headDx = bx + idle.head[0], headDy = by + idle.head[1] - lift + (state.warn ? -3 : 0);
  // the arms
  const arms = {};
  for (const sd of ['l', 'r']) {
    const A = ARMS[sd], h = hands[sd];
    const S = [A.S[0] + bx, A.S[1] + by - lift];
    arms[sd] = { pose: poseArm(sd, S, h?.at ? toArt(h.at) : idle[sd], mem[sd], idle.twist[sd]), h };
  }
  const dimmed = f => (far ? `${FAR}${f ? ` ${f}` : ''}` : shade ? `${shade}${f ? ` ${f}` : ''}` : f);
  const handFilter = h => dimmed(h?.down ? 'brightness(0.45) saturate(0.6)' : h?.hurt ? 'brightness(1.9)' : h?.frozen ? 'grayscale(1) brightness(1.45) sepia(1) hue-rotate(165deg) saturate(1.9)' : undefined);
  const armFilter = h => dimmed(h?.down ? 'brightness(0.6) saturate(0.7)' : undefined);
  const parts = {
    body: <img key="body" src={src(R.body.src)} alt="" draggable={false} className="giant-piece"
      style={{ left: R.body.c[0] - R.body.w / 2 + bx, top: R.body.c[1] - R.body.h / 2 + by, width: R.body.w, height: R.body.h, filter: dimmed(),
        transformOrigin: '50% 100%', transform: `scale(${1 + breath * 0.006}, ${1 + breath * 0.012})` }} />,
  };
  for (const sd of noArms ? [] : ['l', 'r']) {
    const { pose, h } = arms[sd];
    parts[`${sd}upper`] = <Piece key={`${sd}u`} {...pose.upper} filter={armFilter(h)} />;
    parts[`${sd}lower`] = <Piece key={`${sd}l`} {...pose.lower} filter={armFilter(h)} />;
    parts[`${sd}hand`] = <Piece key={`${sd}h`} {...pose.hand} filter={handFilter(h)} />;
  }
  // the head, its pupils, and the glow in its eyes
  const hx = hd.c[0] - hd.w / 2, hy = hd.c[1] - hd.h / 2;
  const rate = state.mad ? 2.4 : 1.3;
  parts.head = (
    <div key="head" className="giant-head" style={{ left: hx + headDx, top: hy + headDy, width: hd.w, height: hd.h,
      transformOrigin: `${pv[0] - hx}px ${pv[1] - hy}px`, transform: `rotate(${headRot.toFixed(2)}deg)`,
      filter: state.hit ? 'brightness(1.6)' : undefined }}>
      <img src={src(hd.src)} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: dimmed() }} />
      {R.eyes.map((e, i) => {
        // mostly at you, darting around it (locked on you before the bolts)
        let o = [0, 0];
        if (P) { const d = sub(P, e.c), n = Math.hypot(...d) || 1, k = Math.min(1, n / (far ? 120 : 260)); o = [d[0] / n * k, d[1] / n * k]; }
        // (far away he just stares at you: only a flicker of darting)
        const [kl, kd] = far ? [1, 0.2] : [0.55, 0.7];
        if (!state.warn && !(still && !P)) { const j = dart(i, t, rate); o = [o[0] * kl + j[0] * kd, o[1] * kl + j[1] * kd]; }
        const m = Math.hypot(...o); if (m > 1) o = [o[0] / m, o[1] / m];
        const sc = state.warn ? 1.28 : state.mad ? 0.85 : 1;
        return (
          <img key={i} src={src(e.src)} alt="" draggable={false} className={`giant-pupil${state.mad ? ' mad' : ''}`}
            style={{ left: e.c[0] - hx - e.w / 2 + o[0] * e.look * (far ? 1.25 : 1), top: e.c[1] - hy - e.h / 2 + o[1] * e.look * (far ? 1.25 : 1), width: e.w, height: e.h,
              transform: sc !== 1 ? `scale(${sc})` : undefined }} />
        );
      })}
      <svg viewBox={`0 0 ${hd.w} ${hd.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {R.eyes.map((e, i) => (
          <circle key={i} className={`giant-eye${far ? ' far' : ''}${eyesLit ? '' : state.warn ? ' warn' : state.open || far ? ' open' : ''}${state.mad ? ' mad' : ''}${state.hit ? ' hit' : ''}`}
            style={eyesLit ? { opacity: eyesLit[i] ?? 0, transition: 'none' } : undefined}
            cx={e.c[0] - hx} cy={e.c[1] - hy} r={(e.big ? 36 : 17) * (eyesLit ? 1.35 : 1)} fill={`url(#${state.mad ? 'giantEyeMad' : 'giantEye'})`} />
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
      {(layer === 'arm' ? [`${arm}upper`, `${arm}lower`, `${arm}hand`] : layer === 'back' ? R.order.filter(k => !k.startsWith(arm) || k === 'body')
        : front ? [...R.order.filter(k => k === 'body' || k === 'head' || !(front === 'both' || k.startsWith(front))), ...(front === 'both' ? ['l', 'r'] : [front]).flatMap(sd => [`${sd}upper`, `${sd}lower`, `${sd}hand`])] : R.order).map(k => parts[k] ?? null)}
    </div>
  );
}

export const GIANT_RIG_CSS = `
  .giant-rig { position:absolute; left:0; top:0; z-index:5; pointer-events:none; transform-origin:0 0; }
  .giant-rig img { max-width:none; max-height:none; }
  .giant-piece { position:absolute; }
  .giant-head { position:absolute; }
  .giant-pupil { position:absolute; transition: transform 0.15s; }
  .giant-eye.far.open { opacity:0.4; animation:none; }
  .giant-pupil.mad { filter: hue-rotate(-95deg) saturate(2.2) brightness(1.1); }
`;
