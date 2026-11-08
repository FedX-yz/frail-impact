// Story: the Red Giant steals the kill (stage.steal). The cutscene's timing and his pose, shared by
// the engine (when things happen, where his mouth is) and BattleArena (drawing it).
//
//   0.0  everything stops; black bars, the light goes red and dark, the ground starts to rumble
//   0.4  something huge rises slowly over the city — a silhouette, one hand gripping the rooftops
//   1.4  its eyes open, one by one, and fix on the boss
//   2.6  both hands come up around it and clamp shut on it (GRAB)
//   3.7  he drags it down out of the shot and goes down after it: an empty, dark frame
//   4.7  out of sight, he eats it (CHOMP): the crunch, green spraying up from below
//   5.4  his head rises back into view up to the eyes, red now, staring at you; he laughs
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
const overshoot = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
const seg = (t, a, b) => (t - a) / (b - a);

export function stealPose(st, W, H) {
  const t = st.t, sc = H * 1.12 / 716;
  const sd = st.x < W / 2 ? 'l' : 'r', out = sd === 'l' ? -1 : 1, other = sd === 'l' ? 'r' : 'l';
  // he stands just inside the boss
  const cx = clamp(st.x - out * W * 0.16, W * 0.3, W * 0.7), left = cx - 393 * sc;
  // up over the city → down out of the shot after it → back up to the eyes
  const up = H * 0.13 - 26 * sc, peek = H * 0.66 - 172 * sc, gone = H * 1.15;
  const rise = up + (1 - ease(seg(t, 0.4, 2.5))) * H * 0.95;
  const laughBob = t > 6.0 && t < 6.9 ? Math.abs(Math.sin((t - 6.0) * 11)) * 6 * sc * (1 - seg(t, 6.0, 6.9)) : 0;
  const top = t < 3.7 ? rise : t < 5.4 ? up + (gone - up) * ease(seg(t, 3.7, 4.5)) : gone + (peek - gone) * ease(seg(t, 5.4, 6.4)) + laughBob;
  const L = { left, top, sc };
  const px = ([x, y]) => ({ x: left + x * sc, y: top + y * sc });
  const REST = { l: [200, 700], r: [890, 700] };   // hands hanging down, out of the shot
  const boss = { x: st.x, y: st.y }, r = st.r * 0.36;
  // both hands: come up either side of it, clamp shut on it, hold it (it struggles), drag it down
  const side = h => (h === 'l' ? -1 : 1);
  const hand = h => {
    const rest = px(REST[h]);
    const cock = { x: boss.x + side(h) * W * 0.13, y: boss.y + H * 0.06 };
    const shut = { x: boss.x + side(h) * r, y: boss.y + Math.sin(t * 40 + side(h)) * 2 };
    const down = { x: shut.x, y: H * 1.4 };
    if (t < 2.6) return h === other ? mixP(rest, { x: clamp(cx - out * W * 0.3, W * 0.06, W * 0.94), y: H * 0.5 }, ease(seg(t, 0.9, 2.3))) : rest;   // (the far hand grips the rooftops while he rises)
    const from = h === other ? { x: clamp(cx - out * W * 0.3, W * 0.06, W * 0.94), y: H * 0.5 } : rest;
    if (t < 2.95) return mixP(from, cock, ease(seg(t, 2.6, 2.95)));
    if (t < STEAL.grab) return mixP(cock, shut, overshoot(seg(t, 2.95, STEAL.grab)));
    if (t < 3.7) return shut;
    return mixP(shut, down, ease(seg(t, 3.7, 4.3)) ** 1.4);
  };
  const hands = { l: { at: hand('l') }, r: { at: hand('r') } };
  const held = mixP(hands.l.at, hands.r.at, 0.5);
  // the body leans into it and bends down with the drag
  const reach = ease(seg(t, 2.6, 3.2)) * (1 - ease(seg(t, 5.4, 6.0)));
  const lean = out * 14 * reach, dip = 30 * reach;
  // eyes: open one by one, on the boss, then on you when he comes back up
  const eyesLit = R.eyes.map((_, i) => ease(seg(t, 1.4 + i * 0.13, 1.75 + i * 0.13)) * (0.88 + 0.12 * Math.sin(t * 6 + i * 1.7)));
  const look = t < 5.0 ? held : { x: W / 2, y: H * 1.2 };
  const state = { lean, dip, mad: t > 5.0, warn: t > 5.8 && t < 6.8, laugh: t > 6.0 && t < 6.8 };
  return { L, sd, at: held, held, hands, look, state, mouth: { x: held.x, y: H * 1.02 }, eyesLit, light: 0.15 + 0.45 * ease(seg(t, 0.6, 2.8)) };
}
