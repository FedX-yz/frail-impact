import { getSettings, onSettings } from './settings';

const BASE = import.meta.env.BASE_URL;

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Everything goes through one master volume (Settings → Volume)
const master = _audioCtx.createGain();
master.gain.value = getSettings().volume;
master.connect(_audioCtx.destination);
onSettings(s => { master.gain.value = s.volume; });
// Songs go through their own volume too (Settings → Music), then the master
const musicBus = _audioCtx.createGain();
musicBus.gain.value = getSettings().music ?? 0.8;
musicBus.connect(master);
onSettings(s => { musicBus.gain.value = s.music ?? 0.8; });

// Decoded sounds. `ready` holds finished buffers so a click can play them
// synchronously; `loading` de-duplicates downloads.
const ready = new Map();
const loading = new Map();
// Decoded audio is big (a 30 s song ≈ 10 MB), so apart from the short menu sounds only
// the most recently used KEEP_DECODED tracks / voice lines stay in memory; an older one
// is simply downloaded again (from the browser cache) the next time it plays.
const KEEP_DECODED = 8;
const recent = [];
function remember(src) {
  if (src.includes('/sounds/')) return;   // menu/UI sounds: tiny, kept for instant clicks
  recent.push(src);
  while (recent.length > KEEP_DECODED) ready.delete(recent.shift());
}
function loadBuffer(src) {
  if (ready.has(src)) return Promise.resolve(ready.get(src));
  if (!loading.has(src)) {
    loading.set(src, fetch(src)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${src}`); return r.arrayBuffer(); })
      .then(buf => _audioCtx.decodeAudioData(buf))
      .then(decoded => { ready.set(src, decoded); loading.delete(src); remember(src); return decoded; })
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
const unlock = () => { if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {}); primeBoss(); };
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
    source.connect(g); g.connect(musicBus);
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
export function playVoice(src) {
  stopVoice();
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const h = { stopped: false };
  voice = h;
  loadBuffer(src).then(decoded => {
    if (h.stopped) return;
    const s = _audioCtx.createBufferSource(), g = _audioCtx.createGain();
    s.buffer = decoded; g.gain.value = 1.4;
    s.connect(g); g.connect(master); s.start();
    h.source = s;
  }).catch(() => {});
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

// ─────────────────────────────────────────────────────────────────────────────
// Boss music: on while a boss is out (BattleArena.jsx calls bossMusic). A boss can have its
// own song (song = { src, buffer }: enemies.js → music, the Swarm King's two phases); the
// rest share the general boss songs, which take turns, one per fight (a fight that outlasts
// its song moves on to the other one). Own songs loop.
// Long songs are streamed by an <audio> element (a decoded 3-minute song would be ~70 MB of
// memory) but played through Web Audio, so the volume works on iPhones; `buffer` songs are
// short loops, decoded whole so they loop without a gap.
// ─────────────────────────────────────────────────────────────────────────────
const BOSS_TRACKS = [`${BASE}audio/music/boss1.mp3`, `${BASE}audio/music/boss2.mp3`];
let bossNext = Math.floor(Math.random() * BOSS_TRACKS.length);
let boss = null;   // { el, gain, on, key, song, idx, buf: { node, t0, dur, at } }
function bossPlayer() {
  if (boss) return boss;
  const el = new Audio();
  el.preload = 'none';
  const gain = _audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(musicBus);
  try { _audioCtx.createMediaElementSource(el).connect(gain); } catch { /* no Web Audio for media: plays at element volume */ }
  boss = { el, gain, on: false, key: null, song: null, idx: -1, buf: null, timer: 0 };
  el.addEventListener('ended', () => { if (boss.on && !boss.song) playBoss(null, 0.4, (boss.idx + 1) % BOSS_TRACKS.length); });
  return boss;
}
// iPhones only let an <audio> element play from a tap, so play it once (silently) on the first one
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let primed = false;
function primeBoss() {
  if (primed) return;
  primed = true;
  const b = bossPlayer();
  if (b.key) return;
  b.el.src = SILENCE;
  b.el.play().then(() => { if (!b.key) b.el.pause(); }).catch(() => {});
}
function fadeBoss(to, sec) {
  const g = boss.gain.gain, t = _audioCtx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(Math.max(0.0001, to), t + Math.max(0.01, sec));
}
// stop whatever is sounding (remembering where a looped buffer was, for resume)
function haltBoss() {
  const b = boss;
  if (b.buf?.node) {
    b.buf.at = (_audioCtx.currentTime - b.buf.t0) % b.buf.dur;
    try { b.buf.node.stop(); } catch { /* done */ }
    b.buf.node = null;
  }
  b.el.pause();
}
// start a song (null = the next general boss song) from `from` seconds
function playBoss(song, fadeIn, idx = null, from = 0) {
  const b = bossPlayer();
  haltBoss();
  b.song = song;
  b.gain.gain.cancelScheduledValues(_audioCtx.currentTime);
  b.gain.gain.setValueAtTime(0.0001, _audioCtx.currentTime);
  if (song?.buffer) {
    const key = b.key = song.src;
    b.el.removeAttribute('src');
    loadBuffer(`${BASE}${song.src}`).then(decoded => {
      if (!b.on || b.key !== key) return;
      const node = _audioCtx.createBufferSource();
      node.buffer = decoded; node.loop = true;
      node.connect(b.gain);
      const t = _audioCtx.currentTime + 0.02, at = from % decoded.duration;
      node.start(t, at);
      b.buf = { node, t0: t - at, dur: decoded.duration, at };
      fadeBoss(1, fadeIn);
    }).catch(() => {});
    return;
  }
  b.buf = null;
  if (song) { b.key = song.src; b.el.src = `${BASE}${song.src}`; b.el.loop = true; }
  else { b.idx = idx ?? bossNext; bossNext = (b.idx + 1) % BOSS_TRACKS.length; b.key = `general:${b.idx}`; b.el.src = BOSS_TRACKS[b.idx]; b.el.loop = false; }
  b.el.currentTime = from;
  b.el.play().then(() => { if (b.on) fadeBoss(1, fadeIn); }).catch(() => {});
}
const songKey = (song) => song?.src ?? 'general';
// 'start': a new boss fight · 'switch': the boss changed songs mid-fight (the Swarm King's
// phase 2) · 'resume': back on the battle screen mid-fight (same song, same spot) ·
// 'stop': the boss is down / you lost (fade out) · 'pause': left the battle screen
export function bossMusic(cmd, song = null) {
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const b = bossPlayer();
  clearTimeout(b.timer);
  const same = b.key && (song ? b.key === song.src : !b.song && b.key?.startsWith('general'));
  if (cmd === 'resume' && same) {
    b.on = true;
    if (b.song?.buffer) playBoss(b.song, 0.8, null, b.buf?.at ?? 0);
    else b.el.play().then(() => { if (b.on) fadeBoss(1, 0.8); }).catch(() => {});
  } else if (cmd === 'start' || cmd === 'resume') {
    b.on = true;
    playBoss(song, 1.6);
  } else if (cmd === 'switch') {
    b.on = true;
    fadeBoss(0, 0.3);
    b.timer = setTimeout(() => { if (b.on) playBoss(song, 0.5); }, 320);
  } else if (b.on) {
    b.on = false;
    const sec = cmd === 'pause' ? 0.25 : 2;
    fadeBoss(0, sec);
    b.timer = setTimeout(() => {
      if (b.on) return;
      haltBoss();
      if (cmd !== 'pause') { b.key = null; b.song = null; b.buf = null; b.el.removeAttribute('src'); b.el.load(); }   // a finished fight: forget the song
    }, sec * 1000 + 60);
  }
}
export const bossSongKey = songKey;

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
  // Bio (Ten Shadows / Mahoraga)
  summon: null, sign: null, tick: null, bark: null, howl: null, thunder: null, ox: null, deer: null, hiss: null, roar: null,
  trumpet: null, splash: null, tongue: null, domain: null, wheel: null, gun: null, leap: null, charge: null, worldslash: null, discover: null, saved: null, dive: null,
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
// an oscillator following [time, freq] points (howls, roars, trumpets), with an optional vibrato
function sweep(type, pts, dur, vol, delay = 0, vib = 0) {
  const t = now() + delay;
  const o = _audioCtx.createOscillator(), g = _audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(pts[0][1], t);
  for (const [at, f] of pts.slice(1)) o.frequency.linearRampToValueAtTime(f, t + at);
  if (vib) {
    const l = _audioCtx.createOscillator(), lg = _audioCtx.createGain();
    l.frequency.value = 6.5; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.02);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

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
  // Bio: something rising out of a pool of shadow
  summon:  () => { crunch(240, 0.35, 0.45, 0.8); tone('sine', 190, 55, 0.42, 0.3); tone('sine', 95, 45, 0.5, 0.2, 0.05); },
  sign:    () => { tone('sine', 140, 300, 0.32, 0.12); crunch(700, 0.35, 0.18, 0.6); },   // hands coming together
  tick:    () => { tone('triangle', 1250, 950, 0.035, 0.07); },
  bark:    () => { [0, 0.13].forEach(d => { tone('sawtooth', vary(430), 170, 0.09, 0.15, d); crunch(950, 0.07, 0.22, 1.2, d); }); },
  howl:    () => { sweep('triangle', [[0, 290], [0.25, 540], [0.8, 470], [1.1, 330]], 1.15, 0.16, 0, 9); sweep('sawtooth', [[0, 145], [0.25, 270], [1.1, 165]], 1.15, 0.05, 0, 5); },
  thunder: () => { crunch(3200, 0.1, 0.55, 0.7); crunch(170, 0.65, 0.5, 0.4, 0.04); tone('sine', 75, 38, 0.6, 0.25, 0.04); },
  ox:      () => { crunch(110, 0.8, 0.55, 0.5); tone('sawtooth', 72, 44, 0.7, 0.18); for (let i = 0; i < 6; i++) crunch(90, 0.06, 0.45, 1.5, i * 0.09); },
  deer:    () => { [1046, 1318, 1568, 2093].forEach((f, i) => tone('sine', f, f * 0.995, 0.9, 0.08, i * 0.07)); },
  hiss:    () => { crunch(5200, 0.45, 0.22, 0.8); tone('sine', 230, 65, 0.55, 0.28, 0.33); crunch(260, 0.4, 0.4, 0.5, 0.36); },
  roar:    () => { sweep('sawtooth', [[0, 85], [0.14, 150], [0.6, 68]], 0.7, 0.2, 0, 14); crunch(420, 0.6, 0.38, 0.5); },
  trumpet: () => { sweep('square', [[0, 290], [0.09, 640], [0.5, 580], [0.72, 430]], 0.75, 0.09, 0, 12); sweep('sawtooth', [[0, 145], [0.09, 320], [0.72, 215]], 0.75, 0.05); },
  splash:  () => { crunch(800, 0.6, 0.5, 0.3); crunch(2600, 0.35, 0.22, 0.5, 0.05); for (let i = 0; i < 4; i++) tone('sine', vary(650), vary(1300), 0.05, 0.05, 0.12 + i * 0.07); },
  tongue:  () => { tone('sine', 320, 950, 0.09, 0.14); tone('sine', 950, 210, 0.12, 0.12, 0.14); },
  domain:  () => { tone('sawtooth', 55, 52, 1.7, 0.16); tone('sine', 110, 52, 1.7, 0.24); crunch(200, 1.3, 0.35, 0.4); [880, 1320].forEach((f, i) => tone('sine', f, f, 1.2, 0.05, 0.3 + i * 0.15)); },
  // Mahoraga
  wheel:   () => { crunch(1500, 0.06, 0.6, 2); tone('square', 165, 120, 0.12, 0.18); tone('sine', 880, 872, 0.45, 0.1, 0.03); tone('sine', 1320, 1310, 0.35, 0.05, 0.03); },
  gun:     () => { crunch(vary(2300), 0.06, 0.5, 0.8); tone('square', 190, 60, 0.07, 0.16); },
  leap:    () => { tone('sine', 210, 640, 0.24, 0.12); crunch(1300, 0.22, 0.24, 0.6); },
  charge:  () => { sweep('sawtooth', [[0, 80], [0.55, 640]], 0.55, 0.12); crunch(3000, 0.55, 0.15, 0.4); },
  // Bio: a combo found for the first time / Round Deer stopping the killing blow / Nue's dive
  discover: () => { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.24, 0.09, i * 0.075)); tone('sine', 2093, 2093, 0.9, 0.05, 0.3); crunch(4200, 0.3, 0.07, 0.6, 0.3); },
  saved:   () => { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f * 1.01, 0.8, 0.09, i * 0.04)); crunch(2600, 0.45, 0.18, 0.5); },
  dive:    () => { sweep('sine', [[0, 1900], [0.3, 320]], 0.32, 0.1); crunch(1800, 0.3, 0.12, 0.7); },
  worldslash: () => { crunch(6500, 0.5, 0.6, 0.4); crunch(300, 0.9, 0.6, 0.4, 0.04); tone('sine', 1900, 180, 0.55, 0.2); tone('sine', 60, 30, 0.9, 0.3, 0.05); },
};

// Too many sounds at once turn into mush: limit how often each can play
const MIN_GAP = { hit: 0.035, crit: 0.05, kill: 0.04, bigKill: 0.08, hurt: 0.1, shield: 0.05, combo: 0.2, ult: 0.2, boom: 0.08, miss: 0.06,
  summon: 0.12, sign: 0.2, tick: 0.03, bark: 0.3, howl: 0.8, thunder: 0.15, ox: 0.5, deer: 0.5, hiss: 0.4, roar: 0.4, trumpet: 0.5, splash: 0.25, tongue: 0.2, domain: 1, wheel: 0.12, gun: 0.05, leap: 0.2, charge: 0.5, worldslash: 0.5, discover: 0.5, saved: 0.5, dive: 0.2 };
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
