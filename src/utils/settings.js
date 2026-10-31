// Player settings (per device). Separate from the save, so "Reset Save"
// doesn't reset your volume.
const KEY = 'frail_settings';
// cursor: the battle cursor's colour ('system' = the normal arrow), cursorSize: s / m / l / xl,
// cursorRings: skill + ult charge next to it
// music: songs only (boss music, pull music, story music), under the main volume
const DEFAULTS = { volume: 1, music: 0.8, combatSfx: true, shake: true, cctv: true, crt: true, cursor: 'cyan', cursorSize: 'm', cursorRings: true };

let current = { ...DEFAULTS };
try { current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* use defaults */ }

const listeners = new Set();
export const getSettings = () => current;
export function setSetting(key, value) {
  current = { ...current, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn(current));
}
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
