const BASE = import.meta.env.BASE_URL;

export const playSFX = (src, gain = 2.5) => {
  const ctx      = new (window.AudioContext || window.webkitAudioContext)();
  const source   = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain;

  fetch(src)
    .then(r => r.arrayBuffer())
    .then(buf => ctx.decodeAudioData(buf))
    .then(decoded => {
      source.buffer = decoded;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    })
    .catch(() => {});
};

export const playClose = () => playSFX(`${BASE}sounds/ui_close.mp3`);
export const playPress = () => {
  const sfxs = [`${BASE}sounds/ui_press.mp3`, `${BASE}sounds/ui_press2.mp3`];
  playSFX(sfxs[Math.floor(Math.random() * sfxs.length)]);
};