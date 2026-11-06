// Per-device unlocks typed into the hidden prompt (Settings: press and hold the
// title). Phrases are checked by hash, so the source doesn't spell them out.
const WHEEL_KEY = 'frail_wheel';
const COMBO_KEY = 'frail_wheel_found';
const WHEEL_HASH = '3fc6fbc18e6c75ec9e2c7ac785dca5c5c30f037426a1d743b9a302aece5ef4ac';

const PLAT_KEY = 'frail_platinum';
const DUB_KEY = 'frail_dub';
const DUB_HASH = '80088f270ef3b942fc860ce1eeddbc6c90884baaf783bc6944a1baf56d7953c7';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, v) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* storage blocked */ } };

// Bio's other kit (the hand-sign wheel, the garden, Mahoraga that leaps)
export const wheelOn = () => read(WHEEL_KEY) === '1';
export function setWheel(on) { write(WHEEL_KEY, on ? '1' : null); }

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// A line typed into the prompt: which switch it flipped ('wheel' / 'dub') and whether it's now on,
// or null if it wasn't a phrase
export async function runCommand(line) {
  const norm = String(line).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm || !crypto?.subtle) return null;
  const h = await sha256(norm);
  if (h === WHEEL_HASH) { const on = !wheelOn(); setWheel(on); return { what: 'wheel', on }; }
  if (h === DUB_HASH) { const on = !dubOn(); setDub(on); return { what: 'dub', on }; }
  return null;
}

// The dub: the story's lines spoken in ElevenLabs voices (cast.js → dub), on this device
export const dubOn = () => read(DUB_KEY) === '1';
export function setDub(on) { write(DUB_KEY, on ? '1' : null); }

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
