// Voiced lines: a cast member with `voice: { dir, ... }` (cast.js) gets an audio file per
// line, made ahead of time by tools/make-voices.mjs and saved in public/<dir>/.
// The file name is a short hash of the line's text as written in scenes.js, so editing
// a line means re-running the tool (a line with no file just plays silently).
export function lineHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const voiceFile = (dir, text) => `${dir}/${lineHash(text)}.mp3`;
