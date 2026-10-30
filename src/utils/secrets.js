// Per-device unlocks typed into the hidden prompt (Settings: press and hold the
// title). Phrases are checked by hash, so the source doesn't spell them out.
const WHEEL_KEY = 'frail_wheel';
const COMBO_KEY = 'frail_wheel_found';
const WHEEL_HASH = '3fc6fbc18e6c75ec9e2c7ac785dca5c5c30f037426a1d743b9a302aece5ef4ac';

const PLAT_KEY = 'frail_platinum';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, v) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* storage blocked */ } };

// Bio's other kit (the hand-sign wheel, the garden, Mahoraga that leaps)
export const wheelOn = () => read(WHEEL_KEY) === '1';
export function setWheel(on) { write(WHEEL_KEY, on ? '1' : null); }

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// A line typed into the prompt: 'on' / 'off' if it was the phrase (and flips the switch), else null
export async function runCommand(line) {
  const norm = String(line).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm || !crypto?.subtle) return null;
  if (await sha256(norm) !== WHEEL_HASH) return null;
  const on = !wheelOn();
  setWheel(on);
  return on ? 'on' : 'off';
}

// Combos found so far with that kit (on this device): true the first time
export function foundCombo(id) {
  let list = [];
  try { list = JSON.parse(read(COMBO_KEY) || '[]'); } catch { list = []; }
  if (list.includes(id)) return false;
  write(COMBO_KEY, JSON.stringify([...list, id]));
  return true;
}
export function combosFound() {
  try { return JSON.parse(read(COMBO_KEY) || '[]'); } catch { return []; }
}

// The Platinum banner (6★ Ice), found in Records (CardsScreen.jsx). Per device, like the wheel.
export const platinumOn = () => read(PLAT_KEY) === '1';
export function setPlatinum(on) {
  write(PLAT_KEY, on ? '1' : null);
  if (on) write('frail_banner', 'platinum-series');   // the gacha opens on it next time
}
