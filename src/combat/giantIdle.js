// The RED GIANT between attacks: he doesn't just stand there. He goes through a loop of poses
// (holding each for a moment, then moving to the next), swaying all the while: looming over
// you, clawing at his face, spreading his arms wide, leaning on the city, reaching in, raising
// a fist. Used by the engine (where his hands rest, and his head hitbox) and by GiantRig (how
// he's drawn, also far away behind the city, where nobody's fighting him).
//
// Everything is in the rig's art units (giantRig.js). Per pose:
//   l, r:   where each hand's centre is        twist: { l, r } extra turn of each hand (degrees)
//   head:   [dx, dy] the head moves by         tilt:  head tilt (degrees)
//   body:   [dx, dy] the whole torso moves by (shoulders and head with it)
const POSES = {
  loom:   { l: [250, 470], r: [880, 440], twist: { l: 8, r: -6 }, head: [0, 6], tilt: 0, body: [0, 4] },
  claw:   { l: [130, 340], r: [960, 420], twist: { l: -6, r: 0 }, head: [-4, 0], tilt: -3, body: [-4, 0] },
  spread: { l: [-80, 230], r: [1110, 210], twist: { l: -16, r: 16 }, head: [0, -10], tilt: 0, body: [0, -6] },
  lean:   { l: [120, 650], r: [1010, 640], twist: { l: 18, r: -18 }, head: [0, 12], tilt: 2, body: [0, 10] },
  reach:  { l: [330, 430], r: [720, 400], twist: { l: 12, r: -12 }, head: [0, 8], tilt: -1, body: [0, 6] },
  raise:  { l: [210, 520], r: [800, 40], twist: { l: 6, r: 10 }, head: [6, -4], tilt: 5, body: [6, -2] },
};
const ORDER = ['loom', 'claw', 'loom', 'spread', 'lean', 'reach', 'raise', 'loom', 'lean', 'spread'];
const ease = u => u * u * (3 - 2 * u);
const mix = (a, b, u) => a + (b - a) * u;
const mix2 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u)];

export function giantIdlePose(t, mad = false) {
  t = Math.max(0, t || 0);
  const hold = mad ? 1.5 : 2.6, move = mad ? 0.85 : 1.35, seg = hold + move;
  const n = Math.floor(t / seg), f = t - n * seg;
  const a = POSES[ORDER[n % ORDER.length]], b = POSES[ORDER[(n + 1) % ORDER.length]];
  const u = f < hold ? 0 : ease((f - hold) / move);
  const sway = mad ? 1.6 : 1;
  const l = mix2(a.l, b.l, u), r = mix2(a.r, b.r, u);
  l[0] += Math.sin(t * 0.9) * 10 * sway; l[1] += Math.sin(t * 1.3 + 1) * 8 * sway;
  r[0] += Math.sin(t * 0.8 + 2) * 10 * sway; r[1] += Math.sin(t * 1.2 + 3) * 8 * sway;
  return {
    l, r,
    twist: { l: mix(a.twist.l, b.twist.l, u) + Math.sin(t * 1.1) * 4, r: mix(a.twist.r, b.twist.r, u) + Math.sin(t * 1.05 + 2) * 4 },
    head: mix2(a.head, b.head, u), tilt: mix(a.tilt, b.tilt, u),
    body: [mix(a.body[0], b.body[0], u) + Math.sin(t * 0.5) * 4, mix(a.body[1], b.body[1], u)],
  };
}
