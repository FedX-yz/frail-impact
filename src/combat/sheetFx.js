// Sprite-sheet effects (ParticleFX exports, cut down to size in public/fx/).
// engine.js → sheetFx(name, x, y, w) adds { kind: 'sheet', fx: name, … } to s.effects;
// BattleArena → SheetFx plays it. One frame each `1 / fps` seconds, then it's gone.
//   cols / n:     the sheet's grid and how many frames are in it
//   fw / fh:      one frame's size in the picture (for its aspect ratio)
//   anchor:       which point of the frame sits on (x, y), × the frame
const BASE = import.meta.env.BASE_URL;
export const SHEET_FX = {
  boom: { img: `${BASE}fx/boss_boom.png`, cols: 10, n: 58, fw: 300, fh: 261, anchor: [0.472, 0.538], fps: 22 },   // a boss goes up: flash, then a pink smoke cloud
  crit: { img: `${BASE}fx/crit_mark.png`, cols: 12, n: 12, fw: 128, fh: 128, anchor: [0.5, 0.5], fps: 30 },       // the red crit marker
};
export const sheetLife = (name) => SHEET_FX[name].n / SHEET_FX[name].fps;

// load and decode them ahead of time, so the first one isn't a blank frame while it loads. The
// crit marker (small, needed in the first seconds of a fight) right away; the boss explosion
// (half a megabyte) only once a fight is going (warmSheets: engine.js), not on the title screen
// or the story of a first visit.
const warmed = new Set();
function warm(name) {
  if (warmed.has(name) || typeof Image === 'undefined') return;
  warmed.add(name);
  const im = new Image(); im.src = SHEET_FX[name].img; im.decode?.().catch(() => {});
}
warm('crit');
export const warmSheets = () => Object.keys(SHEET_FX).forEach(warm);
