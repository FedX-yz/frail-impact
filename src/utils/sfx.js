const BASE = import.meta.env.BASE_URL;

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
export const playSFX = (src, gain = 2.5) => {
  const source   = _audioCtx.createBufferSource();
  const gainNode = _audioCtx.createGain();
  gainNode.gain.value = gain;

  fetch(src)
    .then(r => r.arrayBuffer())
    .then(buf => _audioCtx.decodeAudioData(buf))
    .then(decoded => {
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