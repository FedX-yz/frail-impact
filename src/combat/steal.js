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
const easeIn = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x);
const mixP = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export function stealPose(st, W, H) {
  const t = st.t, sc = H * 1.12 / 716;
  const sd = st.x < W / 2 ? 'l' : 'r', out = sd === 'l' ? -1 : 1, other = sd === 'l' ? 'r' : 'l';
  // he stands just inside the boss, so the snatch is a short reach across in front of him
  const cx = clamp(st.x - out * W * 0.16, W * 0.3, W * 0.7), left = cx - 393 * sc;
  const top = H * 0.13 - 26 * sc + (1 - ease((t - 0.4) / 2.0)) * H * 0.95;
  const L = { left, top, sc };
  const px = ([x, y]) => ({ x: left + x * sc, y: top + y * sc });
  const mouth = px(GIANT_MOUTH);
  // the hand: down behind the buildings while he rises, then up and onto the boss, then to his mouth
  const REST = { l: [200, 690], r: [890, 690] };   // hands hanging down, out of the shot
  const rest = px(REST[sd]), boss = { x: st.x, y: st.y };
  const at = t < 2.8 ? rest : t < STEAL.grab ? mixP(rest, boss, easeIn((t - 2.8) / (STEAL.grab - 2.8)))
    : t < 3.55 ? boss : t < 4.6 ? mixP(boss, mouth, ease((t - 3.55) / 1.05)) : mouth;
  // leaning into the snatch, then upright again
  const reach = ease((t - 2.8) / 0.5) * (1 - ease((t - 3.55) / 1.1));
  const lean = out * 26 * reach, dip = 14 * reach;
  const hands = { [sd]: { at }, [other]: { at: px(REST[other]) } };
  // eyes: open one by one, on the boss (then his hand), then on you
  const eyeOpen = i => ease((t - 1.4 - i * 0.13) / 0.35);
  const look = t < 5.6 ? (t < STEAL.grab ? boss : at) : { x: W / 2, y: H * 1.2 };
  const state = { lean, dip, mad: t > 5.0, warn: t > 5.6 && t < 6.7, laugh: t > 6.0 && t < 6.8 };
  // where each eye is on screen (he's still: only the lean and dip move his head)
  const eyes = R.eyes.map(e => ({ ...px([e.c[0] + lean, e.c[1] + Math.abs(lean) * 0.25 + dip]), r: (e.big ? 36 : 17) * sc }));
  return { L, sd, at, hands, look, state, mouth, eyes, eyeOpen, light: 0.15 + 0.45 * ease((t - 0.6) / 2.2) };
}
