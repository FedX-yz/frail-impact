import { getSettings, onSettings } from './settings';

const BASE = import.meta.env.BASE_URL;

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Everything goes through one master volume (Settings → Volume)
const master = _audioCtx.createGain();
master.gain.value = getSettings().volume;
master.connect(_audioCtx.destination);
onSettings(s => { master.gain.value = s.volume; });

// Decoded sounds. `ready` holds finished buffers so a click can play them
// synchronously; `loading` de-duplicates downloads.
const ready = new Map();
const loading = new Map();
function loadBuffer(src) {
  if (ready.has(src)) return Promise.resolve(ready.get(src));
  if (!loading.has(src)) {
    loading.set(src, fetch(src)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${src}`); return r.arrayBuffer(); })
      .then(buf => _audioCtx.decodeAudioData(buf))
      .then(decoded => { ready.set(src, decoded); return decoded; })
      .catch(err => { loading.delete(src); throw err; }));
  }
  return loading.get(src);
}

function start(decoded, gain, rate = 1) {
  const source   = _audioCtx.createBufferSource();
  const gainNode = _audioCtx.createGain();
  gainNode.gain.value = gain;
  source.buffer = decoded;
  source.playbackRate.value = rate;
  source.connect(gainNode);
  gainNode.connect(master);
  source.start(0);
}

export const playSFX = (src, gain = 2.5, rate = 1) => {
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const decoded = ready.get(src);
  if (decoded) { start(decoded, gain, rate); return; }   // already loaded: plays this instant
  loadBuffer(src).then(d => start(d, gain, rate)).catch(() => {});
};

// Menu sounds are downloaded and decoded as soon as the game loads, so the
// first click doesn't have to wait for them.
const UI_SOUNDS = ['ui_close', 'ui_press', 'ui_press2', 'ui_shop', 'ui_warp', 'ui_codex'].map(n => `${BASE}sounds/${n}.mp3`);
UI_SOUNDS.forEach(src => loadBuffer(src).catch(() => {}));

// Browsers keep audio locked until the first tap/click/key; unlock it on the
// very first one so that interaction's own sound isn't lost.
const unlock = () => { if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {}); };
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });

export const playClose = () => playSFX(`${BASE}sounds/ui_close.mp3`);
export const playPress = () => {
  playSFX(UI_SOUNDS[1 + Math.floor(Math.random() * 2)]);   // ui_press or ui_press2
};

// ─────────────────────────────────────────────────────────────────────────────
// Combat sounds. These are generated in code as placeholders. To use a real
// sound instead, put the file in public/sounds/ and write its name here,
// e.g.  hit: 'hit.mp3'. Leave null to keep the generated one.
// ─────────────────────────────────────────────────────────────────────────────
const SFX_FILES = {
  hit:     null,   // normal click hit
  crit:    null,   // critical hit
  kill:    null,   // basic enemy dies
  bigKill: null,   // elite / boss part dies
  hurt:    null,   // you get hit
  shield:  null,   // hitting a shield
  combo:   null,   // combo milestone (10 / 25 / 50)
  ult:     null,   // ult fires
  boom:    null,   // explosion (volatile elites)
  miss:    null,   // click on empty space
};
Object.values(SFX_FILES).filter(Boolean).forEach(f => loadBuffer(`${BASE}sounds/${f}`).catch(() => {}));

const now = () => _audioCtx.currentTime;
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = _audioCtx.createBuffer(1, _audioCtx.sampleRate * 0.4, _audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
// a short blip: oscillator sweeping f0 → f1 with a fast decay
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = now() + delay;
  const o = _audioCtx.createOscillator(), g = _audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
// a burst of filtered noise (impacts, crunches, booms)
function crunch(freq, dur, vol, q = 1, delay = 0) {
  const t = now() + delay;
  const src = _audioCtx.createBufferSource(), f = _audioCtx.createBiquadFilter(), g = _audioCtx.createGain();
  src.buffer = noise();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}
const vary = (x, amt = 0.12) => x * (1 + (Math.random() * 2 - 1) * amt);

const SYNTH = {
  hit:     () => { crunch(vary(1800), 0.05, 0.35, 2); tone('triangle', vary(420), 180, 0.06, 0.18); },
  crit:    () => { crunch(vary(2600), 0.08, 0.45, 1.5); tone('square', vary(880), 330, 0.1, 0.12); tone('triangle', vary(1320), 660, 0.12, 0.1, 0.02); },
  kill:    () => { crunch(vary(900), 0.12, 0.4, 0.8); tone('sine', vary(520), 120, 0.14, 0.22); },
  bigKill: () => { crunch(vary(500), 0.3, 0.6, 0.6); tone('sawtooth', vary(220), 50, 0.35, 0.18); tone('sine', 880, 1760, 0.18, 0.08, 0.05); },
  hurt:    () => { tone('sawtooth', 160, 60, 0.22, 0.25); crunch(300, 0.18, 0.4, 0.7); },
  shield:  () => { tone('sine', vary(1500, 0.05), 1100, 0.08, 0.14); tone('sine', vary(2250, 0.05), 1700, 0.06, 0.08); },
  combo:   (lvl = 1) => { [0, 0.07, 0.14].forEach((d, i) => tone('triangle', 520 * Math.pow(1.26, i + lvl), 520 * Math.pow(1.26, i + lvl), 0.12, 0.14, d)); },
  ult:     () => { tone('sawtooth', 110, 880, 0.45, 0.16); crunch(1200, 0.5, 0.3, 0.5, 0.05); },
  boom:    () => { crunch(160, 0.5, 0.8, 0.5); tone('sine', 120, 35, 0.5, 0.35); },
  miss:    () => { tone('sine', vary(260), 200, 0.04, 0.05); },
};

// Too many sounds at once turn into mush: limit how often each can play
const MIN_GAP = { hit: 0.035, crit: 0.05, kill: 0.04, bigKill: 0.08, hurt: 0.1, shield: 0.05, combo: 0.2, ult: 0.2, boom: 0.08, miss: 0.06 };
const lastPlayed = {};
export function sfx(name, arg) {
  if (!getSettings().combatSfx || getSettings().volume <= 0) return;
  if (_audioCtx.state !== 'running') return;   // not unlocked yet: stay quiet rather than queue a burst
  const t = now();
  if (t - (lastPlayed[name] ?? -1) < (MIN_GAP[name] ?? 0.04)) return;
  lastPlayed[name] = t;
  const file = SFX_FILES[name];
  if (file && ready.has(`${BASE}sounds/${file}`)) { start(ready.get(`${BASE}sounds/${file}`), 1, vary(1, 0.06)); return; }
  try { SYNTH[name]?.(arg); } catch { /* audio not available */ }
}
