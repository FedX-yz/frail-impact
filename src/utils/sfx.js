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

// ─────────────────────────────────────────────────────────────────────────────
// Music (pull reveals). One track at a time. It goes through the same master
// volume, and fades are done with Web Audio because iPhones ignore an <audio>
// element's volume.
// ─────────────────────────────────────────────────────────────────────────────
let music = null;
// Start downloading/decoding a track early (e.g. while the pull animation plays)
export const preloadSound = (src) => { if (src) loadBuffer(src).catch(() => {}); };
// Play `src` from `offset` seconds, fading in over `fadeIn` seconds.
// Resolves to a handle once it's actually playing (null if it couldn't load or
// was stopped first); musicElapsed(handle) says how far into the fade it is.
export function playMusic(src, { offset = 0, fadeIn = 0, gain = 1, loop = false } = {}) {
  stopMusic(0);
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const handle = { stopped: false };
  music = handle;
  return loadBuffer(src).then(decoded => {
    if (handle.stopped) return null;
    const source = _audioCtx.createBufferSource(), g = _audioCtx.createGain();
    source.buffer = decoded; source.loop = loop;
    source.connect(g); g.connect(master);
    const t = _audioCtx.currentTime + 0.03;
    if (fadeIn > 0) {
      // swells in (slow at first, full volume right on the drop)
      const curve = Float32Array.from({ length: 32 }, (_, i) => gain * Math.pow(i / 31, 1.5));
      curve[0] = 0.0001;
      g.gain.setValueCurveAtTime(curve, t, fadeIn);
    } else g.gain.setValueAtTime(gain, t);
    source.start(t, Math.max(0, Math.min(offset, decoded.duration - 0.05)));
    Object.assign(handle, { source, gain: g, t0: t });
    return handle;
  }).catch(() => null);
}
// Voiced story lines: one at a time, a new one (or stopVoice) cuts the last off.
let voice = null;
// Resolves to the clip's length in seconds (null if it couldn't play).
export function playVoice(src) {
  stopVoice();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const h = { stopped: false };
  voice = h;
  return loadBuffer(src).then(decoded => {
    if (h.stopped) return null;
    const s = _audioCtx.createBufferSource(), g = _audioCtx.createGain();
    s.buffer = decoded; g.gain.value = 1.4;
    s.connect(g); g.connect(master); s.start();
    h.source = s;
    return decoded.duration;
  }).catch(() => null);
}
export function stopVoice() {
  if (!voice) return;
  voice.stopped = true;
  try { voice.source?.stop(); } catch { /* already done */ }
  voice = null;
}
export const musicElapsed = (h) => (h?.t0 != null ? _audioCtx.currentTime - h.t0 : 0);
export function stopMusic(fade = 0.3) {
  const m = music;
  music = null;
  if (!m) return;
  m.stopped = true;
  if (!m.source) return;
  const t = _audioCtx.currentTime;
  try {
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(Math.max(0.0001, m.gain.gain.value), t);
    m.gain.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.01, fade));
    m.source.stop(t + Math.max(0.01, fade) + 0.02);
  } catch { /* already stopped */ }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Paper sounds: the pen while you sign, rubber stamps, a pencil scribble.
// Generated in code. To use a real recording, put it in public/sounds/ and
// write its name in PAPER_FILES (the pen file should be a loop of scratching).
// ─────────────────────────────────────────────────────────────────────────────
const PAPER_FILES = { stamp: null, scribble: null, pen: null };
Object.values(PAPER_FILES).filter(Boolean).forEach(f => loadBuffer(`${BASE}sounds/${f}`).catch(() => {}));
const paperFile = name => { const f = PAPER_FILES[name]; return f && ready.get(`${BASE}sounds/${f}`); };
let lastStamp = -1;

// A rubber stamp hitting paper: a low thud, a slap, a little paper rattle.
export function playStamp(vol = 1) {
  if (getSettings().volume <= 0) return;
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  if (now() - lastStamp < 0.06) return;   // a pile of stamps at once stays a pile, not a roar
  lastStamp = now();
  const file = paperFile('stamp');
  if (file) { start(file, vol, vary(1, 0.05)); return; }
  try {
    tone('sine', vary(150, 0.06), 45, 0.16, 0.55 * vol);
    crunch(vary(1100), 0.05, 0.6 * vol, 0.9);
    crunch(vary(3200), 0.09, 0.18 * vol, 1.2, 0.012);
  } catch { /* audio not available */ }
}

// A quick pencil scribble (a handwritten caption).
export function playScribble(dur = 0.7, vol = 1) {
  if (getSettings().volume <= 0) return;
  const file = paperFile('scribble');
  if (file) { start(file, vol); return; }
  try {
    const t = now(), src = _audioCtx.createBufferSource(), f = _audioCtx.createBiquadFilter(), g = _audioCtx.createGain();
    src.buffer = noise(); src.loop = true;
    f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.9;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < dur / 0.09; k++) {   // short strokes
      const s = t + k * 0.09;
      g.gain.linearRampToValueAtTime(vary(0.13, 0.4) * vol, s + 0.03);
      g.gain.linearRampToValueAtTime(0.02 * vol, s + 0.08);
      f.frequency.setValueAtTime(vary(3800, 0.25), s);
    }
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.1);
  } catch { /* audio not available */ }
}

// The pen while you sign: starts silent, gets louder and brighter the faster
// the pen moves (setPenSpeed), and fades when it stops.
export function penStart() {
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  try {
    const src = _audioCtx.createBufferSource(), f = _audioCtx.createBiquadFilter(), g = _audioCtx.createGain();
    const file = paperFile('pen');
    src.buffer = file ?? noise(); src.loop = true;
    f.type = file ? 'allpass' : 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.8;
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    return {
      speed(v) {   // v: px per ms
        const t = now(), amt = Math.min(1, v / 1.6);
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(amt * 0.32, t, 0.03);
        g.gain.setTargetAtTime(0, t + 0.09, 0.05);   // pen held still → quiet
        if (!file) f.frequency.setTargetAtTime(2200 + amt * 3200, t, 0.05);
      },
      stop() { const t = now(); g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.04); src.stop(t + 0.25); },
    };
  } catch { return { speed() {}, stop() {} }; }
}
