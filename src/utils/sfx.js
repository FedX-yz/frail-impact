const BASE = import.meta.env.BASE_URL;

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Decoded sounds, cached so each file is fetched and decoded only once
// (it used to re-download on every single click).
const _buffers = new Map();
function loadBuffer(src) {
  if (!_buffers.has(src)) {
    const p = fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => _audioCtx.decodeAudioData(buf))
      .catch(err => { _buffers.delete(src); throw err; });
    _buffers.set(src, p);
  }
  return _buffers.get(src);
}

export const playSFX = (src, gain = 2.5) => {
  // Browsers start an AudioContext "suspended" until the user interacts;
  // without resume() the sounds could stay silent.
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});

  loadBuffer(src)
    .then(decoded => {
      const source   = _audioCtx.createBufferSource();
      const gainNode = _audioCtx.createGain();
      gainNode.gain.value = gain;
      source.buffer = decoded;
      source.connect(gainNode);
      gainNode.connect(_audioCtx.destination);
      source.start(0);
    })
    .catch(() => {});
};

export const playClose = () => playSFX(`${BASE}sounds/ui_close.mp3`);
export const playPress = () => {
  const sfxs = [`${BASE}sounds/ui_press.mp3`, `${BASE}sounds/ui_press2.mp3`];
  playSFX(sfxs[Math.floor(Math.random() * sfxs.length)]);
};
