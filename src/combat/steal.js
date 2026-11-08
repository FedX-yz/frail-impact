// Story: the Red Giant steals the kill (stage.steal). The cutscene's timing and his pose, shared by
// the engine (when things happen, where his mouth is) and BattleArena (drawing it).
//
//   0.0  everything stops; black bars, the light goes red and dark, the ground starts to rumble
//   0.4  something huge rises slowly over the city — a silhouette
//   1.4  its eyes open, one by one, and fix on the boss
//   2.8  a hand comes up and snatches it (GRAB)
//   3.5  he brings it to his mouth, slowly, and eats it (CHOMP); his eyes go red
//   5.6  his eyes turn to you, wide; he laughs
//   6.6  black (END)
// He stands still like something that doesn't need to move (GiantRig still): only his eyes, his
// arm reaching (from the shoulder, within what his joints allow) and his body leaning into it.
import { GIANT_RIG as R } from './giantRig';
import { GIANT_MOUTH } from './giantArm';

export const STEAL = { grab: 3.3, chomp: 4.7, end: 7.4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const mixP = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

// smooth steps: in and out / fast out of the gate / a little past the mark and back
const easeOut = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const overshoot = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
const seg = (t, a, b) => (t - a) / (b - a);

export function stealPose(st, W, H) {
  const t = st.t, sc = H * 1.12 / 716;
  const sd = st.x < W / 2 ? 'l' : 'r', out = sd === 'l' ? -1 : 1, other = sd === 'l' ? 'r' : 'l';
  // he stands just inside the boss, so the snatch is a short reach across in front of him
  const cx = clamp(st.x - out * W * 0.16, W * 0.3, W * 0.7), left = cx - 393 * sc;
  const laughBob = t > 6.0 && t < 6.9 ? Math.abs(Math.sin((t - 6.0) * 11)) * 6 * (1 - seg(t, 6.0, 6.9)) : 0;
  const top = H * 0.13 - 26 * sc + (1 - ease(seg(t, 0.4, 2.5))) * H * 0.95;
  const L = { left, top, sc };
  const px = ([x, y]) => ({ x: left + x * sc, y: top + y * sc });
  const mouth = px(GIANT_MOUTH);
  const REST = { l: [200, 700], r: [890, 700] };   // hands hanging down, out of the shot
  const boss = { x: st.x, y: st.y };
  // the snatching hand: down → cocked under it → strikes (a touch past) → holds → to his mouth →
  // pushes it in → lowers to his chest, out of the way of his stare
  const rest = px(REST[sd]), cock = { x: st.x + out * W * 0.1, y: st.y + H * 0.2 };
  const chest = px([sd === 'l' ? 300 : 500, 520]);
  let at;
  if (t < 2.6) at = rest;
  else if (t < 2.95) at = mixP(rest, cock, ease(seg(t, 2.6, 2.95)));
  else if (t < STEAL.grab) at = mixP(cock, boss, overshoot(seg(t, 2.95, STEAL.grab)));
  else if (t < 3.7) at = { x: boss.x + Math.sin(t * 40) * 3, y: boss.y + Math.sin(t * 33) * 2 };   // (it struggles)
  else if (t < 4.55) at = mixP(boss, { x: mouth.x, y: mouth.y + H * 0.03 }, ease(seg(t, 3.7, 4.55)));
  else if (t < STEAL.chomp) at = mixP({ x: mouth.x, y: mouth.y + H * 0.03 }, mouth, easeOut(seg(t, 4.55, STEAL.chomp)));
  else if (t < 5.0) at = mouth;
  else at = mixP(mouth, chest, ease(seg(t, 5.0, 5.7)));
  // the other hand comes up and grips the rooftops as he rises, and digs in at the snatch
  const roof = { x: clamp(cx - out * W * 0.3, W * 0.06, W * 0.94), y: H * 0.5 };
  const grip = t < 3.3 ? 0 : Math.sin(Math.min(1, seg(t, 3.3, 3.8)) * Math.PI) * H * 0.012;
  const otherAt = t < 0.9 ? px(REST[other]) : mixP(px(REST[other]), { x: roof.x, y: roof.y + grip }, ease(seg(t, 0.9, 2.3)));
  // his body leans into the snatch and dips with the laugh
  const reach = ease(seg(t, 2.6, 3.2)) * (1 - ease(seg(t, 3.7, 4.8)));
  const lean = out * 24 * reach, dip = 12 * reach + laughBob;
  const hands = { [sd]: { at }, [other]: { at: otherAt } };
  // his eyes open one by one, on the boss, then on what's in his hand, then on you
  const eyesLit = R.eyes.map((_, i) => ease(seg(t, 1.4 + i * 0.13, 1.75 + i * 0.13)) * (0.88 + 0.12 * Math.sin(t * 6 + i * 1.7)));
  const look = t < 5.6 ? (t < STEAL.grab ? boss : at) : { x: W / 2, y: H * 1.2 };
  const state = { lean, dip, mad: t > 5.0, warn: t > 5.6 && t < 6.7, laugh: t > 6.0 && t < 6.8 };
  return { L, sd, at, hands, look, state, mouth, eyesLit, light: 0.15 + 0.45 * ease(seg(t, 0.6, 2.8)) };
}
