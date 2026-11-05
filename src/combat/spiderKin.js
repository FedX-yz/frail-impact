// DADDY HAIRY LEGS's body and eight legs: where everything is, in arena pixels.
// The engine moves the body (rig.x, rig.y: the centre of his head) and this walks the legs:
// each foot stays planted until the body has moved too far from it, then it steps (quickly:
// he's fast), a few legs at a time, alternating like a real spider's gait. Each leg is two
// bones (hip → knee → wrist, the knee bending up and away from his body), with the hand on the
// end. A broken leg folds up against him. An attack can take over a leg (leg.reach = where its
// wrist should go). Used for the boss, the spider that ambushes you in the stages before him,
// and (small) his spiderlings. SpiderRig.jsx draws it.
//
// Art units: his reference picture (spiderArt.js); rig.sc = arena pixels per art unit.
import { SPIDER_ART } from './spiderArt';

const PC = SPIDER_ART.pieces, EX = SPIDER_ART.ex;   // EX: exported-picture px per art unit
const plen = p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) / EX;   // a piece's bone length (art units)

// left side, front (0) to back (3), from the head's centre (art units); the right side mirrors
export const LEGS = [
  { hip: [-330, 190], rest: [-540, 660] },
  { hip: [-420, 90], rest: [-1150, 520] },
  { hip: [-450, -20], rest: [-1220, 20] },
  { hip: [-400, -150], rest: [-960, -560] },
];
// legs in the same gait group step together (and never with the other group)
const GROUP = (side, idx) => ((idx + (side < 0 ? 0 : 1)) % 2);

// which pictures each leg is built from (alternating, so the eight don't all look the same)
function legPieces(side, idx) {
  const natural = idx % 2 === 0, left = side < 0;
  const femur = left === natural ? 'femurL' : 'femurR', tibia = left === natural ? 'tibiaL' : 'tibiaR';
  return {
    femur: { name: femur, flip: !natural }, tibia: { name: tibia, flip: !natural },
    hand: { name: idx % 2 ? 'handB' : 'handA', flip: left },
    knee: { name: 'knee', flip: left }, socket: { name: idx % 2 ? 'socketA' : 'socketB', flip: false },
  };
}

export function makeSpiderRig(x, y, sc, opts = {}) {
  const legs = [];
  for (const side of [-1, 1]) {
    LEGS.forEach((L, idx) => {
      const pieces = legPieces(side, idx);
      const leg = {
        side, idx, group: GROUP(side, idx), pieces,
        L1: plen(PC[pieces.femur.name]), L2: plen(PC[pieces.tibia.name]), LH: plen(PC[pieces.hand.name]),
        // (the table is for the left side: mirror x for the right)
        hipA: [side < 0 ? L.hip[0] : -L.hip[0], L.hip[1]], restA: [side < 0 ? L.rest[0] : -L.rest[0], L.rest[1]],
        foot: null, step: null, broken: false, reach: null, rate: 0,
        hip: null, knee: null, wrist: null, hdir: [0, 1], bend: 0,
      };
      legs.push(leg);
    });
  }
  const r = { x, y, sc, vx: 0, vy: 0, legs, rear: 0, jaw: 0, bob: 0, curl: opts.curl ?? 0, stepDur: opts.stepDur ?? 0.12, t: 0 };
  for (const leg of legs) leg.foot = home(r, leg);
  poseSpider(r, 0);
  return r;
}

const at = (r, a) => ({ x: r.x + a[0] * r.sc, y: r.y + (a[1] - r.rear * 140) * r.sc });   // (rearing up lifts his body)
const home = (r, leg) => ({ x: r.x + leg.restA[0] * r.sc, y: r.y + leg.restA[1] * r.sc });
// folded up against his body (broken, or curled up while he drops in / dies)
const folded = (r, leg) => at(r, [leg.hipA[0] * 1.55, leg.hipA[1] + 210 - leg.idx * 40]);

// Walk the legs. dt: seconds.
export function poseSpider(r, dt) {
  r.t += dt;
  const stepping = r.legs.filter(l => l.step).length;
  const moving = Math.hypot(r.vx, r.vy) > 30 * r.sc;
  // a little bob as he scuttles
  r.bob = moving ? Math.sin(r.t * 28) * 10 : r.bob * Math.exp(-dt * 8);
  for (const leg of r.legs) {
    const hip = at(r, leg.hipA);
    hip.y += r.bob * r.sc;
    leg.hip = hip;
    let target = null;
    if (leg.broken || r.curl > 0) {
      const f = folded(r, leg), h = home(r, leg), c = leg.broken ? 1 : r.curl;
      target = { x: h.x + (f.x - h.x) * c, y: h.y + (f.y - h.y) * c };
      leg.step = null;
      leg.foot = leg.foot ? lerpP(leg.foot, target, 1 - Math.exp(-dt * 10)) : target;
    } else if (leg.reach) {
      // an attack has this leg: its wrist goes where the attack wants it (leg.rate: how fast)
      leg.step = null;
      leg.foot = lerpP(leg.foot, leg.reach, leg.rate ? 1 - Math.exp(-dt * leg.rate) : 1);
    } else if (leg.step) {
      const st = leg.step;
      st.t += dt / st.dur;
      const u = Math.min(1, st.t), e = u * u * (3 - 2 * u), lift = Math.sin(u * Math.PI) * st.lift;
      leg.foot = { x: st.from.x + (st.to.x - st.from.x) * e, y: st.from.y + (st.to.y - st.from.y) * e - lift };
      if (u >= 1) leg.step = null;
    } else {
      // planted: step when the body has carried it too far from where it wants to be
      const h = home(r, leg), d = Math.hypot(leg.foot.x - h.x, leg.foot.y - h.y);
      const thr = (moving ? 170 : 300) * r.sc;
      const busy = r.legs.some(o => o.step && o.group !== leg.group);
      if (d > thr && !busy && stepping < 4) {
        const lead = 0.16;
        const to = { x: h.x + r.vx * lead, y: h.y + r.vy * lead };
        leg.step = { from: { ...leg.foot }, to, t: 0, dur: r.stepDur * (0.85 + (leg.idx % 2) * 0.25), lift: Math.min(220 * r.sc, d * 0.45) };
      }
    }
    solveLeg(r, leg);
  }
}

const lerpP = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

// two bones from the hip to the wrist; the knee bends up and away from his body
function solveLeg(r, leg) {
  const L1 = leg.L1 * r.sc, L2 = leg.L2 * r.sc, H = leg.hip;
  let dx = leg.foot.x - H.x, dy = leg.foot.y - H.y, d = Math.hypot(dx, dy) || 1;
  const maxD = (L1 + L2) * 0.995, minD = Math.abs(L1 - L2) + 1;
  const dd = Math.max(minD, Math.min(maxD, d));
  const ux = dx / d, uy = dy / d;
  const W = { x: H.x + ux * dd, y: H.y + uy * dd };
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))));
  const base = Math.atan2(uy, ux);
  // pick the knee that's further from a point below his head (up and out)
  const C = { x: r.x, y: r.y + 300 * r.sc };
  let best = null;
  for (const s of [1, -1]) {
    const ka = base + s * a, K = { x: H.x + Math.cos(ka) * L1, y: H.y + Math.sin(ka) * L1 };
    const score = Math.hypot(K.x - C.x, K.y - C.y) - (K.y - H.y) * 0.35 + (s === leg.bend ? 40 * r.sc : 0);
    if (!best || score > best.score) best = { score, K, s };
  }
  leg.bend = best.s; leg.knee = best.K; leg.wrist = W;
  // the hand: along the forearm, turned a little toward the ground
  const tx = W.x - best.K.x, ty = W.y - best.K.y, tl = Math.hypot(tx, ty) || 1;
  let hx = tx / tl, hy = ty / tl + 0.55;
  const hl = Math.hypot(hx, hy) || 1;
  leg.hdir = [hx / hl, hy / hl];
}

// where the fingertips are (for a stab: put the wrist so the tips land on the spot)
export const handReach = (r, leg) => leg.LH * r.sc * 0.75;
export const legReach = (r, leg) => (leg.L1 + leg.L2) * r.sc * 0.97;
export const spiderAt = (r, a) => at(r, a);
export const JAW_AT = SPIDER_ART.body.jaw;
