// The RED GIANT's arms, posed like real arms (two bones: shoulder → elbow → wrist, then the hand).
// Shared by the engine (where a hand can actually get to: its hitbox) and GiantRig (drawing it),
// so the hand you hit is always the hand on the end of his arm.
//
// What keeps it anatomical:
//   · the upper arm stays at his side unless it's lifted: it can swing out and up overhead, but
//     only a little in across his chest. Hands in front of him come from the elbows bending in
//     (forearms across), not from the shoulders folding in (that looked like wings).
//   · the elbow bends one way at a time, never past ~170° (his huge forearm against his bicep,
//     like the art's left arm), and never locks dead straight; seen from the front it sits low and
//     out (it only swaps sides when that's clearly what reaching the hand needs)
//   · past what the joints allow, the arm stops and the hand gets as close as it can
//   · the shoulder blade: raising the arm above shoulder height lifts the shoulder and draws it in
//   · the wrist bends only so far: the hand mostly follows the forearm (±40° on its own)
// Everything is in the rig's art units (giantRig.js).
import { GIANT_RIG as R } from './giantRig';

export const RAD = Math.PI / 180;
// where his mouth is, in art units (a hand goes there to eat: the stolen kill, BattleArena)
export const GIANT_MOUTH = [383, 236];
export const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LIMITS = {
  abduct: [-20 * RAD, 165 * RAD],   // upper arm, measured out from hanging straight down
  flex: [8 * RAD, 170 * RAD],       // elbow: 0 = straight
  wrist: 40 * RAD,                  // the hand's own turn either way, on top of the forearm's
  follow: 0.85,                     // how much of the forearm's turn the hand takes
  scapula: [22, 8],                 // arm overhead: the shoulder rises this much and draws in this much
};

// each arm at rest: its bones' lengths and angles, and which way the elbow bends
export const ARMS = Object.fromEntries(['l', 'r'].map(sd => {
  const a = R.arms[sd], u = sub(a.E, a.S), w = sub(a.W, a.S);
  const bend = Math.sign(u[0] * w[1] - u[1] * w[0]) || 1;
  return [sd, { ...a, out: sd === 'l' ? -1 : 1, L1: len(a.S, a.E), L2: len(a.E, a.W), up0: ang(a.S, a.E), lo0: ang(a.E, a.W), bend }];
}));

// a direction ↔ how far out from hanging down it is (outward positive, for this side)
const abductOf = (A, a) => wrap(A.out === 1 ? Math.PI / 2 - a : a - Math.PI / 2);
const dirOf = (A, ab) => (A.out === 1 ? Math.PI / 2 - ab : ab + Math.PI / 2);

// Reach for `target` (where the hand's centre should go) from the resting shoulder S0.
// twist: extra turn of the hand (degrees, within the wrist's range). mem: remembers which way the
// elbow went last time (so it doesn't flip back and forth).
// Returns the joints, each bone's turn from rest, and where the hand's centre really ends up.
export function solveArm(sd, S0, target, twist = 0, mem = null) {
  const A = ARMS[sd], handOff = sub(A.hand.c, A.W);
  // the shoulder blade: lifting the arm above the shoulder lifts the shoulder
  const above = clamp((S0[1] - target[1]) / 320, 0, 1), e = above * above * (3 - 2 * above);
  const S = [S0[0] - A.out * LIMITS.scapula[1] * e, S0[1] - LIMITS.scapula[0] * e];
  const minD = Math.sqrt(A.L1 ** 2 + A.L2 ** 2 - 2 * A.L1 * A.L2 * Math.cos(Math.PI - LIMITS.flex[1]));
  const maxD = Math.sqrt(A.L1 ** 2 + A.L2 ** 2 - 2 * A.L1 * A.L2 * Math.cos(Math.PI - LIMITS.flex[0]));
  const prev = mem?.bend ?? A.bend;
  let best = null;
  for (const b of [prev, -prev]) {
    let E, W, dLo = 0, dH = twist * RAD, ua;
    for (let i = 0; i < 6; i++) {   // (where the wrist must be depends on how the hand is turned: settle it)
      const want = sub(target, rot(handOff, dH));
      const d = clamp(len(S, want), minD, maxD), base = ang(S, want);
      const k = Math.acos(clamp((A.L1 * A.L1 + d * d - A.L2 * A.L2) / (2 * A.L1 * d), -1, 1));
      // the shoulder's range: past it, the upper arm stops at the limit
      ua = dirOf(A, clamp(abductOf(A, base - b * k), ...LIMITS.abduct));
      E = [S[0] + Math.cos(ua) * A.L1, S[1] + Math.sin(ua) * A.L1];
      // the forearm points at the wrist spot, as far as the elbow allows
      const fa = ua + clamp(wrap(ang(E, want) - ua) * b, ...LIMITS.flex) * b;
      W = [E[0] + Math.cos(fa) * A.L2, E[1] + Math.sin(fa) * A.L2];
      dLo = wrap(fa - A.lo0);
      dH = dLo + clamp(dLo * (LIMITS.follow - 1) + twist * RAD, -LIMITS.wrist, LIMITS.wrist);
    }
    const hand = add(W, rot(handOff, dH)), miss = len(hand, target);
    // reaching the hand matters most; then the elbow hanging low; then not swapping sides
    const score = miss * 3 - (E[1] - S[1]) * 0.25 + (b === prev ? 0 : 30);
    if (!best || score < best.score) best = { score, b, S, E, W, dUp: wrap(ua - A.up0), dLo, dH, hand, miss };
  }
  if (mem) mem.bend = best.b;
  return best;
}

// where the three pictures go for a solved arm
export function armPieces(sd, j) {
  const A = ARMS[sd];
  const place = (p, origin0, origin, dA) => ({ p, c: add(origin, rot(sub(p.c, origin0), dA)), r: p.rot + dA / RAD });
  return { upper: place(A.upper, A.S, j.S, j.dUp), lower: place(A.lower, A.E, j.E, j.dLo), hand: place(A.hand, A.W, j.W, j.dH) };
}
