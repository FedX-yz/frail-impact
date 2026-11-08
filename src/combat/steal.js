// Story: the Red Giant steals the kill (stage.steal). The cutscene's timing and his pose, shared by
// the engine (when things happen, where his mouth is) and BattleArena (drawing it).
//
//   0.0  everything stops; black bars, the light goes red and dark, the ground starts to rumble
//   0.4  something huge rises slowly over the city — a silhouette, one hand gripping the rooftops
//   1.4  its eyes open, one by one, and fix on the boss
//   2.6  his hands come up either side of it, open...
//   3.0  ...and clap shut around it, palms together (GRAB: it's gone, in his grasp)
//   3.9  he draws his clasped hands in to his chest
//   4.3  and runs off with it, out of the shot, the ground shaking with every step
//   5.6  out of sight: the sounds of him eating it (CHOMP)
//   6.8  black (END)
// He stands still like something that doesn't need to move (GiantRig still): only his eyes, his
// arm reaching (from the shoulder, within what his joints allow) and his body leaning into it.
import { GIANT_RIG as R } from './giantRig';
import { GIANT_MOUTH } from './giantArm';

export const STEAL = { grab: 3.3, chomp: 5.7, end: 7.7 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const mixP = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

// smooth steps: in and out / fast out of the gate / a little past the mark and back
const overshoot = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
const seg = (t, a, b) => (t - a) / (b - a);

// how his hands turn to meet palm to palm (degrees, each hand's own turn on its wrist)
export const CLASP_TWIST = { l: 34, r: -34 };
// his heavy steps as he runs off (s): engine.js shakes the ground on each
export const STEPS = [4.45, 4.85, 5.22, 5.56];

// The boss, nearly dead, sinks as he rises (to where his hands can close on it: in front of his chest)
export function stealBoss(st, W, H) {
  const k = ease(seg(st.t, 0.2, 2.4));
  const x = clamp(st.x, W * 0.27, W * 0.73), y = Math.max(st.y, H * 0.56);
  return { x: st.x + (x - st.x) * k, y: st.y + (y - st.y) * k };
}
const CHEST = [393, 420];   // where his two hands meet comfortably (art units): the clasp

export function stealPose(st, W, H) {
  const t = st.t;
  const boss = stealBoss(st, W, H), end = stealBoss({ ...st, t: 9 }, W, H);
  // as big as he can be with his head in the shot and his chest right behind where the boss ends up
  const sc = clamp((end.y - H * 0.1) / (CHEST[1] - 26), H * 0.55 / 716, H * 1.15 / 716);
  const cx0 = end.x;
  const away = cx0 < W / 2 ? -1 : 1;                               // he runs off the nearer side
  const run = ease(seg(t, 4.3, 5.7));
  const cx = cx0 + away * run * (W * 0.5 + 393 * sc * 1.2);
  const bob = t > 4.3 && t < 5.8 ? -Math.abs(Math.sin((t - 4.3) * Math.PI / 0.38)) * 16 * sc : 0;   // (up and down with each stride)
  const left = cx - CHEST[0] * sc;
  const up = end.y - CHEST[1] * sc;
  const top = up + (1 - ease(seg(t, 0.4, 2.5))) * H * 0.95 + bob;
  const L = { left, top, sc };
  const px = ([x, y]) => ({ x: left + x * sc, y: top + y * sc });
  const REST = { l: [200, 700], r: [890, 700] };                  // hands hanging down, out of the shot
  const roof = { x: clamp(cx0 + W * 0.3, W * 0.06, W * 0.94), y: H * 0.5 };   // (his right hand grips the rooftops while he rises)
  const half = 62 * sc;                                            // half a hand's width: palms meet in the middle
  const clasp = boss;
  const chest = px([393, 470]);   // (drawn in a little closer once he's got it)
  const hand = h => {
    const sgn = h === 'l' ? -1 : 1;
    const rest = h === 'r' && t < 2.6 ? mixP(px(REST.r), roof, ease(seg(t, 0.9, 2.3))) : px(REST[h]);
    const from = h === 'r' ? roof : px(REST.l);
    const open = { x: clasp.x + sgn * W * 0.16, y: clasp.y + H * 0.02 };
    const shut = { x: clasp.x + sgn * half, y: clasp.y };
    let at, tw = 0;
    if (t < 2.6) at = rest;
    else if (t < 3.0) { at = mixP(from, open, ease(seg(t, 2.6, 3.0))); tw = CLASP_TWIST[h] * 0.6 * ease(seg(t, 2.6, 3.0)); }
    else if (t < STEAL.grab) { at = mixP(open, shut, overshoot(seg(t, 3.0, STEAL.grab))); tw = CLASP_TWIST[h] * (0.6 + 0.4 * ease(seg(t, 3.0, STEAL.grab))); }
    else if (t < 3.9) { at = { x: shut.x + Math.sin(t * 38) * 1.5, y: shut.y + Math.sin(t * 31) * 1.5 }; tw = CLASP_TWIST[h]; }   // (squeezing)
    else { const c = mixP(clasp, chest, ease(seg(t, 3.9, 4.35))); at = { x: c.x + sgn * half, y: c.y }; tw = CLASP_TWIST[h]; }
    return { at, twist: tw };
  };
  const hands = { l: hand('l'), r: hand('r') };
  // he hunches over his catch, then leans into the run
  const hunch = ease(seg(t, 3.3, 3.9)) * (1 - ease(seg(t, 5.6, 6.2)));
  const lean = away * 22 * ease(seg(t, 4.2, 4.6)), dip = 16 * hunch;
  const eyesLit = R.eyes.map((_, i) => ease(seg(t, 1.4 + i * 0.13, 1.75 + i * 0.13)) * (0.88 + 0.12 * Math.sin(t * 6 + i * 1.7)));
  // eyes: the boss, his catch, then a glance back at you as he goes
  const look = t < 4.2 ? clasp : t < 4.7 ? { x: W / 2, y: H * 1.2 } : { x: cx + away * W, y: H * 0.4 };
  const state = { lean, dip, mad: t > 3.3, warn: t > 4.2 && t < 4.7 };
  return { L, at: clasp, hands, look, state, eyesLit, light: 0.15 + 0.45 * ease(seg(t, 0.6, 2.8)), gone: run >= 1 };
}
