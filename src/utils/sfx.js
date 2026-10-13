const BASE = import.meta.env.BASE_URL;

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Decoded sounds. `ready` holds finished buffers so a click can play them
// synchronously; `loading` de-duplicates downloads.
const ready = new Map();
const loading = new Map();
function loadBuffer(src) {
  if (ready.has(src)) return Promise.resolve(ready.get(src));
  if (!loading.has(src)) {
    loading.set(src, fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => _audioCtx.decodeAudioData(buf))
      .then(decoded => { ready.set(src, decoded); return decoded; })
      .catch(err => { loading.delete(src); throw err; }));
  }
  return loading.get(src);
}

function start(decoded, gain) {
  const source   = _audioCtx.createBufferSource();
  const gainNode = _audioCtx.createGain();
  gainNode.gain.value = gain;
  source.buffer = decoded;
  source.connect(gainNode);
  gainNode.connect(_audioCtx.destination);
  source.start(0);
}

export const playSFX = (src, gain = 2.5) => {
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
  const decoded = ready.get(src);
  if (decoded) { start(decoded, gain); return; }   // already loaded: plays this instant
  loadBuffer(src).then(d => start(d, gain)).catch(() => {});
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
